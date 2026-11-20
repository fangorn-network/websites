import { useCallback, useEffect, useState } from 'react';
import { createPublicClient, createWalletClient, custom, http, getAddress, erc20Abi } from 'viem';
import { BaseSepoliaConfig, BaseConfig } from '@fangorn-network/sdk/lib/config.js';
import { useAuth } from './authContext.js';

// The deployments the site reads: chain, RPC, registry addresses and the RPC's getLogs
// window, all from the SDK so the site can't drift from what the CLI uses. Deep imports on
// purpose: the SDK root entry pulls the graph engine, Pinata and the ZK gadgets (bb.js/noir
// WASM) into the bundle, and the hub's reads need none of it.
//
// A repo lives on one network, and its links name it (#/data/<net>/…). Testnet is the
// default wherever none is named: publishing, buying, balances and apps are testnet only.
// Base mainnet has a DataRegistry and nothing else yet (no upload worker, no
// SettlementRegistry), so the site reads it and never writes to it.
//
// Every getLogs window is one eth_getLogs, and both chains make a block every 0.2s
// (432k a day), so a 50k window (what publicnode takes; base.org takes 200) is about
// three hours of chain. VITE_RPC_URL / VITE_BASE_RPC_URL and the LOG_WINDOW pair point the
// site at a keyed RPC.
// ponytail: a full scan per read, ~150 calls on testnet now; an indexer (or a keyed RPC
// with no range cap) is the upgrade.
const env = import.meta.env ?? {}; // undefined under plain node (the self-check)
export const NETWORKS = {
  baseSepolia: { ...BaseSepoliaConfig, rpcUrl: env.VITE_RPC_URL || BaseSepoliaConfig.rpcUrl, logWindow: BigInt(env.VITE_LOG_WINDOW || 50_000) },
  base: { ...BaseConfig, rpcUrl: env.VITE_BASE_RPC_URL || BaseConfig.rpcUrl, logWindow: BigInt(env.VITE_BASE_LOG_WINDOW || 50_000) },
};
export const DEFAULT_NET = 'baseSepolia';
export const isNet = (net) => Object.hasOwn(NETWORKS, net);
/** Whether `net` sells records: only a network with a SettlementRegistry can. */
export const sells = (net) => Boolean(NETWORKS[net].settlementRegistryContractAddress);
/** What a repo's badge says about its network. */
export const netLabel = (net) => (NETWORKS[net].chain.testnet ? 'Testnet' : 'Mainnet');

// The testnet, for everything that isn't per repo.
export const NETWORK = NETWORKS[DEFAULT_NET];
export const CHAIN = NETWORK.chain;

// USDC, for the balance display: Circle's Base Sepolia USDC.
export const USDC_ADDRESS = env.VITE_USDC_ADDRESS ?? '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

// Reads go through a client per network on the SDK's chain/RPC, so they hit the right
// network regardless of the wallet's current one. Multicall batching folds the
// reads issued in one tick (five per app, every app at once) into a single eth_call:
// the public RPC refuses a burst of separate ones ("Request exceeds defined limit").
const clients = {};
export const clientOf = (net = DEFAULT_NET) => (clients[net] ??= createPublicClient({
  chain: NETWORKS[net].chain,
  // A rate-limited call is retried after 1, 2, 4 and 8 seconds (viem's default waits 150ms, then gives up).
  transport: http(NETWORKS[net].rpcUrl, { retryCount: 4, retryDelay: 1000 }),
  batch: { multicall: true },
}));
export const publicClient = clientOf();

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
 * `refresh()` re-reads them — creating an app moves the balance.
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
