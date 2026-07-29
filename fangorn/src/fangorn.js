import { useCallback, useEffect, useState } from 'react';
import { createPublicClient, createWalletClient, custom, http, getAddress, parseEther, erc20Abi } from 'viem';
import {
  DataRegistryClient,
  PublisherStatus,
} from '@fangorn-network/sdk/lib/contracts/data-registry/index.js';
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

// Every registry call is scoped to an app id. Publishers register app-agnostically,
// but the client requires one, so use the SDK's default app.
const APP_ID = toAppId(DEFAULT_APP);

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

// A DataRegistryClient wired for reads. Writes need the user's wallet, so
// register() below builds its own client with a Privy-backed walletClient.
const readRegistry = new DataRegistryClient(REGISTRY_ADDRESS, APP_ID, publicClient, publicClient);

/** The publisher's lifecycle status: UNREGISTERED / ACTIVE / SUSPENDED. */
export async function readStatus(publisher) {
  return readRegistry.getPublisherStatus(getAddress(publisher));
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
 *   registered   – convenience: status === ACTIVE
 *   publisher    – the wallet address (its own namespace owner), or null
 *   details      – { owner, registry }, derived (no chain read), or null
 *   loading      – true while the initial status lookup is in flight
 *   registering  – true while a register() tx is pending
 *   register()   – calls register() on the DataRegistry
 */
export function usePublisher() {
  const { user, wallet } = useAuth();
  const address = user?.wallet?.address;

  const [status, setStatus] = useState(PublisherStatus.UNREGISTERED);
  // address is stable for the hook's lifetime: App keys Home by wallet, so a
  // wallet switch remounts this fresh.
  const [loading, setLoading] = useState(Boolean(address));
  const [registering, setRegistering] = useState(false);

  const registered = status === PublisherStatus.ACTIVE;
  const details = registered ? { owner: address, registry: REGISTRY_ADDRESS } : null;

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    readStatus(address)
      .then((s) => !cancelled && setStatus(s))
      .catch((err) => !cancelled && console.warn('Status lookup failed:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [address]);

  const register = useCallback(async () => {
    if (!wallet || !address) throw new Error('Connect a wallet first.');
    setRegistering(true);
    try {
      // Registration costs a native fee plus gas, and the subscription panel needs
      // USDC right after, so a brand-new wallet can't pay for either. Auto-claim
      // only when the wallet is actually short, so a funded user doesn't burn their
      // 24h drip here. A faucet failure (outage, cooldown already spent) must not
      // block a wallet with its own funds — let register() surface the real error.
      const [{ eth, usdc }, fee] = await Promise.all([
        readBalances(address),
        readRegistry.registrationFee(),
      ]);
      if (eth < fee + parseEther('0.005') || usdc < 1_000_000n) {
        await dripFaucet(address).catch((err) => console.warn('Faucet drip failed:', err));
      }
      // Make sure the wallet is on the SDK's chain so the tx lands on the right network.
      await wallet.switchChain(CHAIN.id);
      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: getAddress(address),
        chain: CHAIN,
        transport: custom(provider),
      });
      const registry = new DataRegistryClient(REGISTRY_ADDRESS, APP_ID, publicClient, walletClient);
      // Reads the on-chain fee, attaches it as msg.value, waits for the receipt.
      // It also sets gas/fee headroom itself, which an embedded wallet won't.
      await registry.register();
      setStatus(await readStatus(address));
    } finally {
      setRegistering(false);
    }
  }, [wallet, address]);

  return { status, registered, publisher: registered ? address : null, details, loading, registering, register };
}
