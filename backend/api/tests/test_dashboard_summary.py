"""Tests for the dashboard summary endpoint."""

from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import (
    BankAccount,
    Customer,
    Expense,
    Payment,
    Product,
    Purchase,
    Sale,
    Supplier,
)
from . import create_user_with_account


class DashboardSummaryTest(TestCase):
    """Validate currency-aware aggregates in the dashboard summary response."""

    def setUp(self):
        self.user, self.account = create_user_with_account('dash')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.customer_usd = Customer.objects.create(
            name='Acme',
            currency='USD',
            created_by=self.user,
        )
        self.customer_eur = Customer.objects.create(
            name='Euro Corp',
            currency='EUR',
            created_by=self.user,
        )
        self.supplier = Supplier.objects.create(
            name='SupplyCo',
            currency='USD',
            created_by=self.user,
        )
        self.bank_account = BankAccount.objects.create(
            name='Operating',
            currency='USD',
            created_by=self.user,
        )

        Product.objects.create(
            name='Widget',
            sale_price=Decimal('10.00'),
            purchase_price=Decimal('5.00'),
            stock_quantity=Decimal('10'),
            created_by=self.user,
        )

    def test_dashboard_summary_includes_currency_breakdowns(self):
        today = timezone.now().date()

        Sale.objects.create(
            customer=self.customer_usd,
            original_currency='USD',
            original_amount=Decimal('100.00'),
            exchange_rate=Decimal('1'),
            created_by=self.user,
        )
        Sale.objects.create(
            customer=self.customer_eur,
            original_currency='EUR',
            original_amount=Decimal('200.00'),
            exchange_rate=Decimal('1'),
            created_by=self.user,
        )

        Payment.objects.create(
            customer=self.customer_usd,
            payment_date=today,
            original_amount=Decimal('40.00'),
            original_currency='USD',
            exchange_rate=Decimal('1'),
            created_by=self.user,
        )

        Purchase.objects.create(
            supplier=self.supplier,
            purchase_date=today,
            original_currency='USD',
            original_amount=Decimal('150.00'),
            exchange_rate=Decimal('1'),
            created_by=self.user,
        )

        Expense.objects.create(
            amount=Decimal('30.00'),
            expense_date=today,
            bank_account=self.bank_account,
            account=self.account,
            created_by=self.user,
        )
        Expense.objects.create(
            amount=Decimal('50.00'),
            expense_date=today,
            supplier=self.supplier,
            created_by=self.user,
        )

        response = self.client.get('/api/dashboard-summary/')
        self.assertEqual(response.status_code, 200, response.content)

        data = response.data

        self.assertEqual(Decimal(str(data['turnover'])), Decimal('300'))
        self.assertEqual(Decimal(str(data['total_receivables'])), Decimal('260'))
        self.assertEqual(Decimal(str(data['total_payables'])), Decimal('100'))
        self.assertEqual(Decimal(str(data['expenses'])), Decimal('80'))
        self.assertEqual(Decimal(str(data['stock_value'])), Decimal('50'))

        self.assertEqual(
            Decimal(str(data['turnover_breakdown']['USD'])),
            Decimal('100'),
        )
        self.assertEqual(
            Decimal(str(data['turnover_breakdown']['EUR'])),
            Decimal('200'),
        )

        self.assertEqual(
            Decimal(str(data['total_receivables_breakdown']['USD'])),
            Decimal('60'),
        )
        self.assertEqual(
            Decimal(str(data['total_receivables_breakdown']['EUR'])),
            Decimal('200'),
        )

        self.assertEqual(
            Decimal(str(data['total_payables_breakdown']['USD'])),
            Decimal('100'),
        )

        self.assertEqual(
            Decimal(str(data['expenses_breakdown']['USD'])),
            Decimal('80'),
        )

        stock_breakdown = data['stock_value_breakdown']
        self.assertIn('USD', stock_breakdown)
        self.assertEqual(Decimal(str(stock_breakdown['USD'])), Decimal('50'))

        today_sales_breakdown = data['today_sales_breakdown']
        self.assertEqual(
            Decimal(str(today_sales_breakdown['USD'])),
            Decimal('100'),
        )
        self.assertEqual(
            Decimal(str(today_sales_breakdown['EUR'])),
            Decimal('200'),
        )

        incoming_breakdown = data['today_incoming_breakdown']
        self.assertEqual(
            Decimal(str(incoming_breakdown['USD'])),
            Decimal('40'),
        )
