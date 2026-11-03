// Run: node src/fangorn.test.mjs
// Guards the invariants the account hub depends on:
//  1. the site runs against the Base Sepolia deployment;
//  2. the AppRegistry calls the hub makes exist in the SDK's ABI;
//  3. the storage meter maths;
//  4. earnings count x402 sales, never faucet drips or self-sends.
import assert from 'node:assert';
import { parseAbiItem, encodeEventTopics } from 'viem';
import { APP_REGISTRY_ABI } from '@fangorn-network/sdk/lib/contracts/app-registry/abi.js';

const { NETWORK, CHAIN, APP_REGISTRY_ADDRESS } = await import('./fangorn.js');
assert.equal(CHAIN.id, 84532, 'Base Sepolia');
assert.equal(NETWORK.caip2, 84532);
assert.match(APP_REGISTRY_ADDRESS, /^0x[0-9a-fA-F]{40}$/);

for (const fn of ['registerApp', 'getAppOwner', 'appsOf', 'appsPage', 'setAppAgentUri', 'setCurator', 'curatorOf', 'setPayout', 'payoutOf', 'isAppSuspended']) {
  assert.ok(APP_REGISTRY_ABI.some((x) => x.name === fn), `AppRegistry has ${fn}`);
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

// Earnings: a transfer counts only with the receipt evidence of an x402 sale.
const { classifyEarnings } = await import('./account.js');
const { USDC_ADDRESS } = await import('./fangorn.js');
const OWNER = `0x${'0a'.repeat(20)}`, BUYER = `0x${'0b'.repeat(20)}`, FAUCET = `0x${'0c'.repeat(20)}`;
const AUTH_USED = parseAbiItem('event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)');
const tx = (n) => `0x${String(n).padStart(64, '0')}`;
const xfer = (n, from, value) => ({ transactionHash: tx(n), args: { from, to: OWNER, value } });
const logsByTx = new Map([
  [tx(2), [{ address: USDC_ADDRESS, topics: encodeEventTopics({ abi: [AUTH_USED], args: { authorizer: BUYER, nonce: tx(9) } }), data: '0x' }]],
  [tx(3), []],
  // An AuthorizationUsed by someone else than the sender proves nothing.
  [tx(4), [{ address: USDC_ADDRESS, topics: encodeEventTopics({ abi: [AUTH_USED], args: { authorizer: BUYER, nonce: tx(8) } }), data: '0x' }]],
]);
const e = classifyEarnings([xfer(2, BUYER, 10_000n), xfer(3, FAUCET, 10_000_000n), xfer(4, FAUCET, 1n), xfer(2, OWNER, 3n)], logsByTx, OWNER);
assert.equal(e.total, 10_000n, 'x402 sale counted; faucet drip and self-send left out');

console.log('fangorn self-check OK');
