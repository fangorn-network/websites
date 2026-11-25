import { useCallback, useEffect, useState } from 'react';
import landing from './Landing.module.css';
import styles from './Deploy.module.css';
import { useAuth } from './authContext';
import { appOf, deployedName, NETWORKS, OPS_REPO } from './deploy';

// #/deploy: self-serve apps in the pool (worker/apps.js, ../../pricing_3.md). Free and read-only: name it, list the
// repos it follows, and deploy. Each change is a commit to the ops repo, which deploys it in about two minutes; the
// page waits for the app's /api.json to answer. "Your apps" lists the signed-in wallet's apps, to pause, resume or
// remove. Publishing (gas), checks and paid features still go through a PR to the ops repo.

const POLL_MS = 10_000;

/** live | deploying | paused, from the app's own /api.json. */
function useLive(url, paused) {
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (live) return;
    let stop = false, timer;
    const check = async () => {
      try { if ((await fetch(`${url}/api.json`, { cache: 'no-store' })).ok) { if (!stop) setLive(true); return; } } catch { /* not up yet */ }
      if (!stop) timer = setTimeout(check, POLL_MS);
    };
    check();
    return () => { stop = true; clearTimeout(timer); };
  }, [url, live]);
  return paused ? 'paused' : live ? 'live' : 'deploying';
}

function AppRow({ app, call, busy }) {
  const state = useLive(app.url, app.config.paused);
  return (
    <tr>
      <td>
        {state === 'live' ? <a href={`${app.url}/api.json`} target="_blank" rel="noreferrer">{app.deployed}</a> : app.deployed}
        <span>{state === 'deploying' ? 'deploying, about two minutes…' : state} · {app.config.follow.length} repo{app.config.follow.length > 1 ? 's' : ''}{state === 'live' && <> · <code>{app.url}/mcp</code></>}</span>
      </td>
      <td>
        <button type="button" className={styles.link} disabled={busy} onClick={() => call('PATCH', app.name, { paused: !app.config.paused })}>{app.config.paused ? 'Resume' : 'Pause'}</button>
        {' · '}
        <button type="button" className={styles.link} disabled={busy}
          onClick={() => confirm(`Remove ${app.deployed}? Its index goes with it.`) && call('DELETE', app.name)}>Remove</button>
      </td>
    </tr>
  );
}

export default function Deploy() {
  const { ready, authenticated, login, getAccessToken, user } = useAuth();
  const [network, setNetwork] = useState('baseSepolia');
  const [app, setApp] = useState({ name: '', title: '', follow: '', instructions: '' });
  const [mine, setMine] = useState(null);
  const [state, setState] = useState({ busy: false, error: null });
  const setA = (k) => (e) => setApp((a) => ({ ...a, [k]: e.target.value }));

  const request = { ...app, network, follow: app.follow.split(/[\s,]+/).filter(Boolean) };
  let problem = null;
  try { appOf(request); } catch (e) { problem = e.message; }
  const me = user?.wallet?.address;

  const api = useCallback(async (method, path = '', body) => {
    const res = await fetch(`/api/apps${path}`, {
      method, headers: { 'content-type': 'application/json', authorization: `Bearer ${await getAccessToken()}` },
      ...(body && { body: JSON.stringify(body) }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `answered ${res.status}`);
    return out;
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    let stop = false;
    api('GET').then((o) => { if (!stop) setMine(o.apps); }, (e) => { if (!stop) setState({ busy: false, error: e.message }); });
    return () => { stop = true; };
  }, [ready, authenticated, api]);

  const run = async (fn) => {
    setState({ busy: true, error: null });
    try { await fn(); setState({ busy: false, error: null }); }
    catch (e) { setState({ busy: false, error: e?.message ?? String(e) }); }
  };
  const create = () => run(async () => {
    const made = await api('POST', '', request);
    setMine((m) => [...(m ?? []), made]);
    setApp({ name: '', title: '', follow: '', instructions: '' });
  });
  const call = (method, name, body) => run(async () => {
    const out = await api(method, `/${name}`, body);
    setMine((m) => method === 'DELETE' ? m.filter((a) => a.name !== name) : m.map((a) => a.name === name ? out : a));
  });

  return (
    <main>
      <section className={landing.section}>
        <h1 className={landing.h2}>Deploy an app</h1>
        <p className={landing.sectionSub}>
          An index that follows repos on Fangorn, searches them by meaning and serves them to agents over MCP, at its own
          address. Free and read-only. It's live in about two minutes.
        </p>

        <div className={styles.grid}>
          <div className={styles.form}>
            <div className={styles.field}>
              <span className={styles.label}>Network</span>
              <div className={styles.seg} role="group" aria-label="Network">
                {Object.entries(NETWORKS).map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={network === k} onClick={() => setNetwork(k)}>{label}</button>
                ))}
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="d-name">Name</label>
              <input id="d-name" className={styles.input} value={app.name} placeholder="kelp-surveys" onChange={(e) => setApp((a) => ({ ...a, name: e.target.value.toLowerCase() }))} />
              <span className={styles.hint}>
                Lowercase letters, digits and dashes. Your app will be at{' '}
                <code>{deployedName(app.name || 'name', network)}.fangorn.network</code>. It can't change later.
              </span>
            </div>
            <div className={styles.field}>
              <label htmlFor="d-title">Display name <span className={styles.opt}>optional</span></label>
              <input id="d-title" className={styles.input} value={app.title} placeholder="Kelp surveys" onChange={setA('title')} />
              <span className={styles.hint}>What agents call it.</span>
            </div>
            <div className={styles.field}>
              <label htmlFor="d-follow">Repos it follows</label>
              <textarea id="d-follow" className={styles.input} rows={4} value={app.follow} onChange={setA('follow')}
                placeholder={`${me ?? '0x…'}/kelp-surveys`} />
              <span className={styles.hint}>One per line, as <code>publisher address/repo</code>. Any publisher's repos, not only yours.</span>
            </div>
            <div className={styles.field}>
              <label htmlFor="d-instr">Instructions for agents <span className={styles.opt}>optional</span></label>
              <textarea id="d-instr" className={styles.input} rows={4} value={app.instructions} onChange={setA('instructions')}
                placeholder="What the records are and how to use them." />
              <span className={styles.hint}>Shown to agents when they connect. <code>{'{gateway}'}</code> becomes the network's file gateway.</span>
            </div>
            {state.error && <p className={styles.warn} role="alert">{state.error}</p>}
            <div className={styles.actions}>
              {!ready ? null : !authenticated ? (
                <button className={landing.btnA} type="button" onClick={login}>Log in to deploy</button>
              ) : (
                <button className={landing.btnA} type="button" onClick={create} disabled={Boolean(problem) || state.busy}>
                  {state.busy ? 'Working…' : 'Deploy'}
                </button>
              )}
            </div>
            {problem && (app.name || app.follow) && <p className={styles.hint}>{problem}</p>}
            <p className={styles.small}>
              Deploying commits the app's config, with your wallet address, to <code>{OPS_REPO}</code>, where every hosted
              app is kept. Publishing through the app, checks, and charging for reads are coming; for now they go through us.
            </p>
          </div>

          <aside className={styles.quote} aria-live="polite">
            <span className={styles.pillFree}>Free</span>
            <h2 className={styles.label}>Your apps</h2>
            {!authenticated ? <p className={styles.small}>Log in to see your apps.</p>
              : mine == null ? <p className={styles.small}>Loading…</p>
              : !mine.length ? <p className={styles.small}>None yet.</p>
              : (
                <table className={styles.lines}>
                  <tbody>{mine.map((a) => <AppRow key={a.name} app={a} call={call} busy={state.busy} />)}</tbody>
                </table>
              )}
            <p className={styles.small}>Up to 3 apps per wallet. Each one checks its repos for new records every minute.</p>
          </aside>
        </div>
      </section>
    </main>
  );
}
