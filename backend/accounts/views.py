from rest_framework import permissions, viewsets
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import User
from .permissions import IsAdmin
from .serializers import TokenLoginSerializer, UserAdminSerializer, UserSerializer


class LoginView(TokenObtainPairView):
    """POST {username, password} → {access, refresh, user}."""

    serializer_class = TokenLoginSerializer


class MeView(APIView):
    """GET → currently authenticated user."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UserAdminViewSet(viewsets.ModelViewSet):
    """Admin-only user management.

    - GET / POST / PATCH / PUT supported
    - DELETE blocked — deactivate via PATCH {is_active: false} instead.
    - Superadmin accounts (is_superuser=True) are excluded from all
      queryset results and cannot be created or modified via this API.
    """

    serializer_class = UserAdminSerializer
    permission_classes = (IsAdmin,)
    pagination_class = None
    http_method_names = ("get", "post", "patch", "put", "head", "options")
    search_fields = ("username", "email", "first_name", "last_name")
    filterset_fields = ("role", "is_active")

    def get_queryset(self):
        # Superadmin accounts are completely invisible through this API.
        return User.objects.filter(is_superuser=False).order_by("-date_joined")

    def get_object(self):
        obj = super().get_object()
        if obj.is_superuser:
            raise NotFound()
        return obj
