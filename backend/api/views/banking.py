"""Bank account related API views."""

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from ..activity_logger import log_activity
from ..models import BankAccount
from ..serializers import BankAccountSerializer


class BankAccountViewSet(viewsets.ModelViewSet):
    """CRUD operations for bank accounts."""

    serializer_class = BankAccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.request.user.bank_accounts.all().order_by('name')

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        log_activity(self.request.user, 'created', instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_activity(self.request.user, 'updated', instance)

    def perform_destroy(self, instance):
        log_activity(self.request.user, 'deleted', instance)
        instance.delete()
