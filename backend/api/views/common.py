"""Common utility views for general API endpoints."""

from django.db.models import DecimalField, F, Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Customer, Payment, Sale


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_currency_options(request):
    """Provide the available currency options."""
    return Response(Customer.CURRENCY_CHOICES)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    """Provide summary data for the dashboard."""
    user = request.user

    sales_total = Sale.objects.filter(
        Q(customer__created_by=user) | Q(supplier__created_by=user)
    ).aggregate(total=Coalesce(Sum('total_amount'), 0, output_field=DecimalField()))['total']
    payments_total = Payment.objects.filter(customer__created_by=user).aggregate(
        total=Coalesce(Sum('converted_amount'), 0, output_field=DecimalField())
    )['total']
    total_receivables = sales_total - payments_total

    today = timezone.now().date()
    today_sales = Sale.objects.filter(
        Q(customer__created_by=user) | Q(supplier__created_by=user), sale_date=today
    ).aggregate(total=Coalesce(Sum('total_amount'), 0, output_field=DecimalField()))['total']
    today_incoming = Payment.objects.filter(
        customer__created_by=user, payment_date=today
    ).aggregate(total=Coalesce(Sum('converted_amount'), 0, output_field=DecimalField()))['total']

    stock_value = user.products.aggregate(
        total_value=Coalesce(Sum(F('purchase_price') * F('stock_quantity')), 0, output_field=DecimalField())
    )['total_value']

    total_expenses = user.expenses.aggregate(
        total=Coalesce(Sum('amount'), 0, output_field=DecimalField())
    )['total']

    total_payables = user.suppliers.aggregate(
        total=Coalesce(Sum('open_balance'), 0, output_field=DecimalField())
    )['total']

    data = {
        'total_receivables': total_receivables,
        'total_payables': total_payables,
        'turnover': sales_total,
        'expenses': total_expenses,
        'stock_value': stock_value,
        'customer_count': user.customers.count(),
        'today_sales': today_sales,
        'today_incoming': today_incoming,
    }
    return Response(data)
