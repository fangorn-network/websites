// Centralized site-wide constants such as brand links, contact, and distribution
// URLs. Anything referenced in more than one place (or likely to change) lives
// here so there's a single source of truth to update.

// Contact
export const CONTACT_EMAIL = 'fangorn@fangorn.network'
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`

// Social / community
export const DISCORD_URL = 'https://discord.gg/JDj8RdCVyU'
export const GITHUB_REPO_URL = 'https://github.com/fangorn-network/sonder'

// Related projects
export const FANGORN_URL = 'https://fangorn.network'

// This site
export const SITE_URL = 'https://sond3r.com'

// Payments
export const STRIPE_DONATE_URL = 'https://donate.stripe.com/fZu14meFv9vy3Rjb3ZeZ200'

// Desktop app downloads served from the latest GitHub release, so the URLs
// stay valid as new versions ship.
const RELEASE_DOWNLOAD_BASE = `${GITHUB_REPO_URL}/releases/latest/download`
export const DOWNLOAD_URLS = {
  windows: `${RELEASE_DOWNLOAD_BASE}/sond3r.exe`,
  macos: `${RELEASE_DOWNLOAD_BASE}/sond3r-arm64.dmg`,
  linux: `${RELEASE_DOWNLOAD_BASE}/sond3r.AppImage`,
}
