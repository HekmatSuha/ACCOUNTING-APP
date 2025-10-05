"""Tests for sale date handling within the SaleWriteSerializer."""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase

from ..models import Customer, Product, Sale, Warehouse
from ..serializers import SaleWriteSerializer


class SaleDateSerializerTests(TestCase):
    """Ensure sales honour provided sale dates across create and update flows."""

    def setUp(self):
        self.user = User.objects.create_user(username="sale-dates", password="pw")
        self.request = self._get_request()
        self.customer = Customer.objects.create(name="Customer", created_by=self.user)
        self.product = Product.objects.create(
            name="Widget",
            sale_price=Decimal("10.00"),
            stock_quantity=Decimal("50"),
            created_by=self.user,
        )
        self.warehouse = Warehouse.get_default(self.user)

    def _get_request(self):
        class DummyRequest:
            pass

        request = DummyRequest()
        request.user = self.user
        return request

    def test_sale_date_defaults_to_today_when_omitted(self):
        serializer = SaleWriteSerializer(
            data={
                "customer_id": self.customer.id,
                "items": [
                    {
                        "product_id": self.product.id,
                        "quantity": "1",
                        "unit_price": "10.00",
                        "warehouse_id": self.warehouse.id,
                    }
                ],
            },
            context={"request": self.request},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        sale = serializer.save()

        self.assertEqual(sale.sale_date, date.today())

    def test_create_sale_respects_provided_sale_date(self):
        backdated = date.today() - timedelta(days=10)
        serializer = SaleWriteSerializer(
            data={
                "customer_id": self.customer.id,
                "sale_date": str(backdated),
                "items": [
                    {
                        "product_id": self.product.id,
                        "quantity": "2",
                        "unit_price": "10.00",
                        "warehouse_id": self.warehouse.id,
                    }
                ],
            },
            context={"request": self.request},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        sale = serializer.save()

        self.assertEqual(sale.sale_date, backdated)

    def test_update_sale_respects_new_sale_date(self):
        sale = self._create_sale()
        revised_date = date.today() - timedelta(days=5)

        serializer = SaleWriteSerializer(
            instance=sale,
            data={
                "customer_id": self.customer.id,
                "sale_date": str(revised_date),
                "items": [
                    {
                        "product_id": self.product.id,
                        "quantity": "3",
                        "unit_price": "10.00",
                        "warehouse_id": self.warehouse.id,
                    }
                ],
            },
            context={"request": self.request},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated_sale = serializer.save()

        self.assertEqual(updated_sale.sale_date, revised_date)

    def _create_sale(self) -> Sale:
        serializer = SaleWriteSerializer(
            data={
                "customer_id": self.customer.id,
                "sale_date": str(date.today()),
                "items": [
                    {
                        "product_id": self.product.id,
                        "quantity": "1",
                        "unit_price": "10.00",
                        "warehouse_id": self.warehouse.id,
                    }
                ],
            },
            context={"request": self.request},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        return serializer.save()
