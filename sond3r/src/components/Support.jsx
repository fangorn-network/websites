import { useState, useCallback } from 'react'
import Section from './primitives/Section.jsx'

const QUICK_AMOUNTS = [10, 25, 50, 100, 250]
const MAX = 250
const STRIPE_BASE_URL = 'https://donate.stripe.com/fZu14meFv9vy3Rjb3ZeZ200'

export default function Support() {
  const [amount, setAmount] = useState(25)
  const [customVal, setCustomVal] = useState('')

  const update = useCallback((val, source) => {
    // Clamp to at least 1, defaulting to 1 if the input is cleared entirely.
    const parsed = Number(val)
    const n = isNaN(parsed) || parsed < 1 ? 1 : Math.round(parsed)

    setAmount(n)
    if (source !== 'custom') setCustomVal('')
  }, [])

  const handleSlider = (e) => update(e.target.value, 'slider')
  const handleQuick = (val) => update(val, 'quick')
  const handleCustom = (e) => {
    const val = e.target.value
    setCustomVal(val)
    // Only update the checkout amount once they've typed a number above 0.
    if (val && Number(val) > 0) {
      update(val, 'custom')
    }
  }

  const handleCta = () => {
    // Pass the amount in cents via Stripe's official __prefilled_amount param.
    window.open(`${STRIPE_BASE_URL}?__prefilled_amount=${amount * 100}`, '_blank')
  }

  const pct = Math.min((amount / MAX) * 100, 100)
  const sliderBg = `linear-gradient(to right, var(--fg) ${pct}%, var(--border) ${pct}%)`

  return (
    <Section title="Support">
      <p>
        SOND3R is in early access and built in the open. If you like it, consider chipping in toward active development.
      </p>

      <p className="support-amount">${amount}</p>

      <div className="support-slider-wrap">
        <input
          type="range"
          className="support-slider"
          min={1}
          max={MAX}
          step={1}
          value={Math.min(amount, MAX)}
          onChange={handleSlider}
          style={{ background: sliderBg }}
          aria-label="Support amount"
        />
        <div className="support-slider-labels">
          <span>$1</span>
          <span>$250+</span>
        </div>
      </div>

      <div className="support-quick">
        {QUICK_AMOUNTS.map((val) => (
          <button
            key={val}
            type="button"
            className={`support-quick-btn${amount === val ? ' active' : ''}`}
            onClick={() => handleQuick(val)}
          >
            ${val}
          </button>
        ))}
      </div>

      <div className="support-custom">
        <label htmlFor="support-custom" className="support-custom-label">
          Other: $
        </label>
        <input
          id="support-custom"
          type="number"
          className="support-custom-input"
          min={1}
          placeholder="Custom amount"
          value={customVal}
          onChange={handleCustom}
        />
      </div>

      <button type="button" className="support-cta" onClick={handleCta}>
        Support now - ${amount}
      </button>

      <p className="support-note">Via Stripe. Supporting active development.</p>
    </Section>
  )
}
