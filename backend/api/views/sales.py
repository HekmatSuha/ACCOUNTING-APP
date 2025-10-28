"""Sales related API views and reports."""

from datetime import date

from django.db import transaction
from django.db.models import F
from django.http import FileResponse, HttpResponse
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..activity_logger import log_activity
from ..invoice_pdf import generate_invoice_pdf
from ..models import (
    Customer,
    Offer,
    Payment,
    Product,
    Sale,
    SaleItem,
    SaleReturn,
    Supplier,
    Warehouse,
    WarehouseInventory,
)
from ..report_exports import generate_sales_report_pdf, generate_sales_report_workbook
from ..serializers import (
    OfferReadSerializer,
    OfferWriteSerializer,
    PaymentSerializer,
    SaleReadSerializer,
    SaleReturnSerializer,
    SaleWriteSerializer,
)
from .utils import get_request_account


class SaleViewSet(viewsets.ModelViewSet):
    """CRUD operations for sales."""

    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        read_serializer = SaleReadSerializer(serializer.instance, context=self.get_serializer_context())
        headers = self.get_success_headers(read_serializer.data)
        return Response(read_serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        read_serializer = SaleReadSerializer(serializer.instance, context=self.get_serializer_context())
        return Response(read_serializer.data)

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return SaleWriteSerializer
        return SaleReadSerializer

    def get_queryset(self):
        account = get_request_account(self.request)
        return Sale.objects.filter(account=account).order_by('-sale_date')

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
        customer = instance.customer
        supplier = instance.supplier

        for payment in instance.payments.all():
            payment.delete()

        for item in instance.items.select_related('product', 'warehouse'):
            warehouse = item.warehouse or Warehouse.get_default(self.request.user)
            if item.warehouse is None:
                item.warehouse = warehouse
                item.save(update_fields=['warehouse'])
            WarehouseInventory.adjust_stock(item.product, warehouse, item.quantity)

        if customer:
            Customer.objects.filter(id=customer.id).update(
                open_balance=F('open_balance') - instance.total_amount
            )
        elif supplier:
            Supplier.objects.filter(id=supplier.id).update(
                open_balance=F('open_balance') + instance.total_amount
            )

        instance.delete()

    @action(detail=True, methods=['get'])
    def invoice_pdf(self, request, pk=None):
        """Return a PDF representation of the sale invoice."""

        sale = self.get_object()
        pdf_buffer = generate_invoice_pdf(sale)
        filename = f"invoice_{sale.invoice_number or sale.id}.pdf"

        response = FileResponse(pdf_buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        response['Content-Length'] = str(len(pdf_buffer.getbuffer()))
        return response


class OfferViewSet(viewsets.ModelViewSet):
    """Manage customer offers."""

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return OfferWriteSerializer
        return OfferReadSerializer

    def get_serializer_context(self):
        """Include ``customer_id`` when using nested customer routes."""
        context = super().get_serializer_context()
        customer_pk = self.kwargs.get('customer_pk')
        if customer_pk is not None:
            context['customer_id'] = customer_pk
        return context

    def get_queryset(self):
        account = get_request_account(self.request)
        queryset = Offer.objects.filter(account=account).order_by('-offer_date')
        customer_pk = self.kwargs.get('customer_pk')
        if customer_pk is not None:
            queryset = queryset.filter(customer_id=customer_pk)
        return queryset

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

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != 'pending':
            raise serializers.ValidationError('Only pending offers can be updated.')
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != 'pending':
            raise serializers.ValidationError('Only pending offers can be deleted.')
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def convert_to_sale(self, request, pk=None):
        offer = self.get_object()
        if offer.status != 'pending':
            return Response(
                {'status': 'error', 'message': 'Offer is not pending.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            sale = Sale.objects.create(
                customer=offer.customer,
                sale_date=date.today(),
                total_amount=offer.total_amount,
                details=offer.details,
                created_by=offer.created_by,
                account=offer.account,
            )

            default_warehouse = Warehouse.get_default(request.user)

            for offer_item in offer.items.select_related('product'):
                SaleItem.objects.create(
                    sale=sale,
                    product=offer_item.product,
                    quantity=offer_item.quantity,
                    unit_price=offer_item.unit_price,
                    warehouse=default_warehouse,
                )

                WarehouseInventory.adjust_stock(
                    offer_item.product, default_warehouse, -offer_item.quantity
                )

            Customer.objects.filter(id=offer.customer.id).update(
                open_balance=F('open_balance') + offer.total_amount
            )

            offer.status = 'accepted'
            offer.save()

            log_activity(request.user, 'created', sale, f"Converted from offer #{offer.id}")
            log_activity(request.user, 'updated', offer, "Converted to sale")

        return Response({'status': 'success', 'message': 'Offer converted to sale.', 'sale_id': sale.id})


class PaymentViewSet(viewsets.ModelViewSet):
    """Handle payments scoped to a sale."""

    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        sale_pk = self.kwargs.get('sale_pk')
        if sale_pk:
            try:
                account = get_request_account(self.request)
                sale = Sale.objects.get(pk=sale_pk, account=account)
                context['customer'] = sale.customer
            except Sale.DoesNotExist:
                pass
        return context

    def get_queryset(self):
        sale_pk = self.kwargs.get('sale_pk')
        account = get_request_account(self.request)
        if sale_pk:
            return Payment.objects.filter(sale__id=sale_pk, account=account)
        return Payment.objects.filter(account=account)

    def perform_create(self, serializer):
        sale_pk = self.kwargs.get('sale_pk')
        account = get_request_account(self.request)
        try:
            sale = Sale.objects.get(pk=sale_pk, account=account)
            instance = serializer.save(
                created_by=self.request.user,
                sale=sale,
                customer=sale.customer,
                account=account,
            )
            log_activity(self.request.user, 'created', instance)
        except Sale.DoesNotExist:
            raise NotFound(detail="Sale not found.")

    def perform_update(self, serializer):
        account = get_request_account(self.request)
        instance = serializer.save(account=account)
        log_activity(self.request.user, 'updated', instance)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()


class SaleReturnViewSet(viewsets.ModelViewSet):
    """Handle sale returns."""

    permission_classes = [IsAuthenticated]
    serializer_class = SaleReturnSerializer
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        account = get_request_account(self.request)
        return SaleReturn.objects.filter(account=account).order_by('-return_date')

    def perform_create(self, serializer):
        account = get_request_account(self.request)
        instance = serializer.save(account=account)
        log_activity(self.request.user, 'created', instance)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sales_report(request):
    """Provide a sales report for a given date range."""

    account = get_request_account(request)

    start_date_str = request.query_params.get('start_date', '2000-01-01')
    end_date_str = request.query_params.get('end_date', date.today().strftime('%Y-%m-%d'))

    export_format = request.query_params.get('export_format')
    if not export_format:
        export_format = request.query_params.get('format')
    export_format = (export_format or '').lower()

    sales_in_range = list(
        Sale.objects.filter(
            account=account,
            sale_date__range=[start_date_str, end_date_str],
        )
        .select_related('customer', 'supplier')
        .prefetch_related('items__product')
        .order_by('-sale_date')
    )

    filename_stub = f"sales-report-{start_date_str}-to-{end_date_str}".replace(' ', '_')

    if export_format in {'xlsx', 'excel'}:
        workbook_bytes = generate_sales_report_workbook(sales_in_range, start_date_str, end_date_str)
        response = HttpResponse(
            workbook_bytes,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename_stub}.xlsx"'
        return response

    if export_format == 'pdf':
        pdf_bytes = generate_sales_report_pdf(sales_in_range, start_date_str, end_date_str)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename_stub}.pdf"'
        return response

    serializer = SaleReadSerializer(sales_in_range, many=True)

    return Response(serializer.data)
