# CLAUDE.md — AuraSphere: freight TMS + brokerage CRM (React SPA + FastAPI JSON API)

> Drop this file at the repo root. Claude Code reads it at the start of every session.
> Keep the **Current State / Next Step** section at the bottom updated before you end any session.

---

## What you are building

**AuraSphere — a modern freight TMS + brokerage CRM**, built for a freight broker who sits in the middle between **shippers** (customers with freight to move) and **carriers** (trucking companies that haul it). The center of the product is the **Load** (shipment): origin→destination stops, equipment, a **customer rate vs carrier rate → margin**, an assigned carrier, and a status workflow (Quote → Tendered → Offered → Covered → Dispatched → In Transit → Delivered → Invoiced; plus Lost/TONU). Around the Load sit rich **Carrier** profiles (MC/DOT, rating, compliance/insurance, equipment, lanes & capacity, lane history), lean **Shipper** accounts, **Contacts**, an **activity timeline**, **lane/rate pricing**, and (later) **tracking** with check-calls and a map.

It draws on a best-in-class brokerage TMS as the quality bar but is **its own product** — not a clone. The feel: **status-as-hero record headers, a contextual action row, KPI stat rows, dense two-column panels with in-panel tabs, inline edit, and loud alert badges** for missing/non-compliant data.

**Built as a product from day one:** each customer (a brokerage) is an isolated tenant (an "organization"). Initially one org (ours) uses it; the architecture supports selling it to other brokerages later via self-serve signup + billing. Favor "simple and working" over "clever and broad," but never compromise tenant isolation.

> Lineage: this began as a generic multi-tenant CRM (Phases 0–3: auth, accounts, a deal pipeline/kanban). That foundation — multi-tenant auth, the org-scoping isolation layer, the dark design system, and the CRUD/list/detail/kanban patterns — is reused. The "F-phases" below pivot the domain to freight; the old deal-pipeline kanban becomes the **Load status board**.

## This project is 100% separate from CALCOR

- Its own GitHub repo. Its own Render project: its own web service(s) and its own Postgres instance. Its own domain and its own secrets.
- It NEVER shares a database, imports code, or deploys together with CALCOR. They run fully independently.
- You MAY copy code from CALCOR (Render deploy config, Gmail OAuth flow, Apollo enrichment client) — copy the file in, adapt it, and add a header comment noting it came from CALCOR. Do not symlink, `pip install`, or import CALCOR at runtime.

## Stack (LOCKED — do not change without an explicit instruction)

Backend
- **FastAPI** (Python 3.11+), **Pydantic v2** schemas, JSON API only (no server-rendered HTML)
- **SQLAlchemy 2.x** + **Alembic** migrations
- **PostgreSQL** (managed Postgres on Render)
- Auth: **server-side sessions** in a DB table, delivered via an **httpOnly, Secure, SameSite=Lax cookie**; passwords hashed with **argon2 (passlib)**
- **CORS** configured for the SPA origin with credentials enabled

Frontend
- **React 18 + Vite + TypeScript**
- **React Router v6**, **TanStack Query** for all server state
- **Typed API client generated from the backend OpenAPI spec** (openapi-typescript + openapi-fetch, or orval) — never hand-write API types
- **react-hook-form + zod** for forms/validation
- **Tailwind** + a headless component layer (shadcn/ui or Radix) for accessible primitives
- **dnd-kit** for the deal kanban (added in its phase)

Repo / infra
- **Monorepo**: `/backend`, `/frontend`, `/docs`
- **Two Render services**: backend web service + frontend static site, plus one Postgres instance
- Cookie domain set so `app.<domain>` and `api.<domain>` share auth; CORS allows the app origin with credentials

Do not introduce a new dependency, framework, or pattern without first noting in your reply *why* it is needed and what it replaces.

## Tenancy & auth model (build this in Phase 1 — get it right before anything else)

- `organizations` is the tenant boundary. **Every business table carries `organization_id`.**
- Email is **globally unique**; a user belongs to **exactly one organization** (multi-org-per-user is a future enhancement, not now). This keeps login simple: email + password -> user -> org.
- Roles within an org: `owner` (billing/org control), `admin`, `member`.
- **Tenant isolation is non-negotiable.** A single auth dependency resolves the current user and their `organization_id`, and EVERY data query is scoped through it. Never accept an org id from the client. A user in org A must never be able to read or write org B's data — prove this with a test for every endpoint.

## Data model (target — freight)

```
organizations
  id, name, slug (unique), plan ('free'|'pro' — billing comes later), created_at

users
  id, organization_id -> organizations.id, email (globally unique),
  password_hash, full_name, role ('owner'|'admin'|'member'), is_active, created_at

sessions
  id, user_id -> users.id, token_hash, expires_at, created_at

shippers           (customers — freight to move)
  id, organization_id, name, domain, industry, phone, website,
  owner_id -> users.id, created_by, created_at, updated_at

carriers           (trucking companies that haul)
  id, organization_id, name, mc_number, dot_number, hq_city, hq_state,
  phone, email, status ('active'|'deactivated'),
  rating (0–5 nullable), on_time_pct, tracking_pct, bounce_pct (nullable),
  auto_liability (numeric nullable), cargo_coverage (numeric nullable),
  equipment_types (nullable), owner_id, created_by, created_at, updated_at

contacts           (people at a shipper OR carrier)
  id, organization_id, first_name, last_name, email, phone, title,
  shipper_id -> shippers.id (nullable), carrier_id -> carriers.id (nullable),
  owner_id, created_by, created_at, updated_at

loads              (shipments — the hero record)            [F2]
  id, organization_id, reference, status (workflow below),
  shipper_id, carrier_id (nullable), primary_contact_id (nullable),
  commodity, weight, equipment, total_miles,
  customer_rate (numeric), carrier_rate (numeric), margin (derived),
  owner_id, created_by, created_at, updated_at

stops              (pickup / delivery legs of a load)       [F2]
  id, organization_id, load_id, kind ('pickup'|'delivery'), sequence,
  city, state, zip, scheduled_at, arrived_at

lanes              (carrier lane + rate history)            [F3]
  id, organization_id, carrier_id, origin, destination, equipment,
  last_rate, shipments, last_ran

activities         (call / email / note / task)             [F4]
  id, organization_id, type, subject, body, due_at, completed_at,
  related_shipper_id, related_carrier_id, related_load_id, related_contact_id,
  owner_id, created_at, updated_at
```

**Load status workflow:** `quote → tendered → offered → covered → dispatched → in_transit → delivered → invoiced`, plus terminal `lost` / `tonu`. The board groups loads by status.

> **Interim (during F1):** Shippers are currently backed by the original `companies` table/`/api/companies` (renamed in the UI). The formal `companies → shippers` rename and `deals → loads` rework land in **F2**, where loads reference `shipper_id`/`carrier_id` and the FKs get finalized together. New work (Carriers, the load board) uses the target names.

Ownership rules within a tenant: `admin`/`owner` see and edit all records in their org; `member` sees all records but list views default to a toggleable "My records" filter. Records are reassignable by the owner or an org admin.

## Conventions

- Backend run: `uvicorn app.main:app --reload`
- Migrations: `alembic revision --autogenerate -m "..."` then `alembic upgrade head`
- Backend tests: `pytest -q` against a separate test database or a transactional-rollback fixture — never the dev DB
- Frontend run: `npm run dev`; build: `npm run build`
- Regenerate the typed client whenever backend schemas change (script this, e.g. `npm run gen:api`)
- Backend routers per domain: `app/routers/{auth,contacts,companies,deals,activities}.py`; Pydantic schemas in `app/schemas/`
- Config via env vars (`DATABASE_URL`, `SESSION_SECRET`, `FRONTEND_ORIGIN`, ...). Ship `.env.example` for each app. Never commit secrets.

## Build phases — work ONE at a time, in order

Do not start a phase until the previous one runs and its checks pass.

### Foundation (DONE — generic CRM, now repurposed)
- **Phase 0 — Monorepo scaffold.** FastAPI `/health` + CORS + OpenAPI; Vite/React/TS; typed-client gen; Render config; `.env.example`. ✅
- **Phase 1 — Tenancy + users + auth.** Org/users/sessions, cookie-session auth (argon2), the org-scoping dependency, roles, seed commands; login/isolation tests. ✅
- **Phase 2 — Accounts + Contacts.** CRUD + list (search/sort/page/filter) + ownership + isolation; list/detail/forms; the reference vertical slice both layers. ✅ *(its `companies` table now backs Shippers.)*
- **Phase 3 — Pipeline kanban (dnd-kit).** Stage board with optimistic, persisted drag. ✅ *(becomes the Load board in F2.)*

### Freight pivot (F-phases — current track)
- **F1 — Accounts split + app shell.** Add **Carriers** (MC/DOT, rating, on-time/tracking/bounce, insurance auto-liability + cargo, equipment) with CRUD + isolation tests; let **Contacts** link a shipper *or* carrier. Relabel Companies → **Shippers** (UI). Build the reusable shell — **status-hero record header, contextual action row, KPI stat row, panel + in-panel tabs** — and apply it to Shipper + Carrier detail. Nav: Dashboard · Shippers · Carriers · Contacts · (Deals interim).
- **F2 — Loads + load board (THE centerpiece).** Rename `companies→shippers`, `deals→loads`; add stops (pickup/delivery), commodity/weight/equipment/miles, **customer rate − carrier rate = margin**, carrier assignment, and the freight **status workflow**. The kanban becomes the **Load status board**. Load detail = the hero page (header status, action row, rates/margin panel, route & stops, carrier panel). Tests: status transitions, margin math, isolation.
- **F3 — Carrier ops.** Compliance/insurance gating, ratings, equipment, **lanes & lane-rate history**, capacity. Carrier profile filled out.
- **F4 — Activities + timeline.** Log calls/emails/notes/tasks against loads/carriers/shippers; chronological timeline on detail pages; "My open tasks." Verify association + isolation.
- **F5 — Pricing + dashboard.** Lane rate history, margin/KPIs (loaded $, avg margin, on-time), pipeline value by status, market-insight panels, recent activity. Simple charts.
- **F6 — Tracking.** Stops + check-calls/pings + a map; ETA; status auto-advance hooks.
- **Product track (gated — do NOT build until told).** Deploy (Postgres + cross-site cookie fix), self-serve brokerage signup + email verification, Stripe plan-gating, integrations (Gmail/Apollo copied + adapted from CALCOR).

## Guardrails (read this every session — these prevent the loops and the leaks)

1. **Tenant isolation first.** Every data query goes through the org-scoping dependency. For every new endpoint, write a test proving org A cannot see org B. A missing scope is a critical bug, not a polish item.
2. Work only within the current phase's scope. Do not refactor or touch files outside it.
3. Keep the typed API client regenerated after backend schema changes. Never hand-write API types that can drift from the backend.
4. The backend is the source of truth for validation. Mirror it with zod on the frontend, but never trust the client.
5. Before claiming a task is "done," actually run the relevant app(s) and `pytest`, and paste the real output. No "this should work."
6. When a bug recurs, write a failing test that reproduces it FIRST, then fix it.
7. Prefer the smallest change that works. Do the boring version before the clever one.
8. Do not import from CALCOR at runtime. Copying a file in and adapting it is fine; mark copied files with an origin comment.
9. If intended behavior is unclear, ask one specific question instead of guessing.
10. At the END of every session, update the section below.

## Current State / Next Step

- Current phase: **F1 (complete)** — freight pivot: accounts split + app shell.
- Direction: AuraSphere is now a **freight TMS + brokerage CRM** (own product). Foundation phases 0–3 stand; the F-phases pivot the domain. See "What you are building" + the F-phases above.
- Last completed: F1 — Carriers + the reusable record shell.
  - Backend: new `carriers` table/model (MC/DOT, hq, phone/email, status, rating, on-time/tracking/bounce, auto-liability + cargo, equipment) with full CRUD (`app/routers/carriers.py`), org-scoped + ownership, search/pagination. Contacts can now link a **shipper (company) or carrier** — added `contacts.carrier_id` (nullable FK), validated in-org (422), embedded `carrier {id,name}` on `ContactOut`. One Alembic migration (`275491d1d606`) creates `carriers` + adds `contacts.carrier_id` (batch mode for SQLite FK). 26 tests pass (adds carrier CRUD/search/isolation + contact→carrier link + cross-org reject).
  - Frontend: reusable shell in `src/components/shell.tsx` — `RecordHeader` (status hero), `KpiStrip`, `Panel`, `Tabs`, `AlertBadge`, `Rating`. Carriers feature (`src/features/carriers/`): list (rating + status badges), profile (status header + KPI strip + Overview/Compliance/Lanes tabs, compliance shows an alert badge when no insurance), create/edit form. Nav relabeled to **Shippers · Carriers · Contacts · Deals**; dashboard cards updated; contact form/detail gained a Carrier link. `npm run build` passes.
  - **Interim debt (resolve in F2):** Shippers are still the `companies` table/`/api/companies`; UI says "Shippers" but URLs are `/companies`. The formal `companies→shippers` + `deals→loads` rename lands in F2 with the load board.
- Earlier (foundation): Deals + pipeline + kanban (Phase 3).
  - Backend: pipelines/stages with one default pipeline seeded per org (`app/defaults.py` `ensure_default_pipeline`, idempotent; called by `seed-org` and lazily by `GET /api/pipelines`). Default stages: New, Qualified, Proposal, Negotiation, Closed Won (`is_won`), Closed Lost (`is_lost`). Deal CRUD (`app/routers/deals.py`) with list (search/filter by pipeline/stage/owner, pagination), org scoping, and link validation (company/contact must be in-org → 422). Dedicated kanban endpoint `PATCH /api/deals/{id}/stage` validates the target stage is in the deal's pipeline (422 otherwise) and stamps/clears `closed_at` on won/lost. DealOut embeds company + primary-contact summaries. No new migration (pipeline/stage/deal tables existed from Phase 1; added only ORM relationships).
  - Frontend: dnd-kit kanban board (`src/features/deals/`) — columns are stages, cards are deals; dragging a card calls the stage endpoint via an **optimistic** TanStack Query mutation (`useChangeStage`, rolls back on error). Board/List view toggle, "My deals" filter, create/edit form, deal detail page, per-column value totals. Nav + dashboard cards updated. `npm run build` passes.
  - Tests (`backend/tests/`): 21 passing — adds pipeline seeding, deal create defaults to first stage, stage-change persists + sets `closed_at`, foreign-stage rejected (422), and full deal tenant isolation (404 cross-org).
  - Verified live: drag-drop survives a page reload (Playwright drag → reload → card stays in new column).
- Earlier (Phase 2): Contacts + Companies — the reference vertical slice, both layers.
  - Backend: full CRUD for `companies` and `contacts` (`app/routers/{companies,contacts}.py`) with list endpoints supporting search, `owner_id` filter (drives "My records"), sort whitelist, and pagination (returns `Page[...]` from `app/schemas/common.py`). Ownership enforced via `OrgScope.can_edit` (admins/owners edit any org record; members edit only their own); cross-org access returns 404. Contact→company linking validates the company is in the caller's org (422 otherwise) and embeds a `{id,name}` company summary on `ContactOut`. Added org-scoped `GET /api/users` for owner/reassign dropdowns. All scoped through `OrgScope`.
  - Frontend: regenerated typed client; model types are derived from the generated OpenAPI schemas in `src/lib/api.ts` (no hand-written API types). TanStack Query hooks per feature (`src/features/{companies,contacts,users}/api.ts`), list views with search + "My records" toggle + pagination, detail pages, create/edit forms (react-hook-form + zod), delete, and contact→company linking via a company select. Shared `Layout` with nav + logout. `npm run build` passes.
  - Tests (`backend/tests/`): 16 passing — adds companies CRUD cycle, list search/pagination, member-cannot-edit-others, cross-org 404, and contacts CRUD + company-link validation + cross-org link rejection + contact isolation.
- Earlier (Phase 1): Tenancy + users + cookie-session auth.
  - Models for all core tables (`organizations`, `users`, `sessions`, `companies`, `contacts`, `pipelines`, `stages`, `deals`, `activities`), each business table carrying `organization_id` (`app/models.py`). One Alembic migration creates the whole schema; `alembic upgrade head` runs clean.
  - Auth: argon2 password hashing (`app/security.py`); server-side sessions in the `sessions` table delivered via an httpOnly, SameSite=Lax cookie (Secure toggled by `COOKIE_SECURE`); only the SHA-256 token hash is stored. Endpoints: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
  - Tenant isolation: `OrgScope` dependency (`app/deps.py`) whose `.query(Model)` is pre-filtered to the caller's `organization_id`; org id is never accepted from the client. `require_role(...)` enforces owner/admin/member. A scoped `GET /api/companies` read endpoint exists as the isolation proof slice (full Contacts/Companies CRUD is Phase 2).
  - Seed: `python -m app.seed [seed-org|seed-admin|all]`, idempotent, driven by `SEED_*` env vars; admin is created as `owner`.
  - Frontend: `AuthProvider` (resolves `/api/auth/me` on load), `ProtectedRoute`, login page (react-hook-form + zod), logout, React Router v6, TanStack Query provider wired. Typed client regenerated; `npm run build` passes.
  - Tests (`backend/tests/`): 8 passing — login success/failure, `/me` auth gate, logout invalidation, and tenant isolation (user in org A sees only org A's companies; org B's data invisible; unauth rejected).
  - Note: `EmailStr` rejects `.test` TLDs — use real-looking domains (e.g. `admin@example.com`) for seed/admin emails.
- Next concrete step: Phase 4 — Activities + timeline (log call/email/note/task/meeting, task due dates + completion, chronological timeline on contact/company/deal detail pages, a "My open tasks" view).
- Open decisions / blockers: _none_

---

# Appendix: phase prompt sequence (paste one at a time into Claude Code)

**Phase 0**
> Read CLAUDE.md fully. Execute Phase 0 only. Scaffold the monorepo with the locked stack: `/backend` FastAPI JSON API (Pydantic v2) with a `/health` endpoint, CORS configured for the frontend origin with credentials, SQLAlchemy + Alembic initialized, and OpenAPI exposed; `/frontend` Vite + React + TypeScript app that fetches and renders `/health`; a scripted typed-client generation step from the backend OpenAPI; Render config for a backend web service, a frontend static site, and Postgres; and `.env.example` for each app. Do not create any business models yet. Run both apps and `alembic upgrade head`, paste the output, and update Current State.

**Phase 1**
> Read CLAUDE.md. Execute Phase 1 only. Create Alembic migrations for organizations, users, sessions, and all core tables (each with organization_id). Implement cookie-session auth (argon2), the org-scoping auth dependency, role checks (owner/admin/member), and seed-org + seed-admin commands driven by env vars. Frontend: login page, auth context, protected routing, logout. Write pytest covering login/logout AND tenant isolation (a user in org A cannot read org B's data). Run apps + tests, paste output, update Current State.

**Phase 2**
> Read CLAUDE.md. Execute Phase 2 only. Build Contacts and Companies across both layers. Backend: CRUD endpoints, list with search/sort/pagination/filter, ownership + org scoping, Pydantic schemas. Frontend: regenerate the typed client, then list views with TanStack Query, detail pages, create/edit forms (react-hook-form + zod), delete, the "My records" toggle, and contact→company linking. Keep structure clean and consistent — this is the reference pattern later objects copy on both layers. Tests: CRUD, ownership, tenant isolation. Run apps + tests, paste output, update Current State.

**Phase 3**
> Read CLAUDE.md. Execute Phase 3 only. Add pipelines/stages (seed one default per org), deal CRUD, and a kanban board with dnd-kit where dragging a deal between columns persists the stage change via an optimistic TanStack Query mutation. Add a deals list view. Test the stage-change endpoint and isolation. Run apps + tests, paste output, update Current State.

**Phase 4**
> Read CLAUDE.md. Execute Phase 4 only. Add activities (call/email/note/task/meeting), task due dates + completion, a chronological timeline on contact/company/deal detail pages, and a "My open tasks" view. Test association + isolation. Run apps + tests, paste output, update Current State.

**Phase 5**
> Read CLAUDE.md. Execute Phase 5 only. Build a dashboard: open-deal count, pipeline value by stage, my tasks due this week, recent activity. Keep charts simple. Run apps, paste output, update Current State.

**Phase 6**
> Read CLAUDE.md. Execute Phase 6 only. Add CSV import for contacts and companies with a column-mapping step, CSV export for any list view, bulk owner reassign, and saved filters. Test the import parser against a messy sample CSV, including that imported rows get the correct organization_id. Run apps + tests, paste output, update Current State.
