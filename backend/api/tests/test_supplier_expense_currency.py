from decimal import Decimal
from datetime import date
from unittest.mock import patch, call

from django.test import TestCase
from rest_framework.test import APIClient

from ..models import BankAccount, Expense, Supplier
from . import create_user_with_account


class SupplierExpenseCurrencyTest(TestCase):
    def setUp(self):
        self.user, self.account = create_user_with_account("supplier_currency")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def create_supplier(self, name, currency, open_balance):
        return Supplier.objects.create(
            name=name,
            currency=currency,
            open_balance=Decimal(open_balance),
            created_by=self.user,
        )

    def create_account(self, name, currency, balance):
        return BankAccount.objects.create(
            name=name,
            currency=currency,
            balance=Decimal(balance),
            created_by=self.user,
        )

    def test_supplier_payment_updates_account_with_custom_rate(self):
        supplier = self.create_supplier("KZT Supplier", "KZT", "100.00")
        account = self.create_account("USD Account", "USD", "2500.00")

        response = self.client.post(
            f"/api/suppliers/{supplier.id}/payments/",
            {
                "expense_date": str(date.today()),
                "description": "Wire transfer",
                "original_amount": "100.00",
                "original_currency": "KZT",
                "account_exchange_rate": "0.0022",
                "account": account.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.content)

        expense = Expense.objects.get(id=response.data["id"])
        supplier.refresh_from_db()
        account.refresh_from_db()

        self.assertEqual(expense.original_amount, Decimal("100.00"))
        self.assertEqual(expense.original_currency, "KZT")
        self.assertEqual(expense.account_exchange_rate, Decimal("0.0022"))
        self.assertEqual(expense.account_converted_amount, Decimal("0.22"))
        self.assertEqual(expense.converted_amount, Decimal("100.00"))

        self.assertEqual(supplier.open_balance, Decimal("0.00"))
        self.assertEqual(account.balance, Decimal("2499.78"))

    @patch("api.models.get_exchange_rate")
    def test_supplier_payment_fetches_rates_when_missing(self, mock_rate):
        supplier = self.create_supplier("USD Supplier", "USD", "120.00")
        account = self.create_account("TRY Account", "TRY", "5000.00")

        def rate_side_effect(from_currency, to_currency):
            if (from_currency, to_currency) == ("EUR", "USD"):
                return Decimal("1.20")
            if (from_currency, to_currency) == ("EUR", "TRY"):
                return Decimal("30")
            raise AssertionError(f"Unexpected rate lookup {from_currency}->{to_currency}")

        mock_rate.side_effect = rate_side_effect

        response = self.client.post(
            f"/api/suppliers/{supplier.id}/payments/",
            {
                "expense_date": str(date.today()),
                "description": "Cross currency",
                "original_amount": "100.00",
                "original_currency": "EUR",
                "exchange_rate": "0",
                "account_exchange_rate": "0",
                "account": account.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.content)

        expense = Expense.objects.get(id=response.data["id"])
        supplier.refresh_from_db()
        account.refresh_from_db()

        self.assertEqual(expense.exchange_rate, Decimal("1.20"))
        self.assertEqual(expense.converted_amount, Decimal("120.00"))
        self.assertEqual(expense.account_exchange_rate, Decimal("30"))
        self.assertEqual(expense.account_converted_amount, Decimal("3000.00"))

        self.assertEqual(supplier.open_balance, Decimal("0.00"))
        self.assertEqual(account.balance, Decimal("2000.00"))

        self.assertEqual(
            mock_rate.call_args_list,
            [call("EUR", "USD"), call("EUR", "TRY")],
        )
