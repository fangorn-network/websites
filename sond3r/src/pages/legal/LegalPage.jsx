// Shared layout for the legal pages: a back link, a title, a "last updated"
// line, then the page body. Uses the same .container measure as the rest of
// the site so it scales identically.
export default function LegalPage({ title, updated, children }) {
  return (
    <main className="container legal">
      <a className="legal-back" href="#/">
        ← Back to SOND3R
      </a>
      <h1>{title}</h1>
      <p className="legal-updated">Last updated: {updated}</p>
      {children}
    </main>
  )
}
