import LegalPage from './LegalPage.jsx'
import { CONTACT_EMAIL, CONTACT_MAILTO } from '../../lib/constants.js'

// This is the Privacy Policy page. The file is deliberately named "DataNotice"
// (not "PrivacyPolicy") so ad/privacy blocker extensions don't block the module
// URL — the route, title, and footer label all still read "Privacy".
export default function DataNotice() {
  return (
    <LegalPage title="Privacy Policy" updated="June 4, 2026">
      <p>
        SOND3R (“we”, “us”) is built to collect as close to nothing as possible
        about the people who visit it. This page is short on purpose: it
        describes the little data that can reach us, and the few third parties
        that may handle it on our behalf.
      </p>

      <h2>What we collect</h2>
      <p>
        Nothing. We use no cookies, no analytics, and no
        tracking of any kind. We don&rsquo;t log who you are, where you came
        from, or what you do on the site. A few small preferences are kept only
        in your browser and are never sent to us: whether you&rsquo;ve dismissed
        the intro screen (cleared when you close the tab) and your light or dark
        theme choice (remembered across visits until you clear it).
      </p>

      <h2>Third parties that may handle data</h2>
      <p>
        We rely on a few outside services to run this website. Each has its own
        privacy practices, which we don&rsquo;t control.
      </p>
      <ul>
        <li>
          <strong>Hosting (Vercel)</strong>: our site is served by Vercel. As
          with any web host, Vercel may automatically record technical
          information (such as IP addresses and request logs) in the course of
          delivering the site. See{' '}
          <a
            href="https://vercel.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Vercel&rsquo;s Privacy Policy
          </a>
          .
        </li>
        <li>
          <strong>Email</strong>: if you email us, we receive your email
          address and whatever you put in your message. We use it only to reply
          to you.
        </li>
        <li>
          <strong>Payments (Stripe)</strong>: if you choose to support us,
          payments are processed by Stripe, which collects the payment details
          it needs to complete the transaction. We never see or store your full
          card details. See{' '}
          <a
            href="https://stripe.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Stripe&rsquo;s Privacy Policy
          </a>
          .
        </li>
      </ul>
      <p>
        We do not sell your information, and we only share it with the services
        above as needed to run this website or when required by law.
      </p>

      <h2>Your rights and contact</h2>
      <p>
        Since the only personal information we hold is whatever you send us by
        email, you can ask us to access or delete it at any time. Email us at{' '}
        <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. Any changes will be
        reflected by the “Last updated” date above.
      </p>
    </LegalPage>
  )
}
