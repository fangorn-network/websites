// /api/apps: self-serve apps in the pool (../../pricing_3.md). Each app is still a file in the ops repo,
// apps/<name>.json, and every change is a commit to its main branch, made here as the signed-in person asked. The
// ops repo's deploy workflow runs on that push and syncs the app into westmarch-pool, at
// https://<deployed name>.fangorn.network, in about two minutes. Git stays the record: who asked, what changed, when.
//
//   GET    /api/apps                       → { apps: [{ name, deployed, url, config }] }: the caller's apps
//   POST   /api/apps     { name, network, follow, title?, instructions? }  → { name, deployed, url, commit }
//   PATCH  /api/apps/<name>  { paused?, follow?, title?, instructions? }  → { name, deployed, url, commit }
//   DELETE /api/apps/<name>                → { name, commit }
//
// Self-serve is the simple shape: free, read-only (no publishing, so no gas), named publisher/repo follows, in the
// pool. The file carries `owner` (the caller's wallet) and `runtime: "pool"`; ops strips both before the pool sees the
// config. Only the owner can change or remove an app from here; anything else goes through a PR to the ops repo.
// ponytail: an app's files can also be written by hand; a hand edit that drops `owner` takes it out of self-serve.

import { appOf, deployedName, NETWORKS, OPS_REPO } from '../src/deploy.js';

export const PER_OWNER = 3; // apps per wallet
export const SELF_SERVE = 50; // self-serve apps across the fleet

const fail = (status, message) => Object.assign(new Error(message), { status });
const b64 = (s) => { let out = ''; for (const b of new TextEncoder().encode(s)) out += String.fromCharCode(b); return btoa(out); };
const unb64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), (c) => c.charCodeAt(0)));
const same = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
const urlOf = (name, network) => `https://${deployedName(name, network)}.fangorn.network`;

/** The ops repo's apps/ through `gh` (worker/deploy.js's github()): read, list, write and delete app files on `base`. */
export function opsRepo(gh, repo = OPS_REPO, base = 'main') {
  const path = (name) => `/repos/${repo}/contents/apps/${name}.json`;
  return {
    /** apps/<name>.json → { config, sha }, or null. A folder app (apps/<name>/) is { folder: true }. */
    async get(name) {
      const r = await gh('GET', `${path(name)}?ref=${base}`);
      if (r.status === 200) return { config: JSON.parse(unb64(r.body.content)), sha: r.body.sha };
      if (r.status !== 404) throw fail(502, `GitHub answered ${r.status} reading apps/${name}.json`);
      const d = await gh('GET', `/repos/${repo}/contents/apps/${name}?ref=${base}`);
      if (d.status === 200) return { folder: true };
      if (d.status !== 404) throw fail(502, `GitHub answered ${d.status} reading apps/${name}`);
      return null;
    },
    /** Every apps/<name>.json: [{ name, config }]. Folder apps are never self-serve, so they're left out. */
    async list() {
      const r = await gh('GET', `/repos/${repo}/contents/apps?ref=${base}`);
      if (r.status !== 200) throw fail(502, `GitHub answered ${r.status} listing apps/`);
      const files = r.body.filter((f) => f.type === 'file' && f.name.endsWith('.json'));
      const out = [];
      for (let i = 0; i < files.length; i += 10) {
        out.push(...await Promise.all(files.slice(i, i + 10).map(async (f) => {
          const name = f.name.slice(0, -5), got = await this.get(name);
          return got?.config ? { name, config: got.config } : null;
        })));
      }
      return out.filter(Boolean);
    },
    /** Writes apps/<name>.json (sha: the version it replaces, or none for a new file) → the commit's sha. */
    async put(name, config, message, sha) {
      const r = await gh('PUT', path(name), { message, branch: base, content: b64(`${JSON.stringify(config, null, 4)}\n`), ...(sha && { sha }) });
      if (r.status === 409 || r.status === 422) throw fail(409, `apps/${name}.json changed while we were writing it: try again`);
      if (r.status !== 200 && r.status !== 201) throw fail(502, `GitHub answered ${r.status} writing apps/${name}.json`);
      return r.body.commit.sha;
    },
    async remove(name, message, sha) {
      const r = await gh('DELETE', path(name), { message, branch: base, sha });
      if (r.status === 409 || r.status === 422) throw fail(409, `apps/${name}.json changed while we were removing it: try again`);
      if (r.status !== 200) throw fail(502, `GitHub answered ${r.status} removing apps/${name}.json`);
      return r.body.commit.sha;
    },
  };
}

/** What a self-serve config may hold, from the request: appOf's checks, minus publishing (no gas in the free tier). */
function configOf(input) {
  if (Number(input.publishPerDay) || String(input.publishView ?? '').trim()) throw fail(400, 'publishing (publishPerDay, publishView) isn\'t self-serve yet: open a PR to the ops repo');
  const { name, config } = appOf(input);
  return { name, config };
}

const view = (name, config) => ({ name, deployed: deployedName(name, config.network), url: urlOf(name, config.network), config });

/**
 * Self-serve apps. `ctx`: { ops (opsRepo), chain (worker/deploy.js's chain()), perOwner?, selfServe? }.
 * Every method takes the caller's wallet address, already checked.
 */
export function apps(ctx) {
  const { ops, perOwner = PER_OWNER, selfServe = SELF_SERVE } = ctx;
  const mine = async (owner, name) => {
    const got = await ops.get(name);
    if (!got || got.folder || !same(got.config.owner, owner)) throw fail(404, `you have no app called "${name}"`);
    return got;
  };
  const checkRepos = async (config) => {
    for (const f of config.follow) {
      const [publisher, repo] = f.split('/');
      if (!await ctx.chain.headOf(config.network, publisher, repo)) throw fail(400, `${f} has no commits on ${NETWORKS[config.network]} yet: publish to it first`);
    }
  };
  return {
    async list(owner) {
      return (await ops.list()).filter((a) => same(a.config.owner, owner)).map((a) => view(a.name, a.config));
    },

    async create(owner, input) {
      const { name, config } = configOf(input);
      if (await ops.get(name)) throw fail(409, `there's already an app called "${name}": pick another name`);
      const all = (await ops.list()).filter((a) => a.config.owner);
      if (all.filter((a) => same(a.config.owner, owner)).length >= perOwner) throw fail(409, `you have ${perOwner} apps already, the most for now: remove one first`);
      if (all.length >= selfServe) throw fail(503, 'self-serve is full right now: try again later, or get in touch');
      await checkRepos(config);
      const file = { ...config, runtime: 'pool', owner };
      const commit = await ops.put(name, file, `apps: add ${name} (self-serve, for ${owner})`);
      return { ...view(name, file), commit };
    },

    async update(owner, name, input) {
      const { config: was, sha } = await mine(owner, name);
      const next = { ...was };
      if ('follow' in input || 'title' in input || 'instructions' in input) {
        const { config } = configOf({
          name, network: was.network,
          follow: input.follow ?? was.follow, title: 'title' in input ? input.title : was.name,
          instructions: 'instructions' in input ? input.instructions : was.instructions,
        });
        for (const k of ['name', 'follow', 'instructions']) delete next[k];
        Object.assign(next, config);
        if ('follow' in input) await checkRepos(next);
      }
      if ('paused' in input) { if (input.paused) next.paused = true; else delete next.paused; }
      if (JSON.stringify(next) === JSON.stringify(was)) return { ...view(name, was), commit: null };
      const what = 'paused' in input && Object.keys(input).length === 1 ? (input.paused ? 'pause' : 'resume') : 'update';
      const commit = await ops.put(name, next, `apps: ${what} ${name} (self-serve, for ${owner})`, sha);
      return { ...view(name, next), commit };
    },

    async remove(owner, name) {
      const { sha } = await mine(owner, name);
      return { name, commit: await ops.remove(name, `apps: remove ${name} (self-serve, for ${owner})`, sha) };
    },
  };
}

/** Routes /api/apps[/<name>] for `owner` → the response body. */
export async function route(a, method, path, owner, body) {
  const name = path.match(/^\/api\/apps\/([a-z0-9-]+)$/)?.[1];
  if (path === '/api/apps' && method === 'GET') return { apps: await a.list(owner) };
  if (path === '/api/apps' && method === 'POST') return a.create(owner, body);
  if (name && method === 'PATCH') return a.update(owner, name, body);
  if (name && method === 'DELETE') return a.remove(owner, name);
  throw fail(404, 'not found');
}
