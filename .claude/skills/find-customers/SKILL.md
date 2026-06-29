---
name: find-customers
description: Prospect for new CorTrans freight customers — local/regional shippers (mom & pop, small/mid manufacturers, distributors, food/bev, building materials) in Duluth, Norcross, Lawrenceville, Suwanee, and Buford GA — find decision-maker contacts and build outreach lists, using web research first and Apollo/Hunter free credits only when necessary.
---

# Find Customers

Top-priority skill. Goal: companies in the target area that have freight to
move, with a named decision-maker we can email. Customer-facing prospecting
only — no carrier sourcing, rate quotes, or dispatch.

## Target Profile

- **Cities (primary):** Duluth, Norcross, Lawrenceville, Suwanee, Buford GA.
  Nearby Gwinnett / Atlanta metro is acceptable when a lead is strong.
- **Industries:** manufacturing, distribution/wholesale, food & beverage,
  building materials. Skip 3PLs, brokers, and carriers (competitors).
- **Size:** mom & pop through small/mid — roughly 5–200 employees. Skip
  Fortune-500 branches.
- **Decision-maker titles:** logistics manager, operations manager, shipping
  manager, supply chain manager, warehouse manager; at small shops the
  owner/president/GM.

## Required Fields Per Lead

Company name, website, industry, city, **contact name, title, phone, email**,
likely freight type (`cortrans/categorizer/ship_type.py` categories: dry_van,
ltl, reefer, flatbed, ...), and a one-line note on why they ship freight.

## Process

1. **Web research first (no API keys).** Search local business directories,
   Gwinnett chamber member lists, industrial park tenant lists,
   "manufacturers in <city> GA", Google Maps categories, expansion/new-
   facility news. Capture company facts and any contacts named on their own
   site (about/team/contact pages often list ops or owner directly, with
   phone).
2. **Dedupe against the database.** Check `cortrans_leads.db` (`leads` table,
   match on company_name/email) before adding anything.
3. **Contact discovery, cheapest first.** Company website and LinkedIn
   company page before spending credits. Then:
   - **Hunter** for domain email patterns / verification.
   - **Apollo** for decision-maker search by title when the website names
     no one (`APOLLO_MAX_REVEALS_PER_RUN` guards credits).
   State the credit cost of a batch before spending, and only spend on leads
   that survived steps 1–2.
4. **Score and store.** Insert qualified leads via
   `cortrans.database.db.insert_lead` + `cortrans.scoring.lead_scorer` (or
   `python main.py discover` when using API sources) so they enter the
   draft → review → approve → send pipeline.
5. **Deliver a batch for review.** End with a table: company, city, industry,
   freight type, contact name/title, phone, email (+ confidence), score.
   Hand off to `/review-leads` — nothing is emailed from this skill.

## Background Operation

When the user asks for prospecting "in the background," split the work into
parallel research subagents (one per city or industry slice, per the
efficient-fable pattern), each returning the required fields with sources.
Verify and dedupe centrally before presenting the batch.

## Rules

- Discovery only — sending always goes through the approval gate.
- Be honest about email confidence: guessed pattern ≠ verified address.
- A handful of well-researched local leads beats a big scraped list.
