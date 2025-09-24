"""Views for managing currency settings."""

from decimal import Decimal

from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from ..models import CompanySettings, Currency
from ..serializers import CurrencySerializer


class CurrencyViewSet(viewsets.ModelViewSet):
    """CRUD operations for :class:`Currency` objects."""

    serializer_class = CurrencySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Currency.objects.all().order_by('code')

    def perform_destroy(self, instance):
        base_code = CompanySettings.load().base_currency
        if instance.code == base_code:
            raise ValidationError('The base currency cannot be deleted.')
        super().perform_destroy(instance)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        self._ensure_base_consistency(response.data)
        return response

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        self._ensure_base_consistency(response.data)
        return response

    def partial_update(self, request, *args, **kwargs):
        response = super().partial_update(request, *args, **kwargs)
        self._ensure_base_consistency(response.data)
        return response

    def _ensure_base_consistency(self, data):
        """Keep the base currency exchange rate at 1 after writes."""

        base_code = CompanySettings.load().base_currency
        currency_code = data.get('code') if isinstance(data, dict) else None
        if currency_code and currency_code == base_code:
            Currency.objects.filter(code=base_code).update(exchange_rate=Decimal('1'))
