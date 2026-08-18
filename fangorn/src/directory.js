// Publisher directory: who has published to the network, under which app, and what
// they called their namespaces. Mirrors the fangorn.js / quickbeam.js shape (read
// functions + a use* hook consumed by a panel in Home).
//
// A namespace is an `app:publisher:subspace` triple, so a publisher can hold several
// unrelated graphs that only differ by app — showing subspaces alone would silently
// merge them. The chain pass therefore leaves the app topic open (allAppsRegistry) and
// the result is grouped publisher → app → namespaces.
//
// Two passes, because they cost wildly different amounts:
//
//   1. THE CHAIN PASS is one getLogs over StateCommitted. It yields every publisher,
//      their per-namespace timelines and the latest root — no IPFS, no wallet, fast.
//      But the event carries `subspaceId` (keccak of the name), never the name.
//   2. THE NAME PASS resolves each root through the SDK engine, which fetches the
//      commit block and its root map and reads the key. That is two gateway fetches
//      per namespace, so it runs in the background and fills names in as they land.
//
// A head that cannot be resolved is normal, not an error: pins on the shared Pinata
// account get swept, which orphans a root that the chain still points at. Those rows
// keep their subspaceId and the rest of the table is unaffected.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Fangorn } from '@fangorn-network/sdk';
import { DEFAULT_APP, FangornConfig, toAppId } from '@fangorn-network/sdk/lib/config.js';
import { useAuth } from './authContext.js';
import { IPFS_GATEWAY, allAppsRegistry, publicClient, walletClientFor } from './fangorn.js';

// An app id is keccak256 of the app's name and nothing on-chain stores the preimage —
// `registerApp` claims the hash alone. So a name can only ever be recognised, never
// recovered: this is the site's phrasebook of the apps we know about. Anything else
// shows as its short hex, which is still exactly what `fangorn --app` accepts.
const KNOWN_APPS = [DEFAULT_APP, 'sond3r', 'sond3r.test.0', 'sond3r.test.1', 'sond3r.test.2'];
const APP_NAMES = new Map(KNOWN_APPS.map((name) => [toAppId(name).toLowerCase(), name]));

/** A human label for an app id — its name if we know it, else its short hex. */
export function appLabel(appId) {
  return APP_NAMES.get(appId.toLowerCase()) ?? `${appId.slice(0, 10)}…`;
}

// How far behind the chain head to stop reading logs when `latest` is refused.
//
// The public Arbitrum Sepolia endpoint answers eth_getLogs with `-32000 internal server
// errror` for any range reaching into its most recent few thousand blocks, while the
// very same query bounded a little further back returns the whole history fine.
// Measured 2026-08-12: the boundary sat ~3,100 blocks behind head, so this is ~2x
// margin. Arbitrum runs ~4 blocks/s, so the fallback costs about half an hour of
// recency — a just-published namespace shows up on the next load.
//
// This is NOT a block-range limit: `fromBlock: 0n` across the whole chain is fine, only
// the recent tail is refused. Do not "fix" it by paginating the range.
const HEAD_LAG = 8000n;

/**
 * Every StateCommitted log, preferring a live read. `latest` is tried first so a healthy
 * RPC gives fresh data and this degrades on its own if the endpoint is repaired; the
 * lagged retry is what keeps the directory rendering when it is not.
 */
async function readAllLogs() {
  try {
    return await allAppsRegistry.getStateCommittedLogs({}, 0n);
  } catch (err) {
    const head = await publicClient.getBlockNumber();
    const safe = head > HEAD_LAG ? head - HEAD_LAG : head;
    console.warn(
      `Directory: getLogs to "latest" failed (${err.shortMessage || err.message}); `
      + `retrying to block ${safe} — entries newer than that are not listed.`);
    return allAppsRegistry.getStateCommittedLogs({}, 0n, safe);
  }
}

/** Newest-first list of `{owner, appId, subspaceId, root, blockNumber}`, latest per timeline. */
export async function readTimelines() {
  const logs = await readAllLogs();
  const latest = new Map();
  for (const log of logs) {
    // Logs arrive oldest-first, so the last write per timeline wins. The key is the
    // contract's own `namespaceKey` — keccak over app+publisher+subspace — so the same
    // subspace name in two apps stays two timelines, as it is on-chain.
    latest.set(log.namespaceKey, {
      key: log.namespaceKey,
      owner: log.publisher,
      appId: log.appId,
      subspaceId: log.subspaceId,
      root: log.newRoot,
      blockNumber: log.blockNumber,
    });
  }
  return [...latest.values()].sort((a, b) => Number(b.blockNumber - a.blockNumber));
}

/** Group timelines by publisher, newest activity first. */
export function groupByOwner(timelines) {
  const byOwner = new Map();
  for (const t of timelines) {
    const key = t.owner.toLowerCase();
    if (!byOwner.has(key)) byOwner.set(key, { owner: t.owner, namespaces: [], lastBlock: 0n });
    const entry = byOwner.get(key);
    entry.namespaces.push(t);
    if (t.blockNumber > entry.lastBlock) entry.lastBlock = t.blockNumber;
  }
  return [...byOwner.values()].sort((a, b) => Number(b.lastBlock - a.lastBlock));
}

/** One publisher's namespaces split by app, newest app first. */
export function groupByApp(namespaces) {
  const byApp = new Map();
  for (const ns of namespaces) {
    if (!byApp.has(ns.appId)) {
      byApp.set(ns.appId, {
        appId: ns.appId,
        label: appLabel(ns.appId),
        namespaces: [],
        lastBlock: 0n,
      });
    }
    const entry = byApp.get(ns.appId);
    entry.namespaces.push(ns);
    if (ns.blockNumber > entry.lastBlock) entry.lastBlock = ns.blockNumber;
  }
  return [...byApp.values()].sort((a, b) => Number(b.lastBlock - a.lastBlock));
}

/**
 * The directory.
 *   publishers – [{ owner, lastBlock,
 *                   namespaces: [{ key, appId, subspaceId, root, blockNumber, name? }],
 *                   apps: [{ appId, label, namespaces, lastBlock }] }]
 *   loading    – true during the chain pass
 *   resolving  – true while names are still being fetched
 *   error      – the chain pass failed (the name pass never surfaces as an error)
 */
export function useDirectory() {
  const { wallet, user } = useAuth();
  const address = user?.wallet?.address;

  const [timelines, setTimelines] = useState([]);
  const [names, setNames] = useState({});      // namespaceKey → name
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState(null);
  const engineRef = useRef(null);
  const startedRef = useRef(new Set());   // keys already being resolved

  useEffect(() => {
    let cancelled = false;
    readTimelines()
      .then((t) => !cancelled && setTimelines(t))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  // The name pass needs the engine, which needs a wallet — so it waits for one and
  // simply never runs if the user has none. The table stands on its own without it.
  const resolveNames = useCallback(async (entries) => {
    if (!wallet || !address || !entries.length) return;
    setResolving(true);
    try {
      engineRef.current ??= Fangorn.create({
        walletClient: await walletClientFor(wallet, address),
        // Reads resolve by CID through the gateway; the signed-url backend is only
        // ever exercised on write, which the directory never does. The gateway is
        // set explicitly because the SDK's ipfs.io default does not serve this
        // content reliably — measured 0/8 there, 8/8 on the project's gateway.
        storage: { signedUrl: { gateway: IPFS_GATEWAY } },
        config: { ...FangornConfig, ipfsGateway: IPFS_GATEWAY },
      }).engine;

      // Bounded concurrency: each name is ~2s of gateway round-trips, so resolving
      // 40 of them one at a time would take a minute and a half. Six at once keeps
      // the fill quick without hammering the gateway.
      const queue = [...entries];
      const worker = async () => {
        for (let entry = queue.shift(); entry; entry = queue.shift()) {
          try {
            const name = await engineRef.current.namespaceOf(entry.root);
            setNames((prev) => ({ ...prev, [entry.key]: name }));
          } catch {
            // An orphaned or unreachable head. Leave it unnamed and keep going —
            // one dead root must not blank the directory.
            setNames((prev) => ({ ...prev, [entry.key]: null }));
          }
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
    } finally {
      setResolving(false);
    }
  }, [wallet, address]);

  useEffect(() => {
    // startedRef, not `names`, decides what is outstanding: a resolution in flight
    // has no entry in `names` yet, and re-running the effect would start it twice.
    const pending = timelines.filter((t) => !startedRef.current.has(t.key));
    if (!pending.length) return;
    for (const t of pending) startedRef.current.add(t.key);
    resolveNames(pending);
  }, [timelines, resolveNames]);

  // Names land asynchronously, so the app grouping is derived here rather than in the
  // chain pass — it has to be rebuilt from the enriched namespaces on every fill.
  const publishers = groupByOwner(timelines).map((p) => {
    const namespaces = p.namespaces.map((n) => ({ ...n, name: names[n.key] ?? undefined }));
    return { ...p, namespaces, apps: groupByApp(namespaces) };
  });

  return { publishers, loading, resolving, error };
}
