from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import LoginView, MeView, UserAdminViewSet

# Public auth routes — mounted under /api/auth/
auth_urlpatterns = [
    path("login/", LoginView.as_view(), name="auth_login"),
    path("refresh/", TokenRefreshView.as_view(), name="auth_refresh"),
    path("me/", MeView.as_view(), name="auth_me"),
]

# Admin user management — mounted under /api/ → /api/users/
admin_router = DefaultRouter()
admin_router.register(r"users", UserAdminViewSet, basename="user")
admin_urlpatterns = admin_router.urls

# Default export keeps backwards compat for the existing /api/auth/ include.
urlpatterns = auth_urlpatterns
