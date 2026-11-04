import styles from './Landing.module.css';

// For app builders. An app is a repo with an agent card, so there's nothing to manage here:
// westmarch-ship does the setup, and the app shows on the account page with the wallet's data.
const DEPLOY_URL = 'https://deploy.workers.cloudflare.com/?url=https://github.com/fangorn-network/westmarch/tree/main/template';
const PLUGIN = `/plugin marketplace add fangorn-network/westmarch
/plugin install fangorn-builder@fangorn`;
const SHIP = `npm i @fangorn-network/westmarch
npx westmarch-ship app.json`;

export default function Build() {
  return (
    <main>
      <section className={styles.section}>
        <h1 className={styles.h2}>Build on Fangorn</h1>
        <p className={styles.sectionSub}>
          An app is a view over what publishers have published: the repos you choose, your
          search, your site. It runs as a Worker on your own Cloudflare account, and nobody has
          to let you in.
        </p>

        <h2 className={styles.cardTitle}>What you get</h2>
        <p className={styles.sectionSub}>
          <b>A site people search by meaning</b>, in the browser, with no server to run. It
          re-indexes its repos every few minutes on Cloudflare's free plan.
        </p>
        <p className={styles.sectionSub}>
          <b>An agent card</b>, registered on chain (ERC-8004), so agents can find the app and
          call its tools.
        </p>

        <h2 className={styles.cardTitle}>With Claude Code</h2>
        <p className={styles.sectionSub}>Add the builder plugin, then say "Build a Fangorn app from &lt;your data&gt;."</p>
        <div className={styles.cmd}><pre>{PLUGIN}</pre></div>

        <h2 className={styles.cardTitle}>By hand</h2>
        <p className={styles.sectionSub}>
          Describe the app in an <code className={styles.inline}>app.json</code>: its name, and
          the repos it presents. One command makes its repo, deploys the Worker and registers its card:
        </p>
        <div className={styles.cmd}><pre>{SHIP}</pre></div>
        <p className={styles.sectionSub}>
          It signs with your Fangorn CLI's wallet (<code className={styles.inline}>fangorn init</code>),
          and deploys with your Cloudflare login. Or start from the template:{' '}
          <a href={DEPLOY_URL} target="_blank" rel="noreferrer">
            <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare" height="32" />
          </a>
        </p>

        <h2 className={styles.cardTitle}>After it ships</h2>
        <p className={styles.sectionSub}>
          The app shows in <a href="#/account">your account</a>, marked as an app, next to any
          data you publish from the same wallet. The explorer and agents find it from then on.
        </p>
      </section>
    </main>
  );
}
