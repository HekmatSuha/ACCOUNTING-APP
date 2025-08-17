# backend/api/serializers.py

from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Customer, ExpenseCategory,Sale, Payment, Product, SaleItem,Supplier, Expense,Purchase, PurchaseItem
from rest_framework.validators import UniqueValidator
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'password']
        # This extra argument ensures the password is not returned in API responses
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        """Create and return a new user."""
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password']
        )
        return user
    
class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        # --- Add 'image' to the fields list ---
        fields = ['id', 'name', 'email', 'phone', 'address', 'open_balance', 'currency', 'created_at', 'image']
        read_only_fields = ['created_by']


class SaleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sale
        fields = ['id', 'sale_date', 'total_amount', 'details', 'created_at', 'invoice_number', 'created_by']

class PaymentSerializer(serializers.ModelSerializer):
    customer = serializers.CharField(source='customer.name', read_only=True)
    
    class Meta:
        model = Payment
        fields = ['id', 'payment_date', 'amount', 'method', 'notes', 'created_at', 'created_by', 'customer']
        read_only_fields = ['created_by', 'customer']

class ProductSerializer(serializers.ModelSerializer):
    sku = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'sku', 'purchase_price', 'sale_price', 'stock_quantity']
        read_only_fields = ['created_by']

    def validate_sku(self, value):
        if not value:
            return None
        user = self.context['request'].user
        qs = Product.objects.filter(created_by=user, sku=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('A product with this SKU already exists.')
        return value

class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    class Meta:
        model = SaleItem
        fields = ['id', 'product', 'product_name', 'quantity', 'unit_price', 'line_total']

# This serializer is for CREATING sale items (only needs product ID)
class SaleItemWriteSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField()
    class Meta:
        model = SaleItem
        fields = ['product_id', 'quantity', 'unit_price']

# This serializer is for READING a full sale
class SaleReadSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    class Meta:
        model = Sale
        fields = ['id', 'customer', 'customer_name', 'sale_date', 'invoice_number', 'total_amount', 'items']

# This serializer is for CREATING a full sale
class SaleWriteSerializer(serializers.ModelSerializer):
    items = SaleItemWriteSerializer(many=True) # Nested items
    customer_id = serializers.IntegerField()

    class Meta:
        model = Sale
        fields = ['customer_id', 'sale_date', 'items']

class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ['id', 'name', 'email', 'phone', 'address', 'open_balance', 'created_at']
        read_only_fields = ['created_by']


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = ['id', 'name']
        read_only_fields = ['created_by']

class ExpenseSerializer(serializers.ModelSerializer):
    # This makes the category name appear in the API response, which is more useful than just the ID.
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)

    class Meta:
        model = Expense
        fields = ['id', 'category', 'category_name', 'amount', 'expense_date', 'description']
        read_only_fields = ['created_by']

class PurchaseItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    class Meta:
        model = PurchaseItem
        fields = ['id', 'product', 'product_name', 'quantity', 'unit_price', 'line_total']

# For creating a new purchase
class PurchaseItemWriteSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField()
    class Meta:
        model = PurchaseItem
        fields = ['product_id', 'quantity', 'unit_price']

# For reading/viewing a purchase
class PurchaseReadSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    class Meta:
        model = Purchase
        fields = ['id', 'supplier', 'supplier_name', 'purchase_date', 'bill_number', 'total_amount', 'items']

# For creating/writing a purchase
class PurchaseWriteSerializer(serializers.ModelSerializer):
    items = PurchaseItemWriteSerializer(many=True)
    supplier_id = serializers.IntegerField()
    class Meta:
        model = Purchase
        fields = ['supplier_id', 'purchase_date', 'bill_number', 'items']