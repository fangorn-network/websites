import styles from './Landing.module.css';

// The manifesto. Plain prose on purpose: edit the paragraphs, add sections freely.
// Drawn from the Jan 2026 vision post, WHITEPAPER_1 and the article draft.
export default function About() {
  return (
    <main>
      <section className={styles.section}>
        <h1 className={styles.h2}>Proof, not permission</h1>

        <h2 className={styles.cardTitle}>The web is changing</h2>
        <p className={styles.sectionSub}>
          Agents now read the web for people, clambering over pages built for human eyes. As
          information becomes abundant, what decides what’s true is curation. Today that
          curation belongs to platforms. When a platform carves your path through the noise
          toward whatever earns it the most, that isn’t discovery. If you don’t own your path,
          your taste and your behavior, you’re an ant in the ant mill, tracing a route someone
          else drew.
        </p>

        <h2 className={styles.cardTitle}>Everything a platform does, without the platform</h2>
        <p className={styles.sectionSub}>
          A platform stores your data, decides which version is current, who may write it and
          who may read it, and runs the search you find it through. You have to trust it for
          all of that at once. Fangorn splits those jobs apart. Anyone can host the data, and
          anyone can check that what they get is exactly what its publisher committed, and that
          it’s the latest version. Anyone can index it and serve search over it without becoming
          a gatekeeper, because a wrong answer can be proven wrong.
        </p>

        <h2 className={styles.cardTitle}>Data belongs to no app</h2>
        <p className={styles.sectionSub}>
          Publishers keep their own data. An app is a curation: it chooses which data to
          present under rules of its own, and can withdraw it under others. Both choices are on
          public record. Many apps can present the same data, so the streaming services,
          libraries and research tools of the agentic web can be built from collections no
          single company owns.
        </p>

        <h2 className={styles.cardTitle}>Search that doesn’t watch you</h2>
        <p className={styles.sectionSub}>
          Your agent embeds a query on your own device and ranks the results itself, so the
          question never leaves your machine. What you like lives in a file you hold, not in any
          app. Your agent’s memory is held by your key, not by the platform that runs the agent.
        </p>

        <h2 className={styles.cardTitle}>Don’t just get crawled. Get rewarded.</h2>
        <p className={styles.sectionSub}>
          Put your data on Fangorn instead of leaving it out to be scraped for free. People get
          a site to search, agents get tools to call, and you set the terms. Publish once, and
          earn whenever it’s used.
        </p>
      </section>
    </main>
  );
}
