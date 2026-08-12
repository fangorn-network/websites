# Fangorn Website

https://fangorn.network

Account management: fund a wallet, register as a publisher, subscribe to storage, and
ask Quickbeam to watch a namespace. Configuration is `VITE_`-prefixed env in
`.env.local` — see `.env.local.example` for every variable and what reads it.

> Vite inlines `VITE_*` at **build** time, so changing one needs a rebuild and
> redeploy, not just a restart. Production env lives with the host, not in this repo.

### The Faucet Worker

The website allows for a cloudflare worker to be deployed so that it can act as a faucet for new publishers.

``` sh
# paste id into wrangler.toml
cd websites/faucet && npx wrangler kv namespace create FAUCET_KV
npx wrangler secret put FAUCET_PRIVATE_KEY
npx wrangler deploy
```

### The Quickbeam Registry Worker

The Quickbeam panel POSTs to `webworker/quickbeam-registry`, which gates on the
wallet's storage subscription and records the namespace for a shared Quickbeam
instance to pick up. The same worker proxies `/q/search`, so the browser reaches the
instance over HTTPS without any per-namespace DNS or certificate.

``` sh
cd webworker/quickbeam-registry
npx wrangler kv namespace create QUICKBEAM_KV  # paste the id into wrangler.toml
# set SEARCH_URL / CDN_URL to the instance, and ADMIN_WALLETS to the wallets
# allowed to tear a view down
npx wrangler deploy
```

Then point the site at it with `VITE_QUICKBEAM_WORKER_URL`. The full deploy order —
worker, instance, then this app — is
[`quickbeam/DEPLOYMENT.md`](../../quickbeam/DEPLOYMENT.md); building and running the
stack itself is `quickbeam/DOCKER-README.md`.

### The publisher directory

Reached from **Browse publishers** in the Quickbeam panel, which opens a modal (a
native `<dialog>`, so the focus trap, Esc and backdrop come from the platform). Search
filters on address *or* namespace name, each publisher expands to its namespaces, and
picking one fills the form and closes the modal.

It mounts on first open and stays mounted: the name pass below costs ~12s of gateway
fetches and reopening should not pay it twice. Nothing loads until you open it, so the
dashboard does no IPFS work on page load.

`src/directory.js` lists everyone who has committed to this app and what they named
their namespaces, in two passes with very different costs:

1. **Chain pass** — one `getStateCommittedLogs` over the whole app, deduped to the
   latest commit per timeline. Every publisher, instantly, no IPFS and no wallet.
2. **Name pass** — the event carries `subspaceId` (keccak of the name), never the
   name, so each one is recovered with `engine.namespaceOf(root)`: two gateway fetches
   apiece. Runs six at a time in the background and fills the table in as names land.

Measured against the live registry: 40 namespaces across 5 publishers, all 40 names
resolved, 11.8s for the whole fill. A name that never resolves keeps its hash and the
chip is not clickable — usually an orphaned head, not a bug.

This is why `VITE_IPFS_GATEWAY` matters: on the SDK's `ipfs.io` default the same run
resolved **0 of 40**.

> `directory.js` is the one place that imports the SDK's package **root** rather than a
> built path, which is why `vite.config.js` carries a `define` shim for
> `process.env.PINATA_UPLOAD_RETRIES` — the SDK reads it at module scope and a browser
> has no `process`. Remove the shim and the app dies on load.

### Checks

``` sh
pnpm build
node src/fangorn.test.mjs   # ABI selectors, digest↔CID round trip, meter clamping
```
