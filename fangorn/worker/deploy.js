// POST /api/deploy: a deploy request from the site → a pull request to the ops repo adding apps/<name>.json. Merging
// it deploys the app (the ops repo's deploy workflow); its checks show the plan first. See ../../pricing.md.
//
//   free  one pending request per wallet, and a free slot open (FREE_SLOTS across the fleet), then the PR.
//   paid  x402: without X-PAYMENT, a 402 with the payment requirements (USDC on Base, `months` up front). With it,
//         verified and settled through the facilitator, then the PR. Payment is always mainnet USDC unless
//         PAYMENT_NETWORK says otherwise (testnet USDC is free).
// Before either: the config is checked, priced here again, its repos must exist on chain, and the name be unused.
// The PR is opened by GITHUB_TOKEN on a branch deploy/<name>. The config carries `billing`: who asked, the plan, and
// for a paid app what it's paid through and the payment's transaction.
// ponytail: a PR that fails after the payment settled is refunded by hand; the error names the transaction.

import { createPublicClient, http, keccak256, toHex } from 'viem';
import { SupportedNetworks } from '@fangorn-network/sdk/lib/config.js';
import { appOf, deployedName, NETWORKS, OPS_REPO } from '../src/deploy.js';
import { quote, usd, fmtN, dueFor, MONTHS } from '../src/pricing.js';

export const FREE_SLOTS = 50;
export const FACILITATOR = 'https://facilitator.payai.network';
// USDC, as x402's "exact" scheme signs it (EIP-3009 transferWithAuthorization): the token and its EIP-712 domain.
export const USDC = {
  base: { chainId: 8453, asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', name: 'USD Coin', version: '2' },
  'base-sepolia': { chainId: 84532, asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', name: 'USDC', version: '2' },
};

const fail = (status, message, body) => Object.assign(new Error(message), { status, ...(body && { body }) });
const b64 = (s) => { let out = ''; for (const b of new TextEncoder().encode(s)) out += String.fromCharCode(b); return btoa(out); };
const unb64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
const num = (v, max) => Math.min(max, Math.max(0, Number(v) || 0));
const day = (d) => d.toISOString().slice(0, 10);

/** A GitHub REST client on `token`: gh(method, path, body?) → { status, body }. */
export function github(token, fetcher = fetch) {
  return async (method, path, body) => {
    const res = await fetcher(`https://api.github.com${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28',
        'user-agent': 'fangorn-website', ...(body && { 'content-type': 'application/json' }),
      },
      body: body && JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
}

/** Repo heads on chain: headOf(network, publisher, repo) → whether it has a commit. */
export function chain() {
  const clients = {};
  const abi = [{ type: 'function', name: 'getHead', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'bytes32' }], outputs: [{ type: 'uint64' }, { type: 'bytes32' }] }];
  return {
    async headOf(network, publisher, repo) {
      const net = SupportedNetworks[network];
      clients[network] ??= createPublicClient({ chain: net.chain, transport: http(net.rpcUrl) });
      const [, head] = await clients[network].readContract({ address: net.dataRegistryContractAddress, abi, functionName: 'getHead', args: [publisher.toLowerCase(), keccak256(toHex(repo))] });
      return !/^0x0*$/.test(head);
    },
  };
}

/** The x402 facilitator: verify and settle a payment against its requirements. */
export function facilitator(url = FACILITATOR, fetcher = fetch) {
  const call = async (path, paymentPayload, paymentRequirements) => {
    const res = await fetcher(`${url}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x402Version: 1, paymentPayload, paymentRequirements }) });
    const out = await res.json().catch(() => null);
    if (!out) throw fail(502, `the payment facilitator answered ${res.status}`);
    return out;
  };
  return { verify: (p, r) => call('verify', p, r), settle: (p, r) => call('settle', p, r) };
}

/** What a deploy needs in KV (DEPLOYS): free:<name> → { owner, pr } per free app; pending:<owner> → { name, pr }. */
export function ledger(kv) {
  return {
    pending: async (owner) => JSON.parse(await kv.get(`pending:${owner.toLowerCase()}`) ?? 'null'),
    free: async () => (await kv.list({ prefix: 'free:' })).keys.map((k) => k.name.slice(5)),
    freeOf: async (name) => JSON.parse(await kv.get(`free:${name}`) ?? 'null'),
    drop: (name) => kv.delete(`free:${name}`),
    record: async (owner, name, pr, free) => {
      await kv.put(`pending:${owner.toLowerCase()}`, JSON.stringify({ name, pr }));
      if (free) await kv.put(`free:${name}`, JSON.stringify({ owner, pr }));
    },
  };
}

/** The usage the quote is for: what the page asked about, plus what the config itself says. */
export const usageOf = (config, usage = {}) => ({
  network: config.network, follows: config.follow.length, publish: config.publishPerDay ?? 0, view: Boolean(config.publishView),
  events: num(usage.events, 1e7), searches: num(usage.searches, 1e7), storage: num(usage.storage, 1e5),
});

/** x402 payment requirements for `due` USD of USDC on `network`, to `payTo`. */
export function requirementsOf({ due, payTo, network = 'base', resource, description }) {
  const t = USDC[network];
  if (!t) throw fail(503, `payments on ${network} aren't supported`);
  return {
    scheme: 'exact', network, maxAmountRequired: String(Math.round(due * 1e6)), resource, description, mimeType: 'application/json',
    payTo, maxTimeoutSeconds: 300, asset: t.asset, extra: { name: t.name, version: t.version },
  };
}

export function bodyOf({ name, config, usage, q, months, payment }) {
  const net = NETWORKS[config.network], dn = deployedName(name, config.network), b = config.billing;
  const status = !q.paid ? 'Free tier.'
    : `**Paid: ${usd(q.monthly)}/month** for ${months} month${months > 1 ? 's' : ''}, through ${b.paidThrough}.` +
      ` Paid ${usd(payment.due)} in USDC: \`${payment.transaction}\` on ${payment.network}.` +
      (q.gasDeposit ? ` That includes a ${usd(q.gasDeposit * months)} gas deposit: fund the app's gas wallet with it after deploying.` : '');
  return [
    'Deploy request from fangorn.network/#/deploy.',
    '',
    `- **App:** \`${name}\` on ${net}, at https://${dn}.fangorn.network`,
    `- **Requested by:** \`${b.owner}\``,
    `- **Follows:** ${config.follow.map((f) => `\`${f}\``).join(', ')}`,
    `- **Publishes a day (we pay gas):** ${fmtN(config.publishPerDay ?? 0)}${config.publishView ? ` · view published to \`${config.publishView}\`` : ''}`,
    `- **Expected usage:** ${fmtN(usage.events)} new records a day, ${fmtN(usage.searches)} searches a day, ${fmtN(usage.storage)} GB of files`,
    '',
    status,
    '',
    'Before merging: check that the follow set isn\'t one an existing app already covers.',
    '',
    '| Item | Our cost | Price |', '|---|---:|---:|',
    ...q.lines.map((l) => `| ${l.name} (${l.usage}) | ${usd(l.cost)} | ${usd(l.price)} |`),
    `| Gas | ${usd(q.gas)} | ${q.gasDeposit ? `${usd(q.gasDeposit)} deposit` : '$0'} |`,
    ...(q.platformFee ? [`| Platform fee | | ${usd(q.platformFee)} |`] : []),
    `| **Total a month** | ${usd(q.cost)} | **${usd(q.monthly)}** |`,
  ].join('\n');
}

/** Whether PR `number` is still open. */
const isOpen = async (gh, repo, number) => (await gh('GET', `/repos/${repo}/pulls/${number}`)).body?.state === 'open';

/**
 * A deploy request: checked, priced, paid or given a free slot, and opened as a PR.
 * `ctx`: { gh, chain, kv (a ledger), pay (a facilitator), payTo, payNetwork, slots, repo, base, now, resource }.
 * `payment`: the X-PAYMENT header, or null. → { url, number, name, deployed, transaction? }
 * Throws 402 (with `body`: the x402 requirements) when a paid request comes without a payment, or it doesn't verify.
 */
export async function deploy(ctx, owner, input, payment) {
  const { gh, repo = OPS_REPO, base = 'main', kv, slots = FREE_SLOTS, now = new Date() } = ctx;
  const { name, config } = appOf(input);
  const months = input.months == null ? 1 : Number(input.months);
  if (!MONTHS.includes(months)) throw fail(400, `months: ${MONTHS.join(', ')}`);
  const usage = usageOf(config, input.usage), q = quote(usage);
  if (q.talk.length) throw fail(400, `${q.talk.join('; ')}: that's past self-serve, so get in touch for a quote`);

  // The name: not an app (a file or a folder, on either network), and not already requested.
  for (const p of [`apps/${name}.json`, `apps/${name}`]) {
    const r = await gh('GET', `/repos/${repo}/contents/${p}?ref=${base}`);
    if (r.status === 200) throw fail(409, `there's already an app called "${name}": pick another name`);
    if (r.status !== 404) throw fail(502, `GitHub answered ${r.status} looking up ${p}`);
  }
  const branch = `deploy/${name}`;
  if ((await gh('GET', `/repos/${repo}/git/ref/heads/${branch}`)).status === 200) throw fail(409, `"${name}" is already requested and waiting for review: pick another name`);
  // Its repos: each on chain, with a commit. An index of nothing is no app.
  for (const f of config.follow) {
    const [publisher, r] = f.split('/');
    if (!await ctx.chain.headOf(config.network, publisher, r)) throw fail(400, `${f} has no commits on ${NETWORKS[config.network]} yet: publish to it first`);
  }
  // One pending request per wallet.
  const pending = await kv.pending(owner);
  if (pending && await isOpen(gh, repo, pending.pr)) throw fail(409, `you already have a request waiting for review (${pending.name}, #${pending.pr}): one at a time`);

  let paid = null;
  if (!q.paid) {
    // A free slot. When they look full, free the slots of free requests closed without merging, then count again.
    let taken = await kv.free();
    if (taken.length >= slots) {
      for (const n of taken) {
        const e = await kv.freeOf(n), pr = e && (await gh('GET', `/repos/${repo}/pulls/${e.pr}`)).body;
        if (pr?.state === 'closed' && !pr.merged_at) await kv.drop(n);
      }
      taken = await kv.free();
    }
    if (taken.length >= slots) throw fail(503, 'every free slot is taken right now. A paid app can deploy today, or try again later');
  } else {
    if (!ctx.payTo) throw fail(503, 'payments are not set up yet');
    const due = dueFor(q, months);
    const req = requirementsOf({ due, payTo: ctx.payTo, network: ctx.payNetwork, resource: ctx.resource ?? 'https://fangorn.network/api/deploy', description: `Fangorn app ${name}, ${months} month${months > 1 ? 's' : ''}` });
    const ask = (error) => fail(402, error, { error, x402Version: 1, accepts: [req], due });
    if (!payment) throw ask('payment required');
    let p;
    try { p = JSON.parse(unb64(payment)); } catch { throw ask('X-PAYMENT is not base64 JSON'); }
    const v = await ctx.pay.verify(p, req);
    if (!v.isValid) throw ask(`the payment didn't verify: ${v.invalidReason ?? 'no reason given'}`);
    const s = await ctx.pay.settle(p, req);
    if (!s.success) throw ask(`the payment didn't settle: ${s.errorReason ?? 'no reason given'}`);
    paid = { due, transaction: s.transaction, network: s.network ?? req.network, payer: s.payer ?? v.payer };
  }

  const through = new Date(now); through.setUTCMonth(through.getUTCMonth() + months);
  config.billing = { owner, plan: q.paid ? 'paid' : 'free', ...(paid && { paidThrough: day(through), payment: paid.transaction }) };
  const head = await gh('GET', `/repos/${repo}/git/ref/heads/${base}`);
  const after = paid ? ` Your payment (${paid.transaction}) is recorded: get in touch and we'll sort it out.` : '';
  if (head.status !== 200) throw fail(502, `GitHub answered ${head.status} reading ${base}.${after}`);
  const ref = await gh('POST', `/repos/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: head.body.object.sha });
  if (ref.status !== 201) throw fail(ref.status === 422 ? 409 : 502, `couldn't make the branch (GitHub answered ${ref.status}).${after}`);
  try {
    const file = await gh('PUT', `/repos/${repo}/contents/apps/${name}.json`, {
      message: `apps: add ${name}`, branch, content: b64(`${JSON.stringify(config, null, 4)}\n`),
    });
    if (file.status !== 201) throw fail(502, `GitHub answered ${file.status} adding apps/${name}.json.${after}`);
    const pr = await gh('POST', `/repos/${repo}/pulls`, {
      title: `Deploy ${deployedName(name, config.network)} (${q.paid ? `paid, ${usd(q.monthly)}/mo` : 'free'})`, head: branch, base,
      body: bodyOf({ name, config, usage, q, months, payment: paid }),
    });
    if (pr.status !== 201) throw fail(502, `GitHub answered ${pr.status} opening the pull request.${after}`);
    await kv.record(owner, name, pr.body.number, !q.paid);
    return { url: pr.body.html_url, number: pr.body.number, name, deployed: deployedName(name, config.network), ...(paid && { transaction: paid.transaction }) };
  } catch (e) {
    // Without a PR, the branch would hold the name forever: take it back so the person can try again.
    await gh('DELETE', `/repos/${repo}/git/refs/heads/${branch}`).catch(() => {});
    throw e;
  }
}
