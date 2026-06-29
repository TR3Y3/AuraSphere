---
name: weekly-sales-report
description: Generate a weekly sales report from AuraSphere pipeline activity — deals won/lost, open opportunities, new accounts and contacts, and logged activities for the week — formatted per references/report-format.md. Adapted for AuraSphere CRM from CALCOR's weekly-sales-report skill.
---

# Weekly Sales Report

Produce the sales activity report for the week, pulled from the CRM and
rendered in the fixed format in `references/report-format.md` (section order
and headings are fixed — don't restyle them).

> Adapted from CALCOR's `weekly-sales-report` skill. Full data depends on
> later phases: **deals → Phase 3**, **activities → Phase 4**. Until those
> ship, report what exists (new companies/contacts) and mark the deal/activity
> sections as "pending phase 3/4," or ask the user to supply those numbers.

The four sections, always in this order: **New Accounts Closed, Existing
Customers, Pending Proposals, Lost Business.**

## Gathering the Week's Data

Compute the window as Monday 00:00 through now (or dates the user gives), then
pull from AuraSphere's org-scoped API:

- **New accounts & contacts:** `GET /api/companies?sort=created_at&order=desc`
  and `GET /api/contacts?sort=created_at&order=desc`; count those created in
  the window (break down by owner where useful).
- **Deals won (New Accounts Closed):** Phase 3+ — deals whose stage became a
  won stage this week (`closed_at` in window, stage `is_won`).
- **Pending Proposals:** Phase 3+ — open deals (not won/lost) with amount,
  stage, owner, and `expected_close_date`.
- **Lost Business:** Phase 3+ — deals moved to a `is_lost` stage this week,
  with the reason from notes/activities.
- **Existing Customers / activity:** Phase 4+ — activities (call/email/
  meeting/note) logged in the window, grouped by company.

Then ask the user for anything the CRM can't know: calls/meetings not yet
logged, verbal commitments, quotes given, and notable conversations. Fold
their answers in.

## Output

1. Render the report exactly per the reference format.
2. Save it to `reports/YYYY-MM-DD-weekly-sales-report.md` in the repo and show
   the full text to the user.
3. Ask whether to commit it; do not send it anywhere unless asked.
