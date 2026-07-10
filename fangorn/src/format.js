// Shared pure formatters. Kept out of the page components so buckets.js and the
// repo view can reuse them without importing UI.
const ARBISCAN = 'https://sepolia.arbiscan.io';

export function truncate(value, lead = 6, tail = 4) {
  if (!value) return '';
  return value.length > lead + tail + 1
    ? `${value.slice(0, lead)}…${value.slice(-tail)}`
    : value;
}

export const explorer = (addr) => `${ARBISCAN}/address/${addr}`;
export const txExplorer = (hash) => `${ARBISCAN}/tx/${hash}`;

// Manifests/data are pinned to Pinata; its gateway resolves single-provider pins
// that ipfs.io often can't. Accepts bare CIDs or ipfs:// URIs.
export const ipfsUrl = (cid) =>
  `https://gateway.pinata.cloud/ipfs/${String(cid).replace(/^ipfs:\/\//, '')}`;

// Unix-ms timestamp → short relative age ("3d ago"). Falls back to '' when absent.
export function relativeTime(ms) {
  if (!ms) return '';
  const secs = Math.round((Date.now() - Number(ms)) / 1000);
  if (secs < 60) return 'just now';
  const units = [
    ['y', 31536000], ['mo', 2592000], ['d', 86400], ['h', 3600], ['m', 60],
  ];
  for (const [label, size] of units) {
    const n = Math.floor(secs / size);
    if (n >= 1) return `${n}${label} ago`;
  }
  return 'just now';
}
