from collections.abc import Mapping
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

import logging
import requests
from django.conf import settings
from django.core.cache import cache


logger = logging.getLogger(__name__)


def _as_decimal(value: Any) -> Decimal:
    """Return ``value`` coerced to :class:`~decimal.Decimal`.

    A :class:`ValueError` is raised when the value cannot be represented as a
    decimal.  ``Decimal`` raises ``InvalidOperation`` for invalid inputs, while
    a ``TypeError`` is raised for objects that cannot be stringified (e.g.
    ``None``); both cases are normalised into :class:`ValueError` so callers can
    handle conversion errors consistently.
    """

    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError) as conversion_error:
        raise ValueError(
            f"Invalid exchange rate value received: {value}"
        ) from conversion_error


def _extract_rate(data: Mapping[str, Any], to_currency: str) -> Decimal:
    """Extract the exchange rate for ``to_currency`` from *data*.

    The exchangerate.host API returns a ``rates`` mapping for the ``latest``
    endpoint, but historically it has also provided the rate inside nested
    objects (e.g. ``{"info": {"rate": 1.234}}``) or under a ``result`` key when
    using the ``convert`` endpoint.  To make our integration resilient to these
    changes we look for the rate in a few well-known locations before treating
    the payload as invalid.
    """

    rates = data.get("rates")
    if isinstance(rates, Mapping) and to_currency in rates:
        return _as_decimal(rates[to_currency])

    info = data.get("info")
    if isinstance(info, Mapping) and "rate" in info:
        return _as_decimal(info["rate"])

    for key in ("result", "rate"):
        if key in data:
            return _as_decimal(data[key])

    raise ValueError("Exchange rate data missing requested currency")


def get_exchange_rate(
    from_currency: str, to_currency: str, manual_rate: Optional[float] = None
) -> Decimal:
    """Return exchange rate from ``from_currency`` to ``to_currency``.

    Results are cached to minimise external API calls. A manually provided rate
    can be supplied via ``manual_rate`` to act as a fallback when the external
    service is unavailable; when used it will be cached for subsequent lookups.
    """
    if from_currency == to_currency:
        return Decimal('1')

    cache_key = f"exchange_rate_{from_currency}_{to_currency}"
    cached_rate = cache.get(cache_key)
    if cached_rate is not None:
        return Decimal(str(cached_rate))

    manual_rate_decimal: Optional[Decimal] = None
    if manual_rate is not None:
        manual_rate_decimal = _as_decimal(manual_rate)

    api_url = getattr(settings, "EXCHANGE_RATE_API_URL", "https://api.exchangerate.host/latest")

    try:
        response = requests.get(
            api_url,
            params={"base": from_currency, "symbols": to_currency},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()

        if not isinstance(data, Mapping):
            raise ValueError("Exchange rate response is not a JSON object")

        success = data.get("success")
        if success is False:
            error_detail = data.get("error") or data.get("message")
            raise ValueError(f"Exchange rate API returned error: {error_detail}")

        rate = _extract_rate(data, to_currency)

        cache.set(cache_key, rate, timeout=3600)
        return rate
    except Exception as exc:
        logger.exception(
            "Failed to fetch exchange rate from %s for %s -> %s", api_url, from_currency, to_currency
        )
        if manual_rate_decimal is not None:
            cache.set(cache_key, manual_rate_decimal, timeout=3600)
            return manual_rate_decimal
        if cached_rate is not None:
            return Decimal(str(cached_rate))
        raise RuntimeError(
            f"Unable to fetch exchange rate for {from_currency} to {to_currency}"
        ) from exc
