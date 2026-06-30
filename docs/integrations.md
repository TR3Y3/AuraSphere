# AuraSphere — Integrations plan

> Planned integrations. **Not built yet** — this doc keeps them launch-ready
> on paper, and the in-app **Settings → Integrations** page is the visible
> "available at launch" surface (cards with a Coming-soon / Connect state).
> Build each one only when explicitly told; flip its card to active then.

## How to read this
Each integration lists: **Purpose · Hooks into · Data in/out · Auth ·
Effort · Launch posture · Notes.**

> **Reference UI:** the gold-standard TMS screenshots the user provided show
> most of these in place — mirror those patterns when building:
> - "**Request Compliance Approval**" button on the carrier profile +
>   "**Compliance Requirements**" panel on the load (Auto Liability $1M /
>   Cargo $100k) → **Highway/Carrier411 vetting (#3)**.
> - "**Tracking Capabilities: Project44**" on the carrier profile +
>   "**Map & Pings**" panel on the load → **ELD/tracking (#5, F6)**.
> - "**Market Insights**" (% change in LH+F) + "**Pricing Targets**"
>   (CM Target / Carrier Rate) on the load → **DAT market rates (#2)**.
> - "**Logs**" / "**Accounting**" tabs on the load → email logging (#1) +
>   future accounting.

**Launch posture** options:
- **Placeholder** — visible card on Settings → Integrations marked
  "Coming soon"; no backend.
- **Plumbed + flagged** — data model + connect button + a stub service
  exist behind a feature flag, so enabling later is a config flip.

Default posture at launch: **Placeholder** for all five (visible, no wiring),
unless noted. The carrier-vetting and factoring fields below are cheap to
add to the data model early so they're ready when the integration lands.

---

## 1. Email logging (Gmail / Outlook)
- **Purpose:** auto-log sent/received email against the right record so the
  timeline is the full history without copy-paste.
- **Hooks into:** the **activity timeline (F4)** — an email becomes an
  `email` activity with `related_load_id` / `related_company_id` /
  `related_contact_id` resolved by matching the counterparty address.
- **Data in/out:** read message metadata + body (in); write activities. No
  outbound send required for v1 (logging only).
- **Auth:** Gmail OAuth (adapt CALCOR's Gmail OAuth flow — copy in + mark
  origin, per the CALCOR-copy rule). Outlook = Microsoft Graph OAuth later.
- **Effort:** Medium. CALCOR flow shortens it.
- **Launch posture:** Placeholder → first to plumb (highest daily value).
- **Notes:** match emails to contacts by address; unmatched go to an
  "unfiled" inbox the rep can assign.

## 2. DAT (load board + market rates)
- **Purpose:** post loads to DAT and pull **live market rates** so quoting
  is data-driven.
- **Hooks into:** **Loads (F2)** (post/refresh a load) and **Quote Desk /
  Pricing (S1/F5)** — show DAT market rate next to our customer/target/
  carrier rates and lane history.
- **Data in/out:** push load (lane, equipment, dates) → DAT; pull rate
  estimates + capacity signals → load + pricing views.
- **Auth:** DAT API key / account credentials (paid DAT subscription).
- **Effort:** Medium–High; metered/paid API.
- **Launch posture:** Placeholder now → **plumb when loads go operational**
  ("when loads start being built," per the user). Add a `market_rate` field
  on the load + a Pricing "market" column when it lands.
- **Notes:** Truckstop is the obvious second source behind the same panel.

## 3. Highway / Carrier411 (carrier vetting → "active" gating)
- **Purpose:** vet carriers (authority, insurance, safety, fraud/identity)
  and make vetting the **source of truth for whether a carrier may be
  ACTIVE / bookable** in AuraSphere. A **major tool** — carriers can't be
  set active until vetting passes.
- **Hooks into:** **Carriers + compliance (F3)** — drives `carrier.status`
  and the compliance flags we already render on the profile, list, and on
  any load the carrier is assigned to.
- **Data in/out:** send MC/DOT → receive authority status, insurance
  (auto-liability/cargo), safety score, identity/fraud signals → write to
  carrier fields + a `vetting_status` (pending/passed/failed) + `vetted_at`.
- **Auth:** Highway and/or Carrier411 API credentials.
- **Effort:** High; this is core to the ops gate.
- **Launch posture:** Placeholder now → **plumb early** because it gates
  activation. Cheap to prep now: add `vetting_status`, `vetting_source`,
  `vetted_at` to the carrier model and block "active" unless vetting passed;
  the API just fills those fields later.
- **Notes:** until integrated, "active" is a manual toggle (today's
  behavior) with the loud compliance flags already in place.

## 4. Factoring (carrier setup → pay-to / NOA)
- **Purpose:** capture and verify the carrier's **factoring company** during
  onboarding so payment routes correctly (Notice of Assignment — you pay the
  factor, not the carrier) and you don't double-pay.
- **Hooks into:** **Carrier setup (F3)** + future accounting/payables.
- **Data in/out:** store factoring company, NOA on file (y/n), remit-to
  details; optionally verify against a factoring directory / TriumphPay.
- **Auth:** provider API (e.g., TriumphPay) or manual entry first.
- **Effort:** Low for the fields; Medium for live verification.
- **Launch posture:** Placeholder + **add factoring fields to the carrier
  model early** (factoring_company, noa_on_file, remit_to) so onboarding is
  complete even before any provider API.
- **Notes:** a carrier paid via factoring should warn if NOA isn't on file.

## 5. ELD (Samsara / Motive / Geotab)
- **Purpose:** pull **real-time truck location + HOS** so tracking is
  automatic instead of manual check-calls.
- **Hooks into:** **Tracking (F6)** — ELD pings become tracking events /
  map points and feed ETA + status auto-advance (e.g., arrived → in_transit).
- **Data in/out:** receive vehicle GPS pings + HOS (in) → tracking timeline,
  map, ETA on the load.
- **Auth:** per-provider OAuth/API key (Samsara, Motive, Geotab each differ).
- **Effort:** High (multi-provider); start with one.
- **Launch posture:** Placeholder now → plumb **with F6 (Tracking)**. F6's
  manual check-call model is the fallback when no ELD is connected.
- **Notes:** carrier connects their ELD once; loads on that carrier's trucks
  track automatically.

---

## Deferred / later (not requested yet, parked here)
- **QuickBooks** — invoicing / payables sync.
- **Twilio** — SMS check-calls + driver texts.
- **Apollo / Hunter** — lead-gen enrichment (pairs with S2; web research
  first, paid only when needed).
- **Truckstop** — second load-board/rate source behind the DAT panel.

## Cheap data-model prep (do when convenient, ahead of the APIs)
These make the integrations "snap in" later and improve manual workflows now:
- `carriers`: `vetting_status`, `vetting_source`, `vetted_at` (Highway/411);
  `factoring_company`, `noa_on_file`, `remit_to` (factoring).
- `loads`: `market_rate` (DAT).
- A `tracking_events` table (F6) that ELD pings or manual check-calls both
  write to.
