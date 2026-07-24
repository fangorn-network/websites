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

// register() is nonpayable — it pulls the registration fee in USDC via transferFrom
// (the SDK approves first), so no msg.value. The selector is unchanged.
assert.equal(selector('register'), '0x1aa3a008');
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

console.log('fangorn self-check OK');
