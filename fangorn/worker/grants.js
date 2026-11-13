// Grants: a person lets one app publish to some of their repos, signed by their wallet.
//
// Fangorn is the only party with a signer on people's embedded wallets (one Privy key quorum, limited by policy to
// Fangorn Data updates). An app never gets that: it gets a grant token, scoped to the person's address and the repos
// they approved, and asks /api/sign to sign an Update with it. This module is the bookkeeping and the checks;
// worker/index.js wires it to Privy and HTTP.
//
// KV:  grant:<sha256(token)>  → { address, wallet, user, app, repos, day, count }
//      user:<user>:<app>      → sha256(token): one live grant per person per app, so a new one revokes the old

import { UPDATE_TYPES, dataDomain } from '@fangorn-network/sdk/lib/contracts/data-registry/index.js';

export const PER_DAY = 100; // signatures per grant per UTC day
const REPO = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

/** An app as a grant names it: its origin. Throws on anything that isn't an http(s) URL. */
export function appOf(url) {
  const u = new URL(String(url ?? ''));
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('app must be an http(s) URL');
  return u.origin;
}

/** The repos a grant may name: 1 to 10 repo names. */
export function reposOf(list) {
  const repos = [...new Set((Array.isArray(list) ? list : String(list ?? '').split(',')).map((r) => String(r).trim()).filter(Boolean))];
  if (!repos.length || repos.length > 10 || !repos.every((r) => REPO.test(r))) throw new Error('repos: 1 to 10 repo names');
  return repos;
}

export function grants(kv) {
  return {
    /** A new token for this person and app; their previous one for the app stops working. */
    async issue({ address, wallet, user }, app, repos) {
      const token = 'fgn_' + hex(crypto.getRandomValues(new Uint8Array(24)));
      const hash = await sha256(token), index = `user:${user}:${app}`;
      const old = await kv.get(index);
      if (old) await kv.delete(`grant:${old}`);
      await kv.put(`grant:${hash}`, JSON.stringify({ address, wallet, user, app, repos, day: '', count: 0 }));
      await kv.put(index, hash);
      return token;
    },
    async revoke(user, app) {
      const index = `user:${user}:${app}`, hash = await kv.get(index);
      if (hash) await kv.delete(`grant:${hash}`);
      await kv.delete(index);
    },
    /** The grant a bearer token names, or null. */
    async of(token) {
      if (!token) return null;
      const g = await kv.get(`grant:${await sha256(token)}`);
      return g ? JSON.parse(g) : null;
    },
    /** Count one signature today. ponytail: KV is eventually consistent, so the cap is approximate; a DO if it must be exact */
    async spend(token, grant) {
      const day = new Date().toISOString().slice(0, 10), count = grant.day === day ? grant.count : 0;
      if (count >= PER_DAY) throw new Error(`${PER_DAY} signatures a day per app: try again tomorrow`);
      await kv.put(`grant:${await sha256(token)}`, JSON.stringify({ ...grant, day, count: count + 1 }));
    },
  };
}

/**
 * What /api/sign will sign: an Update to one of the grant's repos, by the grant's address, on `network`'s registry.
 * The caller sends only the message; the domain and types are Fangorn's own, so nothing else can be signed this way.
 * → the EIP-712 typed data, or throws.
 */
export function updateFor(grant, message, network) {
  const m = message ?? {};
  if (String(m.publisher ?? '').toLowerCase() !== grant.address.toLowerCase()) throw new Error("the update isn't for this grant's address");
  if (!grant.repos.includes(m.repo)) throw new Error(`this grant doesn't cover the repo ${m.repo}`);
  for (const f of ['parent', 'diff', 'root']) if (!/^0x[0-9a-fA-F]{64}$/.test(m[f] ?? '')) throw new Error(`update.${f} must be 32 bytes of hex`);
  if (!/^0x([0-9a-fA-F]{2})*$/.test(m.car ?? '')) throw new Error('update.car must be hex bytes');
  if (!/^\d+$/.test(String(m.epoch ?? ''))) throw new Error('update.epoch must be a whole number');
  return {
    domain: dataDomain(network.chain.id, network.dataRegistryContractAddress),
    types: UPDATE_TYPES, primaryType: 'Update',
    message: { publisher: grant.address, repo: m.repo, epoch: BigInt(m.epoch), parent: m.parent, diff: m.diff, root: m.root, car: m.car },
  };
}
