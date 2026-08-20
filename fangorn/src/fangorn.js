import { useCallback, useEffect, useState } from 'react';
import { createPublicClient, createWalletClient, custom, http, getAddress, parseEther, erc20Abi } from 'viem';
import { DataRegistryClient } from '@fangorn-network/sdk/lib/contracts/data-registry/index.js';
import { AppRegistryClient } from '@fangorn-network/sdk/lib/contracts/app-registry/index.js';
// PublisherStatus lives in contracts/types.js, NOT in the data-registry client it used
// to be re-exported from. Importing it from the old path is a link-time SyntaxError that
// takes down every module importing this one — i.e. a blank page.
import { PublisherStatus } from '@fangorn-network/sdk/lib/contracts/types.js';
import { DEFAULT_APP, FangornConfig, toAppId } from '@fangorn-network/sdk/lib/config.js';
import { useAuth } from './authContext.js';

export { PublisherStatus };

// Deployment settings come from the SDK (FangornConfig) — registry address, chain
// and RPC — so the site can never drift from the network the SDK publishes to.
// Deep imports on purpose: the SDK root entry pulls the graph engine, Pinata and
// the ZK gadgets (bb.js/noir WASM) into the bundle, and the dashboard only ever
// touches the DataRegistry.
export const CHAIN = FangornConfig.chain;
export const REGISTRY_ADDRESS = FangornConfig.dataRegistryContractAddress;

// The AppRegistry, which owns what an "app" is: its terms, its join fee and its
// membership. `DataRegistry.commitStateRoot` cross-calls `isRegisteredForApp` here, so
// registering as a publisher is no longer enough to publish — a wallet has to join the
// app too, or every commit reverts NotRegisteredForApp.
export const APP_REGISTRY_ADDRESS = FangornConfig.appRegistryContractAddress;

// Every registry call is scoped to an app id. Publishers register app-agnostically,
// but the client requires one, so use the SDK's default app. Exported because the
// Quickbeam panel has to say when a picked namespace lives in a *different* app.
export const APP_ID = toAppId(DEFAULT_APP);

// USDC, for the balance display and the subscription fee (subscription.js). The
// registration fee is native ETH, paid by the SDK's register().
// import.meta.env is undefined under plain node (the self-check), so guard it.
export const USDC_ADDRESS =
  import.meta.env?.VITE_USDC_ADDRESS ?? '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d';

// The testnet faucet worker (websites/faucet). Tops an empty wallet up so a new
// publisher can afford the registration fee + gas.
export const FAUCET_URL = (
  import.meta.env?.VITE_FAUCET_URL ?? 'https://fangorn-faucet.fangorn-0be.workers.dev'
).replace(/\/$/, '');

export const FAUCET_ETH = '0.05';
export const FAUCET_USDC = '10';

/** Seconds until this address may claim again — 0 means claimable now. */
export async function readFaucetCooldown(address) {
  const res = await fetch(`${FAUCET_URL}/faucet?address=${address}`);
  if (!res.ok) throw new Error(`Faucet ${res.status}`);
  return (await res.json()).retryAfter;
}

/**
 * Claim the drip. Resolves once the txs are mined, so the caller can re-read
 * balances immediately. Throws with .retryAfter set when still on cooldown.
 */
export async function dripFaucet(address) {
  const res = await fetch(`${FAUCET_URL}/faucet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(res.status === 429 ? 'Faucet cooldown' : `Faucet ${res.status}`);
    err.retryAfter = body.retryAfter ?? 0;
    throw err;
  }
  return body;
}

// Reads go through a dedicated client on the SDK's chain/RPC so they hit the right
// network regardless of the wallet's current one.
export const publicClient = createPublicClient({ chain: CHAIN, transport: http(FangornConfig.rpcUrl) });

// Gateway for reading content-addressed blocks (the publisher directory resolves
// namespace names through it). The SDK defaults to ipfs.io, which is unreliable for
// this content and is DNS-filtered on plenty of networks, so point at the project's
// gateway instead.
//
// ⚠️ NO trailing `/ipfs` — the SDK appends that itself, and a suffix here produces
// `/ipfs/ipfs/<cid>` and a 400 from the gateway.
export const IPFS_GATEWAY = (
  import.meta.env?.VITE_IPFS_GATEWAY ?? 'https://green-reasonable-heron-957.mypinata.cloud'
).replace(/\/(ipfs\/?)?$/, '');

// A DataRegistryClient wired for reads. Writes need the user's wallet, so
// register() below builds its own client with a Privy-backed walletClient.
export const readRegistry = new DataRegistryClient(REGISTRY_ADDRESS, APP_ID, publicClient, publicClient);
export const readAppRegistry = new AppRegistryClient(APP_REGISTRY_ADDRESS, APP_ID, publicClient, publicClient);

// The same client with the app left open. A namespace is an `app:publisher:subspace`
// triple and all three are indexed topics on StateCommitted, so the client's appId is
// simply topic 2 of the log filter — leaving it undefined makes that a null topic and
// the node returns every app's commits. That is what lets the directory show which app
// each namespace belongs to instead of only the one this site publishes under.
//
// Reads only. Anything that derives a namespaceKey — a write, or a filter naming one
// exact namespace — hashes the app id in and needs a real one.
export const allAppsRegistry = new DataRegistryClient(REGISTRY_ADDRESS, undefined, publicClient, publicClient);

/**
 * The Privy wallet (embedded or injected) as a viem WalletClient, switched to
 * the SDK's chain first so the tx can't land on the wrong network.
 *
 * This is also exactly what the SDK wants for a browser signer — it takes
 * `privateKey` OR `walletClient`, so a Privy user drives it without ever
 * holding a key: `Fangorn.create({ walletClient, storage: { signedUrl: {} } })`.
 * `account` must be set for that path: the signed-url backend signs the upload
 * worker's ownership challenge through it.
 */
export async function walletClientFor(wallet, address) {
  await wallet.switchChain(CHAIN.id);
  return createWalletClient({
    account: getAddress(address),
    chain: CHAIN,
    transport: custom(await wallet.getEthereumProvider()),
  });
}

/** The publisher's lifecycle status: UNREGISTERED / ACTIVE / SUSPENDED. */
export async function readStatus(publisher) {
  return readRegistry.getPublisherStatus(getAddress(publisher));
}

/**
 * May this wallet commit under this site's app? Exactly the question
 * `DataRegistry.commitStateRoot` asks on-chain, so a false here means a publish would
 * revert — which is why the dashboard's "Active" badge waits on it too.
 */
export async function readAppMembership(publisher) {
  return readAppRegistry.isRegisteredForApp(getAddress(publisher));
}

/** The wallet's native ETH (wei) and USDC (6-decimal base units) balances, raw. */
export async function readBalances(address) {
  const account = getAddress(address);
  const [eth, usdc] = await Promise.all([
    publicClient.getBalance({ address: account }),
    publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account],
    }),
  ]);
  return { eth, usdc };
}

/**
 * The signed-in wallet's ETH + USDC balances. `balances` is null while loading.
 * `refresh()` re-reads them — the faucet and registration both move the balance.
 */
export function useBalances() {
  const { user } = useAuth();
  const address = user?.wallet?.address;

  const [balances, setBalances] = useState(null);
  const [loading, setLoading] = useState(Boolean(address));
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    readBalances(address)
      .then((b) => !cancelled && setBalances(b))
      .catch((err) => !cancelled && console.warn('Balance lookup failed:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [address, tick]);

  return { balances, loading, refresh };
}

/**
 * The faucet claim for the signed-in wallet:
 *   retryAfter – seconds until the next claim is allowed (0 = claimable now)
 *   loading    – true while the initial eligibility check is in flight
 *   claiming   – true while a drip is being mined
 *   claim()    – drips, then resolves so the caller can re-read balances
 */
export function useFaucet() {
  const { user } = useAuth();
  const address = user?.wallet?.address;

  const [retryAfter, setRetryAfter] = useState(0);
  const [loading, setLoading] = useState(Boolean(address));
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    readFaucetCooldown(address)
      .then((secs) => !cancelled && setRetryAfter(secs))
      .catch((err) => !cancelled && console.warn('Faucet lookup failed:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [address]);

  const claim = useCallback(async () => {
    if (!address) throw new Error('Connect a wallet first.');
    setClaiming(true);
    try {
      const { retryAfter: next } = await dripFaucet(address);
      setRetryAfter(next);
    } catch (err) {
      // A 429 means someone else already claimed for this wallet — reflect it.
      if (err.retryAfter) setRetryAfter(err.retryAfter);
      throw err;
    } finally {
      setClaiming(false);
    }
  }, [address]);

  return { retryAfter, eligible: retryAfter === 0, loading, claiming, claim };
}

/**
 * The signed-in publisher's on-chain identity.
 *   status       – PublisherStatus (UNREGISTERED until they register)
 *   joined       – has this wallet joined APP_ID on the AppRegistry
 *   registered   – ACTIVE *and* joined; see below
 *   publisher    – the wallet address (its own namespace owner), or null
 *   details      – { owner, registry }, derived (no chain read), or null
 *   loading      – true while the initial lookups are in flight
 *   registering  – true while register() is sending
 *   register()   – whichever of the two on-chain steps this wallet still needs
 *
 * Registration is TWO steps now, and the badge waits on both. Publisher standing
 * (DataRegistry) and app membership (AppRegistry) are separate registrations, and
 * `commitStateRoot` requires both — so a wallet with only the first reads "Active"
 * here while every publish reverts NotRegisteredForApp. Both fees are 0.
 */
export function usePublisher() {
  const { user, wallet } = useAuth();
  const address = user?.wallet?.address;

  const [status, setStatus] = useState(PublisherStatus.UNREGISTERED);
  const [joined, setJoined] = useState(false);
  // address is stable for the hook's lifetime: App keys Home by wallet, so a
  // wallet switch remounts this fresh.
  const [loading, setLoading] = useState(Boolean(address));
  const [registering, setRegistering] = useState(false);

  const registered = status === PublisherStatus.ACTIVE && joined;
  const details = registered ? { owner: address, registry: REGISTRY_ADDRESS } : null;

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    Promise.all([readStatus(address), readAppMembership(address)])
      .then(([s, j]) => { if (!cancelled) { setStatus(s); setJoined(j); } })
      .catch((err) => !cancelled && console.warn('Status lookup failed:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [address]);

  const register = useCallback(async () => {
    if (!wallet || !address) throw new Error('Connect a wallet first.');
    setRegistering(true);
    try {
      // Send only the step that is missing: both contracts revert for a wallet that
      // already has the thing, so a half-finished registration (first tx landed, second
      // rejected) must be resumable rather than a dead end.
      const [{ eth, usdc }, fee, currentStatus, alreadyJoined] = await Promise.all([
        readBalances(address),
        readRegistry.registrationFee(),
        readStatus(address),
        readAppMembership(address),
      ]);
      // Registration costs a native fee plus gas, and the subscription panel needs
      // USDC right after, so a brand-new wallet can't pay for either. Auto-claim
      // only when the wallet is actually short, so a funded user doesn't burn their
      // 24h drip here. A faucet failure (outage, cooldown already spent) must not
      // block a wallet with its own funds — let register() surface the real error.
      if (eth < fee + parseEther('0.005') || usdc < 1_000_000n) {
        await dripFaucet(address).catch((err) => console.warn('Faucet drip failed:', err));
      }
      const walletClient = await walletClientFor(wallet, address);
      if (currentStatus !== PublisherStatus.ACTIVE) {
        const registry = new DataRegistryClient(REGISTRY_ADDRESS, APP_ID, publicClient, walletClient);
        // Reads the on-chain fee, attaches it as msg.value, waits for the receipt.
        // It also sets gas/fee headroom itself, which an embedded wallet won't.
        await registry.register();
      }
      if (!alreadyJoined) {
        const apps = new AppRegistryClient(APP_REGISTRY_ADDRESS, APP_ID, publicClient, walletClient);
        // Same shape: reads the app's current terms hash and join fee on-chain and
        // sends them itself. Passing the terms hash is what makes the tx valid only
        // against the version the user was shown — a mid-flight change reverts
        // TermsMismatch instead of silently agreeing to something else.
        await apps.registerForApp();
      }
      const [nextStatus, nextJoined] = await Promise.all([
        readStatus(address),
        readAppMembership(address),
      ]);
      setStatus(nextStatus);
      setJoined(nextJoined);
    } finally {
      setRegistering(false);
    }
  }, [wallet, address]);

  return { status, joined, registered, publisher: registered ? address : null, details, loading, registering, register };
}
