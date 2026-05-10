import os

from celery import Celery
from celery.signals import task_prerun

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

app = Celery("mantranex")

# All Celery config lives in settings.py under the CELERY_ namespace.
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks from every installed app's tasks.py
app.autodiscover_tasks()


@task_prerun.connect
def close_old_db_connections(**kwargs):
    """Close stale DB connections before each task.

    Neon free tier drops idle connections after ~5 minutes. Without this,
    long-idle Celery workers get OperationalError on the first DB hit.
    CONN_MAX_AGE=0 in DATABASES ensures no pooling; this signal handles
    any connections opened during the task dispatch phase itself.
    """
    from django.db import connection
    connection.close()
