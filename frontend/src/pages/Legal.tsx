import { Link } from 'react-router-dom'

// Public, user-facing beta versions of our Terms & Privacy. The canonical,
// lawyer-review source lives in docs/legal/*.md; these pages present a readable
// beta summary. A full, counsel-reviewed version replaces these before public
// (non-friendly) launch — see docs/launch-timeline.md.

function LegalShell({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px', lineHeight: 1.6 }}>
      <p style={{ marginBottom: 18 }}><Link to="/signup" className="muted">← Back</Link></p>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>{title}</h1>
      <p className="muted" style={{ marginBottom: 8 }}>Last updated: {updated}</p>
      <div className="notice" style={{ background: 'rgba(227,147,60,0.12)', color: 'var(--warn)', marginBottom: 22 }}>
        Beta terms — AuraSphere is in early access. These terms may change; we'll notify you of material updates.
      </div>
      {children}
      <p className="muted" style={{ marginTop: 28, fontSize: 13 }}>
        Questions? Contact us through the in-app feedback widget or your account owner.
      </p>
    </div>
  )
}

const h: React.CSSProperties = { fontSize: 16, marginTop: 22, marginBottom: 6 }

export function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="July 2026">
      <p>By creating an account or using AuraSphere (the “Service”), you agree to these terms. If you
        use the Service for an organization, you confirm you're authorized to bind it.</p>
      <h2 style={h}>The Service</h2>
      <p>AuraSphere is a hosted freight transportation management and brokerage CRM. During beta it may
        change and may contain errors. Each customer organization is an isolated tenant; you're
        responsible for your users and for keeping credentials secure.</p>
      <h2 style={h}>Your data</h2>
      <p>You own the data you enter (shippers, carriers, loads, contacts, documents). You grant us a
        limited license to host and process it only to provide the Service. You're responsible for
        having the rights to submit it and for its accuracy and legality.</p>
      <h2 style={h}>Acceptable use</h2>
      <p>Don't use the Service unlawfully or for fraudulent freight activity, attempt to access another
        organization's data, probe our security without authorization, upload malware or infringing
        content, or disrupt the Service.</p>
      <h2 style={h}>Disclaimers &amp; liability</h2>
      <p>The Service is provided “as is” without warranties. AuraSphere is a software tool and is not a
        party to any brokerage, carriage, or freight contract; we're not responsible for freight loss,
        damage, or claims, and rate/vetting/tracking/market data may be inaccurate — your business
        decisions are your own. To the maximum extent permitted by law, our liability is limited as
        described in our full terms.</p>
      <h2 style={h}>Changes &amp; termination</h2>
      <p>We may update these terms and will communicate material changes. You may stop using the Service
        at any time; we may suspend access for breach or non-payment.</p>
    </LegalShell>
  )
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="July 2026">
      <p>This explains how we handle personal information in AuraSphere. We handle two kinds of data:
        <strong> account data</strong> (the users who log in) and <strong>customer data</strong> (the
        business records your organization enters — for which your organization is the controller and
        we act as processor).</p>
      <h2 style={h}>What we collect</h2>
      <p>Organization and user details, passwords (stored only as an argon2 hash — never plaintext), the
        records you enter, and basic security/session logs. We don't sell personal information.</p>
      <h2 style={h}>How we use &amp; share it</h2>
      <p>To provide, secure, and operate the Service, authenticate users, enforce tenant isolation, and
        send transactional email. We use sub-processors for hosting, email, payments, and any optional
        data providers you enable — each receives only what its function needs. We never expose one
        organization's data to another.</p>
      <h2 style={h}>Security</h2>
      <p>Passwords hashed with argon2; server-side sessions with httpOnly cookies and hashed tokens;
        data encrypted in transit (HTTPS) and at rest. No system is perfectly secure.</p>
      <h2 style={h}>Retention &amp; your rights</h2>
      <p>We keep your data while your account is active and offer an export window after termination.
        Depending on your location you may have rights to access, correct, delete, or export personal
        data — contact us to exercise them.</p>
    </LegalShell>
  )
}
