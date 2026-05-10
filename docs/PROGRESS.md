# Progress Tracker — mantranex CRM

> **Living document.** Update this whenever a step ships, is paused, or its scope changes. CLAUDE.md links here so a fresh Claude session can pick up exactly where the work left off.

**Last updated:** 2026-05-08 (Phase 3.1 ✅ complete + post-3.1 dashboard refinement ✅ — entire dashboard now fully month-scoped: all KPIs, charts, and user-table figures change with the month picker. `followups_due` column hidden for past months. `leads_assigned` now shows leads created that month. Charts (`leads_by_status`, `leads_by_event`, daily conversions) all scoped to selected month. 76 Bangalore Delegate Pass dummy leads added for UI testing.)

---

## At a glance

| Phase | Status | Completed |
|---|---|---|
| 1 — Backend foundation | ✅ Done | 13 / 13 |
| 2 — Frontend | ✅ Done | 13 / 13 |
| 2.5 — CRM restructure (client) | ✅ Done | 12 / 12 |
| 2.6 — Kanban onto Master home | ✅ Done | 2 / 2 |
| 2.7 — Bigger kanban cards + back-button fix | ✅ Done | 1 / 1 |
| 2.8 — Excel-driven Contacts database | ✅ Done | 9 / 9 |
| 2.9 — Pipelines as a 3-level CMS hierarchy | ✅ Done | 12 / 12 |
| 2.10 — Dual-currency tier prices + per-lead deal currency | ✅ Done | 7 / 7 |
| 3.1 — Dashboard overhaul + fully month-scoped | ✅ Done | 4 / 4 + polish |
| 3 — Email automation | ⏳ Not started | 0 / TBD |
| 4 — Deploy | ⏳ Not started | 0 / TBD |

**Currently working on:** Nothing — Phase 3.1 + post-3.1 dashboard polish shipped. Repo pushed to GitHub at https://github.com/Himmu1144/nexcrm.

**Next up after this:** Phase 3 (email automation, Celery + Redis) or Phase 4 (deploy to Vercel + Railway + Neon).

---

## Phase 1 — Backend foundation ✅ (13/13)

All API endpoints live on Neon. Detailed step-by-step in `CLAUDE.md` §4. Reproduce by running:

```bash
cd backend && source .venv/bin/activate
python manage.py migrate && python manage.py seed_events && python manage.py seed_leads
python manage.py runserver
```

| # | Step | Status |
|---|---|---|
| 1 | Repo scaffold | ✅ |
| 2 | Django project init | ✅ |
| 3 | Neon Postgres connection | ✅ |
| 4 | Custom User model + role enum | ✅ |
| 5 | JWT auth endpoints | ✅ |
| 6 | Permission classes | ✅ |
| 7 | Event model + seed | ✅ |
| 8 | Lead/Interaction/StatusHistory + auto-history signal | ✅ |
| 9 | Lead CRUD API | ✅ |
| 10 | Same-phone + nested endpoints | ✅ |
| 11 | Admin user management | ✅ |
| 12 | Admin dashboard endpoints | ✅ |
| 13 | Seed 50 fake leads | ✅ |

**Verification status:** Every step E2E tested with curl + Python shell harness. 70+ scenarios passed. Test users: `admin` / `ChangeMe123!` and `caller1` / `caller1pass` (DEV only — rotate before public push).

---

## Phase 2 — Frontend (13/13) ✅

Spec & UI tokens locked in `docs/PLAN.md` and `docs/BRAND.md`. All scaffolding lives in `frontend/`.

### Step 1 — Brand audit ✅
- `docs/BRAND.md` — distilled palette (brand orange `#f99c00`, ink navy, gold accents, cream), typography (Playfair Display + DM Sans), button/card/modal patterns, status-chip color map, Tailwind v4 `@theme` preview.
- Source: live `lextalkworld.in` CSS bundles, scraped via curl.

### Step 2 — Next.js scaffold + Tailwind theme ✅
- `frontend/` scaffolded with **Next.js 16.2.4 + React 19.2 + Tailwind v4 + TypeScript + App Router**.
- Pre-flight: read `node_modules/next/dist/docs/` v16 upgrade notes (Turbopack default, async `params`/`searchParams`, no `next lint`, Tailwind v4 CSS-first config).
- `app/globals.css` — `@theme` block with all brand tokens.
- `app/layout.tsx` — DM Sans + Playfair Display via `next/font/google`.
- Logo downloaded to `public/brand/lextalkworld_logo.png`.
- `frontend/.env.local` — `NEXT_PUBLIC_API_URL=http://localhost:8000`.
- Verified: dev server boots in 245ms, brand markers in HTML.

### Step 3 — Base UI components ✅
- 9 primitives in `frontend/components/ui/`:
  - `Button` (4 variants × 3 sizes, loading, icons, brand amber→slate hover flip)
  - `Input`, `Select`, `Textarea` (label + error + hint)
  - `Badge` (9 tones), `StatusChip` (typed for `LeadStatus`)
  - `Card` (title/description/action header)
  - `Modal` (native `<dialog>` + ESC + backdrop click)
  - `Spinner`
- `lib/cn.ts` — `clsx` wrapper.
- Barrel export in `components/ui/index.ts`.

### Step 4 — Typed API client ✅
- 8 files in `frontend/lib/api/`:
  - `types.ts` — mirror of all backend serializers
  - `storage.ts` — SSR-safe `tokens` and `cachedUser` (localStorage)
  - `client.ts` — axios with **request interceptor** (Bearer token) + **response interceptor** (refresh-on-401 with **single-flight** coalescing of concurrent 401s)
  - `auth.ts`, `leads.ts`, `events.ts`, `users.ts`, `dashboards.ts` — typed methods
  - `index.ts` — exports `api` object + types + helpers
- Array params serialized with `indexes: null` → `?status=NEW&status=CONTACTED` (Django-friendly).
- Refresh-fail clears tokens and redirects to `/login`.

### Step 5 — Auth state + login + route guard ✅
- `lib/auth/context.tsx` — `AuthProvider` + `useAuth()`. Hydrates from `cachedUser` on mount, then refreshes via `/api/auth/me/` in the background (catches role flips / deactivation).
- `components/ProtectedRoute.tsx` — client guard, optional `requireAdmin`. Renders full-screen spinner while bootstrapping.
- `app/login/page.tsx` — login form, distinguishes 401 / network error / unknown.
- `app/page.tsx` — root route, redirects based on auth state.
- `app/(authed)/layout.tsx` + `app/(authed)/admin/layout.tsx` — route-group guards.
- Placeholder pages for `/leads`, `/admin`, `/admin/users`.

### Step 6 — App shell ✅
- `components/AppShell.tsx` — sticky top nav with logo, role-aware nav links (Leads always; Dashboard + Users admin-only), user cluster (initials avatar + username + role badge + logout).
- Active link uses longest-prefix match (so `/admin/users` highlights "Users", not "Dashboard").
- Responsive: labels hidden on mobile, icons only.
- `(authed)/layout.tsx` updated to wrap children in `AppShell`.

### Step 7 — `/leads` home: filters bar + table skeleton ✅
- `lib/hooks/useDebouncedValue.ts` — 300ms debounce so search doesn't fire on every keystroke.
- `app/(authed)/leads/components/FiltersBar.tsx` — controlled filter bar:
  - Search input (debounced)
  - Event / Product / Source dropdowns
  - "Assigned to" toggle (Anyone / Mine — translates to current user's id when "Mine")
  - Created-after / Created-before date inputs
  - Status pills (multi-toggle, brand-orange when active)
  - Reset button (only visible when any filter is set)
- `app/(authed)/leads/components/LeadsTable.tsx` — table with all 9 columns from the spec, error / empty / loading states; overdue follow-ups in rose-700; row → `/leads/[id]`.
- `app/(authed)/leads/page.tsx` — wires both, fetches `/api/events/` once + `/api/leads/` on filter change, debounces search.
- `app/(authed)/leads/new/page.tsx` — Step-9 placeholder so the "+ New lead" button doesn't 404.
- Backend cursor pagination + `?status=A&status=B` multi-filter confirmed working.

### Step 8 — `/leads` home: cursor-paginated infinite scroll ✅
- `lib/hooks/useIntersection.ts` — generic IntersectionObserver hook returning `[ref, inView]`. Default `rootMargin: 200px` prefetches before the user actually hits the bottom.
- `LeadsTable.tsx` extended with sentinel row + footer states: "Scroll to load more" / spinner ("Loading more…") / "All caught up — N total".
- `page.tsx` — adds:
  - `nextCursor` state (absolute URL from API)
  - `loadingMore` state (separate from initial `loading` so the UI doesn't flicker)
  - `requestId` ref — increments on every filter change so an in-flight `loadMore` can detect it's been superseded and discard its result (prevents stale rows getting appended after the user changes filters)
  - `useIntersection` on the sentinel; effect calls `loadMore()` whenever it scrolls into view
- Backend cursor round-trip verified: page1 (25 rows) → next URL → page2 (25 rows) → no further next. Total 50 = seed count.

### Step 9 — `/leads/[id]` main form ✅
- `app/(authed)/leads/components/LeadForm.tsx` — shared controlled form for create + edit. Sections: Contact / Interest / Pipeline. Required: `full_name`, `phone`, `event_interest`. Inline per-field errors + a server-error banner that surfaces DRF `{field: [msg]}` payloads.
- Status-change confirm modal — when `mode==="edit"` and `form.status !== initial.status`, submit opens a `<Modal>` asking for a comment; that comment is sent as `status_change_comment` (backend requires it on every status flip). Save button is disabled until the comment is non-empty.
- Assignee dropdown — admins get the full active-user list (loaded via `api.users.list()`), non-admins get just "Unassigned" / "me" plus the existing assignee preserved by username so it doesn't get accidentally cleared.
- `app/(authed)/leads/new/page.tsx` — replaces the Step-7 placeholder. Loads events + (if admin) users in parallel, renders `LeadForm` with `mode="create"`, on success `router.push("/leads/{id}")`.
- `app/(authed)/leads/[id]/page.tsx` — async `params` unwrapped via React `use()` (Next 16). Loads lead + events + (if admin) users in parallel; surfaces 404 / network errors. On save, replaces local lead state and shows a 2.5s "Saved." flash.
- Verified: TS clean, `/leads/new` and `/leads/[id]` both 200 from dev server.

### Step 10 — `/leads/[id]` sidebar (3 panels) ✅
- `app/(authed)/leads/components/SamePhonePanel.tsx` — fetches `/api/leads/by-phone/?phone=&exclude=` on mount; lists past leads on the same number with a `StatusChip` and a click-through to `/leads/{id}`. Handles loading / empty / error states.
- `app/(authed)/leads/components/InteractionsPanel.tsx` — fetches `/api/leads/{id}/interactions/`; per-row icon + outcome + notes + author + timestamp. "Log" button opens a `<Modal>` with type / when / outcome / notes; submit POSTs to nested endpoint and prepends the new interaction to the list (no full re-fetch).
- `app/(authed)/leads/components/StatusTimelinePanel.tsx` — fetches `/api/leads/{id}/status-history/`; vertical timeline with brand-amber dots; shows from→to status, comment, who, when. Accepts a `refreshKey` prop so the parent can force a re-fetch after a status flip.
- `app/(authed)/leads/[id]/page.tsx` — switched to a 2-col grid (`lg:grid-cols-3`, form spans 2). On save, parent bumps `timelineKey` so the timeline refetches and picks up the just-written `StatusHistory` row.
- Lucide note: `Linkedin` icon doesn't exist in the installed lucide-react; used `Link2` for the LinkedIn interaction row.
- Verified: TS clean, `/leads/{id}` 200 in 60ms.

### Step 11 — `/admin` dashboard ✅
- Installed `recharts`. Charts are client-only (already inside `(authed)` route group, so no SSR concern).
- `app/(authed)/admin/components/KpiGrid.tsx` — 6 tile grid (leads today / conversions today / revenue this month / avg conversion days / leads this week / leads this month). Each tile uses `Card padding="tight"` with a colored icon badge and a tiny hint line.
- `app/(authed)/admin/components/Charts.tsx` — three responsive charts: pipeline funnel (BarChart, brand-amber, fixed status order so it reads top-of-funnel→outcome), leads-by-event (BarChart, ink), 30-day conversion line (LineChart, brand-amber). All wrapped in `<ResponsiveContainer>` inside a fixed-height div.
- `app/(authed)/admin/components/UserActivityTable.tsx` — calls/emails/leads-touched today, follow-ups due (rose when > 0), wins + revenue this month. Renders in a `Card padding="none"` so the table edges flush with the card border.
- `app/(authed)/admin/page.tsx` — single `Promise.all` for `dashboards.overview()` + `dashboards.userActivity()`. 403 surfaces "Admin only…", network failure surfaces backend-running hint.
- Verified: TS clean, `/admin` 200 in 96ms.

### Step 12 — `/admin/users` ✅
- `app/(authed)/admin/users/components/UserFormModal.tsx` — shared create/edit modal. Edit mode preloads existing fields and treats password as optional (only sent when typed). Create mode requires password client-side. Surfaces DRF `{field: [msg]}` errors inline. `is_active` toggle as a checkbox.
- `app/(authed)/admin/users/page.tsx` — replaces the placeholder. Loads `/api/users/`, renders a 7-col table (user / email / role / status / joined / last login / actions). Edit (pencil) opens the modal; deactivate/reactivate (UserX / UserCheck) hits `PATCH /api/users/{id}/ {is_active: !is_active}` with a `window.confirm` step. The current admin can't deactivate themselves (button disabled with tooltip). After save, the row updates in place; new users are prepended.
- Verified: TS clean, `/admin/users` 200 in 67ms.

### Step 13 — Polish + smoke test ✅
- `app/error.tsx` — global client-error boundary with brand styling, "Try again" + "Go to leads" actions, surfaces `error.message` for debugging.
- `app/not-found.tsx` — friendly 404 page with brand-amber compass icon and a CTA back to `/leads`. Verified an unknown route returns 404 and renders this page.
- Logo aspect-ratio warning fixed — `lextalkworld_logo.png` is 494×150 (~3.29:1). The previous `width=32 height=32` + `style={{height:"auto"}}` triggered Next 16's recurring "Image with src ... has either width or height modified" warning. Replaced with the correct intrinsic ratio: `211×64` on `/login` and `105×32` in the AppShell.
- Empty states already covered per surface: `/leads` (no rows), same-phone panel, interactions panel, status timeline, users page.
- Smoke test (admin / ChangeMe123!): all routes serve 200, `/this-route-does-not-exist` returns 404 + custom page, backend API end-to-end works (login → 25 leads page1 with `next` cursor → admin dashboard returns kpis + 7 status buckets + 3 events + conversion days → `/api/users/` returns 2 users). `tsc --noEmit` is clean.

---

## Phase 2.5 — CRM restructure to match client's sales motion ✅ (12/12)

> **Note (2026-05-06)**: the layout described below was superseded by **Phase 2.6** — the kanban now lives on `/leads` itself, not on `/pipelines/[event]/[sub-pipeline]`. The restructure data model (5 sub-pipelines, 9 stages, `PackageTier`) is unchanged.



Client sent `docs/client_requirements.txt` after seeing v1. Spec cross-checked against lextalkworld.in. Full plan in `~/.claude/plans/we-re-resuming-the-mantranex-fluttering-meteor.md`.

### Locked decisions

- **Sub-pipelines (5):** `SPEAKERS`, `SPONSORS`, `AWARDEES`, `VIP_MEDIA_PARTNERS`, `DELEGATE_PASSES`. Exhibitors deferred (pending client confirmation; visible on website but not in spec).
- **Stages (9):** `LEAD_ASSIGNED → CALL_CONNECTED → INFO_SENT → FOLLOWUP_1 → FOLLOWUP_2 → FOLLOWUP_3 → DEAL_WON / DEAL_LOST / DECLINED`. Wipe + re-seed since DB data is dummy.
- **Tier dimension:** new `PackageTier` model. Lead gets `package_tier` FK, available choices filtered by `product_interest`. Defaults seeded from website (Platinum/Diamond/Gold for sponsors, Standard/VIP for delegates, Keynote/Panelist/Moderator/Judge for speakers, etc.). Admin-editable — foundation for future CMS-style pipeline editor.
- **Two views:**
  - `/leads` = **Master Pipeline** (flat searchable table, existing UI + light polish: tier column, new status pills, "Master Pipeline" header).
  - `/pipelines/[event]/[sub-pipeline]` = **Bitrix-style kanban board** (9 stage columns, drag-drop). Toggle to list view of same scoped data (Bitrix parity).
- **Drag-drop UX:** drop opens shared `StatusChangeModal` (factored from existing `LeadForm`), captures comment, calls existing `PATCH /api/leads/{id}/` with `status_change_comment`. Reuses signal-driven `StatusHistory` audit — no new audit pathway.
- **Roles:** unchanged. CSM (`USER`) cannot delete; admin full control.

### Sub-step checklist

| # | Step | Status |
|---|---|---|
| 2.5.1 | Backend schema rewrite (status enum, product_interest rename + add `VIP_MEDIA_PARTNERS`, `PackageTier` model, `Lead.package_tier` FK, wipe migration) | ✅ |
| 2.5.2 | Backend signals/serializers/filters/permissions sweep for new schema | ✅ |
| 2.5.3 | `seed_tiers` management command (idempotent defaults per sub-pipeline) | ✅ |
| 2.5.4 | Update `seed_leads` for new 9 statuses + random tier assignment | ✅ |
| 2.5.5 | `/api/tiers/` endpoint (list any-auth, CRUD admin-only) | ✅ |
| 2.5.6 | Frontend types + `tiers.ts` API client + `StatusChip` 9-stage palette + LeadForm cascading tier dropdown | ✅ |
| 2.5.7 | Master Pipeline polish on `/leads` (tier column, status pills, header) | ✅ |
| 2.5.8 | Kanban routing shell (`/pipelines` drill-down, no DnD yet) | ✅ |
| 2.5.9 | Kanban drag-drop with shared `StatusChangeModal` + optimistic update | ✅ |
| 2.5.10 | Kanban list-view toggle (Bitrix parity) | ✅ |
| 2.5.11 | `/admin/tiers` CRUD page (admin-only) | ✅ |
| 2.5.12 | Polish + smoke test + update `docs/PROGRESS.md` and `CLAUDE.md` | ✅ |

### Out of scope this phase (parked per user)

- Excel contact upload (deferred).
- Bitrix-style **drag-drop** is in scope; full **CMS-style pipeline/stage editor** beyond tier CRUD is deferred (the `PackageTier` foundation makes this cheap to add later).
- Email automation (Phase 3), deploy (Phase 4).
- Exhibitors as a 6th sub-pipeline (pending client confirmation).

---

## Phase 2.6 — Kanban collapsed onto Master home page ✅ (2/2)

After demoing v1.5 to the client, they pushed back on the drill-down: navigating to a kanban took 3 clicks (`Pipelines` → event → sub-pipeline). They wanted both views one click apart on the home page itself, with the event picker visibly on the front, not behind a click.

### Locked decisions

- **Default view = Board** on every page load. No localStorage persistence.
- **Two tab rows in Board mode**: events (Bangalore / Dubai / Mumbai) row, then sub-pipelines (Delegate Passes / Sponsors / Speakers / Awardees / VIP / Media Partners) row. First tab in each row is selected by default. Full labels — `flex-wrap` on narrow viewports.
- **No "All events"** option in Board mode — kanban is always scoped to ONE event × ONE sub-pipeline so the 9 stage columns stay readable.
- **List mode = today's `/leads` page** unchanged: same `FiltersBar` + paginated infinite-scroll `LeadsTable`.
- **State carried in URL search params** (`?view=board|list&event=<slug>&pipeline=<slug>`). Satisfies the user's "no persistence" rule (no localStorage) AND makes the back-button restore the right tabs (URL is the state).
- `/pipelines/...` route tree, the per-pipeline localStorage view toggle, and the `KanbanList` component all deleted.

### Sub-step checklist

| # | Step | Status |
|---|---|---|
| 2.6.1 | Build `BoardView` + `ViewToggle`; relocate `KanbanBoard`/`KanbanColumn`/`KanbanCard` from `pipelines/components/` → `leads/components/`; rewrite `app/(authed)/leads/page.tsx` to read URL params and conditionally render `<BoardView>` or the existing `<FiltersBar>+<LeadsTable>` (factored into a `<ListView>` sub-component that only mounts when picked). | ✅ |
| 2.6.2 | Delete `frontend/app/(authed)/pipelines/` directory; remove "Pipelines" nav item + Kanban icon from `AppShell`; refresh `lib/pipelines.ts` docstring; bump `docs/PROGRESS.md` and `CLAUDE.md`. | ✅ |

### Verification (post-2.6.2)

- `tsc --noEmit` clean; both servers boot.
- `/leads` → on first paint, `router.replace` normalizes URL to `?view=board&event=<first>&pipeline=delegate-passes`.
- Clicking event/sub-pipeline tab updates URL via `router.replace` (no history pollution).
- Drag-drop on the home-page kanban works end-to-end: comment modal → `PATCH /api/leads/{id}/` with `status_change_comment` → `StatusHistory` row written via signal.
- Open a lead → browser back → lands on the same Board with the same tabs (URL preserved).
- `/pipelines`, `/pipelines/dubai`, `/pipelines/dubai/sponsors` all 404 via `app/not-found.tsx`.
- Top nav reads "Master · Dashboard · Tiers · Users" for admin (no Pipelines).

---

## Phase 2.7 — Bigger kanban cards + back-button fix ✅ (1/1)

Client follow-up: kanban cards were too compact — wanted to see the **status note** (the comment captured when a card was moved to its current stage) plus more "important client info" without clicking through. Also reported a bug: opening a lead from a Mumbai/Speakers board and clicking "Back to leads" returned them to Dubai/Delegate Passes (the defaults), not the tabs they came from.

### Shipped (single sub-step 2.7.1)

**Backend:**
- [`backend/leads/views.py`](backend/leads/views.py) — `LeadViewSet.get_queryset` now `prefetch_related`s `status_history` ordered DESC by `changed_at`, so the serializer reads the latest row in O(1).
- [`backend/leads/serializers.py`](backend/leads/serializers.py) — `LeadListSerializer` adds `designation`, `source`, and `latest_status_note: { comment, to_status, changed_at, changed_by_username }`. Returns `null` when latest history row has empty comment.

**Frontend:**
- [`frontend/lib/api/types.ts`](frontend/lib/api/types.ts) — new `LatestStatusNote` type + new fields on `LeadListItem`.
- [`frontend/app/(authed)/leads/components/KanbanCard.tsx`](frontend/app/(authed)/leads/components/KanbanCard.tsx) — full redesign: name + designation + company stack at top, tier + source pill row, phone (mono), **status note block** (brand-amber left border, MessageSquareQuote icon, `line-clamp-2` truncation, "user · 3d ago" line — only shown when comment exists), footer with assigned + next-followup separated by a top border.
- [`frontend/app/(authed)/leads/components/KanbanColumn.tsx`](frontend/app/(authed)/leads/components/KanbanColumn.tsx) — column width `w-72` → `w-80` (288 → 320px) for breathing room.

**Back-button fix in same step:**
- [`frontend/app/(authed)/leads/[id]/page.tsx`](frontend/app/(authed)/leads/[id]/page.tsx) — replaced `<Link href="/leads">` with `<button onClick={goBack}>` where `goBack()` calls `router.back()` if `window.history.length > 1`, else falls back to `router.push("/leads")`. The Link was PUSHING a fresh `/leads` entry (no params), causing the home page's mount-time normalize to reset to defaults; popping via `router.back()` returns to the exact `?view=board&event=mumbai&pipeline=speakers` URL the user came from.

### Verified

- `tsc --noEmit` clean.
- 21/25 seeded leads have a populated `latest_status_note`; designation + source 100% populated.
- Mumbai/Speakers → open lead → "Back to leads" → returns to Mumbai/Speakers ✅.

---

## Phase 2.8 — Excel-driven Contacts database ✅ (9/9)

Mid-scope reframe: client clarified that the Excel upload from `docs/client_requirements.txt` line 3 is purely a **contacts database**, not lead/pipeline data. The contacts DB grows in two ways: admin Excel uploads and auto-create on Lead save when the typed phone is new. The Lead form gets a "search contacts" picker that **copies** info onto the form (no FK linkage — snapshot semantics).

### Locked decisions

- **`Contact` model** lives in `leads` app next to `Lead`/`PackageTier`. Phone is `unique=True`; Name/Email/Company/Designation/LinkedIn/Source all optional.
- **Lead is NOT FK-linked to Contact.** Picker = pre-fill only. Editing a Lead never mutates the master Contact.
- **Auto-grow on Lead create** — `LeadDetailSerializer.create()` post-save calls `get_or_create` keyed on phone. New phone → Contact auto-created from the Lead's contact fields. Existing phone → no-op.
- **Excel upload** is admin-only, partial-success: `POST /api/contacts/bulk-upload/` returns `{imported: N, skipped: [{row, phone?, reason}]}`. Phone-only rows are valid; missing-phone, in-file dupes, already-in-DB phones, and bad email/URL formats are reported per-row.
- **Canonical template** has 7 columns in order: Phone (required), Name, Email, Company, Designation, LinkedIn URL, Source. The header parser tolerates the existing LexTalk-Excel aliases (`Contact: Work Phone`, `Deal Name`, etc.) so the client's existing files import without reformatting.
- **Phone normalization** — strip spaces/`-`/`(`/`)`, coerce float-encoded phones (`971552169009.0` → `971552169009`), treat `"N/A"`/`"none"`/`"-"` as empty. `Source` matching is case-insensitive across enum values + human labels + a few aliases (`web`, `linked in`, etc.); falls back to `OTHER`.

### Sub-step checklist

| # | Step | Status |
|---|---|---|
| 2.8.1 | Backend: `Contact` model + migration `0004_contact` + `ContactAdmin` | ✅ |
| 2.8.2 | Backend: `ContactSerializer` + `ContactViewSet` (cursor-paginated, `?search=`, list/retrieve any-auth, write admin-only) + URL register | ✅ |
| 2.8.3 | Backend: `bulk-upload` action — `openpyxl` parse, header alias map, phone normalization, per-file + per-DB dedupe, per-row report, `bulk_create`. `openpyxl==3.1.5` to `requirements.txt` | ✅ |
| 2.8.4 | Backend: `template` action — admin-only `.xlsx` download with bold headers + 2 LexTalk-flavored sample rows | ✅ |
| 2.8.5 | Backend: hook `LeadDetailSerializer.create()` → `_ensure_contact_for_lead` (`get_or_create` on phone) | ✅ |
| 2.8.6 | Frontend: `lib/api/contacts.ts` + types (`Contact`, `BulkUploadResponse`, etc.); wire into `api` aggregate | ✅ |
| 2.8.7 | Frontend: `/admin/import` page (drag-drop + Download template + per-row skipped table) + admin nav "Import" link | ✅ |
| 2.8.8 | Frontend: `<ContactPicker>` typeahead at the top of `LeadForm` (create mode only); copies all 7 contact fields on pick | ✅ |
| 2.8.9 | Polish + E2E smoke test + `CLAUDE.md` and `docs/PROGRESS.md` update | ✅ |

### Verification (E2E smoke test)

8/8 scenarios pass against Neon:

1. `GET /api/contacts/template/` — 200, correct content-type, 5190 bytes, attachment.
2. Upload 5-row file (full / phone-only / missing phone / dup-of-row-2 / bad email) → `imported: 2, skipped: 3` with correct row numbers + reasons.
3. Search by name → 1 hit.
4. Re-upload same file → `imported: 0, skipped: 5` (idempotent).
5. `POST /api/leads/` with brand-new phone → Lead created + Contact auto-grew with the lead's name.
6. `POST /api/leads/` with existing phone → Contact count stays at 1, original name preserved (snapshot semantics confirmed).
7. Non-admin POST/upload/template → all 403; non-admin list/retrieve → 200.
8. Bad file type → 400 with clean error.

`tsc --noEmit` clean across all frontend changes.

### Out of scope this phase (parked)

- Dedicated `/contacts` admin page (browse / edit / deactivate). Excel upload + auto-create-on-Lead-save covers the immediate need.
- Small UI tweaks the user mentioned at session start — deferred to Phase 2.9.
- Email automation (Phase 3); deploy (Phase 4).

---

## Phase 2.9 — Pipelines as a 3-level CMS hierarchy ✅ (12/12)

Client wanted to add new events + sub-pipelines themselves without a deploy. The old `Lead.ProductInterest` enum became a per-event `SubPipeline` model; `/admin/tiers` got rebuilt as `/admin/pipelines`, a single nested editor over **Event → SubPipeline → Tier**.

### Locked decisions

- **Per-event sub-pipelines.** Adding a new event (e.g. Mumbai 2027) lets the admin define fresh sub-pipelines + tiers for it. No global pipeline list.
- **No rename UI.** Admin can only create / delete (FK-protected) / deactivate. Avoids the "what label do existing leads now read?" question.
- **`/admin/tiers` renamed to `/admin/pipelines`** — single page editing the whole hierarchy. Nav: "Tiers" → "Pipelines".
- **All three levels admin-CRUD.** Backend write actions are `IsAdmin`-only with FK-PROTECT delete handlers returning DRF 400 with the "deactivate instead" hint.
- **Wipe-and-reseed cut-over** (consistent with Phase 2.5 precedent). 50 dummy leads + 21 old tiers wiped in `0006_wipe_for_phase_2_9`; schema rewrite in `0007_alter_packagetier_options_and_more`. Re-seeded 15 sub-pipelines + 63 tiers + 50 leads.
- **Slug auto-derivation.** SubPipelineSerializer slugifies the name and dedupes within the event (`base`, `base-2`, …). Slug is read-only on the wire.

### Sub-step checklist

| # | Step | Status |
|---|---|---|
| 2.9.1 | Backend: `SubPipeline` model + migration `0005_subpipeline` + admin registration | ✅ |
| 2.9.2 | Backend: `SubPipelineSerializer` + `SubPipelineViewSet` + URL register + FK-PROTECT delete | ✅ |
| 2.9.3 | Backend: schema cut-over (`0006` wipe + `0007` schema) — drop `product_interest`, add `sub_pipeline` FKs; rewire filters/serializers/admin so server boots | ✅ |
| 2.9.4 | (rolled into 2.9.3 — server wouldn't boot otherwise) | ✅ |
| 2.9.5 | Backend: `EventViewSet` flipped read-only → full CRUD; `?with_pipelines=true` nested-tree expansion | ✅ |
| 2.9.6 | Backend: rewrote `seed_tiers` (15 SubPipelines + 63 Tiers across 3 events) and `seed_leads` (event-scoped sub-pipeline picks) | ✅ |
| 2.9.7 | Frontend: types + `api.subPipelines` + write methods on `api.events`; `lib/pipelines.ts` rewritten (dynamic helpers replace static enum maps) | ✅ |
| 2.9.8 | Frontend: `LeadForm` Event → SubPipeline → Tier cascade with mutual clears; sub_pipeline now required | ✅ |
| 2.9.9 | Frontend: `BoardView` dynamic sub-pipeline tabs; `FiltersBar` event-aware sub-pipeline cascade; `LeadsTable` reads `sub_pipeline_name`; `leads/page.tsx` resolves URL defaults dynamically | ✅ |
| 2.9.10 | Frontend: `/admin/pipelines` page (3-level nested editor) + `EventFormModal` / `SubPipelineFormModal` / `TierFormModal`; `/admin/tiers` deleted; AppShell nav rename + Workflow icon | ✅ |
| 2.9.11 | Cleanup: dropped dead `ProductInterest` literal + `PRODUCT_INTEREST_LABELS` const from types.ts; verified dashboard charts never bucketed by `product_interest` (group by status + event city) | ✅ |
| 2.9.12 | E2E smoke (admin creates Mumbai 2027 → adds Influencer Track + Sponsors → 3 tiers → caller1 creates lead → cross-event validation 400 → delete-with-leads 400 → deactivate 200 → lead still surfaces) + docs bumped | ✅ |

### Verification (E2E smoke test against Neon — all passed)

1. Admin POST `/api/events/` → "LexTalk World Mumbai 2027" — 201, id=5.
2. Admin POST `/api/sub-pipelines/` × 2 → "Influencer Track" (slug `influencer-track`) + "Sponsors" — 201 each.
3. Admin POST `/api/tiers/` × 3 → Standard / Premium / Platinum under Influencer Track — 201 each.
4. **caller1** POST `/api/leads/` → 201 with `sub_pipeline=Influencer Track` + `package_tier=Standard`.
5. Cross-event mismatch (Mumbai 2027 + Dubai sub-pipeline) → **400** with `"Sub-pipeline 'Delegate Passes' belongs to Dubai, not Mumbai 2027."` ✅
6. `GET /api/events/?with_pipelines=true&active_only=true` → returns Mumbai 2027 with both sub-pipelines and the 3 tiers nested correctly.
7. `DELETE /api/sub-pipelines/{Influencer Track id}/` → **400** with `"Can't delete 'Influencer Track' — 1 lead or tier still attached. Deactivate it instead…"` ✅
8. `PATCH /api/sub-pipelines/{id}/ {is_active: false}` → 200; `?event=&is_active=true` filter now returns only `["Sponsors"]`.
9. `GET /api/leads/?event_interest=` for Mumbai 2027 still returns the lead with `sub_pipeline_name="Influencer Track"` and `package_tier_name="Standard"` populated.
10. `tsc --noEmit` clean across the entire frontend; `python manage.py check` clean.

### Out of scope (parked)

- Small UI tweaks → Phase 2.10.
- Email automation → Phase 3.
- Deploy → Phase 4.

---

## Phase 2.10 — Dual-currency tier prices + per-lead deal currency ✅ (7/7)

LexTalk World runs India events (INR) and Dubai (USD). The CRM previously only handled INR. Phase 2.10 adds a dual-price tier column and per-deal currency storage without touching the dashboard revenue tiles (deferred — all existing data is INR, acceptable until a future phase splits the tiles).

### Locked decisions

- **Two price columns on `PackageTier`**: `default_price_inr` (renamed from `default_price` — data preserved via `RenameField` migration) + `default_price_usd` (nullable). Admin enters whichever apply; either or both can be blank.
- **`Lead.deal_currency`** (`INR` / `USD`, default `INR`) stored alongside `deal_value`. One deal = one currency, explicit.
- **No live FX conversion, no auto-fill.** Tier prices are reference only; the actual deal value is whatever was negotiated.
- **Dashboard revenue tiles untouched.** All existing rows have `deal_currency=INR`. A future phase will split tiles to "Revenue (₹)" + "Revenue ($)".

### Sub-step checklist

| # | Step | Status |
|---|---|---|
| 2.10.1 | Backend: `PackageTier.default_price` → `default_price_inr` (RenameField preserves 63 INR values) + `default_price_usd` (AddField); `Lead.deal_currency` (AddField, default INR); migration `0008`. Admin `list_display` + `list_editable` updated. | ✅ |
| 2.10.2 | Backend: `LeadDetailSerializer` exposes `deal_currency`; validation — if `deal_value` set and `deal_currency` explicitly cleared, 400. | ✅ |
| 2.10.3 | Backend: `seed_tiers` 4-tuple format adds `default_price_usd` (Sponsors $25k/$12k/$6k; Delegates $300/$900/$120); `seed_leads` picks `deal_currency` (20% USD for Dubai leads with USD-priced tiers). | ✅ |
| 2.10.4 | Frontend types: `PackageTier`, `PackageTierBrief`, `NestedTier` use `default_price_inr`/`default_price_usd`; `LeadDetail` adds `deal_currency`; new `Currency` literal + `CURRENCY_SYMBOL` map. | ✅ |
| 2.10.5 | Frontend admin: `TierFormModal` two price inputs side-by-side (₹ / $); `/admin/pipelines` tier table column renamed "Prices (₹ / $)" showing both values with `—` for missing. | ✅ |
| 2.10.6 | Frontend `LeadForm`: tier dropdown labels show `"VIP Pass — ₹75,000 / $900"` (only present currencies); deal-value row becomes amount input + ₹/$ pill toggle bound to `form.deal_currency`; `fromLead`/`toPayload` wire `deal_currency`. | ✅ |
| 2.10.7 | Polish + `tsc --noEmit` clean + `next build` clean + docs. | ✅ |

### Verification

1. `tsc --noEmit` — 0 errors.
2. `next build` — clean, 11 routes.
3. `python manage.py check` — 0 issues.
4. `seed_tiers` — tier USD prices populated (Sponsors + Delegate Passes).
5. `seed_leads` — 1 USD lead (Dubai + Delegate Passes), rest INR.
6. `LeadDetailSerializer` returns `deal_currency: "INR"` for all existing leads.
7. Hand-checked: tier dropdown in LeadForm would render `"Platinum Sponsor — ₹2,000,000 / $25,000"`.

---

## Phase 3.1 — Dashboard overhaul ✅ (4/4)

Admin dashboard was built before Phase 2.10 added `deal_currency`, so revenue was summed as a mixed INR+USD number and always rendered `₹`. This phase fixed that and added user-performance visibility.

### Changes

**Backend (`backend/dashboards/views.py`):**
- `_parse_month(request)` helper — reads `?month=YYYY-MM`, defaults to current month; uses `calendar.monthrange` (stdlib, no new deps).
- `DashboardView`: revenue split into `revenue_month_inr` + `revenue_month_usd` via separate `Sum()` queries filtered by `deal_currency`. Month scoping now uses a proper `[month_start, month_end]` window so historical months are correct.
- `UserActivityView`: same revenue split; adds `leads_assigned` (active non-terminal leads on their plate) and `interactions_week` (all interaction types this week) to each user row.

**Frontend:**
- `lib/api/types.ts` — `DashboardKpis` / `UserActivityRow` replace `revenue_month` with `revenue_month_inr` + `revenue_month_usd`; `UserActivityRow` adds `leads_assigned`, `interactions_week`.
- `lib/api/dashboards.ts` — both methods accept optional `month?: string` forwarded as `?month=`.
- `admin/page.tsx` — month picker `<input type="month">` in header; re-fetches both endpoints on change.
- `KpiGrid.tsx` — revenue tile shows `₹X` as value + `"+ $Y in USD"` hint (hint suppressed when USD is 0); `IndianRupee` icon → `Banknote`.
- `UserActivityTable.tsx` — 10 columns (was 7): added Interactions/wk, Leads assigned, split Rev (₹)/mo + Rev ($)/mo. Amber row highlight when `followups_due > 0 && leads_touched_today === 0` ("slacking" signal).

### Sub-step checklist

| # | Step | Status |
|---|------|--------|
| 3.1.1 | Backend `_parse_month()` + split revenue + `leads_assigned` + `interactions_week` | ✅ |
| 3.1.2 | Frontend types + `dashboards.ts` month param | ✅ |
| 3.1.3 | `admin/page.tsx` month picker + `KpiGrid.tsx` dual-currency tile | ✅ |
| 3.1.4 | `UserActivityTable.tsx` new columns + slacking highlight | ✅ |

### Verification

- `python manage.py check` + `tsc --noEmit` + `next build` all clean.
- `/api/admin/dashboard/` returns `revenue_month_inr` + `revenue_month_usd`, no `revenue_month`.
- `?month=2026-04` returns April data correctly.
- `/api/admin/user-activity/` rows include `leads_assigned`, `interactions_week`, `revenue_month_inr`, `revenue_month_usd`.

---

## Post-3.1 — Dashboard fully month-scoped ✅

After Phase 3.1, the dashboard had a confusing mix: some tiles (today/week) never changed when you moved the month picker; the user activity table showed monthly revenue but daily call counts in the same row.

**Fix: everything is now scoped to the selected month.**

**Backend (`backend/dashboards/views.py`):**
- Removed `leads_today`, `leads_week`, `conversions_today`, `conversions_week` from `DashboardView` response — these had no month-scoped equivalent.
- `leads_by_status` and `leads_by_event` now filter by `created_at` in the month window.
- `conversions_last_30_days` → `conversions_by_day` scoped to the selected month (not a rolling 30-day window).
- `avg_conversion_days` now computed from that month's won deals only.
- `UserActivityView`: `calls_today`/`emails_today`/`leads_touched_today` → `calls_month`/`emails_month`/`leads_touched_month`; `interactions_week` → `interactions_month`.
- `leads_assigned`: was "active non-terminal leads right now" → is now "leads created this month assigned to this user".
- `followups_due`: shown only when `is_current_month` is true; `null` for past months.

**Frontend:**
- `types.ts` — `DashboardKpis` trimmed to month-only fields; `DashboardPayload.conversions_last_30_days` → `conversions_by_day`; `UserActivityRow` fields renamed to `_month` suffix; `followups_due: number | null`.
- `KpiGrid.tsx` — simplified to 4 tiles (Leads, Conversions, Revenue ₹, Avg days to close), single grid.
- `Charts.tsx` — descriptions updated; `conversions_last_30_days` ref → `conversions_by_day`.
- `UserActivityTable.tsx` — all columns month-scoped; `followups_due` column conditionally rendered only for current month (hidden entirely for past months so there's no `—` confusion).
- `admin/page.tsx` — passes `isCurrentMonth` flag to `UserActivityTable`.

---

## Phase 3 — Email automation ⏳ (not started)

Models for `EmailTemplate` + `ScheduledEmail` are NOT yet built. Backend was structured so adding them later requires zero schema changes elsewhere. Add Celery + Redis + a beat task.

---

## Phase 4 — Deploy ⏳ (not started)

Vercel (Next.js) + Railway/Render (Django) + Neon (already live). Daily DB backup on Neon.

---

## How to resume after a context break

1. **Read this file** — current step and immediate next-up are at the top.
2. **Read `CLAUDE.md`** — workflow rules, decisions locked, known gotchas.
3. **Read `docs/PLAN.md`** — full design spec.
4. **Read `docs/BRAND.md`** — design tokens before writing UI.
5. **Verify both servers run**: `cd backend && source .venv/bin/activate && python manage.py runserver` and `cd frontend && npm run dev`.
6. Pick up at the **"⏳ NEXT"** step above, propose any sub-steps, and start working.

## When to update this file

- A step ships → flip its status to ✅ and bump "Currently working on" + "Next up after this".
- Scope changes mid-step → update the spec lines for that step.
- A whole phase ships → bump the "At a glance" table.

The user has explicitly asked us to keep this current. Treat it as part of the deliverable.
