"""Serializers for the staff-facing admin API."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.contrib.auth import password_validation
from django.contrib.auth.models import User
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import serializers

from .models import Account, AccountMembership, Subscription, SubscriptionPlan


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
    owner_email = serializers.EmailField(required=False, allow_blank=True)
    owner_username = serializers.CharField(max_length=150, required=False, allow_blank=True)
    owner_password = serializers.CharField(required=False, allow_blank=True, write_only=True)
    owner_is_admin = serializers.BooleanField(required=False)
    owner_is_billing_manager = serializers.BooleanField(required=False)

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

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        owner_username = (attrs.get("owner_username") or "").strip()
        owner_email = (attrs.get("owner_email") or "").strip()
        owner_password = attrs.get("owner_password") or ""
        role_fields = [
            attrs.get("owner_is_admin"),
            attrs.get("owner_is_billing_manager"),
        ]

        if owner_username:
            attrs["owner_username"] = owner_username
        if owner_email:
            attrs["owner_email"] = owner_email

        if owner_password and not owner_username:
            raise serializers.ValidationError(
                {"owner_username": "Username is required when setting a password."}
            )

        if (owner_email or owner_password or any(value is not None for value in role_fields)) and not owner_username:
            raise serializers.ValidationError(
                {"owner_username": "Username is required when specifying owner details."}
            )

        if owner_password:
            try:
                user_for_validation = User.objects.get(username=owner_username)
            except (User.DoesNotExist, ValueError):
                user_for_validation = User(
                    username=owner_username or "",
                    email=owner_email or "",
                )
            else:
                if owner_email:
                    user_for_validation.email = owner_email
            password_validation.validate_password(owner_password, user=user_for_validation)

        return attrs

    def create(self, validated_data: dict[str, Any]) -> Account:
        seat_limit = validated_data.get("seat_limit")
        plan_code = validated_data["plan"]
        owner_email = validated_data.pop("owner_email", "") or ""
        owner_username = validated_data.pop("owner_username", "") or ""
        owner_password = validated_data.pop("owner_password", "") or ""
        owner_is_admin = validated_data.pop("owner_is_admin", None)
        owner_is_billing_manager = validated_data.pop("owner_is_billing_manager", None)
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
        owner_user: User | None = None
        if owner_username:
            defaults = {"email": owner_email} if owner_email else {}
            owner_user, created = User.objects.get_or_create(
                username=owner_username,
                defaults=defaults,
            )
            updated_fields: list[str] = []
            if owner_email and owner_user.email != owner_email:
                owner_user.email = owner_email
                updated_fields.append("email")
            if owner_password:
                owner_user.set_password(owner_password)
                updated_fields.append("password")
            elif created and not owner_user.has_usable_password():
                owner_user.set_unusable_password()
            if created or updated_fields:
                owner_user.save(update_fields=updated_fields or None)

            account.owner = owner_user
            account.save(update_fields=["owner", "updated_at"])

            AccountMembership.objects.update_or_create(
                account=account,
                user=owner_user,
                defaults={
                    "is_owner": True,
                    "is_admin": owner_is_admin if owner_is_admin is not None else True,
                    "is_billing_manager": bool(owner_is_billing_manager),
                    "is_active": True,
                },
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
    owner = serializers.SerializerMethodField()

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
            "owner",
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

    def get_owner(self, obj: Account) -> dict[str, Any] | None:
        owner = obj.owner
        if not owner:
            return None
        membership = obj.memberships.filter(user=owner, is_active=True).first()
        return {
            "username": owner.username,
            "email": owner.email,
            "is_admin": bool(membership.is_admin) if membership else False,
            "is_billing_manager": bool(membership.is_billing_manager) if membership else False,
        }


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


def _generate_plan_code(name: str) -> str:
    """Create a unique slug code for a subscription plan."""

    base_slug = slugify(name)[:50] or "plan"
    code = base_slug
    suffix = 2
    while SubscriptionPlan.objects.filter(code=code).exists():
        candidate = f"{base_slug}-{suffix}"
        if len(candidate) > 50:
            # Reserve space for the numeric suffix when the base slug is long.
            trimmed_base = base_slug[: max(50 - len(str(suffix)) - 1, 1)]
            candidate = f"{trimmed_base}-{suffix}"
        code = candidate
        suffix += 1
    return code


class AdminPlanSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(read_only=True)
    code = serializers.SlugField(read_only=True)
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
        fields = [
            "id",
            "code",
            "name",
            "price",
            "currency",
            "billing_cycle",
            "seat_limit",
            "features",
        ]

    def to_representation(self, instance: SubscriptionPlan) -> dict[str, Any]:
        data = super().to_representation(instance)
        data["seat_limit"] = instance.user_limit
        data["features"] = instance.features or []
        return data

    def create(self, validated_data: dict[str, Any]) -> SubscriptionPlan:
        seat_limit = validated_data.pop("user_limit", None)
        features = validated_data.pop("features", None)
        plan_name = validated_data.get("name") or "Plan"
        validated_data.setdefault("code", _generate_plan_code(plan_name))
        instance = SubscriptionPlan(**validated_data)
        instance.user_limit = _normalise_seat_limit(seat_limit)
        instance.features = features or []
        instance.save()
        return instance

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
