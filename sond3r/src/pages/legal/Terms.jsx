import LegalPage from './LegalPage.jsx'
import { CONTACT_EMAIL, CONTACT_MAILTO } from '../../lib/constants.js'

const MIT_LICENSE = `MIT License

Copyright (c) 2026 SOND3R

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="June 3, 2026">
      <p>
        These Terms of Service (“Terms”) govern your use of the SOND3R website
        and application. By accessing or using SOND3R, you agree to these Terms.
        If you do not agree, please do not use the service.
      </p>

      <h2>The software license</h2>
      <p>
        The SOND3R application and its source code are open source, released
        under the MIT License. You are free to use, copy, modify, and distribute
        the software under the terms below:
      </p>
      <pre className="legal-license">{MIT_LICENSE}</pre>

      <h2>Use of this website</h2>
      <p>
        You agree to use this website lawfully — not to interfere with its
        operation, attempt to gain unauthorized access, or use it to distribute
        harmful or unlawful content.
      </p>

      <h2>Contributions</h2>
      <p>
        Financial contributions made through this website are voluntary and are
        processed by Stripe. Unless required by law, contributions are
        non-refundable.
      </p>

      <h2>Intellectual property</h2>
      <p>
        The source code is licensed as described above. The SOND3R name, logo,
        and branding are not covered by the MIT License and remain our property;
        please do not use them in a way that implies endorsement without our
        permission.
      </p>

      <h2>Disclaimer</h2>
      <p>
        The website and software are provided “as is”, without warranties of any
        kind, express or implied. We do not warrant that the service will be
        uninterrupted, error-free, or secure.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, SOND3R and its contributors will
        not be liable for any indirect, incidental, or consequential damages
        arising from your use of the website or software.
      </p>

      <h2>Third-party links</h2>
      <p>
        Our site may link to third-party websites and services that we do not
        control and are not responsible for. Your use of them is subject to
        their own terms and policies.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these Terms from time to time. Continued use of the
        service after changes take effect constitutes acceptance of the updated
        Terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these Terms? Email us at{' '}
        <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
