from django.db.models import Q, QuerySet


def accessible_events(user) -> QuerySet:
    """Return the Event queryset visible to this user.

    - Admins see every event unconditionally.
    - Non-admins see events where visible_to is empty (unrestricted)
      OR they are explicitly listed in visible_to.
    """
    from .models import Event

    if user.role == "ADMIN":
        return Event.objects.all()

    return Event.objects.filter(
        Q(visible_to__isnull=True) | Q(visible_to=user)
    ).distinct()
