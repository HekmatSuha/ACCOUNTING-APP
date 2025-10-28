"""Purchase related API views."""

from django.db import transaction
from django.db.models import F
from django.http import FileResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..activity_logger import log_activity
from ..invoice_pdf import generate_purchase_invoice_pdf
from ..models import (
    Customer,
    Product,
    Purchase,
    PurchaseReturn,
    Supplier,
    Warehouse,
    WarehouseInventory,
)
from ..serializers import (
    PurchaseReadSerializer,
    PurchaseReturnSerializer,
    PurchaseWriteSerializer,
)
from .utils import get_request_account


class PurchaseViewSet(viewsets.ModelViewSet):
    """CRUD operations for purchases."""

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update']:
            return PurchaseWriteSerializer
        return PurchaseReadSerializer

    def get_queryset(self):
        account = get_request_account(self.request)
        return Purchase.objects.filter(account=account).order_by('-purchase_date')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        instance = serializer.instance
        read_serializer = PurchaseReadSerializer(
            instance, context=self.get_serializer_context()
        )
        headers = self.get_success_headers(read_serializer.data)
        return Response(read_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        account = get_request_account(self.request)
        instance = serializer.save(created_by=self.request.user, account=account)
        log_activity(self.request.user, 'created', instance)

    def perform_update(self, serializer):
        account = get_request_account(self.request)
        instance = serializer.save(account=account)
        log_activity(self.request.user, 'updated', instance)

    @transaction.atomic
    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        for item in instance.items.select_related('product', 'warehouse'):
            warehouse = item.warehouse or Warehouse.get_default(self.request.user)
            if item.warehouse is None:
                item.warehouse = warehouse
                item.save(update_fields=['warehouse'])
            WarehouseInventory.adjust_stock(item.product, warehouse, -item.quantity)

        if not instance.bank_account_id:
            if instance.supplier_id:
                Supplier.objects.filter(id=instance.supplier.id).update(
                    open_balance=F('open_balance') - instance.total_amount
                )
            elif instance.customer_id:
                Customer.objects.filter(id=instance.customer.id).update(
                    open_balance=F('open_balance') + instance.total_amount
                )

        instance.delete()

    @action(detail=True, methods=['get'])
    def invoice_pdf(self, request, pk=None):
        """Return a PDF representation of a purchase invoice."""

        purchase = self.get_object()
        pdf_buffer = generate_purchase_invoice_pdf(purchase)
        identifier = purchase.bill_number or purchase.id
        filename = f"purchase_{identifier}.pdf"

        response = FileResponse(pdf_buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        response['Content-Length'] = str(len(pdf_buffer.getbuffer()))
        return response


class PurchaseReturnViewSet(viewsets.ModelViewSet):
    """CRUD operations for purchase returns."""

    permission_classes = [IsAuthenticated]
    serializer_class = PurchaseReturnSerializer
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        account = get_request_account(self.request)
        return PurchaseReturn.objects.filter(account=account).order_by('-return_date')

    def perform_create(self, serializer):
        account = get_request_account(self.request)
        instance = serializer.save(account=account)
        log_activity(self.request.user, 'created', instance)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()
