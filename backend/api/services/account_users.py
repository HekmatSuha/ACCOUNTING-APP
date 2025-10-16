"""Helpers for managing account memberships and invitations."""

from __future__ import annotations

import secrets
from typing import Optional

from django.utils import timezone

from ..models import Account, AccountInvitation, AccountMembership


class SeatLimitError(Exception):
    """Raised when an account attempts to exceed its seat allocation."""


def generate_invite_token() -> str:
    """Return a URL-safe token for invitation workflows."""

    return secrets.token_urlsafe(32)


def account_has_available_seat(account: Account) -> bool:
    """Return ``True`` if ``account`` has spare user capacity."""

    limit = account.user_limit
    if limit is None:
        return True
    return account.active_memberships.count() < limit


def ensure_account_has_available_seat(account: Account) -> None:
    """Raise :class:`SeatLimitError` if the account has no free seats."""

    if not account_has_available_seat(account):
        raise SeatLimitError("This account has reached its user limit.")


def activate_membership(membership: AccountMembership) -> AccountMembership:
    """Mark ``membership`` as active and refresh seat usage."""

    if not membership.is_active:
        membership.is_active = True
        membership.joined_at = timezone.now()
        membership.save(update_fields=["is_active", "joined_at"])
    membership.account.refresh_subscription_usage()
    return membership


def deactivate_membership(membership: AccountMembership) -> AccountMembership:
    """Soft delete ``membership`` while freeing up a seat for reuse."""

    if membership.is_active:
        membership.is_active = False
        membership.save(update_fields=["is_active"])
    membership.account.refresh_subscription_usage()
    return membership


def consume_available_invitation(
    account: Account,
    email: str,
    *,
    include_roles: Optional[dict[str, bool]] = None,
    invited_by=None,
) -> AccountInvitation:
    """Create or refresh an invitation for the given email address."""

    ensure_account_has_available_seat(account)

    defaults = {
        "invited_by": invited_by,
        "is_admin": False,
        "is_billing_manager": False,
        "token": generate_invite_token(),
        "is_active": True,
        "membership": None,
        "accepted_at": None,
    }
    if include_roles:
        defaults.update(include_roles)

    invitation, created = AccountInvitation.objects.update_or_create(
        account=account,
        email=email,
        is_active=True,
        defaults=defaults,
    )
    if not created:
        # Ensure the token is refreshed for re-issued invitations.
        invitation.token = defaults["token"]
        invitation.invited_by = invited_by
        invitation.is_admin = defaults["is_admin"]
        invitation.is_billing_manager = defaults["is_billing_manager"]
        invitation.accepted_at = None
        invitation.membership = None
        invitation.is_active = True
        invitation.save(
            update_fields=[
                "token",
                "invited_by",
                "is_admin",
                "is_billing_manager",
                "accepted_at",
                "membership",
                "is_active",
            ]
        )
    return invitation


__all__ = [
    "SeatLimitError",
    "activate_membership",
    "account_has_available_seat",
    "consume_available_invitation",
    "deactivate_membership",
    "ensure_account_has_available_seat",
    "generate_invite_token",
]
