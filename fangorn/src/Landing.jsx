import { useState } from 'react';
import styles from './Landing.module.css';
import { useAuth, ACCOUNT_ENABLED } from './authContext';

const EXPLORER_URL = 'https://explorer.fangorn.network';

const QUICKSTART = [
  {
    tab: 'Claude MCP',
    cmd: `claude mcp add fangorn -e FANGORN_LOG_WINDOW=100000 -- \\
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
    body: 'Combine disparate datasets into an extensible knowledge graph, generate embeddings, and package them into lightweight, pluggable knowledge cartridges.',
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

// Every live app on this list is a real Fangorn app: data committed on chain, a
// static site, an agent card any `fangorn-mcp` can `open-app`. `demo` is an
// illustrative query for the hero screen, not a real record.
const CASES = [
  {
    app: 'kingsfoil',
    name: 'Kingsfoil',
    tag: 'Health',
    line: 'Find clinical trials you qualify for, completely in-browser without logging queries.',
    stat: '60,760 trials from ClinicalTrials.gov',
    url: 'https://kingsfoil.pages.dev',
    demo: { q: 'type 1 diabetes, boston', hit: 'Closed-loop insulin study' },
  },
  {
    app: 'quorum',
    name: 'Quorum',
    tag: 'Civic',
    line: 'Local city council agendas, votes, and meeting minutes searchable by meaning.',
    stat: 'Gated access via x402',
    url: 'https://quorum-bua.pages.dev',
    demo: { q: 'rezoning vote downtown', hit: 'Planning commission, item 4b' },
  },
  {
    app: 'nimbus',
    name: 'Nimbus',
    tag: 'Weather',
    line: 'Live NWS warnings, 7-day forecasts, and historical storm events searchable by meaning.',
    stat: 'Prose forecasts for 258 US cities',
    url: 'https://nimbus-f29.pages.dev',
    demo: { q: 'flood warnings in texas', hit: 'Flash flood warning, NWS' },
  },
  {
    app: 'sond3r',
    name: 'SOND3R',
    tag: 'Media',
    line: 'A TV station built from an open data market, searchable by what films say and show.',
    stat: 'Per-file pricing over x402',
    url: 'https://tv.fangorn.network',
    demo: { q: 'films about the sea', hit: 'Channel: open water' },
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
  if (!ACCOUNT_ENABLED) {
    return (
      <span className={styles.soonWrap}>
        <button type="button" className={styles.btnB} disabled>{children}</button>
        <span className={styles.soon}>Coming soon</span>
      </span>
    );
  }
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

// Label tint per app category. Kept to existing tokens.
const TINT = { Health: 'var(--g1)', Civic: 'var(--blue)', Weather: 'var(--orange)', Media: 'var(--pink)' };

// ponytail: SVG + CSS keyframes, no animation lib. Every animation shares one
// 4.5s loop; keying the rig on `n` restarts them together, so a click swaps the
// cartridge and the label advances on each loop (animationiteration = ejected).
function Cartridge() {
  const [n, setN] = useState(0);
  const c = CASES[n % CASES.length];
  const next = CASES[(n + 1) % CASES.length];
  return (
    <figure className={styles.cart}>
      <div className={styles.rig} key={n} style={{ '--tint': TINT[c.tag] }}>
        <button
          type="button"
          className={styles.cartBtn}
          onClick={() => setN((x) => x + 1)}
          aria-label={`${c.name} cartridge. Swap to ${next.name}`}
        >
          <svg viewBox="0 -24 320 274" aria-hidden="true">
            {/* Back half of the top face and the slot hole sit behind the cartridge. */}
            <path d="M58 150 h204 l6 16 h-216z" className={styles.top} />
            <rect x="84" y="158" width="152" height="10" rx="2" className={styles.slot} />
            <g className={styles.cartBody} onAnimationIteration={() => setN((x) => x + 1)}>
              <path d="M92 32 q0-14 14-14 h108 q14 0 14 14 v128 h-136z" className={styles.shell} />
              <path d="M104 160 h112 v16 h-112z" className={styles.tab} />
              {Array.from({ length: 17 }, (_, i) => (
                <line key={i} x1={109 + i * 6.3} y1="163" x2={109 + i * 6.3} y2="174" className={styles.pin} />
              ))}
              <rect x="106" y="34" width="108" height="78" rx="4" className={styles.label} />
              <text x="116" y="54" className={styles.labelTag}>{c.tag.toUpperCase()}</text>
              <text x="116" y="80" className={styles.labelName}>{c.name}</text>
              <text x="116" y="102" className={styles.labelSub}>fangorn · erc-8004</text>
              {[126, 134, 142, 150].map((y) => (
                <line key={y} x1="120" y1={y} x2="200" y2={y} className={styles.grip} />
              ))}
            </g>
            {/* Front half of the top face, then the front face, drawn over the cartridge. */}
            <path d="M52 166 h216 l8 18 h-232z" className={styles.topFront} />
            <line x1="84" y1="167" x2="236" y2="167" className={styles.slotLip} />
            <rect x="60" y="172" width="16" height="6" rx="3" className={styles.knob} />
            <circle cx="252" cy="175" r="4" className={styles.knob} />
            <rect x="44" y="184" width="232" height="54" rx="6" className={styles.console} />
            {[60, 84].map((x, i) => (
              <g key={x}>
                <rect x={x} y="202" width="18" height="14" rx="4" className={styles.port} />
                <line x1={x + 5} y1="209" x2={x + 13} y2="209" className={styles.portPins} />
                <text x={x + 9} y="228" textAnchor="middle" className={styles.consoleSmall}>{i + 1}</text>
              </g>
            ))}
            <text x="160" y="214" textAnchor="middle" className={styles.consoleText}>FANGORN</text>
            {[196, 202, 208, 214].map((x) => (
              <line key={x} x1={x} y1="200" x2={x} y2="220" className={styles.vent} />
            ))}
            <circle cx="252" cy="208" r="4" className={styles.led} />
            <text x="252" y="228" textAnchor="middle" className={styles.consoleSmall}>PWR</text>
            <rect x="58" y="238" width="24" height="5" rx="2" className={styles.foot} />
            <rect x="238" y="238" width="24" height="5" rx="2" className={styles.foot} />
          </svg>
        </button>
        <div className={styles.screen} aria-hidden="true">
          <div className={styles.idle}>insert cartridge<span className={styles.cursor}>_</span></div>
          <div className={styles.result}>
            <div className={styles.prompt}>&gt; {c.demo.q}</div>
            <div className={styles.hit}>{c.demo.hit}</div>
            <div className={styles.via}>{c.app} · via fangorn-mcp</div>
          </div>
        </div>
      </div>
      <figcaption className={styles.cartCaption}>
        Your data, as a cartridge. Plug it in: people search it, agents call it.
        <span className={styles.hint}> Click to swap.</span>
      </figcaption>
    </figure>
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

function CaseCard({ c }) {
  return (
    <div className={styles.case}>
      <div className={styles.caseTop}>
        <span className={styles.pill}>{c.tag}</span>
        <span className={styles.badge}>ERC-8004</span>
      </div>
      <div className={styles.caseName}>{c.name}</div>
      <p className={styles.caseBody}>{c.line}</p>
      <div className={styles.stat}>{c.stat}</div>
      <div className={styles.caseLinks}>
        <a href={c.url} className={styles.btnSm}>Open App ↗</a>
        <span className={styles.ready}>WebMCP Ready</span>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <main>
      <section className={styles.hero}>
        <h1 className={styles.h1}>Instant Intelligence for Agents and Humans.</h1>
        <p className={styles.sub}>
          Fuse disparate datasets into a knowledge graph, build embeddings, and deploy pluggable
          AI cartridges. Privacy-preserving apps for humans, one unified MCP for agents.
        </p>
        <div className={styles.ctas}>
          <a href={EXPLORER_URL} className={styles.btnA}>Explore Apps ↗</a>
          <AccountButton>Deploy a Dataset</AccountButton>
        </div>
        <Cartridge />
      </section>

      <Quickstart />
      <Bento />
      <DualViewPreview />

      <section className={styles.section}>
        <div className={styles.casesHead}>
          <h2 className={styles.h2}>Built on Fangorn</h2>
          <a href="#/use-cases" className={styles.link}>All use cases</a>
        </div>
        <div className={styles.caseGrid}>
          {CASES.slice(0, 3).map((c) => <CaseCard key={c.app} c={c} />)}
        </div>
      </section>
    </main>
  );
}

export function UseCases() {
  return (
    <main className={styles.section}>
      <h1 className={styles.h2}>Use cases</h1>
      <p className={styles.sectionSub}>
        Each of these is a Fangorn app: its data is committed on chain, its site is static, and
        any agent running <code className={styles.inline}>fangorn-mcp</code> can open it by name.
      </p>
      <div className={styles.caseGrid}>
        {CASES.map((c) => <CaseCard key={c.app} c={c} />)}
      </div>
    </main>
  );
}
