from rest_framework import permissions

SAFE_OR_WRITE_METHODS = ("GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH")


class IsAdmin(permissions.BasePermission):
    """Allow only authenticated users with role == ADMIN."""

    message = "Admin role required."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "is_admin_role", False)
        )


class IsAdminOrReadUpdate(permissions.BasePermission):
    """Authenticated users can read, create, and update.
    Only admins can delete.

    Matches the role table: USER does CRUD-minus-D; ADMIN does everything.
    Apply this at the viewset level; DRF will call has_permission for each
    request and short-circuit DELETE for non-admins.
    """

    message = "Only admins can delete this resource."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in SAFE_OR_WRITE_METHODS:
            return True
        # DELETE (or any other method) → admin only
        return getattr(user, "is_admin_role", False)
