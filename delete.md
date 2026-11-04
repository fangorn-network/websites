My honest take: Fangorn is more interesting to a developer building agentic applications than its current positioning probably lets on. And the “Web3 Netflix, but with agents” idea is a genuinely useful way to think about one application of it — potentially a much better way to communicate the value than talking about knowledge graphs, Merkle trees, or decentralized infrastructure.

But I think there are two different products hiding inside Fangorn's current story, and the website needs to make the relationship between them obvious.

- For developers: infrastructure for discovering, accessing, and paying for data and capabilities across applications without building a bespoke integration for every source.
- For creators and consumers: a way to publish, discover, access, and monetize collections of knowledge, media, tools, and other digital resources without depending entirely on a centralized platform.

The underlying protocol can support both. The challenge is making either audience immediately understand why they should care.

## 1. From the POV of a developer building agentic things

Imagine I'm building an autonomous research agent, a personal assistant, or an agent that buys data from other agents.

Today, I have to solve several problems myself:

- Find useful data sources.
- Figure out how each source exposes its data.
- Write and maintain integrations.
- Handle API keys, authentication, and payments.
- Decide whether the source is trustworthy.
- Rebuild indexes and embeddings to make data useful to my agent.

Fangorn's promise is that I should be able to discover and use data from a new publisher without building a bespoke integration for it.

That is a compelling developer proposition. Your current documentation describes a versioned data protocol, on-chain discovery, programmable access conditions, and an SDK for publishing structured records.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.npmjs.com\&sz=32)

npm+1



But here's my reaction as that developer:

What makes me interested

- One integration can unlock many independently published data sources.
- Publishers can offer data without each consumer needing a custom API integration.
- Data can have provenance, version history, and programmable access.
- I can potentially pay for exactly what my agent needs, rather than buying an entire platform subscription.

What makes me hesitate

- What can I actually build in 15 minutes?
- How does my agent discover the right dataset, not merely a registered dataset?
- What does the query interface look like? What are the latency and reliability guarantees?
- What happens when data changes, a publisher disappears, or an access condition fails?
- Why should I adopt Fangorn instead of just using an MCP server, an API directory, or my own vector database?

That last question is the critical one.

A developer doesn't inherently want a protocol, a blockchain, or a knowledge graph. They want their agent to accomplish a task that was previously difficult or expensive.

My recommendation: lead with the developer outcome, then explain the protocol as the mechanism that makes it possible.

For example:

> Give your agent access to the web's data, not just its APIs.
>
> Publish structured data once. Let agents discover it, query it, and pay for access when needed — without building a custom integration for every source.

I would then show a working example immediately. Something like:

1. Ask an agent to research a company using three independent data publishers.
2. Have it discover those sources through Fangorn.
3. Query them and combine the results.
4. Pay for one restricted dataset.
5. Return results with source provenance.

That's a much stronger demonstration than explaining the architecture first.

## 2. What about a Web3 Netflix built around agents?

I actually find this framing more distinctive, especially as a way to demonstrate what Fangorn enables beyond conventional agent infrastructure.

[Movie Streaming Platform — UI Exploration by RR on Dribbble](https://images.openai.com/static-rsc-4/tF5K5Lfrg3yVZZXyBgw7V_PmUHSGe5tmxunnHNJX6V_Za6ZwG9BEqE1dzEZskvzXQrOVLp3n3uPs0lGmzahycfN5eC_-GfjyHgygeHWTFXq_Sxr2LP-7O83Qz8oUyHE9pCSTGIAeHEXKNaDpLHk5PbRvKEBY56Rrnot6nVEoRfM?purpose=inline)

[The Mortimiser - Hicks.design](https://images.openai.com/static-rsc-4/zcLZvnbUy3_HFdc2OxOYE5yygrOhUFn6XImNKfF4qAT8eOBGh38VITANVDymp6riuO6gg09p_nV4sLI-VhOYPlEekHBjwkviu6qQXmSLoljw8NU2O_fcGQMQJIWj3PTOCYr_oPOI1uBJrvsINLiK7U8F3BrmnArQNnNVPlnH-FM?purpose=inline)

[What is a video database? How to use it?](https://images.openai.com/static-rsc-4/92vAx0NEXdp7pQ8mx1oZ2tU4EO69ENKgvRGo8tCACYQRf-V4tUqyMyVa32rQrtZojaXgiC6LslryCWPLhzuRJRL2sHLTd1rpXmEDsy2JDOyZPnSrwL9tP-h1MKOXchEL8StZV7EOUKAh0me6SI-pEU-5IAaPM2wes7lnD1_SyTA?purpose=inline)

12

Think about how Netflix works today. The platform controls the catalog, the recommendation system, the user relationship, and the subscription. Independent creators operate inside its rules.

Now imagine a different arrangement:

- Anyone can publish a catalog of movies, music, books, courses, datasets, or interactive experiences.
- Each catalog can define its own access and payment conditions.
- Users have personal agents that discover content across all these catalogs.
- Recommendations are based on the user's intent and preferences, rather than requiring every publisher to feed a centralized recommendation engine.
- Creators can sell access directly, including to autonomous agents acting on behalf of users.

The crucial difference isn't that the interface uses a blockchain. It's that the discovery and recommendation layer doesn't have to be owned by the content platform.

Your existing architecture has an interesting fit here: publishers maintain their own data, applications present curated views of it, and the same underlying information can support both human-facing experiences and agent-facing access.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://hackmd.io\&sz=32)

HackMD+1



### A concrete example

A user tells their personal agent:

> Find me obscure science-fiction films from the 1970s, preferably restored editions, with a strong environmental theme. I have $12 to spend tonight.

The agent searches across independent film collections, discovers relevant titles, compares access conditions, checks what is available, and purchases access within the user's budget.

One publisher charges per film. Another sells a collection. A third offers a free catalog but charges for high-resolution versions.

The user sees one coherent experience. The underlying publishers remain independent.

That's a plausible agent-native streaming marketplace — and it illustrates a larger idea that could extend to music, games, books, educational content, and specialist knowledge.

There is a caveat: discovery, payments, and cryptographic access don't automatically solve copyright licensing, video delivery, DRM, or the business of acquiring content. Those would be substantial parts of an actual streaming product.

## 3. Which story should Fangorn tell?

I wouldn't make the developer story and the Netflix story compete. I would make one the infrastructure and the other the proof of what becomes possible.

[Cyber Essentials for NHS Suppliers in 2026](https://images.openai.com/static-rsc-4/uXsQ3z1WJfafF2TB3ma2lmaWv_ihxIRTOfuOeVwQNdIrCYetF0X9uYz7mqfNJjpFXOal8jv-rpsfeXxF89prqhArMahc1a3xD7kwEM0gt5dF61zq44lHXZ4LtlFv1Scy4-N6i8m-BlIr6aWnkr8pXKyGPCo2WQjQzG_7EMNiv1M?purpose=inline)

## The infrastructure story

For developers, builders, and technical partners

The open discovery and commerce layer for the agentic web.

Publish data and capabilities. Let agents discover, access, and pay for them across applications.

[Neo Cinema Content Distribution Platform and Creator Marketplace Escape.ai Debuts in Beta](https://images.openai.com/static-rsc-4/jhYlKMOChta5uxMcWr1dJF1xAsyC_yBh86fTBidwwcFgoczNWNqVYijYUWJy6r6xkQrJTMil3Vj--KN54bedg2Mc0kXsz7m1X8Z1EGr621cADktp6yr7R1PqBeT4E6vjhCZ-qVr69huUhMXJw759BIeOneyl9o0V2VU7CeBDST4?purpose=inline)

## The consumer story

For creators, curators, and users

A web where your agent finds what you want, wherever it lives.

Independent collections become discoverable and commercially accessible without a single platform controlling the entire experience.

This distinction matters because "Web3 Netflix" is a product concept, not necessarily the description of the protocol itself. It could be a flagship application built on Fangorn, alongside a Quorum-like research product, a music discovery application, or a marketplace for agent skills and datasets.

I would not position Fangorn as a decentralized Netflix alone. That narrows a general-purpose protocol to one market, and streaming brings difficult licensing and distribution problems that you don't need to solve to demonstrate the core technology.

## 4. What I'd change about the website

I couldn't reliably retrieve the live homepage's rendered copy, so I don't want to pretend I've audited every line of the current page. Based on the published SDK description and your protocol documentation, however, I'd prioritize these changes.

A. State the user benefit before the mechanism

Don't open with Merkle structures, on-chain registration, encryption gadgets, or even knowledge graphs. Start with the problem of connecting agents to independently published data and capabilities.

B. Show the developer path

Put a working demo and a short quickstart near the top. Make it obvious what to install, how to publish a dataset, and how an agent consumes it. Show the actual request and response, including a paid-access example if that flow is ready.

C. Explain the abstraction correctly

I'd describe Fangorn as a protocol for publishing and discovering data, with applications emerging around that data. Avoid making it sound as though every developer must build a knowledge graph or deploy a bespoke backend.

D. Make the larger vision tangible

Show three very different applications using the same underlying protocol. For instance, a research agent, a personal media curator, and a paid specialist dataset. That demonstrates horizontal applicability much more convincingly than a long list of potential use cases.

## 5. My preferred headline

I'd test this first:

FANGORN

# The web is becoming agentic. Its data should be open for discovery.

Publish data once. Let agents discover it, use it, and pay for access — across applications, without bespoke integrations.

For developers

Open protocol

Agent-native commerce

&#x20;Copy headline

I prefer this to a purely technical headline because it establishes the shift Fangorn is responding to and immediately gives the visitor a reason to care. It also leaves room for the media-marketplace vision without making streaming the whole business.

One alternative, if you want to be more direct and less conceptual:

> One integration. A web of data and capabilities your agents can use.

That's probably the stronger developer headline. It makes a concrete promise, and a developer can immediately judge whether it's valuable.

## My bottom line

The most interesting idea here isn't simply "agents can use data" or "creators can sell content." Both are possible without Fangorn.

It's that independent publishers can make data and capabilities discoverable and usable across applications, while retaining control over how they're accessed.

That creates a potential bridge between two worlds that are usually treated separately: agent infrastructure and an open marketplace for digital content.

I'd build the website around that bridge. Lead with the developer value proposition, demonstrate it with a working cross-publisher agent workflow, and use the agentic Netflix concept as the memorable example of what a richer ecosystem could look like.

The question I'd use to judge every section of the site is simple: Does this help a developer understand what they can build with Fangorn, or help a publisher understand why they should publish through it? If it does neither, it probably doesn't belong on the homepage.