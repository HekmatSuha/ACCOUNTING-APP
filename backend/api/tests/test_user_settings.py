"""Tests for authenticated user settings endpoints."""

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from . import create_user_with_account


class UserSettingsTests(APITestCase):
    """Ensure the user settings endpoints behave as expected."""

    def setUp(self):
        self.user, self.account = create_user_with_account('jane', password='StrongPass123!')
        self.profile_url = reverse('user-profile')
        self.password_url = reverse('change-password')
        self.client.force_authenticate(self.user)

    def test_get_profile(self):
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'jane')

    def test_update_profile(self):
        payload = {
            'first_name': 'Jane',
            'last_name': 'Doe',
            'email': 'jane@example.com',
        }
        response = self.client.patch(self.profile_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Jane')
        self.assertEqual(self.user.last_name, 'Doe')
        self.assertEqual(self.user.email, 'jane@example.com')

    def test_change_password_success(self):
        payload = {
            'current_password': 'StrongPass123!',
            'new_password': 'NewPass123!@',
            'confirm_password': 'NewPass123!@',
        }
        response = self.client.post(self.password_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewPass123!@'))

    def test_change_password_rejects_invalid_current(self):
        payload = {
            'current_password': 'WrongPass123!',
            'new_password': 'AnotherPass123!@',
            'confirm_password': 'AnotherPass123!@',
        }
        response = self.client.post(self.password_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('current_password', response.data)
