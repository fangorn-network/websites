import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The Fangorn SDK is a file:-linked sibling with its own node_modules. Dedupe
  // the packages we also depend on so the app and the SDK share ONE copy —
  // otherwise the viem clients we pass in and the CIDs the engine builds cross
  // a version boundary and misbehave.
  resolve: {
    dedupe: ['viem', 'multiformats', '@ipld/dag-cbor', '@ipld/car'],
  },

  // The SDK reads `process.env.PINATA_UPLOAD_RETRIES` at MODULE SCOPE
  // (lib/providers/storage/utils.js), so merely importing it in a browser throws
  // "process is not defined" before any of our code runs. `lib/fangorn.js` pulls in
  // the storage providers unconditionally, so deep-importing does not avoid it.
  //
  // Replaced surgically rather than defining `process.env` wholesale: that would also
  // rewrite `process.env.NODE_ENV`, which Vite and React rely on for the dev/prod
  // split. `Number(undefined ?? 6)` keeps the SDK's own default of 6.
  //
  // Needed in BOTH places — `define` covers the build, `optimizeDeps.esbuildOptions`
  // covers the dev-server pre-bundle, which is where the error actually surfaced.
  define: {
    'process.env.PINATA_UPLOAD_RETRIES': 'undefined',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: { 'process.env.PINATA_UPLOAD_RETRIES': 'undefined' },
    },
  },
})
