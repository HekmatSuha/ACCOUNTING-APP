from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from ..models import AccountMembership, Customer
from . import create_user_with_account


class AccountIsolationAPITest(APITestCase):
    def setUp(self):
        self.user1, self.account1 = create_user_with_account('acct-user-1')
        self.user2, self.account2 = create_user_with_account('acct-user-2')
        self.client = APIClient()

        self.customer = Customer.objects.create(
            name='Scoped Customer',
            created_by=self.user1,
        )

    def test_customer_list_only_shows_own_account(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.get('/api/customers/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['name'], 'Scoped Customer')

        self.client.force_authenticate(user=self.user2)
        response = self.client.get('/api/customers/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_customer_detail_blocked_for_other_account(self):
        self.client.force_authenticate(user=self.user2)
        url = f'/api/customers/{self.customer.id}/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class SubscriptionSeatCountingTests(APITestCase):
    def test_seat_count_updates_subscription(self):
        owner, account = create_user_with_account('seat-owner')
        other_user, _ = create_user_with_account('seat-member')
        AccountMembership.objects.create(account=account, user=other_user)

        self.assertEqual(account.seats_in_use, 2)

        subscription = account.subscription
        subscription.refresh_seat_usage()
        subscription.refresh_from_db()
        self.assertEqual(subscription.seats_in_use, 2)
