// The account hub's data: which apps this wallet owns, and what each has earned.
//
// An app owner is its app's single publisher, and it's the same wallet in the
// browser and in the CLI (the user exports the Privy key into `fangorn init`).
import { useEffect, useState } from 'react';
import { parseAbiItem } from 'viem';
import { getLogsInWindows } from '@fangorn-network/sdk/lib/contracts/logs.js';
import { AppRegistryClient } from '@fangorn-network/sdk/lib/contracts/app-registry/index.js';
import { APP_REGISTRY_ADDRESS, USDC_ADDRESS, publicClient } from './fangorn.js';
import { readTimelines } from './directory.js';

/** The SDK's FANGORN_APP_EXTENSION — where a card says what its records cost. */
const APP_EXTENSION = 'https://fangorn.network/a2a/app/v1';

const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');

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
  return {
    listed,
    name: typeof card.name === 'string' ? card.name : null,
    site: /^https?:\/\//.test(card.url ?? '') ? card.url : null,
    price: /^\d+$/.test(String(price ?? '')) ? BigInt(price) : null, // USDC base units
  };
}

/**
 * USDC paid in to an address: x402 sales settle as plain USDC transfers to the
 * app owner. Transfers from `exclude` (the faucet, the owner itself)
 * aren't sales and are left out.
 * ponytail: every transfer from anyone else counts as a sale. If owners start
 * receiving USDC for other reasons, match on the facilitator's
 * transferWithAuthorization instead.
 */
export async function readReceived(address, exclude) {
  const skip = new Set(exclude.map((a) => a.toLowerCase()));
  // Windowed like the directory: the RPC caps one getLogs at 10M blocks (vite.config.js).
  const logs = await getLogsInWindows(publicClient, 0n, undefined, (fromBlock, toBlock) =>
    publicClient.getLogs({ address: USDC_ADDRESS, event: TRANSFER, args: { to: address }, fromBlock, toBlock }));
  return logs
    .filter((l) => !skip.has(l.args.from.toLowerCase()))
    .reduce((sum, l) => sum + l.args.value, 0n);
}

/**
 * Apps owned by any of `addresses`, newest activity first:
 *   { appId, owner, listed, name, site, price, suspended, namespaces, lastBlock }
 *
 * `listed: false` is an app that's claimed on chain but that the explorer won't
 * show: no card bound yet, or one that doesn't load (e.g. a test run's
 * 127.0.0.1 card) or doesn't name the app.
 *
 * Found through commits: an app shows up once its owner has published to it.
 * ponytail: a claimed app with no commits yet isn't listed. Scan AppRegistry's
 * claim events if that gap matters.
 */
export async function readOwnedApps(addresses) {
  const mine = new Set(addresses.map((a) => a.toLowerCase()));
  const byApp = new Map();
  for (const t of await readTimelines()) {
    if (!mine.has(t.owner.toLowerCase())) continue;
    const key = `${t.appId}:${t.owner.toLowerCase()}`;
    if (!byApp.has(key)) byApp.set(key, { appId: t.appId, owner: t.owner, namespaces: 0, lastBlock: t.blockNumber });
    byApp.get(key).namespaces += 1;
  }

  const apps = await Promise.all([...byApp.values()].map(async (app) => {
    const reg = new AppRegistryClient(APP_REGISTRY_ADDRESS, app.appId, publicClient, publicClient);
    const [owner, uri, suspended] = await Promise.all([
      reg.getAppOwner(),
      reg.appAgentUri().catch(() => ''),
      reg.isAppSuspended().catch(() => false),
    ]);
    // Publishing to someone else's app isn't owning it.
    if (owner.toLowerCase() !== app.owner.toLowerCase()) return null;
    const card = uri
      ? await fetch(uri, { signal: AbortSignal.timeout(10_000) }).then((r) => r.json()).catch(() => null)
      : null;
    return { ...app, ...readCard(card, app.appId), suspended };
  }));
  return apps.filter(Boolean);
}

// The testnet faucet's sender, so its drips (10 USDC on registering) aren't
// counted as earnings. Unset → drips show up in "Earned".
const FAUCET_ADDRESS = import.meta.env?.VITE_FAUCET_ADDRESS ?? null;

/**
 * The hub's apps and earnings. `apps` is null while loading.
 *
 * Earnings are per wallet, not per app: an x402 sale is a USDC transfer to the
 * owner, and the transfer doesn't say which app it paid for. So `received` is
 * one total across all of the wallet's apps.
 */
export function useOwnedApps(address) {
  const [apps, setApps] = useState(null);
  const [received, setReceived] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    readOwnedApps([address])
      .then((a) => !cancelled && setApps(a))
      .catch((err) => { if (!cancelled) { setError(err.message); setApps([]); } });
    readReceived(address, [address, FAUCET_ADDRESS].filter(Boolean))
      .then((r) => !cancelled && setReceived(r))
      .catch((err) => console.warn('Earnings lookup failed:', err));
    return () => { cancelled = true; };
  }, [address]);

  return { apps, received, error };
}
