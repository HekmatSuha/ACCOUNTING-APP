"""Product related API views."""

from rest_framework import viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated

from ..activity_logger import log_activity
from ..models import Product
from ..serializers import ProductSerializer


class ProductViewSet(viewsets.ModelViewSet):
    """CRUD operations for products."""

    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return (
            self.request.user.products.all()
            .prefetch_related('warehouse_stocks__warehouse')
            .order_by('name')
        )

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        log_activity(self.request.user, 'created', instance)
