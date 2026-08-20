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

// The directory spans every app, which rests on one subtlety: the client's appId is
// topic 2 of the StateCommitted filter, so an UNDEFINED one is a wildcard. Setting it
// to APP_ID "for consistency" would silently narrow the directory back to one app.
const { readRegistry, allAppsRegistry, APP_ID } = await import('./fangorn.js');
assert.equal(readRegistry.getAppId(), APP_ID, 'the app-scoped client keeps its app');
assert.equal(allAppsRegistry.getAppId(), undefined, 'the directory client must stay app-wildcard');

// Namespaces group by app under each publisher, and a name is only unique inside one:
// the same subspace committed in two apps is two rows, never one.
const { groupByApp, appLabel } = await import('./directory.js');
const APP_B = toAppId('other.app');
const rows = [
  { key: 'k1', appId: APP_ID, name: 'media', blockNumber: 10n },
  { key: 'k2', appId: APP_B, name: 'media', blockNumber: 30n },
  { key: 'k3', appId: APP_ID, name: 'notes', blockNumber: 20n },
];
const apps = groupByApp(rows);
assert.equal(apps.length, 2, 'one group per app');
assert.equal(apps[0].appId, APP_B, 'most recently active app first');
assert.deepEqual(apps[1].namespaces.map((n) => n.name), ['media', 'notes']);
assert.equal(apps[1].lastBlock, 20n, 'group carries its newest block');
assert.equal(appLabel(APP_ID), DEFAULT_APP, 'a known app id resolves to its name');
assert.equal(appLabel(APP_B), `${APP_B.slice(0, 10)}…`, 'an unknown one shows its hex');

// appName is what fills the form field, so it must ROUND-TRIP: whatever it returns has
// to hash back to the same app id. appLabel deliberately does not — it truncates — and
// sending that truncation would keccak the ellipsis and watch an app nobody owns.
const { appName } = await import('./directory.js');
assert.equal(appName(APP_ID), DEFAULT_APP);
assert.equal(toAppId(appName(APP_ID)), APP_ID, 'a resolved name re-derives its id');
assert.equal(appName(APP_B), null, 'an unknown app has no name to fill in');

// The app-first grouping: the same rows as groupByApp, read along the other axis. Its
// job is answering "what can I watch", so the publisher count must be DISTINCT owners —
// one publisher with three namespaces in an app is one publisher, not three.
const { groupApps } = await import('./directory.js');
const appRows = [
  { key: 'a', appId: APP_ID, owner: '0xAA', name: 'media', blockNumber: 10n },
  { key: 'b', appId: APP_ID, owner: '0xaa', name: 'notes', blockNumber: 40n },
  { key: 'c', appId: APP_ID, owner: '0xBB', name: 'media', blockNumber: 20n },
  { key: 'd', appId: APP_B, owner: '0xCC', name: 'solo', blockNumber: 30n },
];
const grouped = groupApps(appRows);
assert.equal(grouped.length, 2, 'one row per app');
assert.equal(grouped[0].appId, APP_ID, 'most recently active app first');
assert.equal(grouped[0].publishers, 2, 'distinct owners, case-insensitively');
assert.equal(grouped[0].namespaces.length, 3);
assert.equal(grouped[0].lastBlock, 40n);
assert.equal(grouped[0].name, DEFAULT_APP, 'a known app carries a fillable name');
assert.equal(grouped[1].name, null, 'an unknown one carries null, not a truncated label');
assert.equal(grouped[0].owners, undefined, 'the owner Set does not leak out');
assert.notEqual(toAppId(appLabel(APP_B)), APP_B, 'which is why the label is not usable as a value');

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

// What a view sends to the registry worker. This is the seam that decides which graphs
// get embedded, and both shapes go out over the same field, so a regression here is
// silent: the worker accepts either and just watches the wrong thing.
const { buildSources, describeSources } = await import('./quickbeam.js');

// One namespace: all three parts concrete, and whitespace trimmed off every one — the
// worker's isAddress/isSafeName checks reject a padded value with a 400.
assert.deepEqual(
  buildSources({ app: ' fangorn ', publisher: ' 0xabc ', namespace: ' media ' }),
  [{ app: 'fangorn', owner: '0xabc', namespace: 'media' }],
);

// A whole app is the SAME source with two sides wildcarded — `*` is what widens the
// watcher to the app-level topic filter and leaves the search scope unconstrained.
// The app is never wildcarded: `fangorn subscribe` filters on it at the topic level.
assert.deepEqual(
  buildSources({ app: ' fangorn ', publisher: '', namespace: '' }),
  [{ app: 'fangorn', owner: '*', namespace: '*' }],
);

// The scope is DERIVED, so this is the load-bearing case: a half-filled pair widens to
// the whole app rather than emitting a half-wildcard the UI never means. Either half
// blank — or blank-once-trimmed — is the whole app.
assert.equal(buildSources({ app: 'x', publisher: '0xabc', namespace: '' })[0].owner, '*');
assert.equal(buildSources({ app: 'x', publisher: '', namespace: 'm' })[0].namespace, '*');
assert.equal(buildSources({ app: 'x', publisher: '  ', namespace: 'm' })[0].owner, '*');

// An app name and its 0x id are both accepted — the worker canonicalises with the same
// keccak as toAppId — so the field is passed through, not pre-hashed here.
assert.equal(buildSources({ app: APP_ID, publisher: '', namespace: '' })[0].app, APP_ID);

// The summary must not count sources: a wildcard source covers whatever the app holds.
assert.equal(describeSources([{ app: 'a', owner: '0x1', namespace: 'n' }]), '1 namespace');
assert.equal(
  describeSources([{ app: 'a', owner: '0x1', namespace: 'n' }, { app: 'a', owner: '0x2', namespace: 'm' }]),
  '2 namespaces',
);
assert.equal(describeSources([{ app: 'a', owner: '*', namespace: '*' }]), 'whole app');
assert.equal(
  describeSources([{ app: 'a', owner: '*', namespace: '*' }, { app: 'a', owner: '0x1', namespace: 'n' }]),
  'whole app + 1 namespace',
);
// A half-wildcard is not a whole app — only both sides are.
assert.equal(describeSources([{ app: 'a', owner: '*', namespace: 'n' }]), '1 namespace');

console.log('fangorn self-check OK');
