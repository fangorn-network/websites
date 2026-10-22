import { useEffect, useState } from 'react';
import './index.css';
import Nav from './Nav';
import Landing, { LiveApps } from './Landing';
import { Footer } from './Footer';
import Home from './Home';
import { useAuth, ACCOUNT_ENABLED } from './authContext';

// ponytail: hash routes, a handful of pages. No router dep, no host fallback config.
function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  // After the page for the new hash renders: a section anchor (#start, #contact)
  // scrolls to its section, from any page; a route starts at the top.
  useEffect(() => {
    const section = /^#[\w-]+$/.test(hash) && document.getElementById(hash.slice(1));
    if (section) section.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo(0, 0);
  }, [hash]);
  return hash;
}

function Account({ route }) {
  const { ready, authenticated, user, login } = useAuth();

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
  return <Home key={user?.wallet?.address} appKey={route} />;
}

export default function App() {
  const hash = useHash();
  const page =
    // #/account is the dashboard, #/account/app/<name or id> one app's page.
    hash === '#/account' || hash.startsWith('#/account/') ? <Account route={hash.match(/^#\/account\/app\/(.+)$/)?.[1]} /> :
    hash === '#/explorer' ? <main><LiveApps /></main> :
    <Landing />;

  return (
    <>
      <Nav />
      {page}
      <Footer />
    </>
  );
}
