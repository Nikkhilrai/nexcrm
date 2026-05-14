from django.db.models import QuerySet


def accessible_events(user) -> QuerySet:
    """Return the Event queryset visible to this user.

    - Admins see every event unconditionally.
    - Non-admins see events where they are NOT in hidden_from (blocklist).
      Empty hidden_from = unrestricted (everyone sees it).
    """
    from .models import Event

    if user.role == "ADMIN":
        return Event.objects.all()

    return Event.objects.exclude(hidden_from=user)
