import './index.css';
import Nav from './Nav';
import Hero from './Hero';
import Products from './Products';
import Team from './Team';
import { Cta, Footer } from './Footer';
import Home from './Home';
import { useAuth } from './authContext';

function Landing() {
  return (
    <>
      <Nav />
      <Hero />
      <Products />
      <Team />
      <Cta />
      <Footer />
    </>
  );
}

export default function App() {
  const { ready, authenticated, user } = useAuth();

  // Avoid a flash of the landing page before Privy resolves an existing session.
  if (!ready) {
    return <div className="appSplash" aria-busy="true">Loading…</div>;
  }

  // Key Home by wallet so switching accounts in-session fully remounts it — the
  // bucket/repo state is per-wallet and must not carry over from the last one.
  return authenticated ? <Home key={user?.wallet?.address} /> : <Landing />;
}
