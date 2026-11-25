// A deploy request → the ops repo's apps/<name>.json (github.com/fangorn-network/ops, README "Add an app"). Shared by
// the deploy page and /api/deploy, which checks again. Self-serve is the simple shape only: named publisher/repo
// follows (no wildcards, prefixes or whole publishers), no types, schemas or rules; those go through a PR by hand.

export const OPS_REPO = 'fangorn-network/ops';
export const NETWORKS = { baseSepolia: 'Base Sepolia', base: 'Base mainnet' };
const NAME = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;
const FOLLOW = /^0x[0-9a-fA-F]{40}\/[A-Za-z0-9._-]{1,100}$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;
const MAX_INSTRUCTIONS = 4000;

const fail = (message) => Object.assign(new Error(message), { status: 400 });

/** The deployed name: <name> on mainnet, <name>-sepolia on testnet. Also the app's subdomain. */
export const deployedName = (name, network) => network === 'base' ? name : `${name}-sepolia`;

/**
 * { name, title?, network, follow (array or newline/comma text), publishPerDay?, publishView?, instructions? }
 * → { name, config }: config is apps/<name>.json. Throws a 400 saying what's wrong.
 */
export function appOf(input = {}) {
  const name = String(input.name ?? '').trim();
  if (!NAME.test(name)) throw fail('name: lowercase letters, digits and dashes, up to 50, not starting or ending with a dash');
  if (name.endsWith('-sepolia')) throw fail('name: not ending in -sepolia (the network adds that)');
  if (!Object.hasOwn(NETWORKS, input.network)) throw fail(`network: ${Object.keys(NETWORKS).join(' or ')}`);
  const follow = [...new Set((Array.isArray(input.follow) ? input.follow : String(input.follow ?? '').split(/[\s,]+/)).map((f) => f.trim()).filter(Boolean))];
  if (!follow.length) throw fail('follow: at least one publisher/repo');
  for (const f of follow) if (!FOLLOW.test(f)) throw fail(`follow: "${f}" isn't <0x address>/<repo>`);
  const publishPerDay = Number(input.publishPerDay ?? 0);
  if (!Number.isInteger(publishPerDay) || publishPerDay < 0 || publishPerDay > 10_000) throw fail('publishPerDay: a whole number from 0 to 10,000');
  const publishView = String(input.publishView ?? '').trim();
  if (publishView && !REPO.test(publishView)) throw fail('publishView: a repo name (letters, digits, . _ -)');
  const title = String(input.title ?? '').trim().slice(0, 80);
  const instructions = String(input.instructions ?? '').trim();
  if (instructions.length > MAX_INSTRUCTIONS) throw fail(`instructions: up to ${MAX_INSTRUCTIONS} characters`);
  const config = {
    ...(title && { name: title }),
    network: input.network,
    follow,
    ...(publishView && { publishView }),
    ...(publishPerDay && { publishPerDay }),
    ...(instructions && { instructions }),
  };
  return { name, config };
}
