// Minimal ABI for the SubscriptionRegistry Stylus contract — just what the website
// needs to read and pay a subscription. Subscription lives here, not in the SDK.
// Stylus exposes the Rust snake_case methods as camelCase.
export const SUBSCRIPTION_ABI = [
  {
    inputs: [],
    name: 'subscribe',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'publisher', type: 'address' }],
    name: 'subscribedAt',
    outputs: [{ internalType: 'uint64', name: '', type: 'uint64' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'publisher', type: 'address' }],
    name: 'access',
    outputs: [
      { internalType: 'bool', name: '', type: 'bool' },
      { internalType: 'uint64', name: '', type: 'uint64' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'subscriptionFee',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'usdc',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];
