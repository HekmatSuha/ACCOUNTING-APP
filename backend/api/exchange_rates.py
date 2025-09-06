from decimal import Decimal
from typing import Optional

import requests
from django.core.cache import cache


def get_exchange_rate(from_currency: str, to_currency: str, manual_rate: Optional[float] = None) -> Decimal:
    """Return exchange rate from `from_currency` to `to_currency`.

    Results are cached to minimize external API calls. A manually provided rate
    can be supplied via ``manual_rate`` to bypass the API and will also be
    cached. Raises ``ValueError`` if a rate cannot be determined.
    """
    if from_currency == to_currency:
        return Decimal('1')

    cache_key = f'exchange_rate_{from_currency}_{to_currency}'
    cached_rate = cache.get(cache_key)
    if cached_rate:
        return Decimal(str(cached_rate))

    if manual_rate is not None:
        rate = Decimal(str(manual_rate))
        cache.set(cache_key, rate, timeout=3600)
        return rate

    try:
        response = requests.get(
            'https://api.exchangerate.host/latest',
            params={'base': from_currency, 'symbols': to_currency},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        rate = Decimal(str(data['rates'][to_currency]))
        cache.set(cache_key, rate, timeout=3600)
        return rate
    except Exception as exc:
        raise ValueError('Unable to fetch exchange rate') from exc
