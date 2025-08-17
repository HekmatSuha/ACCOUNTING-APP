# backend/api/admin.py

from django.contrib import admin
from .models import Customer, Sale, Payment, Product, SaleItem # Import the Customer model

# Register your models here.
admin.site.register(Customer)
admin.site.register(Sale)
admin.site.register(Payment)
admin.site.register(Product)
admin.site.register(SaleItem)