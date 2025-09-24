"""Activity log related API views."""

import json

from django.core import serializers as django_serializers
from django.db import transaction
from django.db.models import F
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..activity_logger import log_activity
from ..models import (
    Customer,
    Product,
    Purchase,
    Sale,
    Supplier,
    Warehouse,
    WarehouseInventory,
)
from ..serializers import ActivitySerializer


class ActivityViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only access to user activity logs."""

    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        queryset = self.request.user.activities.all().order_by('-timestamp')
        date_str = self.request.query_params.get('date')
        if date_str:
            queryset = queryset.filter(timestamp__date=date_str)
        return queryset

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        activity = self.get_object()
        if activity.action_type != 'deleted' or not activity.object_repr:
            return Response(
                {'status': 'error', 'message': 'This action cannot be undone.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                model_class = activity.content_type.model_class()

                if model_class == Sale:
                    data = json.loads(activity.object_repr)
                    sale_obj = list(django_serializers.deserialize('json', data['sale']))[0]
                    sale_obj.save()
                    restored_sale = sale_obj.object

                    for item_obj in django_serializers.deserialize('json', data['items']):
                        item_obj.object.sale = restored_sale
                        item_obj.save()

                    Customer.objects.filter(pk=restored_sale.customer.pk).update(
                        open_balance=F('open_balance') + restored_sale.total_amount
                    )
                    default_warehouse = Warehouse.get_default(request.user)
                    for item in restored_sale.items.select_related('product', 'warehouse'):
                        warehouse = item.warehouse or default_warehouse
                        if item.warehouse is None:
                            item.warehouse = warehouse
                            item.save(update_fields=['warehouse'])
                        WarehouseInventory.adjust_stock(
                            item.product, warehouse, -item.quantity
                        )

                    log_activity(request.user, 'restored', restored_sale)

                elif model_class == Purchase:
                    data = json.loads(activity.object_repr)
                    purchase_obj = list(django_serializers.deserialize('json', data['purchase']))[0]
                    purchase_obj.save()
                    restored_purchase = purchase_obj.object

                    for item_obj in django_serializers.deserialize('json', data['items']):
                        item_obj.object.purchase = restored_purchase
                        item_obj.save()

                    if not restored_purchase.account_id:
                        Supplier.objects.filter(pk=restored_purchase.supplier.pk).update(
                            open_balance=F('open_balance') + restored_purchase.total_amount
                        )
                    default_warehouse = Warehouse.get_default(request.user)
                    for item in restored_purchase.items.select_related('product', 'warehouse'):
                        warehouse = item.warehouse or default_warehouse
                        if item.warehouse is None:
                            item.warehouse = warehouse
                            item.save(update_fields=['warehouse'])
                        WarehouseInventory.adjust_stock(
                            item.product, warehouse, item.quantity
                        )

                    log_activity(request.user, 'restored', restored_purchase)

                else:
                    deserialized_obj = list(django_serializers.deserialize('json', activity.object_repr))[0]
                    deserialized_obj.save()
                    log_activity(request.user, 'restored', deserialized_obj.object)

                activity.description = f"(Restored) {activity.description}"
                activity.save()

            return Response({'status': 'success', 'message': 'Object restored successfully.'})
        except Exception as exc:  # pylint: disable=broad-except
            return Response(
                {'status': 'error', 'message': f"An unexpected error occurred: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
