from decimal import Decimal
from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from ..models import Customer, BankAccount
from . import create_user_with_account


class CustomerPaymentAPITest(TestCase):
    def setUp(self):
        self.user, self.account = create_user_with_account("custpay")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.customer = Customer.objects.create(
            name="Bob",
            currency="USD",
            open_balance=Decimal("50.00"),
            created_by=self.user,
            account=self.account,
        )
        self.bank_account = BankAccount.objects.create(
            name="Receivables",
            currency="USD",
            created_by=self.user,
            account=self.account,
        )

    def test_create_payment_without_currency_defaults_to_customer_currency(self):
        response = self.client.post(
            f"/api/customers/{self.customer.id}/payments/",
            {
                "payment_date": str(date.today()),
                "original_amount": "10.00",
                "account": self.bank_account.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.data["original_currency"], "USD")
