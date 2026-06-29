# CLAUDE.md — Multi-tenant CRM (React SPA + FastAPI JSON API)

> Drop this file at the repo root. Claude Code reads it at the start of every session.
> Keep the **Current State / Next Step** section at the bottom updated before you end any session.

---

## What you are building

A multi-tenant CRM. Feature scope mirrors the core of HubSpot / Salesforce / Zoho — contacts, companies, a deal pipeline, and activity tracking — with multi-user auth and per-record ownership. **It is built as a product from day one:** each customer company is an isolated tenant (an "organization"). Initially only one organization (ours) uses it, but the architecture supports selling it to other companies later by flipping on self-serve signup and billing. Favor "simple and working" over "clever and broad," but never compromise tenant isolation.

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

## Data model

```
organizations
  id, name, slug (unique), plan ('free'|'pro' — billing comes later), created_at

users
  id, organization_id -> organizations.id, email (globally unique),
  password_hash, full_name, role ('owner'|'admin'|'member'),
  is_active, created_at

sessions
  id, user_id -> users.id, token_hash, expires_at, created_at

companies          (accounts)
  id, organization_id, name, domain, industry, phone, website,
  owner_id -> users.id, created_by, created_at, updated_at

contacts
  id, organization_id, first_name, last_name, email, phone, title,
  company_id -> companies.id (nullable),
  owner_id -> users.id, created_by, created_at, updated_at

pipelines
  id, organization_id, name, is_default

stages
  id, organization_id, pipeline_id, name, sort_order, is_won, is_lost

deals              (opportunities)
  id, organization_id, name, amount (numeric), pipeline_id, stage_id,
  company_id (nullable), primary_contact_id (nullable),
  owner_id -> users.id, expected_close_date, closed_at,
  created_by, created_at, updated_at

activities         (call / email / note / task / meeting)
  id, organization_id, type, subject, body,
  due_at (nullable), completed_at (nullable),
  related_contact_id (nullable), related_company_id (nullable), related_deal_id (nullable),
  owner_id -> users.id, created_at, updated_at
```

Ownership rules within a tenant: `admin`/`owner` see and edit all records in their org; `member` sees all records in the org but list views default to a toggleable "My records" filter. Records are reassignable by the owner or an org admin.

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

- **Phase 0 — Monorepo scaffold.** `/backend` FastAPI JSON API booting with `/health`, CORS, and OpenAPI exposed. `/frontend` Vite+React+TS booting and successfully calling `/health`. Typed-client generation wired up. Render config for both services + Postgres. `.env.example` for each. Verify: both apps boot, frontend renders the health response, `alembic upgrade head` runs clean.
- **Phase 1 — Tenancy + users + auth.** Migrations for `organizations`, `users`, `sessions`, and all core tables (each with `organization_id`). Cookie-session auth, the org-scoping dependency, role checks, a `seed-org` + `seed-admin` command. Frontend: login page, auth context, protected routes, logout. Verify with tests: login/logout works AND **a user in org A cannot read org B's data**.
- **Phase 2 — Contacts + Companies (reference vertical slice, both layers).** API: CRUD, list with search/sort/pagination/filter, ownership + org scoping. Frontend: typed client, list views (TanStack Query), detail pages, create/edit forms (react-hook-form + zod), delete, "My records" toggle, contact→company linking. This sets the pattern every later object copies on BOTH layers. Tests: CRUD + ownership + tenant isolation.
- **Phase 3 — Deals + pipeline.** Pipelines/stages (seed one default per org), deal CRUD, and a **kanban board** with dnd-kit; dragging a deal persists the stage change with an optimistic TanStack Query update. Verify: drag-drop survives refresh; isolation holds.
- **Phase 4 — Activities + timeline.** Log calls/emails/notes, tasks with due dates + completion, a chronological timeline on contact/company/deal detail pages, a "My open tasks" view. Verify association + isolation.
- **Phase 5 — Dashboard.** Open-deal count, pipeline value by stage, my tasks due, recent activity. Simple charts.
- **Phase 6 — Import/export + polish.** CSV import for contacts and companies with column mapping, CSV export of any list view, bulk reassign, saved filters.
- **Phase 7 — PRODUCT TRACK (later / gated — do NOT build until explicitly told).** In order: (a) self-serve signup that creates an organization + its first `owner` and email verification; (b) Stripe subscriptions and plan-gating; (c) integrations — email logging via Gmail OAuth and contact/company enrichment via Apollo, both COPIED and adapted from CALCOR.

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

- Current phase: **Phase 0 (complete)**
- Last completed: Monorepo scaffold landed. Backend FastAPI JSON API boots with `/health`, CORS for the frontend origin (credentials enabled), and OpenAPI exposed; SQLAlchemy + Alembic initialized and `alembic upgrade head` runs clean. Frontend Vite + React + TS app builds and fetches/renders `/health`. Typed-client generation wired (`npm run gen:api` → `src/types/api.ts`) and verified against the live backend. `render.yaml` (backend web service + frontend static site + Postgres) and `.env.example` for each app present. Fixed a scaffold dependency conflict: pinned `typescript` to `~5.9.3` so `openapi-typescript@7` (the locked typed-client generator) resolves.
- Next concrete step: Phase 1 — tenancy + users + cookie-session auth + org-scoping dependency, with tenant-isolation tests.
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
