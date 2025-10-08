from decimal import Decimal
from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase

from ..models import (
    BankAccount,
    Customer,
    Payment,
    Product,
    Sale,
    SaleReturn,
    SaleReturnItem,
    Warehouse,
)


class LedgerMovementIntegrationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="ledger", password="pw")
        self.customer = Customer.objects.create(
            name="Alice",
            currency="USD",
            open_balance=Decimal("0"),
            created_by=self.user,
        )
        self.bank_account = BankAccount.objects.create(
            name="Operating",
            balance=Decimal("10.00"),
            currency="USD",
            category=BankAccount.BANK,
            created_by=self.user,
        )
        self.product = Product.objects.create(
            name="Widget",
            sale_price=Decimal("50.00"),
            created_by=self.user,
        )
        self.warehouse = Warehouse.get_default(self.user)

    def test_sale_updates_open_balance_and_recomputes_on_edit(self):
        sale = Sale.objects.create(
            customer=self.customer,
            sale_date=date.today(),
            original_currency="USD",
            original_amount=Decimal("100.00"),
            exchange_rate=Decimal("1"),
            created_by=self.user,
        )

        self.customer.refresh_from_db()
        self.assertEqual(self.customer.open_balance, Decimal("100.00"))

        sale.original_amount = Decimal("150.00")
        sale.save()

        self.customer.refresh_from_db()
        self.assertEqual(self.customer.open_balance, Decimal("150.00"))

    def test_sale_return_reduces_balance_and_delete_restores(self):
        sale = Sale.objects.create(
            customer=self.customer,
            sale_date=date.today(),
            original_currency="USD",
            original_amount=Decimal("100.00"),
            exchange_rate=Decimal("1"),
            created_by=self.user,
        )
        sale.refresh_from_db()

        sale_return = SaleReturn.objects.create(
            sale=sale,
            return_date=date.today(),
            created_by=self.user,
        )
        SaleReturnItem.objects.create(
            sale_return=sale_return,
            product=self.product,
            quantity=Decimal("2"),
            unit_price=Decimal("20.00"),
            warehouse=self.warehouse,
        )
        sale_return.save(commit=True)

        self.customer.refresh_from_db()
        self.assertEqual(self.customer.open_balance, Decimal("60.00"))

        sale_return.delete()

        self.customer.refresh_from_db()
        self.assertEqual(self.customer.open_balance, Decimal("100.00"))

    def test_payment_edits_keep_customer_and_bank_balances_in_sync(self):
        self.customer.open_balance = Decimal("200.00")
        self.customer.save(update_fields=["open_balance"])

        payment = Payment.objects.create(
            customer=self.customer,
            payment_date=date.today(),
            original_amount=Decimal("50.00"),
            original_currency="USD",
            method="Cash",
            account=self.bank_account,
            created_by=self.user,
        )

        self.customer.refresh_from_db()
        self.bank_account.refresh_from_db()
        self.assertEqual(self.customer.open_balance, Decimal("150.00"))
        self.assertEqual(self.bank_account.balance, Decimal("60.00"))

        payment.original_amount = Decimal("80.00")
        payment.save()

        self.customer.refresh_from_db()
        self.bank_account.refresh_from_db()
        self.assertEqual(self.customer.open_balance, Decimal("120.00"))
        self.assertEqual(self.bank_account.balance, Decimal("90.00"))

        second_account = BankAccount.objects.create(
            name="Savings",
            balance=Decimal("5.00"),
            currency="USD",
            category=BankAccount.BANK,
            created_by=self.user,
        )

        payment.account = second_account
        payment.save()

        self.customer.refresh_from_db()
        self.bank_account.refresh_from_db()
        second_account.refresh_from_db()
        self.assertEqual(self.customer.open_balance, Decimal("120.00"))
        self.assertEqual(self.bank_account.balance, Decimal("10.00"))
        self.assertEqual(second_account.balance, Decimal("85.00"))

        payment.delete()

        self.customer.refresh_from_db()
        second_account.refresh_from_db()
        self.assertEqual(self.customer.open_balance, Decimal("200.00"))
        self.assertEqual(second_account.balance, Decimal("5.00"))
