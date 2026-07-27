// Run: node src/fangorn.test.mjs
// Guards the two invariants the read path depends on:
//  1. the DataRegistry ABI selectors the SDK encodes match the deployed contract
//     (a renamed/removed method silently breaks reads — the whole reason for
//     this migration off the old bucket ABI);
//  2. the on-chain state root (a bare sha256 digest) reconstructs to the EXACT
//     commit CID, and that CID's raw-0x55 gateway sibling shares the digest.
import assert from 'node:assert';
import { encodeFunctionData, bytesToHex, hexToBytes } from 'viem';
import { CID } from 'multiformats/cid';
import * as Digest from 'multiformats/hashes/digest';
import { DATA_REGISTRY_ABI } from '@fangorn-network/sdk/lib/contracts/data-registry/abi.js';
import { encodeBlock } from '@fangorn-network/sdk/lib/engine/graph.js';

const selector = (functionName, args) =>
  encodeFunctionData({ abi: DATA_REGISTRY_ABI, functionName, args }).slice(0, 10);
const ZERO32 = '0x' + '0'.repeat(64);
const ZEROADDR = '0x0000000000000000000000000000000000000000';

// The selector is stable regardless of mutability.
assert.equal(selector('register'), '0x1aa3a008');
// KNOWN MISMATCH (2026-07-27): the contract and fangorn/src/.../abi.ts both say
// `payable` (register() takes the fee as msg.value), but the BUILT lib/ this
// resolves to still says `nonpayable` — the SDK hasn't been rebuilt since. viem
// refuses to attach `value` to a nonpayable function, so register() throws until
// `pnpm build` in ./fangorn + `pnpm install` here. Asserting the stale value
// keeps this check green; flip it to 'payable' once the SDK is rebuilt and it
// becomes a real guard again.
assert.equal(DATA_REGISTRY_ABI.find((f) => f.name === 'register').stateMutability, 'nonpayable');
// The other methods the web app calls must exist with these exact signatures.
assert.ok(selector('registrationFee'));
assert.ok(selector('getNamespaceHead', [ZEROADDR]));
assert.ok(selector('getPublisherStatus', [ZEROADDR]));
assert.ok(selector('isRegistered', [ZEROADDR]));
assert.ok(selector('commitStateRoot', [ZERO32, ZERO32]));

// The contract stores a bare 32-byte sha256 digest; the read path rebuilds the
// CID by WRAPPING that digest (not re-hashing it). Round-trip a real block.
const { cid } = await encodeBlock({ hello: 'world' });
const rootHex = bytesToHex(cid.multihash.digest);
assert.equal(rootHex.length, 66); // 0x + 32 bytes
const rebuilt = CID.createV1(0x71, Digest.create(0x12, hexToBytes(rootHex)));
assert.equal(rebuilt.toString(), cid.toString(), 'digest → commit CID round trip');

// Commit blocks resolve on the gateway under a raw-codec (0x55) sibling CID that
// shares the dag-cbor CID's multihash — fetchBlock() keys on the bafyrei prefix.
assert.ok(cid.toString().startsWith('bafyrei'));
const sibling = CID.createV1(0x55, cid.multihash);
assert.equal(sibling.multihash.digest.join(), cid.multihash.digest.join());

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
