// Run: node src/fangorn.test.mjs
// Guards the invariants the account hub depends on:
//  1. the site runs against the Base Sepolia deployment, not the SDK's default
//     FangornConfig (still the old Arbitrum one);
//  2. the owned-app scan: an app's ERC-721 token id IS its app id, and Transfer
//     indexes tokenId (the scan reads it from the topics);
//  3. the storage meter maths;
//  4. earnings count memberships and x402 sales, never faucet drips or self-sends.
import assert from 'node:assert';
import { encodeAbiParameters, encodeEventTopics, hexToBigInt, parseAbiItem, toHex } from 'viem';
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

// Earnings: a transfer counts only with the receipt evidence of what paid it.
const { classifyEarnings } = await import('./account.js');
const { USDC_ADDRESS } = await import('./fangorn.js');
const OWNER = `0x${'0a'.repeat(20)}`, BUYER = `0x${'0b'.repeat(20)}`, FAUCET = `0x${'0c'.repeat(20)}`;
const APP = toAppId('my-app');
const JOINED = parseAbiItem('event Joined(bytes32 indexed app_id, uint256 indexed epoch, uint256 commitment)');
const AUTH_USED = parseAbiItem('event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce)');
const tx = (n) => `0x${String(n).padStart(64, '0')}`;
const xfer = (n, from, value) => ({ transactionHash: tx(n), args: { from, to: OWNER, value } });
const logsByTx = new Map([
  [tx(1), [{ address: MEMBERSHIP_REGISTRY_ADDRESS, topics: encodeEventTopics({ abi: [JOINED], args: { app_id: APP, epoch: 1n } }), data: encodeAbiParameters([{ type: 'uint256' }], [7n]) }]],
  [tx(2), [{ address: USDC_ADDRESS, topics: encodeEventTopics({ abi: [AUTH_USED], args: { authorizer: BUYER, nonce: tx(9) } }), data: '0x' }]],
  [tx(3), []],
  // An AuthorizationUsed by someone else than the sender proves nothing.
  [tx(4), [{ address: USDC_ADDRESS, topics: encodeEventTopics({ abi: [AUTH_USED], args: { authorizer: BUYER, nonce: tx(8) } }), data: '0x' }]],
]);
const e = classifyEarnings(
  [xfer(1, MEMBERSHIP_REGISTRY_ADDRESS, 5_000_000n), xfer(2, BUYER, 10_000n), xfer(3, FAUCET, 10_000_000n), xfer(4, FAUCET, 1n), xfer(2, OWNER, 3n)],
  logsByTx, OWNER);
assert.equal(e.byApp[APP.toLowerCase()], 5_000_000n, 'membership payout lands on its app');
assert.equal(e.sales, 10_000n, 'x402 sale counted');
assert.equal(e.total, 5_010_000n, 'faucet drip and self-send left out');

console.log('fangorn self-check OK');
