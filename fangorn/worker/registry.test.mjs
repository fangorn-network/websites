// Run: node worker/registry.test.mjs
// The registry: one stitch over every repo; a repo's card is kept only if it speaks for that repo; nothing new costs
// nothing; a moved head re-reads the card; search ranks by the embedded name and card.
import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import { memoryNetwork } from '@fangorn-network/sdk/lib/test/testbed.js';
import { FANGORN_REPO_EXTENSION } from '@fangorn-network/sdk';
import { registry, textOf } from './registry.js';

// A D1 binding over node:sqlite: prepare/bind/first/all/run, batch as one transaction.
const sql = new DatabaseSync(':memory:');
const stmt = (q, args = []) => ({ bind: (...a) => stmt(q, a), first: async () => sql.prepare(q).get(...args) ?? null, all: async () => ({ results: sql.prepare(q).all(...args) }), now: () => sql.prepare(q).run(...args) });
const db = { prepare: (q) => stmt(q), async batch(ops) { sql.exec('BEGIN'); try { ops.forEach((o) => o.now()); sql.exec('COMMIT'); } catch (e) { sql.exec('ROLLBACK'); throw e; } } };

const net = memoryNetwork();
const [alice, bob, eve, reader] = await Promise.all([net.client(), net.client(), net.client(), net.client()]);
const { caip2, dataRegistryContractAddress } = reader.getConfig();
const cardFor = (publisher, repo, name, description) => ({ name, description, skills: [{ name: 'search', tags: ['furniture'] }],
  capabilities: { extensions: [{ uri: FANGORN_REPO_EXTENSION, params: { chainId: caip2, dataRegistry: dataRegistryContractAddress, publisher, repo } }] } });
const cards = {
  'https://a.example/card.json': cardFor(alice.getAddress(), 'shop', 'Oak & Iron', 'Handmade tables and chairs'),
  'https://e.example/card.json': cardFor(alice.getAddress(), 'shop', 'Fake', 'Claims to be alice'), // eve binds alice's card
};
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => cards[url] ? new Response(JSON.stringify(cards[url])) : realFetch(url, init);

const put = async (c, repo, records) => { await c.initRepo(repo); return c.uploadBatch(repo, records); };
await put(alice, 'shop', [{ id: 'oak', type: 'item', payload: { name: 'oak table' } }, { id: '@card', type: 'card', payload: { url: 'https://a.example/card.json' } }]);
await put(bob, 'field-notes', [{ id: 'n1', type: 'note', payload: { text: 'saw a heron' } }]);
await put(eve, 'shop', [{ id: '@card', type: 'card', payload: { url: 'https://e.example/card.json' } }]);

const index = registry({ db, fangorn: reader });
assert.equal(await index.update('t1'), 3, 'every repo of every publisher');
const a = await index.get(alice.getAddress(), 'shop');
assert.equal(a.card.name, 'Oak & Iron');
assert.equal(a.card_url, 'https://a.example/card.json');
assert.equal((await index.get(eve.getAddress(), 'shop')).card, null, "a card naming someone else's repo isn't kept");
assert.equal((await index.get(bob.getAddress(), 'field-notes')).card, null, 'no card: still listed');
assert.equal(await index.update('t2'), 0, 'nothing new: nothing re-read');
assert.equal(await index.stitch() !== null, true);

// Embedding: a fake model, word counts over a tiny vocabulary.
const vocab = ['table', 'chairs', 'heron', 'notes'];
const embed = async (ts) => ts.map((t) => vocab.map((v) => t.toLowerCase().split(/\W+/).filter((w) => w === v).length));
assert.equal(await index.embedMissing(embed), 3);
assert.equal(await index.embedMissing(embed), 0);
assert.equal((await index.find({ q: (await embed(['tables and chairs']))[0] }))[0].repo, 'shop');
assert.equal((await index.find({ q: (await embed(['heron notes']))[0] }))[0].publisher, bob.getAddress().toLowerCase());
assert.deepEqual((await index.find({ publisher: bob.getAddress() })).map((r) => r.repo), ['field-notes']);

// A moved head: re-read; the vector is kept when the text didn't change, dropped when it did.
await put(bob, 'field-notes', [{ id: 'n2', type: 'note', payload: { text: 'two herons' } }]);
assert.equal(await index.update('t3'), 1);
assert.equal((await index.get(bob.getAddress(), 'field-notes')).updated, 't3');
assert.equal(await index.embedMissing(embed), 0, 'same name, same card: same vector');
cards['https://a.example/card.json'].description = 'Lamps now too';
await put(alice, 'shop', [{ id: 'lamp', type: 'item', payload: { name: 'lamp' } }]);
assert.equal(await index.update('t4'), 1);
assert.equal(await index.embedMissing(embed), 1, 'a changed card is embedded again');

assert.equal(textOf('field-notes', null), 'field notes');
console.log('ok: registry');
