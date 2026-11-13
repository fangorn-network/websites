// Run: node src/fangorn.test.mjs
// Guards the invariants the account hub depends on:
//  1. the site runs against the Base Sepolia deployment;
//  2. a publisher's file parses into the records it publishes;
//  3. earnings are the sales net of the referrer's cut;
//  4. the storage meter maths.
import assert from 'node:assert';

const { NETWORK, CHAIN } = await import('./fangorn.js');
assert.equal(CHAIN.id, 84532, 'Base Sepolia');
assert.match(NETWORK.dataRegistryContractAddress, /^0x[0-9a-fA-F]{40}$/);
assert.match(NETWORK.settlementRegistryContractAddress, /^0x[0-9a-fA-F]{40}$/);

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

// Earnings: price less the referrer's cut; a free registration is no sale.
const reg = (price, cut) => ({ args: { price, referrer_cut: cut } });
assert.deepEqual(sumSales([reg(10_000n, 500n), reg(20_000n, 0n), reg(0n, 0n)]), { total: 29_500n, sales: 2 });

// The weekly chart: times from the head at 2s a block; a sale older than the window is in the
// total but not the chart.
const { salesStats, netPrice } = await import('./account.js');
const head = { number: 1_000_000n, timestamp: 1_800_000_000n };
const sale = (price, cut, blockNumber) => ({ blockNumber, args: { price, referrer_cut: cut } });
const weekBlocks = BigInt(7 * 86400 / 2);
const st = salesStats([sale(10_000n, 500n, head.number - 2n * weekBlocks - 1n), sale(10_000n, 500n, head.number - 10n), sale(50_000n, 0n, head.number - 20n * weekBlocks)], head);
assert.deepEqual([st.total, st.sales], [69_000n, 3]);
assert.deepEqual(st.weekly.slice(-3), [9_500n, 0n, 9_500n], 'one sale this week, one two weeks back');
assert.equal(st.weekly.reduce((a, b) => a + b), 19_000n);
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

// A repo's description: the card publishRecords makes is one the global index keeps, and searches.
{
  const { cardFor } = await import('./account.js');
  const { cardOf, textOf } = await import('../worker/registry.js');
  const alice = '0x00000000000000000000000000000000000a11ce', url = 'https://gw/ipfs/bafycard';
  const card = cardFor({ publisher: alice, repo: 'kelp-surveys', description: 'Kelp forest surveys off Monterey, 2019–2024' });
  // The index's view of the chain: the repo's @card record points at `url`, which serves `served`.
  let served = card;
  const fangorn = { getConfig: () => NETWORK, engine: { readRecord: async (p, repo, id) => (id === '@card' ? { payload: { url } } : null) } };
  const real = globalThis.fetch;
  globalThis.fetch = async (u) => new Response(u === url ? JSON.stringify(served) : 'nope', { status: u === url ? 200 : 404 });
  try {
    assert.deepEqual(await cardOf(fangorn, alice, 'kelp-surveys'), { url, card }, 'the index keeps the card');
    assert.equal(await cardOf(fangorn, alice, 'other-repo'), null, 'a card names one repo');
    served = cardFor({ publisher: '0x000000000000000000000000000000000000b0b0', repo: 'kelp-surveys', description: 'x' });
    assert.equal(await cardOf(fangorn, alice, 'kelp-surveys'), null, "a card naming someone else's address is ignored");
  } finally { globalThis.fetch = real; }
  assert.match(textOf('kelp-surveys', card), /Kelp forest surveys off Monterey/, 'search matches the description');
}

console.log('fangorn self-check OK');
