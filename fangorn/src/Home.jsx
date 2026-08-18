import { useEffect, useRef, useState } from 'react';
import { formatEther, formatUnits, parseEther } from 'viem';
import { toAppId } from '@fangorn-network/sdk/lib/config.js';
import styles from './Home.module.css';
import { useAuth } from './authContext';
import {
  usePublisher, useBalances, useFaucet, readAppOwner, registerApp,
  APP_ID, FAUCET_ETH, FAUCET_USDC, ZERO_ADDRESS,
} from './fangorn';
import { useSubscription, SUBSCRIPTION_WINDOW_DAYS } from './subscription';
import { useUsage } from './usage';
import { useQuickbeam } from './quickbeam';
import { useDirectory, appLabel } from './directory';
import { truncate, explorer, formatBytes, meterState } from './format';

const INSTALL_CMD = 'npm i @fangorn-network/sdk';
const DOCS_URL = 'https://deepwiki.com/fangorn-network/fangorn';

// Enough ETH to cover the registration fee and its gas. Below this the wallet is
// "Low" and the faucet is the thing to do next.
const LOW_ETH = parseEther('0.005');


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
  if (/insufficient funds/i.test(text)) return 'Not enough ETH for gas. Add funds and try again.';
  if (/AlreadyRegistered/i.test(text)) return 'This wallet is already registered.';
  if (/NotRegistered/i.test(text)) return 'Register before subscribing.';
  if (/cooldown/i.test(text)) return 'Already claimed. Try again tomorrow.';
  if (/max fee per gas less than block base fee/i.test(text)) {
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

// Handing a user their embedded wallet's private key is irreversible and the one
// action here that can lose them everything, so it is deliberately two clicks with
// the consequences spelled out in between — not a one-tap button beside "Copy".
// Privy renders the key itself in a cross-domain iframe; this app never sees it.
function ExportKeyField({ exportKey }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

  async function onExport() {
    setError(null);
    try {
      await exportKey();
      setConfirming(false);
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  return (
    <Field label="Private key">
      {!confirming ? (
        <>
          <div className={styles.fieldValue}>
            Export your key for usage with Fangorn's SDK or another <b>TRUSTED</b> client. <b>NEVER</b> export this key under someone else's request.
          </div>
          <button className={styles.ghostBtn} onClick={() => setConfirming(true)} type="button">
            Export private key
          </button>
        </>
      ) : (
        <div className={styles.warnBox} role="alert">
          <div className={styles.warnTitle}>⚠ Anyone with this key owns this wallet</div>
          <ul className={styles.warnList}>
            <li>It <b>cannot be revoked or rotated</b> - exporting it is <b>permanent</b>.</li>
            <li>Whoever sees it can <b>drain the funds</b> and <b>publish as you, forever</b>.</li>
            <li><b>Never</b> paste it into a website, a chat, a support ticket, or email.</li>
            <li>Fangorn staff will <b>never</b> ask for it. <b>Anyone</b> who does is <b>stealing</b> from <b>you</b>.</li>
            <li>Make sure <b>nobody</b> can see your screen and you are not sharing it.</li>
          </ul>
          {error && <div className={styles.formError}>{error}</div>}
          <div className={styles.warnActions}>
            <button className={styles.dangerBtn} onClick={onExport} type="button">
              I understand - show my key
            </button>
            <button
              className={styles.ghostBtnSm}
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Field>
  );
}

function WalletColumn({ wallet, balances, onFund, funding, refreshBalances, exportKey }) {
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

      {/* Only an email/social login has an embedded wallet to export. */}
      {exportKey && (
        <>
          <br></br>
          <ExportKeyField exportKey={exportKey} />
        </>
      )}
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

// Quickbeam watches a namespace's on-chain head and embeds every commit as it lands.
// Sits in its own panel rather than as a fourth Account column: at 1080px the account
// grid only fits three, and a fourth would wrap to a lone 3+1 row.
//
// What you create here is a VIEW: a named set of namespaces that gets its own search
// URL and its own MCP catalog. Embeddings are not per requester — asking for a
// namespace somebody else already watches returns the same points and costs no extra
// indexing, so a view is a filter rather than a copy.
//
// A source is (publisher, namespace), not a bare namespace: namespaces are keys inside
// one publisher's off-chain root map, so the same name under two publishers is two
// different graphs. Any namespace on the network can be watched — you don't have to
// own it — so the publisher field is a plain address input.
//
// The registry worker gates on the storage subscription this site already sells, so
// there is no separate Quickbeam purchase — `subscribed` is that same state, passed
// down rather than re-read.
// The Privy wallet OBJECT is read from context here rather than taken as a prop:
// registerApp needs a signer, and Home's own `wallet` local is the address string.
function QuickbeamPanel({ subscribed }) {
  const { wallet, user } = useAuth();
  const address = user?.wallet?.address;
  const [name, setName] = useState('');
  const [hostedMcp, setHostedMcp] = useState(false);
  // The app, as a name or a 32-byte id — the panel's whole subject. It is never
  // inferred and has no default: the app used to fall back to this build's whenever a
  // namespace was typed rather than picked, and a view naming an app its publisher
  // never wrote to indexes nothing, silently, forever (count: 0 and no error anywhere).
  // The watcher refuses to guess an app from its side too (_fetch_sources: an entry
  // naming no app "is DROPPED rather than guessed") — but a WRONG app is not a missing
  // one, so that guard never fires and only this field can prevent it.
  const [app, setApp] = useState('');
  // The owner lookup, tagged with the app id it answers for. Tagged rather than
  // cleared on every keystroke: a result for a stale id must not be shown against the
  // current one, and deriving that here keeps the effect from setting state
  // synchronously (cascading renders).
  const [ownerFor, setOwnerFor] = useState({});
  const [registering, setRegistering] = useState(false);
  // Mounted on first open and left mounted: the directory's name pass costs ~12s of
  // gateway fetches, and reopening should not pay it again.
  const [browsing, setBrowsing] = useState(false);
  const [browsed, setBrowsed] = useState(false);
  const [error, setError] = useState(null);

  const { views, loading, creating, create } = useQuickbeam();
  const appId = app.trim() ? toAppId(app.trim()) : null;
  // An address, ZERO_ADDRESS for unclaimed, or null while the read is in flight.
  const owner = appId && ownerFor.id === appId ? ownerFor.owner : null;
  const unclaimed = owner === ZERO_ADDRESS;
  const mine = Boolean(owner && address && owner.toLowerCase() === address.toLowerCase());
  const ready = name.trim() && appId;

  // Owner lookup, one read per settled app id. Debounced because this runs on every
  // keystroke of a name being typed out, and each id is a different app — there is no
  // useful answer for "sond3r.test" on the way to "sond3r.test.2".
  useEffect(() => {
    if (!appId) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      readAppOwner(appId)
        .then((found) => !cancelled && setOwnerFor({ id: appId, owner: found }))
        .catch((err) => !cancelled && console.warn('App owner lookup failed:', err));
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [appId]);

  async function onRegisterApp() {
    setError(null);
    setRegistering(true);
    try {
      await registerApp(wallet, address, appId);
      setOwnerFor({ id: appId, owner: await readAppOwner(appId) });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setRegistering(false);
    }
  }

  async function onCreate() {
    setError(null);
    try {
      await create({
        name: name.trim(),
        // The whole app: `*` on both sides is the app-level topic filter (watcher.py
        // parse_sources), so every publisher and every namespace under it is watched,
        // including ones that appear after the view is made. Narrowing to one
        // (publisher, namespace) is what the form used to force, and it makes a view
        // that silently misses everything published next.
        sources: [{ app: appId, owner: '*', namespace: '*' }],
        hostedMcp,
      });
      // Empty the form. The view it produced is listed below, so nothing is lost by
      // clearing, and leaving the values sitting there reads as "not submitted yet".
      setName('');
      setHostedMcp(false);
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  return (
    <Column
      title="Register App"
      state={mine || views.length ? 'stateGood' : 'statePending'}
      stateLabel={appId
        ? (owner === null ? 'Checking' : unclaimed ? 'Unclaimed' : mine ? 'Yours' : 'Taken')
        : loading ? 'Checking' : views.length
          ? `${views.length} view${views.length === 1 ? '' : 's'}`
          : 'No views'}
    >
      <p className={styles.colText}>
        An app is the namespace your publishers commit under — claim its id here, then
        create a view over it and get four endpoints: hosted search, a full download of
        the embeddings for searching offline, a live stream telling you when they change,
        and an MCP. A view watches the app at large, so every publisher and every
        namespace in it is indexed, including the ones that appear later. Quickbeam
        follows each on-chain head and embeds every commit as it lands. Any app on the
        network can be watched, not only the ones you own.
      </p>
      <Field label="Included with">
        <div className={styles.fieldValue}>
          Your storage subscription
          <span className={styles.fieldNote}> · no separate charge</span>
        </div>
      </Field>

      {/* A name or a 32-byte id, both accepted (toAppId passes an id through). An id
          is all the chain stores — `registerApp` claims the hash and the preimage is
          gone — so a name typed here can be claimed but never recovered by anyone
          else. Both fields below are about THIS app. */}
      <Field label="App">
        <input
          className={styles.input}
          value={app}
          onChange={(event) => setApp(event.target.value)}
          placeholder={`${appLabel(APP_ID)} · your-app · 0x…`}
          aria-label="App name or id"
        />
        {appId && (
          <div className={`${styles.pending} ${styles.pendingNote}`}>{appId}</div>
        )}
        {appId && owner !== null && (
          <div className={styles.fieldValue}>
            {unclaimed
              ? 'Unclaimed — nobody can commit under it until it is registered.'
              : mine
                ? 'Registered to you.'
                : <>Owned by <span className={styles.fieldValueMono}>{truncate(owner, 10, 8)}</span>. You can still watch it.</>}
          </div>
        )}
        <div className={styles.btnRow}>
          {/* Registration is first come, first served and has no transfer or release,
              so this is offered only when the id is genuinely free. */}
          <button
            className={styles.ghostBtn}
            onClick={onRegisterApp}
            disabled={registering || !unclaimed || !wallet}
            type="button"
            title={wallet ? undefined : 'Connect a wallet first'}
          >
            {registering ? 'Confirming…' : 'Register app'}
          </button>
          <button
            className={styles.ghostBtn}
            onClick={() => { setBrowsed(true); setBrowsing(true); }}
            type="button"
          >
            Browse apps
          </button>
        </div>
      </Field>

      <Field label="View name">
        <input
          className={styles.input}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="my-view"
          aria-label="Name for this view"
        />
        {/* Off by default: running the client yourself keeps the query on your own
            machine, and a hosted MCP is a service we have to run. */}
        <label className={`${styles.checkRow} ${styles.pendingNote}`}>
          <input
            type="checkbox"
            checked={hostedMcp}
            onChange={(event) => setHostedMcp(event.target.checked)}
          />
          <span>Host an MCP server for me, instead of running one locally.</span>
        </label>
        {error && <div className={styles.formError}>{error}</div>}
        {/* An app-level watch has no single namespace to read at subscribe time, so
            each (publisher, namespace) in it is seeded on its FIRST commit after the
            watch starts — and that seed reads the whole namespace, not just the delta.
            A namespace another view already watches is there immediately; one that
            has been quiet since before the view existed needs a publish to appear. */}
        <div className={`${styles.pending} ${styles.pendingNote}`}>
          Watching starts within a minute. Namespaces already being watched are ready
          immediately; a quiet one is indexed in full on its next commit.
        </div>
        <button
          className={styles.ghostBtn}
          onClick={onCreate}
          disabled={creating || loading || !ready || !subscribed}
          type="button"
          // The worker refuses a wallet without an active subscription, so say why
          // rather than letting the request fail.
          title={subscribed ? undefined : 'Subscribe to storage first'}
        >
          {creating ? 'Creating…' : 'Create view'}
        </button>
      </Field>

      {/* Every view this wallet owns, newest first, loaded from the registry on each
          visit — the URLs are worth nothing if they only exist in the session that
          created them. Expandable because a wallet can hold several and only one is
          usually of interest. */}
      {!!views.length && (
        <Field label={`Your views (${views.length})`}>
          <div className={styles.pubList}>
            {views.map((view, i) => (
              <details key={view.id} className={styles.pub} open={i === 0}>
                <summary className={styles.pubHead}>
                  <span className={styles.fieldValueMono}>{view.name}</span>
                  <span className={styles.pubCount}>
                    {view.sources.length} namespace{view.sources.length === 1 ? '' : 's'}
                  </span>
                  <span className={styles.fieldNote}>
                    {view.mcp?.url ? 'hosted MCP' : ''}
                  </span>
                </summary>
                <div className={styles.pubBody}>
                  <ViewEndpoints view={view} />
                </div>
              </details>
            ))}
          </div>
        </Field>
      )}

      <Modal open={browsing} onClose={() => setBrowsing(false)} title="Publishers">
        {browsed && (
          <PublisherDirectory
            onPick={(pickedApp) => { setApp(pickedApp); setBrowsing(false); }}
          />
        )}
      </Modal>
    </Column>
  );
}

// A view's search URL and the command that points an MCP client at it. The MCP is the
// user's own `quickbeam mcp` process — the worker only serves it a catalog filtered to
// this view's namespaces, so nothing is provisioned per requester.
// One endpoint: what it is for, then the URL. The hint matters more than it looks —
// four monospace URLs with only "Search"/"Download"/"Stream"/"MCP" over them tells a
// user nothing about which one they want.
function EndpointRow({ label, hint, value, copy }) {
  return (
    <Field label={label}>
      <div className={styles.pending}>{hint}</div>
      <div className={styles.inlineValue}>
        <span className={styles.fieldValueMono}>{value}</span>
        <CopyButton text={copy ?? value} className={styles.ghostBtnSm} />
      </div>
    </Field>
  );
}

// Everything a view hands you. The three HTTP endpoints are all scoped to this view by
// the registry worker; the MCP is either one we host or a command you run.
function ViewEndpoints({ view }) {
  // The worker returns these; derive them only for rows written before it did.
  const exportUrl = view.exportUrl ?? view.searchUrl.replace(/\/search$/, '/export');
  const streamUrl = view.streamUrl ?? view.searchUrl.replace(/\/search$/, '/stream');

  return (
    <>
      <EndpointRow
        label="Search"
        hint="Semantic search, hosted. Append your query."
        value={`${view.searchUrl}?q=`}
      />
      <EndpointRow
        label="Download"
        hint="Every embedding as NDJSON — load it and search with no network."
        value={exportUrl}
      />
      <EndpointRow
        label="Stream"
        hint="Server-sent events telling you when this view changed, so you re-download only then."
        value={streamUrl}
      />

      {/* Three states: a hosted MCP is a URL to paste into an agent, an unhosted one is
          a command to run, and a freshly-requested one is still starting. */}
      {view.mcp?.url ? (
        <EndpointRow
          label="MCP"
          hint="Hosted for you. Paste into an agent that speaks MCP."
          value={`${view.mcp.url}/mcp`}
        />
      ) : view.hostedMcp ? (
        <Field label="MCP">
          <div className={styles.pending}>
            Hosted MCP is starting up — refresh in a moment.
          </div>
        </Field>
      ) : (
        <EndpointRow
          label="MCP"
          hint="Run this yourself and the query never leaves your machine."
          value={view.mcpCommand}
        />
      )}
    </>
  );
}

// Who has published to this app, and what they called their namespaces.
//
// Two passes with very different costs (see directory.js): the chain pass is one
// getLogs and gives every publisher instantly; namespaces arrive after, because the
// event carries only keccak(name) and recovering the name costs a gateway fetch each.
// So rows render immediately and fill in — a namespace that never resolves keeps its
// hash, which usually means an orphaned head rather than a bug.
//
// Clicking a namespace fills the Quickbeam form: browsing and then watching something
// is the actual path through this page.
function PublisherDirectory({ onPick }) {
  const { publishers, loading, resolving, error } = useDirectory();
  const [query, setQuery] = useState('');

  // Match on the address, any namespace name, or the app (name or id) — "robin" finds
  // the publisher who owns `robinhood` even though the address says nothing, and an app
  // name finds everyone publishing under it.
  const q = query.trim().toLowerCase();
  const matches = q
    ? publishers.filter((p) =>
        p.owner.toLowerCase().includes(q)
        || p.namespaces.some((ns) => (ns.name ?? '').toLowerCase().includes(q))
        || p.apps.some((app) => app.label.toLowerCase().includes(q)
          || app.appId.toLowerCase().includes(q)))
    : publishers;

  return (
    <>
      <p className={styles.colText}>
        Everyone who has committed to the network, newest first. Open a publisher and
        pick a namespace to load it into the form — you don't have to own it to watch it.
        Namespaces are grouped by the app they were published under: the same name in two
        apps is two different graphs.
        {loading && ' Loading…'}
        {resolving && ' Resolving namespace names…'}
      </p>

      <input
        className={styles.input}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter by address, namespace or app"
        aria-label="Filter publishers"
      />

      {error && <div className={styles.formError}>{error}</div>}
      {!loading && !error && !publishers.length && (
        <div className={styles.pending}>Nothing published yet.</div>
      )}
      {!loading && !!publishers.length && !matches.length && (
        <div className={styles.pending}>No publisher or namespace matches “{query}”.</div>
      )}

      <div className={styles.pubList}>
        {matches.map((p) => (
          <details
            key={p.owner}
            className={styles.pub}
            // Searching expands the hits, so a match is never hidden one click away.
            open={q ? true : undefined}
          >
            <summary className={styles.pubHead}>
              <span className={styles.fieldValueMono}>{truncate(p.owner, 10, 8)}</span>
              <span className={styles.pubCount}>
                {p.namespaces.length} namespace{p.namespaces.length === 1 ? '' : 's'}
                {p.apps.length > 1 && ` in ${p.apps.length} apps`}
              </span>
              <span className={styles.fieldNote}>block {p.lastBlock.toString()}</span>
            </summary>

            <div className={styles.pubBody}>
              <a
                className={styles.resLink}
                href={explorer(p.owner)}
                target="_blank"
                rel="noreferrer"
              >
                View on explorer <span className={styles.resArrow}>→</span>
              </a>
              {/* One block per app, and the APP is what gets picked — a view watches
                  an app at large, so the namespaces below are shown to say what is in
                  it, not to be selected one at a time. The heading carries the full id
                  in its title so it can also be copied into `fangorn --app` /
                  `quickbeam watch --app`. */}
              {p.apps.map((app) => (
                <div key={app.appId}>
                  <button
                    className={styles.appHead}
                    type="button"
                    title={`Watch ${app.label} — ${app.appId}`}
                    onClick={() => onPick(app.appId)}
                  >
                    <span className={styles.appName}>{app.label}</span>
                    <span>
                      {app.namespaces.length} namespace{app.namespaces.length === 1 ? '' : 's'}
                    </span>
                  </button>
                  {/* Names, not buttons: an unresolved head shows its subspace hash and
                      neither one is selectable any more — picking the app takes them all. */}
                  <div className={styles.chipRow}>
                    {app.namespaces.map((ns) => (
                      <span key={ns.key} className={styles.chip}>
                        {ns.name ?? `${ns.subspaceId.slice(0, 10)}…`}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </>
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
  const { user, logout, fundWallet, exportKey } = useAuth();
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
                  exportKey={exportKey}
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
            <h2 className={styles.h2}>Embeddings</h2>
            <div className={styles.accountPanel}>
              <QuickbeamPanel subscribed={subscription.active} />
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
