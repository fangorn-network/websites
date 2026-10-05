import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <span className={styles.fl}>Fangorn Network</span>
      <span className={styles.fc}>Data your agent can use</span>
      <div className={styles.flinks}>
        <a href="https://deepwiki.com/fangorn-network/fangorn" className={styles.flink}>Docs</a>
        <a href="https://github.com/fangorn-network" className={styles.flink}>GitHub</a>
        <a href="https://discord.gg/JDj8RdCVyU" className={styles.flink}>Discord</a>
        <a href="/privacy.html" className={styles.flink}>Privacy</a>
      </div>
    </footer>
  );
}
