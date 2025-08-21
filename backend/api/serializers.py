# backend/api/serializers.py
from django.db import transaction
from django.db.models import F
from django.contrib.auth.models import User
from rest_framework import serializers
from .models import (
    Customer,
    ExpenseCategory,
    Sale,
    Payment,
    Product,
    SaleItem,
    Supplier,
    Expense,
    Purchase,
    PurchaseItem,
    BankAccount,
    Activity,
    Offer,
    OfferItem,
)
from rest_framework.validators import UniqueValidator

class ActivitySerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField()

    class Meta:
        model = Activity
        fields = ['id', 'user', 'action_type', 'description', 'timestamp', 'object_repr']

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
    account_name = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id',
            'payment_date',
            'amount',
            'method',
            'notes',
            'account',
            'account_name',
            'created_at',
            'created_by',
            'customer',
        ]
        read_only_fields = ['created_by', 'customer', 'account_name']

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
        fields = ['customer_id', 'sale_date', 'items', 'invoice_number', 'details']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        customer_id = validated_data.pop('customer_id')
        created_by = self.context['request'].user

        with transaction.atomic():
            customer = Customer.objects.get(id=customer_id, created_by=created_by)

            sale = Sale.objects.create(
                created_by=created_by,
                customer=customer,
                **validated_data
            )

            total_sale_amount = 0
            for item_data in items_data:
                product_id = item_data.pop('product_id')
                product = Product.objects.get(id=product_id, created_by=created_by)

                sale_item = SaleItem.objects.create(
                    sale=sale,
                    product=product,
                    **item_data
                )

                Product.objects.filter(id=product.id).update(stock_quantity=F('stock_quantity') - sale_item.quantity)

                total_sale_amount += sale_item.line_total

            sale.total_amount = total_sale_amount
            sale.save()

            Customer.objects.filter(id=customer.id).update(open_balance=F('open_balance') + total_sale_amount)

        return sale

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items')

        with transaction.atomic():
            # Revert old transaction data
            Customer.objects.filter(id=instance.customer.id).update(open_balance=F('open_balance') - instance.total_amount)
            for item in instance.items.all():
                Product.objects.filter(id=item.product.id).update(stock_quantity=F('stock_quantity') + item.quantity)

            instance.items.all().delete()

            # Create new items
            new_total_amount = 0
            for item_data in items_data:
                product_id = item_data.pop('product_id')
                product = Product.objects.get(id=product_id, created_by=self.context['request'].user)

                sale_item = SaleItem.objects.create(
                    sale=instance,
                    product=product,
                    **item_data
                )

                Product.objects.filter(id=product.id).update(stock_quantity=F('stock_quantity') - sale_item.quantity)

                new_total_amount += sale_item.line_total

            instance.total_amount = new_total_amount
            instance.sale_date = validated_data.get('sale_date', instance.sale_date)
            instance.invoice_number = validated_data.get('invoice_number', instance.invoice_number)
            instance.details = validated_data.get('details', instance.details)
            instance.save()
            Customer.objects.filter(id=instance.customer.id).update(open_balance=F('open_balance') + new_total_amount)

        return instance


class OfferItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    class Meta:
        model = OfferItem
        fields = ['id', 'product', 'product_name', 'quantity', 'unit_price', 'line_total']

class OfferItemWriteSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField()
    class Meta:
        model = OfferItem
        fields = ['product_id', 'quantity', 'unit_price']

class OfferReadSerializer(serializers.ModelSerializer):
    items = OfferItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    class Meta:
        model = Offer
        fields = ['id', 'customer', 'customer_name', 'offer_date', 'status', 'total_amount', 'items']

class OfferWriteSerializer(serializers.ModelSerializer):
    items = OfferItemWriteSerializer(many=True)
    # ``customer_id`` can be provided explicitly or inferred from the view context
    # when using nested routes like /customers/<id>/offers/.
    customer_id = serializers.IntegerField(required=False)

    class Meta:
        model = Offer
        fields = ['customer_id', 'offer_date', 'items', 'details']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        # Pull customer id either from data or from the view context (nested route)
        customer_id = validated_data.pop('customer_id', self.context.get('customer_id'))
        if customer_id is None:
            raise serializers.ValidationError({'customer_id': 'This field is required.'})

        # ``created_by`` may be supplied via ``serializer.save``; pop it to
        # avoid passing multiple values to ``Offer.objects.create``. Defaults
        # to the request user.
        created_by = validated_data.pop('created_by', self.context['request'].user)

        with transaction.atomic():
            customer = Customer.objects.get(id=customer_id, created_by=created_by)

            offer = Offer.objects.create(
                created_by=created_by,
                customer=customer,
                **validated_data
            )

            total_offer_amount = 0
            for item_data in items_data:
                product_id = item_data.pop('product_id')
                product = Product.objects.get(id=product_id, created_by=created_by)

                offer_item = OfferItem.objects.create(
                    offer=offer,
                    product=product,
                    **item_data
                )
                total_offer_amount += offer_item.line_total

            offer.total_amount = total_offer_amount
            offer.save()

        return offer

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items')
        with transaction.atomic():
            instance.items.all().delete()
            total_offer_amount = 0
            for item_data in items_data:
                product_id = item_data.pop('product_id')
                product = Product.objects.get(id=product_id, created_by=self.context['request'].user)
                offer_item = OfferItem.objects.create(
                    offer=instance,
                    product=product,
                    **item_data
                )
                total_offer_amount += offer_item.line_total

            instance.offer_date = validated_data.get('offer_date', instance.offer_date)
            instance.details = validated_data.get('details', instance.details)
            instance.total_amount = total_offer_amount
            instance.save()
        return instance


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
    account_name = serializers.CharField(source='account.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, allow_null=True)

    class Meta:
        model = Expense
        fields = [
            'id',
            'category',
            'category_name',
            'amount',
            'expense_date',
            'description',
            'account',
            'account_name',
            'supplier',
            'supplier_name',
        ]
        read_only_fields = ['created_by', 'account_name', 'supplier_name']

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
    account_name = serializers.CharField(source='account.name', read_only=True, allow_null=True)
    class Meta:
        model = Purchase
        fields = ['id', 'supplier', 'supplier_name', 'purchase_date', 'bill_number', 'total_amount', 'account', 'account_name', 'items']

# For creating/writing a purchase
class PurchaseWriteSerializer(serializers.ModelSerializer):
    items = PurchaseItemWriteSerializer(many=True)
    supplier_id = serializers.IntegerField()
    class Meta:
        model = Purchase
        fields = ['supplier_id', 'purchase_date', 'bill_number', 'account', 'items']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        supplier_id = validated_data.pop('supplier_id')
        created_by = self.context['request'].user

        with transaction.atomic():
            supplier = Supplier.objects.get(id=supplier_id, created_by=created_by)

            purchase = Purchase.objects.create(
                created_by=created_by,
                supplier=supplier,
                **validated_data
            )

            total_purchase_amount = 0
            for item_data in items_data:
                product_id = item_data.pop('product_id')
                product = Product.objects.get(id=product_id, created_by=created_by)

                purchase_item = PurchaseItem.objects.create(
                    purchase=purchase,
                    product=product,
                    **item_data
                )

                Product.objects.filter(id=product.id).update(stock_quantity=F('stock_quantity') + purchase_item.quantity)

                total_purchase_amount += purchase_item.line_total

            purchase.total_amount = total_purchase_amount
            purchase.save()

            if not purchase.account_id:
                Supplier.objects.filter(id=supplier.id).update(open_balance=F('open_balance') + total_purchase_amount)

        return purchase

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items')
        supplier_id = validated_data.pop('supplier_id', instance.supplier.id)

        with transaction.atomic():
            old_supplier = instance.supplier
            if not instance.account_id:
                Supplier.objects.filter(id=old_supplier.id).update(open_balance=F('open_balance') - instance.total_amount)

            if supplier_id != old_supplier.id:
                supplier = Supplier.objects.get(id=supplier_id, created_by=self.context['request'].user)
                instance.supplier = supplier
            else:
                supplier = old_supplier

            for item in instance.items.all():
                Product.objects.filter(id=item.product.id).update(stock_quantity=F('stock_quantity') - item.quantity)

            instance.items.all().delete()

            new_total_amount = 0
            for item_data in items_data:
                product_id = item_data.pop('product_id')
                product = Product.objects.get(id=product_id, created_by=self.context['request'].user)
                purchase_item = PurchaseItem.objects.create(purchase=instance, product=product, **item_data)

                Product.objects.filter(id=product.id).update(stock_quantity=F('stock_quantity') + purchase_item.quantity)

                new_total_amount += purchase_item.line_total

            instance.total_amount = new_total_amount
            instance.purchase_date = validated_data.get('purchase_date', instance.purchase_date)
            instance.bill_number = validated_data.get('bill_number', instance.bill_number)
            instance.account = validated_data.get('account', instance.account)
            instance.save()

            if not instance.account_id:
                Supplier.objects.filter(id=supplier.id).update(open_balance=F('open_balance') + new_total_amount)

        return instance


class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = ['id', 'name', 'balance']
        read_only_fields = ['balance', 'created_by']
