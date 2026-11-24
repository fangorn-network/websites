// fangorn.network's Worker: the site (dist/, as before); the registry of every repo, for people at /api/repos and
// for agents at /mcp; and /api, where apps get people's updates signed.
//
// The registry is a Fangorn app like any other: a westmarch repos index over every repo (follow ["*"]), deployed from
// the ops repo's apps.json at registry-sepolia.fangorn.network. These two paths pass through to it, so their URLs stay put.
//
//   GET    /api/repos?q=&publisher=&k=   → { stitch, repos }: repos by meaning, or newest first without q  (its /repos)
//   POST   /mcp                          the registry as MCP tools: find, repo, read                        (its /mcp)
//
//   POST   /api/grants  { app, repos, perDay? }  Authorization: <Privy access token>  → { token, address }   (from this site)
//   DELETE /api/grants  { app }          Authorization: <Privy access token>  → {}                    (from this site)
//   GET    /api/grant                    Authorization: Bearer <grant token>  → { address, app, repos, perDay } (from an app)
//   POST   /api/sign    { message }      Authorization: Bearer <grant token>  → { signature }          (from an app)
//                       { messages }                                          → { signatures }         (up to 50, all or none)
//
// /api/sign takes an Update's message (publisher, repo, epoch, parent, diff, root, car; epoch as a decimal string),
// checks it against the grant (worker/grants.js), and signs it as the person's embedded wallet through Privy,
// with Fangorn's authorization key. The app relays it (updateBySig) itself or through Barliman.
//
// Bindings: ASSETS, GRANTS (KV), PRIVY_APP_ID (var), and the secrets PRIVY_APP_SECRET and PRIVY_PRIVATE_KEY
// (the private half of the key quorum the site adds as a signer: VITE_FANGORN_SIGNER_ID).

import { PrivyClient } from '@privy-io/node';
import { BaseSepoliaConfig } from '@fangorn-network/sdk';
import { grants, appOf, reposOf, perDayOf, updateFor, MAX_BATCH, PER_DAY as PER_DAY_DEFAULT } from './grants.js';

const REGISTRY = 'https://registry-sepolia.fangorn.network';

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization, mcp-protocol-version', 'access-control-allow-methods': 'GET, POST, DELETE' };
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', ...CORS } });
const bearer = (req) => req.headers.get('authorization')?.match(/^Bearer\s+(\S+)/i)?.[1];

function privyOf(env) {
  if (!env.PRIVY_APP_ID || !env.PRIVY_APP_SECRET || !env.PRIVY_PRIVATE_KEY) throw Object.assign(new Error('signing is not set up'), { status: 503 });
  return { client: new PrivyClient({ appId: env.PRIVY_APP_ID, appSecret: env.PRIVY_APP_SECRET }), key: env.PRIVY_PRIVATE_KEY.replace(/^wallet-auth:/, '') };
}

/** A Privy access token → the person's embedded Ethereum wallet: { address, wallet, user }. */
async function walletOf(privy, accessToken) {
  const { user_id } = await privy.client.utils().auth().verifyAccessToken(accessToken ?? '').catch(() => {
    throw Object.assign(new Error('sign in again'), { status: 401 });
  });
  const u = await privy.client.users()._get(user_id);
  const w = u.linked_accounts.find((a) => a.type === 'wallet' && a.connector_type === 'embedded' && a.chain_type === 'ethereum' && a.id);
  if (!w) throw Object.assign(new Error('this account has no Fangorn wallet: sign in with email'), { status: 403 });
  return { address: w.address, wallet: w.id, user: user_id };
}

async function api(req, env, path) {
  const store = grants(env.GRANTS), body = req.method === 'POST' || req.method === 'DELETE' ? await req.json().catch(() => ({})) : {};
  if (path === '/api/grants') {
    const privy = privyOf(env), who = await walletOf(privy, bearer(req));
    if (req.method === 'POST') return json({ token: await store.issue(who, appOf(body.app), reposOf(body.repos), perDayOf(body.perDay)), address: who.address });
    if (req.method === 'DELETE') { await store.revoke(who.user, appOf(body.app)); return json({}); }
  }
  if (path === '/api/grant' && req.method === 'GET') {
    const g = await store.of(bearer(req));
    return g ? json({ address: g.address, app: g.app, repos: g.repos, perDay: g.perDay ?? PER_DAY_DEFAULT }) : json({ error: 'no such grant: connect again' }, 401);
  }
  // { message } → { signature }, or { messages: [...] } → { signatures: [...] } (up to MAX_BATCH, all or none): an app
  // moving several repos in one transaction asks once.
  if (path === '/api/sign' && req.method === 'POST') {
    const token = bearer(req), g = await store.of(token);
    if (!g) return json({ error: 'no such grant: connect again' }, 401);
    const many = Array.isArray(body.messages), messages = many ? body.messages : [body.message];
    if (!messages.length || messages.length > MAX_BATCH) return json({ error: `messages: 1 to ${MAX_BATCH}` }, 400);
    const typed = messages.map((m) => updateFor(g, m, BaseSepoliaConfig)); // throws on anything the grant doesn't cover
    const privy = privyOf(env);
    await store.spend(token, g, typed.length);
    const sign = async (t) => (await privy.client.wallets().ethereum().signTypedData(g.wallet, {
      params: { typed_data: { domain: t.domain, types: t.types, primary_type: t.primaryType, message: { ...t.message, epoch: t.message.epoch.toString() } } },
      authorization_context: { authorization_private_keys: [privy.key] },
    })).signature;
    const signatures = [];
    for (let i = 0; i < typed.length; i += 5) signatures.push(...await Promise.all(typed.slice(i, i + 5).map(sign))); // 5 at a time, gentle on Privy
    return json(many ? { signatures } : { signature: signatures[0] });
  }
  return json({ error: 'not found' }, 404);
}

/** /mcp and /api/repos: the registry's own /mcp and /repos, as they answer. */
async function registry(req, path) {
  const u = new URL(req.url), to = new URL(path === '/mcp' ? '/mcp' : '/repos', REGISTRY);
  to.search = u.search;
  const res = await fetch(new Request(to, req));
  return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...CORS } });
}

export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    if (req.method === 'OPTIONS' && (path === '/mcp' || path.startsWith('/api/'))) return new Response(null, { headers: CORS });
    if (path === '/mcp' || (path === '/api/repos' && req.method === 'GET')) return registry(req, path);
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(req);
    try { return await api(req, env, path); }
    catch (e) { return json({ error: e?.message ?? String(e) }, e?.status ?? 400); }
  },
};
