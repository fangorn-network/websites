import { useState } from 'react';
import CodeBox from './CodeBox';
import styles from './Hero.module.css';
import { useAuth } from './authContext';

const INSTALL_CMD = 'npm i @fangorn-network/sdk';

export default function Hero() {
  const { ready, authenticated, login } = useAuth();

  return (
    <section className={styles.hero}>
      {/* The old headline. It's the thesis, and it means something to the people
          who already know the space — but it can't be the first thing a person
          reads and still leave them knowing what this is. */}
      <div className={styles.kicker}>Intent-bound data for the agentic web</div>
      <h1 className={styles.h1}>Publish what you write. Keep what you publish.</h1>
      <p className={styles.sub}>
        Fangorn stores your data in an account only you control, and records just enough
        on-chain for anyone to confirm it came from you and read every version you ever
        pushed. Write in Drive, or build your own app on the SDK.
      </p>

      <div className={styles.btns}>
        {authenticated ? (
          <a href="https://drive.fangorn.network" className={styles.btnA}>Open Drive</a>
        ) : (
          <button className={styles.btnA} onClick={login} disabled={!ready} type="button">
            Get started
          </button>
        )}
        <a href="#drive" className={styles.btnB}>See how it works</a>
      </div>
    </section>
  );
}

// The developer entry point. It used to be the hero, which put an npm install and
// a code block in front of everyone. Deliberately not centred and not sized like
// a headline — it's a band between two sections, not a second front door.
export function DevStrip() {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className={styles.dev}>
      <div className={styles.devL}>
        <div className={styles.devTag}>For developers</div>
        <h2 className={styles.devH2}>Commit knowledge graphs the way you commit code.</h2>
        <p className={styles.devSub}>
          Your data stays in storage you control. All the chain holds is one pointer per
          publisher, which is enough for anyone (or any agent) to clone it, check who
          wrote it, and walk the whole history without running an indexer.
        </p>

        <div className={styles.installLine} onClick={copy}>
          <span className={styles.installCmd}>{INSTALL_CMD}</span>
          <button className={styles.installCopy} onClick={(e) => { e.stopPropagation(); copy(); }}>
            {copied ? 'copied' : 'copy'}
          </button>
        </div>

        <div className={styles.devLinks}>
          <a href="https://deepwiki.com/fangorn-network/fangorn" className={styles.devLink}>Documentation</a>
          <a href="https://github.com/fangorn-network/fangorn" className={styles.devLink}>Source on GitHub</a>
        </div>
      </div>

      <div className={styles.devR}>
        <CodeBox />
      </div>
    </section>
  );
}
