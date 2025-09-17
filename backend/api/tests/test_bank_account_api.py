"""Tests for bank account manual transactions API."""

from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from ..models import BankAccount, BankAccountTransaction


class BankAccountAPITest(TestCase):
    """Verify deposit, withdrawal, and transfer actions."""

    def setUp(self):
        self.user = User.objects.create_user(username='bankuser', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.primary_account = BankAccount.objects.create(
            name='Operating',
            currency='USD',
            balance=Decimal('100.00'),
            created_by=self.user,
        )
        self.secondary_account = BankAccount.objects.create(
            name='Savings',
            currency='USD',
            balance=Decimal('50.00'),
            created_by=self.user,
        )

    def test_deposit_updates_balance_and_creates_transaction(self):
        response = self.client.post(
            f'/api/accounts/{self.primary_account.id}/deposit/',
            {'amount': '25.00', 'description': 'Initial funding'},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)

        self.primary_account.refresh_from_db()
        self.assertEqual(self.primary_account.balance, Decimal('125.00'))

        transaction = BankAccountTransaction.objects.get(account=self.primary_account)
        self.assertEqual(transaction.transaction_type, BankAccountTransaction.DEPOSIT)
        self.assertEqual(transaction.amount, Decimal('25.00'))
        self.assertEqual(transaction.description, 'Initial funding')

    def test_withdraw_updates_balance_and_creates_transaction(self):
        response = self.client.post(
            f'/api/accounts/{self.primary_account.id}/withdraw/',
            {'amount': '20.00', 'description': 'Petty cash'},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)

        self.primary_account.refresh_from_db()
        self.assertEqual(self.primary_account.balance, Decimal('80.00'))

        transaction = BankAccountTransaction.objects.get(account=self.primary_account)
        self.assertEqual(transaction.transaction_type, BankAccountTransaction.WITHDRAWAL)
        self.assertEqual(transaction.amount, Decimal('20.00'))

    def test_transfer_moves_balance_between_accounts(self):
        response = self.client.post(
            f'/api/accounts/{self.primary_account.id}/transfer/',
            {
                'amount': '30.00',
                'target_account': self.secondary_account.id,
                'description': 'Move to savings',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)

        self.primary_account.refresh_from_db()
        self.secondary_account.refresh_from_db()

        self.assertEqual(self.primary_account.balance, Decimal('70.00'))
        self.assertEqual(self.secondary_account.balance, Decimal('80.00'))

        source_txn = BankAccountTransaction.objects.get(
            account=self.primary_account,
            transaction_type=BankAccountTransaction.TRANSFER_OUT,
        )
        target_txn = BankAccountTransaction.objects.get(
            account=self.secondary_account,
            transaction_type=BankAccountTransaction.TRANSFER_IN,
        )

        self.assertEqual(source_txn.related_account, self.secondary_account)
        self.assertEqual(target_txn.related_account, self.primary_account)

    def test_transfer_rejects_different_currencies(self):
        euro_account = BankAccount.objects.create(
            name='Euro Reserve',
            currency='EUR',
            balance=Decimal('10.00'),
            created_by=self.user,
        )

        response = self.client.post(
            f'/api/accounts/{self.primary_account.id}/transfer/',
            {'amount': '5.00', 'target_account': euro_account.id},
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('same currency', response.data['detail'])
