import styles from './Footer.module.css';

export function Cta() {
  return (
    <section className={styles.cta} id="contact">
      <h2 className={styles.ctaH2}>Start building.</h2>
      <p className={styles.ctaP}>The SDK is on npm. Contracts are live on Arbitrum Sepolia. Reach out directly if you want to talk.</p>
      <div className={styles.ctaBtns}>
        <a href="https://docs.fangorn.network" className={styles.btnA}>Documentation</a>
        <a href="mailto:hello@fangorn.network" className={styles.btnB}>hello@fangorn.network</a>
      </div>
      <div className={styles.ctaLinks}>
        {[
          { href: 'https://github.com/fangorn-network/fangorn', label: 'SDK' },
          { href: 'https://github.com/fangorn-network/x402f', label: 'x402f' },
          { href: 'https://github.com/fangorn-network/fangorn-agent', label: 'Agent' },
          { href: 'https://fangorn.music', label: 'fangorn.music' },
        ].map(l => (
          <a key={l.label} href={l.href} className={styles.ctaLink}>{l.label}</a>
        ))}
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className={styles.footer}>
      <span className={styles.fl}>Fangorn Network</span>
      <span className={styles.fc}>Intent-bound encrypted data for the agentic web</span>
      <div className={styles.flinks}>
        <a href="https://docs.fangorn.network" className={styles.flink}>Docs</a>
        <a href="https://github.com/fangorn-network" className={styles.flink}>GitHub</a>
        <a href="https://fangorn.music" className={styles.flink}>fangorn.music</a>
      </div>
    </footer>
  );
}
