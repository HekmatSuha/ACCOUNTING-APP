"""Product related API views."""

from datetime import date
from decimal import Decimal, InvalidOperation
import re

from django.db.models import Sum
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..activity_logger import log_activity
from ..models import Product
from ..report_exports import (
    generate_inventory_report_pdf,
    generate_inventory_report_workbook,
)
from ..serializers import ProductSerializer
from .utils import get_request_account


class ProductViewSet(viewsets.ModelViewSet):
    """CRUD operations for products."""

    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        account = get_request_account(self.request)
        return (
            Product.objects.filter(account=account)
            .prefetch_related('warehouse_stocks__warehouse')
            .order_by('name')
        )

    def perform_create(self, serializer):
        account = get_request_account(self.request)
        instance = serializer.save(created_by=self.request.user, account=account)
        log_activity(self.request.user, 'created', instance)

    @action(detail=False, methods=['get'], url_path='suggest-sku')
    def suggest_sku(self, request):
        account = get_request_account(request)
        if not account:
            return Response({'detail': 'Account not found.'}, status=400)

        source = request.query_params.get('category') or request.query_params.get('name') or ''
        prefix = ''.join(ch for ch in source.upper() if ch.isalnum())
        if not prefix:
            prefix = 'PRD'
        prefix = prefix[:4] if len(prefix) > 4 else prefix
        if len(prefix) < 3:
            prefix = (prefix + 'PRD')[:3]

        pattern = re.compile(rf'^{re.escape(prefix)}-?(\d+)$', re.IGNORECASE)
        existing = Product.objects.filter(account=account, sku__istartswith=prefix)
        max_number = 0
        max_width = 3
        for sku in existing.values_list('sku', flat=True):
            if not sku:
                continue
            match = pattern.match(sku.strip().upper())
            if match:
                numeric_part = match.group(1)
                max_number = max(max_number, int(numeric_part))
                max_width = max(max_width, len(numeric_part))

        next_number = max_number + 1 if max_number else 1
        width = max(3, max_width)
        candidate = f"{prefix}-{next_number:0{width}d}"
        while Product.objects.filter(account=account, sku=candidate).exists():
            next_number += 1
            candidate = f"{prefix}-{next_number:0{width}d}"

        return Response({'sku': candidate, 'prefix': prefix, 'sequence': next_number})

    @action(detail=False, methods=['get'], url_path='suggest-price')
    def suggest_price(self, request):
        raw_purchase = request.query_params.get('purchase_price') or '0'
        raw_margin = request.query_params.get('target_margin')

        try:
            purchase_price = Decimal(str(raw_purchase))
        except (InvalidOperation, TypeError, ValueError):
            return Response({'detail': 'Invalid purchase_price value.'}, status=400)

        margin_percent = None
        if raw_margin is not None:
            try:
                margin_percent = Decimal(str(raw_margin))
            except (InvalidOperation, TypeError, ValueError):
                return Response({'detail': 'Invalid target_margin value.'}, status=400)

        if margin_percent is None:
            if purchase_price < Decimal('50'):
                margin_percent = Decimal('40')
            elif purchase_price < Decimal('200'):
                margin_percent = Decimal('30')
            else:
                margin_percent = Decimal('20')

        margin_ratio = margin_percent / Decimal('100')
        suggested_price = (purchase_price * (Decimal('1') + margin_ratio)).quantize(Decimal('0.01'))

        return Response(
            {
                'suggested_price': str(suggested_price),
                'margin_percent': str(margin_percent.quantize(Decimal('0.01'))),
            }
        )

    @action(detail=True, methods=['get'], url_path='total-stock')
    def total_stock(self, request, pk=None):
        product = self.get_object()
        total = product.warehouse_stocks.aggregate(total=Sum('quantity')).get('total') or Decimal('0')
        return Response({'product_id': product.pk, 'total_stock': str(total)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def inventory_report(request):
    """Provide a consolidated inventory report across all warehouses."""

    export_format = request.query_params.get('export_format') or request.query_params.get('format')
    export_format = (export_format or '').lower()

    account = get_request_account(request)

    products = list(
        Product.objects.filter(account=account)
        .prefetch_related('warehouse_stocks__warehouse')
        .order_by('name')
    )

    filename_stub = f"inventory-report-{date.today():%Y-%m-%d}".replace(' ', '_')

    if export_format in {'xlsx', 'excel'}:
        workbook_bytes = generate_inventory_report_workbook(products)
        response = HttpResponse(
            workbook_bytes,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename_stub}.xlsx"'
        return response

    if export_format == 'pdf':
        pdf_bytes = generate_inventory_report_pdf(products)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename_stub}.pdf"'
        return response

    serializer = ProductSerializer(products, many=True, context={'request': request})
    return Response(serializer.data)
