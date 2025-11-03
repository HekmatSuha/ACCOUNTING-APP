"""Tests covering the public self-service registration flow."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from ..models import Account, AccountMembership


class PublicRegistrationAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_register_provisions_account_and_membership(self):
        payload = {
            'company_name': 'Beacon Analytics',
            'email': 'owner@example.com',
            'password': 'StrongPass123!',
            'confirm_password': 'StrongPass123!',
            'first_name': 'Alicia',
            'last_name': 'Keys',
        }

        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.content)

        body = response.data
        self.assertIn('detail', body)
        self.assertIn('user', body)
        self.assertIn('account', body)
        self.assertIn('subscription', body)
        self.assertEqual(body['user']['email'], 'owner@example.com')
        self.assertEqual(body['account']['name'], 'Beacon Analytics')
        self.assertEqual(body['subscription']['plan'], 'starter')

        user = User.objects.get(email='owner@example.com')
        self.assertTrue(user.check_password('StrongPass123!'))
        self.assertEqual(user.first_name, 'Alicia')
        self.assertEqual(user.last_name, 'Keys')

        account = Account.objects.get(owner=user)
        membership = AccountMembership.objects.get(account=account, user=user)
        self.assertTrue(membership.is_owner)
        self.assertTrue(membership.is_admin)
        self.assertTrue(membership.is_billing_manager)
        self.assertTrue(membership.is_active)

        subscription = account.subscription
        self.assertEqual(subscription.seats_in_use, 1)
        self.assertEqual(subscription.plan.code, 'starter')
        self.assertEqual(subscription.seat_limit, subscription.plan.user_limit)
