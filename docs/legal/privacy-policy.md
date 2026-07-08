# Privacy Policy — AuraSphere

> ⚠️ **DRAFT — NOT YET LAWYER-REVIEWED.**
> Starting template only. Because AuraSphere stores business-contact and
> operational data belonging to your customers' organizations, a privacy policy has
> real legal weight (and may trigger obligations under laws like the CCPA/CPRA, and
> GDPR if you ever have EU users). **Have a licensed attorney review before any
> non-friendly user.** Replace every `[BRACKET]` placeholder.

**Last updated:** [DATE]
**Controller:** [COMPANY LEGAL NAME] ("we," "us")

## 1. What this covers
This policy explains how we handle personal information in connection with the
AuraSphere service. It covers two categories:
- **Account data** — information about the users who log in (name, email, role).
- **Customer Data** — information your organization enters about its own business
  contacts (shipper/carrier contacts, etc.). For this data, your organization is the
  controller and we act as a processor on your behalf.

## 2. Information we collect
- **You provide:** organization name, user name, email, password (stored only as an
  argon2 hash — never in plaintext), and the business records you enter.
- **Automatically:** basic session and security logs (login times, IP address for
  session/security purposes), and standard operational logs.
- **We do not** intentionally collect special-category personal data. Please don't
  put sensitive personal data into freeform fields.

## 3. How we use information
- To provide, secure, and operate the Service.
- To authenticate users and enforce tenant isolation.
- To send transactional email (verification, password reset, invites, and, if you
  opt in, product notices) via our email provider.
- To provide optional integrations you enable (payments, carrier vetting, market
  rates, mapping, telematics).
- To improve reliability and support. We do **not** sell personal information.

## 4. How we share information
- **Sub-processors:** hosting (Render), email delivery (e.g., Resend), payment
  processing (e.g., Stripe), and any optional data providers you enable. Each
  receives only what's needed for its function.
- **Legal:** if required by law or to protect the Service or users.
- **Business transfer:** in a merger or acquisition, subject to this policy.
- We never expose one organization's data to another (enforced by tenant isolation,
  tested on every endpoint).

## 5. Data security
- Passwords hashed with argon2; sessions are server-side with httpOnly cookies and
  hashed tokens; portal/reset/verify links are single-use and stored only as hashes.
- Data encrypted in transit (HTTPS) and at rest (managed Postgres on a paid tier
  with encryption + backups). **[Confirm your Render tier provides encryption at
  rest + backups before relying on this statement.]**
- No system is perfectly secure; we cannot guarantee absolute security.

## 6. Data retention
We keep Customer Data for as long as your account is active. After termination you
may request an export for [30] days, after which we may delete it. We may retain
limited records as required by law.

## 7. Your rights
Depending on your location, you may have rights to access, correct, delete, or export
personal data, or to object to certain processing. For Account Data, contact us. For
Customer Data, contact the organization that entered it (we'll assist them as their
processor). **[Counsel: add CCPA/CPRA "Do Not Sell/Share" language and, if relevant,
GDPR lawful-basis and DPA references.]**

## 8. Cookies
We use a single essential, httpOnly session cookie for authentication. We do not use
third-party advertising or tracking cookies. **[Update if analytics are added.]**

## 9. Children
The Service is for business use and not directed to children under 16. We don't
knowingly collect their data.

## 10. Changes
We'll post updates here and, for material changes, notify you by email or in-app.

## 11. Contact
Privacy questions: [PRIVACY CONTACT EMAIL] · [COMPANY LEGAL NAME] · [ADDRESS]
