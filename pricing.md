# Pricing hosted apps

A hosted app is a westmarch Worker deployed from the ops repo
([fangorn-network/ops](https://github.com/fangorn-network/ops)): a Worker with a cron every minute, a D1 index, Workers
AI embeddings, and a gas wallet. Anyone can request one at `fangorn.network/#/deploy`. The request becomes a pull
request adding `apps/<name>.json`, and merging it deploys the app.

The model is in `fangorn/src/pricing.js`. The page and `/api/deploy` both use it, and the worker prices every request
again instead of trusting the page.

## Summary (2026-11-24)

Until now only we could deploy a hosted app, by opening a PR in the ops repo by hand. Now anyone can do it themselves:

- A two-step form on fangorn.network gives a live price.
- Paid apps pay in USDC from their Fangorn wallet. People without crypto top up with a card through Privy.
- The request becomes a pull request in the ops repo, and merging it deploys the app.

Decisions:

1. **Price from cost.** Each item is priced at its cost times a markup, plus a flat platform fee once an app is past
   the free tier. Gas is a deposit into the app's own wallet, not revenue.
2. **Testnet is not free.** Cloudflare bills the same on both networks. Only gas is free on testnet.
3. **We don't ask for index size.** Nobody knows it up front and it keeps growing, so the quote estimates it from new
   records a day.
4. **USDC first, no Stripe, no KYC.** A wallet isn't an identity, so instead of checking who people are, a free app
   gives out nothing worth farming (no gas, no uploads on mainnet), and the number of free apps is capped fleet-wide.
   Honest operators never see a KYC step.

The code is uncommitted on `feat/app-grants`; see [Status](#status) and [Next steps](#next-steps).

## What an app costs us

Measured or list prices, as if Cloudflare's account-wide allowances were already used up. All of them are editable
in `ASSUME`.

| Driver | Cost | Notes |
|---|---|---|
| Gas for relayed publishes (`publishPerDay`) | ~$0.004–0.006 each on Base | A relayed `updateBySig` is ~160k gas cold (DataRegistry gas report). Base's base fee was 0.005 gwei on 2026-11-24. The model uses 0.01 gwei for headroom. |
| Publishing the view (`publishView`) | One transaction per new root | Up to 1,440 a day, so up to ~$130/mo on mainnet. westmarch doesn't throttle it yet. |
| Search | searches × index size | Semantic search reads every vector in D1. With 200k records, 3k searches a day is ~$18/mo at list price. |
| Indexing new records | ~$0.008 per 1k | Embedding plus D1 writes. |
| Index storage (D1) | $0.75/GB-mo | ~2 KB a record. |
| File storage | $0.02/GB-mo | Pinata, $20 for 1 TB. Uploads are permanent. |
| Watching the chain | ~$0 | One log read a minute per followed repo, on publicnode. That's free but rate-limited, and gets expensive on a paid RPC. |

Index size isn't asked for, because nobody knows it up front and it keeps growing. The quote assumes 90 days of new
records. Once westmarch meters the real size, search and D1 storage should be billed on that.

## Price

- **Free tier.** An app inside every free limit pays nothing.
- **Paid.** Past any free limit: a $9/mo platform fee, plus 3× our cost above the free allowance for each item.
- **Gas is a deposit, not revenue.** Gas for publishes past the free allowance, and for the view, is paid up front
  with a 25% buffer and goes into the app's gas wallet. Unused gas carries over, so a spike in gas prices doesn't
  come out of our margin.
- **Testnet is not free.** Cloudflare bills the same on both networks, so testnet apps have the same prices and
  limits. Only gas differs: testnet gas is on us.
- **Self-serve caps.** Past 50 follows, 100k new records a day, 200k searches a day, 10k publishes a day, 100 GB, or an
  index past 1M records, the page says "talk to us" instead of giving a price.

## Payment: USDC first

Paid apps pay in USDC on Base over x402 (payAI's facilitator), for 1, 3 or 12 months up front. The payment settles
during the deploy request itself, so it needs no webhook: once it settles, the PR opens. People without crypto top up
their Fangorn wallet with a card through Privy, so the same flow works for both.

Payment is always mainnet USDC, even for a testnet app, because testnet USDC is free.

The app's config records who requested it, its plan, and what it's paid through (`billing` in `apps/<name>.json`).
Expiry, renewal and downgrades are built on that later.

## Free tier without KYC

Asking for a card or an ID per free app adds friction for honest operators. Instead, a free app should hand out
nothing worth stealing, and the total spent on free apps has a hard ceiling. Then a thousand fake accounts get the
attacker nothing.

What a free app could hand out, and what 1000 fake ones would cost:

| Resource | Worth stealing? | 1000 fake apps |
|---|---|---|
| Gas for publishes on mainnet | Yes: real ETH spent on their behalf | ~$1,900/mo |
| File storage | Yes: free, permanent file hosting | 1 TB, permanent |
| An index and search over repos already on Fangorn | No: the global index already serves this, and the publishers paid for the storage | ~$1–3 each |

So:

1. **A free mainnet app is a read-only index.** It gets no gas and no uploads. It can follow and search any repos
   already on Fangorn and serve them over MCP. Anything that spends money per action is paid in USDC.
2. **A free testnet app can publish a little.** Gas is free there, so it gets 10 publishes a day and 100 MB of files.
   Testnet storage should be deleted after 90 days.
3. **Idle apps pause.** A free app with no searches for 14 days stops its cron, and the next search wakes it. An
   idle honest app then costs about $0, and an abuser has to keep every app busy. (westmarch, not built yet.)
4. **A fleet-wide cap on free apps,** 50 to start (`FREE_SLOTS`). When it's full, free requests are turned away
   until a slot opens. This puts a fixed ceiling on our worst case (50 × ~$2/mo) whoever is behind the accounts.
5. **Cheap checks on every request:**
   - one pending request per wallet
   - every followed repo exists on chain, with at least one commit
   - the reviewer turns away a follow set that an existing app already covers

## Request flow

1. `#/deploy`: the network and expected usage, with a live price.
2. `#/deploy/setup`: name, display name, followed repos, publishes a day, view repo, and instructions for agents.
3. `POST /api/deploy` checks the login (Privy), the config, the repos on chain, and the name.
   - **Free:** it checks that the wallet has no other pending request and that a free slot is open, then opens the PR.
   - **Paid:** with no payment attached, it answers 402 with the x402 payment requirements. The page signs a USDC
     transfer authorization with the person's wallet and sends it again. The worker verifies and settles it with
     the facilitator, then opens the PR.
4. The PR adds `apps/<name>.json` on a branch `deploy/<name>`. It shows the requester, their expected usage and the
   price. Merging it deploys the app.

The app's config, as the PR adds it:

```json
{
    "name": "Kelp surveys",
    "network": "baseSepolia",
    "follow": ["0x…/kelp-surveys"],
    "publishPerDay": 50,
    "billing": { "owner": "0x…", "plan": "paid", "paidThrough": "2027-02-24", "payment": "0x<tx>" }
}
```

## Status

### Built

All in `fangorn/`:

| File | What it does |
|---|---|
| `src/pricing.js` | The cost model and `quote()`, with the free tier per network (`freeOf`), self-serve caps, `MONTHS` (1, 3, 12) and `dueFor` (price plus gas deposit, for N months). |
| `src/deploy.js` | Checks a request and builds `apps/<name>.json`: the name, the network, named `publisher/repo` follows only (no wildcards, types, schemas or rules), `publishPerDay`, `publishView` and instructions. |
| `src/Deploy.jsx`, `src/Deploy.module.css` | `#/deploy` (size it, live price) and `#/deploy/setup` (configure it, choose months, pay, send). Shows an "Add funds" button that opens Privy's USDC top-up when the wallet is short. |
| `src/pay.js` | Signs the x402 payment in the browser: an EIP-3009 `transferWithAuthorization` for exactly the amount, sent as `X-PAYMENT`. |
| `worker/deploy.js` | `deploy()`: checks, prices, gives out a free slot or takes the payment (402, then verify and settle through payAI), then opens the PR. Also the GitHub client, the on-chain repo lookup (`DataRegistry.getHead`), the facilitator client and the KV ledger. |
| `worker/index.js` | The `POST /api/deploy` route: Privy login → the requester's wallet address (their Fangorn wallet, or else a linked one). Returns the 402 body as is. |
| `worker/deploy.test.mjs` | Tests for the config, the quote, free slots, one request per wallet, the 402 → verify → settle flow, failed payments, taken names, missing repos, and giving the branch back. Part of `npm test`. |
| `wrangler.jsonc` | The `DEPLOYS` KV namespace. |
| Small changes | `App.jsx` (route), `Nav.jsx` ("Deploy" link), `auth.jsx` (logging in on `#/deploy` stays there), `package.json` (test). |

The KV ledger (`DEPLOYS`): `free:<name>` → `{ owner, pr }` for each free app, and `pending:<owner>` → `{ name, pr }`
for each wallet's latest request.

### Checked

- `node worker/deploy.test.mjs` and `node worker/grants.test.mjs` pass.
- ESLint is clean on the new and changed files.
- `wrangler deploy --dry-run` bundles the worker, with `DEPLOYS` bound.
- The on-chain repo check against Base Sepolia: a real repo (`audius-tracks`) passes, a made-up one doesn't.
- The test checks that the typed data the page signs recovers to the payer.

### Not checked

- **The page in a browser.** `npm run build` fails, and so does `fangorn.test.mjs`: vite resolves
  `@fangorn-network/sdk` to the local checkout at `~/fangorn/fangorn`, which doesn't export `BaseConfig` or
  `UPDATED_V0`. This was already broken before this work. Updating that checkout (npm has 0.2.4) should fix it.
- **A real payment through payAI.** The request and response shapes follow x402 v1 (`/verify`, `/settle`) but haven't
  been tried against the live facilitator.
- **A real PR.** The GitHub calls have only run against a fake GitHub.

### Setup before it goes live

On the site's Worker:

- `wrangler secret put GITHUB_TOKEN`: a fine-grained token on `fangorn-network/ops` with read/write on contents and
  pull requests. The release bot GitHub App could replace it, but that needs a token exchange that isn't written.
- `PAY_TO`: the treasury address the USDC goes to. Without it, free requests work and paid ones return 503.
- `DEPLOYS` is created on the next deploy, like `GRANTS`.
- Optional:
  - `PAYMENT_NETWORK` (default `base`; `base-sepolia` to test with testnet USDC)
  - `FREE_SLOTS` (default 50)
  - `FACILITATOR_URL` (default `https://facilitator.payai.network`)
  - `OPS_REPO` (default `fangorn-network/ops`; point it at a fork to test)

## Next steps

In order:

1. **Fix the build.** Update the local SDK checkout so `npm run build` and `fangorn.test.mjs` pass, then look at
   `#/deploy` in a browser, in both themes and on a phone.
2. **Try it end to end on testnet.**
   - Set `OPS_REPO` to a fork, `PAYMENT_NETWORK=base-sepolia`, and `PAY_TO` to a test address.
   - Open one free request and one paid request.
   - Check that the PR, the config and the payment land, and that payAI accepts the payload.
3. **Commit it on its own branch** (it's sitting on `feat/app-grants`), and open the site PR.
4. **Automated review in the ops repo.** Every request is a PR that someone merges. Before the free slots fill up:
   - check that `billing` is present and a paid app's payment transaction is real, for the right amount
   - refuse a follow set an existing app already covers
   - flag anything a person should look at
5. **Fund paid apps' gas wallets.** Gas is collected in USDC, but the deploy workflow funds new wallets with a fixed
   0.001 ETH. Either the workflow reads the deposit from `billing` and funds that much, or a reviewer does it by hand.
6. **westmarch: pause idle free apps.** No searches for 14 days → stop the cron, and the next search wakes it. This
   is what makes an abandoned or fake free app cost nothing.
7. **westmarch: throttle `publishView`.** It commits on every new root, up to 1,440 transactions a day.
8. **Metering in westmarch.** Count new records, index size, searches and stored bytes in `meta`. Then:
   - hold apps to their plan (stop embedding past the cap, or warn)
   - bill search and D1 storage on the real index size instead of the estimate
9. **Expiry and renewal.** A scheduled job reads `billing.paidThrough` across `apps/`. When it passes, it drains the
   gas wallet and opens a downgrade or revoke PR. Add a renew flow on the site (pay again, PR updates `paidThrough`).
10. **Cap uploads to the storage worker per wallet.** SDK users upload through its signed URLs without going through
    any app, so the thousand-account attack works there. Uploads are permanent, which makes this the bigger hole.
11. **Refunds.** If the PR fails after a payment settles, the error names the transaction and someone refunds by
    hand. If that happens, check the name and branch before taking payment, and hold the branch while paying.
12. **One shared chain poll for the whole fleet.** Every app polls publicnode every minute. That's free now, but
    publicnode rate-limits, and a paid RPC would make it the per-app floor cost.
13. **Later:**
    - Coinbase Verifications (an onchain KYC attestation on Base) as an optional route to more free apps for
      verified wallets
    - sanctions screening of USDC payers before mainnet (see the mainnet legal todo)
    - an "upgrade to paid" path for free apps, reusing the same 402 flow

## Open questions

- How many free slots: 50, or fewer while we're bootstrapped?
- Markup (3×) and platform fee ($9/mo): placeholders, not decided.
- Should a testnet app pay at all past the free tier, or should testnet have its own cheaper rate?
- What happens to an app's files and index when it stops paying? (The D1 database is kept on revoke today. Files on
  Fangorn storage are permanent.)
