"""Shared currency conversion helpers used across finance models."""
from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any, Optional, Sequence

from ..exchange_rates import get_exchange_rate

TWOPLACES = Decimal("0.01")


def _coerce_decimal(value: Any, fallback: Decimal) -> Decimal:
    """Return ``value`` as :class:`~decimal.Decimal` or ``fallback`` if invalid."""

    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError):
        return fallback


def to_decimal(value: Any, default: Any = "0") -> Decimal:
    """Normalise ``value`` into :class:`~decimal.Decimal` with a fallback."""

    default_decimal = default if isinstance(default, Decimal) else _coerce_decimal(default, Decimal("0"))
    if value in (None, ""):
        return default_decimal
    return _coerce_decimal(value, default_decimal)


def normalise_currency(value: Optional[str], *fallbacks: Optional[str], default: str = "USD") -> str:
    """Return an upper-cased ISO currency code using provided fallbacks."""

    candidates: Sequence[Optional[str]] = (value,) + fallbacks + (default,)
    for candidate in candidates:
        if not candidate:
            continue
        code = str(candidate).strip().upper()
        if code:
            return code
    raise ValueError("Unable to determine currency code")


def resolve_exchange_rate(
    from_currency: str,
    to_currency: str,
    manual_rate: Any = None,
    *,
    default: Any = None,
) -> Decimal:
    """Resolve an exchange rate, honouring manual overrides and fallbacks."""

    from_code = normalise_currency(from_currency)
    to_code = normalise_currency(to_currency)
    if from_code == to_code:
        return Decimal("1")

    manual_decimal: Optional[Decimal] = None
    if manual_rate not in (None, ""):
        manual_decimal = to_decimal(manual_rate, default="0")
        if manual_decimal > 0:
            return manual_decimal

    try:
        return get_exchange_rate(from_code, to_code)
    except Exception:
        if manual_decimal is not None and manual_decimal > 0:
            return manual_decimal
        if default not in (None, ""):
            fallback_rate = to_decimal(default, default="1")
            if fallback_rate > 0:
                return fallback_rate
        raise


def calculate_converted_amount(
    amount: Any,
    rate: Any,
    *,
    exponent: Decimal = TWOPLACES,
) -> Decimal:
    """Return ``amount`` converted using ``rate`` and quantised to two places."""

    amount_decimal = to_decimal(amount)
    rate_decimal = to_decimal(rate, default="1")
    return (amount_decimal * rate_decimal).quantize(exponent)


def convert_amount(
    amount: Any,
    from_currency: str,
    to_currency: str,
    *,
    manual_rate: Any = None,
    default_rate: Any = None,
    exponent: Decimal = TWOPLACES,
) -> tuple[Decimal, Decimal]:
    """Return the resolved rate and converted amount for a currency pair."""

    rate = resolve_exchange_rate(
        from_currency,
        to_currency,
        manual_rate=manual_rate,
        default=default_rate,
    )
    converted = calculate_converted_amount(amount, rate, exponent=exponent)
    return rate, converted
