import { useState } from 'react';
import { Contact } from './Footer';
import styles from './Landing.module.css';
import { useAuth } from './authContext';
import { EXPLORE_URL } from './account';

// One message: publish, get found. Every claim here must be checkable by a skeptic in a minute.

const MCP = 'claude mcp add --transport http fangorn https://fangorn.network/mcp';
const PLUGIN = `/plugin marketplace add fangorn-network/westmarch
/plugin install fangorn-index@fangorn`;
const CLI = `npm i -g @fangorn-network/sdk
fangorn init
fangorn repo init my-data
fangorn add ./my-files
fangorn commit
fangorn push`;

const HOW = [
  {
    who: '1',
    title: 'You publish',
    body: 'Your files become records in a repo. The records go to IPFS, and the repo’s latest version is signed by your wallet and recorded on chain. Only you can change it.',
  },
  {
    who: '2',
    title: 'It’s indexed',
    body: 'Fangorn’s index follows every repo on the network. A new or changed repo shows up within a minute or two. Nobody approves it.',
  },
  {
    who: '3',
    title: 'It’s found',
    body: 'People search Explore in their own words. Agents search the same index over MCP. Every result says who published it.',
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

function Cmd({ text }) {
  return (
    <div className={styles.cmd}>
      {/* Before the <pre> so the floated button (in doors) has the text wrap around it. */}
      <Copy text={text} />
      <pre>{text}</pre>
    </div>
  );
}

// Logged in → the account page; logged out → Privy, and App sends them on to it once authenticated.
export function AccountButton({ children, className = styles.btnB }) {
  const { ready, authenticated, login } = useAuth();
  if (authenticated) return <a href="#/account" className={className}>{children}</a>;
  return <button type="button" className={className} disabled={!ready} onClick={login}>{children}</button>;
}

function Start() {
  return (
    <section className={styles.section} id="start">
      <div className={styles.doors}>
        <div className={styles.door}>
          <h2 className={styles.doorTitle}>Publish</h2>
          <p className={styles.doorBody}>Log in with your email and upload files. Your account comes with a wallet.</p>
          <AccountButton className={styles.btnA}>Publish data</AccountButton>
          <p className={styles.doorNext}>Or from a terminal:</p>
          <div className={styles.terminal}><Cmd text={CLI} /></div>
        </div>
        <div className={styles.door}>
          <h2 className={styles.doorTitle}>Find</h2>
          <p className={styles.doorBody}>
            Search <a href={EXPLORE_URL} className={styles.link}>Explore</a>, or give your agent the index. In Claude Code:
          </p>
          <div className={styles.terminal}><Cmd text={PLUGIN} /></div>
          <p className={styles.doorNext}>Any other MCP client: <code>https://fangorn.network/mcp</code>. For example:</p>
          <div className={styles.terminal}><Cmd text={MCP} /></div>
        </div>
      </div>
      <p className={styles.doorNext}>
        Fangorn runs on Base Sepolia, a testnet: publishing costs a little test ETH, from a{' '}
        <a href="https://portal.cdp.coinbase.com/products/faucet" className={styles.link}>faucet</a>. Everything you
        publish is public and permanent.
      </p>
    </section>
  );
}

function How() {
  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>How it works</h2>
      <ol className={styles.steps}>
        {HOW.map((f) => (
          <li key={f.title} className={styles.step}>
            <span className={styles.stepWho}>{f.who}</span>
            <h3 className={styles.cardTitle}>{f.title}</h3>
            <p className={styles.cardBody}>{f.body}</p>
          </li>
        ))}
      </ol>
      <p className={styles.sectionSub}>
        The code is open: <a href="https://github.com/fangorn-network" className={styles.link}>github.com/fangorn-network</a>.
        Details in <a href="https://docs.fangorn.network" className={styles.link}>the docs</a>.
      </p>
    </section>
  );
}

export default function Landing() {
  return (
    <main>
      <section className={styles.hero}>
        <h1 className={styles.h1}>Publish data. Get found.</h1>
        <p className={styles.sub}>
          Put your files on Fangorn, and people and AI agents can find them within minutes. No server to run,
          nothing to integrate.
        </p>
        <div className={styles.ctas}>
          <a href="#start" className={styles.btnA}>Get started</a>
          <a href={EXPLORE_URL} className={styles.btnB}>Explore</a>
        </div>
      </section>
      <Start />
      <How />
      <Contact />
    </main>
  );
}
