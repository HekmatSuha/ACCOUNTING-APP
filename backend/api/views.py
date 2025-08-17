# backend/api/views.py
from datetime import date

from rest_framework import generics, viewsets, serializers, status
from .serializers import SupplierSerializer, UserSerializer,CustomerSerializer
from django.contrib.auth.models import User
from .models import Customer
from django.db.models import Sum
from rest_framework.decorators import action
from .models import Customer, Product, Sale, SaleItem,Supplier
from django.db import transaction 
from .models import Payment
from django.db.models import Sum, F, DecimalField # <-- 1. Add F and DecimalField
from django.db.models.functions import Coalesce
# Import the new models
from .models import ExpenseCategory, Expense,Purchase, PurchaseItem, Supplier
# Import the new serializers
from .serializers import ExpenseCategorySerializer, ExpenseSerializer,PurchaseReadSerializer, PurchaseWriteSerializer
from rest_framework.filters import SearchFilter


from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .serializers import UserSerializer, CustomerSerializer, SaleSerializer, PaymentSerializer, ProductSerializer,  SaleReadSerializer,SaleWriteSerializer,PaymentSerializer




@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    """
    Provides summary data for the dashboard.
    """
    user = request.user
    
    # Calculate total receivables
    total_receivables = user.customers.aggregate(
        total=Coalesce(Sum('open_balance'), 0, output_field=DecimalField())
    )['total']
    
    # --- 2. ADD THIS LOGIC TO CALCULATE STOCK VALUE ---
    # We multiply purchase_price by stock_quantity for each product and sum the result.
    # Coalesce ensures we get 0 if there are no products, instead of None.
    stock_value = user.products.aggregate(
        total_value=Coalesce(Sum(F('purchase_price') * F('stock_quantity')), 0, output_field=DecimalField())
    )['total_value']
    # ----------------------------------------------------

    data = {
        'total_receivables': total_receivables,
        'total_payables': 0.00, # Placeholder
        'turnover': 0.00, # Placeholder
        'expenses': 0.00, # Placeholder
        'stock_value': stock_value, # <-- 3. USE THE NEWLY CALCULATED VALUE
        'customer_count': user.customers.count(),
    }
    return Response(data)

# This view allows creating a new user (registration)
class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer


class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer


class CustomerViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated] # Ensure only authenticated users can access
    filter_backends = [SearchFilter]
    search_fields = ['name', 'email', 'phone']

    def get_queryset(self):
        """
        This view should return a list of all the customers
        for the currently authenticated user.
        """
        return self.request.user.customers.all().order_by('-created_at')

    def perform_create(self, serializer):
        """
        Assign the current user as the creator of the customer.
        """
        serializer.save(created_by=self.request.user)
    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        """
        Returns a single customer's details along with their sales and payments.
        """
        customer = self.get_object()
        sales = customer.sales.all().order_by('-sale_date')
        payments = customer.payments.all().order_by('-payment_date')
        
        # Calculate total turnover from sales
        total_turnover = sales.aggregate(Sum('total_amount'))['total_amount__sum'] or 0.00
        
        data = {
            'customer': CustomerSerializer(customer).data,
            'sales': SaleSerializer(sales, many=True).data,
            'payments': PaymentSerializer(payments, many=True).data,
            'summary': {
                'open_balance': customer.open_balance,
                'check_balance': 0.00, # Placeholder
                'note_balance': 0.00, # Placeholder
                'turnover': total_turnover
            }
        }
        return Response(data)

# --- Add this new view ---
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    """
    Provides summary data for the dashboard.
    """
    user = request.user
    
    # Calculate total receivables
    total_receivables = user.customers.aggregate(
        total=Coalesce(Sum('open_balance'), 0, output_field=DecimalField())
    )['total']
    
    # Calculate stock value
    stock_value = user.products.aggregate(
        total_value=Coalesce(Sum(F('purchase_price') * F('stock_quantity')), 0, output_field=DecimalField())
    )['total_value']

    # --- 1. ADD THIS LOGIC TO CALCULATE EXPENSES ---
    total_expenses = user.expenses.aggregate(
        total=Coalesce(Sum('amount'), 0, output_field=DecimalField())
    )['total']
    # -----------------------------------------------

    data = {
        'total_receivables': total_receivables,
        'total_payables': 0.00, # Placeholder
        'turnover': 0.00, # Placeholder
        'expenses': total_expenses, # <-- 2. USE THE NEWLY CALCULATED VALUE
        'stock_value': stock_value,
        'customer_count': user.customers.count(),
    }
    return Response(data)


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        This view should return a list of all the products
        for the currently authenticated user.
        """
        return self.request.user.products.all().order_by('name')

    def perform_create(self, serializer):
        """
        Assign the current user as the creator of the product.
        """
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
            # Use a database transaction to ensure data integrity
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
                    
                    # Decrease stock quantity
                    product.stock_quantity -= sale_item.quantity
                    product.save()
                    
                    total_sale_amount += sale_item.line_total
                
                # Update the total amount on the sale
                sale.total_amount = total_sale_amount
                sale.save()

                # Update the customer's open balance
                customer.open_balance += total_sale_amount
                customer.save()
        
        except (Customer.DoesNotExist, Product.DoesNotExist) as e:
            raise serializers.ValidationError(f"Invalid data provided: {e}")
        except Exception as e:
            raise serializers.ValidationError(f"An error occurred: {e}")
        
class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.suppliers.all().order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class PaymentViewSet(viewsets.ModelViewSet):
    """
    API endpoint for viewing and creating payments.
    Payments are managed in the context of a specific sale.
    """
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # This allows you to list payments for a specific sale, e.g., /api/sales/1/payments/
        sale_pk = self.kwargs.get('sale_pk')
        if sale_pk:
            return Payment.objects.filter(sale__id=sale_pk, created_by=self.request.user)
        # Or list all payments made by the user if no specific sale is mentioned
        return self.request.user.payments.all()

    def perform_create(self, serializer):
        # When creating a payment, we get the sale from the URL and assign it.
        sale_pk = self.kwargs.get('sale_pk')
        try:
            sale = Sale.objects.get(pk=sale_pk, created_by=self.request.user)
            # Automatically set customer from the sale's customer
            serializer.save(
                created_by=self.request.user, 
                sale=sale,
                customer=sale.customer
            )
        except Sale.DoesNotExist:
            # This is a simple way to handle the error if the sale doesn't exist
            from rest_framework.exceptions import NotFound
            raise NotFound(detail="Sale not found.")


# Expense Categories
class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    """API endpoint for expense categories."""
    serializer_class = ExpenseCategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.expense_categories.all().order_by('name')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class ExpenseViewSet(viewsets.ModelViewSet):
    """API endpoint for expenses."""
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.expenses.all().order_by('-expense_date')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profit_and_loss_report(request):
    """
    Generates a Profit & Loss report for a given date range.
    Expects 'start_date' and 'end_date' as query parameters.
    """
    user = request.user
    
    # Get date range from query parameters, with defaults
    start_date_str = request.query_params.get('start_date', '2000-01-01')
    end_date_str = request.query_params.get('end_date', date.today().strftime('%Y-%m-%d'))

    # --- CALCULATE REVENUE ---
    # Sum of all SaleItem line_totals within the date range
    sales_in_range = Sale.objects.filter(
        created_by=user, 
        sale_date__range=[start_date_str, end_date_str]
    )
    
    total_revenue = sales_in_range.aggregate(
        total=Coalesce(Sum('total_amount'), 0, output_field=DecimalField())
    )['total']

    # --- CALCULATE EXPENSES ---
    expenses_in_range = Expense.objects.filter(
        created_by=user,
        expense_date__range=[start_date_str, end_date_str]
    )
    
    # Group expenses by category
    expenses_by_category = expenses_in_range.values('category__name').annotate(
        total=Sum('amount')
    ).order_by('category__name')
    
    total_expenses = expenses_in_range.aggregate(
        total=Coalesce(Sum('amount'), 0, output_field=DecimalField())
    )['total']
    
    # --- CALCULATE NET PROFIT/LOSS ---
    net_profit = total_revenue - total_expenses

    report_data = {
        'start_date': start_date_str,
        'end_date': end_date_str,
        'total_revenue': total_revenue,
        'total_expenses': total_expenses,
        'net_profit': net_profit,
        'expenses_breakdown': list(expenses_by_category) # Convert queryset to list
    }
    
    return Response(report_data)


@transaction.atomic # Ensures all operations in this function succeed or fail together
def destroy(self, request, *args, **kwargs):
        """
        Custom logic to handle deleting a sale.
        """
        sale = self.get_object() # Get the sale instance

        # --- 1. Reverse the impact on customer's open balance ---
        customer = sale.customer
        customer.open_balance -= sale.total_amount
        customer.save()

        # --- 2. Restore the stock for each item sold ---
        for item in sale.items.all():
            product = item.product
            product.stock_quantity += item.quantity
            product.save()
        
        # --- 3. All related payments are automatically deleted due to the
        # on_delete=models.CASCADE setting on the Payment model's sale field.
        # So, we don't need to manually delete payments.

        # --- 4. Finally, delete the sale itself ---
        sale.delete()
        
        # Return a success response
        return Response(status=status.HTTP_204_NO_CONTENT)

@transaction.atomic
def update(self, request, *args, **kwargs):
        """
        Custom logic to handle updating a sale.
        """
        sale = self.get_object()
        serializer = self.get_serializer(sale, data=request.data)
        serializer.is_valid(raise_exception=True)
        
        validated_data = serializer.validated_data
        items_data = validated_data.pop('items')
        
        # --- 1. Revert old transaction data ---
        # Revert customer balance
        sale.customer.open_balance -= sale.total_amount
        sale.customer.save()
        # Revert stock quantities
        for item in sale.items.all():
            item.product.stock_quantity += item.quantity
            item.product.save()

        # --- 2. Delete old sale items ---
        sale.items.all().delete()
        
        # --- 3. Create new sale items and calculate new total ---
        new_total_amount = 0
        for item_data in items_data:
            product = item_data.pop('product')
            sale_item = SaleItem.objects.create(sale=sale, product=product, **item_data)
            
            # Decrease stock for the new item
            product.stock_quantity -= sale_item.quantity
            product.save()
            
            new_total_amount += sale_item.line_total
        
        # --- 4. Update the sale's total and the customer's balance ---
        sale.total_amount = new_total_amount
        sale.save()
        
        sale.customer.open_balance += new_total_amount
        sale.customer.save()

        # Use the ReadSerializer to return the updated data
        read_serializer = SaleReadSerializer(sale)
        return Response(read_serializer.data)


class PurchaseViewSet(viewsets.ModelViewSet):
    """API endpoint for managing purchases from suppliers."""
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
            
            # --- INCREASE STOCK QUANTITY ---
            product.stock_quantity += purchase_item.quantity
            product.save()
            
            total_purchase_amount += purchase_item.line_total
        
        purchase.total_amount = total_purchase_amount
        purchase.save()



@transaction.atomic
def destroy(self, request, *args, **kwargs):
        """
        Custom logic to handle deleting a purchase.
        This will revert the stock increase.
        """
        purchase = self.get_object()

        # Restore the stock for each item in the purchase
        for item in purchase.items.all():
            product = item.product
            product.stock_quantity -= item.quantity # Decrease stock
            product.save()
        
        # Finally, delete the purchase itself
        purchase.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)

@transaction.atomic
def update(self, request, *args, **kwargs):
        """
        Custom logic to handle updating a purchase.
        """
        purchase = self.get_object()
        serializer = self.get_serializer(purchase, data=request.data)
        serializer.is_valid(raise_exception=True)
        
        items_data = serializer.validated_data.pop('items')
        
        # --- 1. Revert old stock quantities ---
        for item in purchase.items.all():
            item.product.stock_quantity -= item.quantity
            item.product.save()

        # --- 2. Delete old purchase items ---
        purchase.items.all().delete()
        
        # --- 3. Create new purchase items and calculate new total ---
        new_total_amount = 0
        for item_data in items_data:
            product = item_data.pop('product')
            purchase_item = PurchaseItem.objects.create(purchase=purchase, product=product, **item_data)
            
            # Increase stock for the new item
            product.stock_quantity += purchase_item.quantity
            product.save()
            
            new_total_amount += purchase_item.line_total
        
        # --- 4. Update the purchase's total amount ---
        purchase.total_amount = new_total_amount
        purchase.save()

        # Use the ReadSerializer to return the updated data
        read_serializer = PurchaseReadSerializer(purchase)
        return Response(read_serializer.data)

