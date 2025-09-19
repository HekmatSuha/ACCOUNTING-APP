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

        Customer.objects.create(
            name="Globex", created_by=self.user, currency="EUR", open_balance=Decimal("-25.00")
        )
        Customer.objects.create(
            name="Initech", created_by=self.user, currency="USD", open_balance=Decimal("0.00")
        )

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

    def test_customer_balance_excel_contains_summary_and_details(self):
        response = self.client.get(
            "/api/reports/customer-balances/",
            {
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

        self.assertEqual(worksheet["A1"].value, "Customer Balance Report")

        rows = list(worksheet.iter_rows(values_only=True))
        status_counts = {
            row[0]: row[1]
            for row in rows
            if row and row[0] in {"Customers Owing Us", "Customers We Owe", "Settled Customers"}
        }
        self.assertEqual(status_counts.get("Customers Owing Us"), 1)
        self.assertEqual(status_counts.get("Customers We Owe"), 1)
        self.assertEqual(status_counts.get("Settled Customers"), 1)

        currency_rows = {
            row[0]: row
            for row in rows
            if row and row[0] in {"USD", "EUR"}
        }
        self.assertAlmostEqual(currency_rows["USD"][1], float(self.sale.total_amount))
        self.assertAlmostEqual(currency_rows["EUR"][2], 25.0)

        customer_rows = [row for row in rows if row and row[0] == self.customer.name]
        self.assertTrue(customer_rows)
        self.assertAlmostEqual(customer_rows[0][4], float(self.sale.total_amount))
        self.assertEqual(customer_rows[0][5], "Customers Owing Us")

    def test_customer_balance_pdf_download(self):
        response = self.client.get(
            "/api/reports/customer-balances/",
            {
                "format": "pdf",
            },
        )

        self._assert_pdf_response(response)
