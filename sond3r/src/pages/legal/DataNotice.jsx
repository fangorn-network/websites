import LegalPage from './LegalPage.jsx'

// This is the Privacy Policy page. The file is deliberately named "DataNotice"
// (not "PrivacyPolicy") so ad/privacy blocker extensions don't block the module
// URL — the route, title, and footer label all still read "Privacy".
export default function DataNotice() {
  return (
    <LegalPage title="Privacy Policy" updated="June 3, 2026">
      <p>
        This Privacy Policy explains how SOND3R (“we”, “us”) collects, uses, and
        protects information when you visit this website or use our application.
        By using SOND3R, you agree to the practices described here.
      </p>

      <h2>Information we collect</h2>
      <p>
        We aim to collect as little as possible. Depending on how you use
        SOND3R, this may include:
      </p>
      <ul>
        <li>
          <strong>Information you provide</strong> — such as your email address
          when you contact us.
        </li>
        <li>
          <strong>Payment information</strong> — if you choose to support us,
          payments are handled by Stripe. We never see or store your full card
          details.
        </li>
        <li>
          <strong>Usage data</strong> — basic, non-identifying information such
          as the pages you visit and your approximate region, used to understand
          how the site is used.
        </li>
        <li>
          <strong>Cookies</strong> — small files that keep the site working and
          help us measure aggregate usage. You can disable cookies in your
          browser.
        </li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>To operate, maintain, and improve the website and application.</li>
        <li>To process contributions and respond to your requests.</li>
        <li>To answer your questions and provide support.</li>
        <li>To detect, prevent, and address technical issues or abuse.</li>
      </ul>

      <h2>Sharing</h2>
      <p>
        We do not sell your personal information. We share information only with
        the service providers that help us run SOND3R — for example, Stripe for
        payment processing and our hosting provider — and only as needed to
        provide those services, or when required by law.
      </p>

      <h2>Data retention</h2>
      <p>
        We keep information only as long as necessary for the purposes described
        here or as required by law, after which it is deleted or anonymized.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access, correct,
        or delete your personal information, or to object to certain processing.
        To exercise these rights, contact us at the address below.
      </p>

      <h2>Security</h2>
      <p>
        We use reasonable technical and organizational measures to protect your
        information. No method of transmission or storage is completely secure,
        however, and we cannot guarantee absolute security.
      </p>

      <h2>Children’s privacy</h2>
      <p>
        SOND3R is not directed to children under 13, and we do not knowingly
        collect personal information from them.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. Material changes will be
        reflected by the “Last updated” date above.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy? Email us at{' '}
        <a href="mailto:fangorn@fangorn.network">fangorn@fangorn.network</a>.
      </p>
    </LegalPage>
  )
}
