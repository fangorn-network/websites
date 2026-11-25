// What a hosted app (a westmarch Worker deployed from the ops repo) costs us a month, and what we charge for it.
// Shared by the deploy page (src/Deploy.jsx) and /api/deploy (worker/deploy.js), which quotes again rather than
// trusting the page's number.
//
// Price: free inside every FREE limit, on either network. Past any of them: PLATFORM_FEE plus MARKUP × our cost above
// the free allowance, per item. Gas is not revenue: publishes past the free ones, and the view's commits, are a
// deposit paid into the app's own gas wallet (with a buffer), and testnet gas is on us. Cloudflare bills the same on
// both networks, so everything else is priced the same on testnet.
//
// Costs are list prices, as if Cloudflare's account-wide allowances were already used up. Gas: a relayed
// updateBySig is ~160k gas cold (DataRegistry gas report), Base's base fee was 0.005 gwei on 2026-11-24.
// ponytail: the index size isn't asked for (nobody knows it up front, and it grows): it's INDEX_DAYS of new records.
// Bill search and D1 storage on the metered size once westmarch counts it.

export const DAYS = 30;
export const ASSUME = {
  markup: 3, platformFee: 9, gasBuffer: 0.25, indexDays: 90,
  ethUsd: 3000, gasGwei: 0.01, l1Usd: 0.001, gasPublish: 180_000, gasView: 110_000,
  rpcUsdPerMCU: 0, cuPerRunPerFollow: 60, cuPerRunBase: 10, // public RPC today: 0
  cfReqUsdPerM: 0.30, neuronsPerEmbed: 0.33, neuronUsdPer1k: 0.011,
  d1ReadUsdPerM: 0.001, d1WriteUsdPerM: 1.0, d1UsdPerGBmo: 0.75, rowsWrittenPerRecord: 4, bytesPerRecord: 2000,
  storageUsdPerGBmo: 0.02,
};
export const FREE = { follows: 3, events: 1000, searches: 1000, publish: 10, storage: 1 };
export const CAPS = { follows: 50, events: 100_000, searches: 200_000, publish: 10_000, storage: 100 };
export const MAX_INDEX = 1_000_000; // search reads every vector: past this it runs into Worker CPU limits
const LABEL = { follows: 'Repos followed', events: 'New records a day', searches: 'Searches a day', publish: 'Publishes a day', storage: 'File storage (GB)' };

export const fmtN = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
export const usd = (v) => v === 0 ? '$0' : v < 0.01 ? '<$0.01' : v < 10 ? `$${v.toFixed(2)}` : `$${Math.round(v).toLocaleString('en-US')}`;
const indexOf = (events, a) => events * a.indexDays;
// The view is published on every new root: at most once a cron run, and only when something landed.
const viewsPerDay = (u) => u.view ? Math.min(u.events, 1440) : 0;

/** Monthly cost of each item at usage `u`: { network, follows, events, searches, publish, storage, view }. */
export function costs(u, a = ASSUME) {
  const runs = 1440 * DAYS, records = indexOf(u.events, a);
  const cu = a.cuPerRunBase + a.cuPerRunPerFollow * u.follows;
  const embedUsd = a.neuronsPerEmbed / 1000 * a.neuronUsdPer1k;
  const txUsd = (gas) => u.network === 'base' ? gas * a.gasGwei * 1e-9 * a.ethUsd + a.l1Usd : 0;
  return {
    watch: runs * (cu / 1e6 * a.rpcUsdPerMCU + a.cfReqUsdPerM / 1e6),
    index: u.events * DAYS * (embedUsd + a.rowsWrittenPerRecord * a.d1WriteUsdPerM / 1e6),
    size: records * a.bytesPerRecord / 1e9 * a.d1UsdPerGBmo,
    search: u.searches * DAYS * (embedUsd + records * a.d1ReadUsdPerM / 1e6 + a.cfReqUsdPerM / 1e6),
    storage: u.storage * a.storageUsdPerGBmo,
    gas: u.publish * DAYS * txUsd(a.gasPublish),
    view: viewsPerDay(u) * DAYS * txUsd(a.gasView),
  };
}

/** The quote for usage `u`: { monthly, gasDeposit, paid, talk, lines, cost }. `talk` lists what's past self-serve. */
export function quote(u, a = ASSUME) {
  const full = costs(u, a), free = costs({ ...u, ...FREE, view: false }, a);
  const records = indexOf(u.events, a), freeReads = FREE.searches * indexOf(FREE.events, a);
  const over = {
    watch: u.follows > FREE.follows, index: u.events > FREE.events, size: u.events > FREE.events,
    search: u.searches * records > freeReads, storage: u.storage > FREE.storage,
    gas: u.publish > FREE.publish, view: Boolean(u.view) && u.network === 'base',
  };
  const freeSearch = FREE.searches * DAYS * (a.neuronsPerEmbed / 1000 * a.neuronUsdPer1k + a.cfReqUsdPerM / 1e6) + freeReads * DAYS * a.d1ReadUsdPerM / 1e6;
  const allowance = { ...free, search: freeSearch, view: 0 };
  const above = (k) => Math.max(0, full[k] - allowance[k]);
  const talk = Object.entries(CAPS).filter(([k, cap]) => u[k] > cap).map(([k, cap]) => `${LABEL[k]} above ${fmtN(cap)}`);
  if (records > MAX_INDEX) talk.push(`An index past ${fmtN(MAX_INDEX)} records within ${a.indexDays} days`);
  const paid = Object.values(over).some(Boolean);
  const lines = [
    ['watch', 'Watching the chain', `${fmtN(u.follows)} repos, checked every minute`],
    ['index', 'Indexing new records', `${fmtN(u.events)} a day`],
    ['size', 'Index storage', `~${fmtN(records)} records`],
    ['search', 'Search', `${fmtN(u.searches)} a day`],
    ['storage', 'File storage', `${fmtN(u.storage)} GB`],
  ].map(([key, name, usage]) => ({ key, name, usage, over: over[key], cost: full[key], price: paid ? a.markup * above(key) : 0 }));
  const gasDeposit = (above('gas') + full.view) * (1 + a.gasBuffer);
  const monthly = paid ? Math.ceil(a.platformFee + lines.reduce((s, l) => s + l.price, 0)) : 0;
  return { monthly, gasDeposit, paid, talk, lines, platformFee: paid ? a.platformFee : 0, gas: full.gas + full.view, cost: Object.values(full).reduce((s, v) => s + v, 0) };
}
