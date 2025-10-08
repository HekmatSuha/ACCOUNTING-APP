"""Shared helpers for posting ledger movements.

These helpers ensure that all balance adjustments are executed inside a single
transaction, use consistent rounding rules and take explicit row-level locks
before mutating the balance field.  The helpers expect amounts expressed in the
system's base precision (two decimal places) and accept both positive and
negative values so callers can express debits and credits explicitly.
"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from django.apps import apps
from django.db import transaction

__all__ = [
    "apply_bank_account_movement",
    "apply_customer_movement",
    "apply_supplier_movement",
    "reverse_bank_account_movement",
    "reverse_customer_movement",
    "reverse_supplier_movement",
]

MONEY_QUANTIZER = Decimal("0.01")


def _to_decimal(amount: Optional[Decimal | int | float | str]) -> Decimal:
    """Normalise *amount* to a Decimal with the project's rounding rules."""

    if amount in (None, "", 0):
        return Decimal("0.00")
    if isinstance(amount, Decimal):
        value = amount
    else:
        value = Decimal(str(amount))
    return value.quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP)


def _adjust_balance(model_name: str, pk: Optional[int], field: str, delta: Decimal) -> Optional[Decimal]:
    """Adjust ``field`` on ``model_name`` by ``delta`` atomically.

    ``delta`` can be positive or negative.  ``None`` is returned when no update
    was required (for example because ``pk`` or ``delta`` were falsy).
    """

    if not pk:
        return None

    if not delta:
        return None

    model = apps.get_model("api", model_name)

    with transaction.atomic():
        obj = model.objects.select_for_update().get(pk=pk)
        current = Decimal(getattr(obj, field) or 0)
        new_value = (current + delta).quantize(MONEY_QUANTIZER, rounding=ROUND_HALF_UP)
        setattr(obj, field, new_value)
        obj.save(update_fields=[field])
        return new_value


def apply_customer_movement(customer_id: Optional[int], amount: Decimal | int | float | str) -> Optional[Decimal]:
    """Apply a customer open-balance movement."""

    return _adjust_balance("Customer", customer_id, "open_balance", _to_decimal(amount))


def reverse_customer_movement(customer_id: Optional[int], amount: Decimal | int | float | str) -> Optional[Decimal]:
    """Reverse a previously applied customer open-balance movement."""

    amount = _to_decimal(amount)
    if not amount:
        return None
    return _adjust_balance("Customer", customer_id, "open_balance", -amount)


def apply_supplier_movement(supplier_id: Optional[int], amount: Decimal | int | float | str) -> Optional[Decimal]:
    """Apply a supplier open-balance movement."""

    return _adjust_balance("Supplier", supplier_id, "open_balance", _to_decimal(amount))


def reverse_supplier_movement(supplier_id: Optional[int], amount: Decimal | int | float | str) -> Optional[Decimal]:
    """Reverse a previously applied supplier open-balance movement."""

    amount = _to_decimal(amount)
    if not amount:
        return None
    return _adjust_balance("Supplier", supplier_id, "open_balance", -amount)


def apply_bank_account_movement(account_id: Optional[int], amount: Decimal | int | float | str) -> Optional[Decimal]:
    """Apply a bank-account balance movement."""

    return _adjust_balance("BankAccount", account_id, "balance", _to_decimal(amount))


def reverse_bank_account_movement(account_id: Optional[int], amount: Decimal | int | float | str) -> Optional[Decimal]:
    """Reverse a previously applied bank-account movement."""

    amount = _to_decimal(amount)
    if not amount:
        return None
    return _adjust_balance("BankAccount", account_id, "balance", -amount)
