import { useState } from 'react';
import { formatEther, formatUnits } from 'viem';
import styles from './Home.module.css';
import { useAuth } from './authContext';
import { usePublisher, useBalances, useFaucet, FAUCET_ETH, FAUCET_USDC } from './fangorn';
import { useSubscription, SUBSCRIPTION_WINDOW_DAYS } from './subscription';
import { useUsage } from './usage';
import { truncate, explorer, formatBytes } from './format';

const INSTALL_CMD = 'npm i @fangorn-network/sdk';

// viem attaches .shortMessage to contract/RPC errors; fall back to .message.
function friendlyError(err) {
  const msg = err?.shortMessage || err?.message || String(err);
  if (/rejected|denied/i.test(msg)) return 'Transaction cancelled.';
  if (/insufficient funds/i.test(msg)) return 'Not enough ETH for gas. Add funds and try again.';
  if (/AlreadyRegistered/i.test(msg)) return 'This wallet is already registered.';
  if (/NotRegistered/i.test(msg)) return 'Register before subscribing.';
  if (/cooldown/i.test(msg)) return 'Already claimed. Try again tomorrow.';
  if (/max fee per gas less than block base fee/i.test(msg)) {
    return 'Network fees moved while confirming. Try again.';
  }
  return msg;
}

// The faucet cooldown as "13h 20m" / "45m". Coarse on purpose — it's a hint,
// not a countdown.
function formatCooldown(secs) {
  const hours = Math.floor(secs / 3600);
  const mins = Math.round((secs % 3600) / 60);
  if (hours) return `${hours}h ${mins}m`;
  return mins ? `${mins}m` : 'a moment';
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

// Testnet faucet: 0.05 ETH + 10 USDC per wallet per 24h — enough to cover the
// registration fee and its gas. Balances are re-read once the drip is mined.
function FaucetRow({ onClaimed }) {
  const { eligible, retryAfter, loading, claiming, claim } = useFaucet();
  const [error, setError] = useState(null);

  async function onClaim() {
    setError(null);
    try {
      await claim();
      onClaimed();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  function status() {
    if (error) return error;
    if (loading) return '…';
    if (eligible) return `${FAUCET_ETH} ETH + ${FAUCET_USDC} USDC available`;
    return `Next drip in ${formatCooldown(retryAfter)}`;
  }

  return (
    <div className={styles.accountRow}>
      <span className={styles.accountLabel}>Testnet faucet</span>
      <div className={styles.walletCell}>
        <span className={styles.accountValue}>{status()}</span>
        <button
          className={styles.fundBtn}
          onClick={onClaim}
          disabled={loading || claiming || !eligible}
          type="button"
        >
          {claiming ? 'Dripping…' : 'Claim'}
        </button>
      </div>
    </div>
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

// One publisher per wallet, registered on-chain in the DataRegistry. Shows the
// registration CTA until the wallet is registered, then its on-chain info
// (owner / registry / network).
function PublisherPanel({ registered, details, walletAddress, loading, registering, register }) {
  const [error, setError] = useState(null);

  async function onRegister() {
    setError(null);
    try {
      await register();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  if (loading) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>Checking your registration…</p>
      </div>
    );
  }

  if (!registered) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>
          Not registered yet. Registering records your wallet as a publisher in the
          DataRegistry, giving it one state root of its own, so you can commit and
          push namespaces.
        </p>
        {error && <div className={styles.formError}>{error}</div>}
        <button className={styles.primaryBtn} onClick={onRegister} disabled={registering} type="button">
          {registering ? 'Registering…' : 'Register'}
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
          <span className={styles.bucketName}>Your publisher</span>
          <a className={styles.bucketSlug} href={explorer(details?.owner)} target="_blank" rel="noreferrer">
            {truncate(details?.owner, 8, 6)}
          </a>
          {details?.owner && <CopyButton text={details.owner} label="Copy address" className={styles.copyBtn} />}
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
      </div>
    </div>
  );
}

// The wallet's storage subscription (a separate SubscriptionRegistry contract).
// Shown only once registered — subscribe() requires an on-chain publisher. The
// first 1 GB is free; beyond that the upload gate requires an active subscription.
function SubscriptionPanel() {
  const { active, fee, expiresAt, loading, renewing, renew } = useSubscription();
  const [error, setError] = useState(null);

  async function onRenew() {
    setError(null);
    try {
      await renew();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  if (loading) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>Checking your subscription…</p>
      </div>
    );
  }

  const feeLabel = fee != null ? `${formatUnits(fee, 6)} USDC` : '…';

  return (
    <div className={styles.bucketList}>
      <div className={styles.bucketItem}>
        <div className={styles.bucketHead}>
          <span className={styles.bucketName}>Storage subscription</span>
          <span className={styles.bucketSlug}>{active ? 'Active' : 'Inactive'}</span>
        </div>

        <div className={styles.bucketDetails}>
          <DetailRow label="Status">
            <span className={styles.accountValue}>
              {active
                ? `Active until ${expiresAt?.toLocaleDateString()}`
                : 'Not active. Your first 1 GB is free'}
            </span>
          </DetailRow>
          <DetailRow label="Fee">
            <span className={styles.accountValue}>{feeLabel} / {SUBSCRIPTION_WINDOW_DAYS} days</span>
          </DetailRow>
        </div>

        {error && <div className={styles.formError}>{error}</div>}
        <button className={styles.primaryBtn} onClick={onRenew} disabled={renewing} type="button">
          {renewing ? 'Confirming…' : active ? 'Renew subscription' : 'Subscribe'}
        </button>
      </div>
    </div>
  );
}

// The wallet's storage usage, metered by the worker: lifetime total (vs the free
// tier) and today's usage (vs the daily cap). A limit of 0 means that gate is off,
// so we show just the amount.
function UsagePanel() {
  const { usage, loading } = useUsage();

  if (loading) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>Loading your usage…</p>
      </div>
    );
  }
  if (!usage) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>Usage is unavailable right now.</p>
      </div>
    );
  }

  const amount = (used, limit) =>
    limit > 0 ? `${formatBytes(used)} / ${formatBytes(limit)}` : formatBytes(used);

  return (
    <div className={styles.bucketList}>
      <div className={styles.bucketItem}>
        <div className={styles.bucketHead}>
          <span className={styles.bucketName}>Storage usage</span>
        </div>
        <div className={styles.bucketDetails}>
          <DetailRow label="Total stored">
            <span className={styles.accountValue}>{amount(usage.total, usage.freeLimit)}</span>
          </DetailRow>
          <DetailRow label="Today">
            <span className={styles.accountValue}>{amount(usage.daily, usage.dailyLimit)}</span>
          </DetailRow>
        </div>
      </div>
    </div>
  );
}

function GetStartedCard({ title, body, action, href, onClick, soon }) {
  const inner = (
    <>
      <div className={styles.cardTitle}>{title}</div>
      <p className={styles.cardBody}>{body}</p>
      <span className={styles.cardAction}>{soon ? action : `${action} →`}</span>
    </>
  );
  // `soon` cards are announcements, not links — no target to click yet.
  if (soon) {
    return <div className={`${styles.card} ${styles.cardSoon}`} aria-disabled="true">{inner}</div>;
  }
  return href ? (
    <a className={styles.card} href={href} target="_blank" rel="noreferrer">{inner}</a>
  ) : (
    <button className={styles.card} onClick={onClick} type="button">{inner}</button>
  );
}

// Apps built on Fangorn, shown once the wallet is a registered publisher — Drive
// is the first place a new publisher has something to do with their namespace.
const APPS = [
  {
    title: 'Fangorn Drive',
    body: 'Browse, upload, and share the namespaces your wallet publishes.',
    action: 'Open Drive',
    href: 'https://drive.fangorn.network',
  },
  {
    title: 'Builder guides',
    body: 'End-to-end walkthroughs for building your own app on a Fangorn namespace.',
    action: 'Coming soon',
    soon: true,
  },
];

// Live namespaces to look at.
const EXAMPLES = [
  {
    title: 'Eagle River',
    body: "What's on this week in Eagle River, published as a namespace anyone can subscribe to.",
    href: 'https://eagleriver.sond3r.com',
  },
  {
    title: 'Jackson',
    body: 'The same events graph, run by a different publisher for Jackson.',
    href: 'https://jackson.sond3r.com',
  },
  {
    title: 'Sherwood',
    body: 'Sherwood venues and listings, kept current by whoever owns the namespace.',
    href: 'https://sherwood.sond3r.com',
  },
  {
    title: 'SurgeXT manual',
    body: 'A product manual you can query instead of scroll through.',
    href: 'https://surgext-manual.fangorn.network',
  },
];

export default function Home() {
  const { user, logout, fundWallet } = useAuth();
  const { registered, details, loading, registering, register } = usePublisher();
  const { balances, refresh: refreshBalances } = useBalances();
  const [copied, setCopied] = useState(false);
  const [funding, setFunding] = useState(false);

  const { name, contact, method } = readIdentity(user);
  const wallet = user?.wallet?.address;
  const ethBalance = balances ? `${Number(formatEther(balances.eth)).toFixed(4)} ETH` : '…';
  const usdcBalance = balances ? `${Number(formatUnits(balances.usdc, 6)).toFixed(2)} USDC` : '…';

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

        <div className={styles.layout}>
          <div className={styles.colMain}>
            <h2 className={styles.h2}>Publisher</h2>
            <PublisherPanel
              registered={registered}
              details={details}
              walletAddress={wallet}
              loading={loading}
              registering={registering}
              register={register}
            />

            {registered && (
              <>
                <h2 className={styles.h2}>Apps</h2>
                <div className={styles.grid}>
                  {APPS.map((app) => <GetStartedCard key={app.title} {...app} />)}
                </div>
              </>
            )}

            <br></br>
            <h2 className={styles.h2}>Built on Fangorn</h2>
            <div className={styles.grid}>
              {EXAMPLES.map((example) => (
                <GetStartedCard key={example.title} action="Open" {...example} />
              ))}
            </div>
          </div>

          <aside className={styles.colSide}>
            <h2 className={styles.h2}>Account</h2>
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
              {wallet && (
                <div className={styles.accountRow}>
                  <span className={styles.accountLabel}>ETH balance</span>
                  <span className={styles.accountValue}>{ethBalance}</span>
                </div>
              )}
              {wallet && (
                <div className={styles.accountRow}>
                  <span className={styles.accountLabel}>USDC balance</span>
                  <span className={styles.accountValue}>{usdcBalance}</span>
                </div>
              )}
              {wallet && <FaucetRow onClaimed={refreshBalances} />}
              {user?.id && (
                <div className={styles.accountRow}>
                  <span className={styles.accountLabel}>User ID</span>
                  <span className={styles.accountValueMono}>{truncate(user.id, 14, 6)}</span>
                </div>
              )}
            </section>

            {registered && (
              <>
                <h2 className={styles.h2}>Subscription</h2>
                <SubscriptionPanel />

                <h2 className={styles.h2}>Storage usage</h2>
                <UsagePanel />
              </>
            )}

            <h2 className={styles.h2}>Build with the SDK</h2>
            <section className={styles.account}>
              <div className={styles.accountRow}>
                <span className={styles.accountValueMono}>{INSTALL_CMD}</span>
                <button className={styles.copyBtn} onClick={copyInstall} type="button">
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <a className={styles.resLink} href="https://deepwiki.com/fangorn-network/fangorn" target="_blank" rel="noreferrer">
                Documentation <span className={styles.resArrow}>→</span>
              </a>
              <a className={styles.resLink} href="https://github.com/fangorn-network/fangorn" target="_blank" rel="noreferrer">
                Source on GitHub <span className={styles.resArrow}>→</span>
              </a>
              <a className={styles.resLink} href="https://discord.gg/JDj8RdCVyU" target="_blank" rel="noreferrer">
                Discord <span className={styles.resArrow}>→</span>
              </a>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
