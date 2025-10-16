"""Utility helpers shared across API view modules."""

from rest_framework.exceptions import PermissionDenied

from ..models import Account


def get_request_account(request):
    """Return the active account for ``request.user`` or raise a permission error."""

    account = Account.for_user(getattr(request, "user", None))
    if account is None:
        raise PermissionDenied("No active account available for this user.")
    return account
