from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.contrib.contenttypes.models import ContentType

from ..models import (
    BankAccount,
    Customer,
    Expense,
    Payment,
    Product,
    Supplier,
    Purchase,
    PurchaseItem,
    PurchaseReturn,
    SaleReturn,
    Activity,
    Offer,
    OfferItem,
    Sale,
    SaleItem
)
from ..serializers import (
    ProductSerializer,
    PaymentSerializer,
    SaleWriteSerializer,
    PurchaseWriteSerializer,
)
from ..activity_logger import log_activity
from rest_framework.test import APIClient
from unittest.mock import patch


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
            currency='USD',
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


class PurchaseAccountTransactionTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u2', password='pw')
        self.account = BankAccount.objects.create(name='Main', created_by=self.user)
        self.supplier = Supplier.objects.create(name='Sup', created_by=self.user)
        self.product = Product.objects.create(name='P', sale_price=1, purchase_price=Decimal('5.00'), created_by=self.user)

    def test_purchase_updates_account_balance(self):
        purchase = Purchase.objects.create(
            supplier=self.supplier,
            purchase_date=date.today(),
            account=self.account,
            created_by=self.user,
        )
        PurchaseItem.objects.create(
            purchase=purchase,
            product=self.product,
            quantity=Decimal('2'),
            unit_price=Decimal('5.00'),
        )
        purchase.total_amount = Decimal('10.00')
        purchase.save()

        self.account.refresh_from_db()
        self.supplier.refresh_from_db()

        self.assertEqual(self.account.balance, Decimal('-10.00'))
        self.assertEqual(self.supplier.open_balance, Decimal('0.00'))


class PurchaseReturnTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='pruser', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.supplier = Supplier.objects.create(name='Sup', created_by=self.user)
        self.product = Product.objects.create(name='Prod', sale_price=1, purchase_price=Decimal('5.00'), created_by=self.user)

        serializer = PurchaseWriteSerializer(
            data={
                'supplier_id': self.supplier.id,
                'purchase_date': str(date.today()),
                'items': [{'product_id': self.product.id, 'quantity': '2', 'unit_price': '5.00'}],
            },
            context={'request': self._get_request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.purchase = serializer.save()

    def _get_request(self):
        class DummyRequest:
            pass
        req = DummyRequest()
        req.user = self.user
        return req

    def test_purchase_return_updates_stock_balance_and_activity(self):
        payload = {
            'purchase_id': self.purchase.id,
            'return_date': str(date.today()),
            'items': [{'product_id': self.product.id, 'quantity': '1', 'unit_price': '5.00'}],
        }
        response = self.client.post('/api/purchase-returns/', payload, format='json')
        self.assertEqual(response.status_code, 201)

        self.product.refresh_from_db()
        self.supplier.refresh_from_db()

        self.assertEqual(self.product.stock_quantity, Decimal('1'))
        self.assertEqual(self.supplier.open_balance, Decimal('5.00'))

        pr_id = response.data['id']
        ct = ContentType.objects.get_for_model(PurchaseReturn)
        self.assertTrue(Activity.objects.filter(content_type=ct, object_id=pr_id, action_type='created').exists())


class SaleReturnTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='sruser', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.customer = Customer.objects.create(name='Cust', created_by=self.user)
        self.product = Product.objects.create(name='Prod', sale_price=Decimal('10.00'), stock_quantity=Decimal('2'), created_by=self.user)

        serializer = SaleWriteSerializer(
            data={
                'customer_id': self.customer.id,
                'sale_date': str(date.today()),
                'items': [{'product_id': self.product.id, 'quantity': 2, 'unit_price': '10.00'}],
            },
            context={'request': self._get_request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.sale = serializer.save()

    def _get_request(self):
        class DummyRequest:
            pass
        req = DummyRequest()
        req.user = self.user
        return req

    def test_sale_return_updates_stock_balance_and_activity(self):
        payload = {
            'sale_id': self.sale.id,
            'return_date': str(date.today()),
            'items': [{'product_id': self.product.id, 'quantity': '1', 'unit_price': '10.00', 'reason': 'Damaged'}],
        }
        response = self.client.post('/api/sale-returns/', payload, format='json')
        self.assertEqual(response.status_code, 201)

        self.product.refresh_from_db()
        self.customer.refresh_from_db()

        self.assertEqual(self.product.stock_quantity, Decimal('1'))
        self.assertEqual(self.customer.open_balance, Decimal('10.00'))

        sr_id = response.data['id']
        ct = ContentType.objects.get_for_model(SaleReturn)
        self.assertTrue(Activity.objects.filter(content_type=ct, object_id=sr_id, action_type='created').exists())


class CustomerBalanceTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='ub', password='pw')
        self.customer = Customer.objects.create(name='Cust', created_by=self.user)
        Sale.objects.create(customer=self.customer, total_amount=Decimal('100.00'), created_by=self.user)

    def test_payment_reduces_customer_balance(self):
        Payment.objects.create(
            customer=self.customer,
            payment_date=date.today(),
            amount=Decimal('40.00'),
            currency='USD',
            method='Cash',
            created_by=self.user,
        )
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.balance, Decimal('60.00'))

    def test_payment_delete_restores_balance(self):
        payment = Payment.objects.create(
            customer=self.customer,
            payment_date=date.today(),
            amount=Decimal('25.00'),
            currency='USD',
            method='Cash',
            created_by=self.user,
        )
        payment.delete()
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.balance, Decimal('100.00'))

    def test_payment_update_adjusts_balance(self):
        payment = Payment.objects.create(
            customer=self.customer,
            payment_date=date.today(),
            amount=Decimal('30.00'),
            currency='USD',
            method='Cash',
            created_by=self.user,
        )
        payment.amount = Decimal('50.00')
        payment.save()
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.balance, Decimal('50.00'))


class CrossCurrencyPaymentTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='xc', password='pw')
        self.customer = Customer.objects.create(name='Cust', currency='USD', created_by=self.user)
        Sale.objects.create(customer=self.customer, total_amount=Decimal('200.00'), created_by=self.user)
        self.account = BankAccount.objects.create(name='Euro', currency='EUR', created_by=self.user)

    @patch('api.models.get_exchange_rate', return_value=Decimal('1.10'))
    def test_cross_currency_payment_updates_balances(self, mock_rate):
        Payment.objects.create(
            customer=self.customer,
            payment_date=date.today(),
            amount=Decimal('100.00'),
            currency='EUR',
            method='Cash',
            account=self.account,
            created_by=self.user,
        )
        self.account.refresh_from_db()
        self.customer.refresh_from_db()
        self.assertEqual(self.account.balance, Decimal('100.00'))
        self.assertEqual(self.customer.balance, Decimal('90.00'))
        mock_rate.assert_called_once_with('EUR', 'USD')

    @patch('api.serializers.get_exchange_rate', return_value=Decimal('1.20'))
    def test_exchange_rate_auto_fetched_when_currencies_differ(self, mock_rate):
        data = {
            'payment_date': date.today(),
            'amount': Decimal('50.00'),
            'currency': 'EUR',
            'method': 'Cash',
            'account': self.account.id,
        }
        serializer = PaymentSerializer(data=data, context={'customer': self.customer})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['exchange_rate'], Decimal('1.20'))
        mock_rate.assert_called_once_with('EUR', 'USD', manual_rate=None)

    @patch('api.serializers.get_exchange_rate')
    def test_currency_must_match_account(self, mock_rate):
        data = {
            'payment_date': date.today(),
            'amount': Decimal('50.00'),
            'currency': 'USD',
            'method': 'Cash',
            'account': self.account.id,
        }
        serializer = PaymentSerializer(data=data, context={'customer': self.customer})
        self.assertFalse(serializer.is_valid())
        self.assertIn('currency', serializer.errors)
        mock_rate.assert_not_called()


class ActivityRestoreTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='restorer', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.product = Product.objects.create(name='Prod', sale_price=1, created_by=self.user)

    def test_restore_deleted_product(self):
        log_activity(self.user, 'deleted', self.product)
        activity = Activity.objects.get(action_type='deleted')
        product_id = self.product.pk
        self.product.delete()
        response = self.client.post(f'/api/activities/{activity.id}/restore/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Product.objects.filter(pk=product_id).exists())


class ActivityDateFilterTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='actuser', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.product = Product.objects.create(name='Prod', sale_price=1, created_by=self.user)
        log_activity(self.user, 'created', self.product)
        self.activity_date = Activity.objects.first().timestamp.date()

    def test_filter_by_date(self):
        response = self.client.get('/api/activities/', {'date': self.activity_date.strftime('%Y-%m-%d')})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)


class OfferNestedRouteTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='offeruser', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.customer = Customer.objects.create(name='Cust', created_by=self.user)
        self.product = Product.objects.create(name='Prod', sale_price=Decimal('10.00'), created_by=self.user)

    def test_create_offer_via_customer_route(self):
        url = f'/api/customers/{self.customer.id}/offers/'
        payload = {
            'items': [
                {'product_id': self.product.id, 'quantity': 2, 'unit_price': '10.00'}
            ],
            'details': 'Test offer'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.customer.offers.count(), 1)

        offer_id = self.customer.offers.first().id
        convert_url = f'/api/offers/{offer_id}/convert_to_sale/'
        convert_response = self.client.post(convert_url, {}, format='json')
        self.assertEqual(convert_response.status_code, 200)
        self.assertEqual(self.customer.sales.count(), 1)
        self.customer.offers.first().refresh_from_db()
        self.assertEqual(self.customer.offers.first().status, 'accepted')


class OfferEditDeletePermissionTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='edituser', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.customer = Customer.objects.create(name='Cust', created_by=self.user)
        self.product = Product.objects.create(name='Prod', sale_price=Decimal('10.00'), created_by=self.user)
        self.offer = Offer.objects.create(customer=self.customer, created_by=self.user)
        OfferItem.objects.create(offer=self.offer, product=self.product, quantity=1, unit_price=Decimal('10.00'))
        self.offer.total_amount = Decimal('10.00')
        self.offer.save()

    def test_update_pending_offer(self):
        url = f'/api/offers/{self.offer.id}/'
        payload = {
            'offer_date': str(date.today()),
            'items': [
                {'product_id': self.product.id, 'quantity': 2, 'unit_price': '10.00'}
            ]
        }
        response = self.client.put(url, payload, format='json')
        self.assertEqual(response.status_code, 200)
        self.offer.refresh_from_db()
        self.assertEqual(self.offer.total_amount, Decimal('20.00'))

    def test_update_non_pending_offer_fails(self):
        Offer.objects.filter(id=self.offer.id).update(status='accepted')
        url = f'/api/offers/{self.offer.id}/'
        payload = {
            'offer_date': str(date.today()),
            'items': [
                {'product_id': self.product.id, 'quantity': 2, 'unit_price': '10.00'}
            ]
        }
        response = self.client.put(url, payload, format='json')
        self.assertEqual(response.status_code, 400)

    def test_delete_pending_offer(self):
        url = f'/api/offers/{self.offer.id}/'
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Offer.objects.filter(id=self.offer.id).exists())

    def test_delete_non_pending_offer_fails(self):
        Offer.objects.filter(id=self.offer.id).update(status='accepted')
        url = f'/api/offers/{self.offer.id}/'
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 400)
        self.assertTrue(Offer.objects.filter(id=self.offer.id).exists())


class SaleDeletionTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='saleuser', password='pw')
        self.customer = Customer.objects.create(name='Cust', created_by=self.user, open_balance=Decimal('0.00'))
        self.product = Product.objects.create(
            name='Prod',
            sale_price=Decimal('100.00'),
            stock_quantity=Decimal('10'),
            created_by=self.user,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_delete_sale_with_payments_restores_customer_balance(self):
        original_balance = self.customer.open_balance
        sale = Sale.objects.create(
            customer=self.customer,
            sale_date=date.today(),
            total_amount=Decimal('100.00'),
            created_by=self.user,
        )
        SaleItem.objects.create(
            sale=sale,
            product=self.product,
            quantity=1,
            unit_price=Decimal('100.00'),
        )

        # Mimic serializer side effects of sale creation
        self.product.stock_quantity -= 1
        self.product.save()
        self.customer.open_balance += sale.total_amount
        self.customer.save()

        Payment.objects.create(
            customer=self.customer,
            sale=sale,
            payment_date=date.today(),
            amount=Decimal('60.00'),
            currency='USD',
            method='Cash',
            created_by=self.user,
        )

        # Sanity check intermediate balance
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.open_balance, original_balance + Decimal('40.00'))

        response = self.client.delete(f'/api/sales/{sale.id}/')
        self.assertEqual(response.status_code, 204)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.open_balance, original_balance)


class CrossDealTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='xdeal', password='pw')
        self.customer = Customer.objects.create(name='Cust', created_by=self.user)
        self.supplier = Supplier.objects.create(name='Sup', created_by=self.user)
        self.product = Product.objects.create(
            name='Prod',
            sale_price=Decimal('10.00'),
            purchase_price=Decimal('5.00'),
            stock_quantity=Decimal('10'),
            created_by=self.user,
        )

    def _get_request(self):
        class DummyRequest:
            pass
        req = DummyRequest()
        req.user = self.user
        return req

    def test_sale_to_supplier_reduces_supplier_balance(self):
        serializer = SaleWriteSerializer(
            data={
                'supplier_id': self.supplier.id,
                'sale_date': str(date.today()),
                'items': [{'product_id': self.product.id, 'quantity': 1, 'unit_price': '10.00'}],
            },
            context={'request': self._get_request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        self.supplier.refresh_from_db()
        self.assertEqual(self.supplier.open_balance, Decimal('-10.00'))

    def test_purchase_from_customer_decreases_customer_balance(self):
        serializer = PurchaseWriteSerializer(
            data={
                'customer_id': self.customer.id,
                'purchase_date': str(date.today()),
                'items': [{'product_id': self.product.id, 'quantity': '1', 'unit_price': '5.00'}],
            },
            context={'request': self._get_request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.open_balance, Decimal('-5.00'))


class SupplierDetailsIncludeSalesTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='supdetail', password='pw')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.supplier = Supplier.objects.create(name='Sup', created_by=self.user)
        self.product = Product.objects.create(
            name='Prod',
            sale_price=Decimal('10.00'),
            stock_quantity=Decimal('10'),
            created_by=self.user,
        )

        serializer = SaleWriteSerializer(
            data={
                'supplier_id': self.supplier.id,
                'sale_date': str(date.today()),
                'items': [{'product_id': self.product.id, 'quantity': 1, 'unit_price': '10.00'}],
            },
            context={'request': self._get_request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.sale = serializer.save()

    def _get_request(self):
        class DummyRequest:
            pass
        req = DummyRequest()
        req.user = self.user
        return req

    def test_details_endpoint_returns_sales(self):
        response = self.client.get(f'/api/suppliers/{self.supplier.id}/details/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('sales', response.data)
        self.assertEqual(len(response.data['sales']), 1)
        self.assertEqual(response.data['sales'][0]['id'], self.sale.id)

