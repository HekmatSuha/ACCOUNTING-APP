"""Customer related API views."""

from django.db.models import Sum
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import NotFound
from rest_framework.filters import SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..activity_logger import log_activity
from ..models import Customer, Payment
from ..report_exports import (
    generate_customer_balance_pdf,
    generate_customer_balance_workbook,
)
from ..serializers import (
    CustomerBalanceReportSerializer,
    CustomerSerializer,
    PaymentSerializer,
    PurchaseReadSerializer,
    SaleReadSerializer,
)


class CustomerViewSet(viewsets.ModelViewSet):
    """CRUD operations for customers."""

    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter]
    search_fields = ['name', 'email', 'phone']

    def get_queryset(self):
        return self.request.user.customers.all().order_by('-created_at')

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
        customer = self.get_object()
        sales = customer.sales.all().order_by('-sale_date')
        payments = customer.payments.all().order_by('-payment_date')
        purchases = customer.purchases.all().order_by('-purchase_date')

        total_turnover = sales.aggregate(Sum('total_amount'))['total_amount__sum'] or 0.00

        data = {
            'customer': CustomerSerializer(customer).data,
            'sales': SaleReadSerializer(sales, many=True).data,
            'payments': PaymentSerializer(payments, many=True).data,
            'purchases': PurchaseReadSerializer(purchases, many=True).data,
            'summary': {
                'open_balance': customer.open_balance,
                'check_balance': 0.00,  # Placeholder
                'note_balance': 0.00,  # Placeholder
                'turnover': total_turnover,
            },
        }
        return Response(data)


class CustomerPaymentViewSet(viewsets.ModelViewSet):
    """Handle payments scoped to a customer."""

    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        customer_pk = self.kwargs.get('customer_pk')
        if customer_pk:
            try:
                customer = Customer.objects.get(pk=customer_pk, created_by=self.request.user)
                context['customer'] = customer
            except Customer.DoesNotExist:
                pass
        return context

    def get_queryset(self):
        customer_pk = self.kwargs.get('customer_pk')
        return Payment.objects.filter(customer__id=customer_pk, created_by=self.request.user)

    def perform_create(self, serializer):
        customer_pk = self.kwargs.get('customer_pk')
        try:
            customer = Customer.objects.get(pk=customer_pk, created_by=self.request.user)
            instance = serializer.save(
                created_by=self.request.user,
                customer=customer,
            )
            log_activity(self.request.user, 'created', instance)
        except Customer.DoesNotExist:
            raise NotFound(detail="Customer not found.")

    def perform_update(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'updated', instance)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def customer_balance_report(request):
    """Return a simplified customer balance report for the current user."""

    queryset = Customer.objects.filter(created_by=request.user).order_by('name')
    serializer = CustomerBalanceReportSerializer(queryset, many=True)
    data = serializer.data

    export_format = request.query_params.get('export_format')
    if not export_format:
        export_format = request.query_params.get('format')
    export_format = (export_format or '').lower()
    filename_stub = 'customer-balance-report'

    if export_format in {'xlsx', 'excel'}:
        workbook_bytes = generate_customer_balance_workbook(data)
        response = HttpResponse(
            workbook_bytes,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename_stub}.xlsx"'
        return response

    if export_format == 'pdf':
        pdf_bytes = generate_customer_balance_pdf(data)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename_stub}.pdf"'
        return response

    return Response(data)
