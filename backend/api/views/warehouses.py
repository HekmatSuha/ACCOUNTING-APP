"""Warehouse related API views."""

from decimal import Decimal

from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated

from ..activity_logger import log_activity
from ..models import Warehouse
from ..serializers import WarehouseDetailSerializer, WarehouseSerializer


class WarehouseViewSet(viewsets.ModelViewSet):
    """CRUD operations for warehouses and their inventory."""

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Warehouse.objects.filter(created_by=self.request.user)
            .prefetch_related('stocks__product')
            .order_by('name')
        )

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return WarehouseDetailSerializer
        return WarehouseSerializer

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        log_activity(self.request.user, 'created', instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'updated', instance)

    def perform_destroy(self, instance):
        if instance.stocks.filter(quantity__gt=Decimal('0')).exists():
            raise serializers.ValidationError(
                'Cannot delete a warehouse while it still contains stock.'
            )
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()
