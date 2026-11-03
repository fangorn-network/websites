import styles from './Landing.module.css';

// The manifesto. Plain prose on purpose: edit the paragraphs, add sections freely.
// Voice: the Paragraph "Reclaim your music discovery" post. Ideas: ideas.md.
export default function About() {
  return (
    <main>
      <section className={styles.section}>
        <h1 className={styles.h2}>Your data, your rules.</h1>

        <h2 className={styles.cardTitle}>Proof over permission</h2>
        <p className={styles.sectionSub}>
          The web we know runs on platforms, and platforms run on profit. That's changing.
          Agents, bumbling over pages built for human eyes, increasingly read the web on behalf
          of people. As the cost of producing information trends towards zero, we move from an
          attention economy to an intention economy, where organic behavior becomes a crucially
          important resource.
        </p>
        <p className={styles.sectionSub}>
          When information is abundant and noisy, truth is decided by curation. Today that right
          belongs to platforms. They collect your behavior and trace your path for you, toward
          whatever maximizes profit. If you don't own your path, your taste and your thoughts are
          at the mercy of whoever drew it.
        </p>

        <h2 className={styles.cardTitle}>"Free" was never free</h2>
        <p className={styles.sectionSub}>
          When you let a platform store your data, you trust it to decide which version is
          current, who can read it, and what it's worth. That central authority is a single
          point of failure. It can change its policies at will, demonetize creators, and decide
          who gets to participate.
        </p>
        <p className={styles.sectionSub}>
          It gets worse. Platforms that call themselves free are usually surveillance surfaces,
          built to capture your behavior and intent, then feed it to their models or sell it to
          the highest bidder. From event listeners on pet insurance forms to LinkedIn scanning
          every extension you've installed, thousands of trackers watch quietly as you search.
          Most people never see the surveillance network running just underneath a clean,
          helpful webpage.
        </p>

        <h2 className={styles.cardTitle}>Open or private. Pick one.</h2>
        <p className={styles.sectionSub}>
          The semantic web, blockchains and content-addressed storage all promised refuge under
          hostile skies. They gave us immutability, traceability and robustness. They took
          access control, privacy and discovery. Put your data on IPFS and anyone can read it.
          Lock it down and nobody can find it.
        </p>

        <h2 className={styles.cardTitle}>Fangorn splits those jobs apart</h2>
        <p className={styles.sectionSub}>
          Your app runs on your own storage and your own worker, so the keys and the rules are
          yours. Fangorn commits what you publish on chain. Anyone can check that what they got
          is exactly what was published, and that it's the latest version. Anyone can index it
          and serve search over it without becoming a gatekeeper, because a wrong answer can be
          proven wrong.
        </p>

        <h2 className={styles.cardTitle}>Data belongs to no app</h2>
        <p className={styles.sectionSub}>
          On today's web, data is captured by the app that collects it. Your playlists live in
          one streaming service, your reviews in one marketplace, your city's records in one
          vendor's portal. Leaving means starting over, so nobody leaves.
        </p>
        <p className={styles.sectionSub}>
          On Fangorn, an app is a curation: it chooses which data to present, under rules of its
          own, on public record. Many apps can present the same data, and one app can bring
          together data from many publishers. An app that serves you badly can be replaced by
          one that serves you better, built on the very same data.
        </p>

        <h2 className={styles.cardTitle}>Your taste, not their algorithm</h2>
        <p className={styles.sectionSub}>
          Your agent does the searching. What you like lives in a file on your own machine, not
          in any app's database, and it carries across every app on the network. No platform
          gets to keep it, sell it, or steer it. Your agent's memory works the same way: it's
          held by your key, not by whoever runs the agent.
        </p>

        <h2 className={styles.cardTitle}>Flip the auction</h2>
        <p className={styles.sectionSub}>
          The web's problem isn't that it lacks a way to pay for things. It's that attention,
          funding and demand are all allocated for advertisers and gatekeepers, not for the
          people actually using it. An ad auction sells your attention to the highest bidder.
        </p>
        <p className={styles.sectionSub}>
          Turn it around. You tell your agent what you want, with your own preferences, budget
          and limits, and those stay on your machine. Providers compete to deliver it on data
          quality, availability, reputation and whether you were actually satisfied. A provider
          can pay to fulfill your request. It can't pay to win your agent's judgment.
        </p>
        <p className={styles.sectionSub}>
          Nobody buys the right to interrupt you. Nobody builds a profile you can't opt out of.
          Auctioning attention was a choice. We can auction the thing you actually asked for.
        </p>

        <h2 className={styles.cardTitle}>Who pays for this internet?</h2>
        <p className={styles.sectionSub}>
          Direct purchases, sponsorship, patronage, outcome-based funding, pooled money for
          public goods. We don't swap one mandatory business model for another. Fangorn is a
          common economic layer, and the people using it pick the model.
        </p>
        <p className={styles.sectionSub}>
          The next internet isn't one where everything is free. It's one where the things worth
          having can be funded without making people the product.
        </p>

        <h2 className={styles.cardTitle}>Don't just get crawled. Get rewarded.</h2>
        <p className={styles.sectionSub}>
          Anything you publish openly today gets scraped and turned into someone else's product.
          Put it on Fangorn instead and set the terms: keep it free, charge per record, or sell a
          pass. Agents pay with x402, and the USDC goes straight to you. Publish once, and earn
          whenever it's used.
        </p>

        <h2 className={styles.cardTitle}>A market for facts</h2>
        <p className={styles.sectionSub}>
          Selling data only works for data that already exists. Between publishers and readers,
          we're building a layer where you can put a price on a fact that doesn't exist yet.
        </p>
        <p className={styles.sectionSub}>
          Want every new zoning notice in your county? Place a standing order, and pay a few
          cents per match. Want a dataset nobody has made? Pool money with others who want it
          too. Builders bid in secret, put up a bond, and race to deliver before the deadline.
          If they deliver, they're paid. If they don't, you get your money back, plus their bond.
          Every open contract is public, so anyone can see what a fact is worth. That's how data
          gets made without a platform deciding what's worth making. Not live yet.
        </p>

        <h2 className={styles.cardTitle}>We're building in the open</h2>
        <p className={styles.sectionSub}>
          Come find us on <a href="https://github.com/fangorn-network">GitHub</a> and{' '}
          <a href="https://discord.gg/JDj8RdCVyU">Discord</a>.
        </p>
      </section>
    </main>
  );
}
