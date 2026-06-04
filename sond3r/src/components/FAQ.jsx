import Section from './primitives/Section.jsx'

const faqs = [
  {
    q: 'What is SOND3R?',
    a: 'A minimal desktop music application focused on listening, not browsing.',
  },
  {
    q: 'Which platforms are supported?',
    a: 'macOS, Windows, and Linux.',
  },
  {
    q: 'How much does it cost?',
    a: 'SOND3R is free. Use the download options above to get started.',
  },
  {
    q: 'How do I report a bug or get support?',
    // Keep this invite in sync with the Discord link in Footer.jsx.
    a: (
      <>
        Reach out to us through{' '}
        <a
          href="https://discord.gg/sond3r"
          target="_blank"
          rel="noopener noreferrer"
        >
          Discord
        </a>
        .
      </>
    ),
  },
]

export default function FAQ() {
  return (
    <Section title="FAQ">
      <dl className="faq">
        {faqs.map((item) => (
          <div className="faq-item" key={item.q}>
            <dt>{item.q}</dt>
            <dd>{item.a}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}
