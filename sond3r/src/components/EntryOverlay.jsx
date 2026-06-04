import { useState, useEffect } from 'react'

// Remember (for this browser session) that the visitor has entered, so the
// overlay doesn't reappear when navigating back to the home page.
const ENTERED_KEY = 'sond3r:entered'

export default function EntryOverlay({ onEnter }) {
  const [visible, setVisible] = useState(() => {
    try {
      return sessionStorage.getItem(ENTERED_KEY) !== '1'
    } catch {
      return true
    }
  })
  const [exiting, setExiting] = useState(false)
  const [showCursor, setShowCursor] = useState(true)

  // Blinking cursor on the definition.
  useEffect(() => {
    if (!visible) return
    const id = setInterval(() => setShowCursor((c) => !c), 530)
    return () => clearInterval(id)
  }, [visible])

  // Lock background scroll while the overlay is up.
  useEffect(() => {
    if (!visible) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [visible])

  const handleEnter = () => {
    try {
      sessionStorage.setItem(ENTERED_KEY, '1')
    } catch {
      /* storage unavailable — overlay simply won't persist */
    }
    setExiting(true)
    // Wait for the fade-out (matches .entry-overlay--exit) before unmounting.
    setTimeout(() => {
      setVisible(false)
      onEnter?.()
    }, 600)
  }

  if (!visible) return null

  return (
    <div className={`entry-overlay${exiting ? ' entry-overlay--exit' : ''}`}>
      <div className="entry-content">
        <p className="entry-header">
          <span className="entry-dict">dict.</span>
          <span>entry #1</span>
        </p>

        <h1 className="entry-word">sonder</h1>

        <p className="entry-pos">
          <em>n.</em>
        </p>

        <div className="entry-rule" />

        <p className="entry-definition">
          The realization that each passerby has a life as vivid and complex as
          your own, inhabited by their own ambitions, friends, routines, worries
          and inherited craziness; an epic story that continues invisibly around
          you like an anthill sprawling deep underground, with elaborate
          passageways to thousands of other lives that you&rsquo;ll never know
          existed, in which you might appear only once, as an extra sipping
          coffee in the background, as a blur of traffic passing on the highway,
          as a light in the night.
          <span className="entry-cursor" style={{ opacity: showCursor ? 1 : 0 }}>
            ▮
          </span>
        </p>

        <p className="entry-source">
          From{' '}
          <a
            href="https://www.dictionaryofobscuresorrows.com/post/23536922667/sonder"
            target="_blank"
            rel="noopener noreferrer"
          >
            The Dictionary of Obscure Sorrows
          </a>
        </p>

        <button type="button" className="button" onClick={handleEnter}>
          Enter
        </button>
      </div>
    </div>
  )
}
