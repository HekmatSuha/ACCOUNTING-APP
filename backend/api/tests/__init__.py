from decimal import Decimal

from django.contrib.auth.models import User
from django.utils import timezone

from ..models import Account, AccountMembership, Subscription, SubscriptionPlan


def create_user_with_account(username: str, password: str = "pw"):
    user = User.objects.create_user(username=username, password=password)
    account = Account.objects.create(name=f"{username}-account", owner=user)
    AccountMembership.objects.create(
        account=account,
        user=user,
        is_owner=True,
        is_admin=True,
        is_billing_manager=True,
    )
    plan, _ = SubscriptionPlan.objects.get_or_create(
        code="test-plan",
        defaults={
            "name": "Test Plan",
            "user_limit": 5,
            "price": Decimal("0"),
            "billing_interval": "monthly",
            "description": "Test plan",
            "is_active": True,
        },
    )
    Subscription.objects.create(
        account=account,
        plan=plan,
        status=Subscription.STATUS_ACTIVE,
        current_period_start=timezone.now(),
        seats_in_use=1,
    )
    return user, account
