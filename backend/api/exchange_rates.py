from collections.abc import Mapping
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, Optional

import logging
import requests
from django.conf import settings
from django.core.cache import cache
from django.apps import apps


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


def _extract_rate(data: Mapping[str, Any], from_currency: str, to_currency: str) -> Decimal:
    """Extract the exchange rate between ``from_currency`` and ``to_currency``.

    The exchangerate.host API (``/latest``) returns a ``rates`` mapping while
    currencylayer-compatible endpoints (``/live``) expose rates under a
    ``quotes`` object keyed by the concatenated currency pair (e.g. ``{"USDEUR":
    1.07}``).  Some responses also surface the rate inside nested objects (e.g.
    ``{"info": {"rate": 1.234}}``) or under a ``result`` key when using the
    ``convert`` endpoint.  To keep the integration resilient to these
    variations, we check a few well-known locations before treating the payload
    as invalid.
    """

    rates = data.get("rates")
    if isinstance(rates, Mapping) and to_currency in rates:
        return _as_decimal(rates[to_currency])

    quotes = data.get("quotes")
    rate_key = f"{from_currency}{to_currency}"
    if isinstance(quotes, Mapping) and rate_key in quotes:
        return _as_decimal(quotes[rate_key])

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

    manual_table_rate = _manual_exchange_rate(from_currency, to_currency)
    if manual_table_rate is not None:
        cache.set(cache_key, manual_table_rate, timeout=3600)
        return manual_table_rate

    manual_rate_decimal: Optional[Decimal] = None
    if manual_rate is not None:
        manual_rate_decimal = _as_decimal(manual_rate)

    api_url = getattr(settings, "EXCHANGE_RATE_API_URL", "https://api.exchangeratesapi.io/v1/latest")
    access_key = getattr(settings, "EXCHANGE_RATE_API_KEY", None)

    params = {
        "base": from_currency,
        "symbols": to_currency,
    }
    if access_key:
        params["access_key"] = access_key

    def _handle_failure(exc: Exception) -> Decimal:
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

    try:
        response = requests.get(
            api_url,
            params=params,
            timeout=10,
        )
        response.raise_for_status()
    except requests.exceptions.RequestException as exc:
        return _handle_failure(exc)

    try:
        data = response.json()
    except ValueError as exc:
        return _handle_failure(exc)

    if not isinstance(data, Mapping):
        return _handle_failure(ValueError("Exchange rate response is not a JSON object"))

    success = data.get("success")
    if success is False:
        error_detail = data.get("error") or data.get("message")
        if isinstance(error_detail, dict):
            error_detail = error_detail.get("info", str(error_detail))
        raise ValueError(f"Exchange rate API returned error: {error_detail}")

    try:
        rate = _extract_rate(data, from_currency, to_currency)
    except ValueError as exc:
        return _handle_failure(exc)

    cache.set(cache_key, rate, timeout=3600)
    return rate
def _manual_exchange_rate(from_currency: str, to_currency: str) -> Optional[Decimal]:
    """Return a manual exchange rate using the stored currency table."""

    Currency = apps.get_model('api', 'Currency')
    try:
        from_currency_obj = Currency.objects.get(code=from_currency.upper())
        to_currency_obj = Currency.objects.get(code=to_currency.upper())
    except Currency.DoesNotExist:
        return None

    from_rate = from_currency_obj.exchange_rate
    to_rate = to_currency_obj.exchange_rate
    if from_rate <= 0 or to_rate <= 0:
        return None

    # When both currencies have the default exchange rate, we should not consider
    # it a valid manual rate.
    if from_rate == Decimal("1.0") and to_rate == Decimal("1.0"):
        return None

    quantizer = Decimal('1.000000')
    return (from_rate / to_rate).quantize(quantizer, rounding=ROUND_HALF_UP)
