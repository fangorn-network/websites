// Run: node worker/grants.test.mjs
// Grants: issued per person per app, kept hashed, a new one revokes the old, capped per day; and /api/sign's check
// signs only an Update to a granted repo, by the grant's address, on Fangorn's own domain.
import assert from 'node:assert';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { recoverTypedDataAddress } from 'viem';
import { BaseSepoliaConfig } from '@fangorn-network/sdk/lib/config.js';
import { grants, appOf, reposOf, updateFor, sha256, PER_DAY } from './grants.js';

const kv = new Map(), KV = { get: async (k) => kv.get(k) ?? null, put: async (k, v) => void kv.set(k, v), delete: async (k) => void kv.delete(k) };
const store = grants(KV), alice = privateKeyToAccount(generatePrivateKey());
const who = { address: alice.address, wallet: 'w1', user: 'did:privy:alice' };

assert.equal(appOf('https://store.example/x?y'), 'https://store.example');
assert.throws(() => appOf('javascript:alert(1)'), /http/);
assert.deepEqual(reposOf('arcade, notes,arcade'), ['arcade', 'notes']);
assert.throws(() => reposOf(''), /repo/);
assert.throws(() => reposOf(['../x']), /repo/);

const first = await store.issue(who, 'https://store.example', ['arcade']);
const token = await store.issue(who, 'https://store.example', ['arcade']);
assert.equal(await store.of(first), null, 'a new grant for the same app revokes the old');
assert.equal((await store.of(token)).address, alice.address);
assert.ok(![...kv.keys(), ...kv.values()].some((x) => x.includes(token)), 'only the hash is kept');
assert.ok(kv.has(`grant:${await sha256(token)}`));
const other = await store.issue(who, 'https://other.example', ['notes']);
assert.ok(await store.of(other), 'grants for different apps live side by side');
await store.revoke(who.user, 'https://other.example');
assert.equal(await store.of(other), null);

const g = await store.of(token), H = (b) => '0x' + b.repeat(32);
const message = { publisher: alice.address, repo: 'arcade', epoch: '490000', parent: H('00'), diff: H('22'), root: H('11'), car: '0x0155' };
const typed = updateFor(g, message, BaseSepoliaConfig);
assert.equal(typed.domain.verifyingContract, BaseSepoliaConfig.dataRegistryContractAddress, "Fangorn's registry, whatever the caller says");
assert.equal(typed.domain.chainId, 84532);
const signature = await alice.signTypedData(typed);
assert.equal(await recoverTypedDataAddress({ ...typed, signature }), alice.address, 'what it builds signs and recovers');
assert.throws(() => updateFor(g, { ...message, repo: 'notes' }), /doesn't cover/);
assert.throws(() => updateFor(g, { ...message, publisher: privateKeyToAccount(generatePrivateKey()).address }), /address/);
assert.throws(() => updateFor(g, { ...message, root: '0x12' }), /32 bytes/);
assert.throws(() => updateFor(g, { ...message, epoch: '-1' }), /epoch/);

for (let i = 0; i < PER_DAY; i++) await store.spend(token, await store.of(token));
await assert.rejects(store.spend(token, await store.of(token)), /a day/);
console.log('ok: grants');
