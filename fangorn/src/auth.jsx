import { useCallback } from 'react';
import { usePrivy, useFundWallet } from '@privy-io/react-auth';
import { AuthContext } from './authContext';

/**
 * Bridges Privy's usePrivy() into our AuthContext. Must be rendered *inside*
 * PrivyProvider. Keeping every consumer on our own useAuth() hook means no
 * component calls usePrivy() directly, so nothing throws when Privy is absent.
 */
export function PrivyAuthBridge({ children }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { fundWallet } = useFundWallet();

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

  return (
    <AuthContext.Provider
      value={{
        configured: true,
        ready,
        authenticated,
        user,
        login,
        logout,
        fundWallet: fund,
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
    login: () =>
      console.warn('Login unavailable: set VITE_PRIVY_APP_ID in .env.local.'),
    logout: () => {},
    fundWallet: () => {
      console.warn('Funding unavailable: set VITE_PRIVY_APP_ID in .env.local.');
      return Promise.resolve();
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
