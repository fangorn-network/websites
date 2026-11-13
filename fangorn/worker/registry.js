// The registry: every repo on Fangorn, by publisher, found by its name and its agent card. Not the records in it.
//
// One stitch over every repo of every publisher (restitch(["*"])), kept in D1. Each run folds only the log since
// the last stitch; for each repo whose head moved, it reads the repo's `@card` record (one MST path) and, if that
// points at an agent card naming this publisher, repo and registry (the SDK's FANGORN_REPO_EXTENSION), keeps the
// card. A repo without a card is still listed, by name. Search embeds the repo's name and its card.
//
// The stitch is public (GET /api/repos says which), so anyone can check the list with verifyStitch(stitch, ["*"]).

import { CARD_RECORD, FANGORN_REPO_EXTENSION } from '@fangorn-network/sdk';

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS repos (publisher TEXT NOT NULL, repo TEXT NOT NULL, head TEXT NOT NULL, updated TEXT NOT NULL, card_url TEXT, card TEXT, text TEXT NOT NULL, vec TEXT, PRIMARY KEY (publisher, repo))',
];
const MAX_CARD = 64 * 1024;
const cosine = (q, v) => { let d = 0, a = 0, b = 0; for (let i = 0; i < q.length; i++) { d += q[i] * v[i]; a += q[i] * q[i]; b += v[i] * v[i]; } return a && b ? d / Math.sqrt(a * b) : 0; };

/**
 * The card a repo's `@card` record points at, if it speaks for this repo on this registry: { url, card } or null.
 * The card is the publisher's to write, so it's kept as data: whatever fields it has, up to 64 KB.
 */
export async function cardOf(fangorn, publisher, repo) {
  const url = (await fangorn.engine.readRecord(publisher, repo, CARD_RECORD).catch(() => null))?.payload?.url;
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const body = await res.text();
    if (!res.ok || body.length > MAX_CARD) return null;
    const card = JSON.parse(body), p = card?.capabilities?.extensions?.find((e) => e?.uri === FANGORN_REPO_EXTENSION)?.params ?? {};
    const { caip2, dataRegistryContractAddress } = fangorn.getConfig();
    const ours = String(p.publisher).toLowerCase() === publisher.toLowerCase() && p.repo === repo
      && p.chainId === caip2 && String(p.dataRegistry).toLowerCase() === dataRegistryContractAddress.toLowerCase();
    return ours ? { url, card } : null;
  } catch { return null; } // ponytail: an unreachable or broken card lists the repo without one; it's re-read when the head moves
}

/** What search matches for a repo: its name in words, and its card's name, description and skills. */
export function textOf(repo, card) {
  const skills = Array.isArray(card?.skills) ? card.skills : [];
  return [repo.replace(/[-_.]+/g, ' '), card?.name, card?.description, ...skills.flatMap((s) => [s?.name, s?.description, ...(Array.isArray(s?.tags) ? s.tags : [])])]
    .filter((x) => typeof x === 'string' && x).join('\n').slice(0, 4000);
}

const rowOf = (r, full) => {
  const card = r.card ? JSON.parse(r.card) : null;
  return { publisher: r.publisher, repo: r.repo, head: r.head, updated: r.updated, card_url: r.card_url ?? null,
    ...(full ? { card } : { name: card?.name ?? null, description: card?.description ?? null }) };
};

/** `db`: a D1 binding. `fangorn`: an SDK client (reads, and stitch uploads). */
export function registry({ db, fangorn }) {
  const all = async (sql, ...args) => (await db.prepare(sql).bind(...args).all()).results;
  const getMeta = async (k) => (await db.prepare('SELECT v FROM meta WHERE k = ?').bind(k).first())?.v ?? null;
  const setMeta = (k, v) => db.prepare('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v').bind(k, v);
  let ready;
  const ensure = () => (ready ??= db.batch(SCHEMA.map((s) => db.prepare(s)))); // the tables, before the first run makes them

  return {
    /** The current stitch's CID, or null before the first run. */
    stitch: async () => { await ensure(); return getMeta('stitch'); },

    /**
     * Restitch from the saved stitch; re-read the card of every repo whose head moved; save it all with the new
     * stitch in one batch (so a failed run is retried whole). → how many repos changed.
     */
    // ponytail: every moved repo's card in one run; fine for the network today (30 repos: ~200 subrequests on a
    // cold start). Cap per run and keep the old stitch for the rest once one run can't read them all.
    async update(now = new Date().toISOString()) {
      await ensure();
      const prev = await getMeta('stitch'), next = await fangorn.restitch(['*'], prev ?? undefined);
      if (next === prev) return 0;
      const known = new Map((await all('SELECT publisher, repo, head FROM repos')).map((r) => [`${r.publisher}/${r.repo}`, r.head]));
      const moved = (await fangorn.stitchHeads(next)).filter((h) => known.get(`${h.publisher.toLowerCase()}/${h.repo}`) !== h.head);
      const cards = await Promise.all(moved.map((h) => cardOf(fangorn, h.publisher, h.repo)));
      const ops = moved.map(({ publisher, repo, head }, i) => {
        const p = publisher.toLowerCase(), c = cards[i];
        return db.prepare(`INSERT INTO repos (publisher, repo, head, updated, card_url, card, text, vec) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
          ON CONFLICT (publisher, repo) DO UPDATE SET head = excluded.head, updated = excluded.updated, card_url = excluded.card_url,
          card = excluded.card, vec = CASE WHEN repos.text = excluded.text THEN repos.vec ELSE NULL END, text = excluded.text`)
          .bind(p, repo, head, now, c?.url ?? null, c ? JSON.stringify(c.card) : null, textOf(repo, c?.card));
      });
      await db.batch([...ops, setMeta('stitch', next)]);
      return ops.length;
    },

    /** Vectors for up to `max` repos that have none, by `embed(texts) → vectors`. → how many. */
    async embedMissing(embed, max = 100) {
      const rows = await all('SELECT publisher, repo, text FROM repos WHERE vec IS NULL LIMIT ?', max);
      if (!rows.length) return 0;
      const vecs = await embed(rows.map((r) => r.text));
      await db.batch(rows.map((r, i) => db.prepare('UPDATE repos SET vec = ? WHERE publisher = ? AND repo = ?').bind(JSON.stringify(Array.from(vecs[i])), r.publisher, r.repo)));
      return rows.length;
    },

    /** Repos, newest change first; with `q` (a query vector), nearest first, each with `score`. */
    // ponytail: every vector, every query; fine for thousands of repos, Vectorize past that
    async find({ q, publisher, k = 20 } = {}) {
      await ensure();
      const where = publisher ? 'WHERE publisher = ?' : '', args = publisher ? [publisher.toLowerCase()] : [];
      if (!q) return (await all(`SELECT * FROM repos ${where} ORDER BY updated DESC, publisher, repo LIMIT ?`, ...args, k)).map((r) => rowOf(r));
      const rows = await all(`SELECT * FROM repos ${where ? where + ' AND' : 'WHERE'} vec IS NOT NULL`, ...args);
      return rows.map((r) => ({ ...rowOf(r), score: cosine(q, JSON.parse(r.vec)) })).sort((a, b) => b.score - a.score).slice(0, k);
    },

    /** One repo, with its whole card, or null. */
    async get(publisher, repo) {
      await ensure();
      const r = await db.prepare('SELECT * FROM repos WHERE publisher = ? AND repo = ?').bind(String(publisher).toLowerCase(), repo).first();
      return r ? rowOf(r, true) : null;
    },
  };
}
