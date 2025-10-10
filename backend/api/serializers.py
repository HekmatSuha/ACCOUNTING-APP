# backend/api/serializers.py
from django.db import transaction
from django.db.models import F
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from decimal import Decimal
from .exchange_rates import get_exchange_rate
from .models import (
    Activity,
    BankAccount,
    BankAccountTransaction,
    CompanyInfo,
    CompanySettings,
    Currency,
    Customer,
    Expense,
    ExpenseCategory,
    Offer,
    OfferItem,
    Payment,
    Product,
    Purchase,
    PurchaseItem,
    PurchaseReturn,
    PurchaseReturnItem,
    Sale,
    SaleItem,
    SaleReturn,
    SaleReturnItem,
    Supplier,
    Warehouse,
    WarehouseInventory,
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

    def validate_base_currency(self, value):
        value = (value or '').upper()
        if not Currency.objects.filter(code=value).exists():
            raise serializers.ValidationError(
                "Currency must be added before it can be set as the base currency."
            )
        return value

    def update(self, instance, validated_data):
        new_code = validated_data.get('base_currency')
        if new_code and new_code != instance.base_currency:
            try:
                Currency.rebase(new_code)
            except Currency.DoesNotExist as exc:
                raise serializers.ValidationError({'base_currency': str(exc)}) from exc
            except ValueError as exc:
                raise serializers.ValidationError({'base_currency': str(exc)}) from exc
        return super().update(instance, validated_data)


class CurrencySerializer(serializers.ModelSerializer):
    is_base_currency = serializers.SerializerMethodField()

    class Meta:
        model = Currency
        fields = ['id', 'code', 'name', 'exchange_rate', 'is_base_currency']
        read_only_fields = ['id', 'is_base_currency']

    def get_is_base_currency(self, obj):
        return obj.code == CompanySettings.load().base_currency

    def validate_code(self, value):
        value = (value or '').upper()
        if len(value) != 3 or not value.isalpha():
            raise serializers.ValidationError('Currency code must be a 3-letter ISO code.')
        return value

    def validate_exchange_rate(self, value):
        if value <= 0:
            raise serializers.ValidationError('Exchange rate must be greater than zero.')
        return value

    def create(self, validated_data):
        validated_data['code'] = validated_data['code'].upper()
        if validated_data['code'] == CompanySettings.load().base_currency:
            validated_data['exchange_rate'] = Decimal('1')
        currency = super().create(validated_data)
        return currency

    def update(self, instance, validated_data):
        validated_data.pop('code', None)
        base_currency = CompanySettings.load().base_currency
        if instance.code == base_currency:
            # Ensure base currency always has an exchange rate of 1
            validated_data['exchange_rate'] = Decimal('1')
        return super().update(instance, validated_data)


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


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for viewing and updating the authenticated user's profile."""

    username = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']
        read_only_fields = ['id', 'username']


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer to validate password change requests."""

    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = self.context['request'].user

        if not user.check_password(attrs['current_password']):
            raise serializers.ValidationError({'current_password': 'Current password is incorrect.'})

        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})

        validate_password(attrs['new_password'], user=user)

        return attrs
    
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


class CustomerBalanceReportSerializer(serializers.ModelSerializer):
    """Serializer used by the customer balance report endpoint."""

    balance = serializers.DecimalField(
        source='open_balance', max_digits=12, decimal_places=2, read_only=True
    )
    status = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = ['id', 'name', 'email', 'phone', 'currency', 'balance', 'status']

    def get_status(self, obj):
        if obj.open_balance > 0:
            return 'owes_us'
        if obj.open_balance < 0:
            return 'we_owe_them'
        return 'settled'

class PaymentSerializer(serializers.ModelSerializer):
    customer = serializers.CharField(source='customer.name', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)
    original_currency = serializers.CharField(required=False)

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


class ProductSerializer(serializers.ModelSerializer):
    sku = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    image = serializers.ImageField(required=False, allow_null=True)
    warehouse_quantities = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'description',
            'sku',
            'purchase_price',
            'sale_price',
            'stock_quantity',
            'warehouse_quantities',
            'image',
        ]
        read_only_fields = ['created_by', 'stock_quantity', 'warehouse_quantities']

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

    def get_warehouse_quantities(self, obj):
        stocks = getattr(obj, 'warehouse_stocks', None)
        if hasattr(stocks, 'all'):
            stock_records = stocks.all()
        else:
            stock_records = obj.warehouse_stocks.all()
        return [
            {
                'warehouse_id': stock.warehouse_id,
                'warehouse_name': stock.warehouse.name,
                'quantity': stock.quantity,
            }
            for stock in stock_records
        ]


class WarehouseStockSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    sku = serializers.CharField(source='product.sku', read_only=True, allow_null=True)

    class Meta:
        model = WarehouseInventory
        fields = ['id', 'product', 'product_name', 'sku', 'quantity']


class WarehouseSerializer(serializers.ModelSerializer):
    total_skus = serializers.SerializerMethodField()
    total_quantity = serializers.SerializerMethodField()

    class Meta:
        model = Warehouse
        fields = ['id', 'name', 'location', 'created_at', 'total_skus', 'total_quantity']
        read_only_fields = ['id', 'created_at', 'total_skus', 'total_quantity']

    def _get_stock_records(self, obj):
        stocks = getattr(obj, 'stocks', None)
        if hasattr(stocks, 'all'):
            return stocks.all()
        return obj.stocks.all()

    def get_total_skus(self, obj):
        return self._get_stock_records(obj).count()

    def get_total_quantity(self, obj):
        return sum(
            (stock.quantity for stock in self._get_stock_records(obj)),
            Decimal('0'),
        )


class WarehouseDetailSerializer(WarehouseSerializer):
    stocks = WarehouseStockSerializer(many=True, read_only=True)

    class Meta(WarehouseSerializer.Meta):
        fields = WarehouseSerializer.Meta.fields + ['stocks']
        read_only_fields = WarehouseSerializer.Meta.read_only_fields + ['stocks']


class WarehouseTransferSerializer(serializers.Serializer):
    """Validate and perform inventory transfers between warehouses."""

    product_id = serializers.IntegerField()
    source_warehouse_id = serializers.IntegerField()
    destination_warehouse_id = serializers.IntegerField()
    quantity = serializers.DecimalField(max_digits=10, decimal_places=2)
    product_name = serializers.CharField(read_only=True)
    source_name = serializers.CharField(read_only=True)
    destination_name = serializers.CharField(read_only=True)
    source_quantity = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    destination_quantity = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError('Quantity must be greater than zero.')
        return value

    def validate(self, attrs):
        request = self.context['request']
        user = request.user

        try:
            product = Product.objects.get(
                id=attrs['product_id'], created_by=user
            )
        except Product.DoesNotExist as exc:
            raise serializers.ValidationError(
                {'product_id': 'Invalid product selection.'}
            ) from exc

        try:
            source = Warehouse.objects.get(
                id=attrs['source_warehouse_id'], created_by=user
            )
        except Warehouse.DoesNotExist as exc:
            raise serializers.ValidationError(
                {'source_warehouse_id': 'Invalid source warehouse selection.'}
            ) from exc

        try:
            destination = Warehouse.objects.get(
                id=attrs['destination_warehouse_id'], created_by=user
            )
        except Warehouse.DoesNotExist as exc:
            raise serializers.ValidationError(
                {'destination_warehouse_id': 'Invalid destination warehouse selection.'}
            ) from exc

        if source.id == destination.id:
            raise serializers.ValidationError(
                'Source and destination warehouses must be different.'
            )

        available = (
            WarehouseInventory.objects.filter(
                product=product, warehouse=source
            )
            .values_list('quantity', flat=True)
            .first()
            or Decimal('0')
        )

        if available < attrs['quantity']:
            raise serializers.ValidationError(
                {
                    'quantity': (
                        f"Insufficient stock for product '{product.name}' in "
                        f"warehouse '{source.name}'."
                    )
                }
            )

        attrs['product'] = product
        attrs['source'] = source
        attrs['destination'] = destination
        return attrs

    def create(self, validated_data):
        product = validated_data['product']
        source = validated_data['source']
        destination = validated_data['destination']
        quantity = validated_data['quantity']

        with transaction.atomic():
            WarehouseInventory.adjust_stock(product, source, -quantity)
            WarehouseInventory.adjust_stock(product, destination, quantity)

        source_quantity = (
            WarehouseInventory.objects.filter(product=product, warehouse=source)
            .values_list('quantity', flat=True)
            .first()
            or Decimal('0')
        )
        destination_quantity = (
            WarehouseInventory.objects.filter(
                product=product, warehouse=destination
            )
            .values_list('quantity', flat=True)
            .first()
            or Decimal('0')
        )

        return {
            'product_id': product.id,
            'source_warehouse_id': source.id,
            'destination_warehouse_id': destination.id,
            'quantity': quantity,
            'product_name': product.name,
            'source_name': source.name,
            'destination_name': destination.name,
            'source_quantity': source_quantity,
            'destination_quantity': destination_quantity,
        }

class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_image = serializers.SerializerMethodField()
    warehouse_id = serializers.IntegerField(source='warehouse.id', read_only=True)
    warehouse_name = serializers.CharField(
        source='warehouse.name', read_only=True, allow_null=True
    )

    class Meta:
        model = SaleItem
        fields = [
            'id',
            'product',
            'product_name',
            'product_image',
            'quantity',
            'unit_price',
            'line_total',
            'warehouse_id',
            'warehouse_name',
        ]

    def get_product_image(self, obj):
        """Return an absolute URL to the product image when it is available."""
        image_field = getattr(obj.product, 'image', None)
        if not image_field:
            return None

        try:
            image_url = image_field.url
        except Exception:
            return None

        request = self.context.get('request') if hasattr(self, 'context') else None
        if request is not None:
            return request.build_absolute_uri(image_url)
        return image_url

# This serializer is for CREATING sale items (only needs product ID)
class SaleItemWriteSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField()

    class Meta:
        model = SaleItem
        fields = ['product_id', 'quantity', 'unit_price', 'warehouse_id']

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
                warehouse_id = item_data.pop('warehouse_id')
                product = Product.objects.get(id=product_id, created_by=created_by)
                try:
                    warehouse = Warehouse.objects.get(
                        id=warehouse_id, created_by=created_by
                    )
                except Warehouse.DoesNotExist as exc:
                    raise serializers.ValidationError(
                        {'items': f"Invalid warehouse selection for product '{product.name}'."}
                    ) from exc
                quantity = Decimal(item_data['quantity'])

                sale_item = SaleItem.objects.create(
                    sale=sale,
                    product=product,
                    warehouse=warehouse,
                    **item_data,
                )

                WarehouseInventory.adjust_stock(product, warehouse, -quantity)

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
            for item in instance.items.select_related('product', 'warehouse'):
                warehouse = item.warehouse or Warehouse.get_default(
                    self.context['request'].user
                )
                if item.warehouse is None:
                    item.warehouse = warehouse
                    item.save(update_fields=['warehouse'])
                WarehouseInventory.adjust_stock(item.product, warehouse, item.quantity)

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
                warehouse_id = item_data.pop('warehouse_id')
                product = Product.objects.get(
                    id=product_id, created_by=self.context['request'].user
                )
                try:
                    warehouse = Warehouse.objects.get(
                        id=warehouse_id, created_by=self.context['request'].user
                    )
                except Warehouse.DoesNotExist as exc:
                    raise serializers.ValidationError(
                        {'items': f"Invalid warehouse selection for product '{product.name}'."}
                    ) from exc

                quantity = Decimal(item_data['quantity'])

                sale_item = SaleItem.objects.create(
                    sale=instance,
                    product=product,
                    warehouse=warehouse,
                    **item_data,
                )

                WarehouseInventory.adjust_stock(product, warehouse, -quantity)

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
    account_currency = serializers.CharField(
        source='account.currency', read_only=True, allow_null=True
    )
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, allow_null=True)

    class Meta:
        model = Expense
        fields = [
            'id',
            'category',
            'category_name',
            'amount',
            'original_amount',
            'original_currency',
            'exchange_rate',
            'converted_amount',
            'account_exchange_rate',
            'account_converted_amount',
            'expense_date',
            'description',
            'account',
            'account_name',
            'account_currency',
            'supplier',
            'supplier_name',
        ]
        read_only_fields = ['created_by', 'account_name', 'supplier_name']
        extra_kwargs = {
            'amount': {'required': False},
            'original_amount': {'required': False},
            'original_currency': {'required': False},
            'exchange_rate': {'required': False},
            'account_exchange_rate': {'required': False},
            'account_converted_amount': {'required': False},
            'converted_amount': {'required': False},
        }

    def validate_original_currency(self, value):
        value = (value or '').strip()
        return value.upper() if value else value

    def validate(self, attrs):
        attrs = super().validate(attrs)

        if self.instance is None:
            amount = attrs.get('amount')
            original_amount = attrs.get('original_amount')
            if amount in (None, '') and original_amount in (None, ''):
                raise serializers.ValidationError('Either amount or original_amount must be provided.')

        original_amount_supplied = 'original_amount' in getattr(self, 'initial_data', {})
        original_amount_input = None
        if original_amount_supplied:
            original_amount_input = self.initial_data.get('original_amount')

        if (
            (not original_amount_supplied or original_amount_input in (None, ''))
            and attrs.get('amount') not in (None, '')
        ):
            attrs['original_amount'] = attrs['amount']

        return attrs

class PurchaseItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    warehouse_id = serializers.IntegerField(source='warehouse.id', read_only=True)
    warehouse_name = serializers.CharField(
        source='warehouse.name', read_only=True, allow_null=True
    )

    class Meta:
        model = PurchaseItem
        fields = [
            'id',
            'product',
            'product_name',
            'quantity',
            'unit_price',
            'line_total',
            'warehouse_id',
            'warehouse_name',
        ]

# For creating a new purchase
class PurchaseItemWriteSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField()

    class Meta:
        model = PurchaseItem
        fields = ['product_id', 'quantity', 'unit_price', 'warehouse_id']


class SaleReturnItemSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField(required=False)
    reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = SaleReturnItem
        fields = ['product_id', 'quantity', 'unit_price', 'warehouse_id', 'reason']


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
            product = Product.objects.get(
                id=item_data['product_id'], created_by=self.context['request'].user
            )
            warehouse_id = item_data.get('warehouse_id')
            if warehouse_id is not None:
                try:
                    warehouse = Warehouse.objects.get(
                        id=warehouse_id, created_by=self.context['request'].user
                    )
                except Warehouse.DoesNotExist as exc:
                    raise serializers.ValidationError(
                        {'items': f"Invalid warehouse selection for product '{product.name}'."}
                    ) from exc
            else:
                warehouse = Warehouse.get_default(self.context['request'].user)

            SaleReturnItem.objects.create(
                sale_return=sale_return,
                product=product,
                quantity=item_data['quantity'],
                unit_price=item_data['unit_price'],
                warehouse=warehouse,
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
                warehouse_id = item_data.pop('warehouse_id')
                product = Product.objects.get(id=product_id, created_by=created_by)
                try:
                    warehouse = Warehouse.objects.get(
                        id=warehouse_id, created_by=created_by
                    )
                except Warehouse.DoesNotExist as exc:
                    raise serializers.ValidationError(
                        {'items': f"Invalid warehouse selection for product '{product.name}'."}
                    ) from exc

                quantity = Decimal(item_data['quantity'])

                purchase_item = PurchaseItem.objects.create(
                    purchase=purchase,
                    product=product,
                    warehouse=warehouse,
                    **item_data
                )

                WarehouseInventory.adjust_stock(product, warehouse, quantity)

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

            for item in instance.items.select_related('product', 'warehouse'):
                warehouse = item.warehouse or Warehouse.get_default(
                    self.context['request'].user
                )
                if item.warehouse is None:
                    item.warehouse = warehouse
                    item.save(update_fields=['warehouse'])
                WarehouseInventory.adjust_stock(item.product, warehouse, -item.quantity)

            instance.items.all().delete()

            exchange_rate = validated_data.get('exchange_rate', instance.exchange_rate)
            instance.exchange_rate = exchange_rate
            instance.original_currency = validated_data.get('original_currency', instance.original_currency)

            new_total_amount = 0
            for item_data in items_data:
                product_id = item_data.pop('product_id')
                warehouse_id = item_data.pop('warehouse_id')
                product = Product.objects.get(
                    id=product_id, created_by=self.context['request'].user
                )
                try:
                    warehouse = Warehouse.objects.get(
                        id=warehouse_id, created_by=self.context['request'].user
                    )
                except Warehouse.DoesNotExist as exc:
                    raise serializers.ValidationError(
                        {'items': f"Invalid warehouse selection for product '{product.name}'."}
                    ) from exc

                quantity = Decimal(item_data['quantity'])

                purchase_item = PurchaseItem.objects.create(
                    purchase=instance,
                    product=product,
                    warehouse=warehouse,
                    **item_data
                )

                WarehouseInventory.adjust_stock(product, warehouse, quantity)

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
    warehouse_id = serializers.IntegerField(required=False)

    class Meta:
        model = PurchaseReturnItem
        fields = ['product_id', 'quantity', 'unit_price', 'warehouse_id']


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
            product = Product.objects.get(
                id=item_data['product_id'], created_by=self.context['request'].user
            )
            warehouse_id = item_data.get('warehouse_id')
            if warehouse_id is not None:
                try:
                    warehouse = Warehouse.objects.get(
                        id=warehouse_id, created_by=self.context['request'].user
                    )
                except Warehouse.DoesNotExist as exc:
                    raise serializers.ValidationError(
                        {'items': f"Invalid warehouse selection for product '{product.name}'."}
                    ) from exc
            else:
                warehouse = Warehouse.get_default(self.context['request'].user)

            PurchaseReturnItem.objects.create(
                purchase_return=purchase_return,
                product=product,
                quantity=item_data['quantity'],
                unit_price=item_data['unit_price'],
                warehouse=warehouse,
            )
        purchase_return.save(commit=True)
        return purchase_return


class BankAccountSerializer(serializers.ModelSerializer):
    category_label = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = BankAccount
        fields = ['id', 'name', 'balance', 'currency', 'category', 'category_label', 'created_at']
        read_only_fields = ['balance', 'created_by', 'created_at']


class BankAccountTransactionSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.name', read_only=True)
    related_account_name = serializers.CharField(source='related_account.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    amount_in = serializers.SerializerMethodField()
    amount_out = serializers.SerializerMethodField()

    class Meta:
        model = BankAccountTransaction
        fields = [
            'id',
            'account',
            'account_name',
            'related_account',
            'related_account_name',
            'transaction_type',
            'amount',
            'amount_in',
            'amount_out',
            'currency',
            'description',
            'created_by',
            'created_by_name',
            'created_at',
        ]
        read_only_fields = ['created_by', 'created_at']

    def get_amount_in(self, obj):
        if obj.transaction_type in {
            BankAccountTransaction.DEPOSIT,
            BankAccountTransaction.TRANSFER_IN,
        }:
            return obj.amount
        return Decimal('0.00')

    def get_amount_out(self, obj):
        if obj.transaction_type in {
            BankAccountTransaction.WITHDRAWAL,
            BankAccountTransaction.TRANSFER_OUT,
        }:
            return obj.amount
        return Decimal('0.00')
