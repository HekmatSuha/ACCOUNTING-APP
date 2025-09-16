from decimal import Decimal
from typing import Optional

import logging
import requests
from django.conf import settings
from django.core.cache import cache


logger = logging.getLogger(__name__)


def get_exchange_rate(
    from_currency: str, to_currency: str, manual_rate: Optional[float] = None
) -> Decimal:
    """Return exchange rate from ``from_currency`` to ``to_currency``.

    Results are cached to minimize external API calls. A manually provided rate
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
        manual_rate_decimal = Decimal(str(manual_rate))

    api_url = getattr(settings, "EXCHANGE_RATE_API_URL", "https://api.exchangerate.host/latest")

    try:
        response = requests.get(
            api_url,
            params={"base": from_currency, "symbols": to_currency},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        rate_value = data["rates"][to_currency]
        rate = Decimal(str(rate_value))
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
