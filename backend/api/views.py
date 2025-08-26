# backend/api/views.py
from datetime import date
from rest_framework import generics, viewsets, serializers, status
from rest_framework.parsers import MultiPartParser, FormParser
from django.core import serializers as django_serializers
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Sum, F, DecimalField
from django.db.models.functions import Coalesce
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.filters import SearchFilter
import json
from django.contrib.contenttypes.models import ContentType
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
    Offer,
    OfferItem,
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
    OfferReadSerializer,
    OfferWriteSerializer,
)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    """
    Provides summary data for the dashboard.
    """
    user = request.user
    
    sales_total = Sale.objects.filter(customer__created_by=user).aggregate(
        total=Coalesce(Sum('total_amount'), 0, output_field=DecimalField())
    )['total']
    payments_total = Payment.objects.filter(customer__created_by=user).aggregate(
        total=Coalesce(Sum('converted_amount'), 0, output_field=DecimalField())
    )['total']
    total_receivables = sales_total - payments_total
    
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
                # Use the dynamically calculated balance so the frontend can
                # correctly show whether the customer has an outstanding debt
                # or credit.  The frontend expects this value under the
                # ``open_balance`` key (matching the supplier details view),
                # but the previous implementation provided ``balance`` which
                # resulted in the open balance card always showing as
                # "Settled".  Expose the value using the expected key.
                'open_balance': customer.balance,
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
                content_type = activity.content_type
                model_class = content_type.model_class()

                if model_class == Sale:
                    data = json.loads(activity.object_repr)
                    sale_obj = list(django_serializers.deserialize('json', data['sale']))[0]
                    sale_obj.save()
                    restored_sale = sale_obj.object

                    for item_obj in django_serializers.deserialize('json', data['items']):
                        item_obj.object.sale = restored_sale
                        item_obj.save()

                    # Re-apply financial logic
                    Customer.objects.filter(pk=restored_sale.customer.pk).update(open_balance=F('open_balance') + restored_sale.total_amount)
                    for item in restored_sale.items.all():
                        Product.objects.filter(pk=item.product.pk).update(stock_quantity=F('stock_quantity') - item.quantity)

                    log_activity(request.user, 'restored', restored_sale)

                elif model_class == Purchase:
                    data = json.loads(activity.object_repr)
                    purchase_obj = list(django_serializers.deserialize('json', data['purchase']))[0]
                    purchase_obj.save()
                    restored_purchase = purchase_obj.object

                    for item_obj in django_serializers.deserialize('json', data['items']):
                        item_obj.object.purchase = restored_purchase
                        item_obj.save()

                    # Re-apply financial logic
                    if not restored_purchase.account_id:
                        Supplier.objects.filter(pk=restored_purchase.supplier.pk).update(open_balance=F('open_balance') + restored_purchase.total_amount)
                    for item in restored_purchase.items.all():
                        Product.objects.filter(pk=item.product.pk).update(stock_quantity=F('stock_quantity') + item.quantity)

                    log_activity(request.user, 'restored', restored_purchase)

                else: # Generic restore for simple models
                    deserialized_obj = list(django_serializers.deserialize('json', activity.object_repr))[0]
                    deserialized_obj.save()
                    log_activity(request.user, 'restored', deserialized_obj.object)

                activity.description = f"(Restored) {activity.description}"
                activity.save()

            return Response({'status': 'success', 'message': 'Object restored successfully.'})
        except Exception as e:
            return Response({'status': 'error', 'message': f"An unexpected error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return self.request.user.products.all().order_by('name')

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        log_activity(self.request.user, 'created', instance)

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

        for payment in instance.payments.all():
            payment.delete()

        for item in instance.items.all():
            Product.objects.filter(id=item.product.id).update(stock_quantity=F('stock_quantity') + item.quantity)

        Customer.objects.filter(id=customer.id).update(open_balance=F('open_balance') - instance.total_amount)

        instance.delete()


class OfferViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return OfferWriteSerializer
        return OfferReadSerializer

    def get_serializer_context(self):
        """Include ``customer_id`` when using nested customer routes."""
        context = super().get_serializer_context()
        customer_pk = self.kwargs.get('customer_pk')
        if customer_pk is not None:
            context['customer_id'] = customer_pk
        return context

    def get_queryset(self):
        queryset = Offer.objects.filter(created_by=self.request.user).order_by('-offer_date')
        customer_pk = self.kwargs.get('customer_pk')
        if customer_pk is not None:
            queryset = queryset.filter(customer_id=customer_pk)
        return queryset

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        log_activity(self.request.user, 'created', instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'updated', instance)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != 'pending':
            raise serializers.ValidationError('Only pending offers can be updated.')
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != 'pending':
            raise serializers.ValidationError('Only pending offers can be deleted.')
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def convert_to_sale(self, request, pk=None):
        offer = self.get_object()
        if offer.status != 'pending':
            return Response({'status': 'error', 'message': 'Offer is not pending.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Create a new Sale object from the Offer
            sale = Sale.objects.create(
                customer=offer.customer,
                sale_date=date.today(),
                total_amount=offer.total_amount,
                details=offer.details,
                created_by=offer.created_by
            )

            # Create SaleItem objects from OfferItem objects
            for offer_item in offer.items.all():
                SaleItem.objects.create(
                    sale=sale,
                    product=offer_item.product,
                    quantity=offer_item.quantity,
                    unit_price=offer_item.unit_price
                )

                # Update product stock
                Product.objects.filter(id=offer_item.product.id).update(stock_quantity=F('stock_quantity') - offer_item.quantity)

            # Update customer's open balance
            Customer.objects.filter(id=offer.customer.id).update(open_balance=F('open_balance') + offer.total_amount)

            # Update the offer status to 'accepted'
            offer.status = 'accepted'
            offer.save()

            log_activity(request.user, 'created', sale, f"Converted from offer #{offer.id}")
            log_activity(request.user, 'updated', offer, "Converted to sale")

        return Response({'status': 'success', 'message': 'Offer converted to sale.', 'sale_id': sale.id})


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

    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        supplier = self.get_object()
        purchases = supplier.purchases.all().order_by('-purchase_date')

        # 'payments' is the related_name from Expense model's supplier field
        payments = supplier.payments.all().order_by('-expense_date')

        total_turnover = purchases.aggregate(Sum('total_amount'))['total_amount__sum'] or 0.00

        data = {
            'supplier': SupplierSerializer(supplier).data,
            'purchases': PurchaseReadSerializer(purchases, many=True).data,
            'payments': ExpenseSerializer(payments, many=True).data,
            'summary': {
                'open_balance': supplier.open_balance,
                'check_balance': 0.00,  # Placeholder
                'note_balance': 0.00,  # Placeholder
                'turnover': total_turnover
            }
        }
        return Response(data)


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

    def get_serializer_context(self):
        context = super().get_serializer_context()
        sale_pk = self.kwargs.get('sale_pk')
        if sale_pk:
            try:
                sale = Sale.objects.get(pk=sale_pk, created_by=self.request.user)
                context['customer'] = sale.customer
            except Sale.DoesNotExist:
                pass
        return context

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

    def get_serializer_context(self):
        context = super().get_serializer_context()
        customer_pk = self.kwargs.get('customer_pk')
        if customer_pk:
            try:
                customer = Customer.objects.get(pk=customer_pk, created_by=self.request.user)
                context['customer'] = customer
            except Customer.DoesNotExist:
                pass
        return context

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


class SupplierPaymentViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        supplier_pk = self.kwargs.get('supplier_pk')
        return Expense.objects.filter(supplier__id=supplier_pk, created_by=self.request.user)

    def perform_create(self, serializer):
        supplier_pk = self.kwargs.get('supplier_pk')
        try:
            supplier = Supplier.objects.get(pk=supplier_pk, created_by=self.request.user)
            instance = serializer.save(
                created_by=self.request.user,
                supplier=supplier
            )
            log_activity(self.request.user, 'created', instance)
        except Supplier.DoesNotExist:
            raise NotFound(detail="Supplier not found.")


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
