from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import serializers

from ..models import Customer, Product, Sale
from ..serializers import SaleWriteSerializer


class SaleStockValidationTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="stockuser", password="pw")
        self.customer = Customer.objects.create(name="C", created_by=self.user)
        self.product = Product.objects.create(
            name="P",
            sale_price=Decimal("10.00"),
            stock_quantity=Decimal("5"),
            created_by=self.user,
        )

    def _get_request(self):
        class DummyRequest:
            pass

        req = DummyRequest()
        req.user = self.user
        return req

    def test_sale_reduces_stock_when_sufficient(self):
        serializer = SaleWriteSerializer(
            data={
                "customer_id": self.customer.id,
                "sale_date": str(date.today()),
                "items": [
                    {
                        "product_id": self.product.id,
                        "quantity": 3,
                        "unit_price": "10.00",
                    }
                ],
            },
            context={"request": self._get_request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        sale = serializer.save()

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, Decimal("2"))
        self.assertEqual(sale.total_amount, Decimal("30.00"))

    def test_sale_fails_when_insufficient_stock(self):
        serializer = SaleWriteSerializer(
            data={
                "customer_id": self.customer.id,
                "sale_date": str(date.today()),
                "items": [
                    {
                        "product_id": self.product.id,
                        "quantity": 6,
                        "unit_price": "10.00",
                    }
                ],
            },
            context={"request": self._get_request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

        with self.assertRaises(serializers.ValidationError):
            serializer.save()

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, Decimal("5"))
        self.assertEqual(Sale.objects.count(), 0)

