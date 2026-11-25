// Run: node worker/apps.test.mjs
// Self-serve apps (worker/apps.js) on a fake GitHub: each change is a commit to main's apps/<name>.json, carrying
// owner and runtime "pool"; only the owner sees, changes or removes an app; names, caps and repos are checked first;
// publishing isn't self-serve; a stale sha is a 409.
import assert from 'node:assert';
import { apps, opsRepo, route } from './apps.js';

const A = '0x7699006DAD0cC3d9b898F5362E8f11e8d8C89930', ME = '0xAbC0000000000000000000000000000000000001', YOU = '0x2222222222222222222222222222222222222222';
const b64 = (s) => Buffer.from(s).toString('base64');

/** A fake GitHub contents API over one branch: files { path: text }, commits [message]. */
function fakeGitHub(files = {}) {
  const commits = []; let n = 0;
  const sha = (p) => `${p}@${files[p]?.length}`;
  const gh = async (method, url, body) => {
    const [, path] = url.match(/\/contents\/([^?]*)/) ?? [];
    if (method === 'GET' && path === 'apps') return { status: 200, body: Object.keys(files).filter((p) => p.startsWith('apps/')).map((p) => ({ name: p.split('/')[1], type: p.split('/').length > 2 ? 'dir' : 'file' })) };
    if (method === 'GET') {
      if (files[path] != null) return { status: 200, body: { content: b64(files[path]), sha: sha(path) } };
      if (Object.keys(files).some((p) => p.startsWith(`${path}/`))) return { status: 200, body: [] };
      return { status: 404 };
    }
    if (method === 'PUT' || method === 'DELETE') {
      if ((files[path] != null ? sha(path) : undefined) !== body.sha) return { status: 409 };
      if (method === 'PUT') files[path] = Buffer.from(body.content, 'base64').toString(); else delete files[path];
      commits.push(body.message);
      return { status: method === 'PUT' ? 201 : 200, body: { commit: { sha: `c${++n}` } } };
    }
    throw new Error(`${method} ${url}`);
  };
  return { gh, files, commits };
}
const onChain = (missing = []) => ({ headOf: async (_net, pub, repo) => !missing.includes(`${pub}/${repo}`) });

const g = fakeGitHub({ 'apps/watchroom.json': '{"network":"baseSepolia","follow":[]}', 'apps/big/index.json': '{}' });
const a = apps({ ops: opsRepo(g.gh), chain: onChain([`${A}/nothing`]), perOwner: 2 });

// Create.
const made = await a.create(ME, { name: 'kelp', network: 'baseSepolia', follow: `${A}/kelp`, title: 'Kelp surveys' });
assert.equal(made.url, 'https://kelp-sepolia.fangorn.network');
assert.equal(made.commit, 'c1');
assert.deepEqual(JSON.parse(g.files['apps/kelp.json']), { name: 'Kelp surveys', network: 'baseSepolia', follow: [`${A}/kelp`], runtime: 'pool', owner: ME });
assert.match(g.commits[0], /add kelp \(self-serve, for 0xAbC/);

for (const [input, status, why] of [
  [{ name: 'kelp' }, 409, /already/], [{ name: 'watchroom' }, 409, /already/], [{ name: 'big' }, 409, /already/],
  [{ name: 'void', follow: `${A}/nothing` }, 400, /no commits/],
  [{ name: 'pub', publishPerDay: 5 }, 400, /publishing/], [{ name: 'pub', publishView: 'v' }, 400, /publishing/],
  [{ name: 'Bad' }, 400, /name/],
]) await assert.rejects(a.create(ME, { network: 'baseSepolia', follow: `${A}/kelp`, ...input }), (e) => e.status === status && why.test(e.message));

await a.create(ME, { name: 'kelp-two', network: 'base', follow: [`${A}/kelp`] });
await assert.rejects(a.create(ME, { name: 'kelp-three', network: 'base', follow: [`${A}/kelp`] }), /2 apps already/);
await assert.rejects(apps({ ops: opsRepo(g.gh), chain: onChain(), selfServe: 2 }).create(YOU, { name: 'yours', network: 'base', follow: [`${A}/kelp`] }), /full/);

// List: mine only, case-insensitive on the address.
assert.deepEqual((await a.list(ME.toLowerCase())).map((x) => x.deployed).sort(), ['kelp-sepolia', 'kelp-two']);
assert.deepEqual(await a.list(YOU), []);

// Update: pause, resume, follow and title; a no-op makes no commit; someone else's app is a 404.
await a.update(ME, 'kelp', { paused: true });
assert.equal(JSON.parse(g.files['apps/kelp.json']).paused, true);
assert.match(g.commits.at(-1), /pause kelp/);
await a.update(ME, 'kelp', { paused: false });
assert.equal(JSON.parse(g.files['apps/kelp.json']).paused, undefined);
const before = g.commits.length;
assert.equal((await a.update(ME, 'kelp', { paused: false })).commit, null);
assert.equal(g.commits.length, before);
await a.update(ME, 'kelp', { follow: [`${A}/kelp`, `${A}/kelp-2`], title: '' });
assert.deepEqual(JSON.parse(g.files['apps/kelp.json']), { network: 'baseSepolia', follow: [`${A}/kelp`, `${A}/kelp-2`], runtime: 'pool', owner: ME });
await assert.rejects(a.update(ME, 'kelp', { follow: [`${A}/nothing`] }), /no commits/);
await assert.rejects(a.update(YOU, 'kelp', { paused: true }), (e) => e.status === 404);
await assert.rejects(a.update(ME, 'watchroom', { paused: true }), (e) => e.status === 404, 'an app with no owner is not self-serve');

// A stale write is a 409.
const stale = opsRepo(g.gh);
await assert.rejects(stale.put('kelp', {}, 'x', 'apps/kelp.json@1'), (e) => e.status === 409);

// Remove.
await assert.rejects(a.remove(YOU, 'kelp'), (e) => e.status === 404);
assert.equal((await a.remove(ME, 'kelp')).name, 'kelp');
assert.equal(g.files['apps/kelp.json'], undefined);

// Routes.
assert.deepEqual((await route(a, 'GET', '/api/apps', ME, {})).apps.map((x) => x.name), ['kelp-two']);
await assert.rejects(route(a, 'PUT', '/api/apps/kelp-two', ME, {}), (e) => e.status === 404);
console.log('apps ok');
