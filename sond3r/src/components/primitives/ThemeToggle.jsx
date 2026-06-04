import { useTheme } from '../../lib/useTheme.js'

// A self-contained light/dark toggle. Makes no assumptions about where it sits
// (no positional margins); style comes from the .theme-toggle class, so it can
// be dropped into the footer, a header, or anywhere else.
//
// The label/icon describe the action (switch to the *other* theme) rather than
// the current state, which reads more clearly on a single button.
export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  const nextLabel = isDark ? 'light' : 'dark'

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${nextLabel} mode`}
      title={`Switch to ${nextLabel} mode`}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isDark ? '☀' : '☾'}
      </span>
    </button>
  )
}
