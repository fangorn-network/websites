import { useState } from 'react';
import CodeBox from './CodeBox';
import styles from './Hero.module.css';

export default function Hero() {
  const [copied, setCopied] = useState(false);

  function handleInstallCopy(e) {
    e.stopPropagation();
    navigator.clipboard.writeText('npm i @fangorn-network/sdk');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className={styles.hero}>
      <h1 className={styles.h1}>Intent-bound data for the agentic web.</h1>
      <p className={styles.sub}>
        Commit knowledge graphs the way you commit code. Your data stays in storage you control. All the chain holds is one pointer per publisher, which is enough for anyone (or any agent) to clone it, check who wrote it, and walk the whole history without running an indexer.
      </p>

      <div className={styles.installWrap}>
        <div className={styles.installLine} onClick={() => navigator.clipboard.writeText('npm i @fangorn-network/sdk')}>
          <span className={styles.installCmd}>npm i @fangorn-network/sdk</span>
          <button className={styles.installCopy} onClick={handleInstallCopy}>
            {copied ? 'copied' : 'copy'}
          </button>
        </div>
      </div>

      <div className={styles.btns}>
        <a href="https://deepwiki.com/fangorn-network/fangorn" className={styles.btnA}>Docs</a>
        <a href="https://github.com/fangorn-network/fangorn" className={styles.btnB}>View on GitHub</a>
      </div>

      <CodeBox />
    </section>
  );
}
