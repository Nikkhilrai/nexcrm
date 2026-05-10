# Mantranex — LexTalk World CRM

Internal CRM for **LexTalk World** (lextalkworld.in) — a global legal-events business operated by ClickAway Creators LLP. Used by 5 in-house SDRs to manage outreach, follow-ups, and conversions for delegate passes, sponsorships, and award nominations across events in Bangalore, Dubai, and Mumbai.

## Stack

- **Frontend**: Next.js (App Router) — `frontend/` *(Phase 2, not started)*
- **Backend**: Django 5.1 + DRF — `backend/`
- **DB**: PostgreSQL on Neon (Singapore)
- **Auth**: JWT (SimpleJWT) — username + password, accounts created by admin only

## Project structure

```
mantranex/
├── CLAUDE.md             onboarding for any Claude session
├── README.md             you are here
├── docs/
│   └── PLAN.md           canonical product + architecture plan
├── backend/              Django REST API (Phase 1 complete)
└── frontend/             Next.js app (Phase 2 — empty)
```

## Status

✅ **Phase 1 — Backend foundation: complete.** All API endpoints live, 50 fake leads seeded, end-to-end tested against Neon.

⏭ **Phase 2 — Frontend: next.** Brand audit + Next.js scaffold + auth + leads home + edit page + admin dashboard.

See [`docs/PLAN.md`](docs/PLAN.md) for the full plan and [`CLAUDE.md`](CLAUDE.md) for the current onboarding state.

## Local setup

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # fill in DATABASE_URL + SECRET_KEY
python manage.py migrate
python manage.py seed_events
python manage.py seed_leads
python manage.py runserver
```

API at `http://localhost:8000/`. Django admin at `/admin/`.

Detailed setup in [`backend/README.md`](backend/README.md).

## Roles

- **Admin** — full CRUD, user management, dashboard with team activity
- **User** — create / view / edit leads + log interactions; cannot delete

## Test users (DEV only)

| Username | Password | Role |
|---|---|---|
| `admin` | `ChangeMe123!` | ADMIN |
| `caller1` | `caller1pass` | USER |

⚠️ Rotate before pushing this repo to a public remote.
