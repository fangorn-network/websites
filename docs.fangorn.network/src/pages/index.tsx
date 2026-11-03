import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import styles from './index.module.css';

// Three doors, one per reader. Each card is a door, not a feature list.
const DOORS = [
  {
    who: 'Use',
    title: 'Ask apps from your agent',
    body: 'One MCP server lists every app on chain, opens it, and pays for sealed records when you say so.',
    to: '/use-apps',
    cmd: '/plugin install fangorn-index@fangorn',
  },
  {
    who: 'Build',
    title: 'Turn data into an app',
    body: 'A Worker on your own Cloudflare: a site searchable by meaning, tools for agents, and a card any agent can verify.',
    to: '/build-an-app',
    cmd: '/plugin install fangorn-builder@fangorn',
  },
  {
    who: 'Sell',
    title: 'Price the fields you publish',
    body: 'Seal a field, set a price in USDC. Any app can show the record; only a buyer can open it, and you get paid directly.',
    to: '/sell-records',
    cmd: 'fangorn commit records.json --paid body --price 0.01',
  },
];

export default function Home(): ReactNode {
  return (
    <Layout title="Fangorn Docs" description="Publish data once. People search it, agents call it, buyers pay for it.">
      <header className={styles.hero}>
        <p className={styles.kicker}>Fangorn documentation</p>
        <h1 className={styles.h1}>Publish data once. Every agent can find it.</h1>
        <p className={styles.sub}>
          Records live on chain and IPFS. Apps are views over them that people search in a
          browser and agents call over MCP. Sealed fields sell for USDC over x402.
        </p>
        <div className={styles.ctas}>
          <Link className={styles.btnA} to="/intro">Start here</Link>
          <Link className={styles.btnB} to="/how-it-works">How it works</Link>
        </div>
      </header>

      <main className={styles.doors}>
        {DOORS.map((d) => (
          <Link key={d.who} to={d.to} className={styles.door}>
            <span className={styles.who}>{d.who}</span>
            <h2>{d.title}</h2>
            <p>{d.body}</p>
            <code>{d.cmd}</code>
          </Link>
        ))}
      </main>

      <section className={styles.ops}>
        <p>
          Running the contracts, the SDK and the Workers yourself?{' '}
          <Link to="/deploy">Deploy Fangorn</Link> walks through every piece, in order.
        </p>
      </section>
    </Layout>
  );
}
