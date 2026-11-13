import { useState } from 'react';
import styles from './Landing.module.css';
import { useAuth } from './authContext';

// #/connect?app=<url>&repos=<a,b>[&name=<shown name>][&mcp=<MCP url>]: let an app publish to some of your repos.
//
// Any app links here; there's nothing to register. The first time, Fangorn becomes a signer on your embedded wallet
// (one key, limited by policy to Fangorn Data updates). Then /api/grants gives this app a token covering only the
// repos below, which it uses to ask /api/sign for each update. A new token for the same app replaces the old one.
const SIGNER = import.meta.env?.VITE_FANGORN_SIGNER_ID; // Fangorn's key quorum id, from the Privy dashboard
const POLICY = import.meta.env?.VITE_FANGORN_SIGNER_POLICY_ID; // optional: the policy that limits it

const paramsOf = () => new URLSearchParams(location.hash.split('?')[1] ?? '');
const linkBtn = { font: 'inherit', background: 'none', border: 0, padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' };

export default function Connect() {
  const { configured, ready, authenticated, login, signers, getAccessToken } = useAuth();
  const [state, setState] = useState({ busy: false, token: null, error: null, done: null });
  const [copied, setCopied] = useState(false);

  const p = paramsOf();
  let app = null;
  try { const u = new URL(p.get('app') ?? ''); if (/^https?:$/.test(u.protocol)) app = u.origin; } catch { /* shown below */ }
  const repos = (p.get('repos') ?? '').split(',').map((r) => r.trim()).filter(Boolean);
  const name = p.get('name') || app;
  let mcp = null;
  try { const u = new URL(p.get('mcp') ?? ''); if (u.origin === app) mcp = u.href; } catch { /* no MCP command then */ }

  const call = async (method, body) => {
    const res = await fetch('/api/grants', {
      method, headers: { 'content-type': 'application/json', authorization: `Bearer ${await getAccessToken()}` }, body: JSON.stringify(body),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || `answered ${res.status}`);
    return out;
  };
  const run = (fn) => async () => {
    setState({ busy: true, token: null, error: null, done: null });
    try { setState({ busy: false, error: null, token: null, done: null, ...(await fn()) }); }
    catch (e) { setState({ busy: false, token: null, error: e?.message ?? String(e), done: null }); }
  };
  const connect = run(async () => {
    // Adding a signer the wallet already has fails; that's fine, it's there.
    await signers.add([{ signerId: SIGNER, policyIds: POLICY ? [POLICY] : [] }]).catch((e) => { if (!/already/i.test(e?.message ?? '')) throw e; });
    return { token: (await call('POST', { app, repos })).token };
  });
  const revoke = run(async () => { await call('DELETE', { app }); return { done: `${name} can no longer publish for you.` }; });
  const removeAll = run(async () => { await signers.removeAll(); return { done: 'Fangorn can no longer sign for your wallet, for any app.' }; });

  const shown = state.token && (mcp
    ? `claude mcp add --transport http ${new URL(app).hostname.split('.')[0]} ${mcp} --header "Authorization: Bearer ${state.token}"`
    : state.token);
  const copy = async () => { await navigator.clipboard.writeText(shown); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  let body;
  if (!app || !repos.length) body = <p className={styles.sectionSub}>This link is missing the app or the repos it wants. Ask the app for a new one.</p>;
  else if (!configured || !SIGNER) body = <p className={styles.sectionSub}>Connecting apps isn't available on this build yet.</p>;
  else if (!ready) body = <p className={styles.sectionSub} aria-busy="true">Loading…</p>;
  else if (!authenticated) body = (
    <>
      <p className={styles.sectionSub}>Sign in with your email. If you're new, that makes you a Fangorn wallet; there's nothing to install or fund.</p>
      <button className="appSplashBtn" onClick={login} type="button">Sign in</button>
    </>
  );
  else if (!signers) body = (
    <p className={styles.sectionSub}>
      Apps can only publish for a wallet Fangorn made for you, and you signed in with your own. Sign in with your
      email instead, or publish with the Fangorn CLI using your wallet's key.
    </p>
  );
  else body = (
    <>
      <p className={styles.sectionSub}>
        <b>{name}</b> <span style={{ opacity: 0.7 }}>({app})</span> wants to publish to {repos.length > 1 ? 'these repos' : 'this repo'} of
        yours, signed by your wallet ({signers.address.slice(0, 6)}…{signers.address.slice(-4)}):{' '}
        <b>{repos.join(', ')}</b>. It can't touch any other repo, spend anything, or sign anything else.
      </p>
      {!state.token && <button className="appSplashBtn" onClick={connect} disabled={state.busy} type="button">{state.busy ? 'Connecting…' : `Allow ${name}`}</button>}
      {shown && (
        <>
          <p className={styles.sectionSub}>{mcp ? 'Paste this into a terminal. Your agent can publish from then on.' : `Give this to ${name}:`}</p>
          <div className={styles.cmd}><pre>{shown}</pre></div>
          <p><button className="appSplashBtn" onClick={copy} type="button">{copied ? 'Copied' : 'Copy'}</button></p>
          <p className={styles.sectionSub}>
            It's shown once. Keep it like a password: whoever has it can publish to {repos.join(', ')} as you.
            Allowing {name} again makes a new one, and the old one stops working.
          </p>
        </>
      )}
      {state.error && <p className={styles.sectionSub} role="alert">Couldn't connect: {state.error}</p>}
      {state.done && <p className={styles.sectionSub} role="status">{state.done}</p>}
      <p className={styles.sectionSub}>
        <button type="button" style={linkBtn} onClick={revoke} disabled={state.busy}>Disconnect {name}</button>
        {' · '}
        <button type="button" style={linkBtn} onClick={removeAll} disabled={state.busy}>Stop Fangorn signing for every app</button>
      </p>
    </>
  );

  return (
    <main>
      <section className={styles.section}>
        <h1 className={styles.h2}>Connect an app</h1>
        {body}
      </section>
    </main>
  );
}
