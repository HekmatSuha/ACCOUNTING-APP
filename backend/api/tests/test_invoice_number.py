from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase

from ..models import Customer, Product
from ..serializers import SaleWriteSerializer


class InvoiceNumberGenerationTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="invuser", password="pw")
        self.customer = Customer.objects.create(name="C", created_by=self.user)
        self.product = Product.objects.create(
            name="P",
            sale_price=Decimal("10.00"),
            stock_quantity=Decimal("10"),
            created_by=self.user,
        )

    def _get_request(self):
        class DummyRequest:
            pass

        req = DummyRequest()
        req.user = self.user
        return req

    def _create_sale(self):
        serializer = SaleWriteSerializer(
            data={
                "customer_id": self.customer.id,
                "sale_date": str(date.today()),
                "items": [
                    {
                        "product_id": self.product.id,
                        "quantity": 1,
                        "unit_price": "10.00",
                    }
                ],
            },
            context={"request": self._get_request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        return serializer.save()

    def test_generated_invoice_numbers_are_sequential(self):
        sale1 = self._create_sale()
        sale2 = self._create_sale()
        self.assertEqual(sale1.invoice_number, "1")
        self.assertEqual(sale2.invoice_number, "2")
        self.assertNotEqual(sale1.invoice_number, sale2.invoice_number)
