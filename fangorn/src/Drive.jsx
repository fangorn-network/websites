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
    body: 'Sign in with an email address or a wallet you already own. If you don\'t have one, Fangorn creates a wallet for you and keeps the keys on your side.',
  },
  {
    title: 'Register as a publisher',
    cost: 'One-time fee + gas',
    body: 'This records your address on-chain and gives access to publish data through Fangorn.',
  },
  {
    title: 'Subscribe to storage',
    cost: 'USDC, 30 days at a time',
    body: 'We offer 1gb of free storage on the free tier! Drive requires a storage subscription in order to save (pin) your data. Drive can\'t save anything for you until the subscription is active, so do this before you start writing.',
  },
];

export default function Drive() {
  const { ready, authenticated, login } = useAuth();

  return (
    <section className={styles.section} id="drive">
      <div className={styles.header}>
        <div>
          <div className={styles.tag}>Fangorn Drive</div>
          <h2 className={styles.h2}>A markdown editor for the agentic age.</h2>
          <p className={styles.lead}>
            Drive is an agentic markdown workspace. Write notes, edit them with others in
            real time, and publish when ready, or use an MCP to let an agent read/write notes. A published page can only be authorized by *you* and is stored under your own account. Pages you keep private are encrypted in your browser before they leave it.
          </p>
        </div>
        <a className={styles.headerLink} href={DRIVE_URL}>drive.fangorn.network</a>
      </div>

      <div className={styles.stepsHead}>
        <span className={styles.stepsTitle}>Getting Started</span>
        <span className={styles.stepsNote}>
          Register, subscribe, write!
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
          Fangorn is live on Arbitrum Sepolia.
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
