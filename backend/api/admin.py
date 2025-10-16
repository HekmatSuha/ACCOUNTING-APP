# backend/api/admin.py

from django.contrib import admin
from .models import (
    Account,
    AccountMembership,
    Customer,
    Payment,
    Product,
    Sale,
    SaleItem,
    Subscription,
    SubscriptionPlan,
)

# Register your models here.
admin.site.register(Customer)
admin.site.register(Sale)
admin.site.register(Payment)
admin.site.register(Product)
admin.site.register(SaleItem)
admin.site.register(Account)
admin.site.register(AccountMembership)
admin.site.register(SubscriptionPlan)
admin.site.register(Subscription)