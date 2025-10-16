# backend/api/models.py
from datetime import date

from collections import OrderedDict

from django.db import models, transaction
from django.db.models import F, Sum, DecimalField
from django.db.models.functions import Coalesce
from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from django.utils.text import slugify

from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from .exchange_rates import get_exchange_rate
from .services import ledger

from decimal import Decimal, ROUND_HALF_UP

from .services.currency import convert_amount, normalise_currency, to_decimal


class Account(models.Model):
    """Represents a tenant within the application."""

    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    owner = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="owned_accounts",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:  # pragma: no cover - human readable helper
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name) or "account"
            slug = base
            suffix = 1
            while Account.objects.exclude(pk=self.pk).filter(slug=slug).exists():
                suffix += 1
                slug = f"{base}-{suffix}"
            self.slug = slug
        super().save(*args, **kwargs)

    @classmethod
    def for_user(cls, user: User | None) -> "Account | None":
        """Return the primary account for ``user`` if available."""

        if not user or not getattr(user, "pk", None):
            return None

        membership = (
            AccountMembership.objects.active()
            .filter(user=user)
            .select_related("account")
            .order_by("-is_owner", "-is_admin", "-joined_at")
            .first()
        )
        if membership:
            return membership.account
        return None

    @property
    def seats_in_use(self) -> int:
        return self.memberships.filter(is_active=True).count()

    @property
    def active_memberships(self):
        """Return a queryset of active memberships for the account."""

        return self.memberships.active()

    @property
    def user_limit(self) -> int | None:
        """Return the maximum number of users allowed for the account.

        The limit is primarily driven by the active subscription plan.  If the
        account does not yet have an associated subscription plan we fall back
        to a conservative single-seat allowance so that validations relying on
        the property continue to operate deterministically.
        """

        subscription = getattr(self, "subscription", None)
        if subscription and subscription.plan:
            return subscription.plan.user_limit
        return 1

    def refresh_subscription_usage(self) -> None:
        """Synchronise cached subscription seat counts with current usage."""

        subscription = getattr(self, "subscription", None)
        if subscription:
            subscription.refresh_seat_usage()


class AccountMembershipQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)


class AccountMembershipManager(models.Manager):
    def get_queryset(self):
        return AccountMembershipQuerySet(self.model, using=self._db)

    def active(self):
        return self.get_queryset().active()

    def active_for_user(self, user: User | None):
        if not user or not getattr(user, "pk", None):
            return self.none()
        return self.active().filter(user=user).select_related("account")


class AccountMembership(models.Model):
    """Link between :class:`Account` objects and Django users."""

    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="account_memberships",
    )
    is_owner = models.BooleanField(default=False)
    is_admin = models.BooleanField(default=False)
    is_billing_manager = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_account_invitations",
    )

    objects = AccountMembershipManager()

    class Meta:
        unique_together = ("account", "user")
        ordering = ["-is_owner", "-is_admin", "user__username"]

    def __str__(self) -> str:  # pragma: no cover - human readable helper
        return f"{self.user} → {self.account}"

    @property
    def roles(self) -> list[str]:
        mapping = OrderedDict(
            [
                ("owner", self.is_owner),
                ("admin", self.is_admin),
                ("billing", self.is_billing_manager),
            ]
        )
        return [name for name, enabled in mapping.items() if enabled]


class AccountInvitation(models.Model):
    """Tracks pending invitations for users to join an account."""

    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="invitations",
    )
    email = models.EmailField()
    token = models.CharField(max_length=64, unique=True)
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="issued_account_invitations",
    )
    is_admin = models.BooleanField(default=False)
    is_billing_manager = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    membership = models.ForeignKey(
        AccountMembership,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invitations",
    )

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["account", "email"],
                condition=models.Q(is_active=True),
                name="unique_active_invitation_per_account_email",
            )
        ]

    def __str__(self) -> str:  # pragma: no cover - helper only
        return f"Invitation to {self.email} for {self.account}"

    def mark_accepted(self, membership: AccountMembership) -> None:
        """Mark the invitation as accepted and bind to ``membership``."""

        self.membership = membership
        self.accepted_at = timezone.now()
        self.is_active = False
        self.save(update_fields=["membership", "accepted_at", "is_active"])


class SubscriptionPlan(models.Model):
    BILLING_INTERVAL_MONTHLY = "monthly"
    BILLING_INTERVAL_YEARLY = "yearly"
    BILLING_INTERVAL_CHOICES = (
        (BILLING_INTERVAL_MONTHLY, "Monthly"),
        (BILLING_INTERVAL_YEARLY, "Yearly"),
    )

    code = models.SlugField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    user_limit = models.PositiveIntegerField(default=1)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"))
    billing_interval = models.CharField(
        max_length=20, choices=BILLING_INTERVAL_CHOICES, default=BILLING_INTERVAL_MONTHLY
    )
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["price", "name"]

    def __str__(self):  # pragma: no cover - helper only
        return f"{self.name} ({self.code})"


class Subscription(models.Model):
    STATUS_TRIALING = "trialing"
    STATUS_ACTIVE = "active"
    STATUS_PAST_DUE = "past_due"
    STATUS_CANCELED = "canceled"
    STATUS_CHOICES = (
        (STATUS_TRIALING, "Trialing"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_PAST_DUE, "Past Due"),
        (STATUS_CANCELED, "Canceled"),
    )

    account = models.OneToOneField(
        Account,
        on_delete=models.CASCADE,
        related_name="subscription",
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.SET_NULL,
        null=True,
        related_name="subscriptions",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    current_period_start = models.DateTimeField(default=timezone.now)
    current_period_end = models.DateTimeField(null=True, blank=True)
    trial_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    canceled_at = models.DateTimeField(null=True, blank=True)
    seats_in_use = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):  # pragma: no cover
        return f"{self.account} – {self.plan}"

    def refresh_seat_usage(self):
        seats = self.account.seats_in_use
        if seats != self.seats_in_use:
            self.seats_in_use = seats
            self.save(update_fields=["seats_in_use", "updated_at"])


def _resolve_account_from_created_by(instance) -> Account | None:
    user = getattr(instance, "created_by", None)
    if user and getattr(user, "pk", None):
        return Account.for_user(user)
    return None


def ensure_account(instance) -> None:
    """Ensure ``instance`` has an account assigned if possible."""

    if getattr(instance, "account_id", None):
        return
    account = _resolve_account_from_created_by(instance)
    if account:
        instance.account = account




class Currency(models.Model):
    """Represents a currency available within the system."""

    code = models.CharField(max_length=3, unique=True)
    name = models.CharField(max_length=100, blank=True)
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=6, default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code}"

    def save(self, *args, **kwargs):
        self.code = (self.code or "").upper()
        if not self.name:
            self.name = self.code
        super().save(*args, **kwargs)

    @classmethod
    def rebase(cls, new_base_code: str) -> None:
        """Recalculate exchange rates relative to ``new_base_code``."""

        new_base_code = (new_base_code or "").upper()
        currencies = list(cls.objects.all())
        try:
            new_base_currency = next(c for c in currencies if c.code == new_base_code)
        except StopIteration as exc:
            raise cls.DoesNotExist(f"Currency '{new_base_code}' is not defined") from exc

        base_rate = Decimal(new_base_currency.exchange_rate)
        if base_rate <= 0:
            raise ValueError("Base currency must have a positive exchange rate")

        quantizer = Decimal("1.000000")
        updated: list["Currency"] = []
        for currency in currencies:
            if currency.code == new_base_code:
                if currency.exchange_rate != Decimal("1"):
                    currency.exchange_rate = Decimal("1")
                    updated.append(currency)
                continue

            new_rate = (Decimal(currency.exchange_rate) / base_rate).quantize(
                quantizer, rounding=ROUND_HALF_UP
            )
            if currency.exchange_rate != new_rate:
                currency.exchange_rate = new_rate
                updated.append(currency)

        if updated:
            cls.objects.bulk_update(updated, ["exchange_rate"])

class Activity(models.Model):
    ACTION_TYPES = (
        ('created', 'Created'),
        ('updated', 'Updated'),
        ('deleted', 'Deleted'),
        ('restored', 'Restored'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activities')
    action_type = models.CharField(max_length=10, choices=ACTION_TYPES)
    description = models.CharField(max_length=255)
    timestamp = models.DateTimeField(auto_now_add=True)

    # Generic relationship to the object that was acted upon
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')

    # For "deleted" actions, we can store the object's data so we can restore it
    object_repr = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name_plural = 'Activities'

    def __str__(self):
        return f'{self.user.username} {self.action_type} - {self.description}'

class Customer(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField(max_length=254, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to='customer_images/', blank=True, null=True)
    currency = models.CharField(max_length=3, default='USD')
    open_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='customers')
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="customers",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    @property
    def balance(self):
        """
        Returns the customer's current open balance.

        This property is an accessor to the ``open_balance`` field, which is
        the single source of truth for the customer's balance. The
        ``open_balance`` field is updated transactionally when sales,
        payments, or purchases are made.
        """
        return self.open_balance

    def save(self, *args, **kwargs):
        ensure_account(self)
        super().save(*args, **kwargs)


class Sale(models.Model):
    # Either a customer or supplier can be the counterparty of a sale
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='sales', null=True, blank=True)
    supplier = models.ForeignKey('Supplier', on_delete=models.CASCADE, related_name='sales', null=True, blank=True)
    sale_date = models.DateField(default=date.today)
    invoice_number = models.CharField(max_length=50, unique=True, blank=True, null=True)
    original_currency = models.CharField(max_length=3, default='USD')
    original_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=6, default=1)
    converted_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    details = models.TextField(blank=True, null=True)  # e.g., "5 x RAISINS @ 9500"
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sales')
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="sales",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.customer_id:
            return f"Sale #{self.id} for {self.customer.name}"
        return f"Sale #{self.id} to {self.supplier.name}"

    def save(self, *args, **kwargs):
        ensure_account(self)
        with transaction.atomic():
            # If the object is already in the database, get its old state
            if self.pk:
                old_sale = Sale.objects.select_for_update().get(pk=self.pk)
                # Revert the old balance change before applying the new one
                if old_sale.customer_id:
                    ledger.reverse_customer_movement(old_sale.customer_id, old_sale.total_amount)
                elif old_sale.supplier_id:
                    ledger.reverse_supplier_movement(old_sale.supplier_id, -old_sale.total_amount)

            # Compute converted amount from original amount
            self.converted_amount = (
                Decimal(self.original_amount) * Decimal(self.exchange_rate)
            ).quantize(Decimal('0.01')) if self.original_amount else Decimal('0')
            self.total_amount = self.converted_amount

            super().save(*args, **kwargs)

            # Apply the new balance change
            if self.customer_id:
                ledger.apply_customer_movement(self.customer_id, self.total_amount)
            elif self.supplier_id:
                ledger.apply_supplier_movement(self.supplier_id, -self.total_amount)


class Offer(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
    ]

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='offers')
    offer_date = models.DateField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    details = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='offers')
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="offers",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Offer #{self.id} for {self.customer.name}"

    def save(self, *args, **kwargs):
        ensure_account(self)
        super().save(*args, **kwargs)


class BankAccount(models.Model):
    CASH = 'cash'
    BANK = 'bank'
    POS = 'pos'
    PARTNER = 'partner'
    CREDIT_CARD = 'credit_card'
    LIABILITY = 'liability'
    OTHER = 'other'

    ACCOUNT_CATEGORY_CHOICES = [
        (CASH, 'Cash Accounts'),
        (BANK, 'Bank Accounts'),
        (POS, 'POS Accounts'),
        (PARTNER, 'Partner Accounts'),
        (CREDIT_CARD, 'Credit Cards'),
        (LIABILITY, 'Liability Accounts'),
        (OTHER, 'Other Accounts'),
    ]

    name = models.CharField(max_length=255)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default='USD')
    category = models.CharField(max_length=20, choices=ACCOUNT_CATEGORY_CHOICES, default=OTHER)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bank_accounts')
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="bank_accounts",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        ensure_account(self)
        super().save(*args, **kwargs)


class BankAccountTransaction(models.Model):
    DEPOSIT = 'deposit'
    WITHDRAWAL = 'withdrawal'
    TRANSFER_IN = 'transfer_in'
    TRANSFER_OUT = 'transfer_out'

    TRANSACTION_TYPE_CHOICES = [
        (DEPOSIT, 'Deposit'),
        (WITHDRAWAL, 'Withdrawal'),
        (TRANSFER_IN, 'Transfer In'),
        (TRANSFER_OUT, 'Transfer Out'),
    ]

    bank_account = models.ForeignKey(
        BankAccount,
        on_delete=models.CASCADE,
        related_name='transactions',
    )
    related_account = models.ForeignKey(
        BankAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='related_transactions',
    )
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3)
    description = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bank_account_transactions')
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="bank_account_transactions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_transaction_type_display()} - {self.amount} {self.currency}"

    def save(self, *args, **kwargs):
        ensure_account(self)
        super().save(*args, **kwargs)


class Payment(models.Model):
    PAYMENT_METHODS = [
        ('Cash', 'Cash'),
        ('Bank', 'Bank Transfer'),
        ('Card', 'Credit/Debit Card'),
    ]
    # keep payment-to-customer if you need it:
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='payments')

    # NEW: add an optional link to a specific sale (your /api/sales/<pk>/payments/ view needs this)
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='payments', blank=True, null=True)

    payment_date = models.DateField()
    original_amount = models.DecimalField(max_digits=12, decimal_places=2)
    original_currency = models.CharField(max_length=3)
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=6, null=True, blank=True)
    converted_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    account_exchange_rate = models.DecimalField(max_digits=12, decimal_places=6, null=True, blank=True)
    account_converted_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='Cash')
    notes = models.TextField(blank=True, null=True)
    bank_account = models.ForeignKey(
        BankAccount,
        on_delete=models.CASCADE,
        related_name='payments',
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payments')
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="payments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.sale_id:
            return f"Payment of {self.original_amount} for Sale #{self.sale.id}"
        return f"Payment of {self.original_amount} from {self.customer.name}"

    def save(self, *args, **kwargs):
        ensure_account(self)
        original_amount = to_decimal(self.original_amount)
        self.original_amount = original_amount

        customer_currency = normalise_currency(self.customer.currency)
        account_currency = None
        if self.bank_account_id:
            account_currency = getattr(self.bank_account, "currency", None)
            if not account_currency:
                account_currency = (
                    BankAccount.objects.filter(pk=self.bank_account_id)
                    .values_list("currency", flat=True)
                    .first()
                )

        self.original_currency = normalise_currency(
            self.original_currency,
            account_currency,
            customer_currency,
        )

        self.exchange_rate, self.converted_amount = convert_amount(
            original_amount,
            self.original_currency,
            customer_currency,
            manual_rate=self.exchange_rate,
        )

        if self.bank_account_id:
            resolved_account_currency = normalise_currency(
                account_currency,
                customer_currency,
                self.original_currency,
            )
            (
                self.account_exchange_rate,
                self.account_converted_amount,
            ) = convert_amount(
                original_amount,
                self.original_currency,
                resolved_account_currency,
                manual_rate=self.account_exchange_rate,
            )
        else:
            self.account_exchange_rate = Decimal("1")
            self.account_converted_amount = Decimal("0")

        with transaction.atomic():
            if self.pk:
                old = Payment.objects.select_for_update().get(pk=self.pk)

                # Update customer balance using converted amounts
                if old.customer_id != self.customer_id:
                    ledger.apply_customer_movement(
                        old.customer_id, old.converted_amount
                    )
                    ledger.apply_customer_movement(
                        self.customer_id, -self.converted_amount
                    )
                else:
                    delta = self.converted_amount - old.converted_amount
                    ledger.apply_customer_movement(self.customer_id, -delta)

                # Update bank account balance using converted amounts
                if old.bank_account_id != self.bank_account_id:
                    if old.bank_account_id:
                        ledger.apply_bank_account_movement(
                            old.bank_account_id, -old.account_converted_amount
                        )
                    if self.bank_account_id:
                        ledger.apply_bank_account_movement(
                            self.bank_account_id, self.account_converted_amount
                        )
                elif self.bank_account_id:
                    delta = self.account_converted_amount - old.account_converted_amount
                    ledger.apply_bank_account_movement(self.bank_account_id, delta)
            else:
                ledger.apply_customer_movement(
                    self.customer_id, -self.converted_amount
                )
                if self.bank_account_id:
                    ledger.apply_bank_account_movement(
                        self.bank_account_id, self.account_converted_amount
                    )
            super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            ledger.apply_customer_movement(
                self.customer_id, self.converted_amount
            )
            if self.bank_account_id:
                ledger.apply_bank_account_movement(
                    self.bank_account_id, -self.account_converted_amount
                )
            super().delete(*args, **kwargs)


class Warehouse(models.Model):
    """Physical storage location for product inventory."""

    DEFAULT_NAME = "Main Warehouse"

    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255, blank=True, default="")
    created_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="warehouses"
    )
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="warehouses",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("account", "name")
        ordering = ["name"]

    def __str__(self):
        return self.name

    @classmethod
    def get_default(cls, user: User) -> "Warehouse":
        """Return the default warehouse for ``user`` creating it if needed."""

        account = Account.for_user(user)
        defaults = {"location": "", "account": account, "created_by": user}
        warehouse, _ = cls.objects.get_or_create(
            account=account,
            name=cls.DEFAULT_NAME,
            defaults=defaults,
        )
        return warehouse

    def save(self, *args, **kwargs):
        ensure_account(self)
        super().save(*args, **kwargs)


class Product(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    sku = models.CharField(max_length=100, blank=True, null=True)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    sale_price = models.DecimalField(max_digits=12, decimal_places=2)
    stock_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    image = models.ImageField(upload_to='product_images/', blank=True, null=True)

    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='products')
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="products",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("sku", "account")

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        creating = self.pk is None
        ensure_account(self)
        super().save(*args, **kwargs)

        if not self.created_by_id:
            return

        # Ensure every product has at least one warehouse stock record.  This
        # keeps legacy data (which previously tracked a single ``stock_quantity``)
        # in sync with the new per-warehouse inventory model.
        if creating or not self.warehouse_stocks.exists():
            default_warehouse = Warehouse.get_default(self.created_by)
            WarehouseInventory.objects.update_or_create(
                product=self,
                warehouse=default_warehouse,
                defaults={"quantity": Decimal(self.stock_quantity or 0)},
            )


class WarehouseInventory(models.Model):
    """Quantity of a product stored in a specific warehouse."""

    warehouse = models.ForeignKey(
        Warehouse, on_delete=models.CASCADE, related_name="stocks"
    )
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="warehouse_stocks"
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        unique_together = ("warehouse", "product")
        verbose_name = "Warehouse Inventory"
        verbose_name_plural = "Warehouse Inventory"

    def __str__(self):
        return f"{self.product.name} @ {self.warehouse.name}"

    @classmethod
    def adjust_stock(cls, product: Product, warehouse: Warehouse, delta) -> None:
        """Adjust the quantity of ``product`` stored in ``warehouse``.

        ``delta`` may be positive (stock increases) or negative (stock
        decreases).  Negative balances are permitted so we simply persist the
        new quantity for both the warehouse and aggregate product stock.
        """

        if delta in (None, 0, Decimal("0")):
            return

        delta = Decimal(delta)

        with transaction.atomic():
            locked_product = Product.objects.select_for_update().get(pk=product.pk)
            inventory, _ = cls.objects.select_for_update().get_or_create(
                product=locked_product,
                warehouse=warehouse,
                defaults={"quantity": Decimal("0")},
            )

            new_quantity = Decimal(inventory.quantity) + delta
            inventory.quantity = new_quantity
            inventory.save(update_fields=["quantity"])

            new_total = Decimal(locked_product.stock_quantity or 0) + delta
            locked_product.stock_quantity = new_total
            locked_product.save(update_fields=["stock_quantity"])


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='sale_items')
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name="sale_items",
        null=True,
        blank=True,
    )

    @property
    def line_total(self):
        return self.quantity * self.unit_price

    def __str__(self):
        return f"{self.quantity} of {self.product.name} for Sale #{self.sale.id}"


class SaleReturn(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='returns')
    return_date = models.DateField()
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sale_returns')
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="sale_returns",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        commit = kwargs.pop('commit', False)
        ensure_account(self)
        with transaction.atomic():
            super().save(*args, **kwargs)
            if commit:
                total = Decimal('0')
                for item in self.items.select_related('product', 'warehouse'):
                    if not item.warehouse:
                        item.warehouse = Warehouse.get_default(self.created_by)
                        item.save(update_fields=['warehouse'])
                    WarehouseInventory.adjust_stock(
                        item.product, item.warehouse, Decimal(item.quantity)
                    )
                    total += item.line_total
                self.total_amount = total
                if self.sale.customer_id:
                    ledger.apply_customer_movement(self.sale.customer_id, -total)
                elif self.sale.supplier_id:
                    ledger.apply_supplier_movement(self.sale.supplier_id, total)
                super().save(update_fields=['total_amount'])

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            for item in self.items.select_related('product', 'warehouse'):
                if not item.warehouse:
                    item.warehouse = Warehouse.get_default(self.created_by)
                    item.save(update_fields=['warehouse'])
                WarehouseInventory.adjust_stock(
                    item.product, item.warehouse, Decimal(item.quantity) * Decimal('-1')
                )
            if self.sale.customer_id:
                ledger.reverse_customer_movement(self.sale.customer_id, -self.total_amount)
            elif self.sale.supplier_id:
                ledger.reverse_supplier_movement(self.sale.supplier_id, self.total_amount)
            super().delete(*args, **kwargs)


class SaleReturnItem(models.Model):
    sale_return = models.ForeignKey(SaleReturn, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='sale_return_items')
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.CharField(max_length=255, blank=True, null=True)
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name='sale_return_items',
        null=True,
        blank=True,
    )

    @property
    def line_total(self):
        return self.quantity * self.unit_price

    def __str__(self):
        return f"{self.quantity} of {self.product.name} returned for Sale #{self.sale_return.sale.id}"


class OfferItem(models.Model):
    offer = models.ForeignKey(Offer, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='offer_items')
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    @property
    def line_total(self):
        return self.quantity * self.unit_price

    def __str__(self):
        return f"{self.quantity} of {self.product.name} for Offer #{self.offer.id}"


class Supplier(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField(max_length=254, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to='supplier_images/', blank=True, null=True)
    currency = models.CharField(max_length=3, default='USD')
    open_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='suppliers')
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="suppliers",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        ensure_account(self)
        super().save(*args, **kwargs)


class ExpenseCategory(models.Model):
    name = models.CharField(max_length=255)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='expense_categories')
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="expense_categories",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Ensures that each account has unique category names
        unique_together = ('name', 'account')
        verbose_name_plural = "Expense Categories"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        ensure_account(self)
        super().save(*args, **kwargs)

class Expense(models.Model):
    category = models.ForeignKey(ExpenseCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    original_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    original_currency = models.CharField(max_length=3, default='USD')
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=6, null=True, blank=True)
    converted_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    account_exchange_rate = models.DecimalField(max_digits=12, decimal_places=6, null=True, blank=True)
    account_converted_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    expense_date = models.DateField()
    description = models.TextField(blank=True, null=True)
    bank_account = models.ForeignKey(
        'BankAccount',
        on_delete=models.CASCADE,
        related_name='expenses',
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='expenses')
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="expenses",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses')

    def __str__(self):
        return f"Expense of {self.amount} on {self.expense_date}"

    def save(self, *args, **kwargs):
        ensure_account(self)
        with transaction.atomic():
            original_amount_value = (
                self.original_amount
                if self.original_amount not in (None, "")
                else self.amount
            )
            original_amount = to_decimal(original_amount_value)
            self.original_amount = original_amount

            supplier_currency = None
            if self.supplier_id:
                supplier_currency = (
                    Supplier.objects.filter(pk=self.supplier_id)
                    .values_list("currency", flat=True)
                    .first()
                )

            account_currency = None
            if self.bank_account_id:
                account_currency = (
                    BankAccount.objects.filter(pk=self.bank_account_id)
                    .values_list("currency", flat=True)
                    .first()
                )

            self.original_currency = normalise_currency(
                self.original_currency,
                supplier_currency,
                account_currency,
            )

            supplier_target_currency = normalise_currency(
                supplier_currency,
                self.original_currency,
            )
            self.exchange_rate, self.converted_amount = convert_amount(
                original_amount,
                self.original_currency,
                supplier_target_currency,
                manual_rate=self.exchange_rate,
                default_rate=Decimal("1"),
            )

            if self.bank_account_id:
                account_target_currency = normalise_currency(
                    account_currency,
                    supplier_target_currency,
                    self.original_currency,
                )
                (
                    self.account_exchange_rate,
                    self.account_converted_amount,
                ) = convert_amount(
                    original_amount,
                    self.original_currency,
                    account_target_currency,
                    manual_rate=self.account_exchange_rate,
                    default_rate=Decimal("1"),
                )
            else:
                self.account_exchange_rate = Decimal("1")
                self.account_converted_amount = self.converted_amount
            self.amount = self.account_converted_amount

            if self.pk:
                old = Expense.objects.select_for_update().get(pk=self.pk)

                if old.bank_account_id != self.bank_account_id:
                    if old.bank_account_id:
                        ledger.apply_bank_account_movement(
                            old.bank_account_id, old.account_converted_amount
                        )
                    if self.bank_account_id:
                        ledger.apply_bank_account_movement(
                            self.bank_account_id, -self.account_converted_amount
                        )
                elif self.bank_account_id:
                    delta = self.account_converted_amount - old.account_converted_amount
                    ledger.apply_bank_account_movement(self.bank_account_id, -delta)

                if old.supplier_id != self.supplier_id:
                    if old.supplier_id:
                        ledger.apply_supplier_movement(
                            old.supplier_id, old.converted_amount
                        )
                    if self.supplier_id:
                        ledger.apply_supplier_movement(
                            self.supplier_id, -self.converted_amount
                        )
                elif self.supplier_id:
                    delta = self.converted_amount - old.converted_amount
                    ledger.apply_supplier_movement(self.supplier_id, -delta)

            else:
                if self.bank_account_id:
                    ledger.apply_bank_account_movement(
                        self.bank_account_id, -self.account_converted_amount
                    )
                if self.supplier_id:
                    ledger.apply_supplier_movement(
                        self.supplier_id, -self.converted_amount
                    )

            super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            if self.bank_account_id:
                ledger.apply_bank_account_movement(
                    self.bank_account_id, self.account_converted_amount
                )
            if self.supplier_id:
                ledger.apply_supplier_movement(
                    self.supplier_id, self.converted_amount
                )
            super().delete(*args, **kwargs)
    


class Purchase(models.Model):
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='purchases', null=True, blank=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='purchases', null=True, blank=True)
    purchase_date = models.DateField()
    bill_number = models.CharField(max_length=50, blank=True, null=True)
    original_currency = models.CharField(max_length=3, default='USD')
    original_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=6, default=1)
    converted_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    bank_account = models.ForeignKey(
        'BankAccount',
        on_delete=models.CASCADE,
        related_name='purchases',
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='purchases')
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="purchases",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.supplier_id:
            return f"Purchase #{self.id} from {self.supplier.name}"
        return f"Purchase #{self.id} from {self.customer.name}"

    def save(self, *args, **kwargs):
        ensure_account(self)
        with transaction.atomic():
            self.converted_amount = (
                Decimal(self.original_amount) * Decimal(self.exchange_rate)
            ).quantize(Decimal('0.01')) if self.original_amount else Decimal('0')
            self.total_amount = self.converted_amount
            current_total = Decimal(self.converted_amount)
            if self.pk:
                old = Purchase.objects.select_for_update().get(pk=self.pk)
                old_total = Decimal(old.converted_amount)
                if old.bank_account_id != self.bank_account_id:
                    if old.bank_account_id:
                        ledger.apply_bank_account_movement(old.bank_account_id, old_total)
                    if self.bank_account_id:
                        ledger.apply_bank_account_movement(
                            self.bank_account_id, -current_total
                        )
                elif self.bank_account_id:
                    delta = current_total - old_total
                    ledger.apply_bank_account_movement(self.bank_account_id, -delta)
            elif self.bank_account_id:
                ledger.apply_bank_account_movement(self.bank_account_id, -current_total)
            super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            if self.bank_account_id:
                ledger.apply_bank_account_movement(
                    self.bank_account_id, Decimal(self.converted_amount)
                )
            super().delete(*args, **kwargs)

class PurchaseItem(models.Model):
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='purchase_items')
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2) # This is the purchase price
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name='purchase_items',
        null=True,
        blank=True,
    )

    @property
    def line_total(self):
        return self.quantity * self.unit_price

    def __str__(self):
        return f"{self.quantity} of {self.product.name} for Purchase #{self.purchase.id}"


class PurchaseReturn(models.Model):
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name='returns')
    return_date = models.DateField()
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='purchase_returns')
    account = models.ForeignKey(
        Account,
        on_delete=models.CASCADE,
        related_name="purchase_returns",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        commit = kwargs.pop('commit', False)
        ensure_account(self)
        with transaction.atomic():
            super().save(*args, **kwargs)
            if commit:
                total = Decimal('0')
                for item in self.items.select_related('product', 'warehouse'):
                    if not item.warehouse:
                        item.warehouse = Warehouse.get_default(self.created_by)
                        item.save(update_fields=['warehouse'])
                    WarehouseInventory.adjust_stock(
                        item.product, item.warehouse, Decimal(item.quantity) * Decimal('-1')
                    )
                    total += item.line_total
                self.total_amount = total
                if not self.purchase.bank_account_id:
                    if self.purchase.supplier_id:
                        ledger.apply_supplier_movement(
                            self.purchase.supplier_id, -total
                        )
                    elif self.purchase.customer_id:
                        ledger.apply_customer_movement(
                            self.purchase.customer_id, total
                        )
                super().save(update_fields=['total_amount'])

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            for item in self.items.select_related('product', 'warehouse'):
                if not item.warehouse:
                    item.warehouse = Warehouse.get_default(self.created_by)
                    item.save(update_fields=['warehouse'])
                WarehouseInventory.adjust_stock(
                    item.product, item.warehouse, Decimal(item.quantity)
                )
            if not self.purchase.bank_account_id:
                if self.purchase.supplier_id:
                    ledger.reverse_supplier_movement(
                        self.purchase.supplier_id, -self.total_amount
                    )
                elif self.purchase.customer_id:
                    ledger.reverse_customer_movement(
                        self.purchase.customer_id, self.total_amount
                    )
            super().delete(*args, **kwargs)


class PurchaseReturnItem(models.Model):
    purchase_return = models.ForeignKey(PurchaseReturn, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='purchase_return_items')
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        related_name='purchase_return_items',
        null=True,
        blank=True,
    )

    @property
    def line_total(self):
        return self.quantity * self.unit_price

    def __str__(self):
        return f"{self.quantity} of {self.product.name} returned for Purchase #{self.purchase_return.purchase.id}"


class CompanyInfo(models.Model):
    """A singleton model to store company information."""
    name = models.CharField(max_length=255, default="Your Company Name")
    address = models.TextField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(max_length=254, blank=True, null=True)
    website = models.URLField(blank=True, null=True)
    logo = models.ImageField(upload_to='company_logos/', blank=True, null=True)

    class Meta:
        verbose_name_plural = "Company Info"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.pk = 1
        super(CompanyInfo, self).save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj


class CompanySettings(models.Model):
    """Singleton model to store company-wide settings."""
    base_currency = models.CharField(
        max_length=3,
        default="USD",
    )

    class Meta:
        verbose_name_plural = "Company Settings"

    def __str__(self):
        return self.base_currency

    def save(self, *args, **kwargs):
        self.pk = 1
        if self.base_currency:
            self.base_currency = self.base_currency.upper()
        super(CompanySettings, self).save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj
