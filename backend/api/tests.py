from django.test import TestCase
from django.contrib.auth.models import User
from .models import Product
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
        serializer = ProductSerializer(data={'name': 'ProdB', 'sale_price': 1, 'sku': 'ABC'},
                                       context={'request': self._get_request(self.user1)})
        self.assertFalse(serializer.is_valid())
        self.assertIn('sku', serializer.errors)

    def test_duplicate_sku_different_user_succeeds(self):
        Product.objects.create(name='ProdA', sale_price=1, created_by=self.user1, sku='ABC')
        serializer = ProductSerializer(data={'name': 'ProdB', 'sale_price': 1, 'sku': 'ABC'},
                                       context={'request': self._get_request(self.user2)})
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_blank_sku_allowed(self):
        serializer = ProductSerializer(data={'name': 'ProdA', 'sale_price': 1, 'sku': ''},
                                       context={'request': self._get_request(self.user1)})
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_update_same_sku_allowed(self):
        product = Product.objects.create(name='ProdA', sale_price=1, created_by=self.user1, sku='ABC')
        serializer = ProductSerializer(product, data={'name': 'ProdA', 'sale_price': 1, 'sku': 'ABC'},
                                       context={'request': self._get_request(self.user1)}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_update_conflicting_sku_fails(self):
        Product.objects.create(name='ProdA', sale_price=1, created_by=self.user1, sku='ABC')
        product = Product.objects.create(name='ProdB', sale_price=1, created_by=self.user1, sku='DEF')
        serializer = ProductSerializer(product, data={'name': 'ProdB', 'sale_price': 1, 'sku': 'ABC'},
                                       context={'request': self._get_request(self.user1)}, partial=True)
        self.assertFalse(serializer.is_valid())
        self.assertIn('sku', serializer.errors)
