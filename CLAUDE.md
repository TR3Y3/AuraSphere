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

> **Interim:** Shippers are still backed by the original `companies` table/`/api/companies` (relabeled "Shippers" in the UI); `loads.shipper_id` FKs to `companies.id`. The formal `companies → shippers` table/endpoint rename is deferred (low-risk, cosmetic) — do it in a dedicated cleanup pass. `deals` were superseded by `loads`: the deals **backend** remains as legacy (still tested) but is unused by the UI; remove it when convenient.

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
- **F1 — Accounts split + app shell.** ✅ Carriers (MC/DOT, rating, on-time/tracking/bounce, insurance, equipment) + reusable record shell (status-hero header, action row, KPI strip, panel/tabs, alert badge, rating). Contacts link a shipper *or* carrier. Companies relabeled → Shippers (UI).
- **F1.5 — Layout & identity (current).** Move from the left sidebar to a **top app bar** (org brand · primary nav · More menu · global search · "+ New" quick actions · notifications · avatar) — matches the reference TMS and opens full width for dense views. **Per-tenant branding:** the platform is AuraSphere, but each org shows its own display name + accent color (`organizations.accent_color`); logged in as CorTrans → CorTrans branding. Login page keeps the platform brand.
- **F2 — Loads + load board (THE centerpiece).** Rename `companies→shippers`, `deals→loads`; add stops (pickup/delivery), commodity/weight/equipment/miles, **customer rate − carrier rate = margin**, carrier assignment, and the freight **status workflow** (Quote is the first status). The kanban becomes the **Load status board**. Load detail = the hero page (header status, action row, rates/margin panel, route & stops, carrier panel). Tests: status transitions, margin math, isolation.
- **F3 — Carrier ops.** Compliance/insurance gating, ratings, equipment, **lanes & lane-rate history**, capacity. Loud compliance flags.
- **F4 — Activities + timeline.** Log calls/emails/notes/tasks against loads/carriers/shippers; chronological timeline; "My open tasks."
- **F5 — Pricing + dashboard.** Lane rate history, margin/KPIs (loaded $, avg margin, on-time), value by status, market-insight panels.
- **F6 — Tracking.** Stops + check-calls/pings + a map; ETA; status auto-advance hooks.

### Signature features (our original twist — make it better than the gold standard)
- **S1 — Live Quote Desk.** A collaborative quote workspace where **customer-facing and carrier-facing reps interact on the same quote/load in real time** (shared options list, target vs offered rate, margin live, status hand-off). Builds on F2 loads (Quote status) + F5 pricing.
- **S2 — Shipper Lead-Gen.** A **customer-facing prospecting tool** that finds companies that ship + their logistics decision-maker contacts, dedupes against the CRM, and creates Shipper + Contact records (builds on the `add-prospects` skill; web research first, paid enrichment only when needed). Surfaces freight-fit signals.
- *(Carrier-quality/compliance + margin/pricing emphasis run THROUGH F2/F3/F5 rather than as a separate phase: loud flags, margin everywhere, pricing targets in the load view.)*

### Product track (gated — do NOT build until told)
- Deploy (Postgres + cross-site cookie fix), self-serve brokerage signup + email verification, Stripe plan-gating, integrations (Gmail/Apollo copied + adapted from CALCOR).

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

## Launch audit log (readiness pass, 2026-07-06)

**Phase 1 — architecture/tenancy verification (no code changes):**
- Stack confirmed as locked spec: FastAPI 0.104 / SQLAlchemy 2.0 / Alembic / Pydantic v2 / psycopg2 (Postgres prod, SQLite dev-test); React 18 + Vite + TS, TanStack Query, RHF+zod, dnd-kit; typed client generated from OpenAPI. No SDK deps for Stripe/Resend (httpx).
- Deployment target: Render Blueprint (`render.yaml`) — backend web service (migrate-on-build: `alembic upgrade head`), frontend static site w/ SPA rewrite, managed Postgres. Secrets are `sync:false` env vars; stub/console modes are the defaults for email/billing/vetting/DAT/ELD.
- Multi-tenancy enforcement verified by sweep: all business queries go through `OrgScope.query()` (pre-filtered `organization_id`); the only raw `db.query` uses are auth flows (globally-unique email/token lookups — correct) and org-self lookups filtered to `scope.org_id`. Client never supplies org id.
- Auth boundary sweep (every endpoint): all business endpoints carry `get_scope`/`get_current_user`/`require_role`. Intentionally public: auth endpoints, `/health`, billing webhook (Stripe-signature-verified, 5-min replay tolerance). **Finding: `GET /api/loads/board` is unauthenticated** — returns only static workflow constants (no org data), low severity, fix for consistency.
- Sessions: httpOnly cookie, hash-only storage, expiry enforced + expired-session cleanup, `is_active` check on every request. Passwords argon2. Reset/verify/invite tokens single-use, hash-only.
- Test suite: 121 passing; 28 test files; isolation tests present for every business domain.

**Phase 2 — multi-user readiness audit (findings only, prioritized):**
- BLOCKERS: (B1) Quote Desk `accept_option` race — two reps accepting different options concurrently both pass the status guard; last write wins carrier/rate and both options end "accepted" (fix: conditional update/row lock). (B2) operational: flip `EMAIL_DELIVERY=resend` + key or invites/resets never reach testers. (B3) `GET /api/loads/board` unauthenticated (no data leak; one-line consistency fix).
- SHOULD-FIX-SOON: (S1) documents list loads LargeBinary `data` into memory to render filenames — defer the column. (S2) prospects list N+1 (dupe-check query per row, up to 200/page) — batch. (S3) no rate limiting on login/signup/forgot-password (argon2 mitigates; add a simple limiter). (S4) permission inconsistency: members can delete documents/check-calls/capacity on loads they can't edit — align with `can_edit`. (S5) check-then-insert races (signup email, org slug, invite, free-plan load cap) surface as raw 500 IntegrityError instead of 409 — add handler. (S6) no global exception handler (500s lack CORS headers → browser shows opaque network error) and no React error boundary (white-screen risk).
- CAN-WAIT: composite indexes on loads (org_id+status, shipper/carrier/owner) — fine at 10-user scale; unused `SESSION_SECRET` env cruft; expired-session rows only purged on access; dashboard/lane-pricing compute in Python over all org loads (noted in code, fine at brokerage scale); board drag last-write-wins staleness (websockets later); ESLint layer absent.
- Verified healthy: sessions indexed by token_hash (per-request lookup is O(log n)); DB pool defaults fine for 10 users; prod/dev/test DB separation correct (conftest forces its own sqlite; Render injects Postgres; `SameSite=none` forces Secure; CORS exact origin; secrets `sync:false`); single-commit atomic request flows; optimistic board mutation rolls back on error; email verification is banner-only by design (not an access gate).

**Phase 3 — original requirements vs. built (verified against code, not just the log):**
- All core phases (0–3, F1–F6), signature features (S1/S2), elite polish, and the un-gated product track (signup/email/Stripe/vetting/DAT/ELD) are implemented and tested. Session feedback items all shipped except the carrier-facing app (intentionally deferred flagship).
- Deviations found: **no `stops` table** — loads are single-pickup/single-drop via origin/dest fields (spec's data model called for multi-stop; F6 map + check-calls built on the simpler shape); **no `lanes` table** — lane history derived from loads (intentional, documented, arguably better); `organizations.logo_url` column exists but no UI uses it (accent_color is the branding mechanism); F6 "map" is the schematic route bar + external OSM links, not embedded tiles (deliberate: iframes broke on locked-down networks).
- Intentional deferrals on record: companies→shippers rename (interim debt note), legacy deals backend removal, Gmail email-logging + factoring integrations (in docs/integrations.md), carrier-facing app, Apollo enrichment.
- Old generic-CRM appendix Phase 6 (CSV export, bulk owner reassign, saved filters) was superseded by the freight pivot — never explicitly re-scoped; Lead-Gen CSV **import** exists, export/saved-filters do not.

**Phase 4 — competitive positioning (researched: Rose Rocket, Alvys, Tai, Turvo, McLeod PowerBroker, Revenova, HubSpot):**
- Market read: HubSpot = pipeline/email strength, zero freight ops (no loads/margins/docs) — our CRM+TMS-in-one is the wedge against it. McLeod/Revenova = deep but heavy/expensive (Salesforce tax, long onboarding) — our wedge is speed + price + modern UX. The real fight is the modern mid-market tier (Rose Rocket, Alvys, Tai, Turvo): their moats are (a) portals (customer/carrier), (b) document generation + automation (rate cons/BOLs/invoices from load data; Tai's email-AI "builds shipments from the inbox, ~11 hrs/wk saved"), (c) integration breadth (Alvys 120+, native EDI, QuickBooks), (d) exception-based ops (Turvo auto-flags, churn prediction).
- Top gaps vs. them (ranked): 1) document GENERATION (we only store uploads — rate con/BOL/invoice PDFs from load data is table stakes, ~5-10 min/doc/load saved); 2) invoicing/QuickBooks; 3) customer(shipper) portal; 4) email-to-load AI intake; 5) real EDI/integration breadth. Carrier portal (already planned) is the matching moat play.
- Differentiators we already have that they don't at our price point: Live Quote Desk (collaborative rep workspace), margin-everywhere with low-margin flags, per-tenant branding, freight-fit-scored Lead-Gen with CSV import, 10-minute self-serve signup (vs. weeks of onboarding), all integrations stub-first demoable.
- Suggestion list (what/why/effort) delivered in chat: rate-con+BOL PDF generation (M), one-click "cover → rate con → email carrier" flow (S-M, ties to doc gen), exception dashboard "needs attention now" (M), email-to-load AI intake (M-L), shipper churn/reactivation cues on dashboards (S), command-bar actions beyond search (S-M), invoicing + QuickBooks export (M-L), shipper portal (L), saved views/CSV export (S), UI vibe pass — density/motion/emptystates (S-M).



- Current phase: **Test-user readiness** — working through product feedback. Done so far: quotes off the dashboard/board + margin-not-measured-until-tendered, load action-row redesign (subtle Lost/TONU/delete, Duplicate tooltip, contextual forward buttons), DAT auto-post (`loads.dat_posting_id`, `POST/DELETE /api/loads/{id}/dat-post`, form checkbox + board badge), and **teammate invites + password reset** (`password_reset_tokens` table, migration `90ba38485c98`; `POST /api/auth/forgot-password` [always 204, no enumeration] + `/reset-password` [single-use, logs in], `POST /api/users/invite` [owner/admin, creates the user + emails a set-password link]; frontend `/forgot-password` + `/reset-password` pages, login link, Team panel on `/settings`). 113 tests pass. Also done: richer list filters (loads/carriers/shippers), Lead-Gen CSV import + broadened search, **empty-state onboarding** ("Get started" checklist on the dashboard, auto-hides when set up) and an **in-app feedback** widget (💬 in the app bar → `POST /api/feedback` emails the team via the send_email seam; `FEEDBACK_EMAIL` config). 121 tests pass. Remaining: carrier-facing app (big/deferred). Only launch blocker left: **turn on Resend email** (`EMAIL_DELIVERY=resend` + `RESEND_API_KEY`) so signup/invite/reset/feedback emails actually send.
- Earlier phase: **Product track — ELD telematics integration (complete)**. Next candidates: Gmail email-logging, factoring; or deferred cleanup (companies→shippers rename, remove legacy deals backend).
- Last completed: ELD / telematics auto GPS pings (feeds the F6 tracking / check_calls) with a stub mode + a real-provider seam.
  - Backend: `app/eld.py` — `ELD_MODE` of `stub` (default; `_stub_location` synthesizes a plausible truck position that advances origin→dest per poll: pseudo lat/lng from hashed place strings interpolated by a progress fraction that grows with existing ping count, a labeled city near the nearest endpoint, and an ETA from remaining miles ÷ ~50mph) or `samsara` (real provider via `ELD_API_KEY`, same shape, stub fallback). **No new table** — reuses F6 `check_calls`. Router `app/routers/eld.py` (nested under `/api/loads/{id}/eld`): `POST /sync` (poll + create a check-call; `can_edit` gate; 422 if not locatable) + `GET /status` (`{connected, provider}`) — org-scoped, 404 cross-org. 104 tests pass (sync creates GPS check-call, position advances across syncs, status=demo in stub, isolation).
  - Frontend: **Tracking tab** gained an `ELD: demo/connected` badge + a **⟳ Sync ELD** button on the current-location panel — one click pulls the truck's position as a check-call (updates the route map + history). `npm run build` passes; verified live (Playwright: two syncs → truck advances toward Dallas, auto-pings in history).
- Earlier: DAT market rates (spot rate lookup by lane + equipment) with a stub mode + a real-provider seam.
  - Backend: `app/dat.py` — `DAT_MODE` of `stub` (default; `_stub_rate` derives a deterministic spot rate from equipment base $/mile × a hashed lane factor (±15%), scaled by miles → low/avg/high per-mile + totals + confidence) or `dat` (real DAT RateView API via `DAT_API_KEY`, same shape, stub fallback). **No DB table/migration** — pure lookup. Router `app/routers/market.py`: `GET /api/market/rate?origin=&dest=&equipment=&miles=` (auth-only; rates aren't org data) + `GET /api/market/rate/load/{id}` (uses the load's own lane/equipment/miles; 404 cross-org). 100 tests pass (deterministic, miles-scaling, reefer>van premium, per-load, auth-required, isolation).
  - Frontend: **Market rate (DAT)** panel on the load Overview (`src/features/loads/marketrate.tsx`) — a KPI strip (low/avg/high total + $/mile) and a buy-vs-market callout (green "under market — healthy margin room" / red "over market avg — margin at risk"). `MarketRate` type from OpenAPI. `npm run build` passes; verified live (Playwright: reefer 1080mi → avg $2,646, buy $2,000 → $646 under market).
- Earlier: Carrier vetting (authority + insurance + safety) with a stub mode + a real-provider seam.
  - Backend: `app/vetting.py` — `VETTING_MODE` of `stub` (default; `_stub_vet` derives a deterministic result from the carrier's own data: MC/DOT → authority, auto_liability+cargo_coverage → insurance_on_file, rating → safety_rating, weighted `risk_score` 0–100, `flags[]`, verdict `clear`/`review`/`fail`) or `highway` (real provider API via `HIGHWAY_API_KEY`, same return shape; falls back to stub). New `carrier_vettings` table (snapshot per run, `flags` JSON; migration `b6a843d1d456`). Endpoints on `app/routers/carrier_ops.py`: `POST /api/carriers/{id}/vet` (run + store), `GET /api/carriers/{id}/vetting` (latest or null) — org-scoped, 404 cross-org. 94 tests pass (clean→clear, missing authority/insurance→fail, no-rating→review, latest-snapshot, isolation).
  - Frontend: **Vetting tab** on the carrier detail (`src/features/carriers/VettingPanel.tsx`) — Run/Re-run check button, verdict badge (clear/review/fail), a KPI strip (safety score, authority, insurance, safety rating), flag alert badges, and a checked-at line. A vetting verdict badge also shows in the carrier header next to the compliance badge. New `b-warn`/`b-danger` badge styles. `CarrierVetting` type from OpenAPI. `npm run build` passes; verified live (Playwright: run check → Review verdict + 85 score + Conditional flag).
- Earlier: Stripe plan-gating (Free vs Pro) with a stub mode + a real-Stripe mode.
  - Backend: `app/plans.py` (plan catalog + entitlements: `max_loads` free=`FREE_MAX_LOADS` (50, env-tunable) / pro=unlimited, `is_pro`). `app/billing.py` — `BILLING_MODE` of `stub` (default; `start_checkout` upgrades the org immediately + returns the success URL so the upgrade→unlock loop is testable with no keys) or `stripe` (real Checkout + Billing Portal + webhooks via the **Stripe REST API over httpx — no SDK dependency**, matching `app/email.py`; webhook signature verified with stdlib hmac/hashlib + 5-min replay tolerance). `organizations` gained `stripe_customer_id` + `stripe_subscription_id` (migration `8f8f1f882eee`). Router `app/routers/billing.py`: `GET /api/billing` (plan, label, is_pro, configured, loads_used, max_loads, plan catalog), `POST /checkout` + `/portal` + `/downgrade` (all owner-only via `require_role`), `POST /webhook` (no auth; Stripe-signed). **Gate:** `loads` create + duplicate call `_enforce_load_limit` → 402 when a free org hits the cap. 89 tests pass (status, stub upgrade/downgrade, free cap blocks→pro unlocks, owner-only, webhook signature verify + apply, isolation). To go live: set `BILLING_MODE=stripe` + `STRIPE_SECRET_KEY`/`STRIPE_PRICE_ID`/`STRIPE_WEBHOOK_SECRET` and point a Stripe webhook at `/api/billing/webhook`.
  - Frontend: **Billing & plan** panel on `/settings` (`src/features/settings/BillingPanel.tsx`) — current-plan badge, "demo billing" badge in stub mode, a loads-used meter (free), Free vs Pro comparison cards, and owner actions: Upgrade to Pro (→ checkout URL redirect), Manage billing (Stripe portal) / Downgrade (stub). Returning with `?billing=success` refreshes plan + identity. `BillingStatus`/`PlanInfo` types from OpenAPI. `npm run build` passes; verified live (Playwright: Free → Upgrade → Pro, cap meter clears).
- Earlier: Real transactional email provider (Resend HTTP API) behind the existing `send_email` seam.
  - Backend: `app/email.py` now supports three delivery modes via `EMAIL_DELIVERY` — `console` (default, logs + signup returns the verify link), `resend` (Resend HTTP API via the already-present `httpx`; preferred in production since Render blocks outbound SMTP ports), `smtp` (classic). Sends are **best-effort**: `send_email` catches all errors, logs, and returns a bool — a down/misconfigured provider can never break signup. `RESEND_API_KEY` config added; signup exposes `verify_url` only in `console` mode now (real-provider modes send the link by email). `.env.example` + `render.yaml` document `EMAIL_DELIVERY`/`EMAIL_FROM`/`RESEND_API_KEY` (sync:false). No migration. 83 tests pass (adds console-no-send, resend payload/headers, swallowed-failure, signup-survives-email-failure). To go live: set `EMAIL_DELIVERY=resend` + `RESEND_API_KEY` on the backend and verify the `EMAIL_FROM` domain in Resend.
- Earlier: Self-serve brokerage signup + email verification.
  - Backend: `POST /api/auth/signup` (org_name + full_name + email + password) → creates a new Organization (unique slug derived from name via `_unique_slug`), an `owner` User, the default pipeline (`ensure_default_pipeline`), issues an email-verification token, sends the link, sets the session cookie, returns `SignupResult` (= MeOut + `verify_url`, exposed only in console email mode). Email globally unique → 409. New `email_verification_tokens` table (hash-only, single-use, superseded on resend) + `users.email_verified_at` column (migration `c4669a5cafe4`). `POST /api/auth/verify` {token} marks verified (single-use, expiry-checked → 400). `POST /api/auth/resend-verification` (auth) re-issues. `UserOut` gained computed `email_verified`. New `app/email.py` — `send_email` with "console" (logs; default) vs "smtp" delivery, behind config (`EMAIL_DELIVERY`, `EMAIL_FROM`, `SMTP_*`, `VERIFY_TTL_HOURS`); swap in SES/Postmark/Resend later behind the same signature. 79 tests pass (adds signup→org+owner+pipeline+login, duplicate-email 409, slug uniqueness, verify single-use + bad/expired token, resend, new-org isolation).
  - Frontend: **Signup page** (`/signup`, org name + name + email + password, react-hook-form + zod) → creates the tenant and lands in-app; **Verify page** (`/verify?token=…`, POSTs once via a ref guard, refreshes identity, success/expired states); a **verify-email banner** in the app shell (amber, with Resend) shown while `me.user.email_verified` is false. Login ↔ Signup cross-links. `AuthContext` gained `signup` + `refresh`. `npm run build` passes; verified live (Playwright: signup → branded isolated workspace + banner; verify page → "✓ verified").
- Earlier: F6 — load tracking with check-calls, a route map, ETA, and a status auto-advance hook.
  - Backend: new `check_calls` table/model (`organization_id`, `load_id`, city/state, latitude/longitude [Numeric 9,6], status_note, note, eta, reported_at, created_by, created_at). Router `app/routers/tracking.py` (nested under `/api/loads/{id}/checkcalls`): list (newest reported first = current position), create (org-scoped, `can_edit` gate, optional `advance_status` reuses loads.`_apply_status` to advance the load + stamp `delivered_at` → the **tracking hook**; invalid advance → 422 with nothing persisted), delete — all 404 cross-org/cross-load. Migration `91c0e5286cf1`. 72 tests pass (adds log/list-newest-first, status auto-advance, invalid-advance-rejected, delete, isolation). ELD integration will feed this table later.
  - Frontend: **Tracking tab** on the load detail (`src/features/loads/tracking.tsx`) — a dependency-free **schematic route map** (origin → truck marker positioned by progress → destination), a current-location/ETA panel, a check-call composer (city/state, status note, notes, ETA, optional "advance status" dropdown), and a tracking-history timeline (delete per call). Polls every 15s. When a ping carries coordinates it shows `lat, lng · View on map ↗` (external OSM link — no embedded iframe, which breaks on locked-down networks). `Panel` gained an optional `style` prop. `CheckCall`/`CheckCallCreate` types derived from OpenAPI. `npm run build` passes; verified live (Playwright: route map + truck + history render).
- Earlier: Elite features — one-click load action row, re-book, margin %, and document attachments.
  - Backend: new `documents` table/model (`organization_id`, `load_id`, filename, content_type, size, kind [rate_con/bol/pod/other], `data` LargeBinary, uploaded_by, created_at) — files stored as bytes in the DB so they persist on managed Postgres without object storage. Router `app/routers/documents.py` (nested under `/api/loads/{id}/documents`): list (newest first), **POST multipart upload** (`UploadFile` + `kind` form field; validates kind, rejects empty, 15 MB cap → 413), `GET /{doc_id}/download` (streams bytes with Content-Disposition), DELETE — all org-scoped (404 cross-org/cross-load). Migration `2085b8d252b6`. Also `POST /api/loads/{id}/duplicate` — re-book: clones lane/shipper/freight into a fresh `quote`, dropping carrier + carrier_rate. 67 tests pass (adds upload/list/download/delete + isolation; duplicate re-book resets status/carrier).
  - Frontend: load detail gained a **contextual action row** (one-click Cover/Dispatch/Mark Delivered/Lost/TONU + ⎘ Re-book→navigates to the clone), a **Margin %** KPI that turns red with a ⚠ + a loud low-margin notice when below the 12% target (`LOW_MARGIN_PCT`), and a **Documents tab** (`src/features/loads/documents.tsx`) — kind picker + upload, table of files with download links + delete. `api.upload` (multipart, browser-set boundary) + `API_URL` added to `lib/api.ts`; `LoadDocument` type derived from OpenAPI. `Copy`/`Copyable` copy buttons already on key carrier/contact/load details. New `SettingsPage` (`/settings`) + `docs/integrations.md` stub the launch integrations (email logging, DAT, Highway/Carrier411 active-gating, factoring, ELD). Verified live (Playwright screenshot: action row + red 9.1% margin + Documents tab render). `npm run build` passes.
- Earlier: F5 — dashboard KPIs + value-by-status + recent activity, and a lane-pricing reference.
  - Backend: `app/routers/dashboard.py` (no migration — pure aggregation over the org's loads). `GET /api/dashboard/summary` → loads_total, open_loads, loaded_dollars (excl. lost/tonu), total_margin, avg_margin, value_by_status (count + Σcustomer_rate per pipeline status), my open_tasks count, recent_activity (last 8). `GET /api/pricing/lanes` → org-wide lane aggregation (origin→dest+equipment, loads, avg customer/carrier rate, avg margin), busiest first. 63 tests pass (adds KPI math, value-by-status, lane averages, isolation).
  - Frontend: reworked **Dashboard** (`src/features/dashboard/`) — KPI cards (loaded $, total margin, avg margin, open loads, my tasks), a "pipeline value by status" bar chart, a recent-activity feed, plus the existing pins. New **Pricing** page (`/pricing`, nav "Pricing") — the lane rate table (rate memory for quoting). `npm run build` passes.
- Earlier: F4 — log calls/emails/notes/tasks against any record; chronological timeline on detail pages; "My open tasks."
  - Backend: extended the existing `activities` table with `related_load_id` + `related_carrier_id` (migration `ae924513303f`, batch mode for SQLite FK); `related_company_id` is the shipper link. Router `app/routers/activities.py`: list (filter by type/owner/any related_*; `open_tasks=true` → incomplete tasks sorted by due_at), create (validates type ∈ call/email/note/task and every related_* is in-org → 422), update (incl. `completed` bool that toggles `completed_at`), delete. 60 tests pass (adds log/timeline, task completion toggle, type + in-org validation, isolation).
  - Frontend: reusable `Timeline` (`src/features/activities/`) — composer (note/call/email/task pills, due date for tasks) + chronological feed with task complete/reopen + delete. Embedded on load (Activity tab), carrier (Activity tab), shipper, and contact detail. New **My open tasks** page (`/tasks`, nav "Tasks") — due-sorted, overdue in red, linked back to the related record, one-click Done. `npm run build` passes.
- Earlier: F3 — Carrier ops (lanes, capacity, compliance flags).
- Last completed: F3 — carrier lane history, capacity, and loud compliance gating.
  - Backend: `CarrierOut` gained computed `compliance_issues` (deactivated / no auto-liability / no cargo coverage) + `is_compliant`. New `carrier_capacity` table/model (migration `d6fc5e3bb161`). Router `app/routers/carrier_ops.py` (under `/api/carriers/{id}`): `GET /lanes` — **lane history derived from the carrier's loads** (group origin→dest+equipment, shipment count, last carrier_rate, ordered by id desc so "most recent" is deterministic; no separate table), and capacity CRUD (`GET/POST/DELETE /capacity`: location, radius_miles, weekly_capacity, equipment). 54 tests pass (adds compliance flags, derived lane aggregation, capacity CRUD, isolation).
  - Frontend: carrier profile **Lanes tab** now shows real lane history + a `CapacityPanel` (add/remove posted capacity). Compliance surfaced loudly: a "✓ Compliant" / "⚠ N compliance issues" badge in the carrier header, full list on the Compliance tab, a ⚠ flag in the carriers list, and **compliance alert badges on a load's carrier panel** when the assigned carrier isn't compliant. `npm run build` passes.
- Earlier: S2 — Shipper Lead-Gen.
- Last completed: S2 — the prospect pipeline (find/qualify candidate shippers → convert to Shipper + Contact).
  - Backend: new `prospects` table/model (company + logistics contact fields, freight_fit_score + fit_reason, status [new/approved/dismissed/imported], source, shipper_id/contact_id links). `app/freight_fit.py` scores fit from industry/name keywords (strong=manufacturing/distribution/food/building-materials… → ~85; competitor=broker/3PL/carrier → 10). Router `app/routers/prospects.py`: list (filter status + search, sorted by fit), create (auto-scores + flags `duplicate_of` an existing shipper by name/domain at read time), update (status; re-scores on industry change), delete, and **POST `.../convert`** — creates a Shipper (company) + optional Contact, marks the prospect imported (409 if already). Migration `91b594e52056`. 50 tests pass (adds scoring, dedupe, convert→shipper+contact, double-convert 409, dismiss filter, isolation).
  - Frontend: Lead-Gen page (`src/features/prospects/`) — New/Imported/Dismissed tabs, fit-score badges, dupe alert badge (links to the existing shipper), freight signal text, Approve(convert)/Dismiss/delete, and a manual "+ Add prospect" form. Nav gained **Lead-Gen**. The `add-prospects` skill now writes candidates via `POST /api/prospects` (review/approve in-app). `npm run build` passes.
- Earlier: S1 — Live Quote Desk.
- Direction: AuraSphere is now a **freight TMS + brokerage CRM** (own product). Foundation phases 0–3 stand; the F-phases pivot the domain. See "What you are building" + the F-phases above.
- Last completed: S1 — the Live Quote Desk (collaborative carrier-option workspace on a load).
  - Backend: new `load_options` table/model (load_id, carrier_id/carrier_name, rate, counter_rate, status [available/not_available/countered/declined/accepted], notes, created_by) + `loads.target_rate` (carrier-side max-buy). Router `app/routers/load_options.py` (nested under `/api/loads/{id}/options`): list (cheapest first), add, update, delete, and **POST `.../accept`** — covers the load with the option's carrier + (counter or) rate, advances quote/tendered/offered → covered, marks the option accepted and declines other open options. Migration `d9f127b2bca1`. 44 tests pass (adds option CRUD, accept-covers-load + margin, counter-rate-wins, in-org carrier check, isolation).
  - Frontend: `QuoteDesk` as a **tab on the load detail** — pricing targets strip (customer rate, target buy, target margin), add-option row (carrier + offer rate), and an options table comparing rate→counter→**live margin**→vs-target badge (on target / over)→status, with Accept / N/A / delete. Options poll every 5s (`refetchInterval`) so two reps see updates near-real-time (true websockets is a later enhancement). `target_rate` added to `LoadForm`. `npm run build` passes.
- Earlier: F2 — the Load (shipment) record + status board, "+ New load"/"+ New quote", dashboard pins.
  - Backend: new `loads` table/model (reference auto `L-1000xx`, status workflow, shipper/carrier/contact FKs, commodity/weight/equipment, origin+destination city/state + dates, miles, customer_rate + carrier_rate; **margin derived** customer−carrier in the schema). `app/workflow.py` defines the pipeline (quote→tendered→offered→covered→dispatched→in_transit→delivered→invoiced) + terminal lost/tonu. Loads router: list (filter status/statuses/shipper/carrier/owner + search + pagination), CRUD, `PATCH /loads/{id}/status` (board drag; stamps `delivered_at`), `GET /loads/board` (pipeline meta). A quote = a load created in `quote` status. New `pins` table/model + router (per-user dashboard widgets: load/contact/carrier/shipper + note + remind_at; entity label/link resolved at read time; idempotent per entity). Two migrations: `a1196e601f28` (loads), `9adac6a6f15f` (pins). 39 tests pass (adds load CRUD/margin/status/board/isolation + pin resolve/reminder/dedupe/per-user/isolation).
  - Frontend: loads feature (`src/features/loads/`) — status board (dnd-kit, optimistic status change), board/list toggle, "My loads", `LoadForm` (mode load|quote), Quotes page (quote/tendered/offered + "+ New quote"), and the **hero load detail** (status header, status dropdown, KPI strip with margin, Route & Stops P1→D1, carrier/customer panel). Pins feature (`src/features/pins/`) — `PinButton` on load/carrier/shipper/contact detail; dashboard renders pinned widgets with editable note + reminder. Nav → Loads · Quotes · Carriers · Shippers · Contacts; "+ New" menu + ⌘K search updated to loads. Old `deals` frontend removed (loads supersede it; deals backend left as legacy). `npm run build` passes.
- Earlier: F1.5 — top app bar + per-tenant branding (organizations.accent_color); F1 — Carriers + reusable record shell.
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
- Next concrete step: all core F-phases (F1–F6) + signature features (S1 Quote Desk, S2 Lead-Gen) are done. Candidates next: deferred cleanup (formal `companies→shippers` table/endpoint rename; remove the legacy `deals` backend), or the gated product track (deploy hardening, self-serve signup + email verification, Stripe plan-gating, Gmail/Apollo + DAT/Highway/factoring/ELD integrations stubbed in `docs/integrations.md`).
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
