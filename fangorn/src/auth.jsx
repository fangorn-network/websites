import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  usePrivy,
  useLogin,
  useFundWallet,
  useWallets,
  useExportWallet,
  useSigners,
  getEmbeddedConnectedWallet,
} from '@privy-io/react-auth';
import { AuthContext } from './authContext';

// sessionStorage is per-tab and cleared when the tab closes, but survives a
// reload — exactly the "re-auth on tab close, stay signed in on refresh"
// semantics we want. Privy itself persists in localStorage, so on the first
// ready after load we check for this tab's marker: no marker + a restored
// session means a freshly opened tab → force re-auth.
const TAB_KEY = 'privy-tab-session';

/**
 * Bridges Privy's usePrivy() into our AuthContext. Must be rendered *inside*
 * PrivyProvider. Keeping every consumer on our own useAuth() hook means no
 * component calls usePrivy() directly, so nothing throws when Privy is absent.
 */
export function PrivyAuthBridge({ children }) {
  const { ready, authenticated, user, logout, getAccessToken } = usePrivy();
  // A login made in this tab lands on the account page. A session Privy restores
  // on load isn't a login (wasAlreadyAuthenticated), so a refresh stays put.
  const { login } = useLogin({
    onComplete: ({ wasAlreadyAuthenticated }) => {
      // Except on a repo's page: someone logging in to buy stays with what they're buying.
      // So does someone connecting an app.
      if (!wasAlreadyAuthenticated && !location.hash.startsWith('#/data/') && !location.hash.startsWith('#/connect')) location.hash = '#/account';
    },
  });
  const { fundWallet } = useFundWallet();
  const { wallets } = useWallets();
  const { exportWallet } = useExportWallet();
  const { addSigners, removeSigners } = useSigners();

  // Decide synchronously at the first ready render whether the session Privy
  // restored belongs to this tab. Doing it in render (not an effect) means a
  // stale session never reaches App as authenticated, so Home never flashes.
  const decidedRef = useRef(false);
  const staleRef = useRef(false);
  if (ready && !decidedRef.current) {
    decidedRef.current = true;
    staleRef.current = authenticated && !sessionStorage.getItem(TAB_KEY);
  }
  const effectiveAuthenticated = authenticated && !staleRef.current;

  useEffect(() => {
    if (!ready) return;
    if (staleRef.current) {
      // Tear the restored session down; clear the latch once logout lands so a
      // fresh in-tab login is treated normally.
      if (authenticated) logout();
      else staleRef.current = false;
      return;
    }
    if (authenticated) sessionStorage.setItem(TAB_KEY, '1');
    else sessionStorage.removeItem(TAB_KEY);
  }, [ready, authenticated, logout]);

  // The user's wallet: the one they signed in with, or the embedded wallet Privy
  // mints for an email login. Briefly null on that path while Privy creates it.
  // fangorn.js's walletClientFor() turns it into a viem client for chain writes.
  const wallet = useMemo(
    () => wallets.find((w) => w.address === user?.wallet?.address) ?? wallets[0] ?? null,
    [wallets, user?.wallet?.address],
  );

  // Open Privy's funding flow for the signed-in user's wallet. Callers don't
  // need to know the address; pass `options` to override chain/amount/asset.
  const fund = useCallback(
    (options) => {
      const address = user?.wallet?.address;
      if (!address) {
        console.warn('No wallet to fund yet.');
        return Promise.resolve();
      }
      return fundWallet({ address, options });
    },
    [fundWallet, user?.wallet?.address],
  );

  // Only an embedded wallet has a key Privy can hand back — a user who signed in
  // with MetaMask already holds theirs. `null` when there's nothing to export, so
  // callers gate the UI on it rather than re-deriving "is this embedded?".
  // The key is shown in Privy's own cross-domain iframe; this app never sees it.
  const embedded = useMemo(() => getEmbeddedConnectedWallet(wallets), [wallets]);
  const exportKey = useMemo(
    // Not passing the click event straight through: exportWallet also accepts a
    // MouseEvent, and handing it one skips the address argument.
    () => (embedded ? () => exportWallet({ address: embedded.address }) : null),
    [exportWallet, embedded],
  );

  // Signers on the embedded wallet: keys a server (the slop store) may sign with, within their policies. Like
  // export, only an embedded wallet has them. removeAll takes off every signer, not one.
  const signers = useMemo(
    () => (embedded ? {
      address: embedded.address,
      add: (list) => addSigners({ address: embedded.address, signers: list }),
      removeAll: () => removeSigners({ address: embedded.address }),
    } : null),
    [addSigners, removeSigners, embedded],
  );

  return (
    <AuthContext.Provider
      value={{
        configured: true,
        ready,
        authenticated: effectiveAuthenticated,
        user,
        wallet,
        login,
        logout,
        fundWallet: fund,
        exportKey,
        signers,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Fallback provider used when VITE_PRIVY_APP_ID is unset — login is a no-op. */
export function DisabledAuthProvider({ children }) {
  const value = {
    configured: false,
    ready: true,
    authenticated: false,
    user: null,
    wallet: null,
    login: () =>
      console.warn('Login unavailable: set VITE_PRIVY_APP_ID in .env.local.'),
    logout: () => {},
    fundWallet: () => {
      console.warn('Funding unavailable: set VITE_PRIVY_APP_ID in .env.local.');
      return Promise.resolve();
    },
    exportKey: null,
    signers: null,
    getAccessToken: async () => null,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
