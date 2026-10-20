// The account hub's data: which apps this wallet owns, what each has earned, and the
// writes that create and manage them.
//
// An app owner is its app's single publisher, and it's the same wallet in the
// browser and in the CLI (the user exports the Privy key into `fangorn init`).
//
// Since SDK 2026.10.20 the storage subscription belongs to the app, not the wallet:
// claiming an app (AppRegistry.registerApp) pays its first period and mints the app's
// ERC-5643 token to the owner, and renewing extends it.
import { useCallback, useEffect, useState } from 'react';
import { parseAbiItem, toHex } from 'viem';
import { getLogsInWindows } from '@fangorn-network/sdk/lib/contracts/logs.js';
import { AppRegistryClient } from '@fangorn-network/sdk/lib/contracts/app-registry/index.js';
import { MembershipRegistryClient } from '@fangorn-network/sdk/lib/contracts/membership-registry/index.js';
import { toAppId } from '@fangorn-network/sdk/lib/config.js';
import {
  APP_REGISTRY_ADDRESS, MEMBERSHIP_REGISTRY_ADDRESS, NETWORK, USDC_ADDRESS,
  publicClient, walletClientFor,
} from './fangorn.js';
import { useAuth } from './authContext.js';

/** The SDK's FANGORN_APP_EXTENSION — where a card says what its records cost. */
const APP_EXTENSION = 'https://fangorn.network/a2a/app/v1';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// ERC-721 Transfer — the same signature for USDC's ERC-20 one; the contract address
// tells them apart. An app's token id IS its app id.
const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)');
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

/**
 * USDC paid in to an address: x402 sales settle as plain USDC transfers to the
 * app owner. Transfers from `exclude` (the owner itself)
 * aren't sales and are left out.
 * ponytail: every transfer from anyone else counts as a sale. If owners start
 * receiving USDC for other reasons, match on the facilitator's
 * transferWithAuthorization instead.
 */
export async function readReceived(address, exclude) {
  const skip = new Set(exclude.map((a) => a.toLowerCase()));
  // From the AppRegistry's deploy: nothing before it can be an app sale, and from
  // genesis would be thousands of windows on Base's 10k-block getLogs cap.
  const logs = await getLogsInWindows(publicClient, NETWORK.appRegistryFromBlock, undefined, (fromBlock, toBlock) =>
    publicClient.getLogs({ address: USDC_ADDRESS, event: ERC20_TRANSFER, args: { to: address }, fromBlock, toBlock }),
  NETWORK.logWindow);
  return logs
    .filter((l) => !skip.has(l.args.from.toLowerCase()))
    .reduce((sum, l) => sum + l.args.value, 0n);
}

/** One app's state, as the hub shows it. */
async function readApp(appId) {
  const reg = reader(appId);
  const [owner, uri, suspended, expiresAt, renewable] = await Promise.all([
    reg.getAppOwner(),
    reg.appAgentUri().catch(() => ''),
    reg.isAppSuspended().catch(() => false),
    reg.expiresAt().catch(() => 0n),
    reg.isRenewable().catch(() => false),
  ]);
  const card = uri
    ? await fetch(uri, { signal: AbortSignal.timeout(10_000) }).then((r) => r.json()).catch(() => null)
    : null;
  const info = readCard(card, appId);
  return {
    appId, owner, uri, suspended, expiresAt, renewable, ...info,
    expired: expiresAt * 1000n <= BigInt(Date.now()),
    name: rememberedName(appId) ?? info.cardName ?? null,
  };
}

/**
 * Apps `address` owns, newest first:
 *   { appId, owner, name, uri, listed, site, price, suspended, expiresAt, expired, renewable }
 *
 * Found through the app tokens sent to the wallet: claiming mints one, so this sees
 * an app the moment it's claimed, before it has a card or a commit. A token sent on
 * since is filtered out by the getAppOwner check.
 *
 * `listed: false` is an app the explorer won't show: no card bound yet, or one that
 * doesn't load or doesn't name the app.
 */
export async function readOwnedApps(address) {
  const logs = await getLogsInWindows(publicClient, NETWORK.appRegistryFromBlock, undefined, (fromBlock, toBlock) =>
    publicClient.getLogs({ address: APP_REGISTRY_ADDRESS, event: TRANSFER, args: { to: address }, fromBlock, toBlock }),
  NETWORK.logWindow);
  const ids = [...new Set(logs.reverse().map((l) => toHex(l.args.tokenId, { size: 32 })))];
  const apps = await Promise.all(ids.map(readApp));
  return apps.filter((a) => a.owner.toLowerCase() === address.toLowerCase());
}

/**
 * Every app the network shows: claimed (a mint from the zero address), with a card
 * that names it, and paid up. The landing page's live grid, newest first.
 * ponytail: reads every app's card on each visit. Fine for dozens; past that, page
 * it or let the explorer index.
 */
export async function readAllApps() {
  const logs = await getLogsInWindows(publicClient, NETWORK.appRegistryFromBlock, undefined, (fromBlock, toBlock) =>
    publicClient.getLogs({ address: APP_REGISTRY_ADDRESS, event: TRANSFER, args: { from: ZERO_ADDRESS }, fromBlock, toBlock }),
  NETWORK.logWindow);
  const apps = await Promise.all(logs.reverse().map((l) => readApp(toHex(l.args.tokenId, { size: 32 }))));
  return apps.filter((a) => a.listed && !a.expired && !a.suspended);
}

/** readAllApps as state: null while loading, [] on failure (logged). */
export function useAllApps() {
  const [apps, setApps] = useState(null);
  useEffect(() => {
    readAllApps().then(setApps).catch((err) => { console.warn('App registry read failed:', err); setApps([]); });
  }, []);
  return apps;
}

/** Who owns `name` already, or null if it's free to claim. */
export async function readAppOwner(name) {
  const owner = await reader(toAppId(name)).getAppOwner();
  return owner === ZERO_ADDRESS ? null : owner;
}

// A month, in seconds — the membership period a reader price buys.
const MEMBERSHIP_PERIOD = 30n * 86400n;

/**
 * The hub's apps, earnings, and app writes. `apps` is null while loading.
 * `fee` (USDC base units) and `period` (seconds) are what claiming costs and buys.
 *
 *   create({ name, cardUrl?, price? }) – claim the app (pays the first period), then
 *       bind its agent card and set a reader price if given. Price is USDC base units.
 *   renew(appId)            – pay one more period
 *   setCard(appId, url)     – point the app at its agent card
 *
 * Earnings are per wallet, not per app: an x402 sale is a USDC transfer to the
 * owner, and the transfer doesn't say which app it paid for.
 */
export function useOwnedApps(address) {
  const { wallet } = useAuth();
  const [apps, setApps] = useState(null);
  const [received, setReceived] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  // What claiming costs and buys. Network-wide, so read once.
  const [terms, setTerms] = useState({ fee: null, period: null });

  useEffect(() => {
    const reg = reader(undefined);
    Promise.all([reg.subscriptionFee(), reg.subscriptionPeriod()])
      .then(([fee, period]) => setTerms({ fee, period }))
      .catch((err) => console.warn('Subscription terms lookup failed:', err));
  }, []);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    readOwnedApps(address)
      .then((a) => { if (!cancelled) { setApps(a); setError(null); } })
      .catch((err) => { if (!cancelled) { setError(err.message); setApps([]); } });
    readReceived(address, [address])
      .then((r) => !cancelled && setReceived(r))
      .catch((err) => console.warn('Earnings lookup failed:', err));
    return () => { cancelled = true; };
  }, [address, tick]);

  // A writer for one app, signing with the Privy wallet.
  const writer = useCallback(async (appId) => {
    if (!wallet || !address) throw new Error('Connect a wallet first.');
    const walletClient = await walletClientFor(wallet, address);
    return {
      apps: new AppRegistryClient(APP_REGISTRY_ADDRESS, appId, publicClient, walletClient, NETWORK.logWindow),
      members: new MembershipRegistryClient(MEMBERSHIP_REGISTRY_ADDRESS, publicClient, walletClient),
    };
  }, [wallet, address]);

  const create = useCallback(async ({ name, cardUrl, price }) => {
    const appId = toAppId(name);
    const { apps: reg, members } = await writer(appId);
    const owner = await reg.getAppOwner();
    if (owner !== ZERO_ADDRESS) {
      throw new Error(owner.toLowerCase() === address.toLowerCase()
        ? 'You already own this app.'
        : 'That name is taken. Pick another.');
    }
    // Approves the fee if there is one, claims, and waits for the receipt.
    await reg.registerApp();
    rememberName(appId, name);
    // The claim is the deploy; these are config on top. Each is its own tx, so a
    // failure here leaves a claimed app the card's manage actions can finish.
    if (cardUrl) await reg.setAppAgentUri(cardUrl);
    if (price) await members.setPlan(appId, price, MEMBERSHIP_PERIOD);
    refresh();
    return appId;
  }, [writer, address, refresh]);

  const renew = useCallback(async (appId) => {
    await (await writer(appId)).apps.renewSubscription();
    refresh();
  }, [writer, refresh]);

  const setCard = useCallback(async (appId, url) => {
    await (await writer(appId)).apps.setAppAgentUri(url);
    refresh();
  }, [writer, refresh]);

  return { apps, received, error, ...terms, create, renew, setCard };
}

/** True when `value` reads as an http(s) URL — what an agent card URI has to be. */
export const isCardUrl = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};
