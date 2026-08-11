// Publisher directory: who has published to this app, and what they called their
// namespaces. Mirrors the fangorn.js / quickbeam.js shape (read functions + a use*
// hook consumed by a panel in Home).
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
import { FangornConfig } from '@fangorn-network/sdk/lib/config.js';
import { useAuth } from './authContext.js';
import { IPFS_GATEWAY, readRegistry, walletClientFor } from './fangorn.js';

/** Newest-first list of `{owner, subspaceId, root, blockNumber}`, latest per timeline. */
export async function readTimelines() {
  const logs = await readRegistry.getStateCommittedLogs({}, 0n);
  const latest = new Map();
  for (const log of logs) {
    // Logs arrive oldest-first, so the last write per timeline wins.
    latest.set(log.namespaceKey, {
      key: log.namespaceKey,
      owner: log.publisher,
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

/**
 * The directory.
 *   publishers – [{ owner, namespaces: [{ key, subspaceId, root, blockNumber, name? }], lastBlock }]
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

  const publishers = groupByOwner(timelines).map((p) => ({
    ...p,
    namespaces: p.namespaces.map((n) => ({ ...n, name: names[n.key] ?? undefined })),
  }));

  return { publishers, loading, resolving, error };
}
