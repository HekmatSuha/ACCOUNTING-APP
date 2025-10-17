"""Common utility views for general API endpoints."""

from decimal import Decimal

from django.db.models import (Case, CharField, DecimalField, F, Sum, Value,
                              When)
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import CompanySettings, Customer, Expense, Payment, Product, Purchase, Sale
from .utils import get_request_account


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    """Provide summary data for the dashboard."""
    account = get_request_account(request)

    base_currency = CompanySettings.load().base_currency

    zero = Decimal('0')

    def _currency_breakdown(queryset, currency_field, amount_field):
        aggregates = queryset.values(currency_field).annotate(
            total=Coalesce(Sum(amount_field), zero, output_field=DecimalField())
        )
        breakdown = {}
        for entry in aggregates:
            currency = entry[currency_field]
            total = entry['total']
            if currency and total:
                breakdown[currency] = total
        return breakdown

    sales_qs = Sale.objects.filter(account=account)
    sales_total = sales_qs.aggregate(
        total=Coalesce(Sum('converted_amount'), zero, output_field=DecimalField())
    )['total']
    turnover_breakdown = _currency_breakdown(sales_qs, 'original_currency', 'original_amount')

    customer_sales_qs = sales_qs.filter(customer__account=account)
    customer_sales_total = customer_sales_qs.aggregate(
        total=Coalesce(Sum('converted_amount'), zero, output_field=DecimalField())
    )['total']
    customer_sales_breakdown = _currency_breakdown(
        customer_sales_qs, 'original_currency', 'original_amount'
    )

    payments_qs = Payment.objects.filter(account=account, customer__account=account)
    payments_total = payments_qs.aggregate(
        total=Coalesce(Sum('converted_amount'), zero, output_field=DecimalField())
    )['total']
    customer_payment_breakdown = _currency_breakdown(
        payments_qs.annotate(currency=F('customer__currency')),
        'currency',
        'converted_amount',
    )
    total_receivables = customer_sales_total - payments_total
    receivables_breakdown = {}
    for currency in set(customer_sales_breakdown) | set(customer_payment_breakdown):
        balance = customer_sales_breakdown.get(currency, zero) - customer_payment_breakdown.get(currency, zero)
        if balance:
            receivables_breakdown[currency] = balance

    today = timezone.now().date()
    today_sales_qs = sales_qs.filter(sale_date=today)
    today_sales = today_sales_qs.aggregate(
        total=Coalesce(Sum('converted_amount'), zero, output_field=DecimalField())
    )['total']
    today_sales_breakdown = _currency_breakdown(
        today_sales_qs, 'original_currency', 'original_amount'
    )

    today_payments_qs = payments_qs.filter(payment_date=today)
    today_incoming = today_payments_qs.aggregate(
        total=Coalesce(Sum('converted_amount'), zero, output_field=DecimalField())
    )['total']
    today_incoming_breakdown = _currency_breakdown(
        today_payments_qs, 'original_currency', 'original_amount'
    )

    expenses_qs = Expense.objects.filter(account=account)
    total_expenses = expenses_qs.aggregate(
        total=Coalesce(Sum('amount'), zero, output_field=DecimalField())
    )['total']
    expenses_currency_qs = expenses_qs.annotate(
        currency=Case(
            When(bank_account__isnull=False, then=F('bank_account__currency')),
            When(supplier__currency__isnull=False, then=F('supplier__currency')),
            default=Value(base_currency),
            output_field=CharField(),
        )
    )
    expenses_breakdown = _currency_breakdown(expenses_currency_qs, 'currency', 'amount')

    purchases_qs = Purchase.objects.filter(account=account, supplier__account=account)
    credit_purchases_qs = purchases_qs.filter(bank_account__isnull=True)
    credit_purchase_total = credit_purchases_qs.aggregate(
        total=Coalesce(Sum('converted_amount'), zero, output_field=DecimalField())
    )['total']
    credit_purchase_breakdown = _currency_breakdown(
        credit_purchases_qs, 'original_currency', 'original_amount'
    )

    supplier_expenses_qs = expenses_qs.filter(supplier__account=account)
    supplier_expenses_total = supplier_expenses_qs.aggregate(
        total=Coalesce(Sum('amount'), zero, output_field=DecimalField())
    )['total']
    supplier_expenses_currency_qs = supplier_expenses_qs.annotate(
        currency=Case(
            When(supplier__currency__isnull=False, then=F('supplier__currency')),
            When(bank_account__isnull=False, then=F('bank_account__currency')),
            default=Value(base_currency),
            output_field=CharField(),
        )
    )
    supplier_expenses_breakdown = _currency_breakdown(
        supplier_expenses_currency_qs, 'currency', 'amount'
    )

    payables_breakdown = {}
    for currency in set(credit_purchase_breakdown) | set(supplier_expenses_breakdown):
        balance = credit_purchase_breakdown.get(currency, zero) - supplier_expenses_breakdown.get(currency, zero)
        if balance:
            payables_breakdown[currency] = balance
    total_payables = credit_purchase_total - supplier_expenses_total

    stock_value = Product.objects.filter(account=account).aggregate(
        total_value=Coalesce(Sum(F('purchase_price') * F('stock_quantity')), zero, output_field=DecimalField())
    )['total_value']
    stock_value = stock_value or zero
    stock_value_breakdown = {base_currency: stock_value} if stock_value else {}

    data = {
        'total_receivables': total_receivables,
        'total_receivables_breakdown': receivables_breakdown,
        'total_payables': total_payables,
        'total_payables_breakdown': payables_breakdown,
        'turnover': sales_total,
        'turnover_breakdown': turnover_breakdown,
        'expenses': total_expenses,
        'expenses_breakdown': expenses_breakdown,
        'stock_value': stock_value,
        'stock_value_breakdown': stock_value_breakdown,
        'customer_count': Customer.objects.filter(account=account).count(),
        'today_sales': today_sales,
        'today_sales_breakdown': today_sales_breakdown,
        'today_incoming': today_incoming,
        'today_incoming_breakdown': today_incoming_breakdown,
    }
    return Response(data)
