import { useEffect, useState } from 'react'
import {
  getStoredTheme,
  resolveTheme,
  setStoredTheme,
  watchSystemTheme,
} from './theme.js'

// React binding over the theme helpers in theme.js. Exposes the active theme
// and a setter, and keeps the page in sync with the OS preference while the
// visitor has not made an explicit choice.
//
// Returns:
//   theme      'light' | 'dark' — the theme currently in effect
//   setTheme   (theme) => void  — persist an explicit choice
//   toggle     () => void       — flip between light and dark
export function useTheme() {
  const [theme, setThemeState] = useState(resolveTheme)

  // Follow the OS preference, but only while there is no explicit override.
  useEffect(() => {
    return watchSystemTheme((systemTheme) => {
      if (getStoredTheme() === null) setThemeState(systemTheme)
    })
  }, [])

  const setTheme = (next) => {
    setStoredTheme(next)
    setThemeState(next)
  }

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  return { theme, setTheme, toggle }
}
