import { usePrivy } from '@privy-io/react-auth';
import { AuthContext } from './authContext';

/**
 * Bridges Privy's usePrivy() into our AuthContext. Must be rendered *inside*
 * PrivyProvider. Keeping every consumer on our own useAuth() hook means no
 * component calls usePrivy() directly, so nothing throws when Privy is absent.
 */
export function PrivyAuthBridge({ children }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  return (
    <AuthContext.Provider
      value={{ configured: true, ready, authenticated, user, login, logout }}
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
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
