import FooterBar from './primitives/FooterBar.jsx'
import ThemeToggle from './primitives/ThemeToggle.jsx'
import {
  CONTACT_MAILTO,
  DISCORD_URL,
  FANGORN_URL,
  GITHUB_REPO_URL,
} from '../lib/constants.js'

const links = [
  { label: 'Discord', href: DISCORD_URL, external: true },
  { label: 'GitHub', href: GITHUB_REPO_URL, external: true },
  { label: 'Fangorn Protocol', href: FANGORN_URL, external: true },
  { label: 'Contact', href: CONTACT_MAILTO },
  { label: 'Privacy', href: '#/privacy' },
  { label: 'Terms', href: '#/terms' },
]

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <FooterBar>
      <span>&copy; {year} Fangorn, LLC</span>
      <nav className="footer-links">
        {links.map(({ label, href, external }) => (
          <a
            key={label}
            href={href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {label}
          </a>
        ))}
        <ThemeToggle />
      </nav>
    </FooterBar>
  )
}
