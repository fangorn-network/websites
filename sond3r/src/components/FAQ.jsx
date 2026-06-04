import Section from './primitives/Section.jsx'
import { DISCORD_URL } from '../lib/constants.js'

const faqs = [
  {
    q: 'What is SOND3R?',
    a: 'A desktop music application to bring music lovers closer to the music they love.',
  },
  {
    q: 'Which platforms are supported?',
    a: 'Windows, macOS, and Linux.',
  },
  {
    q: 'How much does it cost?',
    a: 'SOND3R is free. Use the download options above to get started.',
  },
  {
    q: 'How do I report a bug or get support?',
    a: (
      <>
        Reach out to us through{' '}
        <a
          href={DISCORD_URL}
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
