from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom user with a coarse role enum.

    Roles drive permissions (see accounts.permissions) — admins can delete
    leads and manage other users; normal users can create/view/update only.
    """

    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        USER = "USER", "User"

    role = models.CharField(
        max_length=8,
        choices=Role.choices,
        default=Role.USER,
    )

    @property
    def is_admin_role(self) -> bool:
        return self.role == self.Role.ADMIN

    def __str__(self) -> str:
        return f"{self.username} ({self.get_role_display()})"
