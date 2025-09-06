# backend/api/models.py
from django.db import models, transaction
from django.db.models import F, Sum, DecimalField
from django.db.models.functions import Coalesce
from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from decimal import Decimal

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
    CURRENCY_CHOICES = [
        ('USD', 'United States Dollar'),
        ('EUR', 'Euro'),
        ('KZT', 'Kazakhstani Tenge'),
        ('TRY', 'Turkish Lira'),
    ]
    name = models.CharField(max_length=255)
    email = models.EmailField(max_length=254, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    image = models.ImageField(upload_to='customer_images/', blank=True, null=True)
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='USD')
    open_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='customers')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    @property
    def balance(self):
        """Current balance derived from sales, purchases, and payments."""
        sales_total = self.sales.aggregate(
            total=Coalesce(Sum('converted_amount'), 0, output_field=DecimalField())
        )['total']
        payments_total = self.payments.aggregate(
            total=Coalesce(Sum('converted_amount'), 0, output_field=DecimalField())
        )['total']
        purchases_total = self.purchases.aggregate(
            total=Coalesce(Sum('converted_amount'), 0, output_field=DecimalField())
        )['total']
        return sales_total - payments_total - purchases_total


class Sale(models.Model):
    # Either a customer or supplier can be the counterparty of a sale
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='sales', null=True, blank=True)
    supplier = models.ForeignKey('Supplier', on_delete=models.CASCADE, related_name='sales', null=True, blank=True)
    sale_date = models.DateField(auto_now_add=True)
    invoice_number = models.CharField(max_length=50, unique=True, blank=True, null=True)
    original_currency = models.CharField(max_length=3, choices=Customer.CURRENCY_CHOICES, default='USD')
    original_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=6, default=1)
    converted_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    details = models.TextField(blank=True, null=True)  # e.g., "5 x RAISINS @ 9500"
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sales')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.customer_id:
            return f"Sale #{self.id} for {self.customer.name}"
        return f"Sale #{self.id} to {self.supplier.name}"

    def save(self, *args, **kwargs):
        # Compute converted amount from original amount
        self.converted_amount = (
            Decimal(self.original_amount) * Decimal(self.exchange_rate)
        ).quantize(Decimal('0.01')) if self.original_amount else Decimal('0')
        self.total_amount = self.converted_amount
        super().save(*args, **kwargs)


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
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Offer #{self.id} for {self.customer.name}"


class BankAccount(models.Model):
    name = models.CharField(max_length=255)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, choices=Customer.CURRENCY_CHOICES, default='USD')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bank_accounts')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


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
    original_currency = models.CharField(max_length=3, choices=Customer.CURRENCY_CHOICES)
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=6, default=1)
    converted_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='Cash')
    notes = models.TextField(blank=True, null=True)
    account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name='payments', null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payments')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.sale_id:
            return f"Payment of {self.original_amount} for Sale #{self.sale.id}"
        return f"Payment of {self.original_amount} from {self.customer.name}"

    def save(self, *args, **kwargs):
        # determine converted amount
        if self.original_currency == self.customer.currency:
            self.exchange_rate = Decimal('1')
            self.converted_amount = self.original_amount
        else:
            self.converted_amount = (Decimal(self.original_amount) * Decimal(self.exchange_rate)).quantize(Decimal('0.01'))

        with transaction.atomic():
            if self.pk:
                old = Payment.objects.select_for_update().get(pk=self.pk)

                # Update customer balance using converted amounts
                if old.customer_id != self.customer_id:
                    Customer.objects.filter(pk=old.customer_id).update(open_balance=F('open_balance') + old.converted_amount)
                    Customer.objects.filter(pk=self.customer_id).update(open_balance=F('open_balance') - self.converted_amount)
                else:
                    delta = self.converted_amount - old.converted_amount
                    Customer.objects.filter(pk=self.customer_id).update(open_balance=F('open_balance') - delta)

                # Update bank account balance using payment amounts
                if old.account_id != self.account_id:
                    if old.account_id:
                        BankAccount.objects.filter(pk=old.account_id).update(balance=F('balance') - old.original_amount)
                    if self.account_id:
                        BankAccount.objects.filter(pk=self.account_id).update(balance=F('balance') + self.original_amount)
                elif self.account_id:
                    delta = self.original_amount - old.original_amount
                    BankAccount.objects.filter(pk=self.account_id).update(balance=F('balance') + delta)
            else:
                Customer.objects.filter(pk=self.customer_id).update(open_balance=F('open_balance') - self.converted_amount)
                if self.account_id:
                    BankAccount.objects.filter(pk=self.account_id).update(balance=F('balance') + self.original_amount)
            super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            Customer.objects.filter(pk=self.customer_id).update(open_balance=F('open_balance') + self.converted_amount)
            if self.account_id:
                BankAccount.objects.filter(pk=self.account_id).update(balance=F('balance') - self.original_amount)
            super().delete(*args, **kwargs)


class Product(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    sku = models.CharField(max_length=100, blank=True, null=True)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    sale_price = models.DecimalField(max_digits=12, decimal_places=2)
    stock_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    image = models.ImageField(upload_to='product_images/', blank=True, null=True)

    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='products')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('sku', 'created_by')

    def __str__(self):
        return self.name


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='sale_items')
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

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
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        commit = kwargs.pop('commit', False)
        with transaction.atomic():
            super().save(*args, **kwargs)
            if commit:
                total = Decimal('0')
                for item in self.items.all():
                    Product.objects.filter(pk=item.product_id).update(stock_quantity=F('stock_quantity') + item.quantity)
                    total += item.line_total
                self.total_amount = total
                if self.sale.customer_id:
                    Customer.objects.filter(pk=self.sale.customer_id).update(open_balance=F('open_balance') - total)
                elif self.sale.supplier_id:
                    Supplier.objects.filter(pk=self.sale.supplier_id).update(open_balance=F('open_balance') + total)
                super().save(update_fields=['total_amount'])

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            for item in self.items.all():
                Product.objects.filter(pk=item.product_id).update(stock_quantity=F('stock_quantity') - item.quantity)
            if self.sale.customer_id:
                Customer.objects.filter(pk=self.sale.customer_id).update(open_balance=F('open_balance') + self.total_amount)
            elif self.sale.supplier_id:
                Supplier.objects.filter(pk=self.sale.supplier_id).update(open_balance=F('open_balance') - self.total_amount)
            super().delete(*args, **kwargs)


class SaleReturnItem(models.Model):
    sale_return = models.ForeignKey(SaleReturn, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='sale_return_items')
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.CharField(max_length=255, blank=True, null=True)

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
    open_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='suppliers')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class ExpenseCategory(models.Model):
    name = models.CharField(max_length=255)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='expense_categories')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Ensures that each user has unique category names
        unique_together = ('name', 'created_by')
        verbose_name_plural = "Expense Categories"

    def __str__(self):
        return self.name

class Expense(models.Model):
    category = models.ForeignKey(ExpenseCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='expenses')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    expense_date = models.DateField()
    description = models.TextField(blank=True, null=True)
    account = models.ForeignKey('BankAccount', on_delete=models.CASCADE, related_name='expenses', null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='expenses')
    created_at = models.DateTimeField(auto_now_add=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')

    def __str__(self):
        return f"Expense of {self.amount} on {self.expense_date}"

    def save(self, *args, **kwargs):
        with transaction.atomic():
            if self.pk:
                old = Expense.objects.get(pk=self.pk)
                # If account has changed
                if old.account_id != self.account_id:
                    if old.account_id:
                        BankAccount.objects.filter(pk=old.account_id).update(balance=F('balance') + old.amount)
                    if self.account_id:
                        BankAccount.objects.filter(pk=self.account_id).update(balance=F('balance') - self.amount)
                # If account is the same, just update with the delta
                elif self.account_id:
                    delta = self.amount - old.amount
                    BankAccount.objects.filter(pk=self.account_id).update(balance=F('balance') - delta)

                # Handle supplier balance update on change
                if old.supplier_id != self.supplier_id:
                    if old.supplier_id:
                        Supplier.objects.filter(pk=old.supplier_id).update(open_balance=F('open_balance') + old.amount)
                    if self.supplier_id:
                        Supplier.objects.filter(pk=self.supplier_id).update(open_balance=F('open_balance') - self.amount)
                # if supplier is same, update with delta
                elif self.supplier_id:
                    delta = self.amount - old.amount
                    Supplier.objects.filter(pk=self.supplier_id).update(open_balance=F('open_balance') - delta)

            # New expense
            else:
                if self.account_id:
                    BankAccount.objects.filter(pk=self.account_id).update(balance=F('balance') - self.amount)
                if self.supplier_id:
                    Supplier.objects.filter(pk=self.supplier_id).update(open_balance=F('open_balance') - self.amount)

            super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            if self.account_id:
                BankAccount.objects.filter(pk=self.account_id).update(balance=F('balance') + self.amount)
            if self.supplier_id:
                Supplier.objects.filter(pk=self.supplier_id).update(open_balance=F('open_balance') + self.amount)
            super().delete(*args, **kwargs)
    


class Purchase(models.Model):
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='purchases', null=True, blank=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='purchases', null=True, blank=True)
    purchase_date = models.DateField()
    bill_number = models.CharField(max_length=50, blank=True, null=True)
    original_currency = models.CharField(max_length=3, choices=Customer.CURRENCY_CHOICES, default='USD')
    original_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    exchange_rate = models.DecimalField(max_digits=12, decimal_places=6, default=1)
    converted_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    account = models.ForeignKey('BankAccount', on_delete=models.CASCADE, related_name='purchases', null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='purchases')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.supplier_id:
            return f"Purchase #{self.id} from {self.supplier.name}"
        return f"Purchase #{self.id} from {self.customer.name}"

    def save(self, *args, **kwargs):
        with transaction.atomic():
            self.converted_amount = (
                Decimal(self.original_amount) * Decimal(self.exchange_rate)
            ).quantize(Decimal('0.01')) if self.original_amount else Decimal('0')
            self.total_amount = self.converted_amount
            current_total = Decimal(self.converted_amount)
            if self.pk:
                old = Purchase.objects.get(pk=self.pk)
                old_total = Decimal(old.converted_amount)
                if old.account_id != self.account_id:
                    if old.account_id:
                        BankAccount.objects.filter(pk=old.account_id).update(balance=F('balance') + old_total)
                    if self.account_id:
                        BankAccount.objects.filter(pk=self.account_id).update(balance=F('balance') - current_total)
                elif self.account_id:
                    delta = current_total - old_total
                    BankAccount.objects.filter(pk=self.account_id).update(balance=F('balance') - delta)
            elif self.account_id:
                BankAccount.objects.filter(pk=self.account_id).update(balance=F('balance') - current_total)
            super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            if self.account_id:
                BankAccount.objects.filter(pk=self.account_id).update(balance=F('balance') + Decimal(self.converted_amount))
            super().delete(*args, **kwargs)

class PurchaseItem(models.Model):
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='purchase_items')
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2) # This is the purchase price

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
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        commit = kwargs.pop('commit', False)
        with transaction.atomic():
            super().save(*args, **kwargs)
            if commit:
                total = Decimal('0')
                for item in self.items.all():
                    Product.objects.filter(pk=item.product_id).update(stock_quantity=F('stock_quantity') - item.quantity)
                    total += item.line_total
                self.total_amount = total
                if not self.purchase.account_id:
                    if self.purchase.supplier_id:
                        Supplier.objects.filter(pk=self.purchase.supplier_id).update(open_balance=F('open_balance') - total)
                    elif self.purchase.customer_id:
                        Customer.objects.filter(pk=self.purchase.customer_id).update(open_balance=F('open_balance') + total)
                super().save(update_fields=['total_amount'])

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            for item in self.items.all():
                Product.objects.filter(pk=item.product_id).update(stock_quantity=F('stock_quantity') + item.quantity)
            if not self.purchase.account_id:
                if self.purchase.supplier_id:
                    Supplier.objects.filter(pk=self.purchase.supplier_id).update(open_balance=F('open_balance') + self.total_amount)
                elif self.purchase.customer_id:
                    Customer.objects.filter(pk=self.purchase.customer_id).update(open_balance=F('open_balance') - self.total_amount)
            super().delete(*args, **kwargs)


class PurchaseReturnItem(models.Model):
    purchase_return = models.ForeignKey(PurchaseReturn, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='purchase_return_items')
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)

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
