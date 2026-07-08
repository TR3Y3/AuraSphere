# AuraSphere Accessibility Audit (WCAG 2.1 AA)

**Date:** July 7, 2026
**Scope:** Frontend SPA (broker app + carrier portal + auth pages)
**Standard:** WCAG 2.1 Level AA — the recognized bar for ADA web accessibility.

> **Important:** "ADA compliant" is a legal determination, not a checkbox. Meeting
> WCAG 2.1 AA is the defensible engineering standard. This audit gets us most of
> the way; the two MEDIUM items below should be closed before non-friendly
> (paying / public) users, alongside the legal review.

---

## ✅ Fixed in this pass

| Area | Issue | Fix | WCAG |
|------|-------|-----|------|
| Keyboard focus | `.ti:focus` stripped the outline with no clear replacement; buttons relied on inconsistent UA defaults | Added a global `:focus-visible` ring (brand color, keyboard-only) + input-specific ring | 2.4.7 Focus Visible |
| Page metadata | `<title>` was "frontend"; no meta description | Real title + description | 2.4.2 Page Titled |
| Feedback modal | No dialog semantics, no Escape, unlabeled ✕ and 💬 buttons | `role="dialog"` + `aria-modal` + `aria-label`, Escape-to-close, button labels | 4.1.2, 2.1.2 |
| Search palette (⌘K) | No dialog semantics, unlabeled input | `role="dialog"` + `aria-modal` + input `aria-label` (Escape already worked) | 4.1.2 |
| App bar | Avatar menu button was icon-only, unlabeled | `aria-label` + `aria-haspopup`/`aria-expanded` | 4.1.2 |
| Color contrast | Verified `--muted` (#8b949e) on dark surfaces | ~5.5–6:1, passes AA for normal text | 1.4.3 Contrast |
| Copy buttons | (already had `aria-label`) | — | — |
| `html lang` | (already `lang="en"`) | — | — |

---

## ✅ M1 — Form label association (CLOSED)
Every form field now uses **implicit label association**: the field wrapper is a
`<label class="field">` and the caption is a `<span class="cl">`, so each input is a
descendant of its label and programmatically named for screen readers. Applied
across Carrier, Company, Contact, Load, Prospect, Team, and auth forms;
placeholder-only inputs (tracking check-call, Team sales code) got `aria-label`s.
Satisfies WCAG 1.3.1, 3.3.2, 4.1.2.

## 🟡 Remaining — optional, before public / paying users

### M2. Kanban board keyboard operation
The Load status board (dnd-kit) uses only `PointerSensor` — drag-to-change-status
is mouse/touch only.

- **Mitigation already present:** the load **detail page has a status dropdown**,
  which is a fully keyboard- and screen-reader-operable alternative to dragging.
  Under WCAG this satisfies the requirement (equivalent alternative exists), so this
  is not a blocker — but the board itself isn't operable by keyboard.
- **Optional improvement:** add dnd-kit `KeyboardSensor` + drag announcements, or a
  per-card status dropdown on the board, so the board itself is operable.
- **WCAG:** 2.1.1 Keyboard (met via the alternative; board-native support is polish).

---

## 🟢 Verified healthy

- `html lang="en"` present.
- Text contrast passes AA (muted text ~5.5:1+ on dark surfaces; brand/status colors
  paired with text, never color-alone).
- Search palette supports full keyboard nav (arrows + Enter + Escape).
- Modals close on overlay click and Escape.
- Responsive layout (viewport meta, breakpoints at 820px).
- Status is never conveyed by color alone (badges carry text labels).

---

## Recommended verification before launch

1. **Keyboard-only pass:** tab through login → dashboard → create a load → cover it,
   using no mouse. Confirm focus is always visible and nothing is unreachable.
2. **Screen reader spot-check:** VoiceOver (Mac) or NVDA (Windows) on the login and
   load-detail pages.
3. **Automated scan:** run axe DevTools (browser extension) on the main pages — free,
   catches the mechanical stuff (label associations will flag here; that's M1).
4. Close M1 (form labels) — the one item most likely to show up in an automated scan
   or a screen-reader complaint.

M2's alternative (detail-page dropdown) means the board is not a legal blocker, but
M1 is worth finishing before you have users who might rely on assistive tech.
