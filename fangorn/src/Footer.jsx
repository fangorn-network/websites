import styles from './Footer.module.css';

export function Cta() {
  return (
    <section className={styles.cta} id="contact">
      <h2 className={styles.ctaH2}>Start building.</h2>
      <p className={styles.ctaP}>The SDK is on npm and the contracts are live on Arbitrum Sepolia. If you'd rather just talk to someone first, the inbox below is read by both of us.</p>
      <div className={styles.ctaBtns}>
        <a href="https://deepwiki.com/fangorn-network/fangorn" className={styles.btnA}>Documentation</a>
        <a href="mailto:fangorn@fangorn.network" className={styles.btnB}>fangorn@fangorn.network</a>
      </div>
      <div className={styles.ctaLinks}>
        {[
          { href: 'https://github.com/fangorn-network/fangorn', label: 'SDK' },
          { href: 'https://github.com/fangorn-network/x402f', label: 'x402f' },
          { href: 'https://drive.fangorn.network', label: 'Drive' },
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
      <span className={styles.fc}>Intent-bound data for the agentic web</span>
      <div className={styles.flinks}>
        <a href="https://deepwiki.com/fangorn-network/fangorn" className={styles.flink}>Docs</a>
        <a href="https://github.com/fangorn-network" className={styles.flink}>GitHub</a>
        <a href="https://discord.gg/JDj8RdCVyU" className={styles.flink}>Discord</a>
      </div>
    </footer>
  );
}
