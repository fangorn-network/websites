// Run: node src/fangorn.test.mjs
// Guards the invariants the account hub depends on:
//  1. the site runs against the Base Sepolia deployment, not the SDK's default
//     FangornConfig (still the old Arbitrum one);
//  2. the owned-app scan: an app's ERC-721 token id IS its app id, and Transfer
//     indexes tokenId (the scan reads it from the topics);
//  3. the storage meter maths.
import assert from 'node:assert';
import { hexToBigInt, toHex } from 'viem';
import { APP_REGISTRY_ABI } from '@fangorn-network/sdk/lib/contracts/app-registry/abi.js';
import { toAppId } from '@fangorn-network/sdk/lib/config.js';

const { NETWORK, CHAIN, APP_REGISTRY_ADDRESS, MEMBERSHIP_REGISTRY_ADDRESS } = await import('./fangorn.js');
assert.equal(CHAIN.id, 84532, 'Base Sepolia');
assert.equal(NETWORK.caip2, 84532);
assert.match(APP_REGISTRY_ADDRESS, /^0x[0-9a-fA-F]{40}$/);
assert.match(MEMBERSHIP_REGISTRY_ADDRESS, /^0x[0-9a-fA-F]{40}$/);

const transfer = APP_REGISTRY_ABI.find((x) => x.type === 'event' && x.name === 'Transfer');
assert.deepEqual(transfer.inputs.map((i) => i.indexed), [true, true, true], 'tokenId is a topic');
for (const fn of ['registerApp', 'renewSubscription', 'setAppAgentUri', 'expiresAt']) {
  assert.ok(APP_REGISTRY_ABI.some((x) => x.name === fn), `AppRegistry has ${fn}`);
}

// Token id → app id must round-trip, leading zero bytes included.
for (const id of [toAppId('my-app'), `0x00${'ab'.repeat(31)}`]) {
  assert.equal(toHex(hexToBigInt(id), { size: 32 }), id);
}

const { isCardUrl } = await import('./account.js');
assert.ok(isCardUrl('https://x.dev/.well-known/agent-card.json'));
assert.ok(!isCardUrl('javascript:alert(1)'), 'never a script url');
assert.ok(!isCardUrl('not a url'));

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

console.log('fangorn self-check OK');
