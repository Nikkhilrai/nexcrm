"""
Django settings for the LexTalk World CRM (core project).

Env-driven via python-decouple — see backend/.env.example for the variables.
"""

from datetime import timedelta
from pathlib import Path

from decouple import Csv, config

BASE_DIR = Path(__file__).resolve().parent.parent

# ─── Security / debug ───────────────────────────────────────
SECRET_KEY = config(
    "DJANGO_SECRET_KEY",
    default="django-insecure-dev-only-change-me-in-prod",
)
DEBUG = config("DJANGO_DEBUG", default=True, cast=bool)
ALLOWED_HOSTS = config("DJANGO_ALLOWED_HOSTS", default="*", cast=Csv())

# ─── Apps ───────────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "django_celery_beat",
    # Local apps
    "accounts",
    "events",
    "leads",
    "emails",
]

AUTH_USER_MODEL = "accounts.User"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # serve static files in production
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"

# ─── Database ───────────────────────────────────────────────
# DATABASE_URL example (Neon):
#   postgresql://user:pass@ep-xxxx.neon.tech/dbname?sslmode=require
# Falls back to local SQLite when DATABASE_URL is unset (handy before Step 3).
DATABASE_URL = config("DATABASE_URL", default="")

if DATABASE_URL:
    from urllib.parse import urlparse

    _u = urlparse(DATABASE_URL)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": _u.path.lstrip("/"),
            "USER": _u.username,
            "PASSWORD": _u.password,
            "HOST": _u.hostname,
            "PORT": _u.port or 5432,
            "OPTIONS": {"sslmode": "require"},
            "CONN_MAX_AGE": 0,  # Neon drops idle connections — always use fresh ones
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# ─── Password validation ────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ─── i18n / tz ──────────────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

# ─── Static ─────────────────────────────────────────────────
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ─── Production security (only when DEBUG=False) ─────────────
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = False   # Nginx handles SSL termination
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# ─── DRF ────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.CursorPagination",
    "PAGE_SIZE": 25,
    "ORDERING": "-created_at",
}

# ─── SimpleJWT ──────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ─── CORS ───────────────────────────────────────────────────
# Frontend dev runs on http://localhost:3000. Add prod domains via env.
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:3000,http://127.0.0.1:3000",
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True

# ─── Email / SMTP + IMAP (Zoho, per-SDR) ────────────────────
# Per-SDR credentials live in UserEmailCredential (DB).
# These settings define the Zoho server config used for all SDRs.
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = config("EMAIL_HOST", default="smtp.gmail.com")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
EMAIL_HOST_USER = ""       # not used — per-SDR credentials from DB
EMAIL_HOST_PASSWORD = ""   # not used — per-SDR credentials from DB
DEFAULT_FROM_EMAIL = "LexTalk World <noreply@lextalkworld.in>"

IMAP_HOST = config("IMAP_HOST", default="imap.gmail.com")
IMAP_PORT = config("IMAP_PORT", default=993, cast=int)

# macOS Python ships without system CA certs; point it at certifi's bundle.
# macOS Python ships without system CA certs; patch ssl to use certifi's bundle.
import certifi as _certifi, ssl as _ssl
_orig_ctx = _ssl.create_default_context
def _certifi_ctx(*a, **kw):
    kw.setdefault("cafile", _certifi.where())
    return _orig_ctx(*a, **kw)
_ssl.create_default_context = _certifi_ctx

# ─── Celery ─────────────────────────────────────────────────
CELERY_BROKER_URL = config("CELERY_BROKER_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = config("CELERY_RESULT_BACKEND", default="redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE  # Asia/Kolkata — matches the rest of the app
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"
