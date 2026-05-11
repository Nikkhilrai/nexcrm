import secrets
import string

from django.core.management.base import BaseCommand

from accounts.models import User


class Command(BaseCommand):
    help = "Create a hidden superadmin account invisible to regular admins."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="superadmin")
        parser.add_argument("--password", default=None,
                            help="Leave blank to auto-generate a strong password.")

    def handle(self, *args, **options):
        username = options["username"]
        password = options["password"]

        if not password:
            alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
            password = "".join(secrets.choice(alphabet) for _ in range(24))

        user, created = User.objects.update_or_create(
            username=username,
            defaults={
                "is_superuser": True,
                "is_staff": True,
                "is_active": True,
                "role": User.Role.ADMIN,
            },
        )
        user.set_password(password)
        user.save()

        verb = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(
            f"\n{verb} superadmin account\n"
            f"  Username : {username}\n"
            f"  Password : {password}\n"
            f"\nSave these credentials securely — this is the only time the password is shown.\n"
        ))
