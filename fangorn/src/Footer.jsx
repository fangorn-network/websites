import { useState } from 'react';
import styles from './Footer.module.css';

const CONTACT = 'fangorn@fangorn.network';
const TOPICS = ['Publishing an app', 'Using apps with my agent', 'Partnering with Fangorn', 'Something else'];

// ponytail: mailto, no backend. The form drafts the email in the visitor's mail app;
// the address is shown too, for anyone whose mail lives in a browser tab.
export function Contact() {
  const [copied, setCopied] = useState(false);

  function send(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = form.get('name').trim();
    const subject = `${form.get('topic')}${name ? ` (from ${name})` : ''}`;
    location.href = `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(form.get('message'))}`;
  }

  function copy() {
    navigator.clipboard.writeText(CONTACT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className={styles.cta} id="contact">
      <h2 className={styles.ctaH2}>Get in touch</h2>
      <p className={styles.ctaP}>Questions, ideas, or an app you want to build? Talk to the team.</p>
      <form className={styles.form} onSubmit={send}>
        <label className={styles.label}>
          What's it about?
          <select name="topic" className={styles.control}>
            {TOPICS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className={styles.label}>
          <span>Your name <span className={styles.optional}>(optional)</span></span>
          <input name="name" className={styles.control} autoComplete="name" />
        </label>
        <label className={styles.label}>
          Message
          <textarea name="message" className={styles.control} rows={6} required />
        </label>
        <button className={styles.btnA} type="submit">Open in your email app</button>
      </form>
      <p className={styles.ctaP}>
        Or write to us directly at <b>{CONTACT}</b>{' '}
        <button className={styles.copy} type="button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </p>
    </section>
  );
}

export function Footer() {
  return (
    <footer className={styles.footer}>
      <span className={styles.fl}>Fangorn Network</span>
      <span className={styles.fc}>Proof over permission</span>
      <div className={styles.flinks}>
        <a href="https://deepwiki.com/fangorn-network/fangorn" className={styles.flink}>Docs</a>
        <a href="https://github.com/fangorn-network" className={styles.flink}>GitHub</a>
        <a href="https://discord.gg/JDj8RdCVyU" className={styles.flink}>Discord</a>
        <a href="#contact" className={styles.flink}>Contact</a>
        <a href="/privacy.html" className={styles.flink}>Privacy</a>
      </div>
    </footer>
  );
}
