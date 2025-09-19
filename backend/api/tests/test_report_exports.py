"""Tests covering PDF and Excel exports for accounting reports."""

from datetime import date
from decimal import Decimal
from io import BytesIO

from django.contrib.auth.models import User
from django.test import TestCase
from openpyxl import load_workbook
from rest_framework.test import APIClient

from ..models import Customer, Expense, ExpenseCategory, Sale


class ReportExportTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="reportuser", password="pw")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.customer = Customer.objects.create(name="Acme Corp", created_by=self.user)
        self.sale = Sale.objects.create(
            customer=self.customer,
            created_by=self.user,
            invoice_number="INV-001",
            original_amount=Decimal("100.00"),
            exchange_rate=Decimal("1"),
        )
        self.sale.refresh_from_db()
        self.sale_date = self.sale.sale_date

        category = ExpenseCategory.objects.create(name="Office", created_by=self.user)
        Expense.objects.create(
            category=category,
            amount=Decimal("40.00"),
            expense_date=date(2024, 1, 2),
            created_by=self.user,
        )

    def _assert_pdf_response(self, response):
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_sales_report_excel_contains_data(self):
        response = self.client.get(
            "/api/reports/sales/",
            {
                "start_date": "2023-01-01",
                "end_date": "2025-01-01",
                "format": "xlsx",
            },
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(
            response["Content-Type"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        self.assertIn(".xlsx", response["Content-Disposition"])

        workbook = load_workbook(BytesIO(response.content))
        worksheet = workbook.active

        self.assertEqual(worksheet["B5"].value, self.sale_date.strftime("%Y-%m-%d"))
        self.assertEqual(worksheet["C5"].value, self.sale.invoice_number)
        self.assertEqual(worksheet["D5"].value, self.customer.name)
        self.assertAlmostEqual(worksheet["F5"].value, float(self.sale.total_amount))
        self.assertAlmostEqual(worksheet["F7"].value, float(self.sale.total_amount))

    def test_sales_report_pdf_download(self):
        response = self.client.get(
            "/api/reports/sales/",
            {
                "start_date": "2023-01-01",
                "end_date": "2025-01-01",
                "format": "pdf",
            },
        )

        self._assert_pdf_response(response)

    def test_profit_loss_excel_contains_totals(self):
        response = self.client.get(
            "/api/reports/profit-loss/",
            {
                "start_date": "2023-01-01",
                "end_date": "2025-01-01",
                "format": "xlsx",
            },
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(
            response["Content-Type"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        workbook = load_workbook(BytesIO(response.content))
        worksheet = workbook.active

        self.assertEqual(worksheet["A5"].value, "Revenue")
        self.assertAlmostEqual(worksheet["C5"].value, float(self.sale.total_amount))
        self.assertEqual(worksheet["B7"].value, "Total Expenses")
        self.assertAlmostEqual(worksheet["C7"].value, 40.0)
        self.assertEqual(worksheet["A8"].value, "Summary")
        self.assertAlmostEqual(worksheet["C8"].value, float(self.sale.total_amount) - 40.0)

    def test_profit_loss_pdf_download(self):
        response = self.client.get(
            "/api/reports/profit-loss/",
            {
                "start_date": "2023-01-01",
                "end_date": "2025-01-01",
                "format": "pdf",
            },
        )

        self._assert_pdf_response(response)
