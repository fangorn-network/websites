# Pricing hosted apps, v3: the pool, priced by what it's for

[pricing.md](pricing.md) priced one Worker per app, cost plus a markup, paid in months. [pricing_2.md](pricing_2.md)
priced a shared pool with a metered balance. This draft starts from what the pool actually costs, now that it's
built and running (`westmarch-pool`, one Durable Object per app), and from who should make money.

Draft, 2026-11-25.

## What went wrong before

- **The page priced our infrastructure.** Sliders for "new records a day" and "searches a day" are our cost drivers.
  Nobody deploying an app knows them, or thinks in them.
- **The quote was really just the platform fee.** For a typical app the metered lines came to fractions of a cent,
  so every quote was $9 plus about $0. A breakdown that looked calculated hid a flat fee.
- **It read like renting a server.** Months up front, then a PR someone had to merge. People don't want a Worker.
  They want their data kept findable by agents, and to be paid when it's used.
- **Only Fangorn got paid.** Nothing in it let the person running the app earn from it.

## What an app costs in the pool

Estimates from Durable Object list prices. Measure them before quoting any of them to anyone.

| What | Cost | Grows with |
|---|---|---|
| An idle app: an alarm a minute that reads the chain and finds nothing new | about $0.05–0.15 a month | how often it runs |
| Indexing: fetching and embedding new records | about $4 per million records; free when another app already embedded them (the shared cache) | new records |
| Holding the index | about $0.40 a month per million records | records held |
| Search | reads every vector in the app's index: a few dollars a month at 100k records and 1k searches a day | records × searches |
| Gas: the view's commits and relayed publishes | real ether on mainnet; testnet is on us | publishes |
| Adding, changing or removing an app | an API call | nothing |

The Workers Paid plan's allowances cover roughly the first 70 idle apps before we pay anything per app.

**So almost every app costs about nothing.** The few costs that grow are known: gas, large indexes and heavy
search, and how often the app runs. That kills cost-plus pricing: three times nothing is nothing, and any flat fee
on top is a number we made up.

## The principles

1. **Don't charge for what costs nothing.** A public, read-only index in the pool is free. Each one is also good
   for us: more repos indexed, more agent cards in the registry, more reasons to publish on Fangorn.
2. **Charge for the costs that grow, at cost or close to it,** each named in terms the person already uses:
   - **Freshness.** How often the app checks for new records. This is the one cost an idle app has, so it's the
     honest lever: every minute costs about 60 times more than every hour.
   - **Gas.** Passed through, as a deposit into the app's own wallet (as now).
   - **Size.** An index past a cap (1M records, or search heavy enough to push CPU limits).
3. **The owner makes money through x402.** An app can charge for reads (search, `get`, the view, MCP tools) through
   x402. Payments go to the owner's address, settled on chain, with no custody by us.
4. **Fangorn earns when the owner earns.** A share of each x402 payment, not a subscription. A free app that starts
   charging becomes revenue without anyone being upsold.
5. **No price until it's measured.** Every number here is a placeholder. The pool meters what each app does (runs,
   records, searches, gas), and the prices come from those meters plus a real conversation with the first owners
   (SDDb, the UWSP logs).

## What's free and what isn't

| | Free | Costs something |
|---|---|---|
| Runtime | in the pool | a Worker of its own (checks, the registry): by arrangement |
| Freshness | checked every hour (placeholder) | every minute: a small fixed amount a month, close to cost |
| Network | testnet, and mainnet read-only | mainnet publishing: the gas, as a deposit |
| Records | up to a cap (placeholder: 100k) | past it: at cost |
| Charging for reads (x402) | yes, from day one | Fangorn's share of what's paid (placeholder: 5–10%) |
| Checks (`rules`) | from a list of approved checks, once the pool runs checks | custom check code: reviewed |

Freshness is the only line most people will ever see. It's easy to explain ("checked every hour or every minute")
and it's where the cost actually is.

## How Fangorn's share is taken

x402 pays one address per route, so the split has to happen somewhere. Options, best first:

1. **The owner's `payTo` is a split contract** (e.g. 0xSplits on Base): the payer's USDC lands in a contract that
   splits it between the owner and Fangorn, on chain. No custody, anyone can check it, and it's fixed per app.
   Deploying the app deploys (or reuses) its split.
2. **Fangorn's share comes out of a balance the owner keeps with us**, counted from the payments the pool settled.
   Simpler, but it's a ledger we keep and a bill someone has to pay.
3. **Nothing at first.** 100% to the owner until there's real volume. Probably right for the first few apps anyway.

Start with 3, build toward 1.

## Managing apps: git stays the record

Every hosted app is a file in the ops repo, and every change to it is a commit. That gives us a history, versions
and review, and a way to undo a change. Self-serve doesn't change that. It changes who writes the commit:

```
fangorn.network/#/deploy ──► POST /api/apps (signed in) ──► a commit to ops main: apps/<name>.json
                                                               │
                                                     deploy.yaml (on push)
                                                               │
                                       pool apps: sync.mjs ──► westmarch-pool admin API ──► live
```

- **The site commits straight to `main`**, as a bot, with a message naming who asked. No PR, so nobody has to merge
  it. ops is private on GitHub's free plan, so auto-merge isn't available anyway, and a commit is the same record.
- **The file records its owner** (`owner`: their wallet). Only that wallet can change, pause or remove the app from
  the site. Every other change goes through a PR, as now.
- **Self-serve is the pool only**, with what the pool can check by itself: no checks, no `index`, nothing a person
  needs to review. A Worker of its own still goes through a PR.
- **It takes about two minutes** (the workflow run). The page waits for the app's `/api.json` to answer.
- The site's GitHub token can write only to `apps/`'s files through this path. Whatever it writes is a commit anyone
  with access can read, revert or take over.

Later, if two minutes is too slow, the site can call the pool directly and commit the same file at the same time.
Then git is a mirror, not the trigger, and the workflow only checks that the two agree.

## What's built, and what's next

1. **Now:** self-serve pool apps through git: free and read-only, on testnet or mainnet. Owners can update, pause
   and remove their own apps.
2. **x402 in the pool:** merge westmarch's `feat/x402` into the pool, so a pool app can charge for reads, paid to
   its owner.
3. **Metering:** runs, records indexed, records held, searches and gas, per app, in its status. The prices come from
   these.
4. **Freshness tiers:** the run interval per app (the pool's `RUN_EVERY` is one constant today), every hour by
   default.
5. **Fangorn's share:** a split contract as `payTo`.
6. **Gas for mainnet publishing:** a deposit, paid through x402 into the app's wallet.

## Open questions

- Is an hour fresh enough for free apps? It's fine for logs and catalogs, but too slow for feeds.
- What share of x402 payments is fair, and does it change with volume?
- Should a free app that charges through x402 get faster runs for free, since it's earning us money?
- Who owns an app: the wallet that deployed it, or one it names? (It matters once there's money in it.)
- Do we keep the free-app limit (`FREE_SLOTS`)? A spending ceiling across the free apps might be better.
