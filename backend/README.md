# Backend — LexTalk World CRM

Django + Django REST Framework API for the mantranex CRM. **Phase 1 complete** — all endpoints live, tested, and seeded.

## Stack

- **Django 5.1** + **DRF 3.17** + **SimpleJWT** (auth) + **django-filter** + **django-cors-headers**
- **psycopg 3** for PostgreSQL (Neon, Singapore region)
- **python-decouple** for env config

## Local setup

Requires **Python 3.12+**.

```bash
cd backend

# 1. Create virtualenv
python3.12 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure env
cp .env.example .env
# Edit .env — paste your DATABASE_URL from Neon, set DJANGO_SECRET_KEY
# (generate one with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")

# 4. Apply migrations
python manage.py migrate

# 5. Seed reference + fake data
python manage.py seed_events       # 3 LexTalk events (Bangalore / Dubai / Mumbai 2026)
python manage.py seed_leads        # 50 realistic fake leads (idempotent — re-runs are safe)

# 6. Create your admin superuser (or use the dev account in CLAUDE.md)
python manage.py createsuperuser
# Then set role=ADMIN:
python manage.py shell -c "from accounts.models import User; u=User.objects.get(username='YOUR_USER'); u.role='ADMIN'; u.save()"

# 7. Run dev server
python manage.py runserver
```

API at `http://localhost:8000/`. Django admin at `http://localhost:8000/admin/`.

## Env vars

See `.env.example`:
- `DJANGO_SECRET_KEY` — required in any non-trivial setup
- `DJANGO_DEBUG` — `True` for dev
- `DJANGO_ALLOWED_HOSTS` — CSV
- `DATABASE_URL` — Neon connection string. Without it, falls back to local SQLite (`db.sqlite3`)
- `CORS_ALLOWED_ORIGINS` — CSV; defaults to `http://localhost:3000`

## Management commands

| Command | What |
|---|---|
| `python manage.py seed_events` | Idempotent: ensures 3 LexTalk 2026 events exist |
| `python manage.py seed_leads [--count N]` | Idempotent: clears prior fake leads (phone prefix `+9170`) and creates N new ones with realistic pipeline history |
| `python manage.py createsuperuser` | Standard Django — creates a Django admin user. Set `role='ADMIN'` afterwards |

## Project layout

```
backend/
├── core/                   Django project (settings, urls, wsgi)
├── accounts/               Custom User + JWT auth + permissions
│   ├── models.py
│   ├── permissions.py      IsAdmin, IsAdminOrReadUpdate
│   ├── serializers.py      UserSerializer, TokenLoginSerializer, UserAdminSerializer
│   └── views.py
├── events/                 Event model + read-only API
│   └── management/commands/seed_events.py
├── leads/                  Lead, Interaction, StatusHistory
│   ├── models.py
│   ├── signals.py          auto-create StatusHistory on status change
│   ├── filters.py          LeadFilter (status, FK, date ranges)
│   ├── serializers.py
│   ├── views.py            LeadViewSet + by-phone, interactions, status-history actions
│   └── management/commands/seed_leads.py
├── dashboards/             Admin KPI + per-user activity views
│   ├── views.py            DashboardView, UserActivityView
│   └── urls.py
├── manage.py
├── requirements.txt
└── .env.example
```

## API quick-reference

```
# Auth
POST   /api/auth/login/         {username, password} → {access, refresh, user}
POST   /api/auth/refresh/
GET    /api/auth/me/

# Users (admin only)
GET    /api/users/
POST   /api/users/              {username, email, password, role, is_active}
PATCH  /api/users/{id}/

# Events (any auth)
GET    /api/events/[?active_only=true]

# Leads (any auth, DELETE admin-only)
GET    /api/leads/?status=&event_interest=&search=&...
POST   /api/leads/
PATCH  /api/leads/{id}/         # status_change_comment required if status changes
GET    /api/leads/{id}/
DELETE /api/leads/{id}/         # admin only
GET    /api/leads/by-phone/?phone=&exclude=
GET|POST /api/leads/{id}/interactions/
GET    /api/leads/{id}/status-history/

# Admin dashboard (admin only)
GET    /api/admin/dashboard/
GET    /api/admin/user-activity/
```

Cursor pagination on `/api/leads/`, page size 25, ordered by `-created_at`.

## Common gotchas

- **Neon DNS**: some Indian ISPs (Jio observed) refuse `*.neon.tech` lookups. Fix in `CLAUDE.md` §9.
- **Neon free tier cold-start**: first connection after idle takes 2-3s. Subsequent are instant.
- **Custom User model timing**: `AUTH_USER_MODEL = "accounts.User"` must be set before the *very first* migration on a fresh DB.

## Verifying a working install

```bash
# Token round-trip
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"ChangeMe123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access'])")

# Fetch leads
curl -s http://localhost:8000/api/leads/ -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool | head -30

# Dashboard
curl -s http://localhost:8000/api/admin/dashboard/ -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool
```
