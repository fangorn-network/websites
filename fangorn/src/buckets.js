import { useCallback, useEffect, useState } from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  getAddress,
} from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { useAuth } from './authContext.js';

// Deployed PublisherRegistry (Stylus) on Arbitrum Sepolia — the only contract
// users touch. register() provisions their per-publisher bucket proxy.
export const REGISTRY_ADDRESS = '0x0d3f3b1bb7cb809e35f5e50c5c51f013b418ab64';

// Only the three registry methods onboarding needs. Full ABI lives in
// ../../contracts/publisher_registry. Stylus exports snake_case as camelCase.
export const REGISTRY_ABI = [
  { type: 'function', name: 'register', stateMutability: 'payable', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'bucketOf', stateMutability: 'view', inputs: [{ name: 'publisher', type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'registrationFee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
];

// A bucket exposes no schema enumeration (schemas are keyed by name-hash), so
// the directly-readable info is its identity. Listing schemas/datasources would
// mean indexing SchemaRegistered/ManifestPublished events — add when buckets
// have content to show.
export const BUCKET_ABI = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'registry', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
];

const ZERO = '0x0000000000000000000000000000000000000000';

// Reads go through a dedicated Arbitrum Sepolia client so they hit the right
// chain regardless of the wallet's current network. http() uses the chain's
// default RPC (same endpoint as contracts/deploy.sh).
const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http() });

async function readBucket(publisher) {
  const bucket = await publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'bucketOf',
    args: [getAddress(publisher)],
  });
  return bucket === ZERO ? null : bucket;
}

async function readBucketDetails(bucket) {
  const [owner, registry] = await Promise.all([
    publicClient.readContract({ address: bucket, abi: BUCKET_ABI, functionName: 'owner' }),
    publicClient.readContract({ address: bucket, abi: BUCKET_ABI, functionName: 'registry' }),
  ]);
  return { owner, registry };
}

/**
 * The signed-in publisher's on-chain bucket.
 *   bucket   – the bucket proxy address, or null until they register
 *   details  – { owner, registry } read from the bucket, or null until loaded
 *   loading  – true while the initial bucketOf() lookup is in flight
 *   creating – true while a register() tx is pending
 *   create() – calls register() on the registry and resolves to the new bucket
 */
export function useBuckets() {
  const { user, wallet } = useAuth();
  const address = user?.wallet?.address;

  const [bucket, setBucket] = useState(null);
  const [details, setDetails] = useState(null);
  // address is stable for a mounted session (Home remounts on auth change), so
  // seed loading from it and only touch state from the async callbacks below.
  const [loading, setLoading] = useState(Boolean(address));
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    readBucket(address)
      .then((b) => !cancelled && setBucket(b))
      .catch((err) => !cancelled && console.warn('Bucket lookup failed:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [address]);

  // Load the bucket's on-chain identity once we know its address.
  useEffect(() => {
    if (!bucket) return;
    let cancelled = false;
    readBucketDetails(bucket)
      .then((d) => !cancelled && setDetails(d))
      .catch((err) => !cancelled && console.warn('Bucket details lookup failed:', err));
    return () => { cancelled = true; };
  }, [bucket]);

  const create = useCallback(async () => {
    if (!wallet || !address) throw new Error('Connect a wallet first.');
    setCreating(true);
    try {
      // register() sends value; make sure the wallet is on Arbitrum Sepolia so
      // the tx (and the fee) land on the right network.
      await wallet.switchChain(arbitrumSepolia.id);
      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: getAddress(address),
        chain: arbitrumSepolia,
        transport: custom(provider),
      });

      const fee = await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'registrationFee',
      });
      const hash = await walletClient.writeContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'register',
        value: fee,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const created = await readBucket(address);
      setBucket(created);
      return created;
    } finally {
      setCreating(false);
    }
  }, [wallet, address]);

  return { bucket, details, loading, creating, create };
}
