// Quickbeam library: create a *view* — a named set of namespaces that gets its own
// search endpoint and MCP catalog. Mirrors the fangorn.js / subscription.js shape
// (module-scope config + read functions + a use* hook consumed by a panel in Home).
//
// Embeddings are NOT per requester. The registry worker serves the deduplicated union
// of every view's sources to one shared Quickbeam instance, so asking for a namespace
// somebody else already watches costs nothing and returns the same points. A view is
// a filter, not a copy.
//
// There is no contract here. The worker gates on the *storage* subscription the site
// already sells (one access() call on the SubscriptionRegistry).
import { useCallback, useEffect, useState } from 'react';
import { getAddress } from 'viem';
import { useAuth } from './authContext.js';
import { walletClientFor } from './fangorn.js';

// The registry worker. import.meta.env is undefined under plain node (the
// self-check), so guard it — same convention as SUBSCRIPTION_ADDRESS.
//
// The fallback must be a worker that actually exists: a dead default fails as an
// opaque CORS error ("No 'Access-Control-Allow-Origin' header"), because Cloudflare's
// 404 page for an unclaimed *.workers.dev subdomain carries no CORS headers — which
// sends you debugging the wrong thing entirely.
export const QUICKBEAM_WORKER_URL = (
  import.meta.env?.VITE_QUICKBEAM_WORKER_URL ?? 'https://quickbeam-registry.quickbeam.workers.dev'
).replace(/\/$/, '');

/** Throw the worker's own error text — Home.jsx's friendlyError renders it. */
async function unwrap(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Registry ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/**
 * The `sources` array for one view. A source is the whole `app:publisher:subspace`
 * triple, and `*` on a side means "every one of those" — the worker canonicalises it
 * (`normaliseSources`), the watcher widens the subscription to the app-level topic
 * filter, and the search server leaves that part of the scope unconstrained.
 *
 * So watching a whole app is not a second code path anywhere downstream; it is the
 * same source with two sides wildcarded. That is the entire feature — which is why
 * the scope is *derived* here rather than passed in: an empty publisher/namespace IS
 * the wildcard, so the UI needs no scope switch to keep in sync with its own fields.
 *
 * `app` may be a name or a 0x… id — the worker hashes a name with the same keccak the
 * SDK's `toAppId` uses, so both land on the same source and the same CDN domain.
 *
 * ponytail: two scopes, not four. The triple also expresses "one publisher's whole
 * footprint in an app" (`namespace:'*'`) and "this subspace name across every
 * publisher" (`owner:'*'`), so a half-filled pair widens to the whole app rather than
 * half-matching. Nothing downstream needs changing to offer those — it is a UI change
 * with no schema change — so they wait until someone asks.
 */
export function buildSources({ app, publisher, namespace }) {
  const owner = publisher.trim();
  const subspace = namespace.trim();
  return [owner && subspace
    ? { app: app.trim(), owner, namespace: subspace }
    : { app: app.trim(), owner: '*', namespace: '*' }];
}

/**
 * How many namespaces a view covers, for its one-line summary. A wildcard source has
 * no count — the set is whatever the app holds today — so counting sources would
 * report "1 namespace" for a view over forty.
 */
export function describeSources(sources) {
  // Only a BOTH-sides wildcard is a whole app. A half-wildcard (one publisher's whole
  // footprint, or one subspace name across every publisher) is neither an app nor a
  // countable namespace; this UI never creates one, so it falls in with the rest
  // rather than earning a third phrase nobody would see.
  const apps = sources.filter((s) => s.owner === '*' && s.namespace === '*').length;
  const rest = sources.length - apps;
  const parts = [];
  if (apps) parts.push(apps === 1 ? 'whole app' : `${apps} whole apps`);
  if (rest || !apps) parts.push(`${rest} namespace${rest === 1 ? '' : 's'}`);
  return parts.join(' + ');
}

/** Every view this wallet owns. Public read — no signature needed. */
export async function readViews(requester) {
  const res = await fetch(`${QUICKBEAM_WORKER_URL}/views?requester=${requester}`);
  const body = await unwrap(res);
  return body.views ?? [];
}

/**
 * Create (or replace) a view. Two-step by design: the first POST comes back with the
 * exact challenge to sign, the second carries the signature. Nothing is stored until
 * the second call passes both the signature check and the subscription check.
 */
export async function createView({ wallet, address, name, sources, hostedMcp = false }) {
  const account = getAddress(address);
  const post = (extra) =>
    fetch(`${QUICKBEAM_WORKER_URL}/views`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: account, name, sources, hostedMcp, ...extra }),
    });

  // Step 1 — collect the challenge. A 401 carrying one is the expected path here, not
  // a failure, so this response is read directly rather than through unwrap().
  const challengeRes = await post({});
  const { challenge } = await challengeRes.json().catch(() => ({}));
  if (!challenge) return unwrap(challengeRes);

  // Step 2 — sign it verbatim (the worker rebuilds the exact string and compares).
  const walletClient = await walletClientFor(wallet, address);
  const signature = await walletClient.signMessage({ account, message: challenge });
  return unwrap(await post({ message: challenge, signature }));
}

/**
 * The signed-in wallet's views, plus the action that creates one.
 *   views     – [{ id, name, sources, searchUrl, mcpCommand }]
 *   loading   – true during the initial lookup
 *   creating  – true while a signature/POST is in flight
 *   create()  – sign and create a view
 */
export function useQuickbeam() {
  const { user, wallet } = useAuth();
  const address = user?.wallet?.address;

  const [views, setViews] = useState([]);
  const [loading, setLoading] = useState(Boolean(address));
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    readViews(address)
      .then((v) => !cancelled && setViews(v))
      .catch((err) => !cancelled && console.warn('View lookup failed:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [address]);

  const create = useCallback(async ({ name, sources, hostedMcp }) => {
    if (!wallet || !address) throw new Error('Connect a wallet first.');
    setCreating(true);
    try {
      const view = await createView({ wallet, address, name, sources, hostedMcp });
      // Replace in place when it already existed, so re-creating doesn't duplicate.
      setViews((prev) => [view, ...prev.filter((v) => v.id !== view.id)]);
      return view;
    } finally {
      setCreating(false);
    }
  }, [wallet, address]);

  return { views, loading, creating, create };
}
