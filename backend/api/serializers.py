# backend/api/serializers.py
from django.db import transaction
from django.db.models import F
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from rest_framework import serializers
from decimal import Decimal
from .exchange_rates import get_exchange_rate
from .models import (
    Account,
    AccountInvitation,
    AccountMembership,
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
    ProductImage,
    Purchase,
    PurchaseItem,
    PurchaseReturn,
    PurchaseReturnItem,
    Sale,
    SaleItem,
    SaleReturn,
    SaleReturnItem,
    Subscription,
    SubscriptionPlan,
    Supplier,
    Warehouse,
    WarehouseInventory,
)
from .services.account_users import (
    activate_membership,
    consume_available_invitation,
    ensure_account_has_available_seat,
)
from rest_framework.validators import UniqueValidator


class AccountScopedSerializerMixin:
    """Mixin that provides access to the request-scoped account."""

    def get_account(self):
        request = self.context.get('request')
        if not request:
            return None
        return Account.for_user(getattr(request, 'user', None))


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


class PublicAccountRegistrationSerializer(serializers.Serializer):
    """Allow new users to self-register and provision an account."""

    company_name = serializers.CharField(required=False, allow_blank=True, max_length=255)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)

    def _generate_username(self, email: str) -> str:
        base = email.split('@')[0].strip()
        base = base or 'user'
        candidate = base
        suffix = 1
        while User.objects.filter(username=candidate).exists():
            candidate = f"{base}{suffix}"
            suffix += 1
        return candidate

    def _generate_account_name(self, preferred: str, username: str) -> str:
        base = (preferred or '').strip()
        if not base:
            base = f"{username}'s workspace"
        candidate = base
        suffix = 2
        while Account.objects.filter(name=candidate).exists():
            candidate = f"{base} {suffix}"
            suffix += 1
        return candidate

    def validate(self, attrs):
        email = attrs['email'].lower()
        attrs['email'] = email

        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})

        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError({'email': 'A user with this email already exists.'})

        first_name = (attrs.get('first_name') or '').strip()
        last_name = (attrs.get('last_name') or '').strip()
        attrs['first_name'] = first_name
        attrs['last_name'] = last_name

        username = self._generate_username(email)
        user_for_validation = User(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
        )
        validate_password(attrs['password'], user=user_for_validation)
        attrs['username'] = username

        company_name = (attrs.get('company_name') or '').strip()
        attrs['company_name'] = company_name
        attrs['account_name'] = self._generate_account_name(company_name, username)

        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        validated_data.pop('confirm_password', None)
        email = validated_data['email']
        username = validated_data['username']
        first_name = validated_data.get('first_name', '')
        last_name = validated_data.get('last_name', '')
        account_name = validated_data['account_name']

        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
            )
            account = Account.objects.create(name=account_name, owner=user)
            AccountMembership.objects.create(
                account=account,
                user=user,
                is_owner=True,
                is_admin=True,
                is_billing_manager=True,
            )

            plan_defaults = {
                'name': 'Starter',
                'price': Decimal('0'),
                'user_limit': 5,
                'billing_interval': SubscriptionPlan.BILLING_INTERVAL_MONTHLY,
                'currency': 'USD',
                'features': [],
            }
            plan, _ = SubscriptionPlan.objects.get_or_create(code='starter', defaults=plan_defaults)

            subscription = Subscription.objects.create(
                account=account,
                plan=plan,
                status=Subscription.STATUS_ACTIVE,
                current_period_start=timezone.now(),
                seats_in_use=1,
                seat_limit=plan.user_limit,
                billing_cycle=plan.billing_interval,
            )

            account.refresh_subscription_usage()

        return {
            'user': user,
            'account': account,
            'subscription': subscription,
        }

    def to_representation(self, instance):
        user = instance['user']
        account = instance['account']
        subscription = instance['subscription']
        return {
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
            },
            'account': {
                'id': account.id,
                'name': account.name,
                'slug': account.slug,
            },
            'subscription': {
                'plan': subscription.plan.code if subscription.plan else None,
                'seat_limit': subscription.seat_limit,
            },
        }


class AccountUserSerializer(AccountScopedSerializerMixin, serializers.Serializer):
    """Serializer used by staff or tenant admins to add users to an account."""

    account = serializers.PrimaryKeyRelatedField(
        queryset=Account.objects.all(), required=False
    )
    email = serializers.EmailField()
    username = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False)
    invite = serializers.BooleanField(default=False)
    is_admin = serializers.BooleanField(default=False)
    is_billing_manager = serializers.BooleanField(default=False)

    def _resolve_account(self, attrs: dict) -> Account:
        request = self.context.get('request')
        account = None
        if request and request.user and request.user.is_staff:
            account = attrs.get('account')
        if account is None:
            account = self.get_account()
        if not account:
            raise serializers.ValidationError({
                'account': 'An account context is required to manage users.'
            })
        return account

    def _normalise_username(self, username: str, email: str) -> str:
        base = (username or '').strip()
        if base:
            return base
        base = email.split('@')[0]
        candidate = base
        suffix = 1
        while User.objects.filter(username=candidate).exists():
            candidate = f"{base}{suffix}"
            suffix += 1
        return candidate

    def validate(self, attrs):
        account = self._resolve_account(attrs)
        attrs['account'] = account

        invite = attrs.get('invite', False)
        password = attrs.get('password')

        if not invite:
            if not password:
                raise serializers.ValidationError({
                    'password': 'A password is required when directly creating a user.'
                })
            validate_password(password)

        username = self._normalise_username(attrs.get('username', ''), attrs['email'])
        attrs['username'] = username

        return attrs

    def create(self, validated_data):
        account: Account = validated_data['account']
        email = validated_data['email']
        username = validated_data['username']
        invite = validated_data.get('invite', False)
        roles = {
            'is_admin': validated_data.get('is_admin', False),
            'is_billing_manager': validated_data.get('is_billing_manager', False),
        }
        request = self.context.get('request')
        inviter = getattr(request, 'user', None)

        if invite:
            invitation = consume_available_invitation(
                account,
                email,
                include_roles=roles,
                invited_by=inviter,
            )
            return invitation

        membership = AccountMembership.objects.filter(
            account=account, user__username=username
        ).select_related('user').first()

        if membership and membership.is_active:
            user = membership.user
            if email and user.email != email:
                user.email = email
        else:
            ensure_account_has_available_seat(account)
            user = None
            if membership:
                user = membership.user
            else:
                try:
                    user = User.objects.get(username=username)
                except User.DoesNotExist:
                    user = User(username=username)
            user.email = email
        user.set_password(validated_data['password'])
        user.save()

        if membership is None:
            membership = AccountMembership(
                account=account,
                user=user,
                invited_by=inviter,
            )

        membership.is_admin = roles['is_admin']
        membership.is_billing_manager = roles['is_billing_manager']
        membership.invited_by = membership.invited_by or inviter
        membership.save()
        activate_membership(membership)

        return membership

    def to_representation(self, instance):
        if isinstance(instance, AccountInvitation):
            return {
                'id': instance.id,
                'email': instance.email,
                'token': instance.token,
                'account': instance.account_id,
                'is_admin': instance.is_admin,
                'is_billing_manager': instance.is_billing_manager,
                'status': 'invited',
            }
        membership = instance
        return {
            'id': membership.id,
            'user': membership.user_id,
            'username': membership.user.username,
            'email': membership.user.email,
            'account': membership.account_id,
            'roles': membership.roles,
        }


class InvitationAcceptanceSerializer(serializers.Serializer):
    """Serializer that finalises an invitation by setting credentials."""

    token = serializers.CharField()
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        try:
            invitation = AccountInvitation.objects.select_related('account').get(
                token=attrs['token'], is_active=True
            )
        except AccountInvitation.DoesNotExist as exc:
            raise serializers.ValidationError({'token': 'Invitation is invalid or expired.'}) from exc

        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})

        validate_password(attrs['password'])
        attrs['invitation'] = invitation
        return attrs

    def create(self, validated_data):
        invitation: AccountInvitation = validated_data['invitation']
        account = invitation.account
        username = validated_data['username']
        password = validated_data['password']
        email = invitation.email

        user, _ = User.objects.get_or_create(username=username, defaults={'email': email})
        if email and user.email != email:
            user.email = email
        user.set_password(password)
        user.save()

        membership = AccountMembership.objects.filter(account=account, user=user).first()
        if not (membership and membership.is_active):
            ensure_account_has_available_seat(account)
            if membership is None:
                membership = AccountMembership(
                    account=account,
                    user=user,
                    invited_by=invitation.invited_by,
                )

        membership.is_admin = invitation.is_admin
        membership.is_billing_manager = invitation.is_billing_manager
        membership.invited_by = membership.invited_by or invitation.invited_by
        membership.save()
        activate_membership(membership)
        invitation.mark_accepted(membership)
        return membership


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for viewing and updating the authenticated user's profile."""

    username = serializers.CharField(read_only=True)
    is_staff = serializers.BooleanField(read_only=True)
    account = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'is_staff', 'account', 'roles']
        read_only_fields = ['id', 'username', 'is_staff', 'account', 'roles']

    def get_account(self, obj):
        account = Account.for_user(obj)
        if not account:
            return None
        return {'id': account.id, 'name': account.name, 'slug': account.slug}

    def get_roles(self, obj):
        account = Account.for_user(obj)
        if not account:
            return []
        membership = account.memberships.filter(user=obj, is_active=True).first()
        if not membership:
            return []
        return membership.roles


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


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'created_at']
        read_only_fields = ['id', 'created_at']


class ProductSerializer(AccountScopedSerializerMixin, serializers.ModelSerializer):
    sku = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    image = serializers.ImageField(required=False, allow_null=True)
    warehouse_quantities = serializers.SerializerMethodField()
    gallery = ProductImageSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'description',
            'sku',
            'category',
            'subcategory',
            'brand',
            'barcode',
            'unit_of_measure',
            'tags',
            'currency',
            'purchase_price',
            'sale_price',
            'tax_rate',
            'discount_rate',
            'wholesale_price',
            'minimum_sale_price',
            'profit_margin',
            'final_sale_price',
            'stock_quantity',
            'warehouse_quantities',
            'image',
            'gallery',
        ]
        read_only_fields = [
            'created_by',
            'stock_quantity',
            'warehouse_quantities',
            'profit_margin',
            'final_sale_price',
            'gallery',
        ]

    final_sale_price = serializers.SerializerMethodField()

    def validate_sku(self, value):
        if not value:
            return None
        account = self.get_account()
        if not account:
            return value
        qs = Product.objects.filter(account=account, sku=value)
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

    def get_final_sale_price(self, obj):
        return obj.final_sale_price

    def validate_tax_rate(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError('Tax rate must be between 0 and 100%.')
        return value

    def validate_discount_rate(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError('Discount must be between 0 and 100%.')
        return value

    def validate(self, attrs):
        minimum_sale_price = attrs.get('minimum_sale_price')
        sale_price = attrs.get('sale_price', getattr(self.instance, 'sale_price', None))
        if minimum_sale_price and sale_price and sale_price < minimum_sale_price:
            raise serializers.ValidationError(
                {'sale_price': 'Sale price must be greater than or equal to the minimum sale price.'}
            )
        return super().validate(attrs)

    def _sync_gallery(self, product):
        request = self.context.get('request')
        if not request:
            return

        getlist = getattr(request.FILES, 'getlist', None)
        if callable(getlist):
            for image_file in getlist('gallery_images'):
                if image_file:
                    ProductImage.objects.create(product=product, image=image_file)

        remove_ids = []
        data_getlist = getattr(request.data, 'getlist', None)
        if callable(data_getlist):
            remove_ids = [
                int(image_id)
                for image_id in data_getlist('gallery_remove_ids')
                if str(image_id).isdigit()
            ]
        else:
            raw_value = request.data.get('gallery_remove_ids')
            if isinstance(raw_value, (list, tuple)):
                remove_ids = [int(x) for x in raw_value if str(x).isdigit()]
            elif str(raw_value).isdigit():
                remove_ids = [int(raw_value)]

        if remove_ids:
            ProductImage.objects.filter(product=product, id__in=remove_ids).delete()

    def create(self, validated_data):
        product = super().create(validated_data)
        self._sync_gallery(product)
        return product

    def update(self, instance, validated_data):
        product = super().update(instance, validated_data)
        self._sync_gallery(product)
        return product


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


class WarehouseTransferSerializer(AccountScopedSerializerMixin, serializers.Serializer):
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
        account = self.get_account()

        try:
            product = Product.objects.get(
                id=attrs['product_id'], account=account
            )
        except Product.DoesNotExist as exc:
            raise serializers.ValidationError(
                {'product_id': 'Invalid product selection.'}
            ) from exc

        try:
            source = Warehouse.objects.get(
                id=attrs['source_warehouse_id'], account=account
            )
        except Warehouse.DoesNotExist as exc:
            raise serializers.ValidationError(
                {'source_warehouse_id': 'Invalid source warehouse selection.'}
            ) from exc

        try:
            destination = Warehouse.objects.get(
                id=attrs['destination_warehouse_id'], account=account
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
class SaleWriteSerializer(AccountScopedSerializerMixin, serializers.ModelSerializer):
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
        created_by = validated_data.pop(
            'created_by', self.context['request'].user
        )
        account = validated_data.pop('account', self.get_account())
        if account is None:
            raise serializers.ValidationError(
                'Unable to determine the account for this sale.'
            )

        with transaction.atomic():
            if not validated_data.get('invoice_number'):
                last_sale = (
                    Sale.objects.filter(account=account, invoice_number__isnull=False)
                    .order_by('-id')
                    .first()
                )
                if last_sale and last_sale.invoice_number and last_sale.invoice_number.isdigit():
                    next_number = int(last_sale.invoice_number) + 1
                else:
                    next_number = 1
                invoice_number = str(next_number)
                # Ensure uniqueness within the account in case another user chose the same number
                while Sale.objects.filter(account=account, invoice_number=invoice_number).exists():
                    next_number += 1
                    invoice_number = str(next_number)
                validated_data['invoice_number'] = invoice_number

            exchange_rate = validated_data.pop('exchange_rate', Decimal('1'))
            original_currency = validated_data.pop('original_currency', None)

            if customer_id:
                customer = Customer.objects.get(id=customer_id, account=account)
                sale = Sale.objects.create(created_by=created_by, customer=customer, exchange_rate=exchange_rate, original_currency=original_currency or customer.currency, account=account, **validated_data)
            else:
                supplier = Supplier.objects.get(id=supplier_id, account=account)
                sale = Sale.objects.create(created_by=created_by, supplier=supplier, exchange_rate=exchange_rate, original_currency=original_currency or supplier.currency, account=account, **validated_data)

            total_sale_amount = 0
            for item_data in items_data:
                product_id = item_data.pop('product_id')
                warehouse_id = item_data.pop('warehouse_id')
                product = Product.objects.get(id=product_id, account=account)
                try:
                    warehouse = Warehouse.objects.get(
                        id=warehouse_id, account=account
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

        account = self.get_account()

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
                    customer = Customer.objects.get(id=customer_id, account=account)
                    instance.customer = customer
                    instance.supplier = None
                else:
                    supplier = Supplier.objects.get(id=supplier_id, account=account)
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
                    id=product_id, account=account
                )
                try:
                    warehouse = Warehouse.objects.get(
                        id=warehouse_id, account=account
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

class OfferWriteSerializer(AccountScopedSerializerMixin, serializers.ModelSerializer):
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
        account = self.get_account()

        with transaction.atomic():
            customer = Customer.objects.get(id=customer_id, account=account)

            offer = Offer.objects.create(
                created_by=created_by,
                customer=customer,
                account=account,
                **validated_data
            )

            total_offer_amount = 0
            for item_data in items_data:
                product_id = item_data.pop('product_id')
                product = Product.objects.get(id=product_id, account=account)

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
        account = self.get_account()
        with transaction.atomic():
            instance.items.all().delete()
            total_offer_amount = 0
            for item_data in items_data:
                product_id = item_data.pop('product_id')
                product = Product.objects.get(id=product_id, account=account)
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
    warehouse_id = serializers.IntegerField(required=False, allow_null=True)

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


class SaleReturnSerializer(AccountScopedSerializerMixin, serializers.ModelSerializer):
    items = SaleReturnItemSerializer(many=True)
    sale_id = serializers.IntegerField()

    class Meta:
        model = SaleReturn
        fields = ['id', 'sale_id', 'return_date', 'total_amount', 'items']
        read_only_fields = ['id', 'total_amount']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        sale_id = validated_data.pop('sale_id')
        account = validated_data.pop('account', self.get_account())
        if account is None:
            raise serializers.ValidationError(
                'Unable to determine the account for this sale return.'
            )
        sale = Sale.objects.get(id=sale_id, account=account)
        created_by = validated_data.pop(
            'created_by', self.context['request'].user
        )
        sale_return = SaleReturn.objects.create(
            sale=sale,
            created_by=created_by,
            account=account,
            **validated_data,
        )
        for item_data in items_data:
            product = Product.objects.get(
                id=item_data['product_id'], account=account
            )
            warehouse_id = item_data.get('warehouse_id')
            if warehouse_id is not None:
                try:
                    warehouse = Warehouse.objects.get(
                        id=warehouse_id, account=account
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
class PurchaseWriteSerializer(AccountScopedSerializerMixin, serializers.ModelSerializer):
    items = PurchaseItemWriteSerializer(many=True)
    supplier_id = serializers.IntegerField(required=False)
    customer_id = serializers.IntegerField(required=False)
    class Meta:
        model = Purchase
        fields = [
            'supplier_id',
            'customer_id',
            'purchase_date',
            'bill_number',
            'account',
            'items',
            'original_currency',
            'exchange_rate',
        ]
        extra_kwargs = {
            'account': {'required': False},
            'bill_number': {'required': False, 'allow_blank': True},
            'original_currency': {'required': False},
            'exchange_rate': {'required': False},
        }

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        supplier_id = validated_data.pop('supplier_id', None)
        customer_id = validated_data.pop('customer_id', None)
        if not supplier_id and not customer_id:
            raise serializers.ValidationError('supplier_id or customer_id required')
        if supplier_id and customer_id:
            raise serializers.ValidationError('Only one of supplier_id or customer_id may be provided.')
        created_by = validated_data.pop(
            'created_by', self.context['request'].user
        )
        account = validated_data.pop('account', self.get_account())
        if account is None:
            raise serializers.ValidationError(
                'Unable to determine the account for this purchase.'
            )

        with transaction.atomic():
            exchange_rate = validated_data.pop('exchange_rate', Decimal('1'))
            original_currency = validated_data.pop('original_currency', None)

            if supplier_id:
                supplier = Supplier.objects.get(id=supplier_id, account=account)
                purchase = Purchase.objects.create(created_by=created_by, supplier=supplier, exchange_rate=exchange_rate, original_currency=original_currency or supplier.currency, account=account, **validated_data)
            else:
                customer = Customer.objects.get(id=customer_id, account=account)
                purchase = Purchase.objects.create(created_by=created_by, customer=customer, exchange_rate=exchange_rate, original_currency=original_currency or customer.currency, account=account, **validated_data)

            total_purchase_amount = 0
            default_warehouse = Warehouse.get_default(created_by)

            for item_data in items_data:
                product_id = item_data.pop('product_id')
                warehouse_id = item_data.pop('warehouse_id', None)
                product = Product.objects.get(id=product_id, account=account)
                if warehouse_id is None:
                    warehouse = default_warehouse
                else:
                    try:
                        warehouse = Warehouse.objects.get(
                            id=warehouse_id, account=account
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

        account = self.get_account()

        with transaction.atomic():
            old_supplier = instance.supplier
            old_customer = instance.customer
            if not instance.bank_account_id:
                if old_supplier:
                    Supplier.objects.filter(id=old_supplier.id).update(open_balance=F('open_balance') - instance.converted_amount)
                elif old_customer:
                    Customer.objects.filter(id=old_customer.id).update(open_balance=F('open_balance') + instance.converted_amount)

            # Handle partner switch
            if supplier_id != instance.supplier_id or customer_id != instance.customer_id:
                if supplier_id:
                    supplier = Supplier.objects.get(id=supplier_id, account=account)
                    instance.supplier = supplier
                    instance.customer = None
                else:
                    customer = Customer.objects.get(id=customer_id, account=account)
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
            created_by = getattr(instance, 'created_by', None) or self.context['request'].user
            default_warehouse = Warehouse.get_default(created_by)

            for item_data in items_data:
                product_id = item_data.pop('product_id')
                warehouse_id = item_data.pop('warehouse_id', None)
                product = Product.objects.get(
                    id=product_id, account=account
                )
                if warehouse_id is None:
                    warehouse = default_warehouse
                else:
                    try:
                        warehouse = Warehouse.objects.get(
                            id=warehouse_id, account=account
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


class PurchaseReturnSerializer(AccountScopedSerializerMixin, serializers.ModelSerializer):
    items = PurchaseReturnItemSerializer(many=True)
    purchase_id = serializers.IntegerField()

    class Meta:
        model = PurchaseReturn
        fields = ['id', 'purchase_id', 'return_date', 'total_amount', 'items']
        read_only_fields = ['id', 'total_amount']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        purchase_id = validated_data.pop('purchase_id')
        account = self.get_account()
        purchase = Purchase.objects.get(id=purchase_id, account=account)
        purchase_return = PurchaseReturn.objects.create(
            purchase=purchase,
            created_by=self.context['request'].user,
            account=account,
            **validated_data,
        )
        for item_data in items_data:
            product = Product.objects.get(
                id=item_data['product_id'], account=account
            )
            warehouse_id = item_data.get('warehouse_id')
            if warehouse_id is not None:
                try:
                    warehouse = Warehouse.objects.get(
                        id=warehouse_id, account=account
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
