import { useCallback, useEffect, useState } from 'react';
import { createPublicClient, createWalletClient, custom, http, getAddress, erc20Abi } from 'viem';
import { BaseSepoliaConfig } from '@fangorn-network/sdk/lib/config.js';
import { useAuth } from './authContext.js';

// The deployment the site runs against: chain, RPC, registry addresses and the RPC's
// getLogs window, all from the SDK so the site can't drift from what the CLI uses.
// Deep imports on purpose: the SDK root entry pulls the graph engine, Pinata and
// the ZK gadgets (bb.js/noir WASM) into the bundle, and the hub only touches the
// AppRegistry.
//
// ⚠️ NOT FangornConfig: since 2026.10.20 that is still the old Arbitrum Sepolia
// deployment, kept for apps claimed there. New apps live on Base Sepolia.
export const NETWORK = BaseSepoliaConfig;
export const CHAIN = NETWORK.chain;

// The AppRegistry owns what an "app" is, and since 2026.10.20 also the storage
// subscription: claiming an app pays its first period (account.js).
export const APP_REGISTRY_ADDRESS = NETWORK.appRegistryContractAddress;
export const MEMBERSHIP_REGISTRY_ADDRESS = NETWORK.membershipRegistryContractAddress;

// USDC, for the balance display and the earnings scan (account.js). Circle's Base
// Sepolia USDC, which is what AppRegistry.usdc() names; the SDK's own fee calls
// read it from the contract.
// import.meta.env is undefined under plain node (the self-check), so guard it.
export const USDC_ADDRESS =
  import.meta.env?.VITE_USDC_ADDRESS ?? '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

// Reads go through a dedicated client on the SDK's chain/RPC so they hit the right
// network regardless of the wallet's current one.
export const publicClient = createPublicClient({ chain: CHAIN, transport: http(NETWORK.rpcUrl) });

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
