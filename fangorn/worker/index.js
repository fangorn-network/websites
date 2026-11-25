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
//   POST   /api/deploy  { name, network, follow, months?, … }  Authorization: <Privy access token>  [X-PAYMENT: <x402>]
//                       → { url, number, name, deployed }: a pull request to the ops repo adding apps/<name>.json
//                       (worker/deploy.js). A paid request without a payment → 402 with the x402 requirements.
//   GET|POST /api/apps, PATCH|DELETE /api/apps/<name>  Authorization: <Privy access token>
//                       self-serve apps in the pool: each a commit to the ops repo's main (worker/apps.js)
//
// Bindings: ASSETS, GRANTS (KV), PRIVY_APP_ID (var), and the secrets PRIVY_APP_SECRET and PRIVY_PRIVATE_KEY
// (the private half of the key quorum the site adds as a signer: VITE_FANGORN_SIGNER_ID), and GITHUB_TOKEN (contents and
// pull requests: write, on the ops repo) for /api/deploy, with DEPLOYS (KV: free slots and pending requests), and the vars
// PAY_TO (where USDC goes), and optionally FREE_SLOTS, PAYMENT_NETWORK (base) and FACILITATOR_URL.

import { PrivyClient } from '@privy-io/node';
import { BaseSepoliaConfig } from '@fangorn-network/sdk';
import { grants, appOf, reposOf, perDayOf, updateFor, MAX_BATCH, PER_DAY as PER_DAY_DEFAULT } from './grants.js';
import { github, chain, facilitator, ledger, deploy, FREE_SLOTS } from './deploy.js';
import { apps, opsRepo, route as appsRoute } from './apps.js';

const REGISTRY = 'https://registry-sepolia.fangorn.network';

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization, mcp-protocol-version, x-payment', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE' };
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

/** A Privy access token → the person's Ethereum address: their Fangorn wallet, or else any wallet they linked. */
async function addressOf(privy, accessToken) {
  const { user_id } = await privy.client.utils().auth().verifyAccessToken(accessToken ?? '').catch(() => {
    throw Object.assign(new Error('sign in again'), { status: 401 });
  });
  const wallets = (await privy.client.users()._get(user_id)).linked_accounts.filter((a) => a.type === 'wallet' && a.chain_type === 'ethereum');
  const w = wallets.find((a) => a.connector_type === 'embedded') ?? wallets[0];
  if (!w) throw Object.assign(new Error('this account has no wallet: sign in with email'), { status: 403 });
  return w.address;
}

async function api(req, env, path) {
  const store = grants(env.GRANTS), body = ['POST', 'PATCH', 'DELETE'].includes(req.method) ? await req.json().catch(() => ({})) : {};
  if (path === '/api/grants') {
    const privy = privyOf(env), who = await walletOf(privy, bearer(req));
    if (req.method === 'POST') return json({ token: await store.issue(who, appOf(body.app), reposOf(body.repos), perDayOf(body.perDay)), address: who.address });
    if (req.method === 'DELETE') { await store.revoke(who.user, appOf(body.app)); return json({}); }
  }
  if (path === '/api/deploy' && req.method === 'POST') {
    if (!env.GITHUB_TOKEN || !env.DEPLOYS) return json({ error: 'deploying from the site is not set up yet' }, 503);
    const owner = await addressOf(privyOf(env), bearer(req));
    const ctx = {
      gh: github(env.GITHUB_TOKEN), repo: env.OPS_REPO || undefined, chain: chain(), kv: ledger(env.DEPLOYS),
      pay: facilitator(env.FACILITATOR_URL || undefined), payTo: env.PAY_TO, payNetwork: env.PAYMENT_NETWORK || 'base',
      slots: Number(env.FREE_SLOTS) || FREE_SLOTS, resource: new URL(req.url).href,
    };
    try { return json(await deploy(ctx, owner, body, req.headers.get('x-payment'))); }
    catch (e) { if (e.status === 402) return json(e.body, 402); throw e; }
  }
  if (path === '/api/apps' || path.startsWith('/api/apps/')) {
    if (!env.GITHUB_TOKEN) return json({ error: 'self-serve apps are not set up yet' }, 503);
    const owner = await addressOf(privyOf(env), bearer(req));
    const a = apps({ ops: opsRepo(github(env.GITHUB_TOKEN), env.OPS_REPO || undefined), chain: chain() });
    return json(await appsRoute(a, req.method, path, owner, body));
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
