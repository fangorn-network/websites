# Designing an economic protocol for the next internet

I would approach this as a mechanism-design problem, not a token-design problem and not primarily a marketplace-design problem.

The objective is to create an internet where people can get useful things done, publishers can earn a living, public goods can be funded, and agents can transact autonomously—without requiring a centralized platform to own the relationship between supply and demand.

My starting hypothesis is:

Build a protocol where people and their agents control demand, publishers control their offers, and funding flows to whoever creates value under rules that no single intermediary controls.

The important innovation isn't that payments are decentralized. It's that the system changes the incentives governing discovery, funding, and allocation.

I'll call the proposed mechanism the Intent Economy for now. That's a working name for the model, not a proposed final brand.

## 1. First principles: what should the system optimize?

We need to distinguish the goals of the network from the goals of individual participants.

## The system's objective function

A conceptual framework, not a single score to optimize mechanically.

For people

Fulfill their intentions with minimal cost, manipulation, unwanted disclosure, and loss of control.

For publishers

Earn revenue in proportion to the value they provide, while retaining control over their work and terms.

For the commons

Fund useful resources whose benefits exceed what individual buyers are willing or able to pay for.

For the network

Enable competition, interoperability, accountability, and exit without requiring a trusted central operator.

These goals can conflict. A publisher might want to charge for something a person needs. A sponsor might fund valuable research while trying to influence its conclusions. A popular resource might receive ample funding while an obscure but essential resource receives none.

So I would not encode the entire system into a universal "social value" score. That would invite whoever controls the score to become the new platform.

Instead, the protocol should provide different mechanisms for different economic problems, with explicit rules and user-controlled preferences.

There are three foundational principles.

1. Demand belongs to the person, not the platform. The person or their delegated agent defines what they want and which constraints cannot be traded away.
2. Money buys defined services or outcomes, not control over people. Payment can buy access, fulfillment, sponsorship, or a disclosed allocation right—but not covert influence over someone else's agent.
3. Public value and private value are different economic categories. Individual purchases alone cannot reliably fund everything that society benefits from.

That third point is crucial. If we merely replace advertising with micropayments, we may create a more ethical commercial web while still losing a great deal of valuable free information.

## 2. The fundamental unit: an intent, not an impression

The first protocol primitive should be an Intent Request.

An intent is a bounded expression of something a person or agent wants to accomplish. It might be a question, a procurement request, a research goal, a request for data, or a request to fund something.

For example:

> Find reliable evidence about the water requirements of proposed data centers in my region. Prefer primary sources, identify conflicts of interest, and spend no more than $5 without asking me.

This is more expressive than a search query. It contains a goal, constraints, a budget, and authorization rules.

The person doesn't need to publish this intent to the network. Their local agent can use it to discover relevant resources and privately evaluate offers.

### The lifecycle of an intent

1\. Intent

User defines goal, constraints, budget, and privacy rules

2\. Discovery

Agent finds publishers, data, services, and free resources

3\. Offers

Eligible providers submit prices, terms, and evidence of quality

4\. Selection

User's agent evaluates the offers under the user's rules

5\. Fulfillment and settlement

Data or service is delivered; payment and any agreed verification follow

6\. Optional contribution to the commons

A portion of the economic activity may support shared resources, if explicitly authorized

The last step is optional because I would resist imposing a protocol-wide tax on every transaction. The commons needs funding, but it should not automatically acquire a claim on every exchange.

Instead, the network could support explicit contributions, separate public-goods budgets, sponsorship, institutional funding, and other mechanisms.

One further distinction: an intent should not necessarily be a globally broadcast object. Publicly broadcasting "I'm looking for a divorce lawyer," "I'm researching a medical condition," or "I'm considering leaving my employer" could itself become surveillance infrastructure. Private discovery and selectively disclosed requests should be the defaults.

## 3. The market mechanism: not one auction, but three

Here is where I think the design gets interesting.

A conventional auction takes a scarce item and determines who gets it. Our system has at least three different things to allocate:

- Which provider should satisfy a person's demand?
- Which publishers deserve compensation for useful contributions?
- Which resources should be funded even when there isn't enough direct purchasing demand?

These are different problems. They need different mechanisms.

### Market A: intent fulfillment

A user expresses demand. Providers make offers. The user's agent selects the offer that best satisfies the user's objective.

A possible selection rule is:

\\[ \text{Choose } i \text{ to maximize } U_i \\]

subject to:

\\[ p_i \leq B,\quad C_i \in \mathcal{C} \\]

Where:

- \\(U_i\\) is the user's estimated utility from provider \\(i\\).
- \\(p_i\\) is its price.
- \\(B\\) is the user's budget.
- \\(C_i\\) represents whether the offer satisfies hard constraints \\(\mathcal{C}\\), such as provenance or licensing.

This is deliberately not "highest bidder wins." The provider's bid may affect price or availability, but it must not buy a better score inside the user's agent.

For an ordinary purchase, the user might choose a provider based on price, quality, and reliability. For a complicated research task, the agent might combine multiple providers and free sources.

The market's job is to expose competing offers. The agent's job is to evaluate them for its principal.

Who pays? The user, their employer, an institution acting on their behalf, or an explicitly authorized sponsor.

What does the provider receive? Payment for the service or deliverable, not ownership of the user's intent or profile.

### Market B: contribution and attribution

Suppose five independent publishers contribute useful information to an agent's answer. Which publishers get paid?

This is harder than choosing a single service provider.

A simple referral fee can encourage useful discovery, but it can also create incentives to favor publishers who pay the most. Paying per citation encourages citation spam. Paying per click encourages clickbait.

I would start with a much simpler rule:

Pay for explicit, verifiable deliverables—not for the mere appearance of a resource in an agent's output.

Examples include:

- A dataset purchased under a defined license.
- A research report commissioned for a fixed price.
- An API call that returns a specified result.
- A verified data transformation.
- A publisher's contribution to a jointly funded project.

Where several parties contribute to a deliverable, the parties can agree on a split before execution or use a defined attribution mechanism.

More ambitious contribution-based rewards can come later, but the protocol should not pretend it can objectively measure how much every piece of information contributed to a person's understanding.

### Market C: public-goods funding

Now consider the resources that matter but don't have a clear purchaser.

An open-source library, a local investigative journalism project, a public dataset, or a carefully maintained reference corpus might benefit thousands of users without generating enough direct revenue to sustain itself.

Here, I would introduce a separate funding mechanism.

Sponsors, communities, institutions, and individual users contribute to a pool. The pool funds eligible projects according to a published allocation rule.

A project might qualify because it:

- Produces a useful open resource.
- Serves a community with limited commercial purchasing power.
- Maintains infrastructure that many other projects depend on.
- Produces independently verifiable research.
- Fills a documented gap in available information.

The allocation process could combine direct pledges, matching funds, milestone payments, and community voting. More experimental mechanisms could follow.

Crucially, the funding rules should be visible and contestable, and the funder should not automatically gain editorial control over the funded resource.

This is where the protocol begins to address the "free internet" problem rather than merely making online commerce more efficient.

## 4. The key economic innovation: separate the bid from the ranking

This is the central design choice I would defend most strongly.

In an advertising exchange, payment can buy preferential access to attention. Even when an ad is labeled, the system is built around selling the opportunity to influence someone.

In the proposed system, providers can pay to fulfill demand, but they cannot buy the user's agent's judgment.

Imagine three providers offering data about a local development project:

| Provider | Price | Evidence quality         | Conflict disclosure |
| -------- | ----- | ------------------------ | ------------------- |
| A        | $0    | Strong primary documents | Complete            |
| B        | $2    | Independent analysis     | Complete            |
| C        | $1    | Unverified summary       | Missing             |

A's free documents and B's analysis may be complementary. C might be excluded by the user's rules because its provenance is inadequate.

If C pays a fee to participate, that fee must not improve its relevance ranking. It could pay a legitimate registration or execution cost, but not purchase a favorable judgment.

This leads to a useful separation:

Economic layer

Prices, offers, payments, subscriptions, escrow, sponsorship, and funding.

Evaluation layer

Provenance, relevance, quality evidence, licensing, conflicts of interest, and user-defined selection criteria.

Privacy and authority layer

What an agent may reveal, what it may spend, what it may purchase, and what actions require approval.

These layers can interact, but none should silently override the others.

There is a caveat: a wealthy provider can still fund better data, more thorough research, and more capable services. We cannot make money irrelevant to production. What we can do is prevent money from buying an undisclosed privilege inside someone else's decision-making process.

This is also why I would not make a single network-wide relevance score a consensus primitive. Users can select different evaluation policies, and agents can compete on how well they execute those policies.

## 5. A concrete protocol design

I would initially define six protocol objects. These are conceptual structures, not a claim that every field needs to be standardized immediately.

### 1. Publisher Identity

A stable publisher identifier, public keys, reputation evidence, service endpoints, and optional legal or organizational credentials.

Purpose: Make publishers accountable without requiring every buyer to disclose their identity.

### 2. Offer Manifest

A signed declaration of what a publisher offers, its price or pricing rule, licensing terms, delivery format, quality claims, and fulfillment conditions.

Purpose: Make offers portable, machine-readable, and directly negotiable.

### 3. Intent Policy

A private or selectively disclosed description of the user's goal, budget, hard constraints, acceptable trade-offs, and delegation limits.

Purpose: Give the agent authority to act for the user without turning the intent into a public behavioral record.

### 4. Deal Agreement

A mutually accepted offer specifying deliverables, price, rights, payment conditions, and any agreed dispute process.

Purpose: Make the transaction explicit and enforceable under its stated terms.

### 5. Settlement Receipt

Evidence of payment and, where applicable, delivery or fulfillment. It should reveal no more than the parties and their chosen verification mechanisms require.

Purpose: Enable accountability and auditing without creating a universal transaction history.

### 6. Funding Commitment

A pledge or grant with a funding target, eligibility criteria, milestones, payout rules, and disclosure of any attached conditions.

Purpose: Support shared resources without forcing them into a direct-sale model.

### What belongs on-chain?

Very little needs to be on-chain by default.

The chain can provide registration, stable identifiers, signed commitments, payment settlement, and verifiable state transitions. Public offers and manifests can be hosted on ordinary infrastructure or distributed storage, with content-addressed references where appropriate.

Intent details, negotiation messages, purchase histories, and private receipts should generally remain off-chain or be selectively disclosed.

Even a hashed record can leak information if its content is guessable. So "put the hash on-chain" is not a complete privacy design.

A particularly important distinction: public publisher accountability does not require public buyer activity. Publishers can establish their identities and stand behind their offers, while users transact through privacy-preserving mechanisms appropriate to the payment rail and threat model.

### A transaction sequence

Here is how the protocol might work for a paid data request:

1. A publisher registers and publishes a signed offer manifest.
2. A user agent discovers the offer and evaluates it against a local intent policy.
3. The agent requests a quote or accepts the published terms.
4. The buyer and publisher agree on the deliverable, price, and rights.
5. Payment is made directly, or held conditionally if the payment mechanism supports it.
6. The publisher delivers the resource.
7. The buyer or an agreed verifier confirms fulfillment where needed.
8. A settlement receipt is created, with public disclosure only where required or chosen.

This should work for a simple micropayment as well as a multi-step procurement deal. We shouldn't force every transaction through an elaborate escrow protocol.

For digital information, fulfillment is not always objectively verifiable. A receipt can prove that a file was delivered, but not that its contents are true or useful. That distinction needs to be explicit in the protocol.

## 6. The hardest incentive problem: how do agents make money without selling out their users?

The system will increasingly be operated by agents, including agents that discover resources, negotiate, publish data, and execute transactions.

That creates a new class of intermediary. We can decentralize the data and payments while accidentally recreating Google in the agent layer.

Suppose an agent tells users it finds the best dataset, but secretly receives a referral payment for selecting Publisher A. The user may never know. The publisher doesn't need access to the user's history; the agent itself becomes the rent-seeking intermediary.

So the protocol needs to distinguish between the agent's legitimate business model and its authority over a user.

I would support three explicit models.

Principal agent

The user pays the agent a subscription or a clearly stated fee. The agent acts under a delegated policy and discloses conflicts of interest.

This is the cleanest default for high-trust personal assistants.

Protocol utility

A discovery service charges for computation, hosting, indexing, or verification. Its fee is independent of which provider wins, wherever practical.

This can fund useful infrastructure without selling rankings.

Commission agent

An agent earns a commission from successful transactions. The commission is disclosed, and the user can compare the resulting offer against alternatives.

This can be legitimate for shopping and procurement, but it creates a direct incentive to increase spending.

I would not ban commissions. They can be useful, especially for complex procurement. Instead, the user should be able to set rules such as:

- No paid ranking or undisclosed referral payments.
- Prefer the lowest total cost among offers meeting my quality threshold.
- Never exceed a specified budget.
- Disclose any commission before committing.
- Require approval for subscriptions, recurring purchases, or sensitive disclosures.
- Allow a different agent to reproduce or challenge the selection.

The protocol can standardize disclosure and authorization without claiming to verify that every agent genuinely acts in the user's interest.

That last distinction matters. Software cannot guarantee benevolence simply because an agent publishes a policy. Users need meaningful alternatives, auditable actions, portable settings, and the ability to revoke authority.

## 7. How the economy could sustain itself

Let's model the funding flows.

A viable network would have at least four sources of money:

Direct commerce

People and agents pay publishers for data, content, and services. Revenue flows to the provider, less explicitly agreed transaction or service fees.

Sponsorship

Organizations fund relevant resources, access, or services under disclosed conditions. Sponsorship does not purchase private user data or control over the user's agent.

Collective funding

Communities pool money to fund resources that individual transactions cannot sustain.

Institutional funding

Foundations, public bodies, research institutions, and businesses fund shared infrastructure or defined public-interest outcomes.

A publisher can combine these streams. A free public dataset might be funded by a foundation and voluntary contributions. A commercial research service might sell premium analysis while keeping its underlying public sources free. An agent could pay for one specialized API call and use that result alongside free resources.

This creates a more diverse economy than either a pure subscription internet or a pure advertising internet.

But it does not guarantee that the network itself will be sustainable. Discovery, indexing, validation, dispute resolution, and open-source maintenance all have costs.

### Where does the protocol capture value?

My recommendation is to separate the protocol's economic role from the economics of applications built on it.

The protocol should make it possible to transact, settle, establish publisher accountability, and fund shared resources. Applications can charge for better discovery, user experience, hosting, analytics, or agent execution.

If the protocol needs sustainable operating revenue, it could offer paid infrastructure or optional services. But I would be cautious about a mandatory per-transaction royalty: it creates a central economic chokepoint and can make low-value machine-to-machine transactions uneconomic.

A more robust approach is to make the protocol useful enough that independent service providers compete to supply the infrastructure around it.

## 8. Failure modes we should design against from the beginning

This is the section I'd take most seriously. Every proposed mechanism creates new ways to game the system.

| Failure mode                | Why it happens                                                                   | Possible defense                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Pay-to-win rankings         | Providers pay agents or intermediaries for preferential placement                | Separate selection policy from bids; require commission disclosure and allow independent comparison                        |
| Sybil publishers            | One actor creates thousands of identities to manipulate reputation or funding    | Reputation tied to verifiable history, rate limits, credentials where appropriate, and cost-sensitive participation        |
| Fake demand                 | Bots generate requests to extract subsidies or manipulate prices                 | Require evidence of genuine commitments for subsidized activity; cap rewards and detect correlated activity                |
| Quality gaming              | Publishers optimize superficial metrics rather than actual usefulness            | Use task-specific evaluation, provenance, milestone verification, and independent audits                                   |
| Funding capture             | Wealthy funders steer the allocation of resources toward their own interests     | Separate funding from editorial control, publish conditions, diversify funding, and provide appeal mechanisms              |
| Privacy leakage             | Negotiations and payments expose sensitive intentions                            | Local evaluation, selective disclosure, minimal retention, and privacy-aware payment options                               |
| Collusion                   | Providers coordinate prices or suppress competition                              | Multiple independent providers, open offers where safe, competition monitoring, and no privileged exchange operator        |
| Agent lock-in               | A dominant assistant controls preferences, purchase history, and provider access | Portable intent policies, interoperable manifests, user-held credentials, and alternative agents                           |
| Spam and low-quality supply | Publishing offers is cheap and attention is scarce                               | Publisher accountability, user-controlled filters, optional deposits for costly operations, and cheap automated validation |
| Bad or fraudulent delivery  | A signed offer can still contain false claims or useless data                    | Explicit warranties, evidence requirements, optional escrow, dispute procedures, and enforceable consequences              |

There is no perfect solution to these problems. Reputation can be gamed. Deposits disadvantage newcomers. Identity credentials can exclude legitimate anonymous publishers. Public audits can compromise privacy. Community voting can be captured.

The design principle should be to make manipulation costly, make conflicts visible, keep the rules contestable, and avoid concentrating all enforcement power in one operator.

I would also resist making a token stake the universal answer. Financial deposits can deter some spam and support some forms of accountability, but they do not establish truth, quality, or social value. A wealthy attacker can afford a deposit; an excellent newcomer may not.

Different actions should have different levels of assurance. Publishing a free resource should be easy. Receiving a large public subsidy or making a high-value contractual claim may justify stronger requirements.

## 9. The first version I'd actually build

I would not start by building all three markets, an on-chain governance system, a reputation token, and a new agent economy simultaneously.

I would build a minimal protocol that proves one proposition:

Independent publishers can compete to satisfy a user's intent, receive payment directly, and earn sustainable revenue without acquiring the user's behavioral data or buying control over the user's agent.

Then add a public-goods funding mechanism once the basic commerce loop works.

### Phase 1: intent-driven commerce

Implement:

- Signed publisher identities and offer manifests.
- A standard format for prices, terms, and fulfillment.
- An agent that discovers several eligible offers and compares them locally.
- Direct payment and delivery receipts.
- User-configurable spending and disclosure policies.
- Optional, disclosed commissions.

For the initial product, I'd use a few realistic tasks: purchasing a specialized dataset, requesting an analysis, or paying for a particular API capability.

Measure successful fulfillment, user satisfaction, repeat usage, provider revenue, and privacy leakage—not just the number of registered publishers or transactions.

### Phase 2: sponsorship without surveillance

Add a way for a sponsor to fund a resource or a defined service.

The sponsor declares what it will fund and what conditions apply. The publisher discloses the relationship. The user's agent can consider the sponsored resource without being obligated to recommend it.

The sponsor gets evidence of the funded outcome, not automatic access to the identities and histories of the people who benefited.

A useful initial test would be to fund an independent research resource and see whether the publisher can sustainably provide free access without tracking readers.

### Phase 3: a commons funding pool

Introduce an opt-in pool with transparent eligibility and payout rules.

For the first version, I would favor milestone-based grants and matching contributions over a complicated token-weighted voting mechanism. The goal is to learn whether the network can direct money toward genuinely useful shared resources, not to create a speculative asset.

Only after there is evidence of real demand and meaningful funded output would I experiment with more sophisticated allocation mechanisms.

## 10. What I would deliberately leave unresolved

Three questions deserve real research rather than premature protocol decisions.

First: can we measure value without turning it into a new surveillance metric?

If publishers are paid according to user engagement, we risk recreating attention extraction. If they are paid according to citations, they optimize citations. If they are paid according to declared user satisfaction, they may manipulate satisfaction scores.

We need task-specific evidence and should accept that some value cannot be measured objectively.

Second: how should public goods be allocated?

Direct pledges, matching grants, community voting, and contribution-based allocation all have strengths and weaknesses. There may be no single universally fair rule. Perhaps the protocol should support several competing funding mechanisms rather than standardize one.

Third: can the user remain in control when their agent is acting autonomously?

This may be the most important question of all. If agents make purchases, disclose information, negotiate contracts, and select sources without continuous human intervention, their delegation policies become a new locus of power. We need portable rules, understandable controls, and effective revocation—not merely promises that the agent is aligned.

## 11. My current synthesis

I would describe the emerging design as three interoperable economic systems built on one common substrate:

## The market

People and agents express demand. Independent providers compete to fulfill it. Prices emerge through offers, negotiation, and selective auctions.

## The commons

People, sponsors, communities, and institutions fund resources that deserve to exist even when individual purchases cannot sustain them.

## The agency layer

People delegate discovery, evaluation, negotiation, and purchasing to agents operating under user-defined policies.

## Shared protocol infrastructure

Publisher accountability · Machine-readable offers · Private transactions · Settlement · Portable policies · Verifiable commitments

The important part is that none of these systems should own the others. A funding pool shouldn't control discovery. A discovery service shouldn't control the user's agent. An agent shouldn't own the user's purchase history. A payment provider shouldn't dictate which publishers are relevant.

They can compete, interoperate, and evolve independently.

And I'd state the underlying thesis this way:

The next internet is not one where everything is free. It's one where the things worth having can be funded without making people the product.

The P2P data layer enables direct commerce. The economic layer makes it possible to fund and allocate resources. User-controlled agents connect the two to actual human intentions.

That's the architecture I'd explore.

The next design decision I would focus on is the auction itself: what exactly are providers bidding for, and what determines the winner? That decision will determine whether this becomes a genuinely different economic system or merely a more privacy-preserving version of today's advertising market.