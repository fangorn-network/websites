import styles from './Landing.module.css';

// The manifesto. Plain prose on purpose: edit the paragraphs, add sections freely.
// Drawn from the Jan 2026 vision post, WHITEPAPER_1 and the article draft.
export default function About() {
  return (
    <main>
      <section className={styles.section}>
        <h1 className={styles.h2}>Your data, Your rules</h1>

        <h2 className={styles.cardTitle}>proof &gt; permission</h2>
        <p className={styles.sectionSub}>
          The web we know, powered by platforms whose bottom line is profit, is rapidly changing.
          Agents, bumbling over pages built for human visual navigation, increasingly read the
          web on behalf of people. As the cost of producing information and knowledge trends
          towards zero, this shift transforms digital experiences from an attention economy to
          an intention economy, where organic behavior and intent become a crucially important
          resource.
          <br></br><br></br>
          As information becomes abundant and noisy, truth is determined through acts of
          curation. Today that right belongs to platforms. Real discovery and organic demand
          diminish over time as platforms collect behavioral data and trace your path for you,
          one that leads toward whatever outcome maximizes profits. If you don’t own your path,
          your taste, your behavior, and your own thoughts are at the mercy of whoever drew it.
        </p>

        <h2 className={styles.cardTitle}>Everything a platform does, without the platform</h2>
        <p className={styles.sectionSub}>
          When you let a platform store your data, you trust it to decide which version is
          current, to determine who can read it, and to make it discoverable and valuable. A
          platform’s central authority does provide value, but it is both corruptible and
          vulnerable: a single point of failure that leads to exploits and data breaches. It can
          change its policies at will, demonetize creators, and decide who gets to participate.
          <br></br><br></br>
          Worse, platforms that present themselves as ‘free’ are usually surveillance surfaces
          built to capture your behavior and intent, which then powers their models or is sold
          to the highest bidder. From event listeners on forms for pet insurance to LinkedIn
          scanning every extension you’ve installed, thousands of trackers watch quietly as you
          navigate and search. Most people never see the multi-billion dollar surveillance
          network running just underneath a clean, helpful webpage.
        </p>

        <h2 className={styles.cardTitle}>Open or private. Pick one.</h2>
        <p className={styles.sectionSub}>
          The semantic web, web3 and content-addressed storage have all presented themselves as
          lighthouses, signalling respite under moonless skies. So far they’ve gained
          immutability, traceability and robustness, and lost access control and privacy. Put
          your data on IPFS and anyone can use it. Lock it down and nobody can find it: the
          moment data is private, search and discovery stop working.
          <br></br><br></br>
          Fangorn keeps both. Your app runs on your own storage and your own worker, so the keys
          and the rules are yours. Trust nobody but yourself. Fangorn commits what you published
          on chain and makes it findable, by people and by agents, without anyone having to
          hand their data to a platform.
        </p>

        <h2 className={styles.cardTitle}>Fangorn splits those jobs apart</h2>
        <p className={styles.sectionSub}>
          Publishers host their own data and commit to it on chain. Anyone can check that what
          they got is exactly what was published, and that it’s the latest version. Anyone can
          index that data and serve search over it without becoming a gatekeeper, because a
          wrong answer can be proven wrong.
        </p>

        <h2 className={styles.cardTitle}>Data belongs to no app</h2>
        <p className={styles.sectionSub}>
          On today’s web, data is captured by the app that collects it. Your playlists live in
          one streaming service, your reviews in one marketplace, your city’s records in one
          vendor’s portal. Leaving means starting over, so nobody leaves.
          <br></br><br></br>
          On Fangorn, an app is a curation: it chooses which data to present under rules of its
          own, on public record. Many apps can present the same data, and one app can bring
          together data from many publishers. An app that serves you badly can be replaced by
          one that serves you better, built on the very same data.
        </p>

        <h2 className={styles.cardTitle}>Search that doesn’t watch you</h2>
        <p className={styles.sectionSub}>
          Your agent does the searching. What you like lives in a file on your own machine, not
          in any app’s database, and it carries across every app on the network. No platform
          gets to keep it, sell it, or steer it. The same goes for your agent’s memory: it’s
          held by your key, not by the platform that runs the agent.
        </p>

        <h2 className={styles.cardTitle}>Don’t just get crawled. Get rewarded.</h2>
        <p className={styles.sectionSub}>
          Anything you publish openly today gets scraped and turned into someone else’s product.
          Put it on Fangorn instead and set the terms: keep it free, charge per record, or sell a
          pass. Agents pay with x402, and the USDC goes straight to you. Publish once, and earn
          whenever it’s used.
        </p>

        <h2 className={styles.cardTitle}>A market for facts</h2>
        <p className={styles.sectionSub}>
          Selling data only works for data that already exists. Between publishers and readers,
          we’re building a layer where you can put a price on a fact that doesn’t exist yet.
          <br></br><br></br>
          Want every new zoning notice in your county? Place a standing order, and pay a few
          cents per match. Want a dataset nobody has made? Pool money with others who want it
          too. Builders bid in secret, put up a bond, and race to deliver before the deadline.
          If they deliver, they’re paid. If they don’t, you get your money back, plus their bond.
          Every open contract is public, so anyone can see what a fact is worth and how likely
          it is to exist. That’s how data gets made without a platform deciding what’s worth
          making. Not live yet.
        </p>
      </section>
    </main>
  );
}
