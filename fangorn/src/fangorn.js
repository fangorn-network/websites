import { useCallback, useEffect, useState } from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  getAddress,
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

// Reads go through a dedicated Arbitrum Sepolia client so they hit the right
// chain regardless of the wallet's current network.
const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http() });

// A DataRegistryClient wired for reads. Writes need the user's wallet, so
// register() below builds its own client with a Privy-backed walletClient.
const readRegistry = new DataRegistryClient(REGISTRY_ADDRESS, publicClient, publicClient, USDC_ADDRESS);

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

/** The signed-in wallet's ETH + USDC balances. `balances` is null while loading. */
export function useBalances() {
  const { user } = useAuth();
  const address = user?.wallet?.address;

  const [balances, setBalances] = useState(null);
  const [loading, setLoading] = useState(Boolean(address));

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    readBalances(address)
      .then((b) => !cancelled && setBalances(b))
      .catch((err) => !cancelled && console.warn('Balance lookup failed:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [address]);

  return { balances, loading };
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
