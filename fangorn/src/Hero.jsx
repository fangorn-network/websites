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
        Define schemas, encrypt by intent, and publish on-chain: enable agents to discover and purchase the data you actually want, entirely free from algorithmic gatekeepers.
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
        <a href="https://docs.fangorn.network" className={styles.btnA}>Read the Docs [Coming Soon]</a>
        <a href="https://github.com/fangorn-network/fangorn" className={styles.btnB}>View on GitHub</a>
      </div>

      <CodeBox />
    </section>
  );
}
