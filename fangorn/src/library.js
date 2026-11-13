// The buyer's side: buying a record from the browser, and the library of what a wallet has bought.
//
// Buying is westmarch's buyRecord, the same flow fangorn-mcp's `buy` runs: the explorer quotes
// the record over x402, the wallet signs a USDC authorization for exactly the price, Barliman
// registers and settles it (the buyer pays no gas), and the key server opens the sealed fields.
// The balance is the wallet's own USDC; topping up is Privy's fund flow on the account page.
import { parseAbiItem } from 'viem';
import { repoId } from '@fangorn-network/sdk/lib/contracts/data-registry/index.js';
import { recordKey, subjectOf, WHOLE_REPO } from '@fangorn-network/sdk/lib/contracts/settlement-registry/index.js';
import { NETWORK, publicClient, walletClientFor } from './fangorn.js';
import { blockTime, reader, readRepos, scan, toListing } from './account.js';

// ponytail: the old explorer still quotes paid records (x402); the one thing left on it. Keep it running until
// quotes move here (a /api/paid route), or buying stops.
const EXPLORER_URL = import.meta.env?.VITE_EXPLORER_URL || 'https://explorer.fangorn.network';

const IDENTITY_MESSAGE = 'fangorn:identity:v1';
const SETTLED = parseAbiItem('event Settled(bytes32 indexed subject, uint256 indexed nullifier, address reader)');
const REGISTERED = parseAbiItem('event Registered(bytes32 indexed subject, address indexed publisher, address indexed referrer, uint256 commitment, uint256 price, uint256 referrer_cut)');

// The identity signature, per wallet, so one session asks for it once (buying and the library
// both derive the reading account from it).
// ponytail: in memory only, a reload asks again. Never persisted: it is the reading key.
const identitySigs = new Map();

/** Whether this session already holds `address`'s identity signature: the library opens without asking. */
export const hasIdentity = (address) => identitySigs.has(String(address).toLowerCase());

/** The Privy wallet as the viem-style account buyRecord signs with. */
async function buyerAccount(wallet, address) {
  const wc = await walletClientFor(wallet, address);
  const key = wc.account.address.toLowerCase();
  return {
    address: wc.account.address,
    signMessage: (a) => {
      if (a.message !== IDENTITY_MESSAGE) return wc.signMessage(a);
      if (!identitySigs.has(key)) identitySigs.set(key, wc.signMessage(a).catch((e) => { identitySigs.delete(key); throw e; }));
      return identitySigs.get(key);
    },
    signTypedData: (a) => wc.signTypedData(a),
  };
}

// The x402 client pulls the SDK root and Semaphore's prover: load it on the first buy only.
// ponytail: westmarch ≤2026.11.4-dev reads process.argv[1] on import, and a dependency here
// defines a `process` with no argv. Fixed in westmarch's source; drop this once it's republished.
const x402 = () => {
  if (globalThis.process && !globalThis.process.argv) globalThis.process.argv = [];
  return import('@fangorn-network/westmarch/x402');
};

export const quoteUrl = (publisher, repo, id) =>
  `${EXPLORER_URL}/paid/${encodeURIComponent(publisher)}/${encodeURIComponent(repo)}/${encodeURIComponent(id)}`;

/**
 * Buy one record (or open one already bought: that pays nothing) → { fields, price, tx }.
 * `maxPrice` is the price the page showed, in USDC base units: a quote above it is refused
 * before anything is signed.
 */
export async function buy(wallet, address, { publisher, repo, id, maxPrice }) {
  const [{ buyRecord }, account, fangorn] = await Promise.all([x402(), buyerAccount(wallet, address), reader(address)]);
  return buyRecord(quoteUrl(publisher, repo, id), { account, fangorn, maxPrice });
}

/**
 * What `address` has bought: [{ publisher, repo, id, title, price, at }], newest first (`at` unix seconds). A whole-repo
 * purchase is one entry with id null. Asks the wallet for the identity signature (nothing is paid).
 *
 * Purchases are settled to a reading account derived from that signature, never the paying
 * wallet, so this is the only way to list them: Settled logs to our reader, then each subject
 * matched against its publisher's records.
 * ponytail: full log scans, then every repo of each publisher read once; an indexer is the upgrade.
 */
export async function readLibrary(wallet, address) {
  const { identityOf } = await x402();
  const { reader: me } = await identityOf(await buyerAccount(wallet, address));
  const registry = NETWORK.settlementRegistryContractAddress;
  const [settled, head] = await Promise.all([scan(registry, SETTLED), publicClient.getBlock()]);
  const mine = settled.filter((l) => l.args.reader.toLowerCase() === me.address.toLowerCase()).reverse();
  if (!mine.length) return [];
  const subjects = [...new Set(mine.map((l) => l.args.subject))];
  const atOf = new Map(mine.map((l) => [l.args.subject, blockTime(head, l.blockNumber)]).reverse());
  const registered = await scan(registry, REGISTERED, { subject: subjects });
  const publisherOf = new Map(registered.map((l) => [l.args.subject, l.args.publisher]));
  const priceOf = new Map(registered.map((l) => [l.args.subject, l.args.price]));

  const found = new Map();
  const client = await reader(address);
  for (const publisher of new Set(publisherOf.values())) {
    for (const { repo } of await readRepos(publisher)) {
      const rid = repoId(repo);
      const whole = subjectOf(publisher, rid, WHOLE_REPO);
      if (subjects.includes(whole)) found.set(whole, { publisher, repo, id: null, title: repo });
      const { contents } = await client.readRepo(publisher, repo);
      for (const r of contents.records) {
        const s = subjectOf(publisher, rid, recordKey(r.id));
        if (subjects.includes(s)) found.set(s, { publisher, repo, id: r.id, title: toListing(r).title });
      }
    }
  }
  return subjects.filter((s) => found.has(s)).map((s) => ({ ...found.get(s), price: priceOf.get(s) ?? null, at: atOf.get(s) }));
}
