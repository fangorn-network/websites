import { useState } from 'react';
import styles from './Nav.module.css';
import { useAuth } from './authContext';

// Light/dark switch. The choice is saved; until one is made, index.html follows the system.
function ThemeToggle() {
  const [dark, setDark] = useState(document.documentElement.dataset.theme === 'dark');
  function flip() {
    const theme = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.theme = theme; } catch {}
    setDark(!dark);
  }
  return (
    <button className={styles.theme} onClick={flip} type="button" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {dark
          ? <><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
          : <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />}
      </svg>
    </button>
  );
}

// The same on every screen: inline on wide ones, behind a menu button on narrow ones.
// GitHub, Discord and Contact live in the footer.
const LINKS = [
  ['#/explore', 'Explore'],
  ['https://docs.fangorn.network', 'Docs'],
];

export default function Nav() {
  const { ready, authenticated, login, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <nav className={styles.nav}>
      <a href="#" className={styles.logo}>Fangorn</a>
      <div className={open ? `${styles.links} ${styles.open}` : styles.links} onClick={() => setOpen(false)}>
        {LINKS.map(([href, label]) => <a key={href} href={href} className={styles.link}>{label}</a>)}
        {authenticated && <button type="button" className={`${styles.link} ${styles.menuOnly}`} onClick={logout}>Log out</button>}
      </div>
      <div className={styles.right}>
        <ThemeToggle />
        {authenticated ? (
          <>
            <button className={styles.ghostBtn} onClick={logout}>Log out</button>
            <a href="#/account" className={styles.btn}>Account</a>
          </>
        ) : (
          <button className={styles.btn} onClick={login} disabled={!ready}>Log in</button>
        )}
        <button className={styles.menu} type="button" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
        </button>
      </div>
    </nav>
  );
}
