// Run: node src/diff.test.mjs
import assert from 'node:assert';
import { diffLines, diffRecords } from './diff.js';

// Line diff: a middle line replaced.
assert.deepEqual(diffLines('a\nb\nc', 'a\nx\nc'), [
  { type: 'same', text: 'a' },
  { type: 'del', text: 'b' },
  { type: 'add', text: 'x' },
  { type: 'same', text: 'c' },
]);

// Line diff: pure append keeps the shared prefix as 'same'.
assert.deepEqual(diffLines('one', 'one\ntwo'), [
  { type: 'same', text: 'one' },
  { type: 'add', text: 'two' },
]);

// Record diff: one changed field, one added record, one removed record.
const before = [
  { name: 'a', fields: { text: 'hello' } },
  { name: 'gone', fields: { text: 'x' } },
];
const after = [
  { name: 'a', fields: { text: 'world' } },
  { name: 'b', fields: { text: 'new' } },
];
const d = diffRecords(before, after);
assert.deepEqual(d.added, [{ name: 'b', fields: { text: 'new' } }]);
assert.deepEqual(d.removed, [{ name: 'gone', fields: { text: 'x' } }]);
assert.deepEqual(d.changed, [{ name: 'a', fieldDiffs: [{ field: 'text', before: 'hello', after: 'world' }] }]);

// Identical record sets → no changes.
const same = diffRecords(after, after);
assert.equal(same.added.length + same.removed.length + same.changed.length, 0);

console.log('diff self-check OK');
