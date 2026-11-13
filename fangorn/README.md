# Fangorn Website

https://fangorn.network

Account management on Base Sepolia (the SDK's `BaseSepoliaConfig`): fund a wallet,
create apps (claiming one pays its storage subscription), renew them and bind their
agent cards, and hand the same wallet to the CLI. Configuration is `VITE_`-prefixed env in
`.env.local` — see `.env.local.example` for every variable and what reads it.

> Vite inlines `VITE_*` at **build** time, so changing one needs a rebuild and
> redeploy, not just a restart. Production env lives with the host, not in this repo.

### Checks

``` sh
pnpm build
node src/fangorn.test.mjs   # network is Base, app token id ↔ app id, meter clamping
```

## Letting apps publish for people (`#/connect`, `worker/`)

An app (the slop store, any other) sends people to `#/connect?app=…&repos=…`. They sign in, allow it, and get a
token for the app. The app sends updates to `/api/sign` with that token; the Worker checks the repo and address and
signs with the person's wallet through Privy. Set up once, for Fangorn; apps need nothing.

Four values, all from the Privy dashboard. None of them is a wallet key.

| Privy dashboard | Name here | Where |
|---|---|---|
| App settings → API keys → **App ID** | `VITE_PRIVY_APP_ID` / `PRIVY_APP_ID` | `.env` / `wrangler.jsonc` vars (already set) |
| App settings → API keys → **App secret** | `PRIVY_APP_SECRET` | `npx wrangler secret put PRIVY_APP_SECRET` |
| Authorization keys → Create new key → **id** | `VITE_FANGORN_SIGNER_ID` | `.env` |
| Authorization keys → Create new key → **private key** (`wallet-auth:…`) | `PRIVY_PRIVATE_KEY` | `npx wrangler secret put PRIVY_PRIVATE_KEY` |

Optional: Policies → a policy allowing only `eth_signTypedData_v4` with domain `chainId` 84532 and
`verifyingContract` = the Data Registry; its id goes in `.env` as `VITE_FANGORN_SIGNER_POLICY_ID`.

Then `npx vite build && npx wrangler deploy` (it creates the `GRANTS` KV namespace on the first deploy).
