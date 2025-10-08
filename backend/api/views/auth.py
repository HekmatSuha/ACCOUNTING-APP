"""Authentication and user management views."""

from django.contrib.auth.models import User
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from ..serializers import (
    ChangePasswordSerializer,
    UserProfileSerializer,
    UserSerializer,
)


class CreateUserView(generics.CreateAPIView):
    """Allow creation of new user accounts."""

    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]


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
