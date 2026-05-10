from django.apps import AppConfig


class LeadsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "leads"

    def ready(self) -> None:
        # Importing signals connects the @receiver decorators.
        from . import signals  # noqa: F401
