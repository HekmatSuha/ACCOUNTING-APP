"""Supplier related API views."""

from decimal import Decimal

from django.db.models import Sum
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..activity_logger import log_activity
from ..models import Expense, Supplier
from ..serializers import (
    ExpenseSerializer,
    PurchaseReadSerializer,
    SaleReadSerializer,
    SupplierSerializer,
)


class SupplierViewSet(viewsets.ModelViewSet):
    """CRUD operations for suppliers."""

    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.suppliers.all().order_by('-created_at')

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        log_activity(self.request.user, 'created', instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'updated', instance)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()

    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        supplier = self.get_object()
        purchases = supplier.purchases.all().order_by('-purchase_date')
        sales = supplier.sales.all().order_by('-sale_date')
        expenses = supplier.expenses.all().order_by('-expense_date')

        purchase_total = purchases.aggregate(Sum('total_amount'))['total_amount__sum'] or Decimal('0.00')
        sales_total = sales.aggregate(Sum('total_amount'))['total_amount__sum'] or Decimal('0.00')
        total_turnover = purchase_total + sales_total

        data = {
            'supplier': SupplierSerializer(supplier).data,
            'purchases': PurchaseReadSerializer(purchases, many=True).data,
            'sales': SaleReadSerializer(sales, many=True).data,
            'expenses': ExpenseSerializer(expenses, many=True).data,
            'summary': {
                'open_balance': supplier.open_balance,
                'check_balance': 0.00,  # Placeholder
                'note_balance': 0.00,  # Placeholder
                'turnover': total_turnover,
            },
        }
        return Response(data)


class SupplierPaymentViewSet(viewsets.ModelViewSet):
    """Handle expense-based payments scoped to a supplier."""

    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        supplier_pk = self.kwargs.get('supplier_pk')
        return Expense.objects.filter(supplier__id=supplier_pk, created_by=self.request.user)

    def perform_create(self, serializer):
        supplier_pk = self.kwargs.get('supplier_pk')
        try:
            supplier = Supplier.objects.get(pk=supplier_pk, created_by=self.request.user)
            instance = serializer.save(
                created_by=self.request.user,
                supplier=supplier,
            )
            log_activity(self.request.user, 'created', instance)
        except Supplier.DoesNotExist:
            raise NotFound(detail="Supplier not found.")
