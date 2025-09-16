"""Views for managing company information and settings."""

from rest_framework import viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import CompanyInfo, CompanySettings
from ..serializers import CompanyInfoSerializer, CompanySettingsSerializer


class CompanyInfoViewSet(viewsets.GenericViewSet):
    """Viewset for viewing and editing the singleton CompanyInfo instance."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = CompanyInfoSerializer

    def list(self, request, *args, **kwargs):
        """Get the company info instance."""
        instance = CompanyInfo.load()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        """Update the company info instance using POST."""
        instance = CompanyInfo.load()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class CompanySettingsViewSet(viewsets.GenericViewSet):
    """Viewset for retrieving and updating company settings."""

    permission_classes = [IsAuthenticated]
    serializer_class = CompanySettingsSerializer

    def list(self, request, *args, **kwargs):
        instance = CompanySettings.load()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        instance = CompanySettings.load()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
