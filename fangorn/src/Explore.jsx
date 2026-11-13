import { useEffect, useState } from 'react';
import styles from './Landing.module.css';
import home from './Home.module.css';
import { readListings } from './account';

// Everything published on Fangorn: newest first, or ranked by what it's about. Each opens on its own page.
export default function Explore() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let cancelled = false;
    readListings({ q: query, k: 50 }).then((l) => !cancelled && setRows([...l.values()]));
    return () => { cancelled = true; };
  }, [query]);

  return (
    <main>
      <section className={styles.section}>
        <h1 className={styles.h2}>Explore</h1>
        <p className={styles.sectionSub}>Everything published on Fangorn. Search by what you're looking for, in your own words.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (q.trim() !== query) { setRows(null); setQuery(q.trim()); } }} style={{ display: 'flex', gap: 8, margin: '16px 0 24px' }}>
          <input className={home.input} style={{ flex: 1, minWidth: 0, maxWidth: 'none', fontFamily: 'inherit', fontSize: 15 }} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="music for a rainy afternoon, city council minutes, browser games…" aria-label="Search Fangorn" />
          <button className={styles.btnA} type="submit">Search</button>
        </form>
        {rows == null ? <p className={styles.sectionSub} aria-busy="true">Loading…</p>
          : !rows.length ? <p className={styles.sectionSub}>{query ? 'Nothing matches that yet.' : 'Nothing listed yet.'}</p>
          : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
              {rows.map((r) => (
                <li key={`${r.publisher}/${r.repo}`} className={styles.card}>
                  <a href={`#/data/${r.publisher}/${encodeURIComponent(r.repo)}`} className={styles.cardTitle} style={{ display: 'block' }}>{r.name ?? r.repo}</a>
                  {r.description && <p className={styles.cardBody}>{r.description}</p>}
                  <p className={styles.cardBody} style={{ opacity: 0.7, fontSize: 13, overflowWrap: 'anywhere' }}>{r.repo} · {r.publisher.slice(0, 6)}…{r.publisher.slice(-4)}</p>
                </li>
              ))}
            </ul>
          )}
      </section>
    </main>
  );
}
