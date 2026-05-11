from rest_framework import permissions

SAFE_OR_WRITE_METHODS = ("GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH")


def _is_elevated(user) -> bool:
    """True for both ADMIN-role users and hidden superadmin accounts."""
    return bool(
        user
        and user.is_authenticated
        and (getattr(user, "is_admin_role", False) or getattr(user, "is_superuser", False))
    )


class IsAdmin(permissions.BasePermission):
    """Allow ADMIN-role users and superadmin accounts."""

    message = "Admin role required."

    def has_permission(self, request, view) -> bool:
        return _is_elevated(request.user)


class IsAdminOrReadUpdate(permissions.BasePermission):
    """Authenticated users can read, create, and update.
    Only admins (or superadmin) can delete.
    """

    message = "Only admins can delete this resource."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in SAFE_OR_WRITE_METHODS:
            return True
        return _is_elevated(user)
