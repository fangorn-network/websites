import { useState } from 'react';
import styles from './Products.module.css';
import { useAuth } from './authContext';

const PRODUCTS = [
  {
    id: 'sdk',
    label: 'SDK',
    tag: 'Publish',
    name: 'Fangorn SDK',
    desc: 'Publish data that stays yours. It lives in storage you control and keeps its full history. A small proof on-chain lets anyone find it and confirm it really came from you.',
    pills: ['TypeScript', 'IPFS', 'Arbitrum'],
    cta: 'Register now',
    links: [
      { href: 'https://github.com/fangorn-network/fangorn', label: 'GitHub' },
    ],
    features: [
      {
        title: 'No platform in the middle',
        desc: 'Your files stay where you put them. All the chain records is a single pointer, which is enough for anyone to verify what you published. Nobody else gets to hold the data itself hostage.',
      },
      {
        title: 'Every change is kept',
        desc: 'Updates work like git. Each one is a commit pointing back at the one before it, so nothing gets quietly overwritten. The whole history can be rebuilt from that on-chain pointer alone.',
      },
      {
        title: 'Share exactly what you mean to',
        desc: 'Lock any single field. Keep it private to yourself, or have it open automatically for readers who have paid. Everything else in the record stays public and searchable.',
      },
    ],
  },
  {
    id: 'quickbeam',
    label: 'Quickbeam',
    tag: 'Search',
    name: 'Quickbeam',
    desc: 'Search published Fangorn data the way you would describe it out loud. Or pull a whole subject area onto your own machine, so the questions you ask never leave it.',
    pills: ['Python', 'Semantic search', 'MCP', 'x402'],
    links: [
      { href: 'https://github.com/fangorn-network', label: 'GitHub' },
    ],
    features: [
      {
        title: 'Ask in plain language',
        desc: 'Quickbeam indexes data as it gets published, then matches on what you meant rather than the exact words you typed. Every result carries proof of who published it and when.',
      },
      {
        title: 'Take the index with you',
        desc: 'A subject area can be baked into static files and downloaded in one go. After that you search it offline on your own hardware, and nobody sees what you asked.',
      },
      {
        title: 'Built for agents',
        desc: 'Any AI assistant can call Quickbeam through a standard tool interface, both to search and to follow connections between records. Charge per query if you want to.',
      },
    ],
  },
  {
    id: 'x402f',
    label: 'x402f',
    tag: 'Payments',
    name: 'x402f',
    desc: 'Sell access to data without setting up accounts or a checkout. Buyers pay for the one thing they actually want, and nobody can tell who bought what.',
    pills: ['x402', 'Zero-knowledge proofs', 'USDC', 'Arbitrum'],
    links: [
      { href: 'https://github.com/fangorn-network/x402f', label: 'GitHub' },
    ],
    features: [
      {
        title: 'Pay for one thing, once',
        desc: 'One payment gets you one item. There is no sign-up, and no monthly plan for something you only ever wanted to read once.',
      },
      {
        title: 'Private purchases',
        desc: 'Buyers prove they paid without revealing who they are. Nothing on-chain ties a wallet to what it bought or to who sold it.',
      },
      {
        title: 'Nothing to withhold',
        desc: 'Buyers download the encrypted file first and pay second. Payment only hands over the key. If our servers go down, anything already bought still opens.',
      },
    ],
  },
];

function Pane({ p }) {
  const { ready, authenticated, login } = useAuth();
  return (
    <div className={styles.twoCol}>
      <div className={styles.ppL}>
        <div className={styles.ppTag}>{p.tag}</div>
        <div className={styles.ppName}>{p.name}</div>
        <p className={styles.ppDesc}>{p.desc}</p>
        <div className={styles.pills}>{p.pills.map(pl => <span key={pl} className={styles.pill}>{pl}</span>)}</div>
        {p.cta && !authenticated && (
          <button onClick={login} disabled={!ready} className={styles.ppLink} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginRight: 20 }}>
            {p.cta}
          </button>
        )}
        {p.links.map(l => (
          <a key={l.label} href={l.href} className={styles.ppLink} style={{ marginRight: 20 }}>{l.label}</a>
        ))}
      </div>
      <div className={styles.ppR}>
        <div className={styles.featList}>
          {p.features.map((f, i) => (
            <div key={f.title} className={styles.feat}>
              <div className={styles.featNum}>0{i + 1}</div>
              <div>
                <div className={styles.featTitle}>{f.title}</div>
                <p className={styles.featDesc}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Products() {
  const [active, setActive] = useState('sdk');

  return (
    <section className={styles.section} id="products">
      <div className={styles.header}>
        <div>
          <h2 className={styles.h2}>Your data shouldn't need a platform's permission to exist.</h2>
          <p className={styles.headerP}>Publish data you still control. Let people find it by meaning. Sell access to it without handing a platform the keys first.</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <a href="https://github.com/fangorn-network" className={styles.ppLink} style={{ fontSize: 12 }}>All repos on GitHub</a>
        </div>
      </div>

      <div className={styles.tabs}>
        {PRODUCTS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${active === t.id ? styles.tabActive : ''}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.pane}>
        <Pane p={PRODUCTS.find(p => p.id === active)} />
      </div>
    </section>
  );
}
