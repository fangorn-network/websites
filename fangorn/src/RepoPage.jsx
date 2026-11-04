import { useEffect, useState } from 'react';
import { formatUnits, isAddress } from 'viem';
import styles from './Home.module.css';
import { CopyButton, Cmd } from './Home';
import { readRepoPage, repoLink } from './account';
import { readBalances } from './fangorn';
import { buy } from './library';
import { useAuth } from './authContext';
import { truncate, explorer, formatBytes } from './format';

// One repo's public page: the link a publisher shares. Anyone can open it, no login. It reads
// the repo from the chain and IPFS, so it's current the moment a publish lands.

const usdc = (units) => `${formatUnits(units, 6)} USDC`;
const MCP_INSTALL = `/plugin marketplace add fangorn-network/westmarch
/plugin install fangorn-index@fangorn`;
const buyPrompt = (publisher, repo, r) => `Buy the record "${r.id}" from Fangorn publisher ${publisher}, repo "${repo}".`;
// ponytail: renders every record up to this; page it when repos get big.
const SHOWN = 200;

// Save a JSON download in the browser; prices are bigints, so they go out as decimal USDC strings.
function save(name, data) {
  const json = JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? formatUnits(v, 6) : v), 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = `${name.replace(/[^\w.-]+/g, '_')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000); // revoking at once can cancel it in Firefox
}
// A file record downloads as the file itself (paid ones open as data: URLs, free ones are IPFS links).
// Anything else falls back to the record as JSON.
export async function download(name, r, opened) {
  const fields = opened ? { ...r.fields, ...opened } : r.fields;
  if (!isUrl(fields.file)) return save(name, exportOf(r, opened));
  // fetch → blob so the filename sticks; `download` is ignored on cross-origin links.
  const blob = await fetch(fields.file).then((res) => res.blob());
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fields.title ?? name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// What a download holds for one record: its open fields, and which are still sealed.
const exportOf = (r, opened) => ({
  id: r.id, title: r.title, price: r.price, fields: opened ? { ...r.fields, ...opened } : r.fields,
  ...(!opened && r.sealed?.length ? { sealed: r.sealed } : {}),
});

// A paid file opens as a data: URL (publishRecords seals it that way).
const isUrl = (v) => typeof v === 'string' && /^(https?:\/\/|data:)/.test(v);

// A field's value: a link, an image for an image file, else text.
function Value({ k, v, fields }) {
  if (isUrl(v)) {
    const data = v.startsWith('data:');
    if ((k === 'file' && String(fields.mime ?? '').startsWith('image/')) || v.startsWith('data:image/')) {
      return <img src={v} alt={fields.title ?? ''} style={{ maxWidth: '100%', maxHeight: 240, display: 'block', marginTop: 4 }} />;
    }
    if (data) return <a className={styles.resLink} href={v} download={fields.title ?? k}>Download</a>;
    return <a className={styles.resLink} href={v} target="_blank" rel="noreferrer">{k === 'file' ? 'Download' : v} <span className={styles.resArrow}>↗</span></a>;
  }
  if (k === 'size' && fields.mime && typeof v === 'number') return <span>{formatBytes(v)}</span>;
  const text = typeof v === 'string' ? v : JSON.stringify(v);
  return <span>{text.length > 400 ? `${text.slice(0, 400)}…` : text}</span>;
}

/** A record's fields; `sealed` names the ones still closed. The library shows bought ones with it too. */
export function Fields({ fields, sealed = [] }) {
  const shown = Object.entries(fields).filter(([k]) => k !== 'title' && k !== 'id');
  return (
      <dl style={{ margin: '8px 0 0', display: 'grid', gridTemplateColumns: 'minmax(0, max-content) minmax(0, 1fr)', gap: '4px 12px', fontSize: 14 }}>
        {shown.map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt className={styles.fieldLabel}>{k}</dt>
            <dd style={{ margin: 0, overflowWrap: 'anywhere' }}><Value k={k} v={v} fields={fields} /></dd>
          </div>
        ))}
        {sealed.map((k) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt className={styles.fieldLabel}>{k}</dt>
            <dd style={{ margin: 0 }} className={styles.fieldNote}>Sealed: opens when bought</dd>
          </div>
        ))}
      </dl>
  );
}

function Listing({ publisher, repo, r }) {
  const { authenticated, login, wallet, user } = useAuth();
  const [state, setState] = useState(null); // null, 'busy', { opened }, { error }
  const opened = state?.opened;

  async function go() {
    if (!authenticated) return login();
    const address = user?.wallet?.address;
    if (!wallet || !address) return setState({ error: 'Your wallet is still being set up. Try again in a moment.' });
    setState('busy');
    try {
      const { fields } = await buy(wallet, address, { publisher, repo, id: r.id, maxPrice: r.price });
      setState({ opened: fields });
    } catch (err) {
      const msg = err.shortMessage ?? err.message;
      // Already-bought records open without paying, so the balance is only checked once it failed.
      const low = await readBalances(address).then((b) => b.usdc < r.price, () => false);
      setState({ error: /rejected|denied/i.test(msg) ? 'Cancelled.' : low ? <>Not enough USDC. <a className={styles.resLink} href="#/account/library">Add funds</a> and try again.</> : msg });
    }
  }

  return (
    <div className={styles.collection}>
      <div className={styles.collectionHead}>
        <span className={styles.rowName}>{r.title}</span>
        <span className={r.price != null ? styles.badgeWarn : styles.badge}>{opened ? 'Bought' : r.price != null ? usdc(r.price) : 'Free'}</span>
        {r.price != null && !opened && (
          <button className={styles.ghostBtnSm} type="button" onClick={go} disabled={state === 'busy'}>
            {state === 'busy' ? 'Buying… confirm in your wallet' : authenticated ? 'Buy' : 'Log in to buy'}
          </button>
        )}
        <button className={styles.ghostBtnSm} type="button" onClick={() => download(`${repo}-${r.id}`, r, opened).catch((err) => setState({ error: err.message }))}>Download</button>
        {r.price != null && <CopyButton text={buyPrompt(publisher, repo, r)} label="Copy buy prompt" className={styles.ghostBtnSm} />}
      </div>
      <Fields fields={opened ? { ...r.fields, ...opened } : r.fields} sealed={opened ? [] : r.sealed} />
      {state?.error && <div className={styles.formError}>{state.error}</div>}
    </div>
  );
}

export default function RepoPage({ publisher, repo }) {
  const [page, setPage] = useState(undefined); // undefined loading, { tip, records }, { error }
  const valid = isAddress(publisher);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    readRepoPage(publisher, repo)
      .then((p) => !cancelled && setPage(p))
      .catch((err) => !cancelled && setPage({ error: err.shortMessage ?? err.message }));
    return () => { cancelled = true; };
  }, [publisher, repo, valid]);

  const records = page?.records ?? [];
  const prices = records.map((r) => r.price).filter((p) => p != null);
  const low = prices.length ? prices.reduce((a, b) => (b < a ? b : a)) : null;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.welcome}>
          <span className={styles.eyebrow}>Data on Fangorn</span>
          <h1 className={styles.h1}>{repo}</h1>
          <p className={styles.sub}>
            Published by <a className={styles.resLink} href={explorer(publisher)} target="_blank" rel="noreferrer">{truncate(publisher, 8, 6)}</a>
            {page?.tip && <>
              {' · '}{records.length.toLocaleString()} {records.length === 1 ? 'record' : 'records'}
              {prices.length > 0 && <>{' · '}{prices.length === records.length ? '' : `${prices.length} `}for sale{low != null && ` from ${usdc(low)}`}</>}
            </>}
          </p>
          {page?.tip && (
            <div className={styles.btnRow}>
              <CopyButton text={repoLink(publisher, repo)} label="Copy link" className={styles.ghostBtn} />
              {records.length > 0 && (
                <button className={styles.ghostBtn} type="button" onClick={() => save(repo, { publisher, repo, records: records.map((r) => exportOf(r)) })}>
                  Download all (JSON)
                </button>
              )}
            </div>
          )}
        </section>

        {!valid && <div className={styles.formError}>That link doesn't name a publisher's address.</div>}
        {valid && page === undefined && <div className={styles.pending}>Reading {repo} from the chain…</div>}
        {page?.error && <div className={styles.formError}>Couldn't read this repo: {page.error}</div>}
        {page && !page.error && !page.tip && <div className={styles.pending}>{truncate(publisher, 8, 6)} has no repo called {repo}.</div>}

        {prices.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.h2}>Buying</h2>
            <p className={styles.colText}>
              Buy a record here with the USDC in your Fangorn wallet: no gas, and it opens on this
              page. Everything you buy stays in the library on your <a className={styles.resLink} href="#/account/library">account</a> page.
            </p>
            <p className={styles.colText}>
              Agents discover and buy data with the Fangorn plugin, added to Claude Code with:
            </p>
            <Cmd text={MCP_INSTALL} />
            <p className={styles.colText}>Then give it a record's buy prompt (below), or ask it to search this repo.</p>
          </section>
        )}

        {records.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.h2}>Records</h2>
            <div className={`${styles.rows} ${styles.collections}`}>
              {records.slice(0, SHOWN).map((r) => <Listing key={r.id} publisher={publisher} repo={repo} r={r} />)}
            </div>
            {records.length > SHOWN && <p className={styles.fieldNote}>Showing the first {SHOWN} of {records.length.toLocaleString()}.</p>}
          </section>
        )}
        {page?.tip && !records.length && <div className={styles.pending}>Nothing published here yet.</div>}
      </main>
    </div>
  );
}
