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
})
