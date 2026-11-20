// The account hub's data: a publisher's repos, whether Fangorn lists them, what
// they've earned, and publishing a file as a repo from the browser.
//
// A publisher is a wallet, the same one in the browser and in the CLI (the user
// exports the Privy key into `fangorn init`).
import { useCallback, useEffect, useState } from 'react';
import { createWalletClient, formatLog, http, numberToHex, pad, parseAbi, parseAbiItem, parseEventLogs, parseUnits, toEventSelector } from 'viem';
import { getLogsInWindows } from '@fangorn-network/sdk/lib/contracts/logs.js';
import { repoId, UPDATED_V0 } from '@fangorn-network/sdk/lib/contracts/data-registry/index.js';
import { DATA_REGISTRY_ABI } from '@fangorn-network/sdk/lib/contracts/data-registry/abi.js';
import { recordKey, subjectOf } from '@fangorn-network/sdk/lib/contracts/settlement-registry/index.js';
import { NETWORK, NETWORKS, DEFAULT_NET, isNet, clientOf, publicClient, walletClientFor } from './fangorn.js';
import { useAuth } from './authContext.js';

/** Where people find everything published: this site's registry page (worker/registry.js behind it). */
export const EXPLORE_URL = '#/explore';

/** Days a record's signed terms stay buyable (the CLI's default). */
const TERMS_DAYS = 365;
/** Fangorn's key server: a buyer's key comes from here once their purchase settles. */
const KEY_SERVER = 'https://keys-test.fangorn.network';

// Both versions of the DataRegistry's Updated event: it was upgraded in place, so entries from
// before the upgrade carry the old one (no index or timestamp).
const UPDATED = [UPDATED_V0, DATA_REGISTRY_ABI.find((i) => i.type === 'event' && i.name === 'Updated')];
const UPDATED_TOPICS = UPDATED.map((e) => toEventSelector(e));
const REGISTERED = parseAbiItem('event Registered(bytes32 indexed subject, address indexed publisher, address indexed referrer, uint256 commitment, uint256 price, uint256 referrer_cut)');

// Log scans resume where the last one stopped. Each browser keeps the logs a scan found and the
// block it reached, so a reload asks the chain only for the blocks since: a scan from a deploy block
// is ~150 eth_getLogs on testnet, and the public RPC rate-limits a page that runs a few on every load.
// ponytail: per browser, in localStorage (a scan that won't fit just runs again); an indexer is the upgrade.
const REREAD = 300n; // the last minute of blocks is read again, in case the chain reorganised it
const trim = (l) => ({ blockNumber: l.blockNumber, args: l.args }); // all any caller reads
const tag = (_, v) => (typeof v === 'bigint' ? { $n: v.toString() } : v);
const untag = (_, v) => (v && typeof v === 'object' && typeof v.$n === 'string' && Object.keys(v).length === 1 ? BigInt(v.$n) : v);

/** Every log `fetchWindow` finds on `net` since its deploy block, resuming the last scan under `key`. */
async function resumable(key, net, fetchWindow) {
  const store = `fangorn-logs:v1:${net}:${key}`;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(store) ?? 'null', untag); } catch { /* none kept, or no storage */ }
  const { fromBlock, logWindow } = NETWORKS[net];
  const head = await clientOf(net).getBlockNumber();
  const from = saved && saved.to - REREAD > fromBlock ? saved.to - REREAD : fromBlock;
  const fresh = (await getLogsInWindows(clientOf(net), from, head, fetchWindow, logWindow)).map(trim);
  const logs = [...(saved?.logs ?? []).filter((l) => l.blockNumber < from), ...fresh];
  try { localStorage.setItem(store, JSON.stringify({ to: head, logs }, tag)); } catch { /* full or blocked */ }
  return logs;
}

/** `event` logs from `address` on `net`, narrowed by `args`: [{ blockNumber, args }]. */
export const scan = (address, event, args, net = DEFAULT_NET) =>
  resumable(`${address}:${event.name}:${JSON.stringify(args ?? {}, tag)}`, net, (fromBlock, toBlock) =>
    clientOf(net).getLogs({ address, event, args, fromBlock, toBlock }));

/**
 * One window of `publisher`'s Updated logs on `net`, both versions, decoded. One eth_getLogs matching
 * either version's topic: a query per version would double the calls, and the public RPC rate-limits
 * a burst (the SDK's ChainRegistry.log also reads a block per old entry, all at once).
 */
const updatesIn = (publisher, net) => async (fromBlock, toBlock) => decodeUpdates(await clientOf(net).request({ method: 'eth_getLogs', params: [{
  address: NETWORKS[net].dataRegistryContractAddress,
  topics: [UPDATED_TOPICS, pad(publisher.toLowerCase())],
  fromBlock: numberToHex(fromBlock),
  toBlock: numberToHex(toBlock),
}] }));
/** Raw eth_getLogs Updated logs of either version → viem logs with `args`. Pure, so the self-check drives it. */
export const decodeUpdates = (raw) => parseEventLogs({ abi: UPDATED, logs: raw.map(formatLog) });

/** Fangorn's registry (this site's /api/repos → registry-sepolia), as it answers, or null when it doesn't. */
const registry = (params) => fetch(`/api/repos?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(10_000) })
  .then((r) => (r.ok ? r.json() : null)).catch(() => null);
const listingOf = (r) => ({ name: r.name, description: r.description, publisher: r.publisher, repo: r.repo, head: r.head, card: r.card_url, updated: r.updated });

/**
 * The publisher's repos on `nets`, newest update first: [{ repo, net, head, updated, listing }],
 * `updated` unix seconds. On testnet the registry lists them (`listing`), and the chain's last
 * window adds what it hasn't listed yet: it runs a minute behind. Elsewhere, or when the registry
 * doesn't answer, a (resumable) scan of the chain; `listing` is undefined where nothing lists.
 * Testnet failing is the caller's error; another network failing leaves its repos out, with a warning.
 */
export async function readRepos(publisher, nets = Object.keys(NETWORKS)) {
  const found = await Promise.all(nets.map(async (net) => {
    try {
      const listed = net === DEFAULT_NET && await registry({ publisher, k: '1000' });
      const head = await clientOf(net).getBlock();
      const at = (l) => (l.args.timestamp != null ? Number(l.args.timestamp) : blockTime(head, l.blockNumber));
      const rows = new Map();
      let logs;
      if (listed) {
        for (const r of listed.repos.filter((r) => r.publisher.toLowerCase() === publisher.toLowerCase())) {
          rows.set(r.repo, { repo: r.repo, net, head: r.head, updated: Date.parse(r.updated) / 1000, listing: listingOf(r) });
        }
        const { fromBlock, logWindow } = NETWORKS[net];
        const from = head.number - logWindow + 1n > fromBlock ? head.number - logWindow + 1n : fromBlock;
        logs = await updatesIn(publisher, net)(from, head.number);
      } else {
        logs = await resumable(`${publisher.toLowerCase()}:Updated`, net, updatesIn(publisher, net));
      }
      for (const l of logs) {
        const was = rows.get(l.args.repo);
        rows.set(l.args.repo, { repo: l.args.repo, net, head: l.args.head, updated: at(l), listing: listed ? was?.listing ?? null : undefined });
      }
      return [...rows.values()];
    } catch (err) {
      if (net === DEFAULT_NET) throw err;
      console.warn(`Reading repos on ${net} failed:`, err);
      return [];
    }
  }));
  return found.flat().sort((a, b) => b.updated - a.updated);
}

/**
 * Sales of the publisher's records: { total, sales }, total in USDC base units, net of
 * the referrer's cut. Every purchase registers a buyer in the SettlementRegistry,
 * which pays the publisher in the same tx, so its log is the ledger.
 */
export function sumSales(logs) {
  return { total: logs.reduce((s, l) => s + l.args.price - l.args.referrer_cut, 0n), sales: logs.filter((l) => l.args.price > 0n).length };
}

/** Base (both chains) makes a block every 0.2s, so a block's time is the head's less 0.2s a block. */
// ponytail: an estimate, right for every block since the registries were deployed; read block timestamps if the rate changes again.
const BLOCK_SECONDS = 0.2;
const WEEK = 7 * 86400;
/** A block's unix time, from the chain head: { number, timestamp } as viem's getBlock gives them. */
export const blockTime = (head, block) => Math.round(Number(head.timestamp) - Number(head.number - block) * BLOCK_SECONDS);

/**
 * A publisher's sale logs → { total, sales, weekly }: weekly is net earnings over the last
 * `weeks` weeks, oldest first. Pure, so the self-check drives it.
 */
export function salesStats(logs, head, weeks = 12) {
  // Plain numbers (USDC base units, well inside 2^53), not bigints: React's dev build JSON-stringifies
  // an array of primitives it finds in props to log renders, throws on a bigint, and wedges itself.
  const weekly = Array(weeks).fill(0);
  for (const l of logs) {
    const ago = Math.floor((Number(head.timestamp) - blockTime(head, l.blockNumber)) / WEEK);
    if (ago < weeks) weekly[weeks - 1 - ago] += Number(l.args.price - l.args.referrer_cut);
  }
  return { ...sumSales(logs), weekly };
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
 * Fangorn's registry (this site's /api/repos), as a map `<publisher lowercased>/<repo>` →
 * { name, description, publisher, repo, card, updated }. `q` ranks by meaning; `publisher` narrows.
 * Empty when it doesn't answer.
 */
export async function readListings({ q, publisher, k = 100 } = {}) {
  const out = await registry({ k: String(k), ...(q ? { q } : {}), ...(publisher ? { publisher } : {}) });
  return new Map((out?.repos ?? []).map((r) => [`${r.publisher}/${r.repo}`, listingOf(r)]));
}

// One read per page load, for the landing page.
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

/** A Fangorn client on `net` that only reads. Loaded on use: the SDK root pulls the engine and ZK WASM. */
export async function reader(publisher, net = DEFAULT_NET) {
  const { Fangorn } = await import('@fangorn-network/sdk/lib/fangorn.js');
  const config = NETWORKS[net];
  // The wallet client is never asked to sign.
  const walletClient = createWalletClient({ account: publisher, chain: config.chain, transport: http(config.rpcUrl) });
  // The engine wants storage even to read; reads go through the gateway and never upload
  // (on a network with no upload worker, an upload would be refused).
  return Fangorn.create({ walletClient, config, storage: { signedUrl: {} } });
}

// ── A repo's page ───────────────────────────────────────────────────────────

/** One repo's public page, as a hash route: #/data/<net>/<publisher>/<repo>. */
export const repoHref = (publisher, repo, net = DEFAULT_NET) => `#/data/${net}/${publisher}/${encodeURIComponent(repo)}`;
/** The page a publisher shares for one repo, on this site. */
export const repoLink = (publisher, repo, net) => `${location.origin}${location.pathname}${repoHref(publisher, repo, net)}`;

/**
 * A #/data/… hash → { net, publisher, repo }. Links made before repos had a network
 * (#/data/<publisher>/<repo>) are testnet ones.
 */
export function parseRepoHash(hash) {
  const parts = hash.replace(/^#\/data\//, '').split('/');
  const net = isNet(parts[0]) ? parts.shift() : DEFAULT_NET;
  return { net, publisher: parts[0] ?? '', repo: decodeURIComponent(parts.slice(1).join('/')) };
}

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
export async function readRepoPage(publisher, repo, net = DEFAULT_NET) {
  const { tip, contents } = await (await reader(publisher, net)).readRepo(publisher, repo);
  return { tip, records: contents.records.filter((r) => !r.id.startsWith('@')).map(toListing) };
}

// ── Apps ────────────────────────────────────────────────────────────────────

/**
 * Which of `publisher`'s repos on `net` are apps: repo → { card, name, site } for each repo whose
 * `@card` record binds an agent card (`setCard` / `registerAgent` in the SDK). A card that doesn't load
 * still marks the repo an app, with no name or site.
 */
export async function readApps(publisher, repos, net = DEFAULT_NET) {
  const fangorn = await reader(publisher, net);
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

// The SDK's FANGORN_REPO_EXTENSION, copied so the hub needn't load the SDK root for it.
// fangorn.test.mjs checks the global index (worker/registry.js) accepts what cardFor makes.
const REPO_EXTENSION = 'https://fangorn.network/a2a/repo/v1';

/**
 * A repo's card: what the global index searches besides the repo's name. Its extension
 * must name this publisher, repo and registry, or the index ignores the card.
 */
export function cardFor({ publisher, repo, description }) {
  return {
    name: repo,
    description,
    capabilities: { extensions: [{ uri: REPO_EXTENSION, params: {
      chainId: NETWORK.caip2, dataRegistry: NETWORK.dataRegistryContractAddress, publisher, repo,
    } }] },
  };
}

/**
 * Publish `records` into `repo` (made if new) as `walletClient`'s account, sealing the
 * `paid` columns at `price` USDC a record. `onStep` hears each stage. Each sealed value
 * is its own upload and each paid record its own signed terms: the wallet signs for each.
 * With a `description`, the repo's card goes in the same commit: its JSON to storage, and
 * the `@card` record pointing at it. No extra transaction.
 */
export async function publishRecords(walletClient, { repo, records, paid = [], price, description }, onStep = () => {}) {
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
  let cardRecord = null;
  if (description?.trim()) {
    onStep('Uploading the description…');
    const card = cardFor({ publisher: fangorn.getAddress(), repo, description: description.trim() });
    const cid = await fangorn.getStorage().putFile(new TextEncoder().encode(JSON.stringify(card)), `${repo}.card.json`);
    cardRecord = { id: '@card', type: 'card', payload: { url: `${NETWORK.ipfsGateway}/ipfs/${cid}` } };
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
  if (cardRecord) out.push(cardRecord); // after sealing: the card is never sold
  onStep('Committing the records on chain…');
  const { txHash } = await fangorn.uploadBatch(repo, out);
  return { txHash };
}

/**
 * The publisher's repos on every network, earnings and Fangorn's listing of them, plus `publish`.
 * `repos` is null while loading: [{ repo, net, updated, listing }], listing null until Fangorn
 * lists it (a minute or two), undefined on a network Fangorn doesn't index yet (mainnet).
 * `earnings` is { total, sales }, null loading, { error } failed. Publishing is testnet only.
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
    const key = (r) => `${r.net}/${r.repo}`;
    // Apps come after the list: each is a read from IPFS. Each repo is looked up once.
    const looked = new Set();
    const patch = (net, repo, p) => !cancelled && setRepos((cur) => cur?.map((r) => (r.net === net && r.repo === repo ? { ...r, ...p } : r)));
    const lookupApps = (rs) => Promise.all(Object.keys(NETWORKS).map((net) => {
      const todo = rs.filter((r) => r.net === net && !looked.has(key(r))).map((r) => r.repo);
      for (const repo of todo) looked.add(`${net}/${repo}`);
      return todo.length && readApps(address, todo, net).then((apps) => {
        for (const [repo, app] of apps) patch(net, repo, { app });
      });
    })).catch((err) => console.warn('App lookup failed:', err));

    readRepos(address)
      .then((rs) => {
        if (cancelled) return;
        setRepos((cur) => {
          const prev = new Map((cur ?? []).map((r) => [key(r), r]));
          return rs.map((r) => ({ ...r, app: prev.get(key(r))?.app ?? null }));
        });
        setError(null);
        lookupApps(rs);
      })
      .catch((err) => { if (!cancelled) { setError(err.shortMessage ?? err.message); setRepos((cur) => cur ?? []); } });
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
