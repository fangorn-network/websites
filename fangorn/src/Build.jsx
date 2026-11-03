import styles from './Landing.module.css';

// For app builders: what an app gets, and the three steps. The steps themselves
// (claim, deploy, bind the card) live on the account page.
const DEPLOY_URL = 'https://deploy.workers.cloudflare.com/?url=https://github.com/fangorn-network/westmarch/tree/main/template';
const PLUGIN = `/plugin marketplace add fangorn-network/westmarch
/plugin install fangorn-builder@fangorn`;

export default function Build() {
  return (
    <main>
      <section className={styles.section}>
        <h1 className={styles.h2}>Build on Fangorn</h1>
        <p className={styles.sectionSub}>
          An app is a view over what publishers have published: your choice of repos, your
          search, your site. It runs as a Worker on your own Cloudflare account. Nobody has to
          let you in.
        </p>

        <h2 className={styles.cardTitle}>What you get</h2>
        <p className={styles.sectionSub}>
          <b>Agents find it.</b> Every agent with fangorn-mcp installed can list your app,
          open it and call its tools.
        </p>
        <p className={styles.sectionSub}>
          <b>Agents pay it.</b> Your Worker can charge per call or per pass in USDC, over x402,
          to your payout address.
        </p>
        <p className={styles.sectionSub}>
          <b>No server to run.</b> Search runs on Cloudflare's free plan. Each push to your
          repo redeploys it.
        </p>

        <h2 className={styles.cardTitle}>1. Claim a name</h2>
        <p className={styles.sectionSub}>
          Claiming is free. The wallet that claims a name owns it. <a href="#/account">Open your account</a>.
        </p>

        <h2 className={styles.cardTitle}>2. Build it</h2>
        <p className={styles.sectionSub}>Ask Claude Code. Run these inside it, then say "Build a Fangorn app from &lt;your data&gt;."</p>
        <div className={styles.cmd}><pre>{PLUGIN}</pre></div>
        <p className={styles.sectionSub}>
          Or deploy the template as is:{' '}
          <a href={DEPLOY_URL} target="_blank" rel="noreferrer">
            <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare" height="32" />
          </a>
        </p>

        <h2 className={styles.cardTitle}>3. Bind it</h2>
        <p className={styles.sectionSub}>
          Paste your Worker's URL into your app's page in <a href="#/account">your account</a>.
          That publishes its agent card, and agents can find it from then on.
        </p>
      </section>
    </main>
  );
}
