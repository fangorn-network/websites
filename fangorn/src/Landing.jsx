import { useState } from 'react';
import { Contact } from './Footer';
import styles from './Landing.module.css';
import { formatUnits } from 'viem';
import { useAuth } from './authContext';
import { useAllApps } from './account';

// The page is a funnel with two doors, Use and Publish (see #start). Each door
// has one command and one next step; everything else is one click down. Keep it
// that way: a third choice at the top costs both doors.

const MARKETPLACE = '/plugin marketplace add fangorn-network/westmarch';
const USE_CMD = `${MARKETPLACE}\n/plugin install fangorn-index@fangorn`;
const PUBLISH_CMD = `${MARKETPLACE}\n/plugin install fangorn-builder@fangorn`;
const BUILD_PROMPT = 'Build a Fangorn app from <your data>.';

// The other ways in, for agents that aren't Claude Code or want less.
const OTHER_INSTALLS = [
  {
    tab: 'MCP only',
    cmd: `claude mcp add fangorn -- \\
  npx -y -p @fangorn-network/westmarch -p @huggingface/transformers fangorn-mcp`,
    note: 'Paste into your terminal. Transformers (~500 MB) ranks apps by meaning; leave it out to match words.',
  },
  {
    tab: 'Any MCP client',
    cmd: `{
  "mcpServers": {
    "fangorn": {
      "command": "npx",
      "args": ["-y", "-p", "@fangorn-network/westmarch", "fangorn-mcp"]
    }
  }
}`,
    note: 'Add to your client\'s MCP config. Needs Node 20 or later.',
  },
  {
    tab: 'One app',
    cmd: 'claude mcp add --transport http <app> https://<app-site>/mcp',
    note: 'Every app serves its own MCP endpoint. Add just that one.',
  },
];

// Only paid apps need this; the server reads it from the shell Claude starts in.
const PAID_ENV = `export FANGORN_MCP_WALLET_KEY=0x…   # a wallet holding USDC
export FANGORN_MCP_MAX_PRICE=0.10   # most it pays per call, in USDC`;

// The tools fangorn-mcp's open-app adds for most apps (see westmarch docs/mcp.md).
const TOOLS = ['search', 'get', 'similar', 'browse'];

// What each side gets out of Fangorn. Outcomes, not steps: no order implied.
const FEATURES = [
  {
    who: 'Publishers',
    title: 'Publish Once, Open Anywhere',
    body: 'Fangorn apps natively support interfaces for both humans and agents; a website searchable by meaning and a set of tools callable by an agent.',
  },
  {
    who: 'People',
    title: 'Search and Discovery without Surveillance',
    body: 'Search for data and discover apps without advertisements or surveillance. Fangorn makes it possible to be your own curator, owning your taste and preferences instead of giving it away for free.',
  },
  {
    who: 'Everyone',
    title: 'Programmable Payments',
    body: 'Keep data free, charge per record, or sell a pass; agents pay with x402, and the USDC goes straight to the app owners and data publishers.',
  },
  {
    who: 'Builders',
    title: 'Agent-Ready from Day One',
    body: 'Runs on your own Cloudflare. Fangorn adds registration, payments, and an interface every connected agent already speaks.',
  },
];

const usdc = (n) => `$${formatUnits(n, 6)}`;
const costOf = (app) => (app.pass ? `${usdc(app.pass.price)}${app.pass.days ? ` / ${app.pass.days} days` : ''}`
  : app.price ? `${usdc(app.price)} / record` : 'Free');
const nameOf = (app) => app.name ?? app.appId.slice(0, 10);
// What `open-app` takes: the registered name, lowercased and dashed.
const slugOf = (app) => nameOf(app).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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

function Cmd({ text }) {
  return (
    <div className={styles.cmd}>
      <pre>{text}</pre>
      <Copy text={text} />
    </div>
  );
}

// Logged in → straight to the hub; logged out → Privy, and App sends them on to
// the hub once authenticated (see `#/account` handling there).
function AccountButton({ children, className = styles.btnB }) {
  const { ready, authenticated, login } = useAuth();
  if (authenticated) return <a href="#/account" className={className}>{children}</a>;
  return (
    <button
      type="button"
      className={className}
      disabled={!ready}
      onClick={login}
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

// ── hero: the console ───────────────────────────────────────────────────────
// ponytail: SVG + CSS keyframes, no animation lib. Every animation shares one
// 4.5s loop; keying the rig on `n` restarts them together, so a click swaps the
// cartridge and the label advances on each loop (animationiteration = ejected).
// The cartridges are the live registry; the screen shows what open-app really
// adds, not an invented query.
const PLACEHOLDER = { appId: 'your-data', name: 'Your data', tags: ['yours'] };

function Cartridge({ apps }) {
  const [n, setN] = useState(0);
  const list = apps?.length ? apps : [PLACEHOLDER];
  const c = list[n % list.length];
  const next = list[(n + 1) % list.length];
  const slug = slugOf(c);
  return (
    <figure className={styles.cart}>
      <div className={styles.rig} key={n}>
        <button
          type="button"
          className={styles.cartBtn}
          onClick={() => setN((x) => x + 1)}
          aria-label={`${nameOf(c)} cartridge. Swap to ${nameOf(next)}`}
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
              <text x="116" y="54" className={styles.labelTag}>{(c.tags[0] ?? 'app').toUpperCase()}</text>
              <text x="116" y="80" className={styles.labelName}>{nameOf(c).slice(0, 12)}</text>
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
            {c === PLACEHOLDER ? (
              <>
                <div className={styles.prompt}>&gt; publish</div>
                <div className={styles.hit}>Your app goes here</div>
              </>
            ) : (
              <>
                <div className={styles.prompt}>&gt; open-app {slug}</div>
                <div className={styles.hit}>{TOOLS.slice(0, 2).map((t) => <div key={t}>{slug}__{t}</div>)}</div>
                <div className={styles.via}>+ {TOOLS.length - 2} more · {costOf(c).toLowerCase()}</div>
              </>
            )}
          </div>
        </div>
      </div>
      <figcaption className={styles.cartCaption}>
        Live apps from the registry. Click the cartridge to swap it.
      </figcaption>
    </figure>
  );
}

// ── the two doors ───────────────────────────────────────────────────────────

function Start() {
  const [i, setI] = useState(0);
  const q = OTHER_INSTALLS[i];
  return (
    <section className={styles.section} id="start">
      <div className={styles.doors}>
        <div className={styles.door}>
          <h2 className={styles.doorTitle}>Use Apps</h2>
          <p className={styles.doorBody}>Give your agent every app on Fangorn. Run these inside Claude Code:</p>
          <div className={styles.terminal}><Cmd text={USE_CMD} /></div>
          <p className={styles.doorNext}>
            Then ask: <q>Find a Fangorn app for…</q> Free apps need no account or wallet.
          </p>
        </div>
        <div className={styles.door}>
          <h2 className={styles.doorTitle}>Build Apps</h2>
          <p className={styles.doorBody}>Build apps that both people and agents can use:</p>
          <div className={styles.terminal}><Cmd text={PUBLISH_CMD} /></div>
          <p className={styles.doorNext}>
            Create an account to claim your app’s name, then ask Claude: <q>{BUILD_PROMPT}</q>
          </p>
          <AccountButton className={styles.btnA}>Create an account</AccountButton>
        </div>
      </div>

      <div className={styles.more}>
        <p className={styles.doorNext}>
          Own data but not a developer? <a href="#contact" className={styles.link}>Talk to us →</a>
        </p>
        <details className={styles.disclose}>
          <summary>Paying for private apps</summary>
          <p>
            Export a wallet key before starting Claude. The server pays x402 prices at or under
            your cap; with no key it hands the price back to your agent. Use a separate wallet with
            a small balance.
          </p>
          <div className={styles.terminal}><Cmd text={PAID_ENV} /></div>
        </details>
        <details className={styles.disclose}>
          <summary>Other ways to connect</summary>
          <div className={styles.terminal}>
            <Tabs items={OTHER_INSTALLS.map((x) => x.tab)} value={i} onChange={setI} />
            <Cmd text={q.cmd} />
          </div>
          <p>{q.note}</p>
        </details>
      </div>
    </section>
  );
}

// One real app, and the two ways into it. Defaults to the first live app.
function TwoDoors({ apps }) {
  const [sel, setSel] = useState(0);
  const app = apps?.[sel];
  if (apps?.length === 0) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>One app. Two front doors.</h2>
      <p className={styles.sectionSub}>
        Every app is a website people can search and a set of tools agents can call. Same data,
        same source, checked against the same on-chain record.
      </p>
      {apps?.length > 1 && (
        <Tabs items={apps.slice(0, 4).map(nameOf)} value={sel} onChange={setSel} />
      )}
      {!app ? (
        <p className={styles.caption}>Reading the registry…</p>
      ) : (
        <div className={styles.split}>
          <div className={styles.splitHub}>
            <span className={styles.pill}>{app.tags[0] ?? 'app'}</span>
            <div className={styles.caseName}>{nameOf(app)}</div>
            <p className={styles.caseBody}>{app.description}</p>
          </div>
          <div className={styles.splitDoor}>
            <div className={styles.splitWho}>For people</div>
            <p className={styles.splitText}>A website that searches by meaning, right in the browser.</p>
            {app.site
              ? <a href={app.site} className={styles.btnSm}>Open the website ↗</a>
              : <span className={styles.caption}>No website yet</span>}
          </div>
          <div className={styles.splitDoor}>
            <div className={styles.splitWho}>For agents</div>
            <p className={styles.splitText}>Tools any agent connected to Fangorn can call by name.</p>
            <code className={styles.splitCode}>open-app {slugOf(app)}</code>
            <div className={styles.splitTools}>{TOOLS.map((t) => `${slugOf(app)}__${t}`).join(' · ')}</div>
          </div>
        </div>
      )}
    </section>
  );
}

// What Fangorn stands for (see About). Sits right under the doors, so it's the
// first thing past the install commands.
const PILLARS = [
  {
    title: 'Data belongs to no app',
    body: 'Publishers keep their own data. An app chooses what to present, so anyone can build a new app on data that’s already published.',
  },
  {
    title: 'Answers you can check',
    body: 'Every app is registered on chain as an ERC-8004 agent and its records are committed there, so anyone can check a result is what was published.',
  },
  {
    title: 'Your taste is yours',
    body: 'Your preferences, likes, dislikes, and intent never leave your machine. Queries are executed locally, letting you own your own taste and drive your own curation. No platform decides what you see.',
  },
];

// The question every developer asks first. Claims here must stay true to what
// westmarch ships today.
const VERSUS = [
  {
    title: 'vs. writing your own MCP server',
    body: 'A server per source means one integration per source. With Fangorn your agent installs one MCP, finds apps in the on-chain registry and opens them by name. Publishers write no integration code.',
  },
  {
    title: 'vs. an API directory',
    body: 'A directory lists endpoints that someone else keeps running. A Fangorn app holds the data itself: committed on chain, served from the publisher’s own storage, and priced with x402.',
  },
  {
    title: 'vs. your own vector DB',
    body: 'Doing it yourself means crawling, cleaning and embedding every source, then keeping it up to date. Each app ships its own embeddings and its publisher keeps them current. You query the result.',
  },
];

// Kinds of app, not live demos: the real ones are in "Live on Fangorn" and "Coming Soon".
const USE_CASES = [
  {
    title: 'Memory your agent owns',
    body: 'An agent publishes its notes and findings as data of its own. It can read them back in another session, on another device or under another model, and share them with other agents. The memory is held by your key, not by the platform that runs the agent.',
  },
  {
    title: 'Public records people can actually use',
    body: 'Minutes, filings and reports that the law requires to be published, turned into a site residents can search by meaning and tools their agents can call.',
  },
  {
    title: 'Catalogs from anyone',
    body: 'Films, music, books and courses from independent publishers, each setting its own price. Apps bring them together, and your agent searches them all by your taste, not a platform’s.',
  },
];

// Side-by-side columns on one rule, rather than a card grid.
function Steps({ title, sub, items }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>{title}</h2>
      {sub && <p className={styles.sectionSub}>{sub}</p>}
      <ol className={styles.steps}>
        {items.map((f) => (
          <li key={f.title} className={styles.step}>
            {f.who && <span className={styles.stepWho}>{f.who}</span>}
            <h3 className={styles.cardTitle}>{f.title}</h3>
            <p className={styles.cardBody}>{f.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// Asymmetric: one statement on the left, the principles as a ruled list on the right.
function Principles() {
  return (
    <section className={`${styles.section} ${styles.principles}`}>
      <div>
        <h2 className={styles.h2}>Your data, your rules</h2>
        <p className={styles.statement}>
          A platform stores your data, decides which version is current, who gets to read it
          and what you see. Fangorn does all of that without asking you to trust anyone.
        </p>
        <a href="#/about" className={styles.moreLink}>Why we built it →</a>
      </div>
      <ul className={styles.rules}>
        {PILLARS.map((f) => (
          <li key={f.title}>
            <h3 className={styles.cardTitle}>{f.title}</h3>
            <p className={styles.cardBody}>{f.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Label left, answer right, one rule per row.
function Versus() {
  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>Why not just…</h2>
      <dl className={styles.versus}>
        {VERSUS.map((f) => (
          <div key={f.title} className={styles.versusRow}>
            <dt className={styles.versusLabel}>{f.title}</dt>
            <dd className={styles.cardBody}>{f.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Cards({ title, sub, items }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>{title}</h2>
      {sub && <p className={styles.sectionSub}>{sub}</p>}
      {/* No orphan cards: 3 across when the count divides by 3, else 2 across. */}
      <div className={styles.bento} style={{ '--cols': items.length % 3 ? 2 : 3 }}>
        {items.map((f) => (
          <div key={f.title} className={styles.card}>
            <h3 className={styles.cardTitle}>{f.title}</h3>
            <p className={styles.cardBody}>{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// One registered app, straight from its agent card.
function AppTile({ app }) {
  return (
    <div className={styles.case}>
      <div className={styles.caseTop}>
        <span className={styles.pill}>{app.tags[0] ?? 'app'}</span>
        <span className={styles.badge}>ERC-8004</span>
      </div>
      <div className={styles.caseName}>{nameOf(app)}</div>
      <p className={styles.caseBody}>{app.description}</p>
      <div className={styles.stat}>{costOf(app)}</div>
      <div className={styles.caseLinks}>
        {app.site && <a href={app.site} className={styles.btnSm}>Open App ↗</a>}
        <a href={app.uri} className={styles.link}>Agent card</a>
      </div>
    </div>
  );
}

// Every live app in the AppRegistry: the #/explorer page.
function AppGrid({ apps }) {
  return (
    <section className={styles.section} id="apps">
      <div className={styles.casesHead}>
        <h2 className={styles.h2}>Live on Fangorn</h2>
      </div>
      <p className={styles.sectionSub}>
        Read live from the app registry. Each one is a site you can search, and an agent any{' '}
        <code className={styles.inline}>fangorn-mcp</code> can open by name.
      </p>
      {apps === null ? <p className={styles.caption}>Reading the registry…</p>
        : apps.length === 0 ? <p className={styles.caption}>No apps are live right now.</p>
          : <div className={styles.caseGrid}>{apps.map((a) => <AppTile key={a.appId} app={a} />)}</div>}
    </section>
  );
}

export function LiveApps() {
  return <AppGrid apps={useAllApps()} />;
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
      <h2 className={styles.h2}>Coming soon</h2>
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
  const apps = useAllApps();
  return (
    <main>
      <section className={styles.hero}>
        <h1 className={styles.h1}>Proof over permission.</h1>
        <p className={styles.sub}>
          Publish data once. Anyone can build apps on it for people and agents, and you set the price instead of getting crawled for free.
        </p>
        <div className={styles.ctas}>
          <a href="#start" className={styles.btnA}>Get started</a>
          <a href="#/explorer" className={styles.btnB}>Explore Apps</a>
        </div>
        <Cartridge apps={apps} />
      </section>

      <Start />
      <Steps title="Publish. Get found. Get paid." items={FEATURES} />
      <div className={styles.bandNight}><Principles /></div>
      <TwoDoors apps={apps} />
      <div className={styles.band}><Versus /></div>
      <Cards title="What you can build" items={USE_CASES} />
      <UsedBy />

      {/* <section className={`${styles.section} ${styles.coda}`}>
        <h2 className={styles.h2}>Every view, rooted on-chain.</h2>
        <p className={styles.sectionSub}>Every answer traces back to the record that was published.</p>
        <div className={styles.ctas}>
          <a href="#start" className={styles.btnA}>Get started</a>
          <a href="#/explorer" className={styles.btnB}>Explore Apps</a>
        </div>
      </section> */}

      <Contact />
    </main>
  );
}
