import { useState } from 'react';
import styles from './CodeBox.module.css';

const TABS = ['commit', 'subscribe', 'cli'];

const PLAIN = {
  commit: `
import { Fangorn, FangornConfig } from '@fangorn-network/sdk';

const fangorn = Fangorn.create({
  privateKey: '0x...',
  storage: { pinata: { jwt: PINATA_JWT, gateway: PINATA_GATEWAY } },
  config: FangornConfig,
});

await fangorn.initRepo('rusty-anchor');

const c1 = await fangorn.commit({
  namespace: 'rusty-anchor',
  message: 'initial import',
  vertices: [
    { id: 't1', tag: 'track', payload: { title: 'Locura', artist: 'Alice' } },
    { id: 'a1', tag: 'artist', payload: { name: 'Alice' } },
  ],
  edges: [{ rel: 'performed_by', from: 't1', to: 'a1' }],
});

await fangorn.push(c1.commitCid);
  `,
  subscribe: `
import { Fangorn } from '@fangorn-network/sdk';

const fangorn = Fangorn.create({
  privateKey: '0x...',
  storage: { pinata: { jwt: PINATA_JWT, gateway: PINATA_GATEWAY } },
});

for await (const change of fangorn.subscribe({
  namespace: 'rusty-anchor',
  owner: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
  fromBlock: savedCursor,
})) {
  for (const v of change.addedVertices) index.upsert(v.cid, v.payload);
  for (const cid of change.removedVertexCids) index.remove(cid);
  persistCursor(change.blockNumber);
}
  `,
  cli: `npm i -g @fangorn-network/sdk
fangorn init
fangorn register
fangorn repo init rusty-anchor
fangorn commit graph.json -m "initial import"
fangorn push`,
};

const CODE = {
  commit: (
    <pre>
      <Line n={1}><Kw>import</Kw> <Op>{'{'}</Op> <Fn>Fangorn</Fn><Op>,</Op> <Fn>FangornConfig</Fn> <Op>{'}'}</Op> <Kw>from</Kw> <Str>'@fangorn-network/sdk'</Str><Op>;</Op></Line>
      <Line n={2} />
      <Line n={3}><Kw>const</Kw> <Fn>fangorn</Fn> <Op>=</Op> <Fn>Fangorn</Fn><Op>.</Op><Fn>create</Fn><Op>{'({'}</Op></Line>
      <Line n={4}>&nbsp;&nbsp;<Prop>privateKey</Prop><Op>:</Op> <Str>'0x...'</Str><Op>,</Op></Line>
      <Line n={5}>&nbsp;&nbsp;<Prop>storage</Prop><Op>:</Op> <Op>{'{'}</Op> <Prop>pinata</Prop><Op>:</Op> <Op>{'{'}</Op> <Prop>jwt</Prop><Op>:</Op> <Fn>PINATA_JWT</Fn><Op>,</Op> <Prop>gateway</Prop><Op>:</Op> <Fn>PINATA_GATEWAY</Fn> <Op>{'}'}</Op> <Op>{'}'}</Op><Op>,</Op></Line>
      <Line n={6}>&nbsp;&nbsp;<Prop>config</Prop><Op>:</Op> <Fn>FangornConfig</Fn><Op>,</Op> <Cm>{'// defaults to Arbitrum Sepolia'}</Cm></Line>
      <Line n={7}><Op>{'}'}</Op><Op>);</Op></Line>
      <Line n={8} />
      <Line n={9}><Kw>await</Kw> <Fn>fangorn</Fn><Op>.</Op><Fn>initRepo</Fn><Op>(</Op><Str>'rusty-anchor'</Str><Op>);</Op> <Cm>{'// a namespace in your one root'}</Cm></Line>
      <Line n={10} />
      <Line n={11}><Kw>const</Kw> <Fn>c1</Fn> <Op>=</Op> <Kw>await</Kw> <Fn>fangorn</Fn><Op>.</Op><Fn>commit</Fn><Op>{'({'}</Op> <Cm>{'// one CAR upload, nothing on-chain yet'}</Cm></Line>
      <Line n={12}>&nbsp;&nbsp;<Prop>namespace</Prop><Op>:</Op> <Str>'rusty-anchor'</Str><Op>,</Op></Line>
      <Line n={13}>&nbsp;&nbsp;<Prop>message</Prop><Op>:</Op> <Str>'initial import'</Str><Op>,</Op></Line>
      <Line n={14}>&nbsp;&nbsp;<Prop>vertices</Prop><Op>:</Op> <Op>[</Op></Line>
      <Line n={15}>&nbsp;&nbsp;&nbsp;&nbsp;<Op>{'{'}</Op> <Prop>id</Prop><Op>:</Op> <Str>'t1'</Str><Op>,</Op> <Prop>tag</Prop><Op>:</Op> <Str>'track'</Str><Op>,</Op> <Prop>payload</Prop><Op>:</Op> <Op>{'{'}</Op> <Prop>title</Prop><Op>:</Op> <Str>'Locura'</Str><Op>,</Op> <Prop>artist</Prop><Op>:</Op> <Str>'Alice'</Str> <Op>{'}'}</Op> <Op>{'}'}</Op><Op>,</Op></Line>
      <Line n={16}>&nbsp;&nbsp;&nbsp;&nbsp;<Op>{'{'}</Op> <Prop>id</Prop><Op>:</Op> <Str>'a1'</Str><Op>,</Op> <Prop>tag</Prop><Op>:</Op> <Str>'artist'</Str><Op>,</Op> <Prop>payload</Prop><Op>:</Op> <Op>{'{'}</Op> <Prop>name</Prop><Op>:</Op> <Str>'Alice'</Str> <Op>{'}'}</Op> <Op>{'}'}</Op><Op>,</Op></Line>
      <Line n={17}>&nbsp;&nbsp;<Op>],</Op></Line>
      <Line n={18}>&nbsp;&nbsp;<Prop>edges</Prop><Op>:</Op> <Op>[{'{'}</Op> <Prop>rel</Prop><Op>:</Op> <Str>'performed_by'</Str><Op>,</Op> <Prop>from</Prop><Op>:</Op> <Str>'t1'</Str><Op>,</Op> <Prop>to</Prop><Op>:</Op> <Str>'a1'</Str> <Op>{'}'}]</Op><Op>,</Op></Line>
      <Line n={19}><Op>{'}'}</Op><Op>);</Op></Line>
      <Line n={20} />
      <Line n={21}><Kw>await</Kw> <Fn>fangorn</Fn><Op>.</Op><Fn>push</Fn><Op>(</Op><Fn>c1</Fn><Op>.</Op><Prop>commitCid</Prop><Op>);</Op> <Cm>{'// fast-forwards your on-chain root'}</Cm><Cursor /></Line>
    </pre>
  ),
  subscribe: (
    <pre>
      <Line n={1}><Kw>import</Kw> <Op>{'{'}</Op> <Fn>Fangorn</Fn> <Op>{'}'}</Op> <Kw>from</Kw> <Str>'@fangorn-network/sdk'</Str><Op>;</Op></Line>
      <Line n={2} />
      <Line n={3}><Kw>const</Kw> <Fn>fangorn</Fn> <Op>=</Op> <Fn>Fangorn</Fn><Op>.</Op><Fn>create</Fn><Op>{'({'}</Op></Line>
      <Line n={4}>&nbsp;&nbsp;<Prop>privateKey</Prop><Op>:</Op> <Str>'0x...'</Str><Op>,</Op></Line>
      <Line n={5}>&nbsp;&nbsp;<Prop>storage</Prop><Op>:</Op> <Op>{'{'}</Op> <Prop>pinata</Prop><Op>:</Op> <Op>{'{'}</Op> <Prop>jwt</Prop><Op>:</Op> <Fn>PINATA_JWT</Fn><Op>,</Op> <Prop>gateway</Prop><Op>:</Op> <Fn>PINATA_GATEWAY</Fn> <Op>{'}'}</Op> <Op>{'}'}</Op><Op>,</Op></Line>
      <Line n={6}><Op>{'}'}</Op><Op>);</Op></Line>
      <Line n={7} />
      <Line n={8}><Cm>{'// A light client: logs from the RPC node, blocks from IPFS.'}</Cm></Line>
      <Line n={9}><Cm>{'// No subgraph. No indexer.'}</Cm></Line>
      <Line n={10}><Kw>for await</Kw> <Op>(</Op><Kw>const</Kw> <Fn>change</Fn> <Kw>of</Kw> <Fn>fangorn</Fn><Op>.</Op><Fn>subscribe</Fn><Op>{'({'}</Op></Line>
      <Line n={11}>&nbsp;&nbsp;<Prop>namespace</Prop><Op>:</Op> <Str>'rusty-anchor'</Str><Op>,</Op></Line>
      <Line n={12}>&nbsp;&nbsp;<Prop>owner</Prop><Op>:</Op> <Str>'0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'</Str><Op>,</Op></Line>
      <Line n={13}>&nbsp;&nbsp;<Prop>fromBlock</Prop><Op>:</Op> <Fn>savedCursor</Fn><Op>,</Op> <Cm>{'// omit to start live from the on-chain tip'}</Cm></Line>
      <Line n={14}><Op>{'}))'}</Op> <Op>{'{'}</Op></Line>
      <Line n={15}>&nbsp;&nbsp;<Kw>for</Kw> <Op>(</Op><Kw>const</Kw> <Fn>v</Fn> <Kw>of</Kw> <Fn>change</Fn><Op>.</Op><Prop>addedVertices</Prop><Op>)</Op> <Fn>index</Fn><Op>.</Op><Fn>upsert</Fn><Op>(</Op><Fn>v</Fn><Op>.</Op><Prop>cid</Prop><Op>,</Op> <Fn>v</Fn><Op>.</Op><Prop>payload</Prop><Op>);</Op></Line>
      <Line n={16}>&nbsp;&nbsp;<Kw>for</Kw> <Op>(</Op><Kw>const</Kw> <Fn>cid</Fn> <Kw>of</Kw> <Fn>change</Fn><Op>.</Op><Prop>removedVertexCids</Prop><Op>)</Op> <Fn>index</Fn><Op>.</Op><Fn>remove</Fn><Op>(</Op><Fn>cid</Fn><Op>);</Op></Line>
      <Line n={17}>&nbsp;&nbsp;<Fn>persistCursor</Fn><Op>(</Op><Fn>change</Fn><Op>.</Op><Prop>blockNumber</Prop><Op>);</Op> <Cm>{'// restart resumes here'}</Cm></Line>
      <Line n={18}><Op>{'}'}</Op><Cursor /></Line>
    </pre>
  ),
  cli: (
    <div className={styles.cli}>
      <CliLine prompt>npm i -g @fangorn-network/sdk</CliLine>
      <CliLine prompt>fangorn init</CliLine>
      <CliSection title="Fangorn Setup">
        <CliPrompt label="Wallet private key:" value="0x••••" />
        <CliPrompt label="Pinata JWT:" value="••••" />
        <CliPrompt label="Pinata Gateway URL:" value="https://your-gateway.mypinata.cloud" />
        <CliInfo>Config saved to ~/.fangorn/config.json</CliInfo>
      </CliSection>
      <CliBlank />
      <CliLine prompt>fangorn register</CliLine>
      <CliInfo>Publisher: 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984</CliInfo>
      <CliBlank />
      <CliLine prompt>fangorn repo init rusty-anchor</CliLine>
      <CliInfo>Namespace: rusty-anchor &nbsp;HEAD: (none)</CliInfo>
      <CliBlank />
      <CliLine prompt>fangorn commit graph.json -m "initial import"</CliLine>
      <CliJson>{`{
  "vertices": [
    { "id": "t1", "tag": "track",  "payload": { "title": "Locura" } },
    { "id": "a1", "tag": "artist", "payload": { "name": "Alice" } }
  ],
  "edges": [{ "rel": "performed_by", "from": "t1", "to": "a1" }]
}`}</CliJson>
      <CliResult title="Committed locally">
        <CliResultRow label="Commit:" value="bafyreihdwdcefgh4dqkjv67uzcmw7oje...4pbmomqfjrhtb2q" />
        <CliResultRow label="Parent:" value="(root)" />
        <CliResultRow label="Staged:" value="2 vertice(s) / 1 edge(s)" />
      </CliResult>
      <CliBlank />
      <CliLine prompt>fangorn push</CliLine>
      <CliResult title="On-chain tip advanced">
        <CliResultRow label="Tx:" value="0x8f3c1a...b29d" />
        <CliResultRow label="Tip:" value="bafyreihdwdcefgh4dqkjv67uzcmw7oje...4pbmomqfjrhtb2q" />
      </CliResult>
    </div>
  ),
};

function CliLine({ children, prompt }) {
  return (
    <div className={styles.cliLine}>
      {prompt && <span className={styles.cliPrompt}>$</span>}
      <span className={styles.cliCmd}>{children}</span>
    </div>
  );
}

function CliBlank() {
  return <div style={{ height: 8 }} />;
}

function CliSection({ title, children }) {
  return (
    <div className={styles.cliSection}>
      <div className={styles.cliSectionTitle}>
        <span className={styles.cliCorner}>┌</span>
        <span className={styles.cliSectionLabel}>{title}</span>
      </div>
      <div className={styles.cliSectionBody}>
        {children}
      </div>
      <div className={styles.cliSectionEnd}>
        <span className={styles.cliCorner}>└</span>
      </div>
    </div>
  );
}

function CliPrompt({ label, value }) {
  return (
    <div className={styles.cliPromptRow}>
      <span className={styles.cliDiamond}>◇</span>
      <span className={styles.cliLabel}>{label}</span>
      {value && <span className={styles.cliValue}>{value}</span>}
    </div>
  );
}

function CliInfo({ children }) {
  return (
    <div className={styles.cliInfoRow}>
      <span className={styles.cliDiamond} style={{ opacity: 0 }}>◇</span>
      <span className={styles.cliInfo}>{children}</span>
    </div>
  );
}

function CliJson({ children }) {
  return (
    <div className={styles.cliJsonRow}>
      <span className={styles.cliPipe}>│</span>
      <pre className={styles.cliJsonPre}>{children}</pre>
    </div>
  );
}

function CliResult({ title, children }) {
  return (
    <div className={styles.cliResultBlock}>
      <div className={styles.cliResultHeader}>
        <span className={styles.cliDiamond}>◇</span>
        <span className={styles.cliResultTitle}>{title}</span>
      </div>
      <div className={styles.cliResultBody}>
        {children}
      </div>
    </div>
  );
}

function CliResultRow({ label, value }) {
  return (
    <div className={styles.cliResultRow}>
      <span className={styles.cliResultLabel}>{label}</span>
      <span className={styles.cliResultValue}>{value}</span>
    </div>
  );
}

function Line({ n, children }) {
  return (
    <div className={styles.line}>
      <span className={styles.ln}>{n}</span>
      {children}
    </div>
  );
}
function Kw({ children }) { return <span className={styles.kw}>{children}</span>; }
function Fn({ children }) { return <span className={styles.fn}>{children}</span>; }
function Str({ children }) { return <span className={styles.str}>{children}</span>; }
function Op({ children }) { return <span className={styles.op}>{children}</span>; }
function Cm({ children }) { return <span className={styles.cm}>{children}</span>; }
function Prop({ children }) { return <span className={styles.prop}>{children}</span>; }
function Cursor() { return <span className={styles.cursor} />; }

export default function CodeBox() {
  const [active, setActive] = useState('commit');
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(PLAIN[active]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        <div className={styles.dots}>
          <div className={styles.dot} style={{ background: '#ff5f56' }} />
          <div className={styles.dot} style={{ background: '#ffbd2e' }} />
          <div className={styles.dot} style={{ background: '#27c93f' }} />
        </div>
        <div className={styles.tabs}>
          {TABS.map(t => (
            <button
              key={t}
              className={`${styles.tab} ${active === t ? styles.tabActive : ''}`}
              onClick={() => setActive(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <button className={styles.copy} onClick={handleCopy}>
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <div className={styles.code}>
        {CODE[active]}
      </div>
    </div>
  );
}
