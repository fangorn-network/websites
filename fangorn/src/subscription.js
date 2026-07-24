// Subscription-management library: read and pay the on-chain storage subscription
// from the browser. Mirrors the fangorn.js service-module shape (module-scope viem
// clients + read functions + a use* hook consumed by a panel in Home.jsx).
//
// The subscription lives in its own SubscriptionRegistry contract (separate from
// the DataRegistry). Paying pulls a USDC fee, so this is the only place in the app
// that does an ERC-20 approve. The upload gate (worker) enforces the active window;
// here we compute the same window only to display "active until X".
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
import { useAuth } from './authContext.js';
import { SUBSCRIPTION_ABI } from './subscriptionAbi.js';
import { USDC_ADDRESS } from './fangorn.js';

// The deployed SubscriptionRegistry. import.meta.env is undefined under plain node
// (the self-check), so guard it — same convention as REGISTRY_ADDRESS.
export const SUBSCRIPTION_ADDRESS = import.meta.env?.VITE_SUBSCRIPTION_ADDRESS;

// Active window, in days. Display-only here — the worker enforces the real gate
// (its SUBSCRIPTION_WINDOW_DAYS env is the source of truth; keep these in sync).
export const SUBSCRIPTION_WINDOW_DAYS = 30;
const WINDOW_SECS = BigInt(SUBSCRIPTION_WINDOW_DAYS * 86400);

// Reads hit a dedicated Arbitrum Sepolia client, regardless of the wallet's network.
const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http() });

/**
 * The publisher's subscription state:
 *   paidAt     – Unix-seconds bigint of the last payment (0n if never)
 *   fee        – current subscription fee (USDC base units, bigint)
 *   active     – paidAt within the window
 *   expiresAt  – Date the window ends, or null if never subscribed
 */
export async function readSubscription(subscriber) {
  const account = getAddress(subscriber);
  const [paidAt, fee] = await Promise.all([
    publicClient.readContract({
      address: SUBSCRIPTION_ADDRESS,
      abi: SUBSCRIPTION_ABI,
      functionName: 'subscribedAt',
      args: [account],
    }),
    publicClient.readContract({
      address: SUBSCRIPTION_ADDRESS,
      abi: SUBSCRIPTION_ABI,
      functionName: 'subscriptionFee',
    }),
  ]);

  const nowSecs = BigInt(Math.floor(Date.now() / 1000));
  const active = paidAt !== 0n && nowSecs < paidAt + WINDOW_SECS;
  const expiresAt = paidAt === 0n ? null : new Date(Number(paidAt + WINDOW_SECS) * 1000);
  return { paidAt, fee, active, expiresAt };
}

/**
 * The signed-in wallet's subscription, plus a `renew()` that pays/renews it.
 *   status    – { paidAt, fee, active, expiresAt } or null while loading
 *   active    – convenience: status?.active
 *   fee       – current fee in USDC base units (bigint), or null
 *   expiresAt – Date the window ends, or null
 *   loading   – true while the initial lookup is in flight
 *   renewing  – true while an approve+subscribe is pending
 *   renew()   – approves USDC if needed, then calls subscribe()
 */
export function useSubscription() {
  const { user, wallet } = useAuth();
  const address = user?.wallet?.address;

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(Boolean(address));
  const [renewing, setRenewing] = useState(false);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    readSubscription(address)
      .then((s) => !cancelled && setStatus(s))
      .catch((err) => !cancelled && console.warn('Subscription lookup failed:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [address]);

  const renew = useCallback(async () => {
    if (!wallet || !address) throw new Error('Connect a wallet first.');
    setRenewing(true);
    try {
      await wallet.switchChain(arbitrumSepolia.id);
      const provider = await wallet.getEthereumProvider();
      const account = getAddress(address);
      const walletClient = createWalletClient({
        account,
        chain: arbitrumSepolia,
        transport: custom(provider),
      });

      const fee = await publicClient.readContract({
        address: SUBSCRIPTION_ADDRESS,
        abi: SUBSCRIPTION_ABI,
        functionName: 'subscriptionFee',
      });

      // subscribe() pulls the fee via transferFrom, so approve the registry to
      // spend USDC first — but only when the current allowance falls short.
      const allowance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account, SUBSCRIPTION_ADDRESS],
      });
      if (allowance < fee) {
        const approveHash = await walletClient.writeContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'approve',
          args: [SUBSCRIPTION_ADDRESS, fee],
          account,
          chain: arbitrumSepolia,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      const subscribeHash = await walletClient.writeContract({
        address: SUBSCRIPTION_ADDRESS,
        abi: SUBSCRIPTION_ABI,
        functionName: 'subscribe',
        account,
        chain: arbitrumSepolia,
      });
      await publicClient.waitForTransactionReceipt({ hash: subscribeHash });

      setStatus(await readSubscription(address));
    } finally {
      setRenewing(false);
    }
  }, [wallet, address]);

  return {
    status,
    active: status?.active ?? false,
    fee: status?.fee ?? null,
    expiresAt: status?.expiresAt ?? null,
    loading,
    renewing,
    renew,
  };
}
