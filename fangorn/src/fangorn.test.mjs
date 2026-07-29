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
import { DEFAULT_APP, FangornConfig, toAppId } from '@fangorn-network/sdk/lib/config.js';

const selector = (functionName, args) =>
  encodeFunctionData({ abi: DATA_REGISTRY_ABI, functionName, args }).slice(0, 10);
const ZERO32 = '0x' + '0'.repeat(64);
const ZEROADDR = '0x0000000000000000000000000000000000000000';

// register() is payable — the SDK reads registrationFee() and attaches it as
// msg.value (it used to be an ERC-20 pull; the website must not approve USDC for it).
assert.equal(selector('register'), '0x1aa3a008');
assert.equal(DATA_REGISTRY_ABI.find((f) => f.name === 'register').stateMutability, 'payable');
// The other methods the web app calls must exist with these exact signatures.
assert.ok(selector('registrationFee'));
assert.ok(selector('getNamespaceHead', [ZERO32, ZEROADDR, ZERO32]));
assert.ok(selector('getPublisherStatus', [ZEROADDR]));
assert.ok(selector('isRegistered', [ZEROADDR]));
assert.ok(selector('commitStateRoot', [ZERO32, ZERO32, ZERO32, ZERO32]));

// The site takes the deployment from the SDK rather than its own env var, so the
// address it registers against is whatever this SDK version ships.
assert.match(FangornConfig.dataRegistryContractAddress, /^0x[0-9a-fA-F]{40}$/);
assert.equal(toAppId(DEFAULT_APP).length, 66);

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
