import Section from './primitives/Section.jsx'
import SonderButtons from './primitives/SonderButtons.jsx'
import { DOWNLOAD_URLS } from '../lib/constants.js'

const downloads = [
  { label: 'Download for Windows', href: DOWNLOAD_URLS.windows },
  { label: 'Download for macOS', href: DOWNLOAD_URLS.macos },
  { label: 'Download for Linux', href: DOWNLOAD_URLS.linux },
]

export default function Hero() {
  return (
    <Section className="hero" as="h1" title="SOND3R">
      <p className="lead">A music player for people who actually listen.</p>
      <SonderButtons items={downloads} />
    </Section>
  )
}
