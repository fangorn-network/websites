// Theme resolution + persistence. Single source of truth for how the site
// decides between light and dark, kept dependency-free so it works on any
// static host.
//
// Model:
//   - The user's explicit choice ('light' | 'dark') is stored in localStorage.
//   - With no stored choice, we follow the OS-level prefers-color-scheme.
//   - The resolved theme is reflected as a `data-theme` attribute on <html>,
//     which the CSS in styles.css keys off of. The same attribute is set by an
//     inline script in index.html *before* React mounts, so there is no flash
//     of the wrong theme on load.
//
// The matching inline script in index.html duplicates STORAGE_KEY and the
// resolve logic by necessity (it must run before this module loads). Keep the
// two in sync if you change the key or the default behavior.

export const STORAGE_KEY = 'sond3r:theme'

const PREFERS_DARK = '(prefers-color-scheme: dark)'

// The visitor's stored override, or null if they have not chosen one.
export function getStoredTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

// The OS-level preference, defaulting to light when unknown.
export function getSystemTheme() {
  return typeof window !== 'undefined' &&
    window.matchMedia?.(PREFERS_DARK).matches
    ? 'dark'
    : 'light'
}

// The theme actually in effect right now: stored choice wins, else the OS.
export function resolveTheme() {
  return getStoredTheme() ?? getSystemTheme()
}

// Reflect a resolved theme onto the document so the CSS applies it.
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

// Persist an explicit choice and apply it. Pass null to clear the override and
// fall back to following the OS preference.
export function setStoredTheme(theme) {
  try {
    if (theme === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* storage unavailable — choice simply won't persist across reloads */
  }
  applyTheme(theme ?? getSystemTheme())
}

// Subscribe to OS preference changes. Only meaningful while the visitor has no
// explicit override; the caller is responsible for that guard. Returns an
// unsubscribe function.
export function watchSystemTheme(onChange) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mql = window.matchMedia(PREFERS_DARK)
  const handler = (event) => onChange(event.matches ? 'dark' : 'light')
  mql.addEventListener('change', handler)
  return () => mql.removeEventListener('change', handler)
}
