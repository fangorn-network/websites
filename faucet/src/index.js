// Testnet faucet: drips 0.05 ETH + 10 USDC on Arbitrum Sepolia, once per address
// per 24h, so a publisher can afford the DataRegistry registration fee and its
// gas. The funded key lives in a Worker secret (FAUCET_PRIVATE_KEY) — the only
// reason this exists as a server instead of client code.
import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  isAddress,
  parseEther,
  erc20Abi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';

const ETH_DRIP = parseEther('0.05');
const USDC_DRIP = 10_000_000n; // 10 USDC (6 decimals)
const COOLDOWN_SECS = 86400;

// ponytail: the drain ceiling is the cooldown times whatever you deposit in the
// faucet wallet — anyone can mint fresh addresses and claim. Fund it a few ETH
// at a time. If that stops being enough, verify the caller's Privy access token.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });

// Seconds left on this address's cooldown, or 0 if it can claim now. The KV
// entry expires on its own after COOLDOWN_SECS; the stored timestamp is only
// there so we can tell the UI how long is left.
async function cooldownRemaining(env, address) {
  const last = await env.FAUCET_KV.get(`drip:${address}`);
  if (!last) return 0;
  const elapsed = Math.floor((Date.now() - Number(last)) / 1000);
  return Math.max(0, COOLDOWN_SECS - elapsed);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (!url.pathname.endsWith('/faucet')) return json({ error: 'Not found' }, 404);

    // GET /faucet?address=0x… — eligibility only, drips nothing. Lets the page
    // render the right button state on load.
    if (request.method === 'GET') {
      const address = url.searchParams.get('address');
      if (!isAddress(address ?? '')) return json({ error: 'Invalid address' }, 400);
      const retryAfter = await cooldownRemaining(env, getAddress(address));
      return json({ eligible: retryAfter === 0, retryAfter });
    }

    if (request.method !== 'POST') return json({ error: 'Not found' }, 404);

    const { address } = await request.json().catch(() => ({}));
    if (!isAddress(address ?? '')) return json({ error: 'Invalid address' }, 400);
    const to = getAddress(address);

    const retryAfter = await cooldownRemaining(env, to);
    if (retryAfter > 0) return json({ error: 'Cooldown', retryAfter }, 429);

    // Claim the cooldown slot before sending. Two racing requests can still both
    // read 0 above, but this keeps a mid-flight failure from being retried in a
    // loop — the ETH may already be gone.
    // ponytail: read-then-write, not atomic. A Durable Object would close the
    // race if double-drips show up in practice.
    await env.FAUCET_KV.put(`drip:${to}`, String(Date.now()), { expirationTtl: COOLDOWN_SECS });

    const transport = http(env.ARBITRUM_SEPOLIA_RPC);
    const publicClient = createPublicClient({ chain: arbitrumSepolia, transport });
    const account = privateKeyToAccount(env.FAUCET_PRIVATE_KEY);
    const wallet = createWalletClient({ account, chain: arbitrumSepolia, transport });

    // Both txs come from one account, so assign nonces explicitly rather than
    // letting each send race the node's pending count.
    let nonce = await publicClient.getTransactionCount({
      address: account.address,
      blockTag: 'pending',
    });

    const eth = await wallet.sendTransaction({ to, value: ETH_DRIP, nonce: nonce++ });
    const usdc = await wallet.writeContract({
      address: getAddress(env.USDC_ADDRESS),
      abi: erc20Abi,
      functionName: 'transfer',
      args: [to, USDC_DRIP],
      nonce: nonce++,
    });

    // Wait for inclusion — the caller reads its balance right after this returns.
    await Promise.all(
      [eth, usdc].map((hash) => publicClient.waitForTransactionReceipt({ hash })),
    );

    return json({ dripped: true, eth, usdc, retryAfter: COOLDOWN_SECS });
  },
};
