# LexTalk World CRM — Build Plan

> Canonical product + architecture plan for **mantranex**. This is the source of truth for what we're building and why. For day-to-day step status see [`PROGRESS.md`](PROGRESS.md). CLAUDE.md links to both.

## Context

**Client**: LexTalk World (lextalkworld.in / lextalkworld.com — same business, operated by ClickAway Creators LLP, Surrey BC). They run **paid global legal conferences** (Bangalore Jun 2026, Dubai Sep 9-10 2026, Mumbai Dec 10-11 2026), the **Legal Honor Global Awards**, sponsorships, and a content ecosystem (Counsel Exchange, podcasts, magazine).

**Their sales motion**: 5 in-house callers/SDRs do daily outreach (phone, email, LinkedIn, WhatsApp) to legal professionals — General Counsels, law firm partners, in-house legal heads — to sell **delegate passes, sponsorship slots, and award nominations**. They take consistent follow-ups until the lead converts (buys a pass/sponsorship) or goes cold.

**Pain**: No structured CRM today. Need a tool where 5 users handle ~50–100 leads/day, with an admin who monitors team activity. Future requirement: email automation that auto-sends templated follow-up emails on a schedule.

**Goal of v1**: Replace ad-hoc spreadsheets/WhatsApp chaos with a clean, internal-only CRM — leads in, follow-ups tracked, status history audited, admin sees who's working.

---

## Tech Stack (locked by user)

- **Frontend**: Next.js (App Router) — internal tool, no SEO concerns
- **Backend**: Django 5.1 + Django REST Framework
- **DB**: PostgreSQL on Neon (Singapore region, free tier)
- **Auth**: DRF SimpleJWT — username + password, no email verification, accounts created only from the admin panel
- **Hosting (suggested)**: Vercel (Next.js) + Railway/Render (Django) + Neon (Postgres)
- **Future-ready for email automation**: Celery + Redis (data scaffolds first, sender later)

---

## User Roles & Permissions

| Capability | Admin | Normal User |
|---|---|---|
| View leads | All | All |
| Create leads | ✅ | ✅ |
| Edit leads | ✅ | ✅ |
| Delete leads | ✅ | ❌ |
| View admin dashboard | ✅ | ❌ |
| Create/edit users | ✅ | ❌ |
| Reassign leads | ✅ | ❌ (only own) |

DRF: `IsAdmin` for admin-only endpoints, `IsAdminOrReadUpdate` (custom) for the leads endpoint where USER can do everything except DELETE.

---

## Data Model (Django) — implemented

### `accounts.User` (extends `AbstractUser`)
- `role` — choices: `ADMIN`, `USER`
- *(No targets in v1 — admin eyeballs raw activity. Add `daily_call_target` later for v1.1.)*

### `events.Event`
- `name`, `city`, `country`, `start_date`, `end_date`, `is_active`

### `leads.Lead`
- `id` (UUID)
- `full_name`, `email`, `phone` (indexed)
- `company`, `designation`, `linkedin_url`, `city`, `country`
- `event_interest` — FK to `Event` (one lead = one event; same person × two events = two rows)
- `product_interest` — `DELEGATE_PASS`, `SPONSORSHIP`, `SPEAKER`, `AWARD_NOMINATION`
- `source` — `WEBSITE_FORM`, `LINKEDIN`, `REFERRAL`, `COLD_CALL`, `EMAIL`, `OTHER`
- `status` — `NEW`, `CONTACTED`, `FOLLOWUP_SCHEDULED`, `INTERESTED`, `NEGOTIATION`, `WON`, `LOST`
- `assigned_to` — FK to `User`
- `next_followup_at` (datetime, nullable)
- `deal_value` (decimal, nullable — filled when status = WON)
- `notes` (text)
- `created_by`, `created_at`, `updated_at`
- Indexes: `phone`, `(status, event_interest)`, `(assigned_to, -created_at)`

### `leads.Interaction`
- FK `lead`, FK `user`
- `type` — `CALL`, `EMAIL`, `LINKEDIN`, `WHATSAPP`, `MEETING`, `NOTE`
- `outcome` (short text), `notes` (text)
- `occurred_at` (datetime)
- Index: `(lead, -occurred_at)`

### `leads.StatusHistory`
- FK `lead`, FK `changed_by`
- `from_status`, `to_status`
- `comment` (text — required when status changes via API)
- `changed_at`
- **Auto-created** via Django pre/post-save signal on `Lead.status` change. Comment + actor piped via `lead._status_change_comment` and `lead._status_changed_by`.

### Future: `automation.EmailTemplate` + `automation.ScheduledEmail`
Not yet built. Scaffold when starting Phase 4. Schema in original plan; backend is structured so adding them later requires zero changes elsewhere.

---

## API Endpoints — implemented (Phase 1)

```
POST   /api/auth/login/                    → {access, refresh, user (with role)}
POST   /api/auth/refresh/
GET    /api/auth/me/                       → current user

GET    /api/users/                         (admin only)
POST   /api/users/                         (admin only — creates account)
PATCH  /api/users/{id}/
# DELETE blocked → use is_active=false

GET    /api/events/[?active_only=true]

GET    /api/leads/?status=&event_interest=&product_interest=&source=&assigned_to=&search=&created_after=&created_before=
POST   /api/leads/
GET    /api/leads/{id}/
PATCH  /api/leads/{id}/                    # status_change_comment required if status changes
DELETE /api/leads/{id}/                    (admin only)

GET    /api/leads/by-phone/?phone=&exclude=
GET    /api/leads/{id}/interactions/
POST   /api/leads/{id}/interactions/
GET    /api/leads/{id}/status-history/

GET    /api/admin/dashboard/               (admin only)
GET    /api/admin/user-activity/           (admin only)
```

**Pagination**: cursor pagination on `/api/leads/`, page size 25, ordered by `-created_at`. Drives the infinite-scroll table.

---

## Frontend Pages (Next.js App Router) — Phase 2

```
/login                  → username + password
/                       → redirect by role
/leads                  → user home: filters + paginated table (infinite scroll), "New Lead" button
/leads/new              → blank lead form
/leads/[id]             → edit page with sidebar
/admin                  → admin dashboard (KPIs + per-user activity)
/admin/users            → user management
/admin/users/new
```

### `/leads` (user home)
- **Filters bar**: status (multi), event, product, assigned-to (default = me), date range, free-text search (name/phone/email/company)
- **Table columns**: Name, Company, Phone, Status (color chip), Event, Product, Assigned, Next Follow-up, [Edit ▶]
- **Infinite scroll**: IntersectionObserver hits `/api/leads/?cursor=…` for next page

### `/leads/[id]` — same form for create + edit
**Main panel**: name, email, phone, company, designation, linkedin, city/country, event_interest, product_interest, source, status (with required comment on change), assigned_to (admin only), next_followup_at, deal_value, notes.

**Sidebar** (3 stacked sections):
1. **Past leads from same phone** — card list, click to navigate
2. **Interactions log** — chronological, "Log Call / Email / LinkedIn / WhatsApp / Meeting / Note" button
3. **Status history timeline** — `NEW → CONTACTED (12 Apr, by Ajay): "Picked up, asked for brochure"` style

### `/admin` dashboard
- **Top KPIs**: leads today / this week / this month, conversions, revenue this month, avg time-to-conversion
- **Per-user activity table**: name | calls today | emails today | leads touched today | followups due | conversions this month | revenue this month
- **Charts** (Recharts): leads by status (funnel), leads by event, conversions over last 30 days

### `/admin/users`
- List + create + edit (role flip, password reset, deactivate via `is_active`)

---

## Decisions Locked

- **Revenue**: `deal_value` optional, filled when `WON`. Admin dashboard sums it for "revenue this month".
- **Event interest**: one lead = one event. Same person × two events = two `Lead` rows.
- **Targets / "slacking" detection**: skipped in v1.
- **Conversion timestamp**: uses `StatusHistory.changed_at` for `to_status=WON`, NOT `Lead.updated_at`.
- **DELETE on users**: blocked. Use `is_active=false`.
- **No email verification** on user creation. Admin sets the password directly.

---

## Build Phases

| Phase | Status | What |
|---|---|---|
| 1 — Backend foundation | ✅ Complete | Django + DRF + JWT + all models + APIs + 50 seeded leads |
| 2 — Frontend core | ⏭ Next | Next.js + auth + `/leads` + `/leads/[id]` |
| 3 — Frontend admin | ⏳ | `/admin` dashboard + `/admin/users` |
| 4 — Email automation | ⏳ | `EmailTemplate` + `ScheduledEmail` + Celery beat |
| 5 — Deploy | ⏳ | Vercel + Railway + Neon backups |

---

## Verification — what passing looks like

End-to-end smoke tests, run after each phase ships:

1. **Auth**: admin creates a user → that user logs in → cannot see `/admin` (403) → cannot DELETE a lead via API (403). ✅
2. **Leads list**: load 50+ seeded leads, filter by status=NEW + event=Dubai → rows match. Scroll → next cursor page loads. ✅ (backend; frontend pending)
3. **Edit + history**: change status with comment → reload → status timeline shows the entry with timestamp + user. ✅
4. **Same phone**: 2 leads sharing a phone → open one → sidebar shows the other. ✅
5. **Interactions**: log a call → admin dashboard "calls today" increments for that user. ✅
6. **Revenue**: move a lead to `WON` with `deal_value=50000` → admin dashboard "revenue this month" goes up by 50000. ✅
7. **Automation scaffold** (Phase 4): create an `EmailTemplate` for `CONTACTED` transition → trigger transition → `ScheduledEmail` row created with correct `send_at`. ⏳

---

## Critical files

| Layer | Path | Purpose |
|---|---|---|
| Settings | `backend/core/settings.py` | Postgres via `DATABASE_URL`, JWT, CORS, DRF defaults |
| Auth | `backend/accounts/models.py` | `User` + role enum |
| Auth | `backend/accounts/permissions.py` | `IsAdmin`, `IsAdminOrReadUpdate` |
| Auth | `backend/accounts/views.py`, `serializers.py` | login / refresh / me / user CRUD |
| Leads | `backend/leads/models.py` | `Lead`, `Interaction`, `StatusHistory` |
| Leads | `backend/leads/signals.py` | auto-create `StatusHistory` on status change |
| Leads | `backend/leads/views.py` | `LeadViewSet` + nested actions |
| Leads | `backend/leads/serializers.py`, `filters.py` | list/detail serializers, FilterSet |
| Leads | `backend/leads/management/commands/seed_leads.py` | 50 fake leads, idempotent |
| Events | `backend/events/management/commands/seed_events.py` | 3 real events, idempotent |
| Dashboards | `backend/dashboards/views.py` | KPIs + per-user activity |
| Frontend | `frontend/lib/api.ts` (TODO) | axios client with JWT refresh interceptor |
| Frontend | `frontend/app/leads/page.tsx` (TODO) | filter bar + infinite-scroll table |
| Frontend | `frontend/app/leads/[id]/page.tsx` (TODO) | edit form + sidebar |
| Frontend | `frontend/app/admin/page.tsx` (TODO) | KPI dashboard |
