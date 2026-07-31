import { useState } from 'react';
import { formatEther, formatUnits, parseEther } from 'viem';
import styles from './Home.module.css';
import { useAuth } from './authContext';
import { usePublisher, useBalances, useFaucet, FAUCET_ETH, FAUCET_USDC } from './fangorn';
import { useSubscription, SUBSCRIPTION_WINDOW_DAYS } from './subscription';
import { useUsage } from './usage';
import { truncate, explorer, formatBytes, meterState } from './format';

const INSTALL_CMD = 'npm i @fangorn-network/sdk';
const DOCS_URL = 'https://deepwiki.com/fangorn-network/fangorn';

// Enough ETH to cover the registration fee and its gas. Below this the wallet is
// "Low" and the faucet is the thing to do next.
const LOW_ETH = parseEther('0.005');

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
  if (!user) return { name: 'there', contact: null };

  const email = user.email?.address || user.google?.email;
  const wallet = user.wallet?.address;

  if (user.google?.name) return { name: user.google.name, contact: email };
  if (email) return { name: email.split('@')[0], contact: email };
  if (wallet) return { name: truncate(wallet), contact: wallet };
  return { name: 'there', contact: null };
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

// ── Account panel primitives ────────────────────────────────────────────────
// Fields stack their value under their label rather than sitting opposite it.
// A column is only ~340px wide, and a space-between row there is one long string
// (a faucet error, a balance) away from pushing its own action out of the panel.

function Field({ label, children }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

// One of the three setup stages. `state` drives the header dot and always ships
// with `stateLabel` beside it — the colour alone never carries the meaning.
function Column({ title, state, stateLabel, children }) {
  return (
    <div className={styles.accountCol}>
      <div className={styles.colHead}>
        <span className={styles.colTitle}>{title}</span>
        <span className={`${styles.stateDot} ${styles[state]}`} aria-hidden="true" />
        <span className={styles.stateLabel}>{stateLabel}</span>
      </div>
      {children}
    </div>
  );
}

// Bytes used against a limit. Not a chart — a stat with a meter, so the answer to
// "am I near the cap?" survives a glance. A limit of 0 means the gate is off, and
// `null` means there is no ceiling to draw (a subscription lifts the lifetime one),
// so both render the bare amount.
// ponytail: a div + inline width beats <progress>, which needs
// ::-webkit-progress-value AND ::-moz-progress-bar to restyle. Swap if we ever
// want the native semantics for free.
function Meter({ label, used, limit }) {
  const meter = meterState(used, limit);
  if (!meter) {
    return (
      <Field label={label}>
        <div className={styles.fieldValue}>{formatBytes(used)}</div>
      </Field>
    );
  }

  return (
    <Field label={label}>
      <div
        className={styles.meterTrack}
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={label}
      >
        <div
          className={`${styles.meterFill} ${meter.full ? styles.meterFull : ''}`}
          style={{ width: `${meter.pct}%` }}
        />
      </div>
      <div className={styles.fieldValue}>
        {formatBytes(used)} / {formatBytes(limit)}
        {/* Near the cap the colour shift alone shouldn't carry it — say it in words. */}
        {meter.full && (
          <span className={styles.fieldNote}>
            {meter.remaining ? ` · ${formatBytes(meter.remaining)} left` : ' · Limit reached'}
          </span>
        )}
      </div>
    </Field>
  );
}

// ── Columns ─────────────────────────────────────────────────────────────────

// Testnet faucet: 0.05 ETH + 10 USDC per wallet per 24h — enough to cover the
// registration fee and its gas. Balances are re-read once the drip is mined.
function FaucetField({ onClaimed }) {
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

  return (
    <Field label="Testnet faucet">
      <div className={styles.fieldValue}>
        {loading ? '…' : eligible ? `${FAUCET_ETH} ETH + ${FAUCET_USDC} USDC` : `Next drip in ${formatCooldown(retryAfter)}`}
      </div>
      {error && <div className={styles.formError}>{error}</div>}
      <button
        className={styles.ghostBtn}
        onClick={onClaim}
        disabled={loading || claiming || !eligible}
        type="button"
      >
        {claiming ? 'Dripping…' : 'Claim'}
      </button>
    </Field>
  );
}

function WalletColumn({ wallet, balances, onFund, funding, refreshBalances }) {
  // Don't call it low until the balances actually land — an orange dot on a
  // still-loading wallet reads as a problem that isn't there.
  const low = balances && balances.eth < LOW_ETH;

  return (
    <Column
      title="Wallet"
      state={!balances ? 'statePending' : low ? 'stateWarn' : 'stateGood'}
      stateLabel={!balances ? 'Loading' : low ? 'Low balance' : 'Funded'}
    >
      <Field label="Address">
        <div className={styles.inlineValue}>
          <a
            className={styles.fieldValueMono}
            href={explorer(wallet)}
            target="_blank"
            rel="noreferrer"
          >
            {truncate(wallet, 8, 6)}
          </a>
          <CopyButton text={wallet} className={styles.ghostBtnSm} />
        </div>
      </Field>

      <br></br>

      <Field label="Balance">
        <div className={styles.fieldValue}>
          {balances ? `${Number(formatEther(balances.eth)).toFixed(4)} ETH` : '…'}
        </div>
        <div className={styles.fieldValue}>
          {balances ? `${Number(formatUnits(balances.usdc, 6)).toFixed(2)} USDC` : '…'}
        </div>
        <button className={styles.ghostBtn} onClick={onFund} disabled={funding} type="button">
          {funding ? 'Funding…' : 'Add funds'}
        </button>
      </Field>

      <br></br>

      <FaucetField onClaimed={refreshBalances} />
    </Column>
  );
}

// One publisher per wallet, registered on-chain in the DataRegistry. The register
// CTA lives here beside the balances that pay for it — registering costs a native
// ETH fee plus gas.
// `wallet` gates the CTA: an email login is authenticated a beat before Privy
// finishes minting its embedded wallet, and registering without one just throws.
function PublisherColumn({ wallet, registered, details, loading, registering, register }) {
  const [error, setError] = useState(null);

  async function onRegister() {
    setError(null);
    try {
      await register();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  return (
    <Column
      title="Publisher"
      state={loading ? 'statePending' : registered ? 'stateGood' : 'statePending'}
      stateLabel={loading ? 'Checking' : registered ? 'Active' : 'Not registered'}
    >
      {loading && <div className={styles.pending}>Checking your registration…</div>}

      {!loading && !registered && (
        <>
          <p className={styles.colText}>
            Registering records your wallet as a publisher, giving it a state root you
            can commit and push to.
          </p>
          {error && <div className={styles.formError}>{error}</div>}
          <button
            className={styles.primaryBtn}
            onClick={onRegister}
            disabled={registering || !wallet}
            title={wallet ? undefined : 'Setting up your wallet…'}
            type="button"
          >
            {registering ? 'Registering…' : 'Register'}
          </button>
        </>
      )}

      {!loading && registered && (
        <>
          <Field label="Network">
            <div className={styles.fieldValue}>Arbitrum Sepolia</div>
          </Field>
          <Field label="Registry">
            <a
              className={styles.fieldValueMono}
              href={explorer(details?.registry)}
              target="_blank"
              rel="noreferrer"
            >
              {truncate(details?.registry, 8, 6)}
            </a>
          </Field>
        </>
      )}
    </Column>
  );
}

// Usage and the subscription that lifts it, in one column: the lifetime free tier
// (which a subscription removes the ceiling on) and the daily upload cap (which
// applies to everyone). Both are metered by the worker, not the chain.
// The subscription itself is read in Home (the Apps section gates on it too) and
// passed down, so the page makes one lookup rather than one per consumer.
function StorageColumn({ registered, subscription }) {
  const { usage, loading } = useUsage();
  const { active, fee, expiresAt, loading: subLoading, renewing, renew } = subscription;
  const [error, setError] = useState(null);

  async function onRenew() {
    setError(null);
    try {
      await renew();
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  const busy = loading || subLoading;
  const feeLabel = fee != null ? `${formatUnits(fee, 6)} USDC` : '…';

  return (
    <Column
      title="Storage"
      state={busy ? 'statePending' : active ? 'stateGood' : 'statePending'}
      stateLabel={busy ? 'Loading' : active ? 'Subscribed' : 'Free tier'}
    >
      {busy && <div className={styles.pending}>Loading your usage…</div>}
      {!busy && !usage && <div className={styles.pending}>Usage is unavailable right now.</div>}

      {!busy && usage && (
        <>
          {/* A subscription removes the lifetime ceiling, so there's no limit to meter. */}
          <Meter
            label={active ? 'Total stored' : 'Free tier used'}
            used={usage.total}
            limit={active ? 0 : usage.freeLimit}
          />
          <Meter label="Uploaded today" used={usage.daily} limit={usage.dailyLimit} />
        </>
      )}

      {!busy && (
        <Field label="Subscription">
          <div className={styles.fieldValue}>
            {active
              ? `Active until ${expiresAt?.toLocaleDateString()}`
              : `${feeLabel} / ${SUBSCRIPTION_WINDOW_DAYS} days`}
          </div>
          {error && <div className={styles.formError}>{error}</div>}
          <button
            className={styles.ghostBtn}
            onClick={onRenew}
            disabled={renewing || !registered}
            type="button"
            // subscribe() cross-calls isRegistered and reverts NotRegistered, so
            // say why it's unavailable rather than letting the tx fail.
            title={registered ? undefined : 'Register first'}
          >
            {renewing ? 'Confirming…' : active ? 'Renew' : 'Subscribe'}
          </button>
        </Field>
      )}
    </Column>
  );
}

// ── Cards ───────────────────────────────────────────────────────────────────

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

// Drive can't save anything for a wallet that isn't registered and subscribed, so
// the card says which step is missing instead of handing over a link that fails
// on the far side. `soon` renders it as an unclickable announcement — same shape,
// no target.
function driveCard(registered, subscribed) {
  const base = {
    title: 'Fangorn Drive',
    body: 'Write and publish markdown notes under the namespaces your wallet owns.',
  };
  if (!registered) {
    return { ...base, action: 'Register your wallet first', soon: true };
  }
  if (!subscribed) {
    return { ...base, action: 'Subscribe to storage first', soon: true };
  }
  return { ...base, action: 'Open Drive', href: 'https://drive.fangorn.network' };
}

const APPS = [
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

// The one thing to do next, in the order the contracts enforce. Named as an
// action so the panel below it is findable, not as a status.
function nextStep(loading, registered, subscription) {
  if (loading || subscription.loading) return 'Checking where you left off…';
  if (!registered) return 'Register your wallet below to claim a publisher namespace.';
  if (!subscription.active) return 'Subscribe to storage below, then Drive can save for you.';
  return "You're set up. Open Drive to start writing.";
}

export default function Home() {
  const { user, logout, fundWallet } = useAuth();
  const { registered, details, loading, registering, register } = usePublisher();
  const { balances, refresh: refreshBalances } = useBalances();
  const subscription = useSubscription();
  const [funding, setFunding] = useState(false);

  const { name, contact } = readIdentity(user);
  const wallet = user?.wallet?.address;
  const apps = [driveCard(registered, subscription.active), ...APPS];

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
          <a className={styles.topLink} href={DOCS_URL} target="_blank" rel="noreferrer">Docs</a>
          <button className={styles.logoutBtn} onClick={logout}>Log out</button>
        </div>
      </header>

      <main className={styles.main}>
        <>
          <section className={styles.welcome}>
            <span className={styles.eyebrow}>Home</span>
            <h1 className={styles.h1}>Welcome, {name}.</h1>
            <p className={styles.sub}>{nextStep(loading, registered, subscription)}</p>
          </section>

          {/* Wallet, publisher, storage in the order the contracts enforce: fund,
              register, then subscribe. All three stay on screen in every state so
              the panel never changes shape as registration lands. */}
          <section className={styles.section}>
            <h2 className={styles.h2}>Account</h2>
            <div className={styles.accountPanel}>
              {wallet && (
                <WalletColumn
                  wallet={wallet}
                  balances={balances}
                  onFund={addFunds}
                  funding={funding}
                  refreshBalances={refreshBalances}
                />
              )}
              <PublisherColumn
                wallet={wallet}
                registered={registered}
                details={details}
                loading={loading}
                registering={registering}
                register={register}
              />
              <StorageColumn registered={registered} subscription={subscription} />
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Apps</h2>
            <div className={styles.grid}>
              {apps.map((app) => <GetStartedCard key={app.title} {...app} />)}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Built on Fangorn</h2>
            <div className={styles.grid}>
              {EXAMPLES.map((example) => (
                <GetStartedCard key={example.title} action="Open" {...example} />
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Build with the SDK</h2>
            <div className={styles.sdkStrip}>
              <div className={styles.installLine}>
                <span className={styles.fieldValueMono}>{INSTALL_CMD}</span>
                <CopyButton text={INSTALL_CMD} className={styles.ghostBtnSm} />
              </div>
              <div className={styles.sdkLinks}>
                <a className={styles.resLink} href={DOCS_URL} target="_blank" rel="noreferrer">
                  Documentation <span className={styles.resArrow}>→</span>
                </a>
                <a className={styles.resLink} href="https://github.com/fangorn-network/fangorn" target="_blank" rel="noreferrer">
                  Source on GitHub <span className={styles.resArrow}>→</span>
                </a>
                <a className={styles.resLink} href="https://discord.gg/JDj8RdCVyU" target="_blank" rel="noreferrer">
                  Discord <span className={styles.resArrow}>→</span>
                </a>
              </div>
            </div>
          </section>
        </>
      </main>
    </div>
  );
}
