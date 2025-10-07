"""Authentication and user management views."""

from django.contrib.auth.models import User
from rest_framework import generics
from rest_framework.permissions import AllowAny

from ..serializers import UserSerializer


class CreateUserView(generics.CreateAPIView):
    """Allow creation of new user accounts."""

    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]
