"""Purchase related API views."""

from django.db import transaction
from django.db.models import F
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from ..activity_logger import log_activity
from ..models import Customer, Product, Purchase, PurchaseReturn, Supplier
from ..serializers import (
    PurchaseReadSerializer,
    PurchaseReturnSerializer,
    PurchaseWriteSerializer,
)


class PurchaseViewSet(viewsets.ModelViewSet):
    """CRUD operations for purchases."""

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ['create', 'update']:
            return PurchaseWriteSerializer
        return PurchaseReadSerializer

    def get_queryset(self):
        return self.request.user.purchases.all().order_by('-purchase_date')

    def perform_create(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'created', instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'updated', instance)

    @transaction.atomic
    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        for item in instance.items.all():
            Product.objects.filter(id=item.product.id).update(
                stock_quantity=F('stock_quantity') - item.quantity
            )

        if not instance.account_id:
            if instance.supplier_id:
                Supplier.objects.filter(id=instance.supplier.id).update(
                    open_balance=F('open_balance') - instance.total_amount
                )
            elif instance.customer_id:
                Customer.objects.filter(id=instance.customer.id).update(
                    open_balance=F('open_balance') + instance.total_amount
                )

        instance.delete()


class PurchaseReturnViewSet(viewsets.ModelViewSet):
    """CRUD operations for purchase returns."""

    permission_classes = [IsAuthenticated]
    serializer_class = PurchaseReturnSerializer
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        return PurchaseReturn.objects.filter(purchase__created_by=self.request.user).order_by('-return_date')

    def perform_create(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'created', instance)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()
