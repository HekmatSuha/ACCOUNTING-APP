# backend/api/models.py
from django.db import models, transaction
from django.db.models import F
from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from decimal import Decimal

class Activity(models.Model):
    ACTION_TYPES = (
        ('created', 'Created'),
        ('updated', 'Updated'),
        ('deleted', 'Deleted'),
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


class Sale(models.Model):
    # FIX: rename 'sale' -> 'customer'
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='sales')
    sale_date = models.DateField(auto_now_add=True)
    invoice_number = models.CharField(max_length=50, unique=True, blank=True, null=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    details = models.TextField(blank=True, null=True)  # e.g., "5 x RAISINS @ 9500"
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sales')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Sale #{self.id} for {self.customer.name}"


class BankAccount(models.Model):
    name = models.CharField(max_length=255)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
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
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='Cash')
    notes = models.TextField(blank=True, null=True)
    account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name='payments', null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payments')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.sale_id:
            return f"Payment of {self.amount} for Sale #{self.sale.id}"
        return f"Payment of {self.amount} from {self.customer.name}"

    def save(self, *args, **kwargs):
        with transaction.atomic():
            if self.pk:
                old = Payment.objects.select_for_update().get(pk=self.pk)

                # Update customer balance
                if old.customer_id != self.customer_id:
                    Customer.objects.filter(pk=old.customer_id).update(open_balance=F('open_balance') + old.amount)
                    Customer.objects.filter(pk=self.customer_id).update(open_balance=F('open_balance') - self.amount)
                else:
                    delta = self.amount - old.amount
                    Customer.objects.filter(pk=self.customer_id).update(open_balance=F('open_balance') - delta)

                # Update bank account balance
                if old.account_id != self.account_id:
                    if old.account_id:
                        BankAccount.objects.filter(pk=old.account_id).update(balance=F('balance') - old.amount)
                    if self.account_id:
                        BankAccount.objects.filter(pk=self.account_id).update(balance=F('balance') + self.amount)
                elif self.account_id:
                    delta = self.amount - old.amount
                    BankAccount.objects.filter(pk=self.account_id).update(balance=F('balance') + delta)
            else:
                Customer.objects.filter(pk=self.customer_id).update(open_balance=F('open_balance') - self.amount)
                if self.account_id:
                    BankAccount.objects.filter(pk=self.account_id).update(balance=F('balance') + self.amount)
            super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            Customer.objects.filter(pk=self.customer_id).update(open_balance=F('open_balance') + self.amount)
            if self.account_id:
                BankAccount.objects.filter(pk=self.account_id).update(balance=F('balance') - self.amount)
            super().delete(*args, **kwargs)


class Product(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    sku = models.CharField(max_length=100, blank=True, null=True)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    sale_price = models.DecimalField(max_digits=12, decimal_places=2)
    stock_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)

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
            # New expense
            elif self.account_id:
                BankAccount.objects.filter(pk=self.account_id).update(balance=F('balance') - self.amount)
            super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            if self.account_id:
                BankAccount.objects.filter(pk=self.account_id).update(balance=F('balance') + self.amount)
            super().delete(*args, **kwargs)
    


class Purchase(models.Model):
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='purchases')
    purchase_date = models.DateField()
    bill_number = models.CharField(max_length=50, blank=True, null=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    account = models.ForeignKey('BankAccount', on_delete=models.CASCADE, related_name='purchases', null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='purchases')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Purchase #{self.id} from {self.supplier.name}"

    def save(self, *args, **kwargs):
        with transaction.atomic():
            current_total = Decimal(self.total_amount)
            if self.pk:
                old = Purchase.objects.get(pk=self.pk)
                old_total = Decimal(old.total_amount)
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
                BankAccount.objects.filter(pk=self.account_id).update(balance=F('balance') + Decimal(self.total_amount))
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
