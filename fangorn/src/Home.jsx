import { useEffect, useRef, useState } from 'react';
import { formatEther, formatUnits, parseEther, parseUnits } from 'viem';
import styles from './Home.module.css';
import { useAuth } from './authContext';
import { useBalances } from './fangorn';
import { useUsage } from './usage';
import { truncate, explorer, formatBytes, meterState } from './format';
import { useOwnedApps, readAppOwner, isCardUrl } from './account';

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

      <FaucetLinks onRefresh={refreshBalances} />

    </Column>
  );
}

// Usage as the storage worker meters it: the lifetime free tier and the daily upload
// cap. The subscription that pays for storage is per app now, so it lives on each
// app's card, not here.
function StorageColumn() {
  const { usage, loading } = useUsage();

  return (
    <Column
      title="Storage"
      state={loading ? 'statePending' : usage ? 'stateGood' : 'stateWarn'}
      stateLabel={loading ? 'Loading' : usage ? 'Metered' : 'Unavailable'}
    >
      {loading && <div className={styles.pending}>Loading your usage…</div>}
      {!loading && !usage && <div className={styles.pending}>Usage is unavailable right now.</div>}
      {!loading && usage && (
        <>
          <Meter label="Total stored" used={usage.total} limit={usage.freeLimit} />
          <Meter label="Uploaded today" used={usage.daily} limit={usage.dailyLimit} />
        </>
      )}
    </Column>
  );
}

// The one thing to do next, in the order the contracts enforce.
function nextStep(apps) {
  if (apps === null) return 'Checking where you left off…';
  if (!apps.length) return 'Start by creating your first app below.';
  return "You're set up. Configure the CLI below and ask Claude to build your app.";
}

// ── The hub ─────────────────────────────────────────────────────────────────

const SDK_INSTALL = 'npm i -g @fangorn-network/sdk';
const MCP_CMD = `claude mcp add fangorn -e FANGORN_NETWORK=baseSepolia -- \\
  npx -y -p @fangorn-network/westmarch -p @huggingface/transformers fangorn-mcp`;
// Slash commands, typed inside Claude Code rather than the terminal. The plugin
// carries the skill that builds the app (fangorn-app).
const PLUGIN_CMD = `/plugin marketplace add fangorn-network/westmarch
/plugin install fangorn-index@fangorn-index`;
const BUILD_PROMPT = 'Build a Fangorn app from <your data>.';

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

// The CLI signs as this same wallet: the key exported above goes into
// `fangorn init`, so the apps claimed and paid for here are the ones Claude
// publishes to from the terminal.
function CliSetup({ wallet, exportKey, appName }) {
  return (
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
      </li>
      <li>
        <div className={styles.cardTitle}>Point it at your app</div>
        <Cmd text={`fangorn set-app ${appName ?? '<your-app>'}`} />
      </li>
      <li>
        <div className={styles.cardTitle}>Check it's the same wallet</div>
        <Cmd text="fangorn wallet" />
        {wallet && (
          <p className={styles.colText}>
            The address should be <span className={styles.fieldValueMono}>{wallet}</span>.
          </p>
        )}
      </li>
      <li>
        <div className={styles.cardTitle}>Install the Fangorn tools in Claude Code</div>
        <Cmd text={MCP_CMD} />
        <p className={styles.colText}>Then, inside Claude Code, add the skills:</p>
        <Cmd text={PLUGIN_CMD} />
      </li>
      <li>
        <div className={styles.cardTitle}>Ask Claude to build it</div>
        <Cmd text={BUILD_PROMPT} />
        <p className={styles.colText}>
          You'll need a free Cloudflare account for the site. Your app shows up on this page
          once it publishes.
        </p>
      </li>
    </ol>
  );
}

const formatDate = (secs) => new Date(Number(secs) * 1000).toLocaleDateString();

// One owned app: what it is, whether its subscription is live, and the two things an
// owner does from here — renew, and bind the agent card the explorer lists it by.
// Accepting other publishers stays in the CLI (`fangorn app accept`).
function AppCard({ app, onRenew, onSetCard }) {
  const [busy, setBusy] = useState(null);
  const [cardUrl, setCardUrl] = useState(app.uri);
  const [error, setError] = useState(null);

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
    <div className={styles.card}>
      <div className={styles.cardTitle}>
        {app.name ?? truncate(app.appId, 10, 6)}
        {app.suspended && <span className={styles.badgeWarn}>Suspended</span>}
        {app.expired && <span className={styles.badgeWarn}>Expired</span>}
      </div>
      <div className={styles.inlineValue}>
        <span className={styles.fieldValueMono}>{truncate(app.appId, 10, 6)}</span>
        <CopyButton text={app.appId} className={styles.ghostBtnSm} />
      </div>
      <div className={styles.stats}>
        <Field label={app.expired ? 'Expired' : 'Paid until'}>
          <div className={styles.fieldValue}>{app.expiresAt ? formatDate(app.expiresAt) : 'Cancelled'}</div>
        </Field>
        <Field label="Price">
          <div className={styles.fieldValue}>{app.price != null ? `${formatUnits(app.price, 6)} USDC / record` : 'Free'}</div>
        </Field>
      </div>
      {app.renewable && (
        <button className={styles.ghostBtn} type="button" disabled={!!busy} onClick={() => run('renew', () => onRenew(app.appId))}>
          {busy === 'renew' ? 'Renewing…' : 'Renew subscription'}
        </button>
      )}
      <details className={styles.more}>
        <summary>{app.uri ? 'Agent card' : 'Bind an agent card'}</summary>
        <input
          className={styles.input}
          value={cardUrl}
          onChange={(event) => setCardUrl(event.target.value)}
          placeholder="https://…/.well-known/agent-card.json"
          aria-label="Agent card URL"
        />
        <div className={styles.btnRow}>
          <button
            className={styles.ghostBtn}
            type="button"
            disabled={!!busy || !isCardUrl(cardUrl) || cardUrl === app.uri}
            onClick={() => run('card', () => onSetCard(app.appId, cardUrl))}
          >
            {busy === 'card' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </details>
      {error && <div className={styles.formError}>{error}</div>}
      <div className={styles.cardLinks}>
        {app.site && <a className={styles.resLink} href={app.site} target="_blank" rel="noreferrer">Site ↗</a>}
        {app.listed && <a className={styles.resLink} href="#/explorer">Explorer</a>}
      </div>
    </div>
  );
}

// The (+) card. Opens the create modal; the grid keeps it last so owned apps lead.
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

export default function Home() {
  const { user, fundWallet, exportKey } = useAuth();
  const { balances, refresh: refreshBalances } = useBalances();
  const [funding, setFunding] = useState(false);
  const [creating, setCreating] = useState(false);

  const { name } = readIdentity(user);
  const wallet = user?.wallet?.address;
  const { apps, received, error: appsError, fee, period, create, renew, setCard } = useOwnedApps(wallet);

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

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.welcome}>
          <span className={styles.eyebrow}>Account</span>
          <h1 className={styles.h1}>Welcome, {name}.</h1>
          <p className={styles.sub}>{nextStep(apps)}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Your apps</h2>
          {appsError && <div className={styles.formError}>{appsError}</div>}
          {apps === null && <div className={styles.pending}>Reading your apps from the chain…</div>}
          {apps?.length > 0 && received != null && (
            <p className={styles.colText}>
              Earned across your apps: <b>{formatUnits(received, 6)} USDC</b>
            </p>
          )}
          {apps !== null && (
            <div className={styles.grid}>
              {apps.map((app) => <AppCard key={app.appId} app={app} onRenew={renew} onSetCard={setCard} />)}
              <NewAppCard onClick={() => setCreating(true)} />
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

        <section className={styles.section}>
          <h2 className={styles.h2}>1. Your account</h2>
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
            <StorageColumn />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>2. Set up Claude Code</h2>
          <CliSetup wallet={wallet} exportKey={exportKey} appName={apps?.find((a) => a.name)?.name} />
        </section>
      </main>
    </div>
  );
}
