import { useEffect, useState } from 'react';
import './index.css';
import Nav from './Nav';
import Landing from './Landing';
import { Footer } from './Footer';
import Home from './Home';
import Connect from './Connect';
import Explore from './Explore';
import RepoPage from './RepoPage';
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

function Account({ path }) {
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
  // publisher state is per-wallet and must not carry over.
  return <Home key={user?.wallet?.address} path={path} />;
}

export default function App() {
  const hash = useHash();
  const page =
    hash === '#/account' || hash.startsWith('#/account/') ? <Account path={hash.split('/').slice(2)} /> :
    hash === '#/explore' || hash === '#/explorer' ? <Explore /> :
    // #/connect?app=…&repos=…: any app asking to publish for you (worker/index.js signs for it).
    hash.startsWith('#/connect') ? <Connect /> :
    // #/data/<publisher>/<repo>: one repo's public page, the link a publisher shares.
    hash.startsWith('#/data/') ? <RepoPage publisher={hash.split('/')[2]} repo={decodeURIComponent(hash.split('/').slice(3).join('/'))} /> :
    <Landing />;

  return (
    <>
      <Nav />
      {page}
      <Footer />
    </>
  );
}
