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
