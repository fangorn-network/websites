// Paying an x402 "exact" requirement in USDC from the browser: the wallet signs an EIP-3009 transferWithAuthorization
// for exactly the amount, and the payload goes back as the X-PAYMENT header. The facilitator submits it, so the payer
// needs USDC but no ETH. Used by the deploy page (worker/deploy.js answers 402 with the requirement).
import { createWalletClient, custom, erc20Abi, createPublicClient, http, toHex } from 'viem';
import { base, baseSepolia } from 'viem/chains';

export const CHAINS = { base, 'base-sepolia': baseSepolia };
const AUTH = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' },
  ],
};

/** `address`'s USDC (base units) on the requirement's network. */
export async function usdcOf(req, address) {
  const client = createPublicClient({ chain: CHAINS[req.network], transport: http() });
  return client.readContract({ address: req.asset, abi: erc20Abi, functionName: 'balanceOf', args: [address] });
}

/** Sign `req` with the Privy `wallet` (at `address`) → the X-PAYMENT header's value. */
export async function payHeader(wallet, address, req) {
  const chain = CHAINS[req.network];
  if (!chain) throw new Error(`can't pay on ${req.network}`);
  await wallet.switchChain(chain.id);
  const wc = createWalletClient({ account: address, chain, transport: custom(await wallet.getEthereumProvider()) });
  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from: address, to: req.payTo, value: req.maxAmountRequired,
    validAfter: String(now - 600), validBefore: String(now + req.maxTimeoutSeconds),
    nonce: toHex(crypto.getRandomValues(new Uint8Array(32))),
  };
  const signature = await wc.signTypedData({
    domain: { name: req.extra.name, version: req.extra.version, chainId: chain.id, verifyingContract: req.asset },
    types: AUTH, primaryType: 'TransferWithAuthorization',
    message: { ...authorization, value: BigInt(authorization.value), validAfter: BigInt(authorization.validAfter), validBefore: BigInt(authorization.validBefore) },
  });
  return btoa(JSON.stringify({ x402Version: 1, scheme: req.scheme, network: req.network, payload: { signature, authorization } }));
}
