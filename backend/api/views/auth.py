"""Authentication and user management views."""

from django.contrib.auth.models import User
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated
from rest_framework.response import Response

from ..serializers import (
    AccountUserSerializer,
    InvitationAcceptanceSerializer,
    ChangePasswordSerializer,
    PublicAccountRegistrationSerializer,
    UserProfileSerializer,
)
from ..models import Account, AccountInvitation


class PublicRegistrationView(generics.GenericAPIView):
    """Allow anyone to register and provision a new account."""

    serializer_class = PublicAccountRegistrationSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        payload = dict(serializer.data)
        payload['detail'] = 'Account created successfully. You can now sign in.'
        return Response(payload, status=status.HTTP_201_CREATED)


class IsStaffOrAccountAdmin(BasePermission):
    """Allow access for Django staff or account administrators/owners."""

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        if user.is_staff:
            return True
        account = Account.for_user(user)
        if not account:
            return False
        membership = account.memberships.filter(user=user, is_active=True).first()
        if not membership:
            return False
        return membership.is_owner or membership.is_admin


class AccountUserManagementView(generics.GenericAPIView):
    """Allow staff or account owners to create users or invitations."""

    serializer_class = AccountUserSerializer
    permission_classes = [IsAuthenticated, IsStaffOrAccountAdmin]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        status_code = status.HTTP_201_CREATED
        data = serializer.to_representation(instance)
        return Response(data, status=status_code)


class InvitationDetailView(generics.GenericAPIView):
    """Provide metadata about an invitation for public invite screens."""

    permission_classes = [AllowAny]

    def get(self, request, token, *args, **kwargs):
        try:
            invitation = AccountInvitation.objects.select_related('account').get(
                token=token,
                is_active=True,
            )
        except AccountInvitation.DoesNotExist:
            return Response({'detail': 'Invitation not found or expired.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            {
                'email': invitation.email,
                'account': {
                    'id': invitation.account_id,
                    'name': invitation.account.name,
                    'slug': invitation.account.slug,
                },
                'is_admin': invitation.is_admin,
                'is_billing_manager': invitation.is_billing_manager,
            }
        )


class InvitationAcceptanceView(generics.GenericAPIView):
    """Allow invited users to activate their account by setting credentials."""

    serializer_class = InvitationAcceptanceSerializer
    permission_classes = [AllowAny]

    def post(self, request, token, *args, **kwargs):
        data = request.data.copy()
        data['token'] = token
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        membership = serializer.save()
        return Response(
            {
                'detail': 'Invitation accepted successfully.',
                'account': membership.account_id,
            },
            status=status.HTTP_200_OK,
        )


class CurrentUserView(generics.RetrieveUpdateAPIView):
    """Retrieve or update the authenticated user's profile information."""

    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(generics.GenericAPIView):
    """Allow the authenticated user to update their password."""

    serializer_class = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save()

        return Response({'detail': 'Password updated successfully.'}, status=status.HTTP_200_OK)
