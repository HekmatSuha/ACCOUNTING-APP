"""Views for the staff-facing admin console."""

from __future__ import annotations

from decimal import Decimal
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from ..admin_serializers import (
    AdminAccountCreateSerializer,
    AdminAccountDetailSerializer,
    AdminAccountListSerializer,
    AdminAccountUpdateSerializer,
    AdminPlanSerializer,
    AdminSubscriptionUpdateSerializer,
    _subscription_payload,
)
from ..models import Account, Subscription, SubscriptionPlan


class AdminAccountViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Endpoints used by staff to manage customer accounts."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        return (
            Account.objects.all()
            .select_related("subscription__plan", "owner")
            .prefetch_related("memberships__user")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.setdefault("request", self.request)
        return context

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = AdminAccountListSerializer(page, many=True, context=self.get_serializer_context())
            return self.get_paginated_response(serializer.data)
        serializer = AdminAccountListSerializer(queryset, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        account = self.get_object()
        serializer = AdminAccountDetailSerializer(account, context=self.get_serializer_context())
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = AdminAccountCreateSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        account = serializer.save()
        account.refresh_from_db()
        list_serializer = AdminAccountListSerializer(account, context=self.get_serializer_context())
        return Response(list_serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        account = self.get_object()
        serializer = AdminAccountUpdateSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        serializer.update(account, serializer.validated_data)
        account.refresh_from_db()
        detail_serializer = AdminAccountDetailSerializer(account, context=self.get_serializer_context())
        return Response(detail_serializer.data)

    @action(detail=True, methods=["post"], url_path="subscription")
    def update_subscription(self, request, pk=None):
        account = self.get_object()
        serializer = AdminSubscriptionUpdateSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        subscription = serializer.update(account, serializer.validated_data)
        account.refresh_from_db()
        payload = _subscription_payload(subscription)
        if subscription.plan:
            payload["plan_name"] = subscription.plan.name
        return Response(payload)

    @action(detail=True, methods=["get", "put"], url_path="plan")
    def plan(self, request, pk=None):
        account = self.get_object()
        subscription = getattr(account, "subscription", None)
        if not subscription:
            subscription = Subscription.objects.create(
                account=account,
                status=Subscription.STATUS_ACTIVE,
                current_period_start=timezone.now(),
                seats_in_use=account.seats_in_use,
                billing_cycle=SubscriptionPlan.BILLING_INTERVAL_MONTHLY,
            )
        plan = subscription.plan
        if not plan:
            plan = SubscriptionPlan.objects.create(
                code=f"account-{account.pk}",
                name=f"{account.name} Plan",
                price=Decimal("0"),
                billing_interval=subscription.billing_cycle or SubscriptionPlan.BILLING_INTERVAL_MONTHLY,
                currency="USD",
                features=[],
            )
            subscription.plan = plan
            subscription.save(update_fields=["plan", "updated_at"])
        if request.method.lower() == "get":
            serializer = AdminPlanSerializer(plan, context=self.get_serializer_context())
            return Response(serializer.data)
        serializer = AdminPlanSerializer(plan, data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        updated_plan = serializer.save()
        return Response(AdminPlanSerializer(updated_plan, context=self.get_serializer_context()).data)


class AdminPlanViewSet(viewsets.ModelViewSet):
    """CRUD endpoints for managing reusable subscription plans."""

    permission_classes = [IsAuthenticated, IsAdminUser]
    serializer_class = AdminPlanSerializer

    def get_queryset(self):
        return SubscriptionPlan.objects.all().order_by("price", "name")
