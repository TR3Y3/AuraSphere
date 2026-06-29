---
name: review-records
description: Triage recently added or unowned AuraSphere records — summarize new companies/contacts (and open deals once Phase 3 lands), flag data-quality problems, recommend owner assignment and next actions, and apply the changes through the API once the user decides. Adapted for AuraSphere CRM from CALCOR's review-leads skill.
---

# Review Records

Give the user a fast, opinionated review of recent CRM records so they can
clean up and assign in minutes instead of scrolling list views.

> Adapted from CALCOR's `review-leads` skill for AuraSphere's data model.

## Process

1. **Pull what needs attention** (all org-scoped automatically):
   - Recent contacts/companies: `GET /api/contacts?sort=created_at&order=desc`
     and `GET /api/companies?sort=created_at&order=desc`.
   - Unowned or to-reassign: filter by `owner_id` (the "My records" filter
     uses the same param) to find records owned by no one in particular.
   - Open deals, once Phase 3 exists: `GET /api/deals` grouped by stage.
2. **Summarize, grouped sensibly** (by company, by owner, or by recency). For
   each record give a one-line plain-English read: who/what it is, how complete
   it is, and whether it looks like a duplicate.
3. **Flag data-quality issues explicitly** before recommending anything:
   missing email/domain, a contact not linked to any company, a generic
   `info@` email, an obvious duplicate of an existing record, or a company
   with no contacts.
4. **Recommend concrete actions:** "assign these N to <user>, link these
   contacts to <company>, merge this duplicate, fill these gaps." Be specific.
5. **Apply on confirmation, through the API:**
   - Reassign owner: `PATCH /api/contacts/{id}` or `/api/companies/{id}` with
     `{owner_id}` (allowed for the record owner or an org admin/owner).
   - Link a contact: `PATCH /api/contacts/{id}` with `{company_id}` (must be a
     company in the caller's org, else 422).
   Then confirm the updated counts.

## Rules

- Never reassign, merge, or delete without explicit user confirmation in this
  session.
- Respect roles: members can only edit records they own; admins/owners can
  edit any. If an edit would 403, say so and suggest who can do it.
- If a record reads like a strong prospect with no contact yet, suggest
  running `/add-prospects` to complete it, or `/personalize-outreach` once
  it's ready for contact.
