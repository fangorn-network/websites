// The account hub's data: a publisher's repos, whether the explorer lists them, what
// they've earned, and publishing a file as a repo from the browser.
//
// A publisher is a wallet, the same one in the browser and in the CLI (the user
// exports the Privy key into `fangorn init`).
import { useCallback, useEffect, useState } from 'react';
import { createWalletClient, http, parseAbi, parseAbiItem, parseUnits } from 'viem';
import { getLogsInWindows } from '@fangorn-network/sdk/lib/contracts/logs.js';
import { repoId } from '@fangorn-network/sdk/lib/contracts/data-registry/index.js';
import { recordKey, subjectOf } from '@fangorn-network/sdk/lib/contracts/settlement-registry/index.js';
import { NETWORK, publicClient, walletClientFor } from './fangorn.js';
import { useAuth } from './authContext.js';

/** The explorer every publisher is listed on, and what fangorn-mcp searches. */
export const EXPLORER_URL = import.meta.env?.VITE_EXPLORER_URL || 'https://explorer.fangorn.network';

/** Days a record's signed terms stay buyable (the CLI's default). */
const TERMS_DAYS = 365;
/** Fangorn's key server: a buyer's key comes from here once their purchase settles. */
const KEY_SERVER = 'https://keys-test.fangorn.network';

const UPDATED = parseAbiItem('event Updated(address indexed publisher, bytes32 indexed repo_id, string repo, uint64 pos, bytes32 parent, bytes32 head)');
const REGISTERED = parseAbiItem('event Registered(bytes32 indexed subject, address indexed publisher, address indexed referrer, uint256 commitment, uint256 price, uint256 referrer_cut)');

export const scan = (address, event, args) => getLogsInWindows(publicClient, NETWORK.fromBlock, undefined, (fromBlock, toBlock) =>
  publicClient.getLogs({ address, event, args, fromBlock, toBlock }), NETWORK.logWindow);

/** The publisher's repos, newest update first: [{ repo, block }]. */
export async function readRepos(publisher) {
  const logs = await scan(NETWORK.dataRegistryContractAddress, UPDATED, { publisher });
  const latest = new Map(logs.map((l) => [l.args.repo, l.blockNumber]));
  return [...latest].map(([repo, block]) => ({ repo, block })).sort((a, b) => (a.block < b.block ? 1 : -1));
}

/**
 * Sales of the publisher's records: { total, sales }, total in USDC base units, net of
 * the referrer's cut. Every purchase registers a buyer in the SettlementRegistry,
 * which pays the publisher in the same tx, so its log is the ledger.
 */
export function sumSales(logs) {
  return { total: logs.reduce((s, l) => s + l.args.price - l.args.referrer_cut, 0n), sales: logs.filter((l) => l.args.price > 0n).length };
}

/** Base makes a block every 2 seconds, so a block's time is the head's less 2s a block. */
const BLOCK_SECONDS = 2;
const WEEK = 7 * 86400;
/** A block's unix time, from the chain head: { number, timestamp } as viem's getBlock gives them. */
export const blockTime = (head, block) => Number(head.timestamp) - Number(head.number - block) * BLOCK_SECONDS;

/**
 * A publisher's sale logs → { total, sales, weekly, head }: weekly is net earnings over the last
 * `weeks` weeks, oldest first. Pure, so the self-check drives it.
 */
export function salesStats(logs, head, weeks = 12) {
  const weekly = Array(weeks).fill(0n);
  for (const l of logs) {
    const ago = Math.floor((Number(head.timestamp) - blockTime(head, l.blockNumber)) / WEEK);
    if (ago < weeks) weekly[weeks - 1 - ago] += l.args.price - l.args.referrer_cut;
  }
  return { ...sumSales(logs), weekly, head };
}

export async function readEarnings(publisher) {
  const [logs, head] = await Promise.all([scan(NETWORK.settlementRegistryContractAddress, REGISTERED, { publisher }), publicClient.getBlock()]);
  return salesStats(logs, head);
}

const GROUPS = parseAbi([
  'function groupOf(bytes32 subject) view returns (uint256)',
  'function semaphore() view returns (address)',
  'function getMerkleTreeSize(uint256 groupId) view returns (uint256)',
]);
let semaphore = null;

/**
 * How many wallets bought each of `ids` in `repo`: Map id → count. A subject's buyers are its
 * Semaphore group, so the count is the group's size: two reads a record, batched into one call.
 * A record nobody has bought has no group yet (groupOf reverts): 0.
 */
export async function readBuyers(publisher, repo, ids) {
  const registry = NETWORK.settlementRegistryContractAddress;
  semaphore ??= publicClient.readContract({ address: registry, abi: GROUPS, functionName: 'semaphore' })
    .catch((err) => { semaphore = null; throw err; });
  const [sem, rid] = [await semaphore, repoId(repo)];
  const counts = await Promise.all(ids.map(async (id) => {
    const group = await publicClient.readContract({ address: registry, abi: GROUPS, functionName: 'groupOf', args: [subjectOf(publisher, rid, recordKey(id))] })
      .catch(() => null);
    return group == null ? 0 : Number(await publicClient.readContract({ address: sem, abi: GROUPS, functionName: 'getMerkleTreeSize', args: [group] }));
  }));
  return new Map(ids.map((id, i) => [id, counts[i]]));
}

/** What a record's sale pays its publisher: the price less the referrer's share. */
export const netPrice = (r) => (r.price == null ? 0n : r.price - (r.price * BigInt(r.shareBps)) / 10_000n);


/**
 * The explorer's catalog, as a map `<publisher lowercased>/<repo>` → { domain, count,
 * description, publisher, repo, types }. Empty when the explorer doesn't answer.
 */
export async function readListings() {
  const catalog = await fetch(`${EXPLORER_URL}/view/cdn/catalog`, { signal: AbortSignal.timeout(10_000) })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return new Map((catalog?.domains ?? []).filter((d) => d.publisher && d.repo).map((d) => [
    `${d.publisher.toLowerCase()}/${d.repo}`,
    { domain: d.name, count: Number(d.count) || 0, description: d.description || null, publisher: d.publisher, repo: d.repo, types: d.entity_types ?? [] },
  ]));
}

// One read per page load, shared by the landing page and #/explorer.
let listings = null;
export function useListings() {
  const [value, setValue] = useState(null);
  useEffect(() => {
    listings ??= readListings();
    let cancelled = false;
    listings.then((l) => !cancelled && setValue(l));
    return () => { cancelled = true; };
  }, []);
  return value;
}

/** A Fangorn client that only reads. Loaded on use: the SDK root pulls the engine and ZK WASM. */
export async function reader(publisher) {
  const { Fangorn } = await import('@fangorn-network/sdk/lib/fangorn.js');
  // The wallet client is never asked to sign.
  const walletClient = createWalletClient({ account: publisher, chain: NETWORK.chain, transport: http(NETWORK.rpcUrl) });
  // The engine wants storage even to read; reads go through the gateway and never upload.
  return Fangorn.create({ walletClient, config: NETWORK, storage: { signedUrl: {} } });
}

// ── A repo's page ───────────────────────────────────────────────────────────

/** The page a publisher shares for one repo, on this site. */
export const repoLink = (publisher, repo) => `${location.origin}${location.pathname}#/data/${publisher}/${encodeURIComponent(repo)}`;

/**
 * A stored record as its page shows it: { id, title, fields, sealed, price }. `fields` are
 * the public payload fields, `sealed` the names of the paid ones, `price` USDC base units
 * (null when free). Pure, so the self-check drives it.
 */
export function toListing({ id, type, payload }) {
  const fields = {}, sealed = [];
  for (const [k, v] of Object.entries(payload)) {
    if (k === '@terms') continue;
    if (v && typeof v === 'object' && v['@type'] === 'handle') sealed.push(k);
    else fields[k] = v;
  }
  const { price, shareBps = 0 } = payload['@terms']?.terms ?? {};
  const title = [fields.title, fields.name].find((t) => typeof t === 'string' && t) ?? id;
  const kind = typeof fields.mime === 'string' ? fields.mime : type ?? 'record';
  return { id, title, type: kind, fields, sealed, price: /^\d+$/.test(String(price ?? '')) ? BigInt(price) : null, shareBps: Number(shareBps) || 0 };
}

/** A repo's records as listings, less its own (`@card`, `@deposit/…`). Null tip: no such repo. */
export async function readRepoPage(publisher, repo) {
  const { tip, contents } = await (await reader(publisher)).readRepo(publisher, repo);
  return { tip, records: contents.records.filter((r) => !r.id.startsWith('@')).map(toListing) };
}

// ── Apps ────────────────────────────────────────────────────────────────────

/**
 * Which of `publisher`'s repos are apps: repo → { card, name, site } for each repo whose
 * `@card` record binds an agent card (what westmarch-ship sets). A card that doesn't load
 * still marks the repo an app, with no name or site.
 */
export async function readApps(publisher, repos) {
  const fangorn = await reader(publisher);
  const found = await Promise.all(repos.map(async (repo) => {
    const card = await fangorn.cardOf(publisher, repo).catch(() => undefined);
    if (!card || !/^https?:\/\//.test(card)) return null;
    const json = await fetch(card, { signal: AbortSignal.timeout(10_000) }).then((r) => r.json()).catch(() => null);
    const site = typeof json?.url === 'string' && /^https?:\/\//.test(json.url) ? json.url : null;
    return [repo, { card, name: typeof json?.name === 'string' ? json.name : null, site }];
  }));
  return new Map(found.filter(Boolean));
}

// ── Files → records ─────────────────────────────────────────────────────────

/** A record id the SDK takes: printable ASCII, no spaces, at most 256 characters. */
export const recordId = (s) => String(s).replace(/[^\x21-\x7e]+/g, '-').slice(0, 256) || '-';

/** CSV text → rows of strings. Quoted fields may hold commas, newlines and "" escapes. */
export function parseCsv(text) {
  const rows = [[]];
  let field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { rows.at(-1).push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      rows.at(-1).push(field); field = ''; rows.push([]);
    } else field += c;
  }
  rows.at(-1).push(field);
  return rows.filter((r) => r.some((f) => f !== ''));
}

/**
 * A file's text → { records, columns }. JSON (an array of objects, or { records: [...] }),
 * JSON lines, or CSV with a header row. A row's `id` column is its record id when every
 * row has a distinct one; otherwise rows are numbered. Throws on anything else.
 */
export function parseRecords(text, filename = '') {
  let rows;
  const trimmed = text.trim();
  if (/\.csv$/i.test(filename) || !/^[[{]/.test(trimmed)) {
    const [header, ...body] = parseCsv(trimmed);
    if (!header || !body.length) throw new Error('The CSV needs a header row and at least one row.');
    rows = body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])));
  } else {
    try {
      const json = JSON.parse(trimmed);
      rows = Array.isArray(json) ? json : json.records;
    } catch {
      rows = trimmed.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
    }
    // A CLI commit file's records carry their row under `payload`.
    rows = rows?.map((r) => (r && typeof r.payload === 'object' && r.type ? { id: r.id, ...r.payload } : r));
  }
  if (!Array.isArray(rows) || !rows.length || rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r))) {
    throw new Error('Expected a list of rows: a JSON array of objects, JSON lines, or a CSV with a header.');
  }
  const ids = rows.map((r) => (r.id == null || r.id === '' ? '' : recordId(r.id)));
  const keep = ids.every(Boolean) && new Set(ids).size === ids.length;
  const records = rows.map((r, i) => ({ id: keep ? ids[i] : String(i + 1), type: 'record', payload: r }));
  const columns = [...new Set(rows.flatMap(Object.keys))].filter((c) => c !== 'id');
  return { records, columns };
}

/** Files that read as rows: each row is its own record. Anything else is one record per file. */
const TABULAR = /\.(csv|json|jsonl|ndjson)$/i;
/** ponytail: a file is read whole into memory (a paid one as base64 too). Stream past this. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * Picked files → { records, columns }. A CSV or JSON file of rows becomes one record a row;
 * any other file (or one that doesn't parse as rows) one record of
 * { title, mime, size, file }, `file` holding the File until publishRecords uploads it.
 * With several files, row ids are prefixed by their file's name so they can't collide.
 */
export async function readFiles(files) {
  const records = [];
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) throw new Error(`${f.name} is over ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
    let rows = null;
    if (TABULAR.test(f.name)) {
      try { rows = parseRecords(await f.text(), f.name).records; } catch { /* not rows: publish the file itself */ }
    }
    if (rows) records.push(...(files.length > 1 ? rows.map((r) => ({ ...r, id: recordId(`${f.name}/${r.id}`) })) : rows));
    else records.push({ id: recordId(f.name), type: 'file', payload: { title: f.name, mime: f.type || 'application/octet-stream', size: f.size, file: f } });
  }
  const ids = new Set(records.map((r) => r.id));
  if (ids.size !== records.length) throw new Error('Two files share a name (spaces and accents count as dashes). Rename one.');
  const columns = [...new Set(records.flatMap((r) => Object.keys(r.payload)))].filter((c) => c !== 'id');
  return { records, columns };
}

/** A file as a data: URL, which survives being sealed as JSON and opens as the file. */
export async function toDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

// ── Publishing ──────────────────────────────────────────────────────────────

/**
 * Publish `records` into `repo` (made if new) as `walletClient`'s account, sealing the
 * `paid` columns at `price` USDC a record. `onStep` hears each stage. Each sealed value
 * is its own upload and each paid record its own signed terms: the wallet signs for each.
 */
export async function publishRecords(walletClient, { repo, records, paid = [], price }, onStep = () => {}) {
  // The SDK root pulls the graph engine and ZK WASM: load it on the first publish only.
  const [{ Fangorn }, { sealRecords }] = await Promise.all([
    import('@fangorn-network/sdk/lib/fangorn.js'),
    import('@fangorn-network/sdk/lib/cli/sell.js'),
  ]);
  const fangorn = Fangorn.create({ walletClient, config: NETWORK, storage: { signedUrl: {} } });
  // Files: a paid one goes in as a data: URL and is sealed with the rest; a free one is
  // pinned as itself and the record links to it.
  let out = [];
  for (const r of records) {
    const payload = { ...r.payload };
    for (const [k, v] of Object.entries(payload)) {
      if (!(v instanceof Blob)) continue;
      if (paid.includes(k)) payload[k] = await toDataUrl(v);
      else {
        onStep(`Uploading ${v.name ?? r.id}…`);
        payload[k] = `${NETWORK.ipfsGateway}/ipfs/${await fangorn.getStorage().putFile(new Uint8Array(await v.arrayBuffer()), v.name ?? r.id)}`;
      }
    }
    out.push({ ...r, payload });
  }
  // After the uploads: a file the storage refuses mustn't leave an empty repo on chain.
  onStep('Creating the repo on chain…');
  await fangorn.initRepo(repo);
  if (paid.length) {
    onStep(`Sealing ${paid.join(', ')} in ${records.length} records…`);
    out = await sealRecords(fangorn, repo, out, {
      fields: paid,
      price: parseUnits(String(price), 6),
      shareBps: 0, // no referrer cut: the publisher gets the whole price
      deadline: BigInt(Math.floor(Date.now() / 1000) + TERMS_DAYS * 86400),
      keyServer: KEY_SERVER,
    });
  }
  onStep('Committing the records on chain…');
  const { txHash } = await fangorn.uploadBatch(repo, out);
  return { txHash };
}

/**
 * The publisher's repos, earnings and the explorer's view of them, plus `publish`.
 * `repos` is null while loading: [{ repo, listing }], listing null until the explorer
 * has indexed it. `earnings` is { total, sales }, null loading, { error } failed.
 */
export function usePublisher(address) {
  const { wallet } = useAuth();
  const [repos, setRepos] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => { listings = null; setTick((n) => n + 1); }, []);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    Promise.all([readRepos(address), readListings()])
      .then(([rs, l]) => {
        if (cancelled) return;
        setRepos(rs.map((r) => ({ ...r, listing: l.get(`${address.toLowerCase()}/${r.repo}`) ?? null, app: null })));
        setError(null);
        // Apps come after: each is a read from IPFS, and the list shouldn't wait on them.
        const patch = (repo, p) => !cancelled && setRepos((cur) => cur.map((r) => (r.repo === repo ? { ...r, ...p } : r)));
        return readApps(address, rs.map((r) => r.repo)).then((apps) => {
          for (const [repo, app] of apps) patch(repo, { app });
        }, (err) => console.warn('App lookup failed:', err));
      })
      .catch((err) => { if (!cancelled) { setError(err.shortMessage ?? err.message); setRepos([]); } });
    readEarnings(address)
      .then((e) => !cancelled && setEarnings(e))
      .catch((err) => { console.warn('Earnings lookup failed:', err); if (!cancelled) setEarnings({ error: true }); });
    return () => { cancelled = true; };
  }, [address, tick]);

  const publish = useCallback(async (job, onStep) => {
    if (!wallet || !address) throw new Error('Connect a wallet first.');
    const out = await publishRecords(await walletClientFor(wallet, address), job, onStep);
    refresh();
    return out;
  }, [wallet, address, refresh]);

  return { repos, earnings, error, publish, refresh };
}
