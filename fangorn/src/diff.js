// Pure diff helpers for record-set data. No React, no fetch — unit-testable.

// Line-level LCS diff of two strings → [{ type: 'same'|'add'|'del', text }].
// ponytail: O(n*m) LCS. Fine for document-sized fields; swap in Myers if you
// ever diff megabytes.
export function diffLines(before, after) {
  const a = String(before ?? '').split('\n');
  const b = String(after ?? '').split('\n');
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const out = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { out.push({ type: 'same', text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: 'del', text: a[i] }); i++; }
    else { out.push({ type: 'add', text: b[j] }); j++; }
  }
  while (i < m) out.push({ type: 'del', text: a[i++] });
  while (j < n) out.push({ type: 'add', text: b[j++] });
  return out;
}

function diffFields(oldF, newF) {
  const keys = new Set([...Object.keys(oldF ?? {}), ...Object.keys(newF ?? {})]);
  const out = [];
  for (const k of keys) {
    const before = oldF?.[k], after = newF?.[k];
    if (before !== after) out.push({ field: k, before, after });
  }
  return out;
}

// Compare two record sets (arrays of { name, fields }) by record name. Returns
// whole added/removed records and, for records in both, the per-field
// before/after where a field changed.
export function diffRecords(oldRecs, newRecs, isRoot = false) {
  const oldMap = new Map((oldRecs ?? []).map((r) => [r.name, r.fields ?? {}]));
  const newMap = new Map((newRecs ?? []).map((r) => [r.name, r.fields ?? {}]));

  const added = [], removed = [], changed = [];
  for (const [name, fields] of newMap) {
    if (!oldMap.has(name)) { added.push({ name, fields }); continue; }
    const fieldDiffs = diffFields(oldMap.get(name), fields);
    if (fieldDiffs.length) changed.push({ name, fieldDiffs });
  }
  for (const [name, fields] of oldMap) if (!newMap.has(name)) removed.push({ name, fields });
  return { added, removed, changed, isRoot };
}
