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

from .models import (
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
        serializer.save(created_by=self.request.user)

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


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.products.all().order_by('name')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class SaleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return SaleWriteSerializer
        return SaleReadSerializer
    
    def get_queryset(self):
        return Sale.objects.filter(created_by=self.request.user).order_by('-sale_date')

    def perform_create(self, serializer):
        validated_data = serializer.validated_data
        items_data = validated_data.pop('items')
        customer_id = validated_data.pop('customer_id')
        
        try:
            with transaction.atomic():
                customer = Customer.objects.get(id=customer_id, created_by=self.request.user)
                
                sale = Sale.objects.create(
                    created_by=self.request.user,
                    customer=customer,
                    **validated_data
                )
                
                total_sale_amount = 0
                for item_data in items_data:
                    product = Product.objects.get(id=item_data['product_id'], created_by=self.request.user)
                    
                    sale_item = SaleItem.objects.create(
                        sale=sale,
                        product=product,
                        quantity=item_data['quantity'],
                        unit_price=item_data['unit_price']
                    )
                    
                    product.stock_quantity = F('stock_quantity') - sale_item.quantity
                    product.save()
                    
                    total_sale_amount += sale_item.line_total
                
                sale.total_amount = total_sale_amount
                sale.save()

                customer.open_balance = F('open_balance') + total_sale_amount
                customer.save()
        
        except (Customer.DoesNotExist, Product.DoesNotExist) as e:
            raise serializers.ValidationError(f"Invalid data provided: {e}")
        except Exception as e:
            raise serializers.ValidationError(f"An error occurred: {e}")

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        sale = self.get_object()

        customer = sale.customer
        customer.open_balance = F('open_balance') - sale.total_amount
        customer.save()

        for item in sale.items.all():
            product = item.product
            product.stock_quantity = F('stock_quantity') + item.quantity
            product.save()

        sale.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        sale = self.get_object()
        serializer = self.get_serializer(sale, data=request.data)
        serializer.is_valid(raise_exception=True)

        validated_data = serializer.validated_data
        items_data = validated_data.pop('items')

        # Revert old transaction data
        sale.customer.open_balance = F('open_balance') - sale.total_amount
        sale.customer.save()
        for item in sale.items.all():
            item.product.stock_quantity = F('stock_quantity') + item.quantity
            item.product.save()

        sale.items.all().delete()
        
        new_total_amount = 0
        for item_data in items_data:
            product = Product.objects.get(id=item_data['product_id'], created_by=self.request.user)
            sale_item = SaleItem.objects.create(
                sale=sale,
                product=product,
                quantity=item_data['quantity'],
                unit_price=item_data['unit_price']
            )

            product.stock_quantity = F('stock_quantity') - sale_item.quantity
            product.save()

            new_total_amount += sale_item.line_total

        sale.total_amount = new_total_amount
        sale.save()

        sale.customer.open_balance = F('open_balance') + new_total_amount
        sale.customer.save()

        read_serializer = SaleReadSerializer(sale)
        return Response(read_serializer.data)


class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.suppliers.all().order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class BankAccountViewSet(viewsets.ModelViewSet):
    serializer_class = BankAccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.bank_accounts.all().order_by('name')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


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
            serializer.save(
                created_by=self.request.user, 
                sale=sale,
                customer=sale.customer
            )
        except Sale.DoesNotExist:
            raise NotFound(detail="Sale not found.")


class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseCategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.expense_categories.all().order_by('name')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.expenses.all().order_by('-expense_date')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


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


class PurchaseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update']:
            return PurchaseWriteSerializer
        return PurchaseReadSerializer

    def get_queryset(self):
        return self.request.user.purchases.all().order_by('-purchase_date')

    @transaction.atomic
    def perform_create(self, serializer):
        validated_data = serializer.validated_data
        items_data = validated_data.pop('items')
        supplier_id = validated_data.pop('supplier_id')
        
        supplier = Supplier.objects.get(id=supplier_id, created_by=self.request.user)
        
        purchase = Purchase.objects.create(
            created_by=self.request.user,
            supplier=supplier,
            **validated_data
        )
        
        total_purchase_amount = 0
        for item_data in items_data:
            product = Product.objects.get(id=item_data['product_id'], created_by=self.request.user)

            purchase_item = PurchaseItem.objects.create(
                purchase=purchase,
                product=product,
                quantity=item_data['quantity'],
                unit_price=item_data['unit_price']
            )
            
            product.stock_quantity = F('stock_quantity') + purchase_item.quantity
            product.save()
            
            total_purchase_amount += purchase_item.line_total

        purchase.total_amount = total_purchase_amount
        purchase.save()

        if not purchase.account_id:
            supplier.open_balance = F('open_balance') + total_purchase_amount
            supplier.save()

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        purchase = self.get_object()

        for item in purchase.items.all():
            product = item.product
            product.stock_quantity = F('stock_quantity') - item.quantity
            product.save()

        if not purchase.account_id:
            purchase.supplier.open_balance = F('open_balance') - purchase.total_amount
            purchase.supplier.save()

        purchase.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        purchase = self.get_object()
        serializer = self.get_serializer(purchase, data=request.data)
        serializer.is_valid(raise_exception=True)

        validated_data = serializer.validated_data
        items_data = validated_data.pop('items')
        supplier_id = validated_data.pop('supplier_id', purchase.supplier.id)

        old_supplier = purchase.supplier
        if purchase.account_id is None:
            old_supplier.open_balance = F('open_balance') - purchase.total_amount
            old_supplier.save()

        if supplier_id != old_supplier.id:
            supplier = Supplier.objects.get(id=supplier_id, created_by=self.request.user)
            purchase.supplier = supplier
        else:
            supplier = old_supplier

        for item in purchase.items.all():
            item.product.stock_quantity = F('stock_quantity') - item.quantity
            item.product.save()

        purchase.items.all().delete()

        new_total_amount = 0
        for item_data in items_data:
            product_id = item_data.pop('product_id')
            product = Product.objects.get(id=product_id, created_by=self.request.user)
            purchase_item = PurchaseItem.objects.create(purchase=purchase, product=product, **item_data)

            product.stock_quantity = F('stock_quantity') + purchase_item.quantity
            product.save()

            new_total_amount += purchase_item.line_total

        purchase.total_amount = new_total_amount
        purchase.purchase_date = validated_data.get('purchase_date', purchase.purchase_date)
        purchase.bill_number = validated_data.get('bill_number', purchase.bill_number)
        purchase.account = validated_data.get('account', purchase.account)
        purchase.save()

        if purchase.account_id is None:
            supplier.open_balance = F('open_balance') + new_total_amount
            supplier.save()

        read_serializer = PurchaseReadSerializer(purchase)
        return Response(read_serializer.data)
