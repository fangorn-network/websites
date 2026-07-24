// Storage-usage library: the worker meters bytes per wallet (in KV), so it's the
// only source for "total stored" and "daily used". We read its GET /usage endpoint
// (unauthenticated — the counts aren't sensitive). Mirrors the fangorn.js shape:
// a read function + a use* hook consumed by a panel in Home.jsx.
import { useEffect, useState } from 'react';
import { useAuth } from './authContext.js';

// The pinata-url-provider worker. Defaults to the hosted one; override for staging.
export const WORKER_URL = (
  import.meta.env?.VITE_WORKER_URL ?? 'https://pinata-url-provider.fangorn-0be.workers.dev'
).replace(/\/$/, '');

/**
 * A wallet's byte usage, as metered by the worker:
 *   total      – lifetime bytes uploaded through the worker (0 if none)
 *   freeLimit  – FREE_BYTE_LIMIT (0 = free tier disabled)
 *   daily      – bytes uploaded today (UTC)
 *   dailyLimit – DAILY_BYTE_LIMIT (0 = daily cap disabled)
 */
export async function readUsage(address) {
  const res = await fetch(`${WORKER_URL}/usage?address=${address}`);
  if (!res.ok) throw new Error(`Usage ${res.status}`);
  return res.json();
}

/** The signed-in wallet's storage usage. `usage` is null while loading/unavailable. */
export function useUsage() {
  const { user } = useAuth();
  const address = user?.wallet?.address;

  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(Boolean(address));

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    readUsage(address)
      .then((u) => !cancelled && setUsage(u))
      .catch((err) => !cancelled && console.warn('Usage lookup failed:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [address]);

  return { usage, loading };
}
