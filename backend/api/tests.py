from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase

from .models import BankAccount, Customer, Expense, Payment, Product
from .serializers import ProductSerializer


class ProductSerializerTest(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(username='user1', password='pw')
        self.user2 = User.objects.create_user(username='user2', password='pw')

    def _get_request(self, user):
        class DummyRequest:
            pass

        req = DummyRequest()
        req.user = user
        return req

    def test_duplicate_sku_same_user_fails(self):
        Product.objects.create(name='ProdA', sale_price=1, created_by=self.user1, sku='ABC')
        serializer = ProductSerializer(
            data={'name': 'ProdB', 'sale_price': 1, 'sku': 'ABC'},
            context={'request': self._get_request(self.user1)},
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('sku', serializer.errors)

    def test_duplicate_sku_different_user_succeeds(self):
        Product.objects.create(name='ProdA', sale_price=1, created_by=self.user1, sku='ABC')
        serializer = ProductSerializer(
            data={'name': 'ProdB', 'sale_price': 1, 'sku': 'ABC'},
            context={'request': self._get_request(self.user2)},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_blank_sku_allowed(self):
        serializer = ProductSerializer(
            data={'name': 'ProdA', 'sale_price': 1, 'sku': ''},
            context={'request': self._get_request(self.user1)},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_update_same_sku_allowed(self):
        product = Product.objects.create(name='ProdA', sale_price=1, created_by=self.user1, sku='ABC')
        serializer = ProductSerializer(
            product,
            data={'name': 'ProdA', 'sale_price': 1, 'sku': 'ABC'},
            context={'request': self._get_request(self.user1)},
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_update_conflicting_sku_fails(self):
        Product.objects.create(name='ProdA', sale_price=1, created_by=self.user1, sku='ABC')
        product = Product.objects.create(name='ProdB', sale_price=1, created_by=self.user1, sku='DEF')
        serializer = ProductSerializer(
            product,
            data={'name': 'ProdB', 'sale_price': 1, 'sku': 'ABC'},
            context={'request': self._get_request(self.user1)},
            partial=True,
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('sku', serializer.errors)


class BankAccountTransactionTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', password='pw')
        self.account = BankAccount.objects.create(name='Main', created_by=self.user)
        self.customer = Customer.objects.create(name='C', created_by=self.user)

    def test_payment_updates_account_balance(self):
        Payment.objects.create(
            customer=self.customer,
            payment_date=date.today(),
            amount=Decimal('100.00'),
            method='Cash',
            account=self.account,
            created_by=self.user,
        )
        self.account.refresh_from_db()
        self.assertEqual(self.account.balance, Decimal('100.00'))

    def test_expense_updates_account_balance(self):
        Expense.objects.create(
            amount=Decimal('50.00'),
            expense_date=date.today(),
            account=self.account,
            created_by=self.user,
        )
        self.account.refresh_from_db()
        self.assertEqual(self.account.balance, Decimal('-50.00'))

