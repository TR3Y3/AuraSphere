---
name: weekly-sales-report
description: Generate the Friday Cortrans sales report from this week's pipeline activity (leads found, emails sent, follow-ups, replies, approvals), formatted exactly per the official Cortrans report format in references/report-format.md.
---

# Weekly Sales Report

Every Friday, produce the sales activity report for the week just ending.
The output format is fixed: follow `references/report-format.md` in this
skill folder **exactly** — section order, headings, and field names. Do not
restyle it.

The four sections, always in this order: **New Accounts Closed, Existing
Customers, Pending Proposals, Lost Business.**

## Gathering the Week's Data

Compute the reporting window as Monday 00:00 through now (or the dates the
user specifies). Pull activity from `cortrans_leads.db`:

- **New leads found:** `leads` where `created_at` is in the window — count,
  plus breakdown by source, priority, and city.
- **Outreach sent:** `email_log` where `sent_at` is in the window — count by
  `email_type` (initial / followup / final) and status.
- **Approvals:** leads where `draft_approved = 1` updated this week.
- **Responses & pipeline movement:** leads whose `status` changed to
  responded/qualified/closed_won/closed_lost/unsubscribed this week (use
  `last_activity_at` and `notes`).
- **Current pipeline snapshot:** `python main.py pipeline` output.

Then ask the user for anything the database can't know: calls made, meetings
booked, quotes given, deals signed, and notable conversations. Fold their
answers into the report.

## Output

1. Render the report exactly per the reference format.
2. Save it to `reports/YYYY-MM-DD-weekly-sales-report.md` in the repo and
   show the full text to the user.
3. Ask whether to commit it; do not email or send it anywhere unless asked.
