import { useEffect, useState } from 'react';
import styles from './Repos.module.css';
import { readCommits, readData, readDataDiff } from './buckets';
import { truncate, txExplorer, ipfsUrl, relativeTime } from './format';
import { diffLines } from './diff';

function commitTime(commit) {
  // Commit body carries a ms timestamp (from IPFS); absent if the gateway missed.
  return commit.timestamp ?? null;
}

// A field value is a "block" (own paragraph) when it's multi-line or long,
// otherwise it renders inline as key: value.
const isBlock = (v) => typeof v === 'string' && (v.includes('\n') || v.length > 80);
const asText = (v) => (typeof v === 'string' ? v : JSON.stringify(v));

function Field({ name, value }) {
  if (isBlock(value)) {
    return (
      <div className={styles.fieldBlock}>
        <span className={styles.fieldKey}>{name}</span>
        <pre className={styles.fieldText}>{asText(value)}</pre>
      </div>
    );
  }
  return (
    <div className={styles.fieldInline}>
      <span className={styles.fieldKey}>{name}</span>
      <span className={styles.fieldVal}>{asText(value) || <em className={styles.dim}>(empty)</em>}</span>
    </div>
  );
}

// One data record: its name and all of its fields.
function Record({ name, fields }) {
  return (
    <div className={styles.record}>
      <div className={styles.recordName}>{name}</div>
      <div className={styles.fields}>
        {Object.entries(fields ?? {}).map(([k, v]) => <Field key={k} name={k} value={v} />)}
      </div>
    </div>
  );
}

// The actual data records of a commit (defaults to the repo's HEAD).
function DataView({ commit }) {
  const [records, setRecords] = useState(null); // array | { error }
  useEffect(() => {
    let cancelled = false;
    readData(commit)
      .then((r) => !cancelled && setRecords(r))
      .catch((e) => !cancelled && setRecords({ error: e?.message || 'Could not load data.' }));
    return () => { cancelled = true; };
  }, [commit.cid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!records) return <p className={styles.muted}>Loading data…</p>;
  if (records.error) return <p className={styles.muted}>{records.error}</p>;
  if (records.length === 0) return <p className={styles.muted}>No records in this version.</p>;
  return <div className={styles.records}>{records.map((r) => <Record key={r.name} name={r.name} fields={r.fields} />)}</div>;
}

// A field's before → after: a line diff for prose, inline old → new for scalars.
function FieldDiff({ field, before, after }) {
  const multiline = isBlock(before) || isBlock(after);
  return (
    <div className={styles.fieldDiff}>
      <span className={styles.fieldKey}>{field}</span>
      {multiline ? (
        <pre className={styles.lineDiff}>
          {diffLines(before, after).map((l, i) => (
            <div key={i} className={l.type === 'add' ? styles.added : l.type === 'del' ? styles.removed : styles.same}>
              {l.type === 'add' ? '+ ' : l.type === 'del' ? '− ' : '  '}{l.text}
            </div>
          ))}
        </pre>
      ) : (
        <span className={styles.inlineDiff}>
          <span className={styles.removed}>{asText(before) || '∅'}</span>
          {' → '}
          <span className={styles.added}>{asText(after) || '∅'}</span>
        </span>
      )}
    </div>
  );
}

// A whole record added or removed. Added records show their fields; removed just
// the name (its content is gone).
function RecordChange({ kind, name, fields }) {
  const cls = kind === 'add' ? styles.added : styles.removed;
  return (
    <div className={styles.recChange}>
      <div className={`${styles.recordName} ${cls}`}>{kind === 'add' ? '+' : '−'} {name}</div>
      {kind === 'add' && (
        <div className={styles.fields}>
          {Object.entries(fields ?? {}).map(([k, v]) => <Field key={k} name={k} value={v} />)}
        </div>
      )}
    </div>
  );
}

// The data changes a commit introduced vs its parent.
function DataDiff({ diff }) {
  const { added, removed, changed, isRoot } = diff;
  if (!added.length && !removed.length && !changed.length) {
    return <p className={styles.muted}>No data changes.</p>;
  }
  return (
    <div className={styles.diff}>
      {isRoot && <p className={styles.rootNote}>Initial commit — {added.length} record{added.length === 1 ? '' : 's'} added.</p>}
      {added.map((r) => <RecordChange key={`a-${r.name}`} kind="add" name={r.name} fields={r.fields} />)}
      {changed.map((r) => (
        <div key={`c-${r.name}`} className={styles.recChange}>
          <div className={`${styles.recordName} ${styles.changed}`}>~ {r.name}</div>
          {r.fieldDiffs.map((f) => <FieldDiff key={f.field} field={f.field} before={f.before} after={f.after} />)}
        </div>
      ))}
      {removed.map((r) => <RecordChange key={`r-${r.name}`} kind="del" name={r.name} fields={r.fields} />)}
    </div>
  );
}

function MetaRow({ label, children }) {
  return (
    <div className={styles.metaRow}>
      <span className={styles.metaLabel}>{label}</span>
      <span className={styles.metaVal}>{children}</span>
    </div>
  );
}

// One commit in the log: a summary row that expands to the data it changed.
function CommitRow({ commit }) {
  const [open, setOpen] = useState(false);
  const [diff, setDiff] = useState(null); // diff object | { error }
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || diff || loading) return;
    setLoading(true);
    try {
      setDiff(await readDataDiff(commit));
    } catch (err) {
      setDiff({ error: err?.message || 'Could not load the diff.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.commitRow}>
      <button className={styles.commitBtn} onClick={toggle} type="button" aria-expanded={open}>
        <span className={styles.verBadge}>v{commit.version}</span>
        <span className={styles.commitMain}>
          <span className={styles.commitMsg}>{commit.message || '(no message)'}</span>
          <span className={styles.commitSub}>
            {commit.author ? truncate(commit.author, 6, 4) : 'unknown'} · {relativeTime(commitTime(commit))}
          </span>
        </span>
        <span className={styles.commitCid}>{open ? '▾' : '▸'} {truncate(commit.cid, 6, 4)}</span>
      </button>

      {open && (
        <div className={styles.commitBody}>
          {loading && <p className={styles.muted}>Computing data diff…</p>}
          {diff?.error && <p className={styles.muted}>{diff.error}</p>}
          {diff && !diff.error && <DataDiff diff={diff} />}

          <div className={styles.metaGrid}>
            <MetaRow label="Merkle root"><span className={styles.mono}>{truncate(commit.root || commit.merkleRoot, 10, 8)}</span></MetaRow>
            <MetaRow label="Transaction">
              <a className={styles.link} href={txExplorer(commit.txHash)} target="_blank" rel="noreferrer">{truncate(commit.txHash, 8, 6)}</a>
            </MetaRow>
          </div>
        </div>
      )}
    </div>
  );
}

// A repo view: its latest data up top, its commit history (with per-commit data
// diffs) below. Both load from the commit list fetched on open. Newest first.
function RepoDetail({ repo, bucket, onBack }) {
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(true);

  // RepoView keys this component by repo, so it remounts (loading resets to true)
  // per repo — no need to set loading inside the effect.
  useEffect(() => {
    let cancelled = false;
    readCommits(bucket, repo.schemaId, repo.nameHash)
      .then((c) => !cancelled && setCommits(c))
      .catch((err) => !cancelled && console.warn('Commit history failed:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [bucket, repo.schemaId, repo.nameHash]);

  const head = commits[0];

  return (
    <div>
      <button className={styles.back} onClick={onBack} type="button">← Repositories</button>

      <div className={styles.detailHead}>
        <div className={styles.detailTitle}>
          <span className={styles.repoIcon}>📦</span>
          <span className={styles.detailName}>{repo.name}</span>
          <span className={styles.verBadge}>v{repo.version}</span>
        </div>
        <div className={styles.detailSub}>
          {repo.schemaName && <span className={styles.schemaTag}>{repo.schemaName}</span>}
          {repo.specCid && (
            <a className={styles.link} href={ipfsUrl(repo.specCid)} target="_blank" rel="noreferrer">schema spec</a>
          )}
        </div>
      </div>

      <span className={styles.heading}>Latest data{head ? ` · v${head.version}` : ''}</span>
      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : head ? (
        <DataView commit={head} />
      ) : (
        <p className={styles.muted}>No commits found for this repo.</p>
      )}

      {commits.length > 0 && (
        <>
          <span className={`${styles.heading} ${styles.historyHeading}`}>History &amp; changes</span>
          <div className={styles.commitList}>
            {commits.map((c) => <CommitRow key={c.cid} commit={c} />)}
          </div>
        </>
      )}
    </div>
  );
}

function RepoList({ repos, onOpen }) {
  return (
    <>
      <span className={styles.heading}>Repositories</span>
      <div className={styles.repoList}>
      {repos.map((r) => (
        <button key={`${r.schemaId}-${r.nameHash}`} className={styles.repoItem} onClick={() => onOpen(r)} type="button">
          <div className={styles.repoTop}>
            <span className={styles.repoIcon}>📦</span>
            <span className={styles.repoName}>{r.name}</span>
            <span className={styles.verBadge}>v{r.version}</span>
            {r.schemaName && <span className={styles.schemaTag}>{r.schemaName}</span>}
          </div>
          <div className={styles.repoMeta}>
            <span className={styles.repoMsg}>{r.message ? `“${r.message}”` : 'latest commit'}</span>
            {r.updatedAt && <span className={styles.repoAge}>{relativeTime(r.updatedAt)}</span>}
          </div>
        </button>
      ))}
      </div>
    </>
  );
}

// The bucket's datasources as git-like repositories: list → repo (latest data +
// history/diffs). A dedicated router isn't worth it for a two-level drill-down;
// local state swaps between the list and a repo's detail.
// ponytail: view state, not a route — no deep links. Add a route if repos need
// shareable URLs.
export default function RepoView({ repos, loading, bucket }) {
  const [selected, setSelected] = useState(null);

  if (loading) return <p className={styles.muted}>Reading the bucket's repositories…</p>;
  if (repos.length === 0) {
    return (
      <p className={styles.muted}>
        Nothing published to this bucket yet. Publish a datasource with the SDK — each
        becomes a versioned repo here. Seeing a different set than the CLI? Make sure you're
        signed in with the wallet that owns this bucket.
      </p>
    );
  }

  return (
    <div className={styles.view}>
      {selected ? (
        <RepoDetail
          key={`${selected.schemaId}-${selected.nameHash}`}
          repo={selected}
          bucket={bucket}
          onBack={() => setSelected(null)}
        />
      ) : (
        <RepoList repos={repos} onOpen={setSelected} />
      )}
    </div>
  );
}
