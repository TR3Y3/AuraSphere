---
name: personalize-outreach
description: Rewrite the templated draft email for one or more Cortrans leads into genuinely personalized outreach — researched against the lead's actual business — and save it back to draft_emails so the normal send pipeline delivers it.
---

# Personalize Outreach

The pipeline generates template emails with variable substitution. This skill
upgrades drafts for promising leads into emails written for that specific
company, so the prospect actually replies.

## Process

1. Load the lead and its current draft from `cortrans_leads.db`
   (`leads` + `draft_emails` tables). If the user didn't name a lead, offer
   the highest-scored pending ones.
2. Research the company briefly: their website, what they make/sell, where
   they ship from, anything recent (new facility, new product line). One or
   two concrete facts is enough — don't over-research.
3. Rewrite the draft keeping the working skeleton from
   `cortrans/outreach/email_templates.py`:
   - **Short and human** — under ~120 words, plain conversational tone, no
     corporate filler.
   - Open with the concrete, specific observation about *their* business —
     not flattery, not "I came across your company."
   - Tie it to a freight pain CorTrans solves for their `ship_type`
     (LTL minimums, reefer reliability, flatbed sourcing, etc.).
   - Where it fits naturally, mention CorTrans' **minority/woman-owned
     certification** — supplier diversity angle. Strongest for prospects
     with corporate customers or government work who have diversity spend
     targets; one sentence, not the lead pitch. Skip it where it would feel
     bolted on.
   - Keep the existing signature block and the single low-pressure ask
     (quick call / quote comparison) unchanged.
4. Show the before/after to the user for approval.
5. On approval, save it with `cortrans.database.db.save_draft_email(lead_id,
   email_type, subject, body)` — same `email_type` ("initial") so
   `send-approved` picks it up. Body must be HTML-safe like the originals
   (the templates convert via `_to_html`; match the format already stored in
   `draft_emails.body`).

## Rules

- **Never insult or talk down the prospect's product, freight, or business.**
  No "worst-case freight," "nightmare to ship," "headache," or anything an
  owner could read as disrespect for what they make. Put the villain
  elsewhere: carriers mispricing it, the market squeezing them, money left
  on the table. Hard rule from the user — re-read every draft for this
  before presenting it.
- Never invent facts about the prospect. If research turns up nothing
  concrete, say so and fall back to a sharper industry hook instead.
- Don't change who the email is from, the reply-to, or the unsubscribe
  behavior — copy only.
- This skill edits drafts; sending still requires approval via
  `/review-leads` and `python main.py send-approved`.
