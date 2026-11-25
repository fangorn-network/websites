# Pricing hosted apps, v2: a shared pool

[pricing.md](pricing.md) prices one westmarch Worker per app: its own cron, D1, embeddings and gas wallet, paid for
in months up front. This draft prices the same product run on **one shared pool of Workers**. A customer no longer
gets infrastructure. They get a **follow set kept indexed and served**, paid from a prepaid balance.

Draft, 2026-11-25. Nothing here is built.

## Summary

- **What you buy:** a follow set (which repos, from which publishers) that the pool keeps indexed, checked and
  searchable, with its own MCP endpoint and signed view.
- **How you pay:** top up a USDC balance (x402, or a card through Privy, as in v1). The pool draws it down as it
  works. No months up front, no PR per app.
- **When it runs out:** updates stop. The last signed stitch stays valid and anyone can still verify it. Search
  keeps working for a grace period, then the app pauses until it's topped up again.
- **Self-hosting doesn't change:** the same westmarch code runs as one Worker or locally, at no charge from us.

## What changes

Most of what each per-app Worker does is the same work repeated: read the chain log every minute, fetch records from
IPFS, embed them. The pool does that work once:

```
chain log ──► 1 reader (the registry already does this)
                 │
             Queue: "repo R moved to head H"
                 │
             N consumers: diff → fetch → embed once per CID + model
                 │
             shared store of records and vectors, keyed by CID
                 │
             per-app view: follow set + checks + key + tools
```

An app becomes **a config row**, not a deploy. Its view is a filter over the shared store.

## What it costs us

Same drivers as v1. Some get cheaper, some go away.

| Driver | v1 (Worker per app) | v2 (pool) |
|---|---|---|
| Watching the chain | One log read a minute per app; publicnode rate limits | One read for everyone: ~$0 per app |
| Indexing new records | ~$0.008 per 1k, per app | Same, but a record followed by several apps is embedded once |
| Index storage | D1 per app, ~2 KB a record | One shared copy per record |
| Search | Reads every vector in the app's D1 | A vector index filtered by follow set, so cost no longer grows with the size of the index (to measure) |
| Idle apps | Cron runs every minute, which is why v1 needed "pause idle apps" | No cron per app: an idle app costs only its stored rows |
| Gas (stitch, view, relayed publishes) | Per app | Still per app: each view is signed by that app's key |

The real per-app costs are the **records that go into its view, its searches, and its gas**. Watching is close to
free.

## Price

What's metered, charged against the balance:

| Meter | Unit | Price |
|---|---|---|
| Records indexed | per 1k new or changed records in the view | cost × markup |
| Records held | per 1k records in the view, per month | cost × markup |
| Searches | per 1k searches (HTTP or MCP) | cost × markup |
| Gas | each stitch, view commit or relayed publish | pass-through, plus the 25% buffer from v1 |
| Base fee | per active app, per day | placeholder, covers the fixed overhead |

- **Price from cost, as in v1.** The markup (3×) and the base fee are still placeholders.
- **We keep the dedupe savings.** Each app pays list price for the records in its view, even when another app
  already paid to embed them. That's where the margin comes from.
- **Gas is still a deposit, not revenue.** It sits in the app's gas wallet and carries over.
- **Testnet is still not free.** Same meters; only gas is on us.

### Free tier

A free app is a **read-only view**: it follows repos already on Fangorn, with small caps on records and searches, no
gas and no uploads. The no-KYC reasoning from v1 still holds: it gives out nothing worth farming.

v2 makes this cheaper to offer:

- An idle free app costs about $0, with no cron to pause.
- The records it follows are usually already embedded for someone else.
- The fleet-wide limit becomes a **spending ceiling on the free tier** instead of a count of slots.

### Running out

1. Balance at zero → the pool stops updating the view. No new stitches, no new embeds.
2. The last signed stitch and view stay on chain, and anyone can verify them.
3. Search and MCP keep answering from that last state for a grace period (placeholder: 7 days).
4. After that, the app pauses. Its config row stays, and a top-up resumes it from the last stitch.

## Payment

Same rails as v1: USDC on Base over x402 (payAI), and Privy's card top-up for people without crypto. Two changes:

- **Top-ups instead of plans.** You pay any amount into the app's balance, not 1, 3 or 12 months.
- **The balance is a ledger the pool keeps**, debited by the meters above. It goes in `meta`, next to the metering
  that v1's next steps already called for.

## Request flow

1. `#/deploy`: choose the follow set and see an estimated cost per day.
2. `POST /api/apps` checks the login, the config and the repos on chain, then writes the config row.
3. Free: the row goes live right away, inside the free-tier ceiling. Paid: the same 402 → verify → settle flow as v1
   opens the balance, then the row goes live.

No PR per app. A person reviews only what the pool can't check by itself, such as custom checks (see below).

## The hard parts

- **Custom checks.** In v1 each app's checks are bundled into its validator at deploy. A shared pool has to load
  check code at runtime, which means Dynamic Workers. One customer's check also must not stall the queue for
  everyone. Start with a **catalog of approved checks** (checks are already records, so this is a list of CIDs).
  Custom check code can come later, for paid apps.
- **Keys.** Each app keeps its own `INDEXER_KEY`, in a secret store, so its view is signed as *its* view. One shared
  key would be simpler, but it would weaken the claim that the index is theirs.
- **Isolation.** Paywalled or sealed records shouldn't sit in the shared store. The pool holds only what's public
  anyway, and anything gated stays per app.
- **Noisy neighbours.** A huge follow set can't be allowed to starve the queue. Cap each app's share of the queue,
  and fair-share across apps.

## From v1 to v2

v1 isn't wasted. The pricing model, x402, Privy top-up and the free-tier reasoning all carry over. In order:

1. **App Workers take repo updates from the registry** instead of each reading the chain. This is v1 next step 12,
   and it's useful even if v2 never happens.
2. **A shared embedding cache keyed by CID + model.** v1 Workers check it before embedding.
3. **Metering in `meta`** (v1 next step 8): records indexed, records held, searches, gas. Without it, a balance
   can't be drawn down.
4. **The pool:** Queue consumers, the shared store, config rows, and the balance ledger. Move the free apps first,
   since they have no custom checks and no gas.
5. **Paid apps move over** once custom checks run safely in the pool, or once the catalog of approved checks covers
   what paid apps use.

## Dropped from v1

- One Worker, D1 and cron per app (this stays as the self-host path).
- A PR per request, with a person merging it.
- Plans of 1, 3 or 12 months, and expiry jobs (a balance replaces them).
- Pausing idle free apps (idle is free in the pool).
- `FREE_SLOTS` as a count (replaced by a spending ceiling).

## Open questions

- Markup, base fee and grace period: all placeholders.
- Can an app share the records held cost with the other apps that follow the same records, instead of keeping the
  dedupe savings as margin? That's fairer, but harder to explain.
- Are search costs actually flat with a filtered vector index? Measure it before putting a price on searches.
- Should a balance belong to an app, or to a wallet that funds several apps?
- Whose wallet pays for the registry's own reading of the chain? (It's ours today, and it becomes shared
  infrastructure.)
