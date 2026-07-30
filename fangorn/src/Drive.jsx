import styles from './Drive.module.css';
import { useAuth } from './authContext';

const DRIVE_URL = 'https://drive.fangorn.network';

// The order is enforced by the contracts, not by us: subscribe() reverts with
// NotRegistered, and the upload gate rejects a wallet with no active window. So
// numbering these is describing the sequence, not decorating it.
const STEPS = [
  {
    title: 'Create your account',
    cost: 'Free',
    body: 'Sign in with an email address, Google, or a wallet you already have. If you don\'t have one, Fangorn makes you a wallet and keeps the keys on your side.',
  },
  {
    title: 'Register as a publisher',
    cost: 'One-time fee + gas',
    body: 'This records your address on-chain and gives you a namespace to publish under. Everything you publish afterwards points back to it, so readers can tell it came from you.',
  },
  {
    title: 'Subscribe to storage',
    cost: 'USDC, 30 days at a time',
    body: 'Storage is a subscription your wallet pays directly. Drive can\'t save anything for you until it\'s active, so do this before you start writing.',
  },
];

export default function Drive() {
  const { ready, authenticated, login } = useAuth();

  return (
    <section className={styles.section} id="drive">
      <div className={styles.header}>
        <div>
          <div className={styles.tag}>Fangorn Drive</div>
          <h2 className={styles.h2}>A shared wiki that nobody else can take down.</h2>
          <p className={styles.lead}>
            Drive is a markdown workspace. Write notes, edit them with other people in
            real time, and publish when you're ready. A published page is signed by your
            wallet and stored under your own account — anyone reading it can check who
            wrote it and walk back through every earlier version. Pages you keep private
            are encrypted in your browser before they leave it.
          </p>
        </div>
        <a className={styles.headerLink} href={DRIVE_URL}>drive.fangorn.network</a>
      </div>

      <div className={styles.stepsHead}>
        <span className={styles.stepsTitle}>Three steps to get in</span>
        <span className={styles.stepsNote}>
          Your wallet pays for its own storage, so you set that up before you write.
        </span>
      </div>

      <ol className={styles.steps}>
        {STEPS.map((step, i) => (
          <li key={step.title} className={styles.step}>
            <div className={styles.stepRail}>
              <span className={styles.stepDot} aria-hidden="true" />
              <span className={styles.stepNum}>0{i + 1}</span>
            </div>
            <div className={styles.stepTitle}>{step.title}</div>
            <p className={styles.stepBody}>{step.body}</p>
            <div className={styles.stepCost}>{step.cost}</div>
          </li>
        ))}
      </ol>

      <div className={styles.foot}>
        <p className={styles.footNote}>
          Fangorn runs on the Arbitrum Sepolia testnet today. The faucet in your account
          covers the registration fee and the first subscription, so all three steps cost
          you nothing right now.
        </p>
        {authenticated ? (
          <a className={styles.btnA} href={DRIVE_URL}>Open Drive</a>
        ) : (
          <button className={styles.btnA} onClick={login} disabled={!ready} type="button">
            Create your account
          </button>
        )}
      </div>
    </section>
  );
}
