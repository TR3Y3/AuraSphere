---
name: personalize-outreach
description: Draft genuinely personalized outreach email for an AuraSphere contact — researched against their company — and, once activities exist (Phase 4), log it as an email activity on the contact's timeline. Adapted for AuraSphere CRM from CALCOR's personalize-outreach skill.
---

# Personalize Outreach

Write outreach for a specific contact that reads like a human wrote it for
*them*, so the recipient actually replies — not a mail-merge template.

> Adapted from CALCOR's `personalize-outreach` skill. In CALCOR this edited
> rows in a send pipeline; here the deliverable is a personalized draft tied
> to a CRM contact. Logging it as an activity depends on **Phase 4
> (activities)** — until then, produce the draft for the user to send/copy.

## Process

1. **Load the contact and their company** (org-scoped):
   `GET /api/contacts/{id}` (includes the linked company summary) and
   `GET /api/companies/{company_id}` for context. If the user didn't name a
   contact, offer recently added ones that have an email on file.
2. **Research the company briefly:** their site, what they do, where they
   operate, anything recent (new location, product line, hiring). One or two
   concrete facts is enough — don't over-research.
3. **Write the draft:**
   - **Short and human** — under ~120 words, conversational, no corporate
     filler.
   - Open with a concrete, specific observation about *their* business — not
     flattery, not "I came across your company."
   - Tie it to a problem the org credibly solves for a company like theirs.
   - One low-pressure ask (a quick call / a useful resource). Keep a clean
     signature.
4. **Show the draft to the user for approval.**
5. **On approval:**
   - **Phase 4+:** log it as an activity — `POST /api/activities` with
     `{type: "email", subject, body, related_contact_id, related_company_id}`
     so it lands on the contact/company timeline.
   - **Pre-Phase-4:** hand the user the final subject + body to send manually,
     and note it can be auto-logged once activities ship.

## Rules

- **Never insult or talk down the recipient's business, product, or
  industry.** No "nightmare," "headache," "worst-case." If there's a villain,
  it's the status quo or the market — never what they do. Re-read every draft
  for this before presenting it. (Hard rule carried over from CALCOR.)
- Never invent facts about the company. If research turns up nothing concrete,
  say so and fall back to a sharper industry hook.
- This skill drafts and (Phase 4+) logs outreach; it does not send email.
  Actual sending is a future integration (Phase 7, Gmail OAuth) and stays
  behind its own gate.
