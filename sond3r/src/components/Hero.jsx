import Section from './primitives/Section.jsx'
import SonderButtons from './primitives/SonderButtons.jsx'

// Point these hrefs at your real installers or store pages.
const downloads = [
  { label: 'Download for Windows', href: 'https://github.com/fangorn-network/sonder/releases/latest/download/sond3r.exe' },
  { label: 'Download for macOS', href: 'https://github.com/fangorn-network/sonder/releases/latest/download/sond3r-arm64.dmg' },
  { label: 'Download for Linux', href: 'https://github.com/fangorn-network/sonder/releases/latest/download/sond3r.AppImage' },
]

export default function Hero() {
  return (
    <Section className="hero" as="h1" title="SOND3R">
      <p className="lead">A music player for people who actually listen.</p>
      <SonderButtons items={downloads} />
    </Section>
  )
}
