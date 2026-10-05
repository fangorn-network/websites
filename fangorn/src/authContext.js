import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an auth provider');
  return ctx;
}

// Account hub is "coming soon" unless VITE_ENABLE_ACCOUNT=true at build time.
export const ACCOUNT_ENABLED = import.meta.env?.VITE_ENABLE_ACCOUNT === 'true';
