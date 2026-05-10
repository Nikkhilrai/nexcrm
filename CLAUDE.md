# CLAUDE.md — Onboarding for Claude

> **For a fresh Claude instance picking up this project**: read this file first. It distills everything you need to be useful immediately.
>
> **Living document**: keep it up to date as decisions change, phases ship, or new gotchas surface. The user has explicitly asked you to update this when something material changes (or when they say "update CLAUDE.md").

---

## 1. Mission

Building **mantranex** — an internal CRM for **LexTalk World** (lextalkworld.in / lextalkworld.com), a global legal-events business operated by ClickAway Creators LLP (Surrey, BC). They run paid conferences (Bangalore Jun 11 2026, Dubai Sep 9-10 2026, Mumbai Dec 10-11 2026), the Legal Honor Global Awards, and sponsorships.

**Their sales motion**: 5 in-house SDRs do daily outreach (phone / email / LinkedIn / WhatsApp) to legal professionals to sell **delegate passes, sponsorship slots, and award nominations**. They take consistent follow-ups until the lead converts or goes cold.

**Pain solved**: Replaces ad-hoc spreadsheets/WhatsApp chaos with a tracked, auditable, role-based CRM.

**Scale**: ~5 users, ~50–100 leads/day. Free-tier hosting comfortably fits.

---

## 2. Tech stack (locked)

| Layer | Choice |
|---|---|
| Frontend | **Next.js (App Router)** — internal tool, no SEO concerns |
| Backend | **Django 5.1 + Django REST Framework** |
| DB | **PostgreSQL on Neon** (Singapore region, free tier) |
| Auth | **DRF SimpleJWT** — username + password, no email verification, accounts created by admin only |
| Python deps | venv + pip (locked in `backend/requirements.txt`) |
| Future | Celery + Redis for email automation (Phase 4 — not yet built, but data models scaffold is ready) |

---

## 3. Workflow rules — non-negotiable

These came from the user explicitly. Follow them.

### Rule 1 — Break each phase into small numbered sub-steps, one per turn.

Don't one-shot a phase. Propose a numbered breakdown, execute one sub-step, summarize, wait for "next" before continuing. The user said: *"we want structured development for quality not a one prompt crm."* Phase 1 ran 13 sub-steps. Phase 2 will be similar.

### Rule 2 — Ask when unclear, don't assume.

For any ambiguous design choice (field semantics, UX flow, naming, third-party choice), use `AskUserQuestion` before committing. The cost of a question is low compared to wrong code.

### Rule 3 — UI must match the lextalkworld.in brand.

It's an internal tool but should feel like part of the same brand. The brand audit has been completed — design tokens, typography, button styles, and component conventions are all locked in [`docs/BRAND.md`](docs/BRAND.md). Read that before writing any UI. Don't ship Tailwind defaults or generic shadcn looks.

---

## 4. State of the world (last updated: 2026-05-08, post-Phase 3.1)

> **Current status + immediate next step live in [`docs/PROGRESS.md`](docs/PROGRESS.md)** — a step-by-step checklist that gets updated every time work ships. Read that first; the summary below is for high-level context.

### ✅ Phase 1 — Backend foundation (complete, 13/13 sub-steps)

| Step | What |
|---|---|
| 1 | Repo scaffold (`backend/`, `frontend/`, `.gitignore`, root README) |
| 2 | Django + DRF + JWT + CORS + django-filter installed; `core` project; `.env.example` |
| 3 | Neon Postgres connected via `DATABASE_URL` (SQLite fallback if unset) |
| 4 | Custom `User` model with `role` enum (ADMIN / USER); migrations on Neon |
| 5 | JWT auth: `/api/auth/login/`, `/refresh/`, `/me/` with role baked into token claims |
| 6 | `IsAdmin` + `IsAdminOrReadUpdate` permission classes |
| 7 | `Event` model + idempotent seed (Bangalore / Dubai / Mumbai); read-only `/api/events/` |
| 8 | `Lead`, `Interaction`, `StatusHistory` models + post-save signal that auto-records every status change |
| 9 | `LeadViewSet` — full CRUD, cursor pagination (page=25), filters (multi-status, FK, date ranges), search on name/phone/email/company, role-gated DELETE |
| 10 | `/api/leads/by-phone/`, nested `/{id}/interactions/`, `/{id}/status-history/` |
| 11 | Admin-only `/api/users/` for create/list/update (DELETE blocked — deactivate via `is_active=false`) |
| 12 | `/api/admin/dashboard/` (KPIs + chart data) and `/api/admin/user-activity/` (per-user counts) |
| 13 | `seed_leads` management command — 50 realistic fake leads with full pipeline history |

**Verification**: every sub-step was tested end-to-end with curl + a Python shell harness. All 70+ scenarios pass.

### ✅ Phase 2 — Frontend (complete, 13/13 sub-steps)

Full step-by-step in [`docs/PROGRESS.md`](docs/PROGRESS.md). Highlights:
- `/login` (JWT, refresh interceptor, role-aware guard) + `(authed)` route group with brand-styled `AppShell`.
- `/leads` — filter bar (debounced search, multi-status, event/product/source/assignee/date filters), cursor-paginated infinite scroll via IntersectionObserver.
- `/leads/new` and `/leads/[id]` — shared `LeadForm` (create + edit). Status flips open a confirm-comment modal that satisfies the backend's `status_change_comment` requirement.
- `/leads/[id]` sidebar — 3 panels: same-phone past leads, interactions log with quick-add modal (call/email/linkedin/whatsapp/meeting/note), status timeline.
- `/admin` — 6 KPI tiles, 3 Recharts (funnel, per-event bar, 30-day conversion line), per-user activity table.
- `/admin/users` — list + create + edit + deactivate (no hard-delete; preserves audit trails).
- Polish — global `error.tsx` + `not-found.tsx`, brand-correct logo aspect ratios, end-to-end smoke tested against seeded data.

### ✅ Phase 2.5 — CRM restructure to match client's sales motion (complete, 12/12)

After demoing v1, the client (LexTalk World) sent restructure requirements (`docs/client_requirements.txt`). Phase 2.5 reshaped the CRM around their actual sales motion. Highlights:

- **5 sub-pipelines** per event: Speakers, Sponsors, Awardees, VIP/Media Partners, Delegate Passes (Exhibitors deferred — flagged for client confirmation).
- **9 stages** per pipeline: Lead Assigned → Call Connected → Info Sent → Follow-Up 1/2/3 → Deal Won / Deal Lost / Declined. Old enum wiped (data was dummy) and re-seeded.
- **`PackageTier` model** — admin-editable list of tiers per sub-pipeline (Platinum/Diamond/Gold for sponsors, etc.). Foundation for the future CMS-style pipeline editor. Seeded from website research.
- **Two views over the same data** *(superseded by Phase 2.6 — see below)*: original layout had Master at `/leads` and the kanban at `/pipelines/[event]/[sub-pipeline]`. The data model is unchanged; only the routing collapsed.
- **Admin tier CRUD** at `/admin/tiers` — sectioned by sub-pipeline, inline activate/deactivate, FK-safe delete (returns clean DRF 400 with "deactivate instead" hint when leads are still attached).
- **AppShell** picked up "Pipelines" + "Tiers" nav links. "Leads" renamed to "Master".

See [`docs/PROGRESS.md`](docs/PROGRESS.md) for the full 12-sub-step checklist.

### ✅ Phase 2.6 — Kanban collapsed onto Master home page (complete, 2/2)

After v1.5, the client wanted both views one click apart on the home page itself — no drill-down, event picker visible on the front. Phase 2.6 delivered exactly that:

- Home (`/leads`) is now the single hub. **Top-right `Board | List` toggle**, default Board.
- Board mode shows two tab rows above the existing 9-column kanban: **events** (Bangalore / Dubai / Mumbai) → **sub-pipelines** (Delegate Passes / Sponsors / Speakers / Awardees / VIP-Media). First tab default-selected. `flex-wrap` so long labels spill onto a second row.
- List mode is today's old `/leads` page exactly as-is (FiltersBar + paginated infinite-scroll table), factored into a `<ListView>` sub-component that only mounts when picked.
- **State lives in URL search params** (`?view=board|list&event=<slug>&pipeline=<slug>`) via `useSearchParams` + `router.replace`. No localStorage; browser-back from a lead detail page restores the exact tabs naturally.
- `/pipelines/...` route tree, the per-pipeline localStorage toggle, and the redundant `KanbanList` component all deleted. "Pipelines" nav link removed.

Critical files: [`frontend/app/(authed)/leads/page.tsx`](frontend/app/(authed)/leads/page.tsx), [`frontend/app/(authed)/leads/components/BoardView.tsx`](frontend/app/(authed)/leads/components/BoardView.tsx), [`frontend/app/(authed)/leads/components/ViewToggle.tsx`](frontend/app/(authed)/leads/components/ViewToggle.tsx), [`frontend/components/AppShell.tsx`](frontend/components/AppShell.tsx).

### ✅ Phase 2.7 — Bigger kanban cards + back-button fix (complete, 1/1)

Cards were too compact for the daily-driver kanban: callers wanted to see the **status note** (the comment captured when the card was moved to its current stage) plus designation + source without clicking in. And opening a lead from Mumbai/Speakers, clicking "Back to leads", was bouncing you to Dubai/Delegate Passes instead of where you came from.

- **Backend** — `LeadListSerializer` now exposes `designation`, `source`, and `latest_status_note: {comment, to_status, changed_at, changed_by_username}`; queryset uses `Prefetch('status_history', ...)` so the latest row is O(1) per lead.
- **Frontend** — `KanbanCard` redesigned with name + designation + company stack, tier + source pills, phone, status-note block (brand-amber left border, `line-clamp-2` truncation, "user · 3d ago"), wider columns (`w-80`).
- **Back-button fix** — `/leads/[id]` swapped its `<Link href="/leads">` for a button calling `router.back()` (with a `/leads` fallback when there's no history). Popping browser history returns to the exact `?view=board&event=…&pipeline=…` URL the user came from instead of pushing a fresh `/leads` that triggered the defaults-fill.

### ✅ Phase 2.9 — Pipelines as a 3-level CMS hierarchy (complete, 12/12)

Client wanted to add new events + new pipelines themselves without a deploy. We turned the static `Lead.ProductInterest` enum into a per-event `SubPipeline` model and made `/admin/tiers` → `/admin/pipelines`, a single page that edits the entire **Event → SubPipeline → Tier** tree.

- **Schema cut-over**: dropped `Lead.product_interest` + `PackageTier.product_interest` enum columns. Added `Lead.sub_pipeline` (FK PROTECT) + `PackageTier.sub_pipeline` (FK CASCADE). Per the locked Phase 2.5 precedent, the cut-over wiped 50 dummy leads + 21 tiers in two migrations (`0006_wipe_for_phase_2_9` + `0007_alter_packagetier_options_and_more`) so the schema rewrite never ran in the same transaction as data deletion (avoids the Postgres "pending trigger events" gotcha — see §9).
- **New backend endpoints**: `/api/sub-pipelines/` full CRUD (admin write, any-auth read, filterable by `?event=&is_active=`); `/api/events/` flipped from read-only to full CRUD with `?with_pipelines=true` returning the event tree with sub-pipelines and tiers nested for the admin page.
- **Cross-event validation**: `LeadDetailSerializer.validate()` rejects `sub_pipeline.event != lead.event_interest`. Verified ("Sub-pipeline 'Delegate Passes' belongs to Dubai, not Mumbai 2027.").
- **Slug auto-derivation**: `SubPipelineSerializer._generate_slug()` slugifies the name and dedupes within the event scope (`base`, `base-2`, `base-3` …). Slug is read-only on the wire.
- **Frontend**: dropped the static `PRODUCT_SLUG_TO_ENUM`, `PRODUCT_ORDER`, `PRODUCT_INTEREST_LABELS`, `ProductInterest` literal type — all replaced by dynamic `/api/sub-pipelines/?event=` lookups via the new `api.subPipelines` client. `LeadForm` cascades Event → SubPipeline → Tier (each clears its descendants on change). `BoardView` tabs come from API rows, keyed by persisted DB slug. `FiltersBar` event filter now cascades into the sub-pipeline filter (event-aware dropdown). Master List view uses the new `sub_pipeline_name` denormalized column on `LeadListSerializer`.
- **/admin/pipelines page**: collapsible-style Card per event with name+city+dates+active-toggle header, nested sub-pipeline rows with their own active-toggle + actions, and per-tier table inside each sub-pipeline. "+ New event" / "+ Sub-pipeline" / "+ Tier" buttons at each level. FK-PROTECT delete handler returns DRF 400 with the "deactivate instead" hint at all three levels.
- **Seeds**: `seed_tiers` rewritten to seed 5 default sub-pipelines per active event (15 SubPipelines + 63 PackageTiers on the standard 3 events). `seed_leads` rewritten to pick a random sub-pipeline scoped to the chosen event (so the cross-event validator can't reject seeded rows). Stats output groups by `sub_pipeline__event__city — sub_pipeline__name`.
- **Out of scope (deferred)**: small UI tweaks (Phase 2.10), email automation (Phase 3), deploy (Phase 4).

### ✅ Phase 2.8 — Excel-driven Contacts database (complete, 9/9)

Reframed mid-scope: client clarified the Excel upload is purely a **contacts database**, not lead/pipeline data. New `Contact` model (separate from `Lead`); phone is unique; other fields optional. Excel upload is admin-only with partial-success semantics. The Lead-create form gets a "search contacts" picker that **copies** info onto the form (no FK linkage). Auto-grow: saving a Lead with a previously-unseen phone creates a Contact silently.

- **Backend** — `Contact` model on `leads` app; migration `0004_contact`; admin registration; `ContactSerializer`, `ContactViewSet` (cursor-paginated list, `?search=` over name/phone/email/company, list/retrieve any-auth, write admin-only); `POST /api/contacts/bulk-upload/` (multipart `.xlsx` → `{imported, skipped:[{row,phone?,reason}]}`); `GET /api/contacts/template/` (admin-only `.xlsx` download with bold headers + 2 sample rows). `LeadDetailSerializer.create()` calls `_ensure_contact_for_lead` post-save (`get_or_create` keyed on phone). `openpyxl==3.1.5` added to `backend/requirements.txt`.
- **Frontend** — `lib/api/contacts.ts` (list/listNext/get/create/bulkUpload/downloadTemplate) + types (`Contact`, `BulkUploadResponse`, etc.). New `/admin/import` page with native drag-and-drop, "Download template" button, post-upload result Card with summary tiles + per-row skipped table. AppShell admin nav adds an "Import" link (Upload icon) between Tiers and Users. `LeadForm` (create mode only) gets a `<ContactPicker>` at the top — debounced typeahead, dropdown of top 8 results, click-to-prefill all 7 contact fields with snapshot semantics.
- **Decisions locked** — phone is the unique key (DB level); Lead is NOT FK-linked to Contact; Lead form auto-creates a Contact on save when the phone is new; partial-success uploads (valid rows imported, bad rows reported); template uses canonical 7 columns (Phone required, Name/Email/Company/Designation/LinkedIn URL/Source optional). The bulk-upload header parser also tolerates the LexTalk-Excel aliases (`Contact: Work Phone`, `Deal Name`, etc.) so the existing client files import without reformatting.
- **Out of scope (deferred)** — small UI tweaks (separate thread carried into Phase 2.9); a dedicated `/contacts` admin page for browsing/editing the Contacts DB; email automation (Phase 3); deploy (Phase 4).

See `docs/PROGRESS.md` for the 9-sub-step checklist + verification.

### ✅ Phase 2.10 — Dual-currency tier prices + per-lead deal currency (complete, 7/7)

LexTalk World prices India events in ₹ and Dubai in $. This phase added dual-currency support across the tier-price and deal-value surfaces.

- **Backend** — `PackageTier.default_price` renamed to `default_price_inr` (data preserved via `RenameField` in migration `0008`); `default_price_usd` added as nullable `DecimalField`. `Lead.deal_currency` added (`INR`/`USD`, default `INR`). `LeadDetailSerializer` exposes `deal_currency`; validates that explicitly clearing it while `deal_value` is set raises 400. `seed_tiers` 4-tuple format extended with USD prices (Sponsors: $25k/$12k/$6k; Delegate Passes: $300/$900/$120; others null). `seed_leads` picks `deal_currency=USD` ~20% of the time for Dubai + USD-priced tiers.
- **Frontend** — Types: `PackageTier`/`PackageTierBrief`/`NestedTier` both price fields; `LeadDetail` adds `deal_currency`; new `Currency` literal + `CURRENCY_SYMBOL` map. Admin: `TierFormModal` now shows two price inputs side-by-side; `/admin/pipelines` tier table column shows `"₹2,000,000 / $25,000"` (or `—` for missing side). Leads: tier dropdown option labels show both prices `"Platinum Sponsor — ₹2,000,000 / $25,000"`; deal-value row replaced by amount input + ₹/$ pill toggle bound to `form.deal_currency`.
- **Decisions locked** — see §8 for `deal_value`/`deal_currency` bullet. Dashboard revenue tiles are deliberately untouched (all existing rows are INR — split tiles are a future phase).
- `tsc --noEmit` clean; `next build` clean; `python manage.py check` clean.

### ✅ Phase 3.1 — Dashboard overhaul + fully month-scoped (complete)

Fixed revenue calculation (was mixing INR + USD) and made the entire dashboard month-scoped — every number on the page changes when you move the month picker.

- **Backend** — `_parse_month(request)` helper reads `?month=YYYY-MM` (stdlib `calendar.monthrange`). `DashboardView` splits revenue into `revenue_month_inr` + `revenue_month_usd`; `leads_by_status`, `leads_by_event`, and daily-conversion chart all filtered to the month window; `conversions_by_day` replaces the old rolling-30-day series. `UserActivityView` uses month-scoped counts for all activity fields (`calls_month`, `emails_month`, `leads_touched_month`, `interactions_month`); `leads_assigned` = leads created in the month; `followups_due` is `null` for past months (frontend hides the column entirely).
- **Frontend** — `DashboardKpis` trimmed to month-only fields; `UserActivityRow` fields renamed to `_month` suffix. `KpiGrid.tsx` is a clean 4-tile grid (Leads, Conversions, Revenue ₹, Avg days to close). `UserActivityTable.tsx` hides the Follow-ups due column for past months. `admin/page.tsx` passes `isCurrentMonth` flag down.

### ⏳ Phase 3 — Email automation (post-Phase 3.1)

Models for `EmailTemplate` + `ScheduledEmail` are NOT yet built. They were planned but de-prioritized — backend is structured so adding them later requires zero schema changes to existing tables. Add Celery + Redis + a beat task when ready.

### ⏳ Phase 4 — Deploy

Vercel (Next.js) + Railway/Render (Django) + Neon (already live).

---

## 5. How to run things

### First-time setup (fresh machine)

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — paste DATABASE_URL from Neon dashboard, generate SECRET_KEY
python manage.py migrate
python manage.py seed_events    # 3 LexTalk events
python manage.py seed_tiers     # 21 default tiers across all 5 sub-pipelines
python manage.py seed_leads     # 50 fake leads (idempotent — needs seed_tiers run first)
python manage.py runserver      # http://127.0.0.1:8000
```

### Daily dev

```bash
cd backend && source .venv/bin/activate && python manage.py runserver
```

The dev server hot-reloads on file change.

### Re-seed with fresh fake data

```bash
python manage.py seed_leads --count 100   # idempotent: clears phone +9170... rows first
```

### Open Django admin

http://localhost:8000/admin/ — log in with the admin user (creds below).

---

## 6. Test users (DEV ONLY — rotate before any repo sharing)

| Username | Password | Role |
|---|---|---|
| `admin` | `ChangeMe123!` | ADMIN |
| `caller1` | `caller1pass` | USER |

These were created via Django shell / API in early Phase 1. They sit in the Neon DB. The Neon connection string is in `backend/.env` (gitignored).

⚠️ **Before pushing this repo to a public remote**: rotate the admin password (Django shell or `/api/users/{id}/` PATCH), rotate the Neon credential (Neon dashboard → Reset password), and update `backend/.env`.

---

## 7. API surface (Phase 1 — all live)

```
# Auth (public)
POST   /api/auth/login/           {username, password} → {access, refresh, user}
POST   /api/auth/refresh/         {refresh}            → {access, refresh}
GET    /api/auth/me/              (Bearer)             → current user

# User mgmt (admin only)
GET    /api/users/                                     → list
POST   /api/users/                {username, email, password, role, is_active}
PATCH  /api/users/{id}/           any subset           → updated user
# DELETE blocked → use is_active=false instead

# Events (read-only, any auth)
GET    /api/events/[?active_only=true]

# Leads (any auth, DELETE admin-only)
GET    /api/leads/?status=&event_interest=&product_interest=&package_tier=&source=&assigned_to=&search=&created_after=&created_before=&next_followup_after=&next_followup_before=
POST   /api/leads/
GET    /api/leads/{id}/
PATCH  /api/leads/{id}/           # if status changes, status_change_comment is REQUIRED
PUT    /api/leads/{id}/
DELETE /api/leads/{id}/           # admin only

# Lead extras
GET    /api/leads/by-phone/?phone=+91...&exclude=<uuid>
GET    /api/leads/{id}/interactions/
POST   /api/leads/{id}/interactions/    {type, occurred_at, outcome, notes}
GET    /api/leads/{id}/status-history/

# Sub-pipelines (read = any auth, write = admin only)  — Phase 2.9
GET    /api/sub-pipelines/[?event=<id>&is_active=true]
POST   /api/sub-pipelines/        {event, name, sort_order, is_active}    # slug auto-derived
PATCH  /api/sub-pipelines/{id}/
DELETE /api/sub-pipelines/{id}/   # blocked by FK PROTECT if any Lead/Tier attached → DRF 400 "deactivate instead"

# Tiers (read = any auth, write = admin only)
GET    /api/tiers/[?sub_pipeline=<id>&is_active=true]
POST   /api/tiers/                {sub_pipeline, name, default_price, sort_order, is_active}
PATCH  /api/tiers/{id}/
DELETE /api/tiers/{id}/           # blocked by FK PROTECT if any Lead still uses it → DRF 400 "deactivate instead"

# Events (read = any auth, write = admin only)  — Phase 2.9 flipped to full CRUD
GET    /api/events/[?active_only=true&with_pipelines=true]
POST   /api/events/               {name, city, country, start_date, end_date, is_active}
PATCH  /api/events/{id}/
DELETE /api/events/{id}/          # blocked by FK PROTECT if any Lead still uses it

# Contacts (read = any auth, write = admin only)  — Phase 2.8
GET    /api/contacts/?search=                       → cursor-paginated by full_name
GET    /api/contacts/{id}/
POST   /api/contacts/             {phone, full_name?, email?, company?, designation?, linkedin_url?, source?}
POST   /api/contacts/bulk-upload/ multipart file=<.xlsx>  → {imported: N, skipped: [{row, phone?, reason}]}
GET    /api/contacts/template/    → .xlsx download (admin only)

# Admin dashboard (admin only)
GET    /api/admin/dashboard/       → kpis + leads_by_status + leads_by_event + conversions_last_30_days
GET    /api/admin/user-activity/   → per-user counts (callers only)
```

**Status enum** (`Lead.status`, since Phase 2.5): `LEAD_ASSIGNED`, `CALL_CONNECTED`, `INFO_SENT`, `FOLLOWUP_1`, `FOLLOWUP_2`, `FOLLOWUP_3`, `DEAL_WON`, `DEAL_LOST`, `DECLINED`.

**Sub-pipelines** (Phase 2.9): admin-managed `SubPipeline` model. Each row has FK `event`, free-text `name`, server-derived `slug` (unique per event), `sort_order`, `is_active`. Lead carries `sub_pipeline` FK (was `product_interest` enum); PackageTier carries `sub_pipeline` FK (was `product_interest` enum). `seed_tiers` seeds 5 defaults per event: Delegate Passes / Sponsors / Speakers / Awardees / VIP / Media Partners.

Pagination on `/api/leads/` uses **cursor pagination** ordered by `-created_at`, page size 25 — drives the infinite-scroll table.

---

## 8. Key decisions locked

- **One lead = one event × one sub-pipeline**. Same person interested in two events → two `Lead` rows. Same person × two sub-pipelines under one event → two rows. The same-phone sidebar surfaces them together.
- **`deal_value` + `deal_currency`** (Phase 2.10). `deal_value` is optional, typically filled when a lead transitions to `DEAL_WON`. `deal_currency` stores `INR` or `USD` (default `INR`) alongside the amount — every deal carries one explicit currency. `PackageTier` has two separate price columns: `default_price_inr` + `default_price_usd` (both nullable); admin fills whichever apply. The tier dropdown in `LeadForm` renders `"VIP Pass — ₹75,000 / $900"` for reference; actual deal value and currency are whatever was negotiated. Admin dashboard revenue tiles still sum all deals in a single number (all existing rows are INR) — dual-currency split tiles are deferred to a future phase. `seed_leads` picks `deal_currency=USD` ~20% of the time for Dubai leads that have a USD-priced tier; all others default to INR.
- **`PackageTier` `on_delete=PROTECT`**. A tier with attached leads can't be hard-deleted — `/api/tiers/` `destroy()` catches `ProtectedError` and returns DRF 400 with a "deactivate instead" hint. `is_active=false` hides the tier from the LeadForm dropdown without orphaning anything.
- **Sub-pipeline ↔ tier match enforced** at the serializer level. Backend rejects writes where `package_tier.product_interest != lead.product_interest`. Frontend cascades: changing the sub-pipeline on a form auto-clears the tier.
- **No per-user targets / "slacking" flags in v1.** Admin sees raw activity numbers and judges by eye. Easy to add `daily_call_target` to `User` later without schema changes elsewhere.
- **Conversion timestamp uses `StatusHistory.changed_at`** for `to_status=DEAL_WON`, NOT `Lead.updated_at`. Unrelated edits (notes, etc.) shouldn't shift the conversion date.
- **DELETE blocked on `/api/users/`** — deactivate via `PATCH {is_active: false}`. Hard-delete breaks audit trails (created_by, changed_by, assigned_to FKs across thousands of rows).
- **No email verification on user creation**. Admin creates accounts directly with a password.
- **JWT tokens carry `role` and `username` as claims** — frontend can route by role without a `/me/` roundtrip on every page.
- **Contact ↔ Lead is COPY, not FK** (Phase 2.8). The Lead form picker pre-fills contact fields onto the Lead at creation time; later edits to the Lead don't mutate the master Contact. Phone is the unique key on Contact. A Lead saved with a previously-unseen phone auto-creates a Contact (`get_or_create`); a Lead saved with an existing phone leaves the Contact untouched. Snapshot semantics — preserves audit history when client info drifts over time.
- **Per-event SubPipeline + Tier hierarchy** (Phase 2.9). All three levels (Event, SubPipeline, Tier) are admin-CRUD via `/admin/pipelines`. SubPipelines belong to one event (FK `event`); tiers belong to one sub-pipeline (FK `sub_pipeline`). Adding a new event lets the admin define fresh sub-pipelines for it without a code change. **No rename UI** — admin can only create / delete (FK-protected) / deactivate. The `LeadDetailSerializer.validate()` rejects (event, sub-pipeline) cross-mismatches; the form cascades to keep this honest. URL slugs (`?pipeline=<slug>`) now use the persisted `SubPipeline.slug` (server-derived from name + dedup), not the old static enum slug.

---

## 9. Known gotchas / fixed bugs

### DNS — ISP DNS can refuse `*.neon.tech` lookups
Some Indian ISPs (Jio observed) refuse cloud DNS records. Fix already applied to this Mac:
```bash
sudo networksetup -setdnsservers Wi-Fi 1.1.1.1 1.0.0.1 8.8.8.8
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder
```
To revert: `sudo networksetup -setdnsservers Wi-Fi empty`.

### Neon free tier cold-starts
After idle, the first connection can take 2-3 seconds (compute spinning up). Subsequent requests are instant. Not a bug — this is how Neon's free tier works.

### `auto_now_add` + `lead.save()` overwrite
When `Lead.objects.update(created_at=...)` backdates a row, the in-memory `lead.created_at` still points to NOW. Any subsequent `lead.save()` re-writes that NOW value to the DB, undoing the backdate. **Fix**: after every `.update()` of a timestamp, also set the in-memory attribute (`lead.created_at = seed_created_at`). The seed_leads command handles this; remember the pattern if you do similar backdating elsewhere.

### Custom User model timing
`AUTH_USER_MODEL = "accounts.User"` MUST be set before the very first migration on a fresh DB. If migrations already ran with the default `auth.User`, you'll need to drop the schema and re-migrate. We did this correctly in Step 4 — don't undo it.

### Postgres "pending trigger events" on enum migrations (Phase 2.5.1 fix)
You can't `ALTER TABLE` in the same transaction that just queued cascade-delete trigger events on that table. When the Phase 2.5 migration tried to wipe `Lead` rows AND alter the `status` enum in one operation, Postgres rejected it with `cannot ALTER TABLE because it has pending trigger events`. **Fix**: split into two migrations — `0002_wipe_dummy_leads` (RunPython data wipe) and `0003_phase_2_5_restructure` (the schema changes). Each commits independently.

### Tier ↔ sub-pipeline mismatch
A `PackageTier` belongs to exactly one `product_interest`. The serializer rejects writes where `lead.product_interest != lead.package_tier.product_interest`. The LeadForm cascades the tier dropdown by `product_interest` and **clears the tier** whenever the sub-pipeline changes. If you skip that auto-clear, stale tier ids leak through and the backend 400s.

---

## 10. Repo layout

```
mantranex/
├── CLAUDE.md                 ← you are here
├── README.md                 ← human-facing project README
├── docs/
│   └── PLAN.md               ← canonical product/architecture plan
├── backend/                  Django project
│   ├── README.md             dev setup
│   ├── requirements.txt
│   ├── .env.example
│   ├── .env                  (gitignored — has Neon creds)
│   ├── manage.py
│   ├── core/                 settings, urls, wsgi
│   ├── accounts/             User, JWT auth views, permissions
│   ├── events/               Event model + read-only API + seed_events
│   ├── leads/                Lead, Interaction, StatusHistory, PackageTier + signals + filters + seed_leads + seed_tiers
│   └── dashboards/           Admin KPI + per-user activity views (no models)
└── frontend/                 Next.js 16 + Tailwind v4
    ├── app/
    │   ├── login/            JWT login form
    │   └── (authed)/         protected route group (AppShell wraps everything)
    │       ├── leads/        Master home (Board ↔ List toggle, URL-state) + create + [id] edit page
    │       │   └── components/  BoardView, ViewToggle, KanbanBoard/Column/Card,
    │       │                    FiltersBar, LeadsTable, LeadForm, sidebar panels
    │       └── admin/        dashboard, users, tiers (CMS-style tier editor)
    ├── components/           AppShell, ProtectedRoute, StatusChangeModal, ui/*
    └── lib/                  api client, auth context, pipelines slug map, hooks
```

---

## 11. Conventions to keep

- **Tests**: every API change is verified end-to-end with curl + a tiny Python shell script. Don't merge a step without that.
- **Idempotency**: any seed/fixture command must be re-runnable without breaking. Use `update_or_create` or marker-based deletion.
- **Permissions**: any new endpoint declares its `permission_classes` explicitly. Default is `IsAuthenticated` from `REST_FRAMEWORK` settings — be explicit when stricter.
- **Cursor pagination on lists** that can grow. Disable pagination only on small reference sets (events, users).
- **Server timezone is `Asia/Kolkata`** (set in `core/settings.py`). All `today_start` / `month_start` calculations use `timezone.localtime()`.
- **Indexes**: any field used in filters or sidebar lookups gets an index. `phone`, `(status, event_interest)`, `(assigned_to, -created_at)`, `(lead, -occurred_at)`, `(lead, -changed_at)` are already indexed.
- **No comments unless WHY is non-obvious.** Code should read clearly without narration.

---

## 12. When to update this file

Update CLAUDE.md whenever:
- A phase or major sub-step ships → bump §4 "State of the world" (and ALWAYS update [`docs/PROGRESS.md`](docs/PROGRESS.md) with sub-step status)
- A new test user is added or rotated → §6
- A new endpoint is added → §7
- A non-obvious bug is fixed (so it doesn't bite again) → §9
- A locked decision changes → §8 (and explain why)
- Workflow rules change (user gives new feedback) → §3

`docs/PROGRESS.md` is the per-step source of truth — flip its checkboxes the moment a step lands. CLAUDE.md is the high-level onboarding doc — bump it on phase boundaries or when something material changes.

The user has explicitly asked us to keep both current. Treat them as part of the deliverable.
