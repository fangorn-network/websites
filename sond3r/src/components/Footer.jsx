import FooterBar from './primitives/FooterBar.jsx'

// Placeholder links — point these at the real destinations when ready.
const links = [
  { label: 'Discord', href: 'https://discord.gg/sond3r', external: true },
  { label: 'GitHub', href: 'https://github.com/fangorn-network/sonder', external: true },
  { label: 'Fangorn Protocol', href: 'https://fangorn.network', external: true },
  { label: 'Contact', href: 'mailto:fangorn@fangorn.network' },
  { label: 'Privacy', href: '#/privacy' },
  { label: 'Terms', href: '#/terms' },
]

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <FooterBar>
      <span>&copy; {year} SOND3R</span>
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
      </nav>
    </FooterBar>
  )
}
