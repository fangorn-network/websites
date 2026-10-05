import { useEffect, useState } from 'react';
import './index.css';
import Nav from './Nav';
import Landing, { UseCases } from './Landing';
import { Footer } from './Footer';
import Home from './Home';
import { useAuth, ACCOUNT_ENABLED } from './authContext';

// ponytail: hash routes, three pages. No router dep, no host fallback config.
function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => { setHash(location.hash); window.scrollTo(0, 0); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return hash;
}

function Account() {
  const { ready, authenticated, user, login } = useAuth();

  if (!ACCOUNT_ENABLED) return <div className="appSplash">Account management — coming soon.</div>;

  // Avoid flashing the login prompt before Privy resolves an existing session.
  if (!ready) return <div className="appSplash" aria-busy="true">Loading…</div>;
  if (!authenticated) {
    return (
      <div className="appSplash">
        <button className="appSplashBtn" onClick={login} type="button">Log in to continue</button>
      </div>
    );
  }
  // Key Home by wallet so switching accounts in-session fully remounts it — the
  // publisher/namespace state is per-wallet and must not carry over.
  return <Home key={user?.wallet?.address} />;
}

export default function App() {
  const hash = useHash();
  const page =
    hash === '#/account' ? <Account /> :
    hash === '#/use-cases' ? <UseCases /> :
    <Landing />;

  return (
    <>
      <Nav />
      {page}
      <Footer />
    </>
  );
}
