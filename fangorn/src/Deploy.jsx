import { useState } from 'react';
import landing from './Landing.module.css';
import styles from './Deploy.module.css';
import { useAuth } from './authContext';
import { quote, usd, fmtN, FREE } from './pricing';
import { appOf, deployedName, NETWORKS, OPS_REPO } from './deploy';

// #/deploy: size an app and see its price. #/deploy/setup: name it, list its repos, and send it, which opens a pull
// request to the ops repo (POST /api/deploy, worker/deploy.js). Merging the PR deploys the app. Both steps are one
// component (App keeps it mounted across the two hashes), so the answers carry over.

const NUM = { events: 1000, searches: 500, publish: 0, storage: 1 };

function Num({ id, label, hint, value, onChange, step = 1 }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input id={id} className={styles.input} type="number" min="0" step={step} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

function Quote({ q }) {
  return (
    <aside className={styles.quote} aria-live="polite">
      <span className={q.talk.length ? styles.pillTalk : q.paid ? styles.pillPaid : styles.pillFree}>
        {q.talk.length ? 'Talk to us' : q.paid ? 'Paid' : 'Free tier'}
      </span>
      <div className={styles.price}>{usd(q.monthly)}<small> / month</small></div>
      <div className={styles.deposit}>
        {q.gasDeposit > 0 ? `+ ${usd(q.gasDeposit)} a month gas, paid into your app's wallet` : 'No gas to pay'}
      </div>
      {q.talk.length > 0 && <p className={styles.warn}>{q.talk.join('. ')}. That's past what we size automatically: <a href="#contact">get in touch</a> and we'll quote it.</p>}
      <table className={styles.lines}>
        <tbody>
          {q.lines.map((l) => (
            <tr key={l.key}><td>{l.name}<span>{l.usage}</span></td><td>{usd(l.price)}</td></tr>
          ))}
          {q.platformFee > 0 && <tr><td>Platform fee<span>for any app past the free tier</span></td><td>{usd(q.platformFee)}</td></tr>}
        </tbody>
      </table>
      <p className={styles.small}>
        Free up to {FREE.follows} repos, {fmtN(FREE.events)} new records and {fmtN(FREE.searches)} searches a day,{' '}
        {FREE.publish} publishes a day and {FREE.storage} GB of files. Gas is a deposit, not a fee: unused gas stays in the app's wallet. Testnet gas is on us.
      </p>
    </aside>
  );
}

export default function Deploy() {
  const setup = location.hash.startsWith('#/deploy/setup');
  const { ready, authenticated, login, getAccessToken, user } = useAuth();
  const [network, setNetwork] = useState('baseSepolia');
  const [usage, setUsage] = useState({ follows: 1, view: false, ...NUM });
  const [app, setApp] = useState({ name: '', title: '', follow: '', publishView: '', instructions: '' });
  const [sent, setSent] = useState({ busy: false, error: null, done: null });
  const set = (k) => (v) => setUsage((u) => ({ ...u, [k]: v }));
  const setA = (k) => (e) => setApp((a) => ({ ...a, [k]: e.target.value }));
  const n = (v) => Math.max(0, Number(v) || 0);

  const follows = app.follow.split(/[\s,]+/).filter(Boolean);
  const u = {
    network, follows: setup ? Math.max(1, follows.length) : Math.max(1, Math.round(n(usage.follows))),
    events: n(usage.events), searches: n(usage.searches), publish: Math.round(n(usage.publish)), storage: n(usage.storage), view: usage.view,
  };
  const q = quote(u);
  const request = { ...app, network, follow: follows, publishPerDay: u.publish, publishView: usage.view ? app.publishView : '', usage: u };
  let problem = null;
  try { appOf(request); } catch (e) { problem = e.message; }
  const me = user?.wallet?.address;

  const send = async () => {
    setSent({ busy: true, error: null, done: null });
    try {
      const res = await fetch('/api/deploy', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${await getAccessToken()}` }, body: JSON.stringify(request),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || `answered ${res.status}`);
      setSent({ busy: false, error: null, done: out });
    } catch (e) { setSent({ busy: false, error: e?.message ?? String(e), done: null }); }
  };

  const networkPicker = (
    <div className={styles.seg} role="group" aria-label="Network">
      {Object.entries(NETWORKS).map(([k, label]) => (
        <button key={k} type="button" aria-pressed={network === k} onClick={() => setNetwork(k)}>{label}</button>
      ))}
    </div>
  );

  if (sent.done) return (
    <main>
      <section className={landing.section}>
        <h1 className={landing.h2}>Request sent</h1>
        <p className={landing.sectionSub}>
          We opened <a href={sent.done.url} target="_blank" rel="noreferrer">pull request #{sent.done.number}</a> to add{' '}
          <b>{sent.done.name}</b>. Once it's reviewed and merged, your app goes live at{' '}
          <code>https://{sent.done.deployed}.fangorn.network/mcp</code>, usually within a few minutes.
          {q.paid && ' We\'ll be in touch about payment before it merges.'}
        </p>
        <p className={landing.sectionSub}>You can follow the review on the pull request. Its checks show exactly what will be deployed.</p>
      </section>
    </main>
  );

  return (
    <main>
      <section className={landing.section}>
        <p className={styles.steps}><span aria-current={!setup ? 'step' : undefined}>1. Size</span> → <span aria-current={setup ? 'step' : undefined}>2. Set up</span></p>
        <h1 className={landing.h2}>{setup ? 'Set up your app' : 'Deploy an app'}</h1>
        <p className={landing.sectionSub}>
          {setup
            ? 'Name your app and list the repos it follows. Sending it opens a pull request; once it\'s merged, the app is live.'
            : 'We host it: a server that follows your repos, searches them by meaning, serves them to agents over MCP, and can pay the gas for people publishing through it. Tell us roughly how it\'ll be used to see the price.'}
        </p>

        <div className={styles.grid}>
          <div className={styles.form}>
            {!setup ? (
              <>
                <div className={styles.field}><span className={styles.label}>Network</span>{networkPicker}</div>
                <Num id="d-follows" label="Repos it follows" value={usage.follows} onChange={set('follows')}
                  hint="Each one is checked for new records every minute." />
                <Num id="d-events" label="New records a day" step={100} value={usage.events} onChange={set('events')}
                  hint="Records landing in those repos, from anyone. A guess is fine." />
                <Num id="d-searches" label="Searches a day" step={100} value={usage.searches} onChange={set('searches')}
                  hint="Searches by agents and people, over MCP or the API." />
                <Num id="d-publish" label="Publishes a day we pay gas for" step={10} value={usage.publish} onChange={set('publish')}
                  hint="Lets people publish through your app without holding gas. 0 keeps it read-only." />
                <Num id="d-storage" label="Files stored through the app (GB)" value={usage.storage} onChange={set('storage')} />
                <label className={styles.check}>
                  <input type="checkbox" checked={usage.view} onChange={(e) => set('view')(e.target.checked)} />
                  <span><b>Publish the index as a repo</b> Each time it changes, so a static page can read it without the server. One transaction each time.</span>
                </label>
                <div className={styles.actions}>
                  <a className={landing.btnA} href="#/deploy/setup" aria-disabled={q.talk.length > 0}
                    onClick={(e) => { if (q.talk.length) e.preventDefault(); }}>Next: set it up</a>
                </div>
              </>
            ) : (
              <>
                <div className={styles.field}><span className={styles.label}>Network</span>{networkPicker}</div>
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
                  <span className={styles.hint}>What agents and the connect page call it.</span>
                </div>
                <div className={styles.field}>
                  <label htmlFor="d-follow">Repos it follows</label>
                  <textarea id="d-follow" className={styles.input} rows={4} value={app.follow} onChange={setA('follow')}
                    placeholder={`${me ?? '0x…'}/kelp-surveys`} />
                  <span className={styles.hint}>One per line, as <code>publisher address/repo</code>. Any publisher's repos, not only yours.</span>
                </div>
                <Num id="d-publish2" label="Publishes a day we pay gas for" step={10} value={usage.publish} onChange={set('publish')} />
                {usage.view && (
                  <div className={styles.field}>
                    <label htmlFor="d-view">Repo to publish the index to</label>
                    <input id="d-view" className={styles.input} value={app.publishView} placeholder={`${app.name || 'kelp-surveys'}-view`} onChange={setA('publishView')} />
                  </div>
                )}
                <div className={styles.field}>
                  <label htmlFor="d-instr">Instructions for agents <span className={styles.opt}>optional</span></label>
                  <textarea id="d-instr" className={styles.input} rows={5} value={app.instructions} onChange={setA('instructions')}
                    placeholder="What the records are and how to use them." />
                  <span className={styles.hint}>Shown to agents when they connect. <code>{'{gateway}'}</code> becomes the network's file gateway.</span>
                </div>
                {sent.error && <p className={styles.warn} role="alert">Couldn't send it: {sent.error}</p>}
                <div className={styles.actions}>
                  <a className={landing.btnB} href="#/deploy">Back</a>
                  {!ready ? null : !authenticated ? (
                    <button className={landing.btnA} type="button" onClick={login}>Log in to send</button>
                  ) : (
                    <button className={landing.btnA} type="button" onClick={send} disabled={Boolean(problem) || q.talk.length > 0 || sent.busy}>
                      {sent.busy ? 'Sending…' : q.paid ? `Send request (${usd(q.monthly)}/mo)` : 'Send request'}
                    </button>
                  )}
                </div>
                {problem && (app.name || app.follow) && <p className={styles.hint}>{problem}</p>}
                <p className={styles.small}>
                  Sending opens a public pull request to <a href={`https://github.com/${OPS_REPO}`} target="_blank" rel="noreferrer">{OPS_REPO}</a> with
                  this config and your wallet address. {q.paid && 'Paid apps are deployed once payment is sorted out.'}
                </p>
              </>
            )}
          </div>
          <Quote q={q} />
        </div>
      </section>
    </main>
  );
}
