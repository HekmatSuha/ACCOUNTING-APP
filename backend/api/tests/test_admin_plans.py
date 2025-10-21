"""Tests for the staff-facing subscription plan management API."""

from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from ..models import SubscriptionPlan


class AdminPlanAPITest(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user("staff", password="pw", is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)
        self.plan = SubscriptionPlan.objects.create(
            code="starter",
            name="Starter",
            price=Decimal("0"),
            currency="USD",
            billing_interval=SubscriptionPlan.BILLING_INTERVAL_MONTHLY,
            user_limit=10,
            features=["Invoices", "Quotes"],
        )

    def test_requires_staff_permissions(self):
        regular_user = User.objects.create_user("regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=regular_user)
        response = client.get("/api/admin/plans/")
        self.assertEqual(response.status_code, 403)

    def test_list_plans(self):
        response = self.client.get("/api/admin/plans/")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIsInstance(response.data, list)
        entry = next((item for item in response.data if item["id"] == self.plan.id), None)
        self.assertIsNotNone(entry)
        self.assertEqual(entry["name"], "Starter")
        self.assertEqual(entry["code"], "starter")
        self.assertEqual(entry["seat_limit"], 10)
        self.assertEqual(entry["features"], self.plan.features)

    def test_create_plan_generates_code(self):
        payload = {
            "name": "Premium Plus",
            "price": "99.99",
            "currency": "USD",
            "billing_cycle": SubscriptionPlan.BILLING_INTERVAL_YEARLY,
            "seat_limit": 50,
            "features": ["Priority support", "Advanced analytics"],
        }
        response = self.client.post("/api/admin/plans/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertIn("id", response.data)
        created = SubscriptionPlan.objects.get(pk=response.data["id"])
        self.assertTrue(created.code.startswith("premium-plus"))
        self.assertEqual(created.user_limit, 50)
        self.assertEqual(created.features, payload["features"])

    def test_update_plan(self):
        payload = {
            "name": "Starter Updated",
            "price": "19.99",
            "currency": "USD",
            "billing_cycle": SubscriptionPlan.BILLING_INTERVAL_MONTHLY,
            "seat_limit": None,
            "features": ["Invoices"],
        }
        response = self.client.put(
            f"/api/admin/plans/{self.plan.id}/",
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.plan.refresh_from_db()
        self.assertEqual(self.plan.name, "Starter Updated")
        self.assertIsNone(self.plan.user_limit)
        self.assertEqual(self.plan.features, ["Invoices"])
        self.assertEqual(self.plan.price, Decimal("19.99"))

    def test_delete_plan(self):
        response = self.client.delete(f"/api/admin/plans/{self.plan.id}/")
        self.assertEqual(response.status_code, 204, response.content)
        self.assertFalse(SubscriptionPlan.objects.filter(pk=self.plan.id).exists())
