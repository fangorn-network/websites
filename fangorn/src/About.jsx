import styles from './Landing.module.css';
import a from './About.module.css';

// The manifesto. Plain prose on purpose: edit the paragraphs freely.
// Whimsy lives in About.module.css: falling leaves, scroll reveal, the
// blinking trackers and the blurred "nobody can find it".

// ponytail: 7 leaves, fixed positions; randomize if it ever looks too regular
const LEAVES = [
  [6, 0, 19], [18, 7, 23], [33, 3, 17], [52, 11, 25], [67, 5, 21], [81, 14, 18], [93, 9, 24],
];

export default function About() {
  return (
    <main className={a.page}>
      <div className={a.leaves} aria-hidden="true">
        {LEAVES.map(([left, delay, dur]) => (
          <span key={left} style={{ left: `${left}%`, animationDelay: `-${delay}s`, animationDuration: `${dur}s` }} />
        ))}
      </div>

      <section className={styles.section}>
        <h1 className={`${styles.h2} ${a.title}`}>Search without surveillance.</h1>

        <p className={`${styles.sectionSub} ${a.reveal}`}>
          The web we know, powered by profit-driven platforms and fueled by a pervasive surveillance apparatus pointed at each of us, is rapidly changing. As agentic AI stands to imbue the web with true informational abundance, and with the cost of producing information trending to zero, curation becomes the ultimate arbiter of truthiness.

          {/* The web we know runs on platforms, and platforms run on profit. That's changing.
          Agents, stumbling over pages built for human eyes, increasingly read the web on behalf
          of people. As the cost of producing information trends towards zero, we move from an
          attention economy to an intention economy, where organic behavior becomes a crucially
          important resource. */}
        </p>
        <p className={`${styles.sectionSub} ${a.reveal}`}>
          Today, curation belongs to platforms. Content creators and data publishers exchange sovereignty of their data for distribution and sales, yet history shows that conceding stewardship of data can lead to severe consequences, from exploits to exploitation. For consumers, the act of discovery equates to espionage.  Platforms collect, package, analyze and sell your behavior, which is then used to trace your digital path for you, leading toward outcomes that maximize profit. If you don't own your path, your taste and your thoughts are at the mercy of whoever drew it.
        </p>
        <p className={`${styles.sectionSub} ${a.reveal}`}>
          From event listeners on pet insurance forms to LinkedIn scanning every extension you've installed, thousands of trackers <span className={a.eyes}>watch quietly</span> as you search. Most people never see the vast surveillance network running just underneath the surface of a clean, helpful webpage.
        </p>

        <h2 className={`${styles.cardTitle} ${a.reveal}`}>Open or private. Pick one.</h2>
        <p className={`${styles.sectionSub} ${a.reveal}`}>
          The semantic web, blockchains, torrents, and content-addressed storage all provided ways to publish data without relying on centralized platforms. However, while they enabled verifiable, resilient, and immutable data, access control, privacy and discovery remain as external issues. Put your data on IPFS and{' '} <span className={a.exposed}>anyone can read it</span>. Lock it down and{' '} <span className={a.hidden} tabIndex={0}>nobody can find it</span>.
        </p>

        <h2 className={`${styles.cardTitle} ${a.reveal}`}>Proof over permission</h2>
        <p className={`${styles.sectionSub} ${a.reveal}`}>
          Fangorn decouples storage and discovery. Publishers commit records to <i>repos</i>: version-controlled, content-addressed data stores in IPFS, cryptographically anchored to a smart contract, providing decentralization, availability, and immutability.
        </p>
        <p className={`${styles.sectionSub} ${a.reveal}`}>
          Your agent does the searching. Your preferences and intent stays priv and nobody is allowed to pay to interrupt you. Publish data on your terms with programmable pricing. Purchasers retain privacy while payments go directly to the publisher.
        </p>
        <p className={`${styles.sectionSub} ${a.reveal}`}>
          Apps emerge out of the data they point to, as a view or "lens" over a collection of repos. Anyone can build one over anyone's data. An app that serves you badly can be replaced by a better one built on the very same data. You draw your own path.
        </p>

        <p className={`${styles.sectionSub} ${a.reveal}`}>
          We're building in the open. Come find us on{' '}
          <a href="https://github.com/fangorn-network">GitHub</a> and{' '}
          <a href="https://discord.gg/JDj8RdCVyU">Discord</a>.
        </p>
      </section>
    </main>
  );
}
