import { useState } from 'react';
import styles from './Landing.module.css';
import { formatUnits } from 'viem';
import { useAuth, ACCOUNT_ENABLED } from './authContext';
import { useAllApps } from './account';

const QUICKSTART = [
  {
    tab: 'Claude MCP',
    cmd: `claude mcp add fangorn -e FANGORN_NETWORK=baseSepolia -- \\
  npx -y -p @fangorn-network/westmarch -p @huggingface/transformers fangorn-mcp`,
    note: 'Paste this into your terminal. No account, no wallet required.',
  },
  {
    tab: 'Claude Code Skills',
    // Slash commands, typed inside Claude Code. The same tools as skills.
    cmd: `/plugin marketplace add fangorn-network/westmarch
/plugin install fangorn-index@fangorn-index`,
    note: 'Run these inside Claude Code.',
  },
];

const FEATURES = [
  {
    title: 'Fuse & Embed Any Dataset',
    body: 'Combine disparate datasets into an extensible knowledge graph, generate embeddings, and and publish them as an app: a static site people search, and tools agents call.',
  },
  {
    title: 'Install One MCP, Access Every App',
    body: 'Agents install a single Fangorn MCP to access all registered web apps via WebMCP tools and headless browser integration, enabling instant cross-app intelligence.',
  },
  {
    title: 'Fine-Grained Access Control',
    body: 'Gate data access down to individual graph vertices. Monetize high-value data feeds and accept automated x402 payments.',
  },
  {
    title: 'On-Chain Identity & Reputation',
    body: 'Every app is registered as an ERC-8004 agent on-chain, earning verifiable reputation and building history over time.',
  },
];

function Copy({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={styles.copy}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? '✓ copied' : 'copy'}
    </button>
  );
}

// Logged in → straight to the hub; logged out → Privy, and App sends them on to
// the hub once authenticated (see `#/account` handling there).
function AccountButton({ children }) {
  const { ready, authenticated, login } = useAuth();
  if (authenticated) return <a href="#/account" className={styles.btnB}>{children}</a>;
  return (
    <button
      type="button"
      className={styles.btnB}
      disabled={!ready}
      onClick={() => { location.hash = '#/account'; login(); }}
    >
      {children}
    </button>
  );
}

function Tabs({ items, value, onChange }) {
  return (
    <div className={styles.tabs} role="tablist">
      {items.map((t, i) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={value === i}
          className={value === i ? styles.tabOn : styles.tab}
          onClick={() => onChange(i)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function Quickstart() {
  const [i, setI] = useState(0);
  const q = QUICKSTART[i];
  return (
    <section className={styles.section}>
      <div className={styles.terminal}>
        <Tabs items={QUICKSTART.map((x) => x.tab)} value={i} onChange={setI} />
        <div className={styles.cmd}>
          <pre>{q.cmd}</pre>
          <Copy text={q.cmd} />
        </div>
      </div>
      <p className={styles.caption}>{q.note}</p>
    </section>
  );
}

function Bento() {
  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>One stack, from raw data to agent</h2>
      <div className={styles.bento}>
        {FEATURES.map((f) => (
          <div key={f.title} className={styles.card}>
            <h3 className={styles.cardTitle}>{f.title}</h3>
            <p className={styles.cardBody}>{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// Illustrative only: shapes of a Kingsfoil search, not real records.
const SAMPLE_QUERY = 'phase 2 trials for type 1 diabetes near Boston';
const SAMPLE_ROWS = [
  ['Closed-loop insulin delivery in adolescents', 'Recruiting · Boston, MA'],
  ['Teplizumab follow-up in early-stage T1D', 'Recruiting · Cambridge, MA'],
  ['Islet cell encapsulation safety study', 'Not yet recruiting · Worcester, MA'],
];

const AGENT_LOG = `→ open-app { "app": "kingsfoil" }
← tools: kingsfoil__search, …

→ kingsfoil__search {
    "query": "${SAMPLE_QUERY}"
  }
← [
    { "title": "${SAMPLE_ROWS[0][0]}",
      "status": "RECRUITING", "phase": "PHASE2",
      "site": "Boston, MA", "score": 0.91 },
    …
  ]`;

const VIEWS = [
  {
    tab: '👤 Human Experience',
    points: ['Privacy-preserving static site', 'Lightning-fast vector search', '100% offline ready'],
  },
  {
    tab: '🤖 Agent Experience',
    points: ['Zero custom MCP setup', 'Structured WebMCP schema', 'Automated paywall handling'],
  },
];

function DualViewPreview() {
  const [v, setV] = useState(0);
  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>One dataset. Two front doors.</h2>
      <p className={styles.sectionSub}>The same app serves people in a browser and agents over WebMCP.</p>
      <div className={styles.dual}>
        <Tabs items={VIEWS.map((x) => x.tab)} value={v} onChange={setV} />
        <div className={styles.dualBody} key={v}>
          {v === 0 ? (
            <div className={styles.browser}>
              <div className={styles.browserBar}><span /><span /><span /><code>kingsfoil.pages.dev</code></div>
              <div className={styles.browserPage}>
                <div className={styles.search}>{SAMPLE_QUERY}</div>
                {SAMPLE_ROWS.map(([t, m]) => (
                  <div key={t} className={styles.row}>
                    <div>{t}</div>
                    <div className={styles.rowMeta}>{m}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <pre className={styles.editor}>{AGENT_LOG}</pre>
          )}
          <ul className={styles.points}>
            {VIEWS[v].points.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

const usdc = (n) => `$${formatUnits(n, 6)}`;

// One registered app, straight from its agent card.
function AppTile({ app }) {
  const cost = app.pass ? `${usdc(app.pass.price)}${app.pass.days ? ` / ${app.pass.days} days` : ''}`
    : app.price ? `${usdc(app.price)} / record` : 'Free';
  return (
    <div className={styles.case}>
      <div className={styles.caseTop}>
        <span className={styles.pill}>{app.tags[0] ?? 'app'}</span>
        <span className={styles.badge}>ERC-8004</span>
      </div>
      <div className={styles.caseName}>{app.name ?? app.appId.slice(0, 10)}</div>
      <p className={styles.caseBody}>{app.description}</p>
      <div className={styles.stat}>{cost}</div>
      <div className={styles.caseLinks}>
        {app.site && <a href={app.site} className={styles.btnSm}>Open App ↗</a>}
        <a href={app.uri} className={styles.link}>Agent card</a>
      </div>
    </div>
  );
}

// Every live app in the AppRegistry. The in-site explorer, until the standalone
// one moves here.
export function LiveApps({ limit }) {
  const apps = useAllApps();
  const shown = apps && limit ? apps.slice(0, limit) : apps;
  return (
    <section className={styles.section} id="apps">
      <div className={styles.casesHead}>
        <h2 className={styles.h2}>Live on Fangorn</h2>
        {limit && apps?.length > limit && <a href="#/explorer" className={styles.link}>All {apps.length} apps</a>}
      </div>
      <p className={styles.sectionSub}>
        Read live from the app registry. Each one is a site you can search, and an agent any{' '}
        <code className={styles.inline}>fangorn-mcp</code> can open by name.
      </p>
      {shown === null ? <p className={styles.caption}>Reading the registry…</p>
        : shown && shown.length === 0 ? <p className={styles.caption}>No apps are live right now.</p>
        : <div className={styles.caseGrid}>{shown.map((a) => <AppTile key={a.appId} app={a} />)}</div>}
    </section>
  );
}

// Early adopters. Hand-written: these aren't (all) in the Base registry yet.
const ADOPTERS = [
  {
    name: 'City of Piedmont, AL',
    kind: 'Government',
    body: 'Council minutes kept in a permanent, verifiable public record, searchable by street, purchase or resolution.',
    url: 'https://www.piedmontcity.org/government/minutes',
  },
  {
    name: 'Watchroom',
    kind: 'Public safety',
    body: 'Fire department records (calls, NERIS filing, truck checks, training) on Fangorn, rolling out to 20+ departments.',
    url: 'https://www.getwatchroom.com/',
  },
];

function UsedBy() {
  return (
    <section className={styles.section} id="used-by">
      <h2 className={styles.h2}>Used by</h2>
      <p className={styles.sectionSub}>Early teams putting real records on Fangorn.</p>
      <div className={styles.caseGrid}>
        {ADOPTERS.map((a) => (
          <div key={a.name} className={styles.case}>
            <div className={styles.caseTop}><span className={styles.pill}>{a.kind}</span></div>
            <div className={styles.caseName}>{a.name}</div>
            <p className={styles.caseBody}>{a.body}</p>
            <div className={styles.caseLinks}><a href={a.url} className={styles.btnSm}>Visit ↗</a></div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <main>
      <section className={styles.hero}>
        <h1 className={styles.h1}>Turn any dataset into an app for people and agents.</h1>
        <p className={styles.sub}>
          Publish your data once. People get a private, searchable site; agents get the same data
          through one MCP. Every app has an on-chain identity and takes payments built in.
        </p>
        <div className={styles.ctas}>
          <a href="#/explorer" className={styles.btnA}>Explore Apps</a>
          <AccountButton>Deploy a Dataset</AccountButton>
        </div>
      </section>

      <Quickstart />
      <LiveApps limit={6} />
      <UsedBy />
      <Bento />
      <DualViewPreview />

      <section className={`${styles.section} ${styles.coda}`}>
        <h2 className={styles.h2}>Every view, rooted on-chain.</h2>
        <p className={styles.sectionSub}>What you read traces back to what was committed. Hosts hold the data; nobody has to trust them.</p>
        <div className={styles.ctas}>
          <a href="#/explorer" className={styles.btnA}>Explore Apps</a>
          <AccountButton>Deploy a Dataset</AccountButton>
        </div>
      </section>
    </main>
  );
}
