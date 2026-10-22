import { useEffect, useRef, useState } from 'react';
import { formatEther, formatUnits, parseEther, parseUnits } from 'viem';
import styles from './Home.module.css';
import { useAuth } from './authContext';
import { useBalances } from './fangorn';
import { truncate, explorer, formatBytes } from './format';
import { useOwnedApps, useActivity, readAppOwner, isCardUrl, cardUrlOf, ACTIVITY_WEEKS } from './account';

const INSTALL_CMD = 'npm i @fangorn-network/sdk';
const DOCS_URL = 'https://deepwiki.com/fangorn-network/fangorn';

// Enough ETH for a few app writes' gas. Below this the wallet is "Low" and a
// testnet faucet is the thing to do next.
const LOW_ETH = parseEther('0.002');

// Public Base Sepolia faucets. We don't run one: it was drainable infra to maintain,
// and these cover the only thing a new owner needs — gas (and USDC if the app fee
// ever goes above zero).
const FAUCETS = [
  { label: 'ETH (Coinbase)', url: 'https://portal.cdp.coinbase.com/products/faucet' },
  { label: 'USDC (Circle)', url: 'https://faucet.circle.com' },
];


// viem attaches .shortMessage to contract/RPC errors; fall back to .message.
//
// Match on both: a decoded custom error lands in .message ("Error: NotRegistered()")
// while .shortMessage says only "The contract function ... reverted." — so matching
// shortMessage alone never fires the revert-name branches below. Display still uses
// the short one.
function friendlyError(err) {
  const msg = err?.shortMessage || err?.message || String(err);
  const text = `${msg}\n${err?.message ?? ''}`;
  if (/rejected|denied/i.test(text)) return 'Transaction cancelled.';
  if (/insufficient funds/i.test(text)) return 'Not enough Base Sepolia ETH for gas. Grab some from a faucet and try again.';
  if (/AppAlreadyRegistered|AlreadyClaimed/i.test(text)) return 'That name is taken. Pick another.';
  if (/cannot be renewed until/i.test(text)) return 'Renewal opens when less than one period is left.';
  if (/max fee per gas less than block base fee/i.test(text)) {
    return 'Network fees moved while confirming. Try again.';
  }
  return msg;
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
// (an error, a balance) away from pushing its own action out of the panel.

function Field({ label, children }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

// A modal built on the native <dialog>. showModal() supplies the focus trap, Esc to
// close, inertness of the page behind, and top-layer stacking — all the parts of a
// modal that are easy to get subtly wrong by hand.
// ponytail: no library. `close` fires for Esc too, so state syncs back through onClose.
function Modal({ open, onClose, title, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.modal}
      onClose={onClose}
      // A click landing on the dialog element itself is a backdrop click — the
      // content sits in children, so anything inside targets those instead.
      onClick={(event) => event.target === ref.current && onClose()}
      aria-label={title}
    >
      <div className={styles.modalHead}>
        <span className={styles.colTitle}>{title}</span>
        <button className={styles.ghostBtnSm} onClick={onClose} type="button">Close</button>
      </div>
      <div className={styles.modalBody}>{children}</div>
    </dialog>
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

// A shimmering stand-in for a value still on its way from the chain.
function Skeleton({ width }) {
  return <span className={styles.skeleton} style={{ width }} aria-hidden="true" />;
}

// ── Columns ─────────────────────────────────────────────────────────────────

// Links out to the public faucets. Opening in a new tab keeps the hub where it was;
// Refresh re-reads the balance once the drip lands.
function FaucetLinks({ onRefresh }) {
  return (
    <Field label="Testnet funds">
      <div className={styles.cardLinks}>
        {FAUCETS.map((f) => (
          <a key={f.url} className={styles.resLink} href={f.url} target="_blank" rel="noreferrer">
            {f.label} <span className={styles.resArrow}>↗</span>
          </a>
        ))}
      </div>
      {onRefresh && (
        <button className={styles.ghostBtn} onClick={onRefresh} type="button">Refresh balance</button>
      )}
    </Field>
  );
}

const usdc = (units) => `${Number(formatUnits(units, 6)).toFixed(2)} USDC`;

// The top of the hub: who you are on chain, what you hold, what your apps have made.
function Summary({ wallet, balances, earnings, onFund, funding, refreshBalances }) {
  // Don't call it low until the balances actually land — an orange dot on a
  // still-loading wallet reads as a problem that isn't there.
  const low = balances && balances.eth < LOW_ETH;

  return (
    <div className={styles.accountPanel}>
      <Column title="Wallet" state="stateGood" stateLabel="Base Sepolia">
        <Field label="Address">
          <div className={styles.inlineValue}>
            <span className={styles.fieldValueMono}>{truncate(wallet, 8, 6)}</span>
            <CopyButton text={wallet} className={styles.ghostBtnSm} />
          </div>
          <a className={styles.resLink} href={explorer(wallet)} target="_blank" rel="noreferrer">
            View on Basescan <span className={styles.resArrow}>↗</span>
          </a>
        </Field>
      </Column>

      <Column
        title="Balance"
        state={!balances ? 'statePending' : low ? 'stateWarn' : 'stateGood'}
        stateLabel={!balances ? 'Loading' : low ? 'Low on gas' : 'Funded'}
      >
        <div className={styles.bigValue}>{balances ? usdc(balances.usdc) : <Skeleton width="8em" />}</div>
        <div className={styles.fieldValue}>
          {balances ? `${Number(formatEther(balances.eth)).toFixed(4)} ETH` : <Skeleton width="6em" />}
        </div>
        <div className={styles.btnRow}>
          <button className={styles.ghostBtn} onClick={onFund} disabled={funding} type="button">
            {funding ? 'Funding…' : 'Add funds'}
          </button>
        </div>
        <details className={styles.more} open={low || undefined}>
          <summary>Testnet faucets</summary>
          <FaucetLinks onRefresh={refreshBalances} />
        </details>
      </Column>

      <Column
        title="Earned"
        state={earnings?.error ? 'stateWarn' : earnings ? 'stateGood' : 'statePending'}
        stateLabel={earnings?.error ? 'Unavailable' : earnings ? 'All time' : 'Loading'}
      >
        <div className={styles.bigValue}>{earnings?.error ? '—' : earnings ? usdc(earnings.total) : <Skeleton width="8em" />}</div>
        {earnings && !earnings.error && (
          <>
            <div className={styles.fieldValue}>
              {usdc(earnings.total - earnings.sales)} <span className={styles.fieldNote}>from memberships</span>
            </div>
            <div className={styles.fieldValue}>
              {usdc(earnings.sales)} <span className={styles.fieldNote}>from record sales</span>
            </div>
          </>
        )}
      </Column>
    </div>
  );
}

// The one thing to do next, in the order the contracts enforce.
function nextStep(apps) {
  if (apps === null) return 'Checking where you left off…';
  if (!apps.length) return 'Start by creating your first app below.';
  return "You're set up. Getting started, below, has the CLI steps.";
}

// ── The hub ─────────────────────────────────────────────────────────────────

const SDK_INSTALL = 'npm i -g @fangorn-network/sdk';
// Slash commands, typed inside Claude Code rather than the terminal. The builder
// plugin carries the owner's skills: fangorn-app (build) and fangorn-improve.
const PLUGIN_CMD = `/plugin marketplace add fangorn-network/westmarch
/plugin install fangorn-builder@fangorn`;
const BUILD_PROMPT = 'Build a Fangorn app from <your data>.';
// Cloudflare's deploy button: it copies westmarch's template into the owner's GitHub, makes
// the bucket and deploys the Worker, which builds itself with `westmarch build`.
const DEPLOY_URL = 'https://deploy.workers.cloudflare.com/?url=https://github.com/fangorn-network/westmarch/tree/main/template';
const PUBLISH_CMD = (app) => `fangorn set-app ${app}
fangorn repo init items
fangorn commit items.json -m "first items"
fangorn push`;

// A command with a copy button. Wraps instead of scrolling: a command you can't
// see the end of gets pasted wrong.
function Cmd({ text }) {
  return (
    <div className={styles.cmd}>
      <pre>{text}</pre>
      <CopyButton text={text} className={styles.ghostBtnSm} />
    </div>
  );
}

// The key is copied from Privy's export dialog, not from this page: Privy rebuilds
// it inside its own iframe on its own origin, and the SDK gives us no way to read
// it (by design — nothing on fangorn.network can leak what it never holds).
// `exportKey` is null for an external wallet (MetaMask etc.), which holds its own.
function CopyKey({ exportKey }) {
  const [error, setError] = useState(null);
  if (!exportKey) {
    return (
      <p className={styles.colText}>
        You signed in with your own wallet: export the key from it (in MetaMask, Account
        details › Show private key).
      </p>
    );
  }
  return (
    <>
      <button
        className={styles.primaryBtn}
        type="button"
        onClick={() => { setError(null); exportKey().catch((err) => setError(friendlyError(err))); }}
      >
        Copy my private key
      </button>
      {error && <div className={styles.formError}>{error}</div>}
    </>
  );
}

// Two ways in, one wallet either way: the CLI signs as it (the key exported above goes
// into `fangorn init`), so the apps claimed here are the ones published to.
function GettingStarted({ wallet, exportKey, appName }) {
  const [path, setPath] = useState('claude');
  const app = appName ?? '<your-app>';
  return (
    <>
      <div className={styles.btnRow} role="tablist">
        {[['claude', 'With Claude Code'], ['manual', 'Deploy to Cloudflare']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={path === id}
            className={`${styles.ghostBtn} ${path === id ? styles.tabActive : ''}`}
            onClick={() => setPath(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <ol className={styles.onboard}>
        <li>
          <div className={styles.cardTitle}>Install the Fangorn CLI</div>
          <Cmd text={SDK_INSTALL} />
        </li>
        <li>
          <div className={styles.cardTitle}>Configure it with your key</div>
          <Cmd text="fangorn init" />
          <p className={styles.colText}>
            Pick <b>Base Sepolia</b> as the chain, then paste your private key. Press Enter
            to accept the defaults for the rest.
          </p>
          <CopyKey exportKey={exportKey} />
          <p className={styles.colText}>
            Anyone with this key controls your wallet. Paste it only into your own terminal,
            never into a chat (including with Claude), a website or an email.
          </p>
          <details className={styles.more}>
            <summary>Verify app ownership</summary>
            <Cmd text={'fangorn set-app <your-app>\nfangorn wallet'} />
            <p className={styles.colText}>
              {wallet
                ? <>The address should be <span className={styles.fieldValueMono}>{wallet}</span>, the owner of the app you set.</>
                : <>The address should be the wallet that claimed the app you set.</>}
            </p>
          </details>
        </li>
        {path === 'claude' ? (
          <>
            <li>
              <div className={styles.cardTitle}>Add the builder skills to Claude Code</div>
              <Cmd text={PLUGIN_CMD} />
              <p className={styles.colText}>
                Run these inside Claude Code. <b>fangorn-app</b> builds and registers your app;{' '}
                <b>fangorn-improve</b> keeps it getting better, one pull request at a time.
              </p>
            </li>
            <li>
              <div className={styles.cardTitle}>Ask Claude to build it</div>
              <Cmd text={BUILD_PROMPT} />
              <p className={styles.colText}>
                You'll need a free Cloudflare account for the site. Your app shows up on this page
                once it publishes.
              </p>
            </li>
          </>
        ) : (
          <>
            <li>
              <div className={styles.cardTitle}>Deploy it to Cloudflare</div>
              <p className={styles.colText}>
                Open your app above and press <b>Deploy to Cloudflare</b>. Cloudflare copies the
                app's template into your GitHub, makes its storage and deploys it as a Worker on
                your free plan; every push to the repo deploys again. The repo holds the recipe,
                never the data, so it can be public.
              </p>
            </li>
            <li>
              <div className={styles.cardTitle}>Register its agent</div>
              <p className={styles.colText}>
                Paste the Worker's URL into the app's page and press <b>Register</b>. Your wallet mints
                the app's ERC-8004 agent and binds its card, and the app shows in the explorer.
              </p>
            </li>
            <li>
              <div className={styles.cardTitle}>Publish records</div>
              <Cmd text={PUBLISH_CMD(app)} />
              <p className={styles.colText}>
                The site indexes them within 5 minutes. The repo's README shows the record format.
              </p>
            </li>
          </>
        )}
      </ol>
    </>
  );
}

const formatDate = (secs) => new Date(Number(secs) * 1000).toLocaleDateString();

// An app whose subscription runs out within this many days is flagged in its row.
const EXPIRING_DAYS = 7;

// The one word the closed row leads with. Anything that stops the app working wins,
// so it shows without opening the row.
// A field whose read failed is null, and says so rather than guessing.
function appStatus(app) {
  if (app.suspended) return { warn: true, label: 'Taken down' };
  if (app.expired) return { warn: true, label: app.expiresAt ? 'Expired' : 'Cancelled' };
  if (app.uri === '') return { warn: true, label: 'Not deployed' };
  if (app.uri == null || app.expiresAt == null) return { warn: false, label: 'Status unknown' };
  if (Number(app.expiresAt) * 1000 - Date.now() < EXPIRING_DAYS * 86400_000) return { warn: true, label: 'Expiring soon' };
  return { warn: false, label: 'Live' };
}

// When the subscription runs to, for display: 0 is a cancelled one, null an unread one.
const paidUntil = (app) => (app.expiresAt == null ? '—' : app.expiresAt ? formatDate(app.expiresAt) : 'Cancelled');

// Free to read: no record price and no pass on its card, so nothing to earn or show.
const isPaid = (app) => app.price != null || app.pass != null;

// What a reader pays, in one phrase: per record, or for a pass.
const priceLabel = (app) =>
  app.price != null ? `${formatUnits(app.price, 6)} USDC / record`
    : app.pass ? `${formatUnits(app.pass.price, 6)} USDC pass` : 'Free';

// An app's address in the hub: its name when this browser knows it, else its id.
const appHref = (app) => `#/account/app/${encodeURIComponent(app.name ?? app.appId)}`;
const findApp = (apps, key) => {
  const k = decodeURIComponent(key).toLowerCase();
  // Card names carry case ("FAR Desk"), so match them the way the key was lowered.
  return apps.find((a) => a.name?.toLowerCase() === k || a.appId.toLowerCase() === k);
};

// One app on the dashboard: enough to see it's healthy, and the way into its page.
function AppLine({ app }) {
  const status = appStatus(app);
  return (
    <a className={styles.rowLink} href={appHref(app)}>
      <span className={styles.rowName}>{app.name ?? truncate(app.appId, 10, 6)}</span>
      <span className={status.warn ? styles.badgeWarn : styles.badge}>{status.label}</span>
      <span className={styles.rowMeta}>
        {app.expiresAt ? `Paid until ${formatDate(app.expiresAt)}` : app.expiresAt === 0n ? 'Cancelled' : ''}
        {app.expiresAt != null && ' · '}{priceLabel(app)}
      </span>
      <svg className={styles.rowGo} viewBox="0 0 24 24" aria-hidden="true"><path d="M10 7l5 5-5 5" /></svg>
    </a>
  );
}

// One owned app's page: everything an owner does with it — renew, see where its
// storage goes and what it charges, deploy, bind the agent card the explorer lists
// it by. Accepting other publishers stays in the CLI (`fangorn app accept`).
function AppPage({ app, earned, onRenew, onSetCard }) {
  const worker = app.name ? app.name.replace(/[._]/g, '-') : '<your-app>';
  const [busy, setBusy] = useState(null);
  const [cardUrl, setCardUrl] = useState(app.uri ?? '');
  const [error, setError] = useState(null);
  const status = appStatus(app);

  async function run(what, fn) {
    setError(null);
    setBusy(what);
    try {
      await fn();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <section className={styles.welcome}>
        <a className={styles.resLink} href="#/account">← All apps</a>
        <h1 className={styles.h1}>
          {app.name ?? truncate(app.appId, 10, 6)}
          <span className={status.warn ? styles.badgeWarn : styles.badge}>{status.label}</span>
        </h1>
        <div className={styles.inlineValue}>
          <span className={styles.fieldValueMono}>{app.appId}</span>
          <CopyButton text={app.appId} className={styles.ghostBtnSm} />
        </div>
        <div className={styles.cardLinks}>
          {app.site && <a className={styles.resLink} href={app.site} target="_blank" rel="noreferrer">Site <span className={styles.resArrow}>↗</span></a>}
          {app.listed && <a className={styles.resLink} href="#/explorer">Explorer</a>}
        </div>
      </section>

      <div className={styles.accountPanel}>
        <Column
          title="Subscription"
          state={app.expiresAt == null ? 'statePending' : app.expired || app.suspended || status.label === 'Expiring soon' ? 'stateWarn' : 'stateGood'}
          stateLabel={app.expiresAt == null ? 'Unread' : app.suspended ? 'Taken down' : app.expired ? 'Expired' : status.label === 'Expiring soon' ? 'Expiring soon' : 'Paid'}
        >
          <Field label={app.expired ? 'Expired' : 'Paid until'}>
            <div className={styles.bigValue}>{paidUntil(app)}</div>
            {app.renewable && (
              <button className={styles.ghostBtn} type="button" disabled={!!busy} onClick={() => run('renew', () => onRenew(app.appId))}>
                {busy === 'renew' ? 'Renewing…' : 'Renew'}
              </button>
            )}
          </Field>
        </Column>

        {/* What the app's card says it charges. Read-only: setting prices is next. */}
        <Column title="Pricing" state="stateGood" stateLabel="From its card">
          <Field label="Per record (x402)">
            <div className={styles.fieldValue}>{app.price != null ? `${formatUnits(app.price, 6)} USDC` : 'Free'}</div>
          </Field>
          {app.pass && (
            <Field label="Access pass">
              <div className={styles.fieldValue}>
                {formatUnits(app.pass.price, 6)} USDC{app.pass.days ? ` for ${app.pass.days} days` : ''}
              </div>
            </Field>
          )}
        </Column>

        {isPaid(app) && (
          <Column title="Earned" state={earned == null ? 'statePending' : 'stateGood'} stateLabel={earned == null ? 'Loading' : 'Memberships'}>
            <div className={styles.bigValue}>{earned == null ? '…' : usdc(earned)}</div>
            {/* A sale's transfer doesn't name its app, so sales are wallet-wide. */}
            <p className={styles.colText}>
              From reader memberships. Record and pass sales are paid straight to your wallet
              without naming the app, so the dashboard counts them for all your apps together.
            </p>
          </Column>
        )}
      </div>

      <Activity app={app} />

      {app.uri != null && <section className={styles.section}>
        <h2 className={styles.h2}>{app.uri ? 'Agent card' : 'Deploy'}</h2>
        {/* Claimed but not deployed (the chain says no card, not "couldn't read"):
            Cloudflare makes the repo and the Worker, then the wallet registers the
            agent from the Worker's card. */}
        {app.uri === '' && (
          <div className={styles.field}>
            <a href={DEPLOY_URL} target="_blank" rel="noreferrer">
              <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare" height="32" />
            </a>
            <p className={styles.colText}>
              Name the Worker <b>{worker}</b> and its R2 bucket <b>{worker}-view</b>.
              {app.name && /[._]/.test(app.name) && <> Then set <b>"app": "{app.name}"</b> in the new repo's app.json.</>}
              {' '}Cloudflare copies the app's template into your GitHub and deploys it on your
              free plan. Then paste the Worker's URL below.
            </p>
          </div>
        )}
        <Field label={app.uri ? 'Agent card URL' : 'Register the agent'}>
          <input
            className={styles.input}
            value={cardUrl}
            onChange={(event) => setCardUrl(event.target.value)}
            placeholder={`https://${worker}.<you>.workers.dev`}
            aria-label="Worker or agent card URL"
          />
          <div className={styles.btnRow}>
            <button
              className={styles.ghostBtn}
              type="button"
              disabled={!!busy || !isCardUrl(cardUrl) || cardUrlOf(cardUrl) === app.uri}
              onClick={() => run('card', () => onSetCard(app.appId, cardUrlOf(cardUrl), { register: !app.uri }))}
            >
              {busy === 'card' ? 'Signing…' : app.uri ? 'Save' : 'Register'}
            </button>
          </div>
          {!app.uri && (
            <p className={styles.colText}>
              Mints the app's ERC-8004 agent from the Worker's card and binds the card to the
              app, from your wallet.
            </p>
          )}
        </Field>
        {error && <div className={styles.formError}>{error}</div>}
      </section>}
    </>
  );
}

// "4 min ago", "3 h ago", "2 days ago": how long since a unix time.
function ago(secs) {
  const min = Math.round((Date.now() / 1000 - secs) / 60);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 48 * 60) return `${Math.round(min / 60)} h ago`;
  return `${Math.round(min / 1440)} days ago`;
}

// The Worker's cron indexes every 5 minutes. An hour without a run means it's failing.
const STALE_SECS = 3600;

// Memberships per week, one bar each, this week on the right. A bar's title names its
// count, and the whole run is read out for screen readers.
function WeekBars({ weeks }) {
  const max = Math.max(...weeks, 1);
  const when = (i) => (i === weeks.length - 1 ? 'this week' : `${weeks.length - 1 - i} weeks ago`);
  return (
    <figure className={styles.barsFig}>
      <div className={styles.bars} role="img" aria-label={`Memberships per week, oldest first: ${weeks.join(', ')}`}>
        {weeks.map((n, i) => (
          <span key={i} className={styles.bar} style={{ height: `${(n / max) * 100}%` }} title={`${n} ${n === 1 ? 'membership' : 'memberships'}, ${when(i)}`} />
        ))}
      </div>
      <figcaption className={styles.barsAxis}><span>{weeks.length} weeks ago</span><span>This week</span></figcaption>
    </figure>
  );
}

// What the app has been doing, from what's public: its catalog (records, collections,
// when it last indexed) and the chain (memberships). Nothing here needs the Worker
// to change, or the owner's Cloudflare account.
function Activity({ app }) {
  const activity = useActivity(app);
  const catalog = activity?.catalog;
  const records = catalog?.collections.reduce((sum, c) => sum + c.count, 0);
  const hosts = new Set(catalog?.collections.flatMap((c) => c.hosts)).size;
  const stale = catalog?.indexedAt && Date.now() / 1000 - catalog.indexedAt > STALE_SECS;
  const members = activity?.memberships;
  const showMembers = isPaid(app) || members?.total > 0;

  const [recordsState, recordsLabel] =
    !app.site ? ['statePending', 'Not deployed']
    : !activity ? ['statePending', 'Loading']
    : !catalog ? ['stateWarn', 'Unreachable']
    : !catalog.indexedAt ? ['stateGood', 'Live']
    : [stale ? 'stateWarn' : 'stateGood', `Indexed ${ago(catalog.indexedAt)}`];

  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>Activity</h2>
      <div className={styles.accountPanel}>
        <Column title="Records" state={recordsState} stateLabel={recordsLabel}>
          {!app.site ? (
            <p className={styles.colText}>Counts show up here once the app's Worker is deployed and bound below.</p>
          ) : !activity ? (
            <><div className={styles.bigValue}><Skeleton width="5em" /></div><div className={styles.fieldValue}><Skeleton width="11em" /></div></>
          ) : !catalog ? (
            <p className={styles.colText}>The catalog at {new URL(app.site).host} didn't load. Check the Worker is running in your Cloudflare dashboard.</p>
          ) : (
            <>
              <div className={styles.bigValue}>{records.toLocaleString()}</div>
              <div className={styles.fieldValue}>
                {catalog.collections.length} {catalog.collections.length === 1 ? 'collection' : 'collections'}
                {hosts > 0 && <span className={styles.fieldNote}>, linking out to {hosts} {hosts === 1 ? 'site' : 'sites'}</span>}
              </div>
              {stale && (
                <p className={`${styles.colText} ${styles.pendingNote}`}>
                  The Worker re-indexes every 5 minutes, so a gap this long usually means its
                  cron is failing. Its logs in Cloudflare will say why.
                </p>
              )}
            </>
          )}
        </Column>

        {(showMembers || !activity) && (
          <Column
            title="Members"
            state={!activity ? 'statePending' : members ? 'stateGood' : 'stateWarn'}
            stateLabel={!activity ? 'Loading' : members ? `Last ${ACTIVITY_WEEKS} weeks` : 'Unavailable'}
          >
            {!activity ? (
              <><div className={styles.bigValue}><Skeleton width="3em" /></div><div className={styles.fieldValue}><Skeleton width="9em" /></div></>
            ) : !members ? (
              <p className={styles.colText}>The membership scan didn't finish. Reload to try again.</p>
            ) : (
              <>
                <div className={styles.bigValue}>{members.total.toLocaleString()}</div>
                <div className={styles.fieldValue}>
                  {members.recent} <span className={styles.fieldNote}>in the last 30 days</span>
                </div>
                {members.total > 0 && <WeekBars weeks={activity.weeks} />}
              </>
            )}
          </Column>
        )}
      </div>

      {catalog?.collections.length > 0 && (
        <div className={`${styles.rows} ${styles.collections}`}>
          {catalog.collections.map((c) => (
            <div key={c.name} className={styles.collection}>
              <div className={styles.collectionHead}>
                <span className={styles.rowName}>{c.name}</span>
                <span className={styles.rowMeta}>{c.count.toLocaleString()} records, {formatBytes(c.bytes)}</span>
              </div>
              {c.description && <p className={styles.collectionDesc}>{c.description}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// The empty state: no apps yet, so creating one is the whole page's next step.
function NewAppCard({ onClick }) {
  return (
    <button className={`${styles.card} ${styles.cardNew}`} type="button" onClick={onClick}>
      <span className={styles.cardPlus} aria-hidden="true">+</span>
      <span className={styles.cardTitle}>Create a new app</span>
      <span className={styles.cardBody}>Claim a name on chain and pay its first month of storage.</span>
    </button>
  );
}

// App names are what `fangorn set-app` takes and what the id hashes, so keep them to
// something a shell and a URL don't need quoting for.
const APP_NAME = /^[a-z0-9][a-z0-9._-]{1,62}$/;

// Configure-and-deploy. "Deploy" is the claim: registerApp pays the first period and
// makes this wallet the owner and first publisher. The card and price are optional
// config sent after it, and both can be set later.
// ponytail: terms & conditions and validation rules have no on-chain home yet — add
// fields here when the AppRegistry grows them.
function CreateAppModal({ open, onClose, fee, period, balances, onCreate }) {
  const [name, setName] = useState('');
  const [cardUrl, setCardUrl] = useState('');
  const [price, setPrice] = useState('');
  // The last availability answer, tagged with the name it answers for.
  const [check, setCheck] = useState({ name: null, taken: null });
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState(null);

  const trimmed = name.trim();
  const validName = APP_NAME.test(trimmed);
  const validCard = !cardUrl.trim() || isCardUrl(cardUrl.trim());
  const validPrice = !price.trim() || /^\d+(\.\d{1,6})?$/.test(price.trim());
  const taken = check.name === trimmed ? check.taken : null;

  // Availability as you type, debounced; a stale answer is dropped.
  useEffect(() => {
    if (!validName) return;
    let cancelled = false;
    const t = setTimeout(() => {
      readAppOwner(trimmed)
        .then((owner) => !cancelled && setCheck({ name: trimmed, taken: Boolean(owner) }))
        .catch(() => {});
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [trimmed, validName]);

  function close() {
    if (deploying) return;
    setName(''); setCardUrl(''); setPrice(''); setError(null);
    onClose();
  }

  async function deploy() {
    setError(null);
    setDeploying(true);
    try {
      await onCreate({
        name: trimmed,
        cardUrl: cardUrl.trim() || null,
        price: price.trim() && Number(price) > 0 ? parseUnits(price.trim(), 6) : null,
      });
      setDeploying(false);
      close();
    } catch (err) {
      setError(friendlyError(err));
      setDeploying(false);
    }
  }

  const days = period ? Number(period / 86400n) : 30;

  return (
    <Modal open={open} onClose={close} title="Create a new app">
      <Field label="App name">
        <input
          className={styles.input}
          value={name}
          onChange={(event) => setName(event.target.value.toLowerCase())}
          placeholder="my-app"
          aria-label="App name"
          autoFocus
        />
        <div className={styles.pending}>
          {!trimmed ? 'Lowercase letters, digits, dot, dash or underscore. This is what `fangorn set-app` takes.'
            : !validName ? '2–63 characters: lowercase letters, digits, dot, dash or underscore.'
              : taken === null ? 'Checking…'
                : taken ? 'Taken. Pick another name.' : 'Available.'}
        </div>
      </Field>

      <Field label="Agent card URL (optional)">
        <input
          className={styles.input}
          value={cardUrl}
          onChange={(event) => setCardUrl(event.target.value)}
          placeholder="https://…/.well-known/agent-card.json"
          aria-label="Agent card URL"
        />
        <div className={styles.pending}>
          How the explorer and agents find your app. `westmarch-ship` sets it for you if you
          leave it blank.
        </div>
      </Field>

      <Field label="Reader price, USDC / month (optional)">
        <input
          className={styles.input}
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="0"
          inputMode="decimal"
          aria-label="Reader membership price in USDC per month"
        />
        <div className={styles.pending}>What a reader pays for a month's membership. Blank is free.</div>
      </Field>

      <Field label="Cost">
        <div className={styles.fieldValue}>
          {fee == null ? '…' : fee === 0n ? 'Free' : `${formatUnits(fee, 6)} USDC`} for {days} days of storage, plus gas
        </div>
      </Field>

      {/* A warning, not a gate: the balance can be a drip behind. */}
      {balances && balances.eth < LOW_ETH && (
        <div className={styles.formError}>
          Your wallet needs a little Base Sepolia ETH for gas.
          <FaucetLinks />
        </div>
      )}
      {error && <div className={styles.formError}>{error}</div>}
      <div className={styles.btnRow}>
        <button
          className={styles.primaryBtn}
          type="button"
          onClick={deploy}
          disabled={deploying || !validName || taken !== false || !validCard || !validPrice}
        >
          {deploying ? 'Deploying…' : 'Deploy'}
        </button>
      </div>
      {deploying && (
        <div className={styles.pending}>
          Claiming {trimmed}{cardUrl.trim() ? ', then binding its card' : ''}{price.trim() ? ', then setting its price' : ''}. Confirm each transaction.
        </div>
      )}
    </Modal>
  );
}

export default function Home({ appKey }) {
  const { user, fundWallet, exportKey } = useAuth();
  const { balances, refresh: refreshBalances } = useBalances();
  const [funding, setFunding] = useState(false);
  const [creating, setCreating] = useState(false);

  const { name } = readIdentity(user);
  const wallet = user?.wallet?.address;
  const { apps, earnings, error: appsError, fee, period, create, renew, setCard } = useOwnedApps(wallet);

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

  async function onCreate(config) {
    await create(config);
    refreshBalances();
  }

  if (appKey) {
    const app = apps && findApp(apps, appKey);
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          {apps === null && <div className={styles.pending}>Reading your apps from the chain…</div>}
          {apps && !app && (
            <section className={styles.welcome}>
              <a className={styles.resLink} href="#/account">← All apps</a>
              <p className={styles.sub}>This wallet doesn't own an app called {decodeURIComponent(appKey)}.</p>
            </section>
          )}
          {app && (
            <AppPage
              key={app.appId}
              app={app}
              earned={earnings && !earnings.error ? (earnings.byApp[app.appId.toLowerCase()] ?? 0n) : null}
              onRenew={renew}
              onSetCard={setCard}
            />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.welcome}>
          <span className={styles.eyebrow}>Account</span>
          <h1 className={styles.h1}>Welcome, {name}.</h1>
          <p className={styles.sub}>{nextStep(apps)}</p>
        </section>

        {wallet && (
          <Summary
            wallet={wallet}
            balances={balances}
            earnings={earnings}
            onFund={addFunds}
            funding={funding}
            refreshBalances={refreshBalances}
          />
        )}

        <section className={styles.section}>
          <div className={styles.rowsHead}>
            <h2 className={styles.h2}>Your apps</h2>
            {apps?.length > 0 && (
              <button className={styles.ghostBtnSm} type="button" onClick={() => setCreating(true)}>+ New app</button>
            )}
          </div>
          {appsError && <div className={styles.formError}>{appsError}</div>}
          {apps === null && (
            <div className={styles.rows} role="status" aria-label="Reading your apps from the chain">
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.rowLink}>
                  <Skeleton width="9em" /><Skeleton width="4em" /><Skeleton width="14em" />
                </div>
              ))}
            </div>
          )}
          {apps?.length === 0 && <NewAppCard onClick={() => setCreating(true)} />}
          {apps?.length > 0 && (
            <div className={styles.rows}>
              {apps.map((app) => <AppLine key={app.appId} app={app} />)}
            </div>
          )}
          <CreateAppModal
            open={creating}
            onClose={() => setCreating(false)}
            fee={fee}
            period={period}
            balances={balances}
            onCreate={onCreate}
          />
        </section>

        {/* Needed once: open until there's an app, one line after. Keyed so it opens
            itself when the apps land empty, without fighting the user's toggle after. */}
        <details key={String(apps?.length === 0)} className={styles.section} open={apps?.length === 0 || undefined}>
          <summary className={styles.h2}>Getting started</summary>
          <GettingStarted wallet={wallet} exportKey={exportKey} appName={apps?.find((a) => a.name)?.name} />
        </details>
      </main>
    </div>
  );
}
