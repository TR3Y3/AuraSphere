---
name: add-prospects
description: Prospect for new accounts and add them to AuraSphere — research target companies, find decision-maker contacts, dedupe against existing CRM records, and create companies + linked contacts through the org-scoped API. Adapted for AuraSphere CRM from CALCOR's find-customers skill.
---

# Add Prospects

Goal: turn a target profile into real CRM records — companies that fit, each
with a named decision-maker contact linked to it — created cleanly through
AuraSphere's API without duplicates.

> Adapted from CALCOR's `find-customers` skill. Prospecting + record creation
> only — no email sending (that's outreach, gated separately).

## Target Profile

There is no hard-coded market. Ask the user for (or infer from existing
records) the profile to prospect against:

- **Geography / industry / size** the org sells into.
- **Decision-maker titles** worth capturing (e.g. ops, procurement, owner/GM
  at small shops).

If the user has no profile yet, propose one from the industries already
present in their `companies` list and confirm before researching.

## Required Fields Per Prospect

- **Company:** name, domain, industry (website/phone optional).
- **Contact:** first name, last name, title, email, phone — linked to the
  company. Be explicit about email confidence: a guessed pattern is not a
  verified address.

## Process

1. **Web research first.** Local directories, chamber/member lists, industry
   associations, Google Maps categories, company about/team/contact pages
   (which often name an owner or ops lead with a phone). Capture company
   facts and any named contacts.
2. **Dedupe against the CRM before adding anything.** For each candidate:
   - `GET /api/companies?search=<name or domain>` — skip/merge if it exists.
   - `GET /api/contacts?search=<email or name>` — avoid duplicate people.
   All reads are org-scoped automatically; never pass an org id.
3. **Create records through the API.** For survivors:
   - `POST /api/companies` with `{name, domain, industry, ...}`.
   - `POST /api/contacts` with the contact fields plus `company_id` from the
     company just created, so the contact is linked. The API rejects a
     `company_id` outside the caller's org (422) — that's expected.
   Set `owner_id` only if the user wants a specific owner; otherwise it
   defaults to the creator.
4. **Deliver the batch for review.** End with a table: company, industry,
   contact name/title, email (+ confidence), and whether it was newly created
   or matched an existing record. Hand off to `/review-records`.

## Background Operation

For "prospect in the background," split the work into parallel research
subagents (one per city/industry slice, per the `efficient-fable` /
`efficient-frontier` pattern), each returning the required fields with
sources. Verify and dedupe centrally before creating anything.

## Rules

- Discovery + record creation only — no outreach is sent from this skill.
- Never invent contact details; mark guessed emails as unverified.
- A handful of well-researched, correctly-linked accounts beats a big scraped
  import. (Bulk CSV import is the separate Phase 6 path.)
