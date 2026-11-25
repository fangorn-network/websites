// POST /api/deploy: a deploy request from the site → a pull request to the ops repo adding apps/<name>.json. Merging
// it deploys the app (the ops repo's deploy workflow); its checks show the plan first. Nothing deploys until a person
// (or the ops repo's automated review) merges.
//
// The PR is opened by GITHUB_TOKEN (contents: write and pull requests: write on the ops repo), on a branch
// deploy/<name>. The request's wallet, usage and quote go in the PR's body, quoted here again rather than taken from
// the page. ponytail: no payment yet; a paid quote's PR says payment is pending and a reviewer holds it.

import { appOf, deployedName, NETWORKS, OPS_REPO } from '../src/deploy.js';
import { quote, usd, fmtN } from '../src/pricing.js';

const fail = (status, message) => Object.assign(new Error(message), { status });
const b64 = (s) => { let out = ''; for (const b of new TextEncoder().encode(s)) out += String.fromCharCode(b); return btoa(out); };
const num = (v, max) => Math.min(max, Math.max(0, Number(v) || 0));

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

/** The usage the quote is for: what the page asked about, plus what the config itself says. */
export const usageOf = (config, usage = {}) => ({
  network: config.network, follows: config.follow.length, publish: config.publishPerDay ?? 0, view: Boolean(config.publishView),
  events: num(usage.events, 1e7), searches: num(usage.searches, 1e7), storage: num(usage.storage, 1e5),
});

export function bodyOf({ name, config, owner, usage, q }) {
  const net = NETWORKS[config.network], dn = deployedName(name, config.network);
  const status = q.talk.length ? `Past self-serve (${q.talk.join('; ')}): quote by hand.`
    : q.paid ? `**Paid: ${usd(q.monthly)}/month**${q.gasDeposit ? ` + ${usd(q.gasDeposit)}/month gas deposit` : ''}. Payment pending: don't merge until it's paid.`
      : 'Free tier.';
  return [
    `Deploy request from fangorn.network/#/deploy.`,
    '',
    `- **App:** \`${name}\` on ${net}, at https://${dn}.fangorn.network`,
    `- **Requested by:** \`${owner}\``,
    `- **Follows:** ${config.follow.map((f) => `\`${f}\``).join(', ')}`,
    `- **Publishes a day (we pay gas):** ${fmtN(config.publishPerDay ?? 0)}${config.publishView ? ` · view published to \`${config.publishView}\`` : ''}`,
    `- **Expected usage:** ${fmtN(usage.events)} new records a day, ${fmtN(usage.searches)} searches a day, ${fmtN(usage.storage)} GB of files`,
    '',
    status,
    '',
    '| Item | Our cost | Price |', '|---|---:|---:|',
    ...q.lines.map((l) => `| ${l.name} (${l.usage}) | ${usd(l.cost)} | ${usd(l.price)} |`),
    `| Gas | ${usd(q.gas)} | ${q.gasDeposit ? 'deposit' : '$0'} |`,
    ...(q.platformFee ? [`| Platform fee | | ${usd(q.platformFee)} |`] : []),
    `| **Total a month** | ${usd(q.cost)} | **${usd(q.monthly)}** |`,
  ].join('\n');
}

/**
 * Opens the PR for `input` (the page's request), on behalf of `owner` (their wallet address).
 * → { url, number, name, deployed }. 409 when the name is taken or already requested.
 */
export async function openDeploy({ gh, repo = OPS_REPO, base = 'main' }, owner, input) {
  const { name, config } = appOf(input);
  const usage = usageOf(config, input.usage), q = quote(usage);
  // Taken: a file or a folder app by that name (on either network: the file is per name).
  for (const p of [`apps/${name}.json`, `apps/${name}`]) {
    const r = await gh('GET', `/repos/${repo}/contents/${p}?ref=${base}`);
    if (r.status === 200) throw fail(409, `there's already an app called "${name}": pick another name`);
    if (r.status !== 404) throw fail(502, `GitHub answered ${r.status} looking up ${p}`);
  }
  const head = await gh('GET', `/repos/${repo}/git/ref/heads/${base}`);
  if (head.status !== 200) throw fail(502, `GitHub answered ${head.status} reading ${base}`);
  const branch = `deploy/${name}`;
  const ref = await gh('POST', `/repos/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: head.body.object.sha });
  if (ref.status === 422) throw fail(409, `"${name}" is already requested and waiting for review: pick another name`);
  if (ref.status !== 201) throw fail(502, `GitHub answered ${ref.status} making the branch`);
  try {
    const file = await gh('PUT', `/repos/${repo}/contents/apps/${name}.json`, {
      message: `apps: add ${name}`, branch, content: b64(`${JSON.stringify(config, null, 4)}\n`),
    });
    if (file.status !== 201) throw fail(502, `GitHub answered ${file.status} adding apps/${name}.json`);
    const tag = q.talk.length ? 'quote by hand' : q.paid ? `paid, ${usd(q.monthly)}/mo` : 'free';
    const pr = await gh('POST', `/repos/${repo}/pulls`, {
      title: `Deploy ${deployedName(name, config.network)} (${tag})`, head: branch, base,
      body: bodyOf({ name, config, owner, usage, q }),
    });
    if (pr.status !== 201) throw fail(502, `GitHub answered ${pr.status} opening the pull request`);
    return { url: pr.body.html_url, number: pr.body.number, name, deployed: deployedName(name, config.network) };
  } catch (e) {
    // Without a PR, the branch would hold the name forever: take it back so the person can try again.
    await gh('DELETE', `/repos/${repo}/git/refs/heads/${branch}`).catch(() => {});
    throw e;
  }
}
