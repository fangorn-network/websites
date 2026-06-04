import Section from './primitives/Section.jsx'
import { DISCORD_URL } from '../lib/constants.js'

const faqs = [
  {
    q: 'What is SOND3R?',
    a: 'A desktop music application that plugs into existing music streaming applications.',
  },
  {
    q: 'Do I need a subscription?',
    a: 'SOND3R only supports playback on Spotify which requires a Spotify premium subscription.',
  },
  {
    q: 'Does SOND3R plan to support other music streaming applications?',
    a: 'Yes, SOND3R will eventually support playback across all major streaming applications.',
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
