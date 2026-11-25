// Run: node worker/deploy.test.mjs
// Deploy requests (../../pricing.md): the config is checked and shaped as the ops repo reads it; the quote is free inside
// the network's free tier (a free mainnet app is read-only) and priced past it, testnet too; repos must exist on chain;
// one pending request per wallet; free slots are capped fleet-wide; a paid request is a 402 until an x402 payment
// verifies and settles; and the PR is opened on a fake GitHub, which gives the branch back when the PR fails.
import assert from 'node:assert';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { recoverTypedDataAddress } from 'viem';
import { appOf, deployedName } from '../src/deploy.js';
import { quote, freeOf, dueFor } from '../src/pricing.js';
import { deploy, usageOf, ledger, requirementsOf, USDC } from './deploy.js';

const A = '0x7699006DAD0cC3d9b898F5362E8f11e8d8C89930', B = '0x1111111111111111111111111111111111111111';

// The config.
assert.deepEqual(appOf({ name: 'watch-room', network: 'baseSepolia', follow: `${A}/watchroom\n${A}/watchroom`, publishPerDay: 10, publishView: 'watchroom-view' }), {
  name: 'watch-room', config: { network: 'baseSepolia', follow: [`${A}/watchroom`], publishView: 'watchroom-view', publishPerDay: 10 },
});
assert.deepEqual(appOf({ name: 'x', title: 'X marks', network: 'base', follow: [`${A}/x`] }).config, { name: 'X marks', network: 'base', follow: [`${A}/x`] });
for (const [input, why] of [
  [{ name: 'Bad_Name' }, /name/], [{ name: 'app-sepolia' }, /-sepolia/], [{ network: 'arbitrum' }, /network/],
  [{ follow: ['*'] }, /follow/], [{ follow: [`${A}/lb-*`] }, /follow/], [{ follow: [] }, /follow/], [{ publishPerDay: 1.5 }, /publishPerDay/],
]) assert.throws(() => appOf({ name: 'app', network: 'base', follow: [`${A}/x`], ...input }), why);
assert.equal(deployedName('app', 'base'), 'app');
assert.equal(deployedName('app', 'baseSepolia'), 'app-sepolia');

// The quote.
const reader = { follows: 2, events: 500, searches: 200, publish: 0, storage: 0, view: false };
for (const network of ['base', 'baseSepolia']) assert.equal(quote({ ...reader, network }).monthly, 0, `a small read-only index is free on ${network}`);
assert.ok(quote({ ...reader, network: 'base', publish: 1 }).paid, 'a free mainnet app is read-only: no gas');
assert.ok(quote({ ...reader, network: 'base', storage: 0.01 }).paid, 'and no uploads');
assert.ok(!quote({ ...reader, network: 'baseSepolia', publish: 10, storage: 0.1 }).paid, 'testnet may publish a little');
assert.ok(quote({ ...reader, network: 'baseSepolia', publish: 11 }).paid);
assert.equal(freeOf('base').publish, 0);
const big = { follows: 5, events: 5000, searches: 3000, publish: 500, storage: 10, view: false };
const main = quote({ ...big, network: 'base' }), test = quote({ ...big, network: 'baseSepolia' });
assert.ok(test.paid && test.monthly > 0, 'testnet is priced: Cloudflare costs the same');
assert.equal(test.gasDeposit, 0, 'testnet gas is on us');
assert.ok(main.gasDeposit > 0);
assert.equal(dueFor(main, 3), Math.round((main.monthly + main.gasDeposit) * 3 * 100) / 100);
assert.ok(quote({ ...reader, network: 'base', view: true }).paid, 'a view on mainnet spends gas: not free');
assert.match(quote({ ...big, network: 'base', events: 20000 }).talk.join(), /index past/);
assert.deepEqual(usageOf({ network: 'base', follow: ['a', 'b'], publishPerDay: 3 }, { events: -4, searches: '7' }),
  { network: 'base', follows: 2, publish: 3, view: false, events: 0, searches: 7, storage: 0 });

// The x402 requirement, and the signature the page makes (src/pay.js's typed data) recovers to the payer.
const req = requirementsOf({ due: 12.34, payTo: B, network: 'base', resource: 'https://fangorn.network/api/deploy', description: 'x' });
assert.equal(req.maxAmountRequired, '12340000');
assert.equal(req.asset, USDC.base.asset);
{
  const payer = privateKeyToAccount(generatePrivateKey());
  const types = { TransferWithAuthorization: [['from', 'address'], ['to', 'address'], ['value', 'uint256'], ['validAfter', 'uint256'], ['validBefore', 'uint256'], ['nonce', 'bytes32']].map(([name, type]) => ({ name, type })) };
  const domain = { name: req.extra.name, version: req.extra.version, chainId: 8453, verifyingContract: req.asset };
  const message = { from: payer.address, to: B, value: 12340000n, validAfter: 0n, validBefore: 9999999999n, nonce: `0x${'ab'.repeat(32)}` };
  const signature = await payer.signTypedData({ domain, types, primaryType: 'TransferWithAuthorization', message });
  assert.equal(await recoverTypedDataAddress({ domain, types, primaryType: 'TransferWithAuthorization', message, signature }), payer.address);
}

// The flow, on fakes.
function fakeGitHub({ taken = [], branches = [], prStatus = 201, pulls = {} } = {}) {
  const files = {}, refs = new Set(branches), opened = [];
  let next = 7;
  const gh = async (method, path, body) => {
    const contents = path.match(/\/contents\/(.+?)(\?|$)/)?.[1];
    if (method === 'GET' && contents) return { status: taken.includes(contents) ? 200 : 404, body: {} };
    if (method === 'GET' && path.endsWith('/git/ref/heads/main')) return { status: 200, body: { object: { sha: 'abc' } } };
    if (method === 'GET' && path.includes('/git/ref/heads/')) return { status: refs.has(`refs/heads/${path.split('/git/ref/heads/')[1]}`) ? 200 : 404, body: {} };
    if (method === 'GET' && path.includes('/pulls/')) return { status: 200, body: pulls[path.split('/pulls/')[1]] ?? { state: 'open' } };
    if (method === 'POST' && path.endsWith('/git/refs')) {
      if (refs.has(body.ref)) return { status: 422, body: {} };
      refs.add(body.ref); return { status: 201, body: {} };
    }
    if (method === 'DELETE') { refs.delete(`refs/${path.split('/git/refs/')[1]}`); return { status: 204, body: null }; }
    if (method === 'PUT' && contents) { files[contents] = JSON.parse(Buffer.from(body.content, 'base64').toString()); return { status: 201, body: {} }; }
    if (method === 'POST' && path.endsWith('/pulls')) {
      if (prStatus !== 201) return { status: prStatus, body: {} };
      opened.push(body); const number = next++;
      return { status: 201, body: { html_url: `https://github.com/o/r/pull/${number}`, number } };
    }
    return { status: 500, body: {} };
  };
  return { gh, files, refs, opened };
}
const memKV = () => { const m = new Map(); return { m, get: async (k) => m.get(k) ?? null, put: async (k, v) => void m.set(k, v), delete: async (k) => void m.delete(k), list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }) }; };
const onChain = (empty = []) => ({ headOf: async (net, p, r) => !empty.includes(`${p}/${r}`) });
const settles = (overrides = {}) => {
  const seen = [];
  return { seen, verify: async (p, r) => (seen.push(['verify', p, r]), { isValid: true, payer: A, ...overrides.verify }), settle: async (p, r) => (seen.push(['settle', p, r]), { success: true, transaction: '0xfeed', network: 'base', ...overrides.settle }) };
};
const ctxOf = (o = {}) => ({ gh: fakeGitHub().gh, chain: onChain(), kv: ledger(memKV()), pay: settles(), payTo: B, repo: 'o/r', now: new Date('2026-11-24T00:00:00Z'), ...o });
const free = { name: 'kelp', network: 'baseSepolia', follow: [`${A}/kelp`], publishPerDay: 5, usage: { events: 100, searches: 50 } };
const paid = { ...free, name: 'kelp-pro', usage: { events: 5000, searches: 3000, storage: 1 } };
const header = btoa(JSON.stringify({ x402Version: 1, scheme: 'exact', network: 'base', payload: { signature: '0x', authorization: {} } }));

{ // Free: the PR, the config with billing, the ledger.
  const g = fakeGitHub(), kv = memKV();
  const out = await deploy(ctxOf({ gh: g.gh, kv: ledger(kv) }), A, free, null);
  assert.deepEqual(out, { url: 'https://github.com/o/r/pull/7', number: 7, name: 'kelp', deployed: 'kelp-sepolia' });
  assert.deepEqual(g.files['apps/kelp.json'], { network: 'baseSepolia', follow: [`${A}/kelp`], publishPerDay: 5, billing: { owner: A, plan: 'free' } });
  assert.match(g.opened[0].title, /Deploy kelp-sepolia \(free\)/);
  assert.deepEqual(JSON.parse(kv.m.get(`free:kelp`)), { owner: A, pr: 7 });
  // One pending request per wallet: a second waits while the first is open.
  await assert.rejects(deploy(ctxOf({ gh: g.gh, kv: ledger(kv) }), A, { ...free, name: 'kelp-two' }, null), /one at a time/);
  // Once it's merged (or closed), the next one goes.
  const g2 = fakeGitHub({ pulls: { 7: { state: 'closed', merged_at: '2026-11-25' } } });
  assert.equal((await deploy(ctxOf({ gh: g2.gh, kv: ledger(kv) }), A, { ...free, name: 'kelp-two' }, null)).name, 'kelp-two');
}
{ // Free slots: full is full, except for slots held by requests closed without merging.
  const kv = memKV(), l = ledger(kv);
  await l.record(B, 'a', 1, true); await l.record(B, 'b', 2, true);
  await assert.rejects(deploy(ctxOf({ kv: l, slots: 2 }), A, free, null), (e) => e.status === 503 && /free slot/.test(e.message));
  const g = fakeGitHub({ pulls: { 2: { state: 'closed', merged_at: null } } });
  assert.equal((await deploy(ctxOf({ gh: g.gh, kv: l, slots: 2 }), A, free, null)).name, 'kelp');
  assert.ok(!kv.m.has('free:b') && kv.m.has('free:kelp'));
}
{ // Paid: a 402 with the requirement first, and nothing opened or charged.
  const g = fakeGitHub(), pay = settles();
  const e = await deploy(ctxOf({ gh: g.gh, pay }), A, { ...paid, months: 3 }, null).catch((x) => x);
  assert.equal(e.status, 402);
  const q = quote(usageOf(appOf(paid).config, paid.usage));
  assert.equal(e.body.due, dueFor(q, 3));
  assert.equal(e.body.accepts[0].maxAmountRequired, String(Math.round(dueFor(q, 3) * 1e6)));
  assert.equal(e.body.accepts[0].network, 'base', 'testnet apps pay in mainnet USDC');
  assert.equal(g.opened.length + pay.seen.length, 0);
  // With the payment: verified, settled, then the PR, with what it's paid through.
  const out = await deploy(ctxOf({ gh: g.gh, pay }), A, { ...paid, months: 3 }, header);
  assert.equal(out.transaction, '0xfeed');
  assert.deepEqual(pay.seen.map((s) => s[0]), ['verify', 'settle']);
  assert.deepEqual(g.files['apps/kelp-pro.json'].billing, { owner: A, plan: 'paid', paidThrough: '2027-02-24', payment: '0xfeed' });
  assert.match(g.opened[0].body, /0xfeed/);
}
{ // A payment that doesn't verify or settle opens nothing.
  for (const pay of [settles({ verify: { isValid: false, invalidReason: 'insufficient_funds' } }), settles({ settle: { success: false, errorReason: 'nonce used' } })]) {
    const g = fakeGitHub();
    await assert.rejects(deploy(ctxOf({ gh: g.gh, pay }), A, paid, header), (e) => e.status === 402 && e.body.accepts.length === 1);
    assert.equal(g.opened.length, 0);
  }
  await assert.rejects(deploy(ctxOf({ payTo: undefined }), A, paid, header), (e) => e.status === 503);
  await assert.rejects(deploy(ctxOf(), A, { ...paid, months: 2 }, header), /months/);
}
// Names and repos.
await assert.rejects(deploy(ctxOf({ gh: fakeGitHub({ taken: ['apps/kelp.json'] }).gh }), A, free, null), (e) => e.status === 409);
await assert.rejects(deploy(ctxOf({ gh: fakeGitHub({ taken: ['apps/kelp'] }).gh }), A, free, null), (e) => e.status === 409);
await assert.rejects(deploy(ctxOf({ gh: fakeGitHub({ branches: ['refs/heads/deploy/kelp'] }).gh }), A, free, null), /already requested/);
await assert.rejects(deploy(ctxOf({ chain: onChain([`${A}/kelp`]) }), A, free, null), /no commits/);
await assert.rejects(deploy(ctxOf(), A, { ...free, follow: ['nope'] }, null), (e) => e.status === 400);
await assert.rejects(deploy(ctxOf(), A, { ...free, usage: { events: 200000 } }, null), /self-serve/);
{ // A failed PR gives the name back, and records no slot.
  const g = fakeGitHub({ prStatus: 422 }), kv = memKV();
  await assert.rejects(deploy(ctxOf({ gh: g.gh, kv: ledger(kv) }), A, free, null), (e) => e.status === 502);
  assert.ok(!g.refs.has('refs/heads/deploy/kelp'));
  assert.equal(kv.m.size, 0);
}

console.log('deploy: ok');
