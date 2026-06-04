import { useState } from 'react';
import styles from './CodeBox.module.css';

const TABS = ['publish', 'consume', 'schema'];

const PLAIN = {
  publish: `
import { Fangorn, FangornConfig } from '@fangorn-network/sdk';
const fangorn = await Fangorn.create({
  privateKey: '0x...',
  storage: { pinata: { jwt: '...', gateway: 'https://...' } },
  encryption: { lit: true },
  config: FangornConfig.ArbitrumSepolia,
});
await fangorn.publisher.upload({
  records: [{
    name: \`track-\${Date.now()}\`,
    fields: {
      title: 'Track One',
      artist: 'Alice',
      audio: { data: audioBytes, fileType: 'audio/mp3' },
    },
  }],
  schemaName: 'fangorn.music.demo.v0',
  gateway: 'https://...',
}, 1n);
  `,
  consume: `
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import { FangornX402Middleware } from '@fangorn-network/fetch';
import { FangornConfig } from '@fangorn-network/sdk';
const walletClient = createWalletClient({
  account: privateKeyToAccount('0x...'),
  chain: arbitrumSepolia,
  transport: http(FangornConfig.ArbitrumSepolia.rpcUrl),
});
const middleware = await FangornX402Middleware.create({
  walletClient,
  config: FangornConfig.ArbitrumSepolia,
  usdcContractAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  usdcDomainName: 'USD Coin',
  facilitatorAddress: '0x147c24c5Ea2f1EE1ac42AD16820De23bBba45Ef6',
  domain: 'localhost',
});
const result = await middleware.fetchResource({
  owner: '0x147c24c5Ea2f1EE1ac42AD16820De23bBba45Ef6',
  schemaName: 'fangorn.music.demo.v0',
  name: 'test',
  baseUrl: 'https://facilitator.fangorn.network',
});
console.log(JSON.stringify(result))
  `,
  schema: `fangorn init
fangorn schema register my.schema.v0`,
};

const CODE = {
  publish: (
    <pre>
      <Line n={1}><Kw>import</Kw> <Op>{'{'}</Op> <Fn>Fangorn</Fn><Op>,</Op> <Fn>FangornConfig</Fn> <Op>{'}'}</Op> <Kw>from</Kw> <Str>'@fangorn-network/sdk'</Str><Op>;</Op></Line>
      <Line n={2} />
      <Line n={3}><Kw>const</Kw> <Fn>fangorn</Fn> <Op>=</Op> <Kw>await</Kw> <Fn>Fangorn</Fn><Op>.</Op><Fn>create</Fn><Op>{'({'}</Op></Line>
      <Line n={4}>&nbsp;&nbsp;<Prop>walletClient</Prop><Op>,</Op></Line>
      <Line n={5}>&nbsp;&nbsp;<Prop>storage</Prop><Op>:</Op> <Op>{'{'}</Op> <Prop>pinata</Prop><Op>:</Op> <Op>{'{'}</Op> <Prop>jwt</Prop><Op>:</Op> <Str>'...'</Str><Op>,</Op> <Prop>gateway</Prop><Op>:</Op> <Str>'...'</Str> <Op>{'}'}</Op> <Op>{'}'}</Op><Op>,</Op></Line>
      <Line n={6}>&nbsp;&nbsp;<Prop>encryption</Prop><Op>:</Op> <Op>{'{'}</Op> <Prop>lit</Prop><Op>:</Op> <Kw>true</Kw> <Op>{'}'}</Op><Op>,</Op></Line>
      <Line n={7}>&nbsp;&nbsp;<Prop>config</Prop><Op>:</Op> <Fn>FangornConfig</Fn><Op>.</Op><Fn>ArbitrumSepolia</Fn><Op>,</Op></Line>
      <Line n={8}><Op>{'}'}</Op><Op>);</Op></Line>
      <Line n={9} />
      <Line n={10}><Kw>await</Kw> <Fn>fangorn</Fn><Op>.</Op><Fn>publisher</Fn><Op>.</Op><Fn>upload</Fn><Op>{'({'}</Op></Line>
      <Line n={11}>&nbsp;&nbsp;<Prop>records</Prop><Op>:</Op> <Op>[{'{'}</Op></Line>
      <Line n={12}>&nbsp;&nbsp;&nbsp;&nbsp;<Prop>name</Prop><Op>:</Op> <Str>{`\`track-\${Date.now()}\``}</Str><Op>,</Op></Line>
      <Line n={13}>&nbsp;&nbsp;&nbsp;&nbsp;<Prop>fields</Prop><Op>:</Op> <Op>{'{'}</Op></Line>
      <Line n={14}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<Prop>title</Prop><Op>:</Op> <Str>'Track One'</Str><Op>,</Op></Line>
      <Line n={15}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<Prop>artist</Prop><Op>:</Op> <Str>'Alice'</Str><Op>,</Op></Line>
      <Line n={16}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<Prop>audio</Prop><Op>:</Op> <Op>{'{'}</Op> <Prop>data</Prop><Op>:</Op> <Fn>audioBytes</Fn><Op>,</Op> <Prop>fileType</Prop><Op>:</Op> <Str>'audio/mp3'</Str> <Op>{'}'}</Op><Op>,</Op> <Cm>{'// encrypted at rest'}</Cm></Line>
      <Line n={17}>&nbsp;&nbsp;&nbsp;&nbsp;<Op>{'}'}</Op><Op>,</Op></Line>
      <Line n={18}>&nbsp;&nbsp;<Op>{'}'}</Op><Op>],</Op></Line>
      <Line n={19}>&nbsp;&nbsp;<Prop>schemaName</Prop><Op>:</Op> <Str>'fangorn.music.demo.v0'</Str><Op>,</Op></Line>
      <Line n={20}>&nbsp;&nbsp;<Prop>gateway</Prop><Op>:</Op> <Str>'https://ipfs.io'</Str><Op>,</Op></Line>
      <Line n={21}><Op>{'}'}</Op><Op>,</Op> <Num>1n</Num><Op>);</Op> <Cm>{'// price in USDC, buyers pay this to unlock'}</Cm><Cursor /></Line>
    </pre>
  ),
  consume: (
    <pre>
      <Line n={1}><Kw>import</Kw> <Op>{'{'}</Op> <Fn>createWalletClient</Fn><Op>,</Op> <Fn>http</Fn> <Op>{'}'}</Op> <Kw>from</Kw> <Str>'viem'</Str><Op>;</Op></Line>
      <Line n={2}><Kw>import</Kw> <Op>{'{'}</Op> <Fn>privateKeyToAccount</Fn> <Op>{'}'}</Op> <Kw>from</Kw> <Str>'viem/accounts'</Str><Op>;</Op></Line>
      <Line n={3}><Kw>import</Kw> <Op>{'{'}</Op> <Fn>arbitrumSepolia</Fn> <Op>{'}'}</Op> <Kw>from</Kw> <Str>'viem/chains'</Str><Op>;</Op></Line>
      <Line n={4}><Kw>import</Kw> <Op>{'{'}</Op> <Fn>FangornX402Middleware</Fn> <Op>{'}'}</Op> <Kw>from</Kw> <Str>'@fangorn-network/fetch'</Str><Op>;</Op></Line>
      <Line n={5}><Kw>import</Kw> <Op>{'{'}</Op> <Fn>FangornConfig</Fn> <Op>{'}'}</Op> <Kw>from</Kw> <Str>'@fangorn-network/sdk'</Str><Op>;</Op></Line>
      <Line n={6} />
      <Line n={7}><Kw>const</Kw> <Fn>walletClient</Fn> <Op>=</Op> <Fn>createWalletClient</Fn><Op>{'({'}</Op></Line>
      <Line n={8}>&nbsp;&nbsp;<Prop>account</Prop><Op>:</Op> <Fn>privateKeyToAccount</Fn><Op>(</Op><Str>'0x...'</Str><Op>),</Op></Line>
      <Line n={9}>&nbsp;&nbsp;<Prop>chain</Prop><Op>:</Op> <Fn>arbitrumSepolia</Fn><Op>,</Op></Line>
      <Line n={10}>&nbsp;&nbsp;<Prop>transport</Prop><Op>:</Op> <Fn>http</Fn><Op>(</Op><Fn>FangornConfig</Fn><Op>.</Op><Fn>ArbitrumSepolia</Fn><Op>.</Op><Prop>rpcUrl</Prop><Op>),</Op></Line>
      <Line n={11}><Op>{'}'}</Op><Op>);</Op></Line>
      <Line n={12} />
      <Line n={13}><Kw>const</Kw> <Fn>middleware</Fn> <Op>=</Op> <Kw>await</Kw> <Fn>FangornX402Middleware</Fn><Op>.</Op><Fn>create</Fn><Op>{'({'}</Op></Line>
      <Line n={14}>&nbsp;&nbsp;<Prop>walletClient</Prop><Op>,</Op></Line>
      <Line n={15}>&nbsp;&nbsp;<Prop>config</Prop><Op>:</Op> <Fn>FangornConfig</Fn><Op>.</Op><Fn>ArbitrumSepolia</Fn><Op>,</Op></Line>
      <Line n={16}>&nbsp;&nbsp;<Prop>usdcContractAddress</Prop><Op>:</Op> <Str>'0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'</Str><Op>,</Op></Line>
      <Line n={17}>&nbsp;&nbsp;<Prop>usdcDomainName</Prop><Op>:</Op> <Str>'USD Coin'</Str><Op>,</Op></Line>
      <Line n={18}>&nbsp;&nbsp;<Prop>facilitatorAddress</Prop><Op>:</Op> <Str>'0x147c24c5Ea2f1EE1ac42AD16820De23bBba45Ef6'</Str><Op>,</Op></Line>
      <Line n={19}>&nbsp;&nbsp;<Prop>domain</Prop><Op>:</Op> <Str>'localhost'</Str><Op>,</Op></Line>
      <Line n={20}><Op>{'}'}</Op><Op>);</Op></Line>
      <Line n={21} />
      <Line n={22}><Kw>const</Kw> <Fn>result</Fn> <Op>=</Op> <Kw>await</Kw> <Fn>middleware</Fn><Op>.</Op><Fn>fetchResource</Fn><Op>{'({'}</Op> <Cm>{'// pays on-chain, decrypts locally'}</Cm></Line>
      <Line n={23}>&nbsp;&nbsp;<Prop>owner</Prop><Op>:</Op> <Str>'0x147c24c5Ea2f1EE1ac42AD16820De23bBba45Ef6'</Str><Op>,</Op></Line>
      <Line n={24}>&nbsp;&nbsp;<Prop>schemaName</Prop><Op>:</Op> <Str>'fangorn.music.demo.v0'</Str><Op>,</Op></Line>
      <Line n={25}>&nbsp;&nbsp;<Prop>name</Prop><Op>:</Op> <Str>'test'</Str><Op>,</Op></Line>
      <Line n={26}>&nbsp;&nbsp;<Prop>baseUrl</Prop><Op>:</Op> <Str>'https://facilitator.fangorn.network'</Str><Op>,</Op></Line>
      <Line n={27}><Op>{'}'}</Op><Op>);</Op></Line>
      <Line n={28} />
      <Line n={29}><Fn>console</Fn><Op>.</Op><Fn>log</Fn><Op>(</Op><Fn>JSON</Fn><Op>.</Op><Fn>stringify</Fn><Op>(</Op><Fn>result</Fn><Op>));</Op> <Cm>{'// { success, data: decrypted fields }'}</Cm><Cursor /></Line>
    </pre>
  ),
  schema: (
    <div className={styles.cli}>
      <CliLine prompt>npm i -g @fangorn-network/sdk</CliLine>
      <CliLine prompt>fangorn init</CliLine>
      <CliLine prompt>fangorn schema register my.schema.v0</CliLine>
      <CliBlank />
      <CliSection title="Chain selection">
        <CliPrompt label="Pick your chain." value="Arbitrum Sepolia" />
        <CliInfo>Selected chain: Arbitrum Sepolia</CliInfo>
      </CliSection>
      <CliBlank />
      <CliSection title="Schema Registration">
        <CliPrompt label="Path to your JSON schema file:" value="./schema.json" />
        <CliPrompt label="Schema definition:" value={null} />
        <CliJson>{`{
  "title":  { "@type": "string" },
  "artist": { "@type": "string" },
  "audio":  { "@type": "encrypted", "gadget": "settled" }
}`}</CliJson>
        <CliPrompt label="Register this schema?" value="Yes" />
      </CliSection>
      <CliBlank />
      <CliResult>
        <CliResultRow label="Schema ID:" value="0x79e4f0361e5c1ebe1cbe8e88d6a29729...805fb0d" />
        <CliResultRow label="CID:" value="bafkreibiopernk7njq3dobvl77by6nsheihcigh3nrr77ifm5gr23ttwv4" />
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

function CliResult({ children }) {
  return (
    <div className={styles.cliResultBlock}>
      <div className={styles.cliResultHeader}>
        <span className={styles.cliDiamond}>◇</span>
        <span className={styles.cliResultTitle}>Schema registered</span>
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
function Num({ children }) { return <span className={styles.num}>{children}</span>; }
function Cursor() { return <span className={styles.cursor} />; }

export default function CodeBox() {
  const [active, setActive] = useState('publish');
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