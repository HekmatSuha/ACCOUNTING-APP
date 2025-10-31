from datetime import date
from datetime import date
from decimal import Decimal

from django.db import IntegrityError
from django.test import TestCase

from ..models import Customer, Product, Warehouse
from ..serializers import SaleWriteSerializer
from . import create_user_with_account


class InvoiceNumberGenerationTest(TestCase):
    def setUp(self):
        self.user, self.account = create_user_with_account("invuser")
        self.customer = Customer.objects.create(name="C", created_by=self.user)
        self.warehouse = Warehouse.get_default(self.user)
        self.product = Product.objects.create(
            name="P",
            sale_price=Decimal("10.00"),
            stock_quantity=Decimal("10"),
            created_by=self.user,
        )

    def _get_request(self, user=None):
        class DummyRequest:
            pass

        req = DummyRequest()
        req.user = user or self.user
        return req

    def _create_sale_for(
        self,
        *,
        user,
        customer,
        warehouse,
        product,
        invoice_number=None,
    ):
        serializer = SaleWriteSerializer(
            data={
                "customer_id": customer.id,
                "sale_date": str(date.today()),
                "items": [
                    {
                        "product_id": product.id,
                        "quantity": 1,
                        "unit_price": "10.00",
                        "warehouse_id": warehouse.id,
                    }
                ],
                **({"invoice_number": invoice_number} if invoice_number else {}),
            },
            context={"request": self._get_request(user)},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        return serializer.save()

    def _create_sale(self, invoice_number=None):
        return self._create_sale_for(
            user=self.user,
            customer=self.customer,
            warehouse=self.warehouse,
            product=self.product,
            invoice_number=invoice_number,
        )

    def test_generated_invoice_numbers_are_sequential(self):
        sale1 = self._create_sale()
        sale2 = self._create_sale()
        self.assertEqual(sale1.invoice_number, "1")
        self.assertEqual(sale2.invoice_number, "2")
        self.assertNotEqual(sale1.invoice_number, sale2.invoice_number)

    def test_same_invoice_number_allowed_for_different_accounts(self):
        sale1 = self._create_sale()

        other_user, _ = create_user_with_account("invuser-two")
        other_customer = Customer.objects.create(name="C2", created_by=other_user)
        other_warehouse = Warehouse.get_default(other_user)
        other_product = Product.objects.create(
            name="P2",
            sale_price=Decimal("10.00"),
            stock_quantity=Decimal("10"),
            created_by=other_user,
        )

        sale2 = self._create_sale_for(
            user=other_user,
            customer=other_customer,
            warehouse=other_warehouse,
            product=other_product,
        )

        self.assertEqual(sale1.invoice_number, "1")
        self.assertEqual(sale2.invoice_number, "1")

    def test_duplicate_invoice_number_same_account_rejected(self):
        self._create_sale(invoice_number="INV-1")

        serializer = SaleWriteSerializer(
            data={
                "customer_id": self.customer.id,
                "sale_date": str(date.today()),
                "invoice_number": "INV-1",
                "items": [
                    {
                        "product_id": self.product.id,
                        "quantity": 1,
                        "unit_price": "10.00",
                        "warehouse_id": self.warehouse.id,
                    }
                ],
            },
            context={"request": self._get_request()},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        with self.assertRaises(IntegrityError):
            serializer.save()
