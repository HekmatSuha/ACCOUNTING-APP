from datetime import date
from decimal import Decimal
import re
import zlib
import base64

from django.contrib.auth.models import User
from django.test import TestCase

from ..models import Customer, Product, Supplier
from ..serializers import SaleWriteSerializer
from ..invoice_pdf import generate_invoice_pdf


def extract_pdf_text(pdf_bytes):
    """Return plain text from the PDF content stream."""
    streams = []
    for m in re.finditer(rb"<<[^>]*?>>\s*stream\r?\n", pdf_bytes, re.DOTALL):
        start = m.end()
        end = pdf_bytes.find(b"endstream", start)
        stream = pdf_bytes[start:end]
        dict_text = m.group(0)
        if b"ASCII85Decode" in dict_text and b"FlateDecode" in dict_text:
            stream = zlib.decompress(base64.a85decode(stream[:-2]))
        elif b"FlateDecode" in dict_text:
            stream = zlib.decompress(stream)
        streams.append(stream)

    raw = b"".join(streams)
    out = bytearray()
    i = 0
    while i < len(raw):
        if raw[i] == 0x5C:  # backslash
            j = i + 1
            digits = b""
            while j < i + 4 and j < len(raw) and 0x30 <= raw[j] <= 0x39:
                digits += bytes([raw[j]])
                j += 1
            if digits:
                out.append(int(digits, 8))
                i = j
            else:
                out.append(raw[j])
                i = j + 1
        else:
            out.append(raw[i])
            i += 1
    return out.decode("cp1252", errors="ignore")


class InvoicePDFCurrencyTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="curuser", password="pw")
        self.product = Product.objects.create(
            name="Prod", sale_price=Decimal("10.00"), created_by=self.user
        )

    def _get_request(self):
        class DummyRequest:
            pass
        req = DummyRequest()
        req.user = self.user
        return req

    def _create_sale(self, *, customer=None, supplier=None):
        data = {
            "sale_date": str(date.today()),
            "items": [
                {"product_id": self.product.id, "quantity": 1, "unit_price": "10.00"}
            ],
        }
        if customer:
            data["customer_id"] = customer.id
        if supplier:
            data["supplier_id"] = supplier.id
        serializer = SaleWriteSerializer(data=data, context={"request": self._get_request()})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        return serializer.save()

    def test_pdf_uses_customer_currency_symbol(self):
        customer = Customer.objects.create(
            name="Euro Cust", currency="EUR", created_by=self.user
        )
        sale = self._create_sale(customer=customer)
        pdf = generate_invoice_pdf(sale)
        text = extract_pdf_text(pdf)
        self.assertIn("€10.00", text)
        self.assertNotIn("$", text)

    def test_pdf_defaults_to_usd_when_no_customer(self):
        supplier = Supplier.objects.create(name="Supp", created_by=self.user)
        sale = self._create_sale(supplier=supplier)
        pdf = generate_invoice_pdf(sale)
        text = extract_pdf_text(pdf)
        self.assertIn("$10.00", text)
