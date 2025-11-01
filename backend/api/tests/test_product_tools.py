from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from ..models import Product, ProductImage, Warehouse, WarehouseInventory
from . import create_user_with_account


class ProductUtilityEndpointsTest(APITestCase):
    def setUp(self):
        self.user, self.account = create_user_with_account('product-user')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_suggest_sku_uses_category_prefix(self):
        Product.objects.create(
            name='Phone',
            sale_price=Decimal('100.00'),
            created_by=self.user,
            account=self.account,
            sku='ELEC-001',
        )

        url = reverse('product-suggest-sku')
        response = self.client.get(url, {'category': 'Electronics'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['sku'], 'ELEC-002')

    def test_suggest_price_applies_margin_rules(self):
        url = reverse('product-suggest-price')
        response = self.client.get(url, {'purchase_price': '100'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['suggested_price'], '130.00')
        self.assertEqual(response.data['margin_percent'], '30.00')

    def test_total_stock_endpoint_sums_all_warehouses(self):
        product = Product.objects.create(
            name='Widget',
            sale_price=Decimal('10.00'),
            created_by=self.user,
            account=self.account,
        )
        first = Warehouse.objects.create(
            name='A', created_by=self.user, account=self.account
        )
        second = Warehouse.objects.create(
            name='B', created_by=self.user, account=self.account
        )
        WarehouseInventory.objects.create(
            product=product, warehouse=first, quantity=Decimal('3.00')
        )
        WarehouseInventory.objects.create(
            product=product, warehouse=second, quantity=Decimal('2.50')
        )

        url = reverse('product-total-stock', args=[product.pk])
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_stock'], '5.50')


class ProductGalleryManagementTest(APITestCase):
    def setUp(self):
        self.user, self.account = create_user_with_account('gallery-user')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _create_image(self, name: str) -> SimpleUploadedFile:
        return SimpleUploadedFile(name, b'img', content_type='image/jpeg')

    def test_create_product_with_gallery_images(self):
        url = reverse('product-list')
        response = self.client.post(
            url,
            {
                'name': 'Gallery Product',
                'sale_price': '20.00',
                'gallery_images': [
                    self._create_image('first.jpg'),
                    self._create_image('second.jpg'),
                ],
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 201, response.data)
        product = Product.objects.get(pk=response.data['id'])
        self.assertEqual(product.gallery.count(), 2)

    def test_remove_gallery_image_via_update(self):
        product = Product.objects.create(
            name='Editable Product',
            sale_price=Decimal('50.00'),
            created_by=self.user,
            account=self.account,
        )
        image = ProductImage.objects.create(
            product=product,
            image=self._create_image('existing.jpg'),
        )

        url = reverse('product-detail', args=[product.pk])
        response = self.client.patch(
            url,
            {
                'gallery_remove_ids': [str(image.pk)],
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(ProductImage.objects.filter(product=product).exists())
