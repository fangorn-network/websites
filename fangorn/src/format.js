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
