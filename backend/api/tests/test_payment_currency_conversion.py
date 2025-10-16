from decimal import Decimal
from datetime import date
from unittest.mock import patch

from django.test import TestCase

from ..models import Customer, Supplier, BankAccount, Payment, Expense
from ..services.currency import convert_amount
from . import create_user_with_account


class CurrencyConversionServiceTest(TestCase):
    def setUp(self):
        self.user, self.account = create_user_with_account("payer")
        self.customer = Customer.objects.create(
            name="Alice",
            currency="USD",
            open_balance=Decimal("125.00"),
            created_by=self.user,
            account=self.account,
        )
        self.supplier = Supplier.objects.create(
            name="Bob",
            currency="GBP",
            open_balance=Decimal("0"),
            created_by=self.user,
            account=self.account,
        )
        self.bank_account = BankAccount.objects.create(
            name="Euro Account",
            currency="EUR",
            created_by=self.user,
            account=self.account,
        )

    @patch("api.services.currency.get_exchange_rate", return_value=Decimal("1.25"))
    def test_foreign_currency_payment_converts_and_updates_balances(self, mock_rate):
        payment = Payment.objects.create(
            customer=self.customer,
            payment_date=date.today(),
            original_amount=Decimal("100.00"),
            original_currency="EUR",
            exchange_rate=Decimal("1.25"),
            bank_account=self.bank_account,
            account=self.account,
            method="Cash",
            created_by=self.user,
        )

        payment.refresh_from_db()
        self.customer.refresh_from_db()
        self.bank_account.refresh_from_db()

        self.assertEqual(payment.converted_amount, Decimal("125.00"))
        self.assertEqual(payment.account_converted_amount, Decimal("100.00"))
        self.assertEqual(payment.account_exchange_rate, Decimal("1"))
        self.assertEqual(self.bank_account.balance, Decimal("100.00"))
        self.assertEqual(self.customer.open_balance, Decimal("0.00"))
        mock_rate.assert_not_called()

    @patch("api.services.currency.get_exchange_rate")
    def test_account_currency_mismatch_converts_balance(self, mock_rate):
        def side_effect(from_curr, to_curr):
            rates = {
                ("EUR", "USD"): Decimal("1.25"),
                ("EUR", "TRY"): Decimal("35"),
            }
            return rates[(from_curr, to_curr)]

        mock_rate.side_effect = side_effect

        lira_account = BankAccount.objects.create(
            name="Lira Account",
            currency="TRY",
            created_by=self.user,
            account=self.account,
        )

        payment = Payment.objects.create(
            customer=self.customer,
            payment_date=date.today(),
            original_amount=Decimal("100.00"),
            original_currency="EUR",
            exchange_rate=Decimal("0"),
            account_exchange_rate=Decimal("0"),
            method="Cash",
            bank_account=lira_account,
            account=self.account,
            created_by=self.user,
        )

        payment.refresh_from_db()
        self.customer.refresh_from_db()
        lira_account.refresh_from_db()

        self.assertEqual(payment.converted_amount, Decimal("125.00"))
        self.assertEqual(payment.account_converted_amount, Decimal("3500.00"))
        self.assertEqual(payment.account_exchange_rate, Decimal("35"))
        self.assertEqual(lira_account.balance, Decimal("3500.00"))
        self.assertEqual(self.customer.open_balance, Decimal("0.00"))
        self.assertEqual(mock_rate.call_count, 2)

    @patch("api.services.currency.get_exchange_rate")
    def test_expense_conversion_for_supplier_and_account(self, mock_rate):
        def side_effect(from_curr, to_curr):
            rates = {
                ("USD", "GBP"): Decimal("0.80"),
                ("USD", "EUR"): Decimal("0.90"),
            }
            return rates[(from_curr, to_curr)]

        mock_rate.side_effect = side_effect

        expense_account = BankAccount.objects.create(
            name="Expense Account",
            currency="EUR",
            created_by=self.user,
            account=self.account,
        )

        expense = Expense.objects.create(
            amount=Decimal("0"),
            original_amount=Decimal("200.00"),
            original_currency="USD",
            expense_date=date.today(),
            description="Travel",
            bank_account=expense_account,
            account=self.account,
            supplier=self.supplier,
            created_by=self.user,
        )

        expense.refresh_from_db()
        self.supplier.refresh_from_db()
        expense_account.refresh_from_db()

        self.assertEqual(expense.exchange_rate, Decimal("0.80"))
        self.assertEqual(expense.converted_amount, Decimal("160.00"))
        self.assertEqual(expense.account_exchange_rate, Decimal("0.90"))
        self.assertEqual(expense.account_converted_amount, Decimal("180.00"))
        self.assertEqual(expense.amount, Decimal("180.00"))
        self.assertEqual(expense_account.balance, Decimal("-180.00"))
        self.assertEqual(self.supplier.open_balance, Decimal("-160.00"))
        self.assertEqual(mock_rate.call_count, 2)

    @patch("api.services.currency.get_exchange_rate", side_effect=RuntimeError("down"))
    def test_convert_amount_falls_back_to_default_rate(self, mock_rate):
        rate, converted = convert_amount(
            Decimal("50"),
            "USD",
            "EUR",
            default_rate=Decimal("1.20"),
        )

        self.assertEqual(rate, Decimal("1.20"))
        self.assertEqual(converted, Decimal("60.00"))
        mock_rate.assert_called_once_with("USD", "EUR")
