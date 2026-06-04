import { useState, useEffect, useCallback } from 'react'
import Section from './primitives/Section.jsx'
import SonderButtons from './primitives/SonderButtons.jsx'

const SITE_URL = 'https://sond3r.com'
const SHARE_TEXT = 'Check out SOND3R'

const u = encodeURIComponent(SITE_URL)
const t = encodeURIComponent(SHARE_TEXT)

// Platforms with real web share intents. (Instagram has none — it's covered by
// the native share sheet on mobile instead.)
const SHARE_LINKS = [
  { name: 'X', url: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
  { name: 'Reddit', url: `https://www.reddit.com/submit?url=${u}&title=${t}` },
  { name: 'LinkedIn', url: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
  { name: 'Facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
]

export default function Share() {
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)

  // Check for the native share sheet once on the client (avoids SSR mismatch)
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && !!navigator.share)
  }, [])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SITE_URL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard API unavailable */
    }
  }, [])

  const handleShare = useCallback(async () => {
    try {
      await navigator.share({ title: 'SOND3R', text: SHARE_TEXT, url: SITE_URL })
    } catch {
      /* user cancelled or unsupported — ignore */
    }
  }, [])

  const items = [
    ...(canShare ? [{ label: 'Share', onClick: handleShare }] : []),
    ...SHARE_LINKS.map(({ name, url }) => ({ label: name, href: url, external: true })),
    { label: copied ? 'Copied ✓' : 'Copy link', onClick: handleCopy, active: copied },
  ]

  return (
    <Section title="Spread the word">
      <p>Not in a position to chip in? Sharing SOND3R helps just as much.</p>
      <SonderButtons items={items} />
    </Section>
  )
}
