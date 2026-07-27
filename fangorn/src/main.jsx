import { Buffer } from 'buffer';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// The Fangorn SDK's engine reconstructs commit CIDs with node's Buffer
// (hexToRootCid). Browsers have no global Buffer, so shim it before any import
// that touches the engine runs.
globalThis.Buffer ??= Buffer;
import { PrivyProvider } from '@privy-io/react-auth';
import './index.css';
import App from './App.jsx';
import { PrivyAuthBridge, DisabledAuthProvider } from './auth.jsx';
import { arbitrumSepolia } from 'viem/chains';

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID;

if (!privyAppId) {
  console.warn(
    'VITE_PRIVY_APP_ID is not set. Login is disabled until you add it to .env.local ' +
    '(create an app at https://dashboard.privy.io).',
  );
}

// Privy throws if instantiated without an app ID, so only wrap the tree when it
// is configured. The marketing site still renders fully without it — login just
// stays disabled.
const tree = privyAppId ? (
  <PrivyProvider
    appId={privyAppId}
    config={{
      appearance: {
        theme: 'dark',
        accentColor: '#a78bfa',
        logo: '/favicon.svg',
      },
      defaultChain: arbitrumSepolia,
      embeddedWallets: {
        ethereum: { createOnLogin: 'off' },
      },
      loginMethods: ['email', 'wallet'],
      supportedChains: [arbitrumSepolia]
    }}
  >
    <PrivyAuthBridge>
      <App />
    </PrivyAuthBridge>
  </PrivyProvider>
) : (
  <DisabledAuthProvider>
    <App />
  </DisabledAuthProvider>
);

createRoot(document.getElementById('root')).render(
  <StrictMode>{tree}</StrictMode>,
);
