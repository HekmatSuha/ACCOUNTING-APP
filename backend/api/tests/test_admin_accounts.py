"""Tests for the staff-facing admin account management API."""

from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from ..models import Account, SubscriptionPlan
from . import create_user_with_account


class AdminAccountAPITest(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user("staff", password="pw", is_staff=True)
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

        # Existing tenant account used for list/detail assertions
        self.user, self.account = create_user_with_account("tenant")
        subscription = self.account.subscription
        subscription.seat_limit = subscription.seat_limit or subscription.plan.user_limit or 5
        subscription.billing_cycle = SubscriptionPlan.BILLING_INTERVAL_MONTHLY
        subscription.save(update_fields=["seat_limit", "billing_cycle", "updated_at"])

    def test_requires_staff_permissions(self):
        regular_user, _ = create_user_with_account("regular")
        client = APIClient()
        client.force_authenticate(user=regular_user)
        response = client.get("/api/admin/accounts/")
        self.assertEqual(response.status_code, 403)

    def test_list_accounts_includes_subscription_details(self):
        response = self.client.get("/api/admin/accounts/")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIsInstance(response.data, list)
        self.assertGreaterEqual(len(response.data), 1)
        entry = next((item for item in response.data if item["id"] == self.account.id), None)
        self.assertIsNotNone(entry)
        self.assertEqual(entry["name"], self.account.name)
        self.assertEqual(entry["seat_limit"], self.account.subscription.seat_limit)
        self.assertEqual(entry["subscription"]["plan"], self.account.subscription.plan.code)
        self.assertIn("seats_used", entry)

    def test_create_account_provisions_subscription(self):
        payload = {"name": "Acme Corp", "seat_limit": 10, "plan": "starter"}
        response = self.client.post("/api/admin/accounts/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.data["name"], "Acme Corp")
        created_account = Account.objects.get(name="Acme Corp")
        self.assertIsNotNone(getattr(created_account, "subscription", None))
        self.assertEqual(created_account.subscription.seat_limit, 10)
        self.assertEqual(created_account.subscription.plan.code, "starter")

    def test_update_seat_limit(self):
        response = self.client.patch(
            f"/api/admin/accounts/{self.account.id}/",
            {"seat_limit": 8},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.account.refresh_from_db()
        self.account.subscription.refresh_from_db()
        self.assertEqual(self.account.subscription.seat_limit, 8)
        self.assertEqual(response.data["seat_limit"], 8)

    def test_update_subscription_plan_and_cycle(self):
        response = self.client.post(
            f"/api/admin/accounts/{self.account.id}/subscription/",
            {"plan": "growth", "billing_cycle": "yearly"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        payload = response.data
        self.assertEqual(payload["plan"], "growth")
        self.assertEqual(payload["billing_cycle"], "yearly")
        self.account.subscription.refresh_from_db()
        self.assertEqual(self.account.subscription.plan.code, "growth")
        self.assertEqual(self.account.subscription.billing_cycle, "yearly")

    def test_plan_editor_roundtrip(self):
        response = self.client.get(f"/api/admin/accounts/{self.account.id}/plan/")
        self.assertEqual(response.status_code, 200, response.content)
        data = response.data
        self.assertIn("name", data)
        self.assertIn("price", data)
        update_payload = {
            "name": "Custom Growth",
            "price": "49.99",
            "currency": "USD",
            "billing_cycle": "monthly",
            "seat_limit": 75,
            "features": ["Support", "Integrations"],
        }
        update_response = self.client.put(
            f"/api/admin/accounts/{self.account.id}/plan/",
            update_payload,
            format="json",
        )
        self.assertEqual(update_response.status_code, 200, update_response.content)
        self.account.subscription.plan.refresh_from_db()
        plan = self.account.subscription.plan
        self.assertEqual(plan.name, "Custom Growth")
        self.assertEqual(plan.user_limit, 75)
        self.assertEqual(plan.features, ["Support", "Integrations"])
        self.assertEqual(plan.price, Decimal("49.99"))
