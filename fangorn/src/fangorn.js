import { useCallback, useEffect, useState } from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  getAddress,
  parseEther,
  erc20Abi,
} from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { DataRegistryClient, PublisherStatus } from '@fangorn-network/sdk/lib/contracts/data-registry/index.js';
import { useAuth } from './authContext.js';

export { PublisherStatus };

// The single deployed DataRegistry (Arbitrum Sepolia) — one state root per
// publisher. The dashboard only reads a publisher's lifecycle status and lets them
// register; graph content is not browsed here.
// import.meta.env is undefined under plain node (the self-check), so guard it.
export const REGISTRY_ADDRESS = import.meta.env?.VITE_REGISTRY_ADDRESS;

// The ERC-20 the registration fee is paid in (USDC). register() approves + pulls
// it via the SDK client, so the client needs the token address.
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

// Reads go through a dedicated Arbitrum Sepolia client so they hit the right
// chain regardless of the wallet's current network.
const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http() });

// A DataRegistryClient wired for reads. Writes need the user's wallet, so
// register() below builds its own client with a Privy-backed walletClient.
const readRegistry = new DataRegistryClient(REGISTRY_ADDRESS, publicClient, publicClient, USDC_ADDRESS);

/**
 * Fee overrides for any write sent through an embedded wallet.
 *
 * Writes here use a JSON-RPC account (wallet address + `custom(provider)`), so
 * viem forwards the tx to Privy and Privy fills the fee fields itself — at the
 * base fee it saw a moment ago, with no headroom. Arbitrum Sepolia's base fee
 * drifts up between estimate and inclusion, and the node then rejects the tx
 * with "max fee per gas less than block base fee". Passing these explicitly
 * takes the decision away from the wallet. 3x matches what the SDK's
 * executeWrite() already does for DataRegistry writes.
 *
 * Overpaying is free: EIP-1559 refunds the difference between maxFeePerGas and
 * the actual base fee.
 */
export async function writeFees() {
  const fees = await publicClient.estimateFeesPerGas();
  return {
    maxFeePerGas: fees.maxFeePerGas * 3n,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  };
}

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
      // Registration costs USDC plus gas, so a brand-new wallet can't pay for it.
      // Auto-claim only when the wallet is actually short, so a funded user
      // doesn't burn their 24h drip here. A faucet failure (outage, cooldown
      // already spent) must not block a wallet with its own funds — let
      // register() surface the real error instead.
      const { eth, usdc } = await readBalances(address);
      if (eth < parseEther('0.005') || usdc < 1_000_000n) {
        await dripFaucet(address).catch((err) => console.warn('Faucet drip failed:', err));
      }
      // register() pulls the registration fee in USDC (approving first if needed);
      // make sure the wallet is on Arbitrum Sepolia so the tx lands on the right network.
      await wallet.switchChain(arbitrumSepolia.id);
      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: getAddress(address),
        chain: arbitrumSepolia,
        transport: custom(provider),
      });
      const registry = new DataRegistryClient(REGISTRY_ADDRESS, publicClient, walletClient, USDC_ADDRESS);
      await registry.register(); // approves + pulls the USDC fee, waits for the receipt
      setStatus(await readStatus(address));
    } finally {
      setRegistering(false);
    }
  }, [wallet, address]);

  return { status, registered, publisher: registered ? address : null, details, loading, registering, register };
}
