// Run: node src/buckets.test.mjs
// Guards the registry ABI against drift from the deployed PublisherRegistry:
// a renamed/removed method or wrong signature silently breaks onboarding.
import assert from 'node:assert';
import { encodeFunctionData } from 'viem';
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

// Bucket identity getters read when viewing bucket info.
assert.equal(encodeFunctionData({ abi: BUCKET_ABI, functionName: 'owner' }), '0x8da5cb5b');
assert.equal(encodeFunctionData({ abi: BUCKET_ABI, functionName: 'registry' }), '0x7b103999');

console.log('buckets self-check OK');
