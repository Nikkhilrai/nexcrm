from rest_framework import permissions, viewsets
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
      Hard-deleting a user breaks audit trails (created_by, changed_by FKs
      go to NULL). Use Django admin for the rare hard-delete case.
    """

    queryset = User.objects.all().order_by("-date_joined")
    serializer_class = UserAdminSerializer
    permission_classes = (IsAdmin,)
    pagination_class = None  # ~5 users, no pagination needed
    http_method_names = ("get", "post", "patch", "put", "head", "options")
    search_fields = ("username", "email", "first_name", "last_name")
    filterset_fields = ("role", "is_active")
