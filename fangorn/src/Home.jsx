import { useState } from 'react';
import styles from './Home.module.css';
import { useAuth } from './authContext';

const INSTALL_CMD = 'npm i @fangorn-network/sdk';

function truncate(value, lead = 6, tail = 4) {
  if (!value) return '';
  return value.length > lead + tail + 1
    ? `${value.slice(0, lead)}…${value.slice(-tail)}`
    : value;
}

// Pull a friendly identity out of Privy's user object, whichever method they
// signed in with (email, Google, or wallet).
function readIdentity(user) {
  if (!user) return { name: 'there', contact: null, method: null };

  const email = user.email?.address || user.google?.email;
  const wallet = user.wallet?.address;

  if (user.google?.name) return { name: user.google.name, contact: email, method: 'Google' };
  if (email) return { name: email.split('@')[0], contact: email, method: user.google ? 'Google' : 'Email' };
  if (wallet) return { name: truncate(wallet), contact: wallet, method: 'Wallet' };
  return { name: 'there', contact: null, method: null };
}

function GetStartedCard({ title, body, action, href, onClick }) {
  const inner = (
    <>
      <div className={styles.cardTitle}>{title}</div>
      <p className={styles.cardBody}>{body}</p>
      <span className={styles.cardAction}>{action} →</span>
    </>
  );
  return href ? (
    <a className={styles.card} href={href} target="_blank" rel="noreferrer">{inner}</a>
  ) : (
    <button className={styles.card} onClick={onClick} type="button">{inner}</button>
  );
}

export default function Home() {
  const { user, logout } = useAuth();
  const [copied, setCopied] = useState(false);

  const { name, contact, method } = readIdentity(user);
  const wallet = user?.wallet?.address;

  function copyInstall() {
    navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <span className={styles.logo}>Fangorn</span>
        <div className={styles.topRight}>
          {contact && <span className={styles.userChip}>{contact}</span>}
          <button className={styles.logoutBtn} onClick={logout}>Log out</button>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.welcome}>
          <span className={styles.eyebrow}>Home</span>
          <h1 className={styles.h1}>Welcome, {name}.</h1>
          <p className={styles.sub}>
            Your account is ready. Here's where to go next to start building on Fangorn.
          </p>
        </section>

        <section className={styles.account}>
          <div className={styles.accountRow}>
            <span className={styles.accountLabel}>Signed in with</span>
            <span className={styles.accountValue}>{method || 'Account'}</span>
          </div>
          {contact && (
            <div className={styles.accountRow}>
              <span className={styles.accountLabel}>Account</span>
              <span className={styles.accountValue}>{contact}</span>
            </div>
          )}
          {wallet && (
            <div className={styles.accountRow}>
              <span className={styles.accountLabel}>Wallet</span>
              <span className={styles.accountValueMono}>{truncate(wallet, 8, 6)}</span>
            </div>
          )}
          {user?.id && (
            <div className={styles.accountRow}>
              <span className={styles.accountLabel}>User ID</span>
              <span className={styles.accountValueMono}>{truncate(user.id, 14, 6)}</span>
            </div>
          )}
        </section>

        <h2 className={styles.h2}>Get started</h2>
        <div className={styles.grid}>
          <GetStartedCard
            title="Install the SDK"
            body={copied ? 'Copied to clipboard.' : INSTALL_CMD}
            action={copied ? 'Copied' : 'Copy command'}
            onClick={copyInstall}
          />
          <GetStartedCard
            title="Read the docs"
            body="Define schemas, encrypt by intent, and publish on-chain."
            action="Open docs"
            href="https://docs.fangorn.network"
          />
          <GetStartedCard
            title="Explore on GitHub"
            body="Browse the SDK, x402f, and the Fangorn agent."
            action="View source"
            href="https://github.com/fangorn-network/fangorn"
          />
          <GetStartedCard
            title="Join the community"
            body="Ask questions and share what you're building on Discord."
            action="Open Discord"
            href="https://discord.gg/JDj8RdCVyU"
          />
        </div>
      </main>
    </div>
  );
}
