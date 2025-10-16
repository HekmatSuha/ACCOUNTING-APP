from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from ..models import Product, Warehouse, WarehouseInventory
from . import create_user_with_account


class WarehouseTransferAPITest(TestCase):
    def setUp(self):
        self.user, self.account = create_user_with_account('warehouse-user')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.product = Product.objects.create(
            name='Widget',
            sale_price=Decimal('10.00'),
            stock_quantity=Decimal('10'),
            created_by=self.user,
        )
        self.source = Warehouse.get_default(self.user)
        self.destination = Warehouse.objects.create(
            name='Secondary Warehouse',
            location='Offsite',
            created_by=self.user,
        )

    def test_transfer_moves_stock_between_warehouses(self):
        response = self.client.post(
            '/api/warehouses/transfer/',
            {
                'product_id': self.product.id,
                'source_warehouse_id': self.source.id,
                'destination_warehouse_id': self.destination.id,
                'quantity': '3',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data
        self.assertEqual(Decimal(data['source_quantity']), Decimal('7.00'))
        self.assertEqual(Decimal(data['destination_quantity']), Decimal('3.00'))
        self.assertEqual(data['product_name'], 'Widget')
        self.assertEqual(data['source_name'], self.source.name)
        self.assertEqual(data['destination_name'], self.destination.name)

        source_inventory = WarehouseInventory.objects.get(
            product=self.product, warehouse=self.source
        )
        destination_inventory = WarehouseInventory.objects.get(
            product=self.product, warehouse=self.destination
        )
        self.assertEqual(source_inventory.quantity, Decimal('7.00'))
        self.assertEqual(destination_inventory.quantity, Decimal('3.00'))
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, Decimal('10.00'))

    def test_transfer_requires_available_stock(self):
        response = self.client.post(
            '/api/warehouses/transfer/',
            {
                'product_id': self.product.id,
                'source_warehouse_id': self.source.id,
                'destination_warehouse_id': self.destination.id,
                'quantity': '15',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('quantity', response.data)
        self.assertIn('Insufficient stock', response.data['quantity'])

    def test_transfer_requires_distinct_warehouses(self):
        response = self.client.post(
            '/api/warehouses/transfer/',
            {
                'product_id': self.product.id,
                'source_warehouse_id': self.source.id,
                'destination_warehouse_id': self.source.id,
                'quantity': '1',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('Source and destination warehouses must be different.', response.data['non_field_errors'])

    def test_transfer_requires_positive_quantity(self):
        response = self.client.post(
            '/api/warehouses/transfer/',
            {
                'product_id': self.product.id,
                'source_warehouse_id': self.source.id,
                'destination_warehouse_id': self.destination.id,
                'quantity': '0',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('Quantity must be greater than zero.', response.data['quantity'])
