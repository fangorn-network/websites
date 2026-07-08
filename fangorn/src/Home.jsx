import { useState } from 'react';
import styles from './Home.module.css';
import { useAuth } from './authContext';
import { useBuckets } from './buckets';

const INSTALL_CMD = 'npm i @fangorn-network/sdk';
const DEPLOY_CMD = 'fangorn deploy';
const ARBISCAN = 'https://sepolia.arbiscan.io';
const explorer = (addr) => `${ARBISCAN}/address/${addr}`;

// viem attaches .shortMessage to contract/RPC errors; fall back to .message.
function friendlyError(err) {
  const msg = err?.shortMessage || err?.message || String(err);
  if (/rejected|denied/i.test(msg)) return 'Transaction cancelled.';
  if (/insufficient funds/i.test(msg)) return 'Not enough ETH for gas. Add funds and try again.';
  if (/AlreadyRegistered/i.test(msg)) return 'This wallet already has a bucket.';
  return msg;
}

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

function CopyButton({ text, label = 'Copy', className }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button className={className} onClick={copy} type="button">
      {copied ? 'Copied' : label}
    </button>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className={styles.accountRow}>
      <span className={styles.accountLabel}>{label}</span>
      {children}
    </div>
  );
}

function AddressValue({ address }) {
  if (!address) return <span className={styles.accountValueMono}>…</span>;
  return (
    <a className={styles.accountValueMono} href={explorer(address)} target="_blank" rel="noreferrer">
      {truncate(address, 8, 6)}
    </a>
  );
}

// One bucket per wallet, provisioned on-chain by the PublisherRegistry. Shows
// the registration CTA until the wallet has a bucket, then its on-chain info.
function BucketPanel({ bucket, details, walletAddress, loading, creating, create }) {
  const [error, setError] = useState(null);

  async function onCreate() {
    setError(null);
    try {
      await create();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  if (loading) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>Checking for your bucket…</p>
      </div>
    );
  }

  if (!bucket) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>
          No bucket yet. Registering provisions your on-chain bucket — one per
          wallet — so you can publish schemas and datasources.
        </p>
        {error && <div className={styles.formError}>{error}</div>}
        <button className={styles.primaryBtn} onClick={onCreate} disabled={creating} type="button">
          {creating ? 'Creating…' : 'Create a bucket'}
        </button>
      </div>
    );
  }

  const ownerIsYou =
    details?.owner && walletAddress &&
    details.owner.toLowerCase() === walletAddress.toLowerCase();

  return (
    <div className={styles.bucketList}>
      <div className={styles.bucketItem}>
        <div className={styles.bucketHead}>
          <span className={styles.bucketName}>Your bucket</span>
          <a className={styles.bucketSlug} href={explorer(bucket)} target="_blank" rel="noreferrer">
            {truncate(bucket, 8, 6)}
          </a>
          <CopyButton text={bucket} label="Copy address" className={styles.copyBtn} />
        </div>

        <div className={styles.bucketDetails}>
          <DetailRow label="Owner">
            <span className={styles.walletCell}>
              <AddressValue address={details?.owner} />
              {ownerIsYou && <span className={styles.bucketSlug}>you</span>}
            </span>
          </DetailRow>
          <DetailRow label="Registry">
            <AddressValue address={details?.registry} />
          </DetailRow>
          <DetailRow label="Network">
            <span className={styles.accountValue}>Arbitrum Sepolia</span>
          </DetailRow>
        </div>

        <div className={styles.deployRow}>
          <code className={styles.deployCmd}>{DEPLOY_CMD}</code>
          <CopyButton text={DEPLOY_CMD} className={styles.copyBtn} />
        </div>
      </div>
    </div>
  );
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
  const { user, logout, fundWallet } = useAuth();
  const { bucket, details, loading, creating, create } = useBuckets();
  const [copied, setCopied] = useState(false);
  const [funding, setFunding] = useState(false);

  const { name, contact, method } = readIdentity(user);
  const wallet = user?.wallet?.address;

  function copyInstall() {
    navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function addFunds() {
    setFunding(true);
    try {
      await fundWallet();
    } catch (err) {
      // Privy rejects when the user closes the flow — nothing to surface.
      console.warn('Funding did not complete:', err);
    } finally {
      setFunding(false);
    }
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
              <div className={styles.walletCell}>
                <span className={styles.accountValueMono}>{truncate(wallet, 8, 6)}</span>
                <button
                  className={styles.fundBtn}
                  onClick={addFunds}
                  disabled={funding}
                  type="button"
                >
                  {funding ? 'Funding…' : 'Add funds'}
                </button>
              </div>
            </div>
          )}
          {user?.id && (
            <div className={styles.accountRow}>
              <span className={styles.accountLabel}>User ID</span>
              <span className={styles.accountValueMono}>{truncate(user.id, 14, 6)}</span>
            </div>
          )}
        </section>

        <h2 className={styles.h2}>Your bucket</h2>
        <BucketPanel
          bucket={bucket}
          details={details}
          walletAddress={wallet}
          loading={loading}
          creating={creating}
          create={create}
        />

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
