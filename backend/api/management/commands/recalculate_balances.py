from django.core.management.base import BaseCommand
from django.db.models import Sum, DecimalField
from django.db.models.functions import Coalesce

from api.models import Customer


class Command(BaseCommand):
    help = 'Recalculate customer open balances based on sales and payments.'

    def handle(self, *args, **options):
        for customer in Customer.objects.all():
            sales_total = customer.sales.aggregate(
                total=Coalesce(Sum('total_amount'), 0, output_field=DecimalField())
            )['total']
            payments_total = customer.payments.aggregate(
                total=Coalesce(Sum('converted_amount'), 0, output_field=DecimalField())
            )['total']
            balance = sales_total - payments_total
            customer.open_balance = balance
            customer.save(update_fields=['open_balance'])
            self.stdout.write(
                self.style.SUCCESS(f'Customer {customer.id} balance updated to {balance}')
            )
