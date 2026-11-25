import { useEffect, useState } from 'react';
import './index.css';
import Nav from './Nav';
import Landing from './Landing';
import { Footer } from './Footer';
import Home from './Home';
import Connect from './Connect';
import Explore from './Explore';
import RepoPage from './RepoPage';
import Deploy from './Deploy';
import { parseRepoHash } from './account';
import { useAuth, ACCOUNT_ENABLED } from './authContext';
import { NETWORKS, setNet, useNet } from './fangorn';

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
  const net = useNet();

  // Avoid flashing the login prompt before Privy resolves an existing session.
  if (!ready) return <div className="appSplash" aria-busy="true">Loading…</div>;
  if (!authenticated) {
    return (
      <div className="appSplash">
        <button className="appSplashBtn" onClick={login} type="button">Log in to continue</button>
      </div>
    );
  }
  // Key Home by wallet and network so switching either fully remounts it — the publisher
  // state is per-wallet and per-network and must not carry over (nor show one network's list
  // while the other's loads).
  return <Home key={`${user?.wallet?.address}:${net}`} path={path} net={net} />;
}

export default function App() {
  const hash = useHash();
  const net = useNet();
  // A link that names a network switches the site to it, so a shared link shows what it points
  // at: a repo's page (old links without one are testnet's), or one of your repos in the account.
  useEffect(() => {
    const named = hash.startsWith('#/data/') ? parseRepoHash(hash).net : hash.match(/^#\/account\/data\/([^/]+)\/./)?.[1];
    if (named) setNet(named); // ignores anything that isn't a network
  }, [hash]);
  const page =
    hash === '#/account' || hash.startsWith('#/account/') ? <Account path={hash.split('/').slice(2)} /> :
    hash === '#/explore' || hash === '#/explorer' ? <Explore /> :
    // #/connect?app=…&repos=…: any app asking to publish for you (worker/index.js signs for it).
    hash.startsWith('#/connect') ? <Connect /> :
    // #/deploy, #/deploy/setup: size a hosted app, then send it as a pull request to the ops repo.
    hash === '#/deploy' || hash.startsWith('#/deploy/') ? <Deploy /> :
    // #/data/<net>/<publisher>/<repo>: one repo's public page, the link a publisher shares.
    hash.startsWith('#/data/') ? <RepoPage key={hash} {...parseRepoHash(hash)} /> :
    <Landing />;

  return (
    <>
      <Nav />
      {NETWORKS[net].chain.testnet && <div className="netBanner" role="note">Testnet: test tokens, no real value.</div>}
      {page}
      <Footer />
    </>
  );
}
