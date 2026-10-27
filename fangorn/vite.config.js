import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The SDK reads `process.env` in two places a browser reaches, so merely importing it
// throws "process is not defined" before any of our code runs. `lib/fangorn.js` pulls in
// the storage providers unconditionally, so deep-importing does not avoid it.
//
// Replaced surgically rather than defining `process.env` wholesale: that would also
// rewrite `process.env.NODE_ENV`, which Vite and React rely on for the dev/prod split.
//
//   PINATA_UPLOAD_RETRIES — module scope in lib/providers/storage/utils.js.
//     `Number(undefined ?? 6)` keeps the SDK's own default of 6.
//
//   FANGORN_LOG_WINDOW — read by the SDK's getLogsInWindows. `undefined` keeps each
//     network's own window (AppConfig.logWindow: 10k blocks on Base Sepolia). A fixed
//     value here would override it, and anything past the RPC's cap fails every scan.
const SDK_ENV_SHIM = {
  'process.env.PINATA_UPLOAD_RETRIES': 'undefined',
  'process.env.FANGORN_LOG_WINDOW': 'undefined',
}

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

  // The shim is needed in BOTH places. `define` covers the build; the dev-server
  // dependency pre-bundle is a separate pass that `define` does not reach, and it is
  // where the error actually surfaces.
  //
  // Vite 8 warns that `optimizeDeps.esbuildOptions` is deprecated in favour of
  // `optimizeDeps.rolldownOptions`. Do not take that suggestion yet: measured on
  // v8.0.16 against a cold `node_modules/.vite`, `rolldownOptions.define` is silently
  // ignored and the dep chunk keeps its bare `process.env`, while `esbuildOptions`
  // still substitutes correctly. Re-test on the next Vite major before switching —
  // and re-test by grepping the built chunk, not by trusting the absence of a warning.
  define: SDK_ENV_SHIM,
  optimizeDeps: {
    esbuildOptions: { define: SDK_ENV_SHIM },
  },
})
