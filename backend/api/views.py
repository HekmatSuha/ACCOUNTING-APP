# backend/api/views.py
from datetime import date
from rest_framework import generics, viewsets, serializers, status
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Sum, F, DecimalField
from django.db.models.functions import Coalesce
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter
from rest_framework.exceptions import NotFound
from .activity_logger import log_activity

from .models import (
    Activity,
    Customer,
    Product,
    Sale,
    SaleItem,
    Supplier,
    Payment,
    ExpenseCategory,
    Expense,
    Purchase,
    PurchaseItem,
    BankAccount,
)
from .serializers import (
    ActivitySerializer,
    UserSerializer,
    CustomerSerializer,
    SupplierSerializer,
    ProductSerializer,
    SaleReadSerializer,
    SaleWriteSerializer,
    PaymentSerializer,
    ExpenseCategorySerializer,
    ExpenseSerializer,
    PurchaseReadSerializer,
    PurchaseWriteSerializer,
    BankAccountSerializer,
)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    """
    Provides summary data for the dashboard.
    """
    user = request.user
    
    total_receivables = user.customers.aggregate(
        total=Coalesce(Sum('open_balance'), 0, output_field=DecimalField())
    )['total']
    
    stock_value = user.products.aggregate(
        total_value=Coalesce(Sum(F('purchase_price') * F('stock_quantity')), 0, output_field=DecimalField())
    )['total_value']

    total_expenses = user.expenses.aggregate(
        total=Coalesce(Sum('amount'), 0, output_field=DecimalField())
    )['total']

    data = {
        'total_receivables': total_receivables,
        'total_payables': 0.00,  # Placeholder
        'turnover': 0.00,  # Placeholder
        'expenses': total_expenses,
        'stock_value': stock_value,
        'customer_count': user.customers.count(),
    }
    return Response(data)


class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter]
    search_fields = ['name', 'email', 'phone']

    def get_queryset(self):
        return self.request.user.customers.all().order_by('-created_at')

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        log_activity(self.request.user, 'created', instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'updated', instance)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()

    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        customer = self.get_object()
        sales = customer.sales.all().order_by('-sale_date')
        payments = customer.payments.all().order_by('-payment_date')

        total_turnover = sales.aggregate(Sum('total_amount'))['total_amount__sum'] or 0.00

        data = {
            'customer': CustomerSerializer(customer).data,
            'sales': SaleReadSerializer(sales, many=True).data,
            'payments': PaymentSerializer(payments, many=True).data,
            'summary': {
                'open_balance': customer.open_balance,
                'check_balance': 0.00,  # Placeholder
                'note_balance': 0.00,  # Placeholder
                'turnover': total_turnover
            }
        }
        return Response(data)


class ActivityViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None  # Or a custom pagination class

    def get_queryset(self):
        return self.request.user.activities.all().order_by('-timestamp')

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        activity = self.get_object()
        if activity.action_type != 'deleted' or not activity.object_repr:
            return Response({'status': 'error', 'message': 'This action cannot be undone.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                # The object_repr is a serialized list of one object
                deserialized_obj = list(serializers.deserialize('json', activity.object_repr))[0]
                deserialized_obj.object.save()

                # Optional: Create a new activity log for the restoration
                log_activity(request.user, 'restored', deserialized_obj.object)

                # Mark the original 'deleted' activity as "undone"
                activity.description = f"(Restored) {activity.description}"
                activity.save()

            return Response({'status': 'success', 'message': 'Object restored successfully.'})
        except Exception as e:
            return Response({'status': 'error', 'message': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.products.all().order_by('name')

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        log_activity(self.request.user, 'created', instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'updated', instance)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()


class SaleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return SaleWriteSerializer
        return SaleReadSerializer
    
    def get_queryset(self):
        return Sale.objects.filter(created_by=self.request.user).order_by('-sale_date')

    def perform_create(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'created', instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'updated', instance)

    @transaction.atomic
    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        customer = instance.customer
        Customer.objects.filter(id=customer.id).update(open_balance=F('open_balance') - instance.total_amount)

        for item in instance.items.all():
            Product.objects.filter(id=item.product.id).update(stock_quantity=F('stock_quantity') + item.quantity)
        
        instance.delete()


class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.suppliers.all().order_by('-created_at')

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        log_activity(self.request.user, 'created', instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'updated', instance)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()


class BankAccountViewSet(viewsets.ModelViewSet):
    serializer_class = BankAccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.bank_accounts.all().order_by('name')

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        log_activity(self.request.user, 'created', instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'updated', instance)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()


class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        sale_pk = self.kwargs.get('sale_pk')
        if sale_pk:
            return Payment.objects.filter(sale__id=sale_pk, created_by=self.request.user)
        return self.request.user.payments.all()

    def perform_create(self, serializer):
        sale_pk = self.kwargs.get('sale_pk')
        try:
            sale = Sale.objects.get(pk=sale_pk, created_by=self.request.user)
            instance = serializer.save(
                created_by=self.request.user,
                sale=sale,
                customer=sale.customer
            )
            log_activity(self.request.user, 'created', instance)
        except Sale.DoesNotExist:
            raise NotFound(detail="Sale not found.")

    def perform_update(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'updated', instance)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()


class CustomerPaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        customer_pk = self.kwargs.get('customer_pk')
        return Payment.objects.filter(customer__id=customer_pk, created_by=self.request.user)

    def perform_create(self, serializer):
        customer_pk = self.kwargs.get('customer_pk')
        try:
            customer = Customer.objects.get(pk=customer_pk, created_by=self.request.user)
            instance = serializer.save(
                created_by=self.request.user,
                customer=customer
            )
            log_activity(self.request.user, 'created', instance)
        except Customer.DoesNotExist:
            raise NotFound(detail="Customer not found.")

    def perform_update(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'updated', instance)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()


class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseCategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.expense_categories.all().order_by('name')

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        log_activity(self.request.user, 'created', instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'updated', instance)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()


class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.expenses.all().order_by('-expense_date')

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        log_activity(self.request.user, 'created', instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'updated', instance)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profit_and_loss_report(request):
    user = request.user
    
    start_date_str = request.query_params.get('start_date', '2000-01-01')
    end_date_str = request.query_params.get('end_date', date.today().strftime('%Y-%m-%d'))

    sales_in_range = Sale.objects.filter(
        created_by=user, 
        sale_date__range=[start_date_str, end_date_str]
    )
    
    total_revenue = sales_in_range.aggregate(
        total=Coalesce(Sum('total_amount'), 0, output_field=DecimalField())
    )['total']

    expenses_in_range = Expense.objects.filter(
        created_by=user,
        expense_date__range=[start_date_str, end_date_str]
    )
    
    expenses_by_category = expenses_in_range.values('category__name').annotate(
        total=Sum('amount')
    ).order_by('category__name')
    
    total_expenses = expenses_in_range.aggregate(
        total=Coalesce(Sum('amount'), 0, output_field=DecimalField())
    )['total']
    
    net_profit = total_revenue - total_expenses

    report_data = {
        'start_date': start_date_str,
        'end_date': end_date_str,
        'total_revenue': total_revenue,
        'total_expenses': total_expenses,
        'net_profit': net_profit,
        'expenses_breakdown': list(expenses_by_category)
    }
    
    return Response(report_data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sales_report(request):
    """
    Provides a sales report for a given date range.
    """
    user = request.user

    start_date_str = request.query_params.get('start_date', '2000-01-01')
    end_date_str = request.query_params.get('end_date', date.today().strftime('%Y-%m-%d'))

    sales_in_range = Sale.objects.filter(
        created_by=user,
        sale_date__range=[start_date_str, end_date_str]
    ).order_by('-sale_date')

    serializer = SaleReadSerializer(sales_in_range, many=True)

    return Response(serializer.data)


class PurchaseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update']:
            return PurchaseWriteSerializer
        return PurchaseReadSerializer

    def get_queryset(self):
        return self.request.user.purchases.all().order_by('-purchase_date')

    def perform_create(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'created', instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'updated', instance)

    @transaction.atomic
    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        for item in instance.items.all():
            Product.objects.filter(id=item.product.id).update(stock_quantity=F('stock_quantity') - item.quantity)

        if not instance.account_id:
            Supplier.objects.filter(id=instance.supplier.id).update(open_balance=F('open_balance') - instance.total_amount)

        instance.delete()
