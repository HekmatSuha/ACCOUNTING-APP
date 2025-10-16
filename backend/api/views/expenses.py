"""Expense related API views and reports."""

from datetime import date

from django.db.models import DecimalField, Sum
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..activity_logger import log_activity
from ..models import Expense, Sale
from ..report_exports import generate_profit_loss_pdf, generate_profit_loss_workbook
from ..serializers import (
    ExpenseCategorySerializer,
    ExpenseSerializer,
)
from .utils import get_request_account


class ExpenseCategoryViewSet(viewsets.ModelViewSet):
    """CRUD operations for expense categories."""

    serializer_class = ExpenseCategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        account = get_request_account(self.request)
        return account.expense_categories.order_by('name')

    def perform_create(self, serializer):
        account = get_request_account(self.request)
        instance = serializer.save(created_by=self.request.user, account=account)
        log_activity(self.request.user, 'created', instance)

    def perform_update(self, serializer):
        account = get_request_account(self.request)
        instance = serializer.save(account=account)
        log_activity(self.request.user, 'updated', instance)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()


class ExpenseViewSet(viewsets.ModelViewSet):
    """CRUD operations for expenses."""

    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        account = get_request_account(self.request)
        return Expense.objects.filter(account=account).order_by('-expense_date')

    def perform_create(self, serializer):
        account = get_request_account(self.request)
        instance = serializer.save(created_by=self.request.user, account=account)
        log_activity(self.request.user, 'created', instance)

    def perform_update(self, serializer):
        account = get_request_account(self.request)
        instance = serializer.save(account=account)
        log_activity(self.request.user, 'updated', instance)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profit_and_loss_report(request):
    """Provide a profit and loss report for a given date range."""

    account = get_request_account(request)

    start_date_str = request.query_params.get('start_date', '2000-01-01')
    end_date_str = request.query_params.get('end_date', date.today().strftime('%Y-%m-%d'))

    sales_in_range = Sale.objects.filter(
        account=account,
        sale_date__range=[start_date_str, end_date_str],
    )

    total_revenue = sales_in_range.aggregate(
        total=Coalesce(Sum('total_amount'), 0, output_field=DecimalField())
    )['total']

    expenses_in_range = Expense.objects.filter(
        account=account,
        expense_date__range=[start_date_str, end_date_str],
    )

    expenses_by_category = (
        expenses_in_range.values('category__name')
        .annotate(total=Sum('amount'))
        .order_by('category__name')
    )

    total_expenses = expenses_in_range.aggregate(
        total=Coalesce(Sum('amount'), 0, output_field=DecimalField())
    )['total']

    net_profit = total_revenue - total_expenses

    report_data = {
        'start_date': start_date_str,
        'end_date': end_date_str,
        'total_revenue': total_revenue,
        'total_expenses': total_expenses,
        'net_profit': net_profit,
        'expenses_breakdown': list(expenses_by_category),
    }

    export_format = request.query_params.get('export_format')
    if not export_format:
        export_format = request.query_params.get('format')
    export_format = (export_format or '').lower()
    filename_stub = f"profit-loss-report-{start_date_str}-to-{end_date_str}".replace(' ', '_')

    if export_format in {'xlsx', 'excel'}:
        workbook_bytes = generate_profit_loss_workbook(report_data)
        response = HttpResponse(
            workbook_bytes,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename_stub}.xlsx"'
        return response

    if export_format == 'pdf':
        pdf_bytes = generate_profit_loss_pdf(report_data)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename_stub}.pdf"'
        return response

    return Response(report_data)
