// fangorn.network's Worker: the site (dist/, as before); the registry of every repo (worker/registry.js), for
// people at /api/repos and for agents at /mcp; and /api, where apps get people's updates signed.
//
//   cron, every minute                   restitch every repo, re-read moved repos' agent cards, embed (Workers AI)
//   GET    /api/repos?q=&publisher=&k=   → { stitch, repos }: repos by meaning, or newest first without q
//   POST   /mcp                          the registry as MCP tools: find, repo, read (worker/mcp.js)
//
//   POST   /api/grants  { app, repos }   Authorization: <Privy access token>  → { token, address }   (from this site)
//   DELETE /api/grants  { app }          Authorization: <Privy access token>  → {}                    (from this site)
//   GET    /api/grant                    Authorization: Bearer <grant token>  → { address, app, repos } (from an app)
//   POST   /api/sign    { message }      Authorization: Bearer <grant token>  → { signature }          (from an app)
//
// /api/sign takes an Update's message (publisher, repo, epoch, parent, diff, root, car; epoch as a decimal string),
// checks it against the grant (worker/grants.js), and signs it as the person's embedded wallet through Privy,
// with Fangorn's authorization key. The app relays it (updateBySig) itself or through Barliman.
//
// Bindings: ASSETS, GRANTS (KV), REGISTRY (D1), AI (Workers AI), PRIVY_APP_ID (var), and the secrets PRIVY_APP_SECRET and PRIVY_PRIVATE_KEY
// (the private half of the key quorum the site adds as a signer: VITE_FANGORN_SIGNER_ID).

import { PrivyClient } from '@privy-io/node';
import { Fangorn, BaseSepoliaConfig } from '@fangorn-network/sdk';
import { generatePrivateKey } from 'viem/accounts';
import { grants, appOf, reposOf, updateFor } from './grants.js';
import { registry } from './registry.js';
import { mcpCall } from './mcp.js';

// Reading and stitching need no key of ours: a throwaway one signs the stitch's storage uploads, and nothing else.
const fangornOf = () => Fangorn.create({ privateKey: generatePrivateKey(), config: BaseSepoliaConfig, storage: { signedUrl: {} } });
// EmbeddingGemma-300m, prompted and truncated to 256 dims as everywhere else on Fangorn (westmarch, the indexer).
const AI_MODEL = '@cf/google/embeddinggemma-300m', DOCUMENT = 'title: none | text: ', QUERY = 'task: search result | query: ';
const matryoshka = (v, dim = 256) => { const o = Array.from(v.slice(0, dim), Number), n = Math.hypot(...o) || 1; return o.map((x) => x / n); };
const embedder = (env, prompt) => async (texts) => (await env.AI.run(AI_MODEL, { text: texts.map((t) => prompt + t) })).data.map((v) => matryoshka(v));

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
  if (path === '/api/repos' && req.method === 'GET') {
    const u = new URL(req.url), index = registry({ db: env.REGISTRY }), q = u.searchParams.get('q');
    const repos = await index.find({ q: q ? (await embedder(env, QUERY)([q]))[0] : null, publisher: u.searchParams.get('publisher') || undefined, k: Math.min(Number(u.searchParams.get('k')) || 20, 100) });
    return json({ stitch: await index.stitch(), repos });
  }
  const store = grants(env.GRANTS), body = req.method === 'POST' || req.method === 'DELETE' ? await req.json().catch(() => ({})) : {};
  if (path === '/api/grants') {
    const privy = privyOf(env), who = await walletOf(privy, bearer(req));
    if (req.method === 'POST') return json({ token: await store.issue(who, appOf(body.app), reposOf(body.repos)), address: who.address });
    if (req.method === 'DELETE') { await store.revoke(who.user, appOf(body.app)); return json({}); }
  }
  if (path === '/api/grant' && req.method === 'GET') {
    const g = await store.of(bearer(req));
    return g ? json({ address: g.address, app: g.app, repos: g.repos }) : json({ error: 'no such grant: connect again' }, 401);
  }
  if (path === '/api/sign' && req.method === 'POST') {
    const token = bearer(req), g = await store.of(token);
    if (!g) return json({ error: 'no such grant: connect again' }, 401);
    const typed = updateFor(g, body.message, BaseSepoliaConfig); // throws on anything the grant doesn't cover
    const privy = privyOf(env);
    await store.spend(token, g);
    const { signature } = await privy.client.wallets().ethereum().signTypedData(g.wallet, {
      params: { typed_data: { domain: typed.domain, types: typed.types, primary_type: typed.primaryType, message: { ...typed.message, epoch: typed.message.epoch.toString() } } },
      authorization_context: { authorization_private_keys: [privy.key] },
    });
    return json({ signature });
  }
  return json({ error: 'not found' }, 404);
}

async function mcp(req, env) {
  if (req.method !== 'POST') return new Response('POST JSON-RPC here (MCP streamable HTTP)', { status: 405, headers: { allow: 'POST', ...CORS } });
  let msg;
  try { msg = await req.json(); } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'not JSON' } }, 400); }
  if (Array.isArray(msg)) return json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'one message per request' } }, 400);
  const fangorn = fangornOf();
  const answer = await mcpCall({ index: registry({ db: env.REGISTRY }), query: async (t) => (await embedder(env, QUERY)([t]))[0], fangorn, gateway: fangorn.getConfig().ipfsGateway }, msg);
  return answer ? json(answer) : new Response(null, { status: 202, headers: CORS });
}

export default {
  async scheduled(_, env, ctx) {
    ctx.waitUntil((async () => {
      const index = registry({ db: env.REGISTRY, fangorn: fangornOf() });
      const moved = await index.update(), embedded = await index.embedMissing(embedder(env, DOCUMENT));
      if (moved || embedded) console.log(`registry: ${moved} repos moved, ${embedded} embedded`);
    })().catch((e) => console.error('registry:', e?.stack ?? e)));
  },

  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    if (req.method === 'OPTIONS' && (path === '/mcp' || path.startsWith('/api/'))) return new Response(null, { headers: CORS });
    if (path === '/mcp') return mcp(req, env);
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(req);
    try { return await api(req, env, path); }
    catch (e) { return json({ error: e?.message ?? String(e) }, e?.status ?? 400); }
  },
};
