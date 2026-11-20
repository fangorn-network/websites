// Run: node src/fangorn.test.mjs
// Guards the invariants the account hub depends on:
//  1. the site runs against the Base Sepolia deployment, and reads Base mainnet's (DataRegistry only);
//  2. a publisher's file parses into the records it publishes;
//  3. earnings are the sales net of the referrer's cut;
//  4. the storage meter maths.
import assert from 'node:assert';

const { NETWORK, CHAIN } = await import('./fangorn.js');
assert.equal(CHAIN.id, 84532, 'Base Sepolia');
assert.match(NETWORK.dataRegistryContractAddress, /^0x[0-9a-fA-F]{40}$/);
assert.match(NETWORK.settlementRegistryContractAddress, /^0x[0-9a-fA-F]{40}$/);

// Base mainnet: the DataRegistry proxy, nothing to sell with. Testnet stays the default.
const { NETWORKS, DEFAULT_NET, sells } = await import('./fangorn.js');
assert.equal(DEFAULT_NET, 'baseSepolia');
assert.equal(NETWORKS.base.chain.id, 8453);
assert.equal(NETWORKS.base.dataRegistryContractAddress, '0x543D559Cf7583FE7003d4A19E26BF3A4DB75fbC8', 'the proxy, not its implementation');
assert.deepEqual([sells('baseSepolia'), sells('base')], [true, false]);

// Repo links name their network; links from before networks are testnet ones.
const { repoHref, parseRepoHash } = await import('./account.js');
const pub = '0x00000000000000000000000000000000000a11ce';
assert.equal(repoHref(pub, 'kelp surveys'), `#/data/baseSepolia/${pub}/kelp%20surveys`, 'testnet by default');
assert.deepEqual(parseRepoHash(repoHref(pub, 'kelp surveys', 'base')), { net: 'base', publisher: pub, repo: 'kelp surveys' });
assert.deepEqual(parseRepoHash(`#/data/${pub}/a/b`), { net: 'baseSepolia', publisher: pub, repo: 'a/b' }, 'an old link');

// A publisher's Updated logs decode in both versions (the registry was upgraded in place); only the new one has a timestamp.
{
  const { decodeUpdates } = await import('./account.js');
  const { encodeEventTopics, encodeAbiParameters, toHex } = await import('viem');
  const { UPDATED_V0 } = await import('@fangorn-network/sdk/lib/contracts/data-registry/index.js');
  const { DATA_REGISTRY_ABI } = await import('@fangorn-network/sdk/lib/contracts/data-registry/abi.js');
  const v1 = DATA_REGISTRY_ABI.find((i) => i.type === 'event' && i.name === 'Updated');
  const h = `0x${'ab'.repeat(32)}`;
  const raw = (event, data, n) => ({
    address: NETWORK.dataRegistryContractAddress, blockNumber: toHex(n), blockHash: h, transactionHash: h, transactionIndex: '0x0', logIndex: '0x0', removed: false,
    topics: encodeEventTopics({ abi: [event], eventName: 'Updated', args: { publisher: pub, repo_id: h } }),
    data: encodeAbiParameters(event.inputs.filter((i) => !i.indexed), data),
  });
  const [a, b] = decodeUpdates([raw(UPDATED_V0, ['old-repo', 1n, h, h], 1), raw(v1, ['new-repo', 2n, h, h, 7n, 1_800_000_000n], 2)]);
  assert.deepEqual([a.args.repo, a.args.timestamp], ['old-repo', undefined]);
  assert.deepEqual([b.args.repo, b.args.timestamp], ['new-repo', 1_800_000_000n]);
}

// Files → records.
const { parseRecords, parseCsv, sumSales } = await import('./account.js');
assert.deepEqual(parseCsv('a,b\n"x, ""y""",2\r\n"multi\nline",3\n'), [['a', 'b'], ['x, "y"', '2'], ['multi\nline', '3']]);
let r = parseRecords('title,body\nKelp,the paid table\nVolcano,lava\n', 'notes.csv');
assert.deepEqual(r.columns, ['title', 'body']);
assert.deepEqual(r.records[0], { id: '1', type: 'record', payload: { title: 'Kelp', body: 'the paid table' } });
r = parseRecords('[{"id":"k","title":"Kelp"},{"id":"v","title":"Volcano"}]', 'x.json');
assert.deepEqual(r.records.map((x) => x.id), ['k', 'v'], 'distinct ids are kept');
assert.deepEqual(r.columns, ['title'], 'id is not a column to sell');
r = parseRecords('{"id":"a","n":1}\n{"id":"a","n":2}\n', 'x.jsonl');
assert.deepEqual(r.records.map((x) => x.id), ['1', '2'], 'a repeated id numbers the rows instead');
r = parseRecords('{"records":[{"id":"k","type":"note.v1","payload":{"title":"Kelp"}}]}', 'commit.json');
assert.deepEqual(r.records[0].payload, { id: 'k', title: 'Kelp' }, 'a CLI commit file is read by its payloads');
assert.throws(() => parseRecords('[1,2]', 'x.json'), /list of rows/);
assert.throws(() => parseRecords('only-a-header\n', 'x.csv'), /header row/);

// Any file: rows from a CSV, one record per other file, ids prefixed when there are several.
const { readFiles, toDataUrl } = await import('./account.js');
const pdf = new File(['%PDF-1.4 hi'], 'report.pdf', { type: 'application/pdf' });
r = await readFiles([pdf]);
assert.deepEqual(r.records[0], { id: 'report.pdf', type: 'file', payload: { title: 'report.pdf', mime: 'application/pdf', size: 11, file: pdf } });
r = await readFiles([new File(['a,b\n1,2\n'], 't.csv'), pdf, new File(['not json'], 'x.json')]);
assert.deepEqual(r.records.map((x) => x.id), ['t.csv/1', 'report.pdf', 'x.json'], 'a .json that is not rows is a file');
await assert.rejects(readFiles([pdf, new File(['x'], 'report.pdf')]), /share a name/);
r = await readFiles([new File(['x'], "That boi ain't right_.jpg")]);
assert.equal(r.records[0].id, "That-boi-ain't-right_.jpg", 'spaces in a name are not in its id');
assert.equal(r.records[0].payload.title, "That boi ain't right_.jpg", 'the title keeps them');
assert.equal(parseRecords('id,t\nné e,1\n', 'x.csv').records[0].id, 'n-e', 'a CSV id is cleaned too');
await assert.rejects(readFiles([new File(['x'], 'a b.png'), new File(['y'], 'a-b.png')]), /share a name/);
const url = await toDataUrl(new Blob([new Uint8Array([0, 255, 128])], { type: 'image/png' }));
assert.equal(url, 'data:image/png;base64,AP+A');

// A record as its page shows it: sealed fields named, never shown; the price from its terms.
const { toListing } = await import('./account.js');
const listing = toListing({ id: 'kelp', payload: { title: 'Kelp', text: 'otters', survey: { '@type': 'handle', cid: 'bafy' }, '@terms': { terms: { price: '10000' }, signature: '0x' } } });
assert.equal(toListing({ id: 'k', payload: { '@terms': { terms: { price: '10000', shareBps: 500 } } } }).shareBps, 500);
assert.deepEqual(listing, { id: 'kelp', title: 'Kelp', type: 'record', fields: { title: 'Kelp', text: 'otters' }, sealed: ['survey'], price: 10_000n, shareBps: 0 });
assert.deepEqual(toListing({ id: 'n', type: 'note.v1', payload: { n: 1 } }), { id: 'n', title: 'n', type: 'note.v1', fields: { n: 1 }, sealed: [], price: null, shareBps: 0 }, 'free, untitled');
assert.equal(toListing({ id: 'f', type: 'file', payload: { mime: 'image/png' } }).type, 'image/png', "a file's type is its mime");

// Log scans resume: a second scan asks only for the blocks since the first (less a re-read minute),
// and keeps every log once.
{
  const { scan } = await import('./account.js');
  const { clientOf } = await import('./fangorn.js');
  const kept = new Map();
  globalThis.localStorage = { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) };
  const c = clientOf(), real = { getBlockNumber: c.getBlockNumber, getLogs: c.getLogs };
  const start = NETWORK.fromBlock;
  let head = start + 199_999n, calls = 0; // 200,000 blocks: four 50k windows
  const chain = [start + 5n, start + 150_000n, start + 199_900n]; // the last one is inside the re-read minute
  c.getBlockNumber = async () => head;
  c.getLogs = async ({ fromBlock, toBlock }) => { calls++; return chain.filter((b) => b >= fromBlock && b <= toBlock).map((b) => ({ blockNumber: b, args: { n: b } })); };
  try {
    const event = { name: 'Test' }, at = (logs) => logs.map((l) => l.blockNumber);
    assert.deepEqual(at(await scan('0xabc', event, { who: 1n })), chain);
    assert.equal(calls, 4, 'a first scan walks every window');
    calls = 0; head += 1000n; chain.push(head - 10n);
    assert.deepEqual(at(await scan('0xabc', event, { who: 1n })), chain, 'every log once, the new one too');
    assert.equal(calls, 1, 'a second scan is one window');
    assert.equal(typeof (await scan('0xabc', event, { who: 1n }))[0].args.n, 'bigint', 'bigints survive being kept');
  } finally { Object.assign(c, real); delete globalThis.localStorage; }
}

// Earnings: price less the referrer's cut; a free registration is no sale.
const reg = (price, cut) => ({ args: { price, referrer_cut: cut } });
assert.deepEqual(sumSales([reg(10_000n, 500n), reg(20_000n, 0n), reg(0n, 0n)]), { total: 29_500n, sales: 2 });

// The weekly chart: times from the head at 0.2s a block; a sale older than the window is in the
// total but not the chart.
const { salesStats, netPrice } = await import('./account.js');
const head = { number: 1_000_000n, timestamp: 1_800_000_000n };
const sale = (price, cut, blockNumber) => ({ blockNumber, args: { price, referrer_cut: cut } });
const weekBlocks = BigInt(7 * 86400 / 0.2);
const st = salesStats([sale(10_000n, 500n, head.number - 2n * weekBlocks - 1n), sale(10_000n, 500n, head.number - 10n), sale(50_000n, 0n, head.number - 20n * weekBlocks)], head);
assert.deepEqual([st.total, st.sales], [69_000n, 3]);
assert.deepEqual(st.weekly.slice(-3), [9_500, 0, 9_500], 'one sale this week, one two weeks back');
assert.equal(st.weekly.reduce((a, b) => a + b), 19_000);
assert.doesNotThrow(() => JSON.stringify(st.weekly), 'no bigints: React dev logs props with JSON.stringify');
assert.equal(netPrice({ price: 10_000n, shareBps: 500 }), 9_500n, "a sale pays the price less the referrer's share");
assert.equal(netPrice({ price: null, shareBps: 0 }), 0n, 'free');

// The storage meters: the worker's KV counters are eventually consistent and are
// debited on grant, so `used` can legitimately exceed the cap. The bar must clamp
// and the headroom note must never go negative.
const { meterState } = await import('./format.js');
assert.equal(meterState(500, 0), null, 'limit 0 = gate off, no bar');
assert.equal(meterState(500, undefined), null, 'no ceiling to draw');
assert.equal(meterState(0, 1000).pct, 0, 'zero usage draws nothing');
assert.equal(meterState(500, 1000).pct, 50);
assert.equal(meterState(1, 1000).pct, 2, 'a sliver stays visible');
assert.equal(meterState(500, 1000).full, false);
assert.equal(meterState(950, 1000).full, true, '>=90% flips to the warning state');
assert.equal(meterState(950, 1000).remaining, 50);
const over = meterState(1500, 1000);
assert.equal(over.pct, 100, 'overshoot clamps to a full bar');
assert.equal(over.remaining, 0, 'headroom never goes negative');

// A repo's description: the card publishRecords makes speaks for its repo, as the registry checks it (westmarch
// src/repos.js cardOf: the FANGORN_REPO_EXTENSION params name this publisher, repo, chain and data registry).
{
  const { cardFor } = await import('./account.js');
  const { FANGORN_REPO_EXTENSION } = await import('@fangorn-network/sdk');
  const alice = '0x00000000000000000000000000000000000a11ce';
  const card = cardFor({ publisher: alice, repo: 'kelp-surveys', description: 'Kelp forest surveys off Monterey, 2019–2024' });
  const p = card.capabilities.extensions.find((e) => e.uri === FANGORN_REPO_EXTENSION).params;
  assert.equal(p.publisher.toLowerCase(), alice);
  assert.equal(p.repo, 'kelp-surveys');
  assert.equal(p.chainId, NETWORK.caip2);
  assert.equal(p.dataRegistry.toLowerCase(), NETWORK.dataRegistryContractAddress.toLowerCase());
  assert.match(card.description, /Kelp forest surveys off Monterey/, 'search matches the description');
}

console.log('fangorn self-check OK');
