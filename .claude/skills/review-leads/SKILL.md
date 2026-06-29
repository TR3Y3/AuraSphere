---
name: review-leads
description: Review pending Cortrans leads awaiting approval — summarize them with score reasoning, flag hot ones, recommend who to approve, and run the approval commands once the user decides.
---

# Review Leads

Replace reading the raw HTML digest: give the user a fast, opinionated review
of pending leads so they can approve sends in minutes.

## Process

1. Query `cortrans_leads.db` for pending leads
   (`SELECT * FROM leads WHERE draft_approved = 0 AND status = 'new'`), or run
   `python main.py pipeline` for the summary counts.
2. Present leads grouped by priority (hot 75+, warm 50–74, cool 25–49). For
   each: company, city, industry, ship_type, contact name/title, score, and a
   one-line plain-English reason for the score (parse `score_breakdown`).
3. Sanity-check before recommending: dead/missing website, generic
   info@ email, freight-competitor industry, or out-of-area location are
   reasons to skip even with a decent score. Say so explicitly.
4. Show the draft email for any lead the user asks about
   (`draft_emails` table via `get_draft_email`).
5. Give a clear recommendation: "approve these N, skip these M, here's why."
6. After the user confirms, run the approvals:
   - `python main.py approve --id <N>` for specific leads
   - `python main.py approve --all-hot` / `--all-warm` for batches
   Then confirm the new pending/approved counts.

## Rules

- Never approve or send without explicit user confirmation in this session.
- If a draft email reads badly for a specific lead, suggest running
  `/personalize-outreach` for it before approving.
