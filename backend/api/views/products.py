"""Product related API views."""

from datetime import date

from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
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
