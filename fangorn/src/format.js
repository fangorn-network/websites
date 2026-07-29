// Shared pure formatters. Kept out of the page components so the data layer
// (fangorn.js, usage.js) can reuse them without importing UI.
const ARBISCAN = 'https://sepolia.arbiscan.io';

export function truncate(value, lead = 6, tail = 4) {
  if (!value) return '';
  return value.length > lead + tail + 1
    ? `${value.slice(0, lead)}…${value.slice(-tail)}`
    : value;
}

export const explorer = (addr) => `${ARBISCAN}/address/${addr}`;
export const txExplorer = (hash) => `${ARBISCAN}/tx/${hash}`;

// Usage against a limit, for the storage meters. Returns null when there is no
// ceiling to draw — the gate is disabled (limit 0), or a subscription lifted the
// lifetime one. The worker meters into KV, which is eventually consistent and
// debits on grant, so `used` can overshoot the cap: the bar clamps at 100% and
// `remaining` never goes negative.
export function meterState(used, limit) {
  const cap = Number(limit) || 0;
  if (!cap) return null;
  const bytes = Number(used) || 0;
  const ratio = Math.min(bytes / cap, 1);
  return {
    // A non-zero sliver stays visible; exactly zero draws nothing.
    pct: ratio > 0 ? Math.max(ratio * 100, 2) : 0,
    full: ratio >= 0.9,
    remaining: Math.max(cap - bytes, 0),
  };
}

// Byte count → short human size ("512 MB", "1.2 GB"). For the usage dashboard.
export function formatBytes(n) {
  const bytes = Number(n) || 0;
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1; }
  const decimals = value >= 100 || Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[i]}`;
}
