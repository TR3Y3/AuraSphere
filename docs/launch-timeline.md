# AuraSphere Launch Timeline

**Current date:** July 7, 2026  
**Status:** Carrier app v1 shipped (PR #17 merged); 141 backend tests passing; all F1–F6 + S1/S2 features complete.

---

## Launch Blockers (REQUIRED before go-live)

These must be done before test users see the product:

### 1. Fix Render Billing
- [ ] Update credit card at https://dashboard.render.com/billing
- [ ] Verify no services are suspended
- **Timeline:** Now  
- **Effort:** 5 min

### 2. Buy a Domain
- [ ] Register domain via Namecheap / Google Domains / Cloudflare / GoDaddy
- [ ] Point DNS at Render (MX records + CNAME)
- **Timeline:** This week  
- **Effort:** 15 min  
- **Cost:** ~$10–15/year

### 3. Set Up Email (Resend)
- [ ] Sign up at resend.com
- [ ] Verify your domain in Resend dashboard
- [ ] Grab API key
- [ ] On Render → `aurasphere-backend` → Environment:
  - `EMAIL_DELIVERY=resend`
  - `RESEND_API_KEY=<key>`
  - `EMAIL_FROM=noreply@yourdomain.com`
- [ ] Save (Render redeploys automatically)
- [ ] Test: send a password reset or invite email
- **Timeline:** After domain is set up  
- **Effort:** 15 min  
- **Notes:** Verification emails, invites, and password resets now actually send

### 4. Upgrade Render Tiers
- [ ] Backend: upgrade from Free to Starter ($7/month)
- [ ] Postgres: upgrade from Free to Standard ($15/month, includes backups)
- [ ] Frontend: stays free (static site)
- **Timeline:** After domain is live  
- **Effort:** 5 min (toggle in dashboard)  
- **Why:** Free Postgres has no backups and a hard lifetime limit; free web spins down after idle

### 5. Update Cookie Domain (OPTIONAL but recommended)
- [ ] Buy your own domain + point it at Render (if not done yet)
- [ ] On backend, set `COOKIE_DOMAIN=.<yourdomain.com>` (note the leading dot)
- [ ] Update `FRONTEND_ORIGIN` to match your domain
- [ ] Redeploy
- **Timeline:** When domain is live  
- **Effort:** 5 min  
- **Why:** Lets cookies work cross-subdomain; allows `app.yourdomain.com` + `api.yourdomain.com` to share auth without SameSite=none

---

## Launch Phase Checklist

Once blockers are cleared, verify:

- [ ] Signup → email verification link arrives
- [ ] Password reset → email arrives
- [ ] Invite teammate → email arrives with set-password link
- [ ] Create a test org + test user
- [ ] Load board renders without errors
- [ ] Create a load → Quote Desk works
- [ ] Create a carrier → generate portal link → test carrier app on phone
- [ ] Carrier portal: make offer → appears in broker Quote Desk
- [ ] Cover a load → rate con email sent
- [ ] Sign rate con → loading doc uploaded
- [ ] Run E2E smoke test (Playwright script in `scratchpad/portal.mjs`)

---

## Post-Launch: Next Feature Arcs

### Phase 6.5 — Carrier App v2 (3–4 weeks)
- Instant-book on green-lit posted rates
- Portal rate-con sign deep-link (no broker middle-man)
- Push notifications on load board updates
- Carrier-side load history

### Phase 7 — Document Generation (2–3 weeks)
- **Rate Confirmation PDF** generation (no more HTML print; shipping + PDF email)
- **Bill of Lading (BOL)** template → PDF
- **Invoice PDF** from load data
- One-click: Cover Load → auto-generate rate con → email sign link

### Phase 8 — CRM Hardening (1–2 weeks, in parallel)
- Shipper portal (customer-facing load board + visibility)
- Companies → Shippers formal table rename + cleanup
- Saved views / CSV export (Phase 6 backlog)
- ESLint config + pre-commit linter

### Phase 9 — Invoicing + Accounting (3–4 weeks)
- Load completion → auto-invoice
- QuickBooks export
- Stripe payout (or ACH to carrier bank account)

### Phase 10 — Integration Breadth (ongoing)
- Gmail email logging (sent/received on activities)
- Factoring partnerships (spot-cash load advances)
- EDI (standard TMS partner protocols)

### Future — Competitive Differentiators
- Email-to-load AI (inbox → auto-create load from shipper email)
- Shipper churn prediction (activity signals → reactivation cues)
- Advanced pricing rules (dynamic margins, peak pricing)
- Command bar (⌘K) deep actions beyond search

---

## Current Backlog (lower priority, can defer past launch)

- Legacy `deals` backend removal (tables kept for migration safety; never used by UI)
- `companies` → `shippers` formal table/endpoint rename (purely cosmetic; interim debt)
- Composite indexes on loads (org_id+status, owner_id, etc.) — fine at 10-user scale
- Dashboard compute optimization (currently Python for-loop over org loads; fine at brokerage scale)

---

## Known Limitations (by design or deferred)

- **No embedded map tiles** — uses external OSM links instead (locked-down networks can't load iframes)
- **No websockets yet** — board updates poll every 15s; true real-time is a v2 enhancement
- **No carrier-side documents** (upload POD/BOL on their load, yes; but not carrier's own inventory) — v2
- **Stops are implicit** (origin/dest only, no multi-leg routes) — v6 if needed

---

## Rolling Back If Needed

All integrations have **kill-switch env vars** that can be flipped independently on Render without redeploying:

- `EMAIL_DELIVERY=console` → falls back to logging links (email down, app still works)
- `BILLING_MODE=stub` → free tier for all (Stripe down, app still works)
- `VETTING_MODE=stub` → demo vetting (Highway down, demo still works)
- `DAT_MODE=stub` → demo market rates (DAT down, demo still works)
- `ELD_MODE=stub` → demo GPS (Samsara down, demo still works)

So a provider outage = **flip one env var, no redeployment**. Postgres backup exists (daily snapshots on paid tier).

---

## Success Criteria for "Market Ready"

- ✅ Self-serve signup works (email verified)
- ✅ Tenant isolation proven (every endpoint tested cross-org)
- ✅ Load lifecycle: Quote → Covered → Dispatched → Delivered (end-to-end tested)
- ✅ Carrier app: board → offer → appears in broker Quote Desk (E2E verified)
- ✅ Rate con: generated → signed → filed (E2E verified)
- ✅ Dashboard + KPIs render without errors
- ✅ No console errors or unhandled exceptions (React error boundary + global exception handler)
- ✅ Mobile responsive on key flows (app bar, board, load detail, carrier portal)
- ✅ Custom domain + real email delivery working
- ✅ Render paid tiers live (backups + no spin-down)

---

**Next concrete steps:**
1. Fix Render billing (card update)
2. Register a domain (Namecheap/Cloudflare/Google Domains)
3. Set up Resend (5-min free signup)
4. Test email flow
5. Run the Playwright smoke test
6. Upgrade Render tiers
7. Invite first 2–3 testers
