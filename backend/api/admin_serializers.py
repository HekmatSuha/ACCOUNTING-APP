"""Serializers for the staff-facing admin API."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import serializers

from .models import Account, Subscription, SubscriptionPlan


def _normalise_seat_limit(value: int | None) -> int | None:
    """Return ``None`` for unlimited seats or the provided positive integer."""

    if value is None:
        return None
    if value <= 0:
        return None
    return value


def _account_seat_limit(account: Account) -> int | None:
    subscription = getattr(account, "subscription", None)
    if subscription and subscription.seat_limit is not None:
        return subscription.seat_limit
    if subscription and subscription.plan and subscription.plan.user_limit is not None:
        return subscription.plan.user_limit
    return None


def _subscription_payload(subscription: Subscription | None) -> dict[str, Any]:
    if not subscription:
        return {
            "plan": None,
            "billing_cycle": SubscriptionPlan.BILLING_INTERVAL_MONTHLY,
            "renews_on": None,
        }
    renews_on = subscription.current_period_end
    return {
        "plan": getattr(subscription.plan, "code", None),
        "billing_cycle": subscription.billing_cycle
        if getattr(subscription, "billing_cycle", None)
        else subscription.plan.billing_interval
        if subscription.plan
        else SubscriptionPlan.BILLING_INTERVAL_MONTHLY,
        "renews_on": renews_on.date().isoformat() if renews_on else None,
    }


class AdminAccountCreateSerializer(serializers.Serializer):
    """Validate requests to provision a new customer account."""

    name = serializers.CharField(max_length=255)
    seat_limit = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    plan = serializers.CharField(max_length=50)

    def validate_name(self, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Account name is required.")
        return cleaned

    def validate_plan(self, value: str) -> str:
        cleaned = value.strip().lower()
        if not cleaned:
            raise serializers.ValidationError("Plan code is required.")
        return cleaned

    def create(self, validated_data: dict[str, Any]) -> Account:
        seat_limit = validated_data.get("seat_limit")
        plan_code = validated_data["plan"]
        plan_defaults = {
            "name": plan_code.replace("_", " ").title(),
            "price": Decimal("0"),
            "billing_interval": SubscriptionPlan.BILLING_INTERVAL_MONTHLY,
            "currency": "USD",
            "features": [],
        }
        plan, _ = SubscriptionPlan.objects.get_or_create(code=plan_code, defaults=plan_defaults)

        account = Account.objects.create(name=validated_data["name"].strip())

        Subscription.objects.create(
            account=account,
            plan=plan,
            status=Subscription.STATUS_ACTIVE,
            current_period_start=timezone.now(),
            seats_in_use=0,
            seat_limit=_normalise_seat_limit(seat_limit),
            billing_cycle=plan.billing_interval,
        )
        account.refresh_subscription_usage()
        return account


class AdminAccountListSerializer(serializers.ModelSerializer):
    """Lightweight serializer used for the admin accounts table."""

    seat_limit = serializers.SerializerMethodField()
    seats_used = serializers.SerializerMethodField()
    subscription = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    email_domain = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = [
            "id",
            "name",
            "seat_limit",
            "seats_used",
            "subscription",
            "status",
            "email_domain",
        ]

    def get_seat_limit(self, obj: Account) -> int | None:
        return _account_seat_limit(obj)

    def get_seats_used(self, obj: Account) -> int:
        return obj.seats_in_use

    def get_subscription(self, obj: Account) -> dict[str, Any]:
        subscription = getattr(obj, "subscription", None)
        plan_code = subscription.plan.code if subscription and subscription.plan else None
        return {"plan": plan_code}

    def get_status(self, obj: Account) -> str:
        subscription = getattr(obj, "subscription", None)
        status_value = subscription.status if subscription and subscription.status else "active"
        return status_value.replace("_", " ").title()

    def get_email_domain(self, obj: Account) -> str | None:
        email = None
        if obj.owner and obj.owner.email:
            email = obj.owner.email
        else:
            membership = (
                obj.memberships.filter(is_active=True)
                .select_related("user")
                .order_by("-is_owner", "-is_admin", "user__username")
                .first()
            )
            if membership and membership.user.email:
                email = membership.user.email
        if not email:
            return None
        parts = email.split("@")
        if len(parts) != 2:
            return None
        return parts[-1].lower()


class AdminAccountDetailSerializer(AdminAccountListSerializer):
    owner_name = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()

    class Meta(AdminAccountListSerializer.Meta):
        fields = AdminAccountListSerializer.Meta.fields + ["owner_name", "members"]

    def get_owner_name(self, obj: Account) -> str | None:
        owner = obj.owner
        if not owner:
            return None
        full_name = owner.get_full_name().strip()
        return full_name or owner.username

    def get_subscription(self, obj: Account) -> dict[str, Any]:
        subscription = getattr(obj, "subscription", None)
        data = _subscription_payload(subscription)
        if subscription and subscription.plan:
            data["plan_name"] = subscription.plan.name
        return data

    def get_members(self, obj: Account) -> list[dict[str, Any]]:
        memberships = obj.memberships.filter(is_active=True).select_related("user")
        results: list[dict[str, Any]] = []
        for membership in memberships:
            user: User = membership.user
            display_name = (user.get_full_name() or "").strip() or user.username
            if membership.is_owner:
                role = "Owner"
            elif membership.is_admin:
                role = "Admin"
            elif membership.is_billing_manager:
                role = "Billing manager"
            else:
                role = "Member"
            results.append(
                {
                    "id": membership.id,
                    "username": user.username,
                    "name": display_name,
                    "email": user.email,
                    "role": role,
                }
            )
        return results


class AdminAccountUpdateSerializer(serializers.Serializer):
    seat_limit = serializers.IntegerField(min_value=0)

    def update(self, instance: Account, validated_data: dict[str, Any]) -> Account:
        seat_limit = _normalise_seat_limit(validated_data.get("seat_limit"))
        subscription = getattr(instance, "subscription", None)
        if not subscription:
            subscription = Subscription.objects.create(
                account=instance,
                plan=None,
                status=Subscription.STATUS_ACTIVE,
                current_period_start=timezone.now(),
                seats_in_use=instance.seats_in_use,
                seat_limit=seat_limit,
                billing_cycle=SubscriptionPlan.BILLING_INTERVAL_MONTHLY,
            )
        else:
            subscription.seat_limit = seat_limit
            subscription.save(update_fields=["seat_limit", "updated_at"])
        instance.refresh_subscription_usage()
        return instance


class AdminSubscriptionUpdateSerializer(serializers.Serializer):
    plan = serializers.CharField(max_length=50)
    billing_cycle = serializers.ChoiceField(choices=SubscriptionPlan.BILLING_INTERVAL_CHOICES)

    def validate_plan(self, value: str) -> SubscriptionPlan:
        cleaned = value.strip().lower()
        if not cleaned:
            raise serializers.ValidationError("Plan code is required.")
        defaults = {
            "name": cleaned.replace("_", " ").title(),
            "price": Decimal("0"),
            "billing_interval": SubscriptionPlan.BILLING_INTERVAL_MONTHLY,
            "currency": "USD",
            "features": [],
        }
        plan, _ = SubscriptionPlan.objects.get_or_create(code=cleaned, defaults=defaults)
        return plan

    def update(self, instance: Account, validated_data: dict[str, Any]) -> Subscription:
        subscription = getattr(instance, "subscription", None)
        if not subscription:
            subscription = Subscription(account=instance)
        plan = validated_data["plan"]
        billing_cycle = validated_data["billing_cycle"]
        subscription.plan = plan
        subscription.billing_cycle = billing_cycle
        if plan.billing_interval != billing_cycle:
            plan.billing_interval = billing_cycle
            plan.save(update_fields=["billing_interval"])
        if subscription.pk:
            subscription.save(update_fields=["plan", "billing_cycle", "updated_at"])
        else:
            subscription.status = Subscription.STATUS_ACTIVE
            subscription.current_period_start = timezone.now()
            subscription.save()
        return subscription


class AdminPlanSerializer(serializers.ModelSerializer):
    billing_cycle = serializers.ChoiceField(
        choices=SubscriptionPlan.BILLING_INTERVAL_CHOICES,
        source="billing_interval",
    )
    seat_limit = serializers.IntegerField(
        source="user_limit",
        allow_null=True,
        required=False,
        min_value=0,
    )
    features = serializers.ListField(
        child=serializers.CharField(),
        allow_empty=True,
        required=False,
    )

    class Meta:
        model = SubscriptionPlan
        fields = ["name", "price", "currency", "billing_cycle", "seat_limit", "features"]

    def to_representation(self, instance: SubscriptionPlan) -> dict[str, Any]:
        data = super().to_representation(instance)
        data["seat_limit"] = instance.user_limit
        data["features"] = instance.features or []
        return data

    def update(self, instance: SubscriptionPlan, validated_data: dict[str, Any]) -> SubscriptionPlan:
        if "user_limit" in validated_data:
            seat_limit = validated_data.pop("user_limit")
            instance.user_limit = _normalise_seat_limit(seat_limit)
        if "features" in validated_data:
            instance.features = validated_data.pop("features") or []
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
