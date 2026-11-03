// The account hub's data: which apps this wallet owns, what each has earned, and the
// writes that create and manage them.
//
// A publisher is a wallet, the same one in the browser and in the CLI (the user
// exports the Privy key into `fangorn init`). It publishes without an app; an app is
// a free name for a curator repo, paid through its payout address.
import { useCallback, useEffect, useState } from 'react';
import { parseAbiItem, parseEventLogs } from 'viem';
import { getLogsInWindows } from '@fangorn-network/sdk/lib/contracts/logs.js';
import { AppRegistryClient } from '@fangorn-network/sdk/lib/contracts/app-registry/index.js';
import { toAppId } from '@fangorn-network/sdk/lib/config.js';
import { APP_REGISTRY_ADDRESS, NETWORK, USDC_ADDRESS, publicClient, walletClientFor } from './fangorn.js';
import { useAuth } from './authContext.js';

/** The SDK's FANGORN_APP_EXTENSION — where a card says what its records cost. */
const APP_EXTENSION = 'https://fangorn.network/a2a/app/v1';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const ERC20_TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

const reader = (appId) => new AppRegistryClient(APP_REGISTRY_ADDRESS, appId, publicClient, publicClient, NETWORK.logWindow);

// An app id is keccak of its name and nothing on chain stores the name, so the hub
// remembers the names this browser created. Anywhere else the card's name, or the
// short id, stands in.
// ponytail: per-browser only. Put the name in the agent card if it has to travel.
const NAMES_KEY = 'fangorn.appNames';
function rememberName(appId, name) {
  try {
    const names = JSON.parse(localStorage.getItem(NAMES_KEY) ?? '{}');
    localStorage.setItem(NAMES_KEY, JSON.stringify({ ...names, [appId.toLowerCase()]: name }));
  } catch { /* storage blocked: the card or the id still labels it */ }
}
function rememberedName(appId) {
  try {
    return JSON.parse(localStorage.getItem(NAMES_KEY) ?? '{}')[appId.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

// A card someone else wrote, so only what we render is read, and only http(s)
// URLs survive — a `javascript:` url must never reach an href.
//
// `listed` is the explorer's test (the SDK's discoverApp): the card loads, carries
// the app extension, and names THIS app. The binding half of that test — the chain
// points at this card — holds by construction, since the uri came from the chain.
function readCard(card, appId) {
  const ext = card?.capabilities?.extensions?.find((e) => e.uri === APP_EXTENSION);
  const listed = typeof ext?.params?.appId === 'string' && ext.params.appId.toLowerCase() === appId.toLowerCase();
  if (!listed) return { listed: false };
  const price = ext.params.paid?.price;
  const pass = ext.params.access?.pass;
  const str = (v) => (typeof v === 'string' ? v : null);
  return {
    listed,
    cardName: str(card.name),
    description: str(card.description),
    // The skills' tags, less the ones every westmarch app carries.
    tags: [...new Set((card.skills ?? []).flatMap((s) => s.tags ?? []).filter((t) => typeof t === 'string'))]
      .filter((t) => !['webmcp', 'test'].includes(t)).slice(0, 3),
    site: /^https?:\/\//.test(card.url ?? '') ? card.url : null,
    price: /^\d+$/.test(String(price ?? '')) ? BigInt(price) : null, // USDC base units
    // A westmarch access pass: `pass` USDC base units buys `days` of reads.
    pass: /^\d+$/.test(String(pass ?? '')) ? { price: BigInt(pass), days: Number(ext.params.access.days) || null } : null,
  };
}

// A record sale: x402 settles as an EIP-3009 transferWithAuthorization from the buyer,
// which USDC marks with AuthorizationUsed(buyer).
// ponytail: wallet-wide sales only; split per record and referral once the
// SettlementRegistry is deployed.
const AUTH_USED = parseAbiItem('event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)');

const same = (a, b) => a?.toLowerCase() === b?.toLowerCase();

/**
 * The x402 record sales among USDC transfers into `owner`, given each tx's receipt
 * logs (`logsByTx`: tx hash → logs). Pure, so the self-check drives it.
 * Anything else (faucet drips, funding, gifts, the owner's own sends) isn't earnings.
 */
export function classifyEarnings(transfers, logsByTx, owner) {
  let total = 0n;
  for (const t of transfers) {
    const { from, value } = t.args;
    if (same(from, owner)) continue;
    const events = parseEventLogs({ abi: [AUTH_USED], logs: logsByTx.get(t.transactionHash) ?? [], strict: false });
    if (events.some((e) => same(e.address, USDC_ADDRESS) && same(e.args.authorizer, from))) total += value;
  }
  return { total };
}

/**
 * What `address` has earned from record sales: { total } (USDC base units).
 * ponytail: one receipt per incoming tx, every load. Fine for a testnet wallet; past
 * a few hundred payments, index it (the explorer, or a subgraph).
 */
export async function readEarnings(address) {
  // From the AppRegistry's deploy: nothing before it can be an app sale, and from
  // genesis would be thousands of windows on Base's 10k-block getLogs cap.
  const transfers = await getLogsInWindows(publicClient, NETWORK.appRegistryFromBlock, undefined, (fromBlock, toBlock) =>
    publicClient.getLogs({ address: USDC_ADDRESS, event: ERC20_TRANSFER, args: { to: address }, fromBlock, toBlock }),
  NETWORK.logWindow);
  const hashes = [...new Set(transfers.filter((t) => !same(t.args.from, address)).map((t) => t.transactionHash))];
  const receipts = await Promise.all(hashes.map((hash) => publicClient.getTransactionReceipt({ hash })));
  return classifyEarnings(transfers, new Map(receipts.map((r) => [r.transactionHash, r.logs])), address);
}

/**
 * One app's state, as the hub shows it. A read that fails is `null` — unknown — and
 * never a default that means something: `''` reads as "no agent card", and a
 * refused RPC call must not tell an owner their live app is undeployed.
 */
async function readApp(appId) {
  const reg = reader(appId);
  const [owner, uri, suspended, curator, payout] = await Promise.all([
    reg.getAppOwner(),
    reg.appAgentUri().catch(() => null),
    reg.isAppSuspended().catch(() => false),
    reg.curatorOf().catch(() => null),
    reg.payoutOf().catch(() => null),
  ]);
  const card = uri
    ? await fetch(uri, { signal: AbortSignal.timeout(10_000) }).then((r) => r.json()).catch(() => null)
    : null;
  const info = readCard(card, appId);
  return {
    appId, owner, uri, suspended, curator, payout, ...info,
    name: rememberedName(appId) ?? info.cardName ?? null,
  };
}

/**
 * Apps `address` owns, newest first:
 *   { appId, owner, name, uri, listed, site, price, suspended, curator: { curator, repo }, payout }
 * (`uri`, `curator` and `payout` are null when their read failed).
 *
 * The AppRegistry lists each owner's apps (`appsOf`), so this sees an app the moment
 * it's claimed, before it has a card or a commit.
 *
 * `listed: false` is an app the explorer won't show: no card bound yet, or one that
 * doesn't load or doesn't name the app.
 */
export async function readOwnedApps(address) {
  const ids = await reader(undefined).appsOf(address);
  return Promise.all([...ids].reverse().map(readApp));
}

/**
 * Every app the network shows: claimed (the AppRegistry's list), with a card that
 * names it, and not taken down. The landing page's live grid, newest first.
 * ponytail: reads every app's card on each visit. Fine for dozens; past that, page
 * it or let the explorer index.
 */
export async function readAllApps() {
  const ids = await reader(undefined).allApps();
  const apps = await Promise.all([...ids].reverse().map(readApp));
  return apps.filter((a) => a.listed && !a.suspended);
}

/** readAllApps as state: null while loading, [] on failure (logged). */
// One read per page load, shared by the landing page and #/explorer: navigating
// between them must not rescan the registry.
let allApps = null;
export function useAllApps() {
  const [apps, setApps] = useState(null);
  useEffect(() => {
    allApps ??= readAllApps().catch((err) => { console.warn('App registry read failed:', err); allApps = null; return []; });
    let cancelled = false;
    allApps.then((a) => !cancelled && setApps(a));
    return () => { cancelled = true; };
  }, []);
  return apps;
}

/** Who owns `name` already, or null if it's free to claim. */
export async function readAppOwner(name) {
  const owner = await reader(toAppId(name)).getAppOwner();
  return owner === ZERO_ADDRESS ? null : owner;
}

// ── One app's activity ────────────────────────────────────────────────────────
// What an owner can see of their app without touching its Worker: records and
// freshness from the catalog the Worker already serves in public.

/**
 * The app's catalog, or null if it has no site or the catalog didn't load:
 *   { indexedAt (unix secs), collections: [{ name, description, count, bytes, hosts }] }
 */
export async function readActivity(app) {
  if (!app.site) return null;
  return fetch(new URL('/view/cdn/catalog', app.site), { signal: AbortSignal.timeout(10_000) })
    .then((r) => (r.ok ? r.json() : null))
    .then((c) => c && {
      indexedAt: Number(c.generated_at) || null,
      collections: (c.domains ?? []).map((d) => ({
        // Domains are named `<publisher>-<repo>-<name>` with short hex ids in front.
        name: String(d.name ?? '').replace(/^([0-9a-f]{8}-){2}/, ''),
        description: typeof d.description === 'string' ? d.description : null,
        count: Number(d.count) || 0,
        bytes: Number(d.bytes) || 0,
        hosts: (d.link_hosts ?? []).filter((h) => typeof h === 'string'),
      })),
    })
    .catch(() => null);
}

/** readActivity as state: undefined while loading, null when there's no catalog. */
export function useActivity(app) {
  const [activity, setActivity] = useState(undefined);
  useEffect(() => {
    let cancelled = false;
    readActivity(app).then((a) => !cancelled && setActivity(a));
    return () => { cancelled = true; };
  }, [app]);
  return activity;
}

/**
 * The hub's apps, earnings, and app writes. `apps` is null while loading.
 *
 *   create({ name, cardUrl? }) – claim the app (free), then bind its agent card if given
 *   setCard(appId, url, { register }) – point the app at its agent card; `register`
 *       first mints the app's ERC-8004 agent from it (the first binding)
 *   setRepo(appId, repo)       – point the app at the owner's repo of citations
 *   setPayout(appId, address)  – where the app's referral share is paid
 *
 * `earnings` is readEarnings' { total }, null while loading, { error: true } if the
 * scan failed.
 */
export function useOwnedApps(address) {
  const { wallet } = useAuth();
  const [apps, setApps] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    readOwnedApps(address)
      .then((a) => { if (!cancelled) { setApps(a); setError(null); } })
      .catch((err) => { if (!cancelled) { setError(err.message); setApps([]); } });
    readEarnings(address)
      .then((e) => !cancelled && setEarnings(e))
      .catch((err) => { console.warn('Earnings lookup failed:', err); if (!cancelled) setEarnings({ error: true }); });
    return () => { cancelled = true; };
  }, [address, tick]);

  // A Fangorn client for one app, signing with the Privy wallet. Its signed-URL storage
  // is charged to the wallet's quota, so registering an agent pins its file with no
  // Pinata JWT. Loaded on the first write: the SDK root pulls the graph engine and the
  // ZK WASM, which the hub's reads never need.
  const writer = useCallback(async (appId) => {
    if (!wallet || !address) throw new Error('Connect a wallet first.');
    const [walletClient, { Fangorn }] = await Promise.all([
      walletClientFor(wallet, address),
      import('@fangorn-network/sdk/lib/fangorn.js'),
    ]);
    return Fangorn.create({ walletClient, config: NETWORK, appId, storage: { signedUrl: {} } });
  }, [wallet, address]);

  const create = useCallback(async ({ name, cardUrl }) => {
    const appId = toAppId(name);
    const reg = (await writer(appId)).getAppRegistry();
    const owner = await reg.getAppOwner();
    if (owner !== ZERO_ADDRESS) {
      throw new Error(owner.toLowerCase() === address.toLowerCase()
        ? 'You already own this app.'
        : 'That name is taken. Pick another.');
    }
    await reg.registerApp();
    rememberName(appId, name);
    // Its own tx, so a failure leaves a claimed app the app page can finish.
    if (cardUrl) await reg.setAppAgentUri(cardUrl);
    refresh();
    return appId;
  }, [writer, address, refresh]);

  const setCard = useCallback(async (appId, url, { register = false } = {}) => {
    await (await writer(appId)).registerAgent(url, { skipRegister: !register });
    refresh();
  }, [writer, refresh]);

  const setRepo = useCallback(async (appId, repo) => {
    await (await writer(appId)).getAppRegistry().setCurator(address, repo);
    refresh();
  }, [writer, address, refresh]);

  const setPayout = useCallback(async (appId, payout) => {
    await (await writer(appId)).getAppRegistry().setPayout(payout);
    refresh();
  }, [writer, refresh]);

  return { apps, earnings, error, create, setCard, setRepo, setPayout };
}

/** A Worker's URL, or its card's, as the card's URL. */
export const cardUrlOf = (value) => (/\/agent-card\.json$/.test(value) ? value : `${value.replace(/\/+$/, '')}/.well-known/agent-card.json`);

/** True when `value` reads as an http(s) URL — what an agent card URI has to be. */
export const isCardUrl = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
