// Run: node src/buckets.test.mjs
// Guards the registry ABI against drift from the deployed PublisherRegistry:
// a renamed/removed method or wrong signature silently breaks onboarding.
import assert from 'node:assert';
import { encodeFunctionData, encodeEventTopics } from 'viem';
import { REGISTRY_ABI, BUCKET_ABI } from './buckets.js';

// Selectors of the deployed contract (keccak256(sig)[:4]).
assert.equal(encodeFunctionData({ abi: REGISTRY_ABI, functionName: 'register' }), '0x1aa3a008');
assert.equal(
  encodeFunctionData({
    abi: REGISTRY_ABI,
    functionName: 'bucketOf',
    args: ['0x0000000000000000000000000000000000000000'],
  }).slice(0, 10),
  '0x9dad6139',
);
assert.equal(encodeFunctionData({ abi: REGISTRY_ABI, functionName: 'registrationFee' }), '0x14c44e09');

// register() must be payable — it forwards the registration fee as msg.value.
assert.equal(REGISTRY_ABI.find((f) => f.name === 'register').stateMutability, 'payable');

// Event topic0 hashes of the deployed bucket — repos/commits are read straight
// from these logs, so a wrong signature means getContractEvents silently returns
// nothing and the repo view stays empty.
const topic0 = (eventName) => encodeEventTopics({ abi: BUCKET_ABI, eventName })[0];
assert.equal(topic0('SchemaRegistered'), '0x0a898017b704dc87572ea42ebe3aaad9148cf8cf66e045ffe61c447d3342a366');
assert.equal(topic0('ManifestPublished'), '0x71212a56e8e2470c1abf07c7a728f4fb623ba8f35904c628738e3c0f57e68fad');
assert.equal(topic0('ManifestUpdated'), '0xbc016893e07e9ecd0240273676547be02ebf470b391242d1121572ea01f27943');

console.log('buckets self-check OK');
