import { useCallback, useEffect, useRef, useState } from 'react';
import { formatEther, formatUnits, parseEther } from 'viem';
import styles from './Home.module.css';
import { useAuth } from './authContext';
import { useBalances } from './fangorn';
import { truncate, explorer, txExplorer, formatBytes } from './format';
import { usePublisher, readFiles, recordId, repoLink, readRepoPage, readBuyers, netPrice, blockTime, EXPLORER_URL } from './account';
import { buy, readLibrary, hasIdentity } from './library';
import { Fields, download } from './RepoPage';

// Enough ETH for a few app writes' gas. Below this the wallet is "Low" and a
// testnet faucet is the thing to do next.
const LOW_ETH = parseEther('0.002');

// Public Base Sepolia faucets. We don't run one: it was drainable infra to maintain,
// and these cover what a new publisher needs: gas to publish.
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
  const mime = text.match(/detected MIME type: ([\w.+-]+\/[\w.+-]+)/);
  if (mime) return `Fangorn's storage doesn't take ${mime[1]} files. Nothing was published.`;
  if (/insufficient funds/i.test(text)) return 'Not enough Base Sepolia ETH for gas. Grab some from a faucet and try again.';
  if (/max fee per gas less than block base fee/i.test(text)) {
    return 'Network fees moved while confirming. Try again.';
  }
  // viem's generic "An unknown RPC error occurred." hides the wallet's own reason in .details.
  return err?.details && !msg.includes(err.details) ? `${msg} (${err.details})` : msg;
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

export function CopyButton({ text, label = 'Copy', className }) {
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

// A modal built on the native <dialog>, opened with show(), not showModal().
// showModal() puts the dialog in the top layer and makes the rest of the page inert —
// which includes Privy's own modal (portalled into <body>), so a wallet confirm
// raised from inside a dialog (embedded wallets, i.e. mobile) rendered beneath it,
// unclickable. A plain z-indexed dialog + scrim lets Privy stack on top.
// ponytail: no focus trap; tab can leave the dialog. Esc and scrim-click close it.
// `side`: a drawer on the right edge instead, for a row's details beside its table.
function Modal({ open, onClose, title, children, side }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.show();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <>
      {open && <div className={styles.scrim} onClick={onClose} />}
      <dialog
        ref={ref}
        className={side ? `${styles.modal} ${styles.drawer}` : styles.modal}
        onKeyDown={(event) => event.key === 'Escape' && onClose()}
        aria-label={title}
        aria-modal="true"
      >
        <div className={styles.modalHead}>
          <span className={styles.colTitle}>{title}</span>
          <button className={styles.ghostBtnSm} onClick={onClose} type="button">Close</button>
        </div>
        <div className={styles.modalBody}>{children}</div>
      </dialog>
    </>
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

const usdc = (units) => `${Number(formatUnits(units, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDC`;
const shortDate = (at) => (at ? new Date(at * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

function WalletColumn({ wallet }) {
  return (
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
  );
}

// What the wallet holds. A buyer pays no gas (Barliman sends the transactions), so only a
// publisher sees ETH and the low-gas warning.
function BalanceColumn({ balances, onFund, funding, refreshBalances, gas }) {
  // Don't call it low until the balances actually land: an orange dot on a
  // still-loading wallet reads as a problem that isn't there.
  const low = gas && balances && balances.eth < LOW_ETH;
  return (
    <Column
      title="Balance"
      state={!balances ? 'statePending' : low ? 'stateWarn' : 'stateGood'}
      stateLabel={!balances ? 'Loading' : low ? 'Low on gas' : gas ? 'Funded' : 'USDC'}
    >
      <div className={styles.bigValue}>{balances ? usdc(balances.usdc) : <Skeleton width="8em" />}</div>
      {gas && (
        <div className={styles.fieldValue}>
          {balances ? `${Number(formatEther(balances.eth)).toFixed(4)} ETH for gas` : <Skeleton width="6em" />}
        </div>
      )}
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
  );
}

// Net earnings a week, the last twelve, as bars on a shared baseline.
function WeeklyBars({ weekly }) {
  const max = weekly.reduce((a, b) => (b > a ? b : a), 0n);
  return (
    <figure className={styles.barsFig} aria-label="Earnings a week, the last 12 weeks">
      <div className={styles.bars}>
        {weekly.map((w, i) => (
          <div key={i} className={styles.bar} style={{ height: `${max ? Number((w * 100n) / max) : 0}%` }} title={`${['This week', 'Last week'][weekly.length - 1 - i] ?? `${weekly.length - 1 - i} weeks ago`}: ${usdc(w)}`} />
        ))}
      </div>
      <figcaption className={styles.barsAxis}><span>12 weeks ago</span><span>This week</span></figcaption>
    </figure>
  );
}

function EarnedColumn({ earnings }) {
  return (
    <Column
      title="Earned"
      state={earnings?.error ? 'stateWarn' : earnings ? 'stateGood' : 'statePending'}
      stateLabel={earnings?.error ? 'Unavailable' : earnings ? 'All time' : 'Loading'}
    >
      <div className={styles.bigValue}>{earnings?.error ? '—' : earnings ? usdc(earnings.total) : <Skeleton width="8em" />}</div>
      <div className={styles.fieldNote}>
        {earnings && !earnings.error ? `${earnings.sales} ${earnings.sales === 1 ? 'sale' : 'sales'}` : 'From record sales'}
      </div>
      {earnings?.weekly && <WeeklyBars weekly={earnings.weekly} />}
    </Column>
  );
}

function SpentColumn({ items }) {
  const list = Array.isArray(items) ? items : null;
  const spent = list?.reduce((s, it) => s + (it.price ?? 0n), 0n);
  return (
    <Column title="Library" state={list ? 'stateGood' : 'statePending'} stateLabel={list ? 'All time' : 'Locked'}>
      <div className={styles.bigValue}>{list ? `${list.length} ${list.length === 1 ? 'record' : 'records'}` : '—'}</div>
      <div className={styles.fieldNote}>{list ? `${usdc(spent)} spent` : 'Unlock it below'}</div>
    </Column>
  );
}

// ── Tables ──────────────────────────────────────────────────────────────────

// A sortable table whose rows open something. Columns: { key, label, render, sort?, num?, hideSm? }.
// Rows are keyboard-reachable: Enter or Space opens one, like a click.
function DataTable({ label, columns, rows, rowKey, onOpen, empty }) {
  const [sort, setSort] = useState(null); // { key, dir }
  const col = columns.find((c) => c.key === sort?.key);
  const sorted = col ? [...rows].sort((a, b) => {
    const x = col.sort(a), y = col.sort(b);
    return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
  }) : rows;
  const cls = (c) => [c.num && styles.num, c.hideSm && styles.hideSm].filter(Boolean).join(' ') || undefined;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table} aria-label={label}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={cls(c)} aria-sort={sort?.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
                {c.sort ? (
                  <button
                    className={styles.sortBtn}
                    type="button"
                    // Numbers sort biggest first on the first click; names A to Z.
                    onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key ? -s.dir : c.num ? -1 : 1 }))}
                  >
                    {c.label}<span aria-hidden="true">{sort?.key === c.key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}</span>
                  </button>
                ) : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={rowKey(r)}
              tabIndex={0}
              onClick={() => onOpen(r)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(r); } }}
            >
              {columns.map((c) => <td key={c.key} className={cls(c)}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && empty && <div className={styles.tableEmpty}>{empty}</div>}
    </div>
  );
}

// Rows whose text holds `q`, case-insensitively.
const matching = (rows, q, text) => {
  const needle = q.trim().toLowerCase();
  return needle ? rows.filter((r) => text(r).toLowerCase().includes(needle)) : rows;
};

function FilterInput({ value, onChange, label }) {
  return (
    <input
      className={`${styles.input} ${styles.filter}`}
      type="search"
      placeholder="Filter"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// Facts about the open row, label over value.
function Facts({ items }) {
  return (
    <dl className={styles.facts}>
      {items.map(([k, v]) => (
        <div key={k}><dt className={styles.fieldLabel}>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}

// ── Buying ──────────────────────────────────────────────────────────────────

const keyOf = (it) => `${it.publisher}/${it.repo}/${it.id}`;
const repoHref = (publisher, repo) => `#/data/${publisher}/${encodeURIComponent(repo)}`;

// One purchase, opened. Reopening pays nothing: buyRecord sees the reader can already read.
// `opened` is kept by the tab, so closing and reopening the drawer doesn't fetch again.
function PurchaseDrawer({ item, opened, onOpen, onClose }) {
  const o = item && opened[keyOf(item)];
  useEffect(() => {
    if (item && item.id != null && !o) onOpen(item);
  }, [item, o, onOpen]);
  return (
    <Modal open={Boolean(item)} onClose={onClose} title={item?.title ?? ''} side>
      {item && <>
        <Facts items={[
          ['From', <a key="from" className={styles.resLink} href={repoHref(item.publisher, item.repo)}>{item.repo} · {truncate(item.publisher)}</a>],
          ['Paid', item.price != null ? usdc(item.price) : '—'],
          ['Bought', shortDate(item.at)],
        ]} />
        {item.id == null && <p className={styles.colText}>The whole repo: open any record on <a className={styles.resLink} href={repoHref(item.publisher, item.repo)}>its page</a>.</p>}
        {(o === 'busy' || (item.id != null && !o)) && <div className={styles.pending}>Opening the sealed fields…</div>}
        {o?.error && <div className={styles.formError}>{o.error} <button className={styles.ghostBtnSm} type="button" onClick={() => onOpen(item)}>Try again</button></div>}
        {o?.fields && <>
          <div className={styles.drawerHead}>Fields</div>
          <Fields fields={o.fields} />
          <div className={styles.btnRow}>
            <button className={styles.ghostBtn} type="button" onClick={() => download(`${item.repo}-${item.id}`, { id: item.id, title: item.title, fields: { title: item.title, ...o.fields } })}>Download</button>
          </div>
        </>}
      </>}
    </Modal>
  );
}

function BuyingTab({ wallet, balances, onFund, funding, refreshBalances }) {
  const { wallet: privyWallet } = useAuth();
  // Bought something this session: the signature is already in hand, so it loads without asking.
  const [items, setItems] = useState(() => (hasIdentity(wallet) ? null : undefined)); // undefined not asked, null loading, [...], { error }
  const [opened, setOpened] = useState({}); // item key → 'busy' | { fields } | { error }
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState('');

  const fetchLibrary = useCallback(() => readLibrary(privyWallet, wallet)
    .then(setItems, (err) => setItems({ error: friendlyError(err) })), [privyWallet, wallet]);
  const load = () => { setItems(null); fetchLibrary(); };

  useEffect(() => {
    if (privyWallet && hasIdentity(wallet)) fetchLibrary();
  }, [privyWallet, wallet, fetchLibrary]);

  const open = useCallback(async (it) => {
    const k = keyOf(it);
    setOpened((o) => ({ ...o, [k]: 'busy' }));
    const next = await buy(privyWallet, wallet, { ...it, maxPrice: it.price ?? 0n })
      .then(({ fields }) => ({ fields }), (err) => ({ error: friendlyError(err) }));
    setOpened((o) => ({ ...o, [k]: next }));
  }, [privyWallet, wallet]);

  const list = Array.isArray(items) ? matching(items, q, (it) => `${it.title} ${it.repo} ${it.publisher}`) : [];
  const columns = [
    { key: 'title', label: 'Record', sort: (it) => it.title.toLowerCase(), render: (it) => <span className={styles.cellName}>{it.title}</span> },
    { key: 'from', label: 'From', hideSm: true, sort: (it) => it.repo, render: (it) => <span className={styles.cellSub}>{it.repo} · {truncate(it.publisher)}</span> },
    { key: 'price', label: 'Paid', num: true, sort: (it) => it.price ?? -1n, render: (it) => (it.price != null ? usdc(it.price) : '—') },
    { key: 'at', label: 'Bought', num: true, hideSm: true, sort: (it) => it.at ?? 0, render: (it) => shortDate(it.at) },
  ];

  return (
    <>
      <div className={styles.accountPanel}>
        <WalletColumn wallet={wallet} />
        <BalanceColumn balances={balances} onFund={onFund} funding={funding} refreshBalances={refreshBalances} />
        <SpentColumn items={items} />
      </div>

      <section className={styles.section}>
        <div className={styles.toolbar}>
          <h2 className={styles.h2}>Library</h2>
          {Array.isArray(items) && items.length > 0 && <FilterInput value={q} onChange={setQ} label="Filter your library" />}
        </div>
        {items === undefined && (
          <div className={styles.tableEmpty}>
            <p className={styles.colText}>
              What you buy is tied to your wallet by a signature, so nobody else can list it. Sign once to
              see your library (it pays nothing).
            </p>
            <button className={styles.primaryBtn} type="button" onClick={load} disabled={!privyWallet}>Show my library</button>
          </div>
        )}
        {items === null && (
          <div className={styles.tableWrap} role="status" aria-label="Reading your library">
            {[0, 1, 2].map((i) => <div key={i} className={styles.rowLink}><Skeleton width="10em" /><Skeleton width="7em" /><Skeleton width="5em" /></div>)}
          </div>
        )}
        {items?.error && <div className={styles.formError}>{items.error} <button className={styles.ghostBtnSm} type="button" onClick={load}>Try again</button></div>}
        {Array.isArray(items) && (
          <DataTable
            label="Your library"
            columns={columns}
            rows={list}
            rowKey={keyOf}
            onOpen={setSelected}
            empty={items.length ? 'Nothing matches.' : <>Nothing bought yet. Find data on the <a className={styles.resLink} href={EXPLORER_URL}>explorer</a>: paid records have a Buy button on their repo's page.</>}
          />
        )}
        <PurchaseDrawer item={selected} opened={opened} onOpen={open} onClose={() => setSelected(null)} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Buy with an agent</h2>
        <p className={styles.colText}>
          Agents search and buy on Fangorn with the Fangorn plugin, added to Claude Code with:
        </p>
        <Cmd text={MCP_INSTALL} />
      </section>
    </>
  );
}

// ── Publishing ──────────────────────────────────────────────────────────────

const dataHref = (repo) => `#/account/data${repo ? `/${encodeURIComponent(repo)}` : ''}`;

// A repo's state on the explorer, and whether it's an app.
function RepoBadges({ repo }) {
  return (
    <>
      {repo.app && <span className={styles.badge} title={repo.app.card}>App{repo.app.name ? `: ${repo.app.name}` : ''}</span>}
      <span className={repo.listing ? styles.badge : styles.badgeWarn} title={repo.listing ? undefined : 'The explorer indexes new data every few minutes.'}>
        {repo.listing ? 'Listed' : 'Not listed yet'}
      </span>
    </>
  );
}

// Every repo: what the explorer lists of it. Sales are per record, inside a repo.
function RepoTable({ repos, earnings }) {
  const updated = (r) => (earnings?.head ? blockTime(earnings.head, r.block) : null);
  const columns = [
    { key: 'repo', label: 'Repo', sort: (r) => r.repo, render: (r) => <span className={styles.cellName}>{r.repo}</span> },
    { key: 'status', label: 'Status', hideSm: true, render: (r) => <span className={styles.cellBadges}><RepoBadges repo={r} /></span> },
    { key: 'records', label: 'Records', num: true, sort: (r) => r.listing?.count ?? -1, render: (r) => (r.listing ? r.listing.count.toLocaleString() : '—') },
    { key: 'updated', label: 'Updated', num: true, sort: (r) => r.block, render: (r) => shortDate(updated(r)) },
  ];
  return <DataTable label="Your repos" columns={columns} rows={repos} rowKey={(r) => r.repo} onOpen={(r) => { location.hash = dataHref(r.repo); }} />;
}

// A record's buyers and what they paid it, or a stand-in while the registry answers.
const buyersCell = (r, pick) => (r.buyers === undefined ? <Skeleton width="3em" /> : r.buyers === null ? '—' : pick(r));
const earnedOf = (r) => BigInt(r.buyers ?? 0) * netPrice(r);

// One record in the drawer: what it shows, what it sells for, how many bought it.
function RecordDrawer({ record, address, repo, onClose }) {
  return (
    <Modal open={Boolean(record)} onClose={onClose} title={record?.title ?? ''} side>
      {record && <>
        <Facts items={[
          ['Price', record.price != null ? usdc(record.price) : 'Free'],
          ['Buyers', buyersCell(record, (r) => r.buyers.toLocaleString())],
          ['Earned', buyersCell(record, (r) => usdc(earnedOf(r)))],
          ['Type', record.type],
        ]} />
        <div className={styles.drawerHead}>Fields</div>
        <Fields fields={record.fields} sealed={record.sealed} />
        <p className={`${styles.colText} ${styles.drawerFoot}`}>
          Id <span className={styles.fieldValueMono}>{record.id}</span> ·{' '}
          <a className={styles.resLink} href={`#/data/${address}/${encodeURIComponent(repo)}`}>Its public page</a>
        </p>
      </>}
    </Modal>
  );
}

// One repo, opened: its records, and how many bought each. A record's buyers are its group in
// the SettlementRegistry, so a count is a read, not a scan.
function RepoView({ repo, address, onAdd }) {
  const [records, setRecords] = useState(undefined); // undefined loading, null failed, [...]
  const [buyers, setBuyers] = useState(undefined); // undefined loading, null failed, Map id → count
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);

  // Re-read when the repo moves (a publish adds records).
  useEffect(() => {
    let cancelled = false;
    readRepoPage(address, repo.repo).then((p) => {
      if (cancelled) return;
      setRecords(p.records);
      return readBuyers(address, repo.repo, p.records.map((r) => r.id)).then((b) => !cancelled && setBuyers(b), (err) => {
        console.warn('Buyer counts failed:', err);
        if (!cancelled) setBuyers(null);
      });
    }, (err) => {
      console.warn(`Reading ${repo.repo} failed:`, err);
      if (!cancelled) setRecords(null);
    });
    return () => { cancelled = true; };
  }, [address, repo.repo, repo.block]);

  const rows = (records ?? []).map((r) => ({ ...r, buyers: buyers === undefined ? undefined : buyers?.get(r.id) ?? null }));
  const total = buyers ? rows.reduce((t, r) => ({ n: t.n + (r.buyers ?? 0), earned: t.earned + earnedOf(r) }), { n: 0, earned: 0n }) : null;
  const columns = [
    { key: 'title', label: 'Record', sort: (r) => r.title.toLowerCase(), render: (r) => <span className={styles.cellName}>{r.title}</span> },
    { key: 'type', label: 'Type', hideSm: true, sort: (r) => r.type, render: (r) => <span className={styles.cellSub}>{r.type}</span> },
    { key: 'size', label: 'Size', num: true, hideSm: true, sort: (r) => r.fields.size ?? -1, render: (r) => (typeof r.fields.size === 'number' ? formatBytes(r.fields.size) : '—') },
    { key: 'price', label: 'Price', num: true, sort: (r) => r.price ?? -1n, render: (r) => (r.price != null ? usdc(r.price) : 'Free') },
    { key: 'buyers', label: 'Buyers', num: true, sort: (r) => r.buyers ?? -1, render: (r) => buyersCell(r, (x) => x.buyers.toLocaleString()) },
    { key: 'earned', label: 'Earned', num: true, sort: earnedOf, render: (r) => buyersCell(r, (x) => usdc(earnedOf(x))) },
  ];
  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.repoTitle}>
          <RepoBadges repo={repo} />
          {total && <span className={styles.rowMeta}>{total.n} {total.n === 1 ? 'buyer' : 'buyers'} · {usdc(total.earned)} earned</span>}
        </div>
        <span className={styles.cardLinks}>
          {repo.app?.site && <a className={styles.resLink} href={repo.app.site} target="_blank" rel="noreferrer">Site <span className={styles.resArrow}>↗</span></a>}
          <a className={styles.resLink} href={`#/data/${address}/${encodeURIComponent(repo.repo)}`}>Public page</a>
          <CopyButton text={repoLink(address, repo.repo)} label="Copy link" className={styles.ghostBtnSm} />
          <button className={styles.ghostBtnSm} type="button" onClick={onAdd}>+ Add files</button>
        </span>
      </div>
      {records === undefined && <div className={styles.pending}>Reading {repo.repo}…</div>}
      {records === null && <div className={styles.formError}>Couldn't read {repo.repo}. Reload to try again.</div>}
      {records && <>
        {records.length > 8 && <div className={styles.toolbar}><span /><FilterInput value={q} onChange={setQ} label={`Filter ${repo.repo}`} /></div>}
        <DataTable
          label={`Records in ${repo.repo}`}
          columns={columns}
          rows={matching(rows, q, (r) => `${r.title} ${r.id} ${r.type}`)}
          rowKey={(r) => r.id}
          onOpen={setSelected}
          empty={records.length ? 'Nothing matches.' : 'No records yet.'}
        />
      </>}
      <RecordDrawer record={selected && rows.find((r) => r.id === selected.id)} address={address} repo={repo.repo} onClose={() => setSelected(null)} />
    </>
  );
}

function PublishingTab({ wallet, path, balances, onFund, funding, refreshBalances, publisher, onPublish }) {
  const { repos, earnings, error } = publisher;
  // null when closed, else { repo }: the repo to add to, or null for the default.
  const [publishing, setPublishing] = useState(null);
  const open = path[1] != null ? decodeURIComponent(path.slice(1).join('/')) : null;
  const repo = open != null ? repos?.find((r) => r.repo === open) : null;
  const { exportKey } = useAuth();

  return (
    <>
      <div className={styles.accountPanel}>
        <WalletColumn wallet={wallet} />
        <BalanceColumn balances={balances} onFund={onFund} funding={funding} refreshBalances={refreshBalances} gas />
        <EarnedColumn earnings={earnings} />
      </div>

      <section className={styles.section}>
        <div className={styles.toolbar}>
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            {open != null ? <><a href={dataHref()}>Your data</a><span aria-hidden="true">/</span><span aria-current="page">{open}</span></>
              : <h2 className={styles.h2}>Your data</h2>}
          </nav>
          {open == null && repos?.length > 0 && (
            <button className={styles.ghostBtnSm} type="button" onClick={() => setPublishing({ repo: null })}>+ Publish data</button>
          )}
        </div>
        {error && <div className={styles.formError}>{error}</div>}
        {repos === null && (
          <div className={styles.tableWrap} role="status" aria-label="Reading your data from the chain">
            {[0, 1].map((i) => <div key={i} className={styles.rowLink}><Skeleton width="9em" /><Skeleton width="6em" /><Skeleton width="12em" /></div>)}
          </div>
        )}
        {open == null && repos?.length === 0 && (
          <button className={`${styles.card} ${styles.cardNew}`} type="button" onClick={() => setPublishing({ repo: null })}>
            <span className={styles.cardPlus} aria-hidden="true">+</span>
            <span className={styles.cardTitle}>Publish data</span>
            <span className={styles.cardBody}>Any files. Choose what's paid and the price.</span>
          </button>
        )}
        {open == null && repos?.length > 0 && <RepoTable repos={repos} earnings={earnings} />}
        {open != null && repos && !repo && <div className={styles.pending}>You have no repo called {open}.</div>}
        {repo && <RepoView key={repo.repo} repo={repo} address={wallet} onAdd={() => setPublishing({ repo: repo.repo })} />}
        {publishing && <PublishModal
          key={publishing.repo ?? ''}
          open
          onClose={() => setPublishing(null)}
          target={publishing.repo}
          repos={repos}
          balances={balances}
          onPublish={onPublish}
        />}
      </section>

      {open == null && <>
        <section className={styles.section}>
          <h2 className={styles.h2}>How people find it</h2>
          <p className={styles.colText}>
            The <a className={styles.resLink} href={EXPLORER_URL} target="_blank" rel="noreferrer">Fangorn explorer <span className={styles.resArrow}>↗</span></a> lists
            every publisher. Agents search it through the Fangorn plugin, which anyone adds to Claude Code with:
          </p>
          <Cmd text={MCP_INSTALL} />
          <p className={styles.colText}>
            Each repo also has its own public page: share its link to send someone straight to your
            data's storefront.
          </p>
        </section>

        <details className={styles.section}>
          <summary className={styles.h2}>Publish from the command line</summary>
          <ol className={styles.onboard}>
            <li>
              <div className={styles.cardTitle}>Install the Fangorn CLI</div>
              <Cmd text="npm i -g @fangorn-network/sdk" />
            </li>
            <li>
              <div className={styles.cardTitle}>Configure it with this wallet's key</div>
              <Cmd text="fangorn init" />
              <p className={styles.colText}>
                Pick <b>Base Sepolia</b>, then paste your private key. Anyone with it controls your
                wallet: paste it only into your own terminal, never into a chat, a website or an email.
              </p>
              <CopyKey exportKey={exportKey} />
            </li>
            <li>
              <div className={styles.cardTitle}>Publish</div>
              <Cmd text={CLI_PUBLISH} />
              <p className={styles.colText}>
                For files too big for the browser, or to publish on a schedule. It shows up here
                the same way.
              </p>
            </li>
          </ol>
        </details>
      </>}
    </>
  );
}

// A command with a copy button. Wraps instead of scrolling: a command you can't
// see the end of gets pasted wrong.
export function Cmd({ text }) {
  return (
    <div className={styles.cmd}>
      <pre>{text}</pre>
      <CopyButton text={text} className={styles.ghostBtnSm} />
    </div>
  );
}

// The key is copied from Privy's export dialog, not from this page: Privy rebuilds
// it inside its own iframe on its own origin (nothing on fangorn.network can leak what
// it never holds). `exportKey` is null for an external wallet, which holds its own.
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

const MCP_INSTALL = `/plugin marketplace add fangorn-network/westmarch
/plugin install fangorn-index@fangorn`;
const CLI_PUBLISH = `fangorn repo init my-data
fangorn add .
fangorn commit --paid body --price 0.01
fangorn push`;


// A repo name is what the explorer and agents see; keep it to what a URL doesn't quote.
const REPO_NAME = /^[a-z0-9][a-z0-9._-]{1,62}$/;
// ponytail: every paid record is one wallet signature and every sealed value one upload.
// Bigger files go through the CLI.
const MAX_ROWS = 1000;

// One repo: whether the explorer lists it yet, and its page to share.
// Upload a file, choose what's paid and for how much, publish. That's the whole product.
// Mounted per opening, so it starts on `target`, else the newest repo, else a new one.
function PublishModal({ open, onClose, target, repos, balances, onPublish }) {
  const [file, setFile] = useState(null); // { records, columns } | { error }
  // The repo the files go into; '' is a new one, named below.
  const [choice, setChoice] = useState(target ?? repos?.[0]?.repo ?? '');
  const [name, setName] = useState(repos?.length ? '' : 'data');
  const [paid, setPaid] = useState([]);
  const [price, setPrice] = useState('0.01');
  const [step, setStep] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const repo = choice || name.trim();
  const validName = !!choice || REPO_NAME.test(repo);
  const exists = repos?.some((r) => r.repo === repo);
  const validPrice = !paid.length || Number(price) > 0;
  const rows = file?.records?.length ?? 0;
  // Renaming a file renames its record id, so two names can collide.
  const ids = file?.records?.map((r) => r.id) ?? [];
  const clash = new Set(ids).size !== ids.length;
  const unnamed = file?.records?.some((r) => r.type === 'file' && !r.payload.title.trim());
  const ready = rows > 0 && rows <= MAX_ROWS && validName && validPrice && !clash && !unnamed && !step;

  // A file record's name (and so its id) and description, edited before publishing.
  function editFile(i, patch) {
    setFile((f) => ({
      ...f,
      records: f.records.map((r, j) => (j !== i ? r : {
        ...r,
        ...(patch.title != null && { id: recordId(patch.title.trim()) }),
        payload: { ...r.payload, ...patch },
      })),
    }));
  }

  function reset() {
    setFile(null); setPaid([]); setPrice('0.01'); setError(null); setDone(null);
  }
  function close() {
    if (step) return;
    reset();
    onClose();
  }

  async function pick(event) {
    const files = [...(event.target.files ?? [])];
    if (!files.length) return;
    setPaid([]); setDone(null); setError(null);
    try {
      setFile(await readFiles(files));
    } catch (err) {
      setFile({ error: err.message });
    }
  }

  async function go() {
    setError(null);
    try {
      // An empty description is left off the record rather than published blank.
      const records = file.records.map((r) => {
        if (r.type !== 'file') return r;
        const { description, ...payload } = r.payload;
        return { ...r, payload: { ...payload, title: payload.title.trim(), ...(description?.trim() && { description: description.trim() }) } };
      });
      setDone(await onPublish({ repo, records, paid, price }, setStep));
    } catch (err) {
      console.error('Publish failed:', err);
      setError(friendlyError(err));
    } finally {
      setStep(null);
    }
  }

  if (done) {
    return (
      <Modal open={open} onClose={close} title="Published">
        <p className={styles.colText}>
          <b>{repo}</b> is on chain: {rows} {rows === 1 ? 'record' : 'records'}
          {paid.length ? `, ${paid.join(', ')} sold at ${price} USDC a record` : ', free to read'}.
          The explorer lists it within a few minutes, and from then on any agent with the Fangorn
          plugin can find it{paid.length ? ' and buy it. Sales are paid straight to this wallet' : ''}.
        </p>
        <div className={styles.cardLinks}>
          <a className={styles.resLink} href={txExplorer(done.txHash)} target="_blank" rel="noreferrer">Transaction <span className={styles.resArrow}>↗</span></a>
        </div>
        <div className={styles.btnRow}>
          <button className={styles.primaryBtn} type="button" onClick={close}>Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={close} title="Publish data">
      <Field label="Repo">
        {repos?.length > 0 && (
          <select className={styles.input} value={choice} onChange={(event) => setChoice(event.target.value)} disabled={!!step} aria-label="Repo">
            {repos.map((r) => <option key={r.repo} value={r.repo}>{r.repo}</option>)}
            <option value="">New repo…</option>
          </select>
        )}
        {!choice && (
          <input className={styles.input} value={name} onChange={(event) => setName(event.target.value.toLowerCase())} placeholder="kelp-surveys" aria-label="New repo name" disabled={!!step} />
        )}
        <div className={styles.pending}>
          {choice ? 'Adds to this repo. A record with an id it already has is replaced.'
            : !repo ? 'Name it: what agents and the explorer call it.'
              : !validName ? '2–63 characters: lowercase letters, digits, dot, dash or underscore.'
                : exists ? 'You already have a repo of this name: these add to it.'
                  : 'A new repo, made when you publish.'}
        </div>
      </Field>

      <Field label="Files">
        <input type="file" multiple onChange={pick} disabled={!!step} aria-label="Files" />
        <div className={styles.pending}>
          {!file ? 'Any files, up to 50 MB each. Each file is a record; a CSV or JSON file of rows is a record per row.'
            : file.error ? <span className={styles.formError}>{file.error}</span>
              : rows > MAX_ROWS ? <span className={styles.formError}>{rows.toLocaleString()} records. The browser publishes up to {MAX_ROWS.toLocaleString()}; use the CLI below for more.</span>
                : `${rows.toLocaleString()} ${rows === 1 ? 'record' : 'records'}: ${file.columns.join(', ')}`}
        </div>
        {file?.records?.map((r, i) => r.type === 'file' && (
          <div key={i} className={styles.fileEdit}>
            <div className={styles.inlineValue}>
              <input className={styles.input} value={r.payload.title} onChange={(e) => editFile(i, { title: e.target.value })} aria-label={`Name of file ${i + 1}`} disabled={!!step} />
              <span className={styles.fieldNote}>{formatBytes(r.payload.size)}</span>
            </div>
            <textarea className={styles.input} rows={2} value={r.payload.description ?? ''} onChange={(e) => editFile(i, { description: e.target.value })} placeholder="Description (public: what search finds)" aria-label={`Description of ${r.payload.title}`} disabled={!!step} />
          </div>
        ))}
        {clash && <div className={styles.formError}>Two files share a name (spaces and accents count as dashes). Rename one.</div>}
        {unnamed && <div className={styles.formError}>Every file needs a name.</div>}
      </Field>


      {file?.columns?.length > 0 && (
        <Field label="Paid columns">
          <div className={styles.chipRow}>
            {file.columns.map((c) => (
              <button
                key={c}
                type="button"
                className={styles.chip}
                aria-pressed={paid.includes(c)}
                disabled={!!step}
                onClick={() => setPaid((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))}
              >
                {c}
              </button>
            ))}
          </div>
          <div className={styles.pending}>
            {paid.length
              ? 'Sealed: a buyer pays to open them. The other columns are public, and are what search finds, so leave enough of them open to describe each row.'
              : 'None: everything is free to read. Pick the columns people should pay for.'}
          </div>
        </Field>
      )}

      {paid.length > 0 && (
        <Field label="Price per record (USDC)">
          <input className={styles.input} type="number" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} aria-label="Price per record in USDC" disabled={!!step} />
          <div className={styles.pending}>
            Paid to this wallet when someone buys a record.
            Your wallet signs at least {rows * (1 + paid.length)} times to seal and price {rows} {rows === 1 ? 'record' : 'records'}.
          </div>
        </Field>
      )}

      {/* A warning, not a gate: the balance can be a drip behind. */}
      {balances && balances.eth < LOW_ETH && (
        <div className={styles.formError}>
          Publishing needs a little Base Sepolia ETH for gas.
          <FaucetLinks />
        </div>
      )}
      {error && <div className={styles.formError}>{error}</div>}
      <div className={styles.btnRow}>
        <button className={styles.primaryBtn} type="button" onClick={go} disabled={!ready}>
          {step ? 'Publishing…' : 'Publish'}
        </button>
      </div>
      <div className={styles.pending}>
        {step ?? 'Public and permanent: free columns can be read by anyone, for good.'}
      </div>
    </Modal>
  );
}

// ── The hub ─────────────────────────────────────────────────────────────────

// Buying and publishing are separate tabs: most people do one. The tab is in the URL
// (#/account/library, #/account/data/<repo>); a bare #/account opens the last one used,
// else Publishing for a wallet with repos and Buying for one without.
const TABS = [['library', 'Buying'], ['data', 'Publishing']];
const TAB_KEY = 'fangorn-account-tab';
const savedTab = () => { try { return localStorage.getItem(TAB_KEY); } catch { return null; } };

export default function Home({ path = [] }) {
  const { user, fundWallet } = useAuth();
  const { balances, refresh: refreshBalances } = useBalances();
  const [funding, setFunding] = useState(false);

  const { name } = readIdentity(user);
  const wallet = user?.wallet?.address;
  // ponytail: read for buyers too, since the default tab hangs on whether there are repos.
  const publisher = usePublisher(wallet);
  const { repos } = publisher;

  const asked = TABS.some(([k]) => k === path[0]) ? path[0] : null;
  const saved = savedTab();
  const tab = asked ?? (TABS.some(([k]) => k === saved) ? saved : repos === null ? null : repos.length ? 'data' : 'library');
  useEffect(() => {
    if (asked) try { localStorage.setItem(TAB_KEY, asked); } catch { /* private mode: the default still works */ }
  }, [asked]);

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

  async function onPublish(job, onStep) {
    const out = await publisher.publish(job, onStep);
    refreshBalances();
    return out;
  }

  const money = { balances, onFund: addFunds, funding, refreshBalances };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.welcome}>
          <span className={styles.eyebrow}>Account</span>
          <h1 className={styles.h1}>Welcome, {name}.</h1>
          <p className={styles.sub}>
            {tab === 'library' ? 'Data you buy is paid from this wallet, with no gas, and kept in your library.'
              : tab === 'data' ? (repos?.length ? 'Your data is published. Each sale is paid to your wallet.'
                : 'Publish a file and set a price. Agents discover it on the explorer, and sales are paid to your wallet.')
                : 'Reading your account from the chain…'}
          </p>
        </section>

        <nav className={styles.tabs} aria-label="Account">
          {TABS.map(([k, label]) => (
            <a key={k} href={`#/account/${k}`} className={tab === k ? `${styles.tab} ${styles.tabOn}` : styles.tab} aria-current={tab === k ? 'page' : undefined}>
              {label}
            </a>
          ))}
        </nav>

        {wallet && tab === 'library' && <BuyingTab wallet={wallet} {...money} />}
        {wallet && tab === 'data' && <PublishingTab wallet={wallet} path={asked ? path : ['data']} publisher={publisher} onPublish={onPublish} {...money} />}
        {tab === null && <div className={styles.pending} role="status">Loading…</div>}
      </main>
    </div>
  );
}
