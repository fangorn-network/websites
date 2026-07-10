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
import { ipfsUrl } from './format.js';
import { diffRecords } from './diff.js';

// Deployed PublisherRegistry (Stylus) on Arbitrum Sepolia — the only contract
// users touch. register() provisions their per-publisher bucket proxy.
// import.meta.env is undefined under plain node (the buckets self-check), so
// guard the access; the browser build injects it from .env.local.
export const REGISTRY_ADDRESS = import.meta.env?.VITE_REGISTRY_ADDRESS;

// Only the three registry methods onboarding needs. Full ABI lives in
// ../../contracts/publisher_registry. Stylus exports snake_case as camelCase.
export const REGISTRY_ABI = [
  { type: 'function', name: 'register', stateMutability: 'payable', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'bucketOf', stateMutability: 'view', inputs: [{ name: 'publisher', type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'registrationFee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
];

// Repos, commits, and schema tags all come from the bucket's own event log —
// reading the contract directly scopes everything to THIS bucket regardless of
// which wallet sent each publish (the subgraph keys manifests by tx sender, so
// it can't do bucket-scoped listing). SchemaRegistered = schema metadata;
// ManifestPublished = a datasource's first commit; ManifestUpdated = later ones.
export const BUCKET_ABI = [
  { type: 'event', name: 'SchemaRegistered', inputs: [
    { name: 'schema_id', type: 'bytes32', indexed: true },
    { name: 'name', type: 'string', indexed: false },
    { name: 'spec_cid', type: 'string', indexed: false },
    { name: 'agent_id', type: 'string', indexed: false },
  ] },
  { type: 'event', name: 'ManifestPublished', inputs: [
    { name: 'schema_id', type: 'bytes32', indexed: true },
    { name: 'name_hash', type: 'bytes32', indexed: true },
    { name: 'name', type: 'string', indexed: false },
    { name: 'merkle_root', type: 'bytes32', indexed: false },
    { name: 'manifest_cid', type: 'string', indexed: false },
  ] },
  { type: 'event', name: 'ManifestUpdated', inputs: [
    { name: 'schema_id', type: 'bytes32', indexed: true },
    { name: 'name_hash', type: 'bytes32', indexed: true },
    { name: 'merkle_root', type: 'bytes32', indexed: false },
    { name: 'manifest_cid', type: 'string', indexed: false },
    { name: 'version', type: 'uint64', indexed: false },
  ] },
];

const ZERO = '0x0000000000000000000000000000000000000000';

// Reads go through a dedicated Arbitrum Sepolia client so they hit the right
// chain regardless of the wallet's current network. http() uses the chain's
// default RPC (same endpoint as contracts/deploy.sh).
const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http() });

// Fetch + parse an IPFS JSON doc (a commit manifest or its record-set tree).
async function fetchJson(cid) {
  const res = await fetch(ipfsUrl(cid));
  if (!res.ok) throw new Error(`Gateway ${res.status} for ${cid}`);
  return res.json();
}

// The authenticated publisher's bucket, straight from the registry's
// bucketOf(publisher) — the on-chain source of truth for which bucket belongs to
// which wallet. Reading the registry (not the subgraph) guarantees the address
// we scope every downstream repo/commit/data read to is the one registered to
// THIS user, with no indexer lag or cross-key collision. ZERO = not registered.
async function readBucket(publisher) {
  const bucket = await publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'bucketOf',
    args: [getAddress(publisher)],
  });
  return bucket === ZERO ? null : getAddress(bucket);
}

// A datasource behaves like a git repo: an independently versioned dataset with
// its own commit chain. The list is reconstructed from the bucket's own log —
// SchemaRegistered for the schema "type" tag, and ManifestPublished/Updated for
// each repo's HEAD (the chronologically last event for a (schema, name) wins;
// the name only rides on the publish, so it's carried forward across updates).
// HEAD commit message/author come from the manifest doc on IPFS.
// ponytail: scans the bucket's full log (fromBlock 0) and fetches every HEAD
// commit up front. Fine per-bucket; page it or add an indexer if a bucket's
// history grows huge.
export async function readRepos(bucket) {
  const [schemaLogs, publishLogs, updateLogs] = await Promise.all([
    publicClient.getContractEvents({ address: bucket, abi: BUCKET_ABI, eventName: 'SchemaRegistered', fromBlock: 0n }),
    publicClient.getContractEvents({ address: bucket, abi: BUCKET_ABI, eventName: 'ManifestPublished', fromBlock: 0n }),
    publicClient.getContractEvents({ address: bucket, abi: BUCKET_ABI, eventName: 'ManifestUpdated', fromBlock: 0n }),
  ]);

  const schemas = new Map(schemaLogs.map((l) => [
    l.args.schema_id.toLowerCase(),
    { name: l.args.name, specCid: l.args.spec_cid, agentId: l.args.agent_id },
  ]));

  const events = [
    ...publishLogs.map((l) => ({ schemaId: l.args.schema_id, nameHash: l.args.name_hash, name: l.args.name, cid: l.args.manifest_cid, version: 1n, block: l.blockNumber, logIndex: l.logIndex })),
    ...updateLogs.map((l) => ({ schemaId: l.args.schema_id, nameHash: l.args.name_hash, name: null, cid: l.args.manifest_cid, version: l.args.version, block: l.blockNumber, logIndex: l.logIndex })),
  ].sort((a, b) => Number(a.block - b.block) || (a.logIndex - b.logIndex));

  const heads = new Map();
  for (const e of events) {
    const key = `${e.schemaId.toLowerCase()}-${e.nameHash.toLowerCase()}`;
    const prev = heads.get(key);
    heads.set(key, {
      name: e.name ?? prev?.name ?? null, // name only on publish; carry it across updates
      nameHash: e.nameHash,
      schemaId: e.schemaId,
      headCid: e.cid,                     // last event = HEAD
      version: e.version,
    });
  }

  return Promise.all([...heads.values()].map(async (r) => {
    const schema = schemas.get(r.schemaId.toLowerCase());
    let head = null;
    try { head = await fetchJson(r.headCid); } catch { /* gateway miss — list still renders */ }
    return {
      name: r.name,
      nameHash: r.nameHash,
      schemaId: r.schemaId,
      schemaName: schema?.name ?? null,
      specCid: schema?.specCid ?? null,
      headCid: r.headCid,
      version: String(r.version),
      message: head?.message ?? null,
      author: head?.author ?? null,
      updatedAt: head?.timestamp ?? null,
    };
  }));
}

// The full commit history of a repo, from the bucket's own log filtered by the
// repo's (schemaId, nameHash) — both indexed, so it's a cheap topic query. The
// initial publish is version 1; updates carry their own. IPFS supplies each
// commit's message/tree/parents. Newest first.
export async function readCommits(bucket, schemaId, nameHash) {
  const args = { schema_id: schemaId, name_hash: nameHash };
  const [publishLogs, updateLogs] = await Promise.all([
    publicClient.getContractEvents({ address: bucket, abi: BUCKET_ABI, eventName: 'ManifestPublished', args, fromBlock: 0n }),
    publicClient.getContractEvents({ address: bucket, abi: BUCKET_ABI, eventName: 'ManifestUpdated', args, fromBlock: 0n }),
  ]);

  const events = [
    ...publishLogs.map((l) => ({ version: 1n, cid: l.args.manifest_cid, merkleRoot: l.args.merkle_root, block: l.blockNumber, logIndex: l.logIndex, txHash: l.transactionHash })),
    ...updateLogs.map((l) => ({ version: l.args.version, cid: l.args.manifest_cid, merkleRoot: l.args.merkle_root, block: l.blockNumber, logIndex: l.logIndex, txHash: l.transactionHash })),
  ].sort((a, b) => Number(b.block - a.block) || (b.logIndex - a.logIndex));

  return Promise.all(events.map(async (e) => {
    let body = {};
    try { body = await fetchJson(e.cid); } catch { /* gateway miss */ }
    return {
      version: String(e.version),
      cid: e.cid,
      merkleRoot: e.merkleRoot,
      txHash: e.txHash,
      message: body.message ?? null,
      author: body.author ?? null,
      timestamp: body.timestamp ?? null,
      parents: body.parents ?? [],
      tree: body.tree ?? null,
      root: body.root ?? null,
    };
  }));
}

// The actual data records for a commit: tree → each entry's dataCid (a JSON
// array of records stored in the CAR) → flattened. A record is { name, fields }
// where fields are the schema's columns (e.g. filename, text). Missing/failed
// chunks are skipped so a partial gateway miss still returns what it can.
// ponytail: fetches every chunk. Fine for document-sized repos; page or stream
// if a version holds a lot of data.
export async function readData(commit) {
  if (!commit?.tree) return [];
  const tree = await fetchJson(commit.tree);
  const chunks = await Promise.all((tree.entries ?? []).map(async (e) => {
    const dataCid = e.fields?.dataCid;
    if (!dataCid) return [];
    try { return await fetchJson(dataCid); } catch { return []; }
  }));
  return chunks.flat();
}

// The data a commit changed vs its first parent, at the record level: whole
// added/removed records plus per-field before/after for changed ones (see
// diffRecords). A root commit (no parent) reports every record as added.
export async function readDataDiff(commit) {
  const parentCid = commit.parents?.[0];
  const [newRecs, oldRecs] = await Promise.all([
    readData(commit),
    parentCid ? fetchJson(parentCid).then(readData) : Promise.resolve([]),
  ]);
  return diffRecords(oldRecs, newRecs, !parentCid);
}

/**
 * The signed-in publisher's on-chain bucket.
 *   bucket       – the bucket proxy address, or null until they register
 *   details      – { owner, registry }, derived (no chain read), or null until loaded
 *   repos        – published datasources, each treated as a git-like repo (see readRepos)
 *   loading      – true while the initial bucket lookup is in flight
 *   reposLoading – true while the repo list is loading
 *   creating     – true while a register() tx is pending
 *   create()     – calls register() on the registry and resolves to the new bucket
 */
export function useBuckets() {
  const { user, wallet } = useAuth();
  const address = user?.wallet?.address;

  const [bucket, setBucket] = useState(null);
  const [repos, setRepos] = useState([]);
  // address is stable for the hook's lifetime: App keys Home by wallet, so a
  // wallet switch remounts this fresh. Seed loading from it and only touch state
  // from the async callbacks below.
  const [loading, setLoading] = useState(Boolean(address));
  const [reposLoading, setReposLoading] = useState(Boolean(address));
  const [creating, setCreating] = useState(false);

  // owner is the publisher we looked the bucket up by; registry is the fixed
  // PublisherRegistry — neither needs its own chain read.
  const details = bucket ? { owner: address, registry: REGISTRY_ADDRESS } : null;

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    readBucket(address)
      .then((b) => !cancelled && setBucket(b))
      .catch((err) => !cancelled && console.warn('Bucket lookup failed:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [address]);

  // Load the repos (datasources) from the bucket contract's own log.
  useEffect(() => {
    if (!bucket) return;
    let cancelled = false;
    readRepos(bucket)
      .then((r) => !cancelled && setRepos(r))
      .catch((err) => !cancelled && console.warn('Repo lookup failed:', err))
      .finally(() => !cancelled && setReposLoading(false));
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

  return { bucket, details, repos, loading, reposLoading, creating, create };
}
