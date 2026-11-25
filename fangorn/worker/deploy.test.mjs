// Run: node worker/deploy.test.mjs
// Deploy requests: the config is checked and shaped as the ops repo reads it, the quote is free inside the free tier
// and priced past it (testnet too: only gas is free there), and the PR is opened on a fake GitHub, which also refuses
// taken names and gives the branch back when the PR fails.
import assert from 'node:assert';
import { appOf, deployedName } from '../src/deploy.js';
import { quote, FREE } from '../src/pricing.js';
import { openDeploy, usageOf } from './deploy.js';

const A = '0x7699006DAD0cC3d9b898F5362E8f11e8d8C89930';

// The config.
assert.deepEqual(appOf({ name: 'watch-room', network: 'baseSepolia', follow: `${A}/watchroom\n${A}/watchroom`, publishPerDay: 10, publishView: 'watchroom-view' }), {
  name: 'watch-room', config: { network: 'baseSepolia', follow: [`${A}/watchroom`], publishView: 'watchroom-view', publishPerDay: 10 },
});
assert.deepEqual(appOf({ name: 'x', title: 'X marks', network: 'base', follow: [`${A}/x`] }).config, { name: 'X marks', network: 'base', follow: [`${A}/x`] });
assert.throws(() => appOf({ name: 'Bad_Name', network: 'base', follow: [`${A}/x`] }), /name/);
assert.throws(() => appOf({ name: 'app-sepolia', network: 'base', follow: [`${A}/x`] }), /-sepolia/);
assert.throws(() => appOf({ name: 'app', network: 'arbitrum', follow: [`${A}/x`] }), /network/);
assert.throws(() => appOf({ name: 'app', network: 'base', follow: ['*'] }), /follow/);
assert.throws(() => appOf({ name: 'app', network: 'base', follow: [`${A}/lb-*`] }), /follow/);
assert.throws(() => appOf({ name: 'app', network: 'base', follow: [] }), /follow/);
assert.throws(() => appOf({ name: 'app', network: 'base', follow: [`${A}/x`], publishPerDay: 1.5 }), /publishPerDay/);
assert.equal(deployedName('app', 'base'), 'app');
assert.equal(deployedName('app', 'baseSepolia'), 'app-sepolia');

// The quote.
const small = { follows: 2, events: 500, searches: 200, publish: 5, storage: 0.5, view: false };
for (const network of ['base', 'baseSepolia']) assert.equal(quote({ ...small, network }).monthly, 0, `free on ${network}`);
const big = { follows: 5, events: 5000, searches: 3000, publish: 500, storage: 10, view: false };
const main = quote({ ...big, network: 'base' }), test = quote({ ...big, network: 'baseSepolia' });
assert.ok(test.paid && test.monthly > 0, 'testnet is priced: Cloudflare costs the same');
assert.equal(test.monthly, main.monthly, 'gas aside, the same price on both networks');
assert.equal(test.gasDeposit, 0);
assert.ok(main.gasDeposit > 0);
assert.ok(quote({ ...small, network: 'base', publish: FREE.publish + 1 }).paid);
assert.ok(quote({ ...small, network: 'base', view: true }).paid, 'a view on mainnet spends gas: not free');
assert.ok(!quote({ ...small, network: 'baseSepolia', view: true }).paid);
assert.match(quote({ ...big, network: 'base', events: 20000 }).talk.join(), /index past/);
assert.deepEqual(usageOf({ network: 'base', follow: ['a', 'b'], publishPerDay: 3 }, { events: -4, searches: '7' }),
  { network: 'base', follows: 2, publish: 3, view: false, events: 0, searches: 7, storage: 0 });

// The PR, on a fake GitHub.
function fakeGitHub({ taken = [], branches = [], prStatus = 201 } = {}) {
  const calls = [], files = {}, refs = new Set(branches);
  const gh = async (method, path, body) => {
    calls.push([method, path]);
    const contents = path.match(/\/contents\/(.+?)(\?|$)/)?.[1];
    if (method === 'GET' && contents) return { status: taken.includes(contents) ? 200 : 404, body: {} };
    if (method === 'GET' && path.endsWith('/git/ref/heads/main')) return { status: 200, body: { object: { sha: 'abc' } } };
    if (method === 'POST' && path.endsWith('/git/refs')) {
      if (refs.has(body.ref)) return { status: 422, body: {} };
      refs.add(body.ref); return { status: 201, body: {} };
    }
    if (method === 'DELETE') { refs.delete(`refs/${path.split('/git/refs/')[1]}`); return { status: 204, body: null }; }
    if (method === 'PUT' && contents) { files[contents] = { ...body, json: JSON.parse(Buffer.from(body.content, 'base64').toString()) }; return { status: 201, body: {} }; }
    if (method === 'POST' && path.endsWith('/pulls')) return prStatus === 201 ? { status: 201, body: { html_url: 'https://github.com/o/r/pull/7', number: 7, ...body } } : { status: prStatus, body: {} };
    return { status: 500, body: {} };
  };
  return { gh, calls, files, refs };
}

const request = { name: 'kelp', network: 'baseSepolia', follow: [`${A}/kelp`], publishPerDay: 5, usage: { events: 100, searches: 50 } };
{
  const g = fakeGitHub();
  const out = await openDeploy({ gh: g.gh, repo: 'o/r' }, A, request);
  assert.deepEqual(out, { url: 'https://github.com/o/r/pull/7', number: 7, name: 'kelp', deployed: 'kelp-sepolia' });
  assert.deepEqual(g.files['apps/kelp.json'].json, { network: 'baseSepolia', follow: [`${A}/kelp`], publishPerDay: 5 });
  assert.equal(g.files['apps/kelp.json'].branch, 'deploy/kelp');
  assert.ok(g.refs.has('refs/heads/deploy/kelp'));
}
{
  const pulls = [];
  const g = fakeGitHub(), gh = async (m, p, b) => { if (p.endsWith('/pulls')) pulls.push(b); return g.gh(m, p, b); };
  await openDeploy({ gh, repo: 'o/r' }, A, { ...request, usage: { events: 5000, searches: 3000, storage: 10 } });
  assert.match(pulls[0].title, /Deploy kelp-sepolia \(paid, \$\d+\/mo\)/);
  assert.match(pulls[0].body, /Payment pending/);
  assert.match(pulls[0].body, new RegExp(A));
}
await assert.rejects(openDeploy({ gh: fakeGitHub({ taken: ['apps/kelp.json'] }).gh }, A, request), (e) => e.status === 409);
await assert.rejects(openDeploy({ gh: fakeGitHub({ taken: ['apps/kelp'] }).gh }, A, request), (e) => e.status === 409);
await assert.rejects(openDeploy({ gh: fakeGitHub({ branches: ['refs/heads/deploy/kelp'] }).gh }, A, request), /already requested/);
{
  const g = fakeGitHub({ prStatus: 422 });
  await assert.rejects(openDeploy({ gh: g.gh }, A, request), (e) => e.status === 502);
  assert.ok(!g.refs.has('refs/heads/deploy/kelp'), 'a failed PR gives the name back');
}
await assert.rejects(openDeploy({ gh: fakeGitHub().gh }, A, { ...request, follow: ['nope'] }), (e) => e.status === 400);

console.log('deploy: ok');
