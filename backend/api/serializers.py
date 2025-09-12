# backend/api/serializers.py
from django.db import transaction
from django.db.models import F
from django.contrib.auth.models import User
from rest_framework import serializers
from decimal import Decimal
from .exchange_rates import get_exchange_rate
from .models import (
    Customer,
    ExpenseCategory,
    Sale,
    Payment,
    Product,
    SaleItem,
    SaleReturn,
    SaleReturnItem,
    Supplier,
    Expense,
    Purchase,
    PurchaseItem,
    PurchaseReturn,
    PurchaseReturnItem,
    BankAccount,
    Activity,
    Offer,
    OfferItem,
    CompanyInfo,
    CompanySettings,
)
from rest_framework.validators import UniqueValidator


class CompanyInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyInfo
        fields = ['name', 'address', 'phone', 'email', 'website', 'logo']


class CompanySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanySettings
        fields = ['base_currency']


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
    """Serializer for :class:`Customer` objects.

    The frontend expects a ``balance`` field representing the customer's
    current open balance.  Historically the API exposed only
    ``open_balance`` which led to ``balance`` being ``undefined`` in the
    customer list view. The React component then treated the missing value
    as ``0`` causing every customer's balance to appear as ``0``.  To keep
    backwards compatibility while satisfying the frontend expectations we
    expose ``balance`` as a read‑only alias of ``open_balance``.
    """

    # expose ``balance`` derived from the model's ``open_balance`` field
    balance = serializers.DecimalField(
        source='open_balance', max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = Customer
        fields = [
            'id',
            'name',
            'email',
            'phone',
            'address',
            'balance',
            'currency',
            'created_at',
            'image',
        ]
        read_only_fields = ['created_by']

class PaymentSerializer(serializers.ModelSerializer):
    customer = serializers.CharField(source='customer.name', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id',
            'payment_date',
            'original_amount',
            'original_currency',
            'exchange_rate',
            'converted_amount',
            'account_exchange_rate',
            'account_converted_amount',
            'method',
            'notes',
            'account',
            'account_name',
            'created_at',
            'created_by',
            'customer',
        ]
        read_only_fields = ['created_by', 'customer', 'account_name', 'converted_amount', 'account_converted_amount', 'account_exchange_rate']

    def validate(self, attrs):
        account = attrs.get('account') or (self.instance.account if self.instance else None)

        original_currency = attrs.get('original_currency') or (account.currency if account else None)

        customer = self.context.get('customer') or (self.instance.customer if self.instance else None)
        if customer:
            attrs['original_currency'] = original_currency or customer.currency
            if attrs['original_currency'] != customer.currency:
                exchange_rate = attrs.get('exchange_rate')
                if not exchange_rate or Decimal(str(exchange_rate)) <= 0:
                    try:
                        attrs['exchange_rate'] = get_exchange_rate(
                            attrs['original_currency'], customer.currency
                        )
                    except ValueError:
                        raise serializers.ValidationError(
                            {'exchange_rate': 'Exchange rate required when currencies differ.'}
                        )
            else:
                attrs['exchange_rate'] = Decimal('1')

        original_currency = attrs.get('original_currency') or (
            self.instance.original_currency if self.instance else None
        )

        customer = self.context.get('customer') or (
            self.instance.customer if self.instance else None
        )
        if customer and not original_currency:
            original_currency = attrs['original_currency'] = customer.currency

        target_currency = account.currency if account else (
            customer.currency if customer else None
        )

        if (
            original_currency
            and target_currency
            and original_currency != target_currency
        ):
            exchange_rate = attrs.get('exchange_rate')
            if not exchange_rate or Decimal(str(exchange_rate)) <= 0:
                try:
                    attrs['exchange_rate'] = get_exchange_rate(
                        original_currency, target_currency
                    )
                except ValueError:
                    raise serializers.ValidationError(
                        {'exchange_rate': 'Exchange rate required when currencies differ.'}
                    )
        else:
            attrs['exchange_rate'] = Decimal('1')


        return attrs

class ProductSerializer(serializers.ModelSerializer):
    sku = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    image = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'sku', 'purchase_price', 'sale_price', 'stock_quantity', 'image']
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
    customer_name = serializers.CharField(source='customer.name', read_only=True, allow_null=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, allow_null=True)
    class Meta:
        model = Sale
        fields = [
            'id',
            'customer',
            'customer_name',
            'supplier',
            'supplier_name',
            'sale_date',
            'invoice_number',
            'original_currency',
            'original_amount',
            'exchange_rate',
            'converted_amount',
            'total_amount',
            'items',
        ]

# This serializer is for CREATING a full sale
class SaleWriteSerializer(serializers.ModelSerializer):
    items = SaleItemWriteSerializer(many=True)  # Nested items
    customer_id = serializers.IntegerField(required=False)
    supplier_id = serializers.IntegerField(required=False)

    class Meta:
        model = Sale
        fields = ['customer_id', 'supplier_id', 'sale_date', 'items', 'invoice_number', 'details', 'original_currency', 'exchange_rate']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        customer_id = validated_data.pop('customer_id', None)
        supplier_id = validated_data.pop('supplier_id', None)
        if not customer_id and not supplier_id:
            raise serializers.ValidationError('customer_id or supplier_id required')
        if customer_id and supplier_id:
            raise serializers.ValidationError('Only one of customer_id or supplier_id may be provided.')
        created_by = self.context['request'].user

        with transaction.atomic():
            if not validated_data.get('invoice_number'):
                last_sale = (
                    Sale.objects.filter(created_by=created_by, invoice_number__isnull=False)
                    .order_by('-id')
                    .first()
                )
                if last_sale and last_sale.invoice_number and last_sale.invoice_number.isdigit():
                    next_number = int(last_sale.invoice_number) + 1
                else:
                    next_number = 1
                invoice_number = str(next_number)
                # Ensure global uniqueness in case another user chose same number
                while Sale.objects.filter(invoice_number=invoice_number).exists():
                    next_number += 1
                    invoice_number = str(next_number)
                validated_data['invoice_number'] = invoice_number

            exchange_rate = validated_data.pop('exchange_rate', Decimal('1'))
            original_currency = validated_data.pop('original_currency', None)

            if customer_id:
                customer = Customer.objects.get(id=customer_id, created_by=created_by)
                sale = Sale.objects.create(created_by=created_by, customer=customer, exchange_rate=exchange_rate, original_currency=original_currency or customer.currency, **validated_data)
            else:
                supplier = Supplier.objects.get(id=supplier_id, created_by=created_by)
                sale = Sale.objects.create(created_by=created_by, supplier=supplier, exchange_rate=exchange_rate, original_currency=original_currency or supplier.currency, **validated_data)

            total_sale_amount = 0
            for item_data in items_data:
                product_id = item_data.pop('product_id')
                product = Product.objects.get(id=product_id, created_by=created_by)
                quantity = Decimal(item_data['quantity'])

                if product.stock_quantity < quantity:
                    raise serializers.ValidationError(
                        {
                            'items': f"Insufficient stock for product '{product.name}'."
                        }
                    )

                sale_item = SaleItem.objects.create(
                    sale=sale,
                    product=product,
                    **item_data
                )

                Product.objects.filter(id=product.id).update(stock_quantity=F('stock_quantity') - sale_item.quantity)

                total_sale_amount += sale_item.line_total

            sale.original_amount = total_sale_amount
            sale.save()

        return sale

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items')
        customer_id = validated_data.pop('customer_id', instance.customer_id)
        supplier_id = validated_data.pop('supplier_id', instance.supplier_id)
        if not customer_id and not supplier_id:
            raise serializers.ValidationError('customer_id or supplier_id required')
        if customer_id and supplier_id:
            raise serializers.ValidationError('Only one of customer_id or supplier_id may be provided.')

        with transaction.atomic():
            # Revert old transaction data
            for item in instance.items.all():
                Product.objects.filter(id=item.product.id).update(stock_quantity=F('stock_quantity') + item.quantity)

            instance.items.all().delete()

            # Handle partner switch
            if customer_id != instance.customer_id or supplier_id != instance.supplier_id:
                if customer_id:
                    customer = Customer.objects.get(id=customer_id, created_by=self.context['request'].user)
                    instance.customer = customer
                    instance.supplier = None
                else:
                    supplier = Supplier.objects.get(id=supplier_id, created_by=self.context['request'].user)
                    instance.supplier = supplier
                    instance.customer = None

            # Create new items
            exchange_rate = validated_data.get('exchange_rate', instance.exchange_rate)
            instance.exchange_rate = exchange_rate
            instance.original_currency = validated_data.get('original_currency', instance.original_currency)

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

            instance.original_amount = new_total_amount
            instance.sale_date = validated_data.get('sale_date', instance.sale_date)
            instance.invoice_number = validated_data.get('invoice_number', instance.invoice_number)
            instance.details = validated_data.get('details', instance.details)
            instance.save()

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
        fields = ['id', 'name', 'email', 'phone', 'address', 'currency', 'open_balance', 'created_at', 'image']
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


class SaleReturnItemSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField()
    reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = SaleReturnItem
        fields = ['product_id', 'quantity', 'unit_price', 'reason']


class SaleReturnSerializer(serializers.ModelSerializer):
    items = SaleReturnItemSerializer(many=True)
    sale_id = serializers.IntegerField()

    class Meta:
        model = SaleReturn
        fields = ['id', 'sale_id', 'return_date', 'total_amount', 'items']
        read_only_fields = ['id', 'total_amount']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        sale_id = validated_data.pop('sale_id')
        sale = Sale.objects.get(id=sale_id, created_by=self.context['request'].user)
        sale_return = SaleReturn.objects.create(sale=sale, created_by=self.context['request'].user, **validated_data)
        for item_data in items_data:
            product = Product.objects.get(id=item_data['product_id'], created_by=self.context['request'].user)
            SaleReturnItem.objects.create(
                sale_return=sale_return,
                product=product,
                quantity=item_data['quantity'],
                unit_price=item_data['unit_price'],
                reason=item_data.get('reason', '')
            )
        sale_return.save(commit=True)
        return sale_return

# For reading/viewing a purchase
class PurchaseReadSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, allow_null=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True, allow_null=True)
    account_name = serializers.CharField(source='account.name', read_only=True, allow_null=True)
    class Meta:
        model = Purchase
        fields = [
            'id',
            'supplier',
            'supplier_name',
            'customer',
            'customer_name',
            'purchase_date',
            'bill_number',
            'original_currency',
            'original_amount',
            'exchange_rate',
            'converted_amount',
            'total_amount',
            'account',
            'account_name',
            'items',
        ]

# For creating/writing a purchase
class PurchaseWriteSerializer(serializers.ModelSerializer):
    items = PurchaseItemWriteSerializer(many=True)
    supplier_id = serializers.IntegerField(required=False)
    customer_id = serializers.IntegerField(required=False)
    class Meta:
        model = Purchase
        fields = ['supplier_id', 'customer_id', 'purchase_date', 'bill_number', 'account', 'items', 'original_currency', 'exchange_rate']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        supplier_id = validated_data.pop('supplier_id', None)
        customer_id = validated_data.pop('customer_id', None)
        if not supplier_id and not customer_id:
            raise serializers.ValidationError('supplier_id or customer_id required')
        if supplier_id and customer_id:
            raise serializers.ValidationError('Only one of supplier_id or customer_id may be provided.')
        created_by = self.context['request'].user

        with transaction.atomic():
            exchange_rate = validated_data.pop('exchange_rate', Decimal('1'))
            original_currency = validated_data.pop('original_currency', None)

            if supplier_id:
                supplier = Supplier.objects.get(id=supplier_id, created_by=created_by)
                purchase = Purchase.objects.create(created_by=created_by, supplier=supplier, exchange_rate=exchange_rate, original_currency=original_currency or supplier.currency, **validated_data)
            else:
                customer = Customer.objects.get(id=customer_id, created_by=created_by)
                purchase = Purchase.objects.create(created_by=created_by, customer=customer, exchange_rate=exchange_rate, original_currency=original_currency or customer.currency, **validated_data)

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

            purchase.original_amount = total_purchase_amount
            purchase.save()

            if not purchase.account_id:
                if purchase.supplier_id:
                    Supplier.objects.filter(id=purchase.supplier.id).update(open_balance=F('open_balance') + purchase.converted_amount)
                else:
                    Customer.objects.filter(id=purchase.customer.id).update(open_balance=F('open_balance') - purchase.converted_amount)

        return purchase

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items')
        supplier_id = validated_data.pop('supplier_id', instance.supplier_id)
        customer_id = validated_data.pop('customer_id', instance.customer_id)
        if not supplier_id and not customer_id:
            raise serializers.ValidationError('supplier_id or customer_id required')
        if supplier_id and customer_id:
            raise serializers.ValidationError('Only one of supplier_id or customer_id may be provided.')

        with transaction.atomic():
            old_supplier = instance.supplier
            old_customer = instance.customer
            if not instance.account_id:
                if old_supplier:
                    Supplier.objects.filter(id=old_supplier.id).update(open_balance=F('open_balance') - instance.converted_amount)
                elif old_customer:
                    Customer.objects.filter(id=old_customer.id).update(open_balance=F('open_balance') + instance.converted_amount)

            # Handle partner switch
            if supplier_id != instance.supplier_id or customer_id != instance.customer_id:
                if supplier_id:
                    supplier = Supplier.objects.get(id=supplier_id, created_by=self.context['request'].user)
                    instance.supplier = supplier
                    instance.customer = None
                else:
                    customer = Customer.objects.get(id=customer_id, created_by=self.context['request'].user)
                    instance.customer = customer
                    instance.supplier = None
            else:
                supplier = instance.supplier
                customer = instance.customer

            for item in instance.items.all():
                Product.objects.filter(id=item.product.id).update(stock_quantity=F('stock_quantity') - item.quantity)

            instance.items.all().delete()

            exchange_rate = validated_data.get('exchange_rate', instance.exchange_rate)
            instance.exchange_rate = exchange_rate
            instance.original_currency = validated_data.get('original_currency', instance.original_currency)

            new_total_amount = 0
            for item_data in items_data:
                product_id = item_data.pop('product_id')
                product = Product.objects.get(id=product_id, created_by=self.context['request'].user)
                purchase_item = PurchaseItem.objects.create(purchase=instance, product=product, **item_data)

                Product.objects.filter(id=product.id).update(stock_quantity=F('stock_quantity') + purchase_item.quantity)

                new_total_amount += purchase_item.line_total

            instance.original_amount = new_total_amount
            instance.purchase_date = validated_data.get('purchase_date', instance.purchase_date)
            instance.bill_number = validated_data.get('bill_number', instance.bill_number)
            instance.account = validated_data.get('account', instance.account)
            instance.save()

            if not instance.account_id:
                if instance.supplier_id:
                    Supplier.objects.filter(id=instance.supplier.id).update(open_balance=F('open_balance') + instance.converted_amount)
                else:
                    Customer.objects.filter(id=instance.customer.id).update(open_balance=F('open_balance') - instance.converted_amount)

        return instance


class PurchaseReturnItemSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField()

    class Meta:
        model = PurchaseReturnItem
        fields = ['product_id', 'quantity', 'unit_price']


class PurchaseReturnSerializer(serializers.ModelSerializer):
    items = PurchaseReturnItemSerializer(many=True)
    purchase_id = serializers.IntegerField()

    class Meta:
        model = PurchaseReturn
        fields = ['id', 'purchase_id', 'return_date', 'total_amount', 'items']
        read_only_fields = ['id', 'total_amount']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        purchase_id = validated_data.pop('purchase_id')
        purchase = Purchase.objects.get(id=purchase_id, created_by=self.context['request'].user)
        purchase_return = PurchaseReturn.objects.create(purchase=purchase, created_by=self.context['request'].user, **validated_data)
        for item_data in items_data:
            product = Product.objects.get(id=item_data['product_id'], created_by=self.context['request'].user)
            PurchaseReturnItem.objects.create(
                purchase_return=purchase_return,
                product=product,
                quantity=item_data['quantity'],
                unit_price=item_data['unit_price'],
            )
        purchase_return.save(commit=True)
        return purchase_return


class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = ['id', 'name', 'balance', 'currency']
        read_only_fields = ['balance', 'created_by']
