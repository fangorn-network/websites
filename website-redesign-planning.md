# Design Spec: Fangorn Landing Page Redesign

**Target Audience:** AI Coding Agent (Cursor, Claude Code, etc.)

**Objective:** Redesign the main landing page for **Fangorn** (`fangorn.network`), replacing the heavy terminal-focused layout with a sleek, high-contrast, developer-first landing page inspired by **Vercel, Resend, Supabase, and Raycast**.

---

## 1. Design System & Aesthetic Principles

* **Color Palette:** Dark-first UI (`#09090B` background, zinc/slate accents, high-contrast white text, subtle glowing borders).
* **Logo & Branding:** Clean wordmark (`Fangorn`) using tight geometric sans-serif typography with a high-contrast accent or subtle gradient fill. No emoji icons.
* **Typography:** Clean monospaced font for code/terminal (e.g., `JetBrains Mono` or `Fira Code`) paired with a tight, geometric sans-serif for headings (e.g., `Inter` or `Geist`).
* **Micro-Interactions:** Smooth Framer Motion transitions, subtle hover states, single-click copy buttons, and interactive tab toggles.
* **Layout Rule:** Zero noisy architecture diagrams. Use structured text, interactive preview cards, and bento grids to explain complex concepts.

---

## 2. Page Architecture Overview

1. **Navigation Bar** (Header)
2. **Hero Section** (Headline + Minimalist Data Pipeline Graphic + CTAs)
3. **Developer Quickstart Component** (Vercel-style tabbed command bar)
4. **Platform Features Bento Grid** (Supabase-style 4-card feature overview)
5. **Interactive Dual-Perspective Preview** (Resend-style Human UI vs. Agent View toggle)
6. **"Built on Fangorn" App Store Grid** (Raycast-style minimalist app cards)
7. **Footer**

---

## 3. Section-by-Section Implementation Specs

### Section 1: Navigation Bar

* **Left:** Brand wordmark (`Fangorn`) in bold geometric type with subtle hover glow.
* **Center/Right Links:** `Explorer ↗`, `Docs`, `Discord`, `GitHub`.
* **CTA Button:** `Log In` / `Connect Wallet` (Zinc outline style with subtle primary glow).

---

### Section 2: Hero Section

* **Inspiration:** *Pinecone / LlamaIndex (Minimalist Flow) + Vercel (Bold Copy)*
* **Headline:**
`Instant Intelligence for Agents and Humans.`
* **Subheadline:**
`Fuse disparate datasets into a knowledge graph, build embeddings, and deploy pluggable AI cartridges. Privacy-preserving apps for humans, one unified MCP for agents.`

* **Call to Action Buttons:**
* Primary: `Explore Apps ↗` (Solid white/bright accent, links to app directory)
* Secondary: `Deploy a Dataset` (Outline style)


* **Hero Visual Component (`<DataPipelineGraphic/>`):**
* A lightweight SVG line graphic with animated glowing pulses showing data flow:
`[ Raw Datasets ]` $\rightarrow$ `[ Knowledge Graph ]` $\rightarrow$ `[ Embeddings ]` $\rightarrow$ `[ Pluggable Cartridge ⚡ ]`




---

### Section 3: Developer Quickstart Component

* **Inspiration:** *Vercel CLI Widget*
* **Layout:** Centered terminal card with dark glassmorphism styling and top tab switches.
* **Tabs:**
* **Tab 1: `Claude MCP**`
* Display text:
```bash
claude mcp add fangorn -e FANGORN_LOG_WINDOW=100000 -- \
  npx -y -p @fangorn-network/westmarch -p @huggingface/transformers fangorn-mcp
```[cite: 1]

```


* Includes `Copy` button with instant checkmark feedback.


* Helper caption underneath: *"Paste this into your terminal. No account, no wallet required."*



* **Tab 2: `Claude Code Skills**`
* Display text:
```bash
/plugin marketplace add fangorn-network/westmarch
/plugin install fangorn-index@fangorn-index
```[cite: 1]

```


* Includes `Copy` button.







---

### Section 4: Platform Capabilities Bento Grid

* **Inspiration:** *Supabase Bento Grid*
* **Layout:** 4-card responsive grid (`2x2` on desktop, `1 col` on mobile).

#### Card A: Knowledge Graph & Embeddings



* **Title:** Fuse & Embed Any Dataset


* **Description:** Combine disparate datasets into an extensible knowledge graph, generate embeddings, and package them into lightweight, pluggable knowledge cartridges.



#### Card B: The One-MCP Rule



* **Title:** Install One MCP, Access Every App


* **Description:** Agents install a single Fangorn MCP to access all registered web apps via WebMCP tools and headless browser integration, enabling instant cross-app intelligence.



#### Card C: Per-Vertex Encryption & Monetization



* **Title:** Fine-Grained Access Control


* **Description:** Gate data access down to individual graph vertices. Monetize high-value data feeds and accept automated x402 payments.



#### Card D: ERC-8004 Agent Identity



* **Title:** On-Chain Identity & Reputation


* **Description:** Every app is registered as an ERC-8004 agent on-chain, earning verifiable reputation and building history over time.



---

### Section 5: Interactive Dual-Perspective Preview

* **Inspiration:** *Resend Interactive Code/Product Preview*
* **Component Name:** `<DualViewPreview/>`
* **Concept:** Show how a single dataset serves both human users and AI agents simultaneously.


* **Control Bar:** Header with two toggle tabs: `[ 👤 Human Experience ]` and `[ 🤖 Agent Experience ]`.


* **Content Panel:**
* **When `Human Experience` is selected:**
* Displays a simulated clean browser UI preview (e.g., searching clinical trials on Kingsfoil or local government votes on Quorum).


* Feature callouts: *Privacy-preserving static site*, *Lightning-fast vector search*, *100% offline ready*.




* **When `Agent Experience` is selected:**
* Displays a dark code editor preview showing an LLM making a WebMCP tool call and receiving structured graph query results.


* Feature callouts: *Zero custom MCP setup*, *Structured WebMCP schema*, *Automated paywall handling*.







---

### Section 6: "Built on Fangorn" App Store Grid

* **Inspiration:** *Raycast Extension Store*
* **Layout:** 3-column responsive card grid.
* **Card Anatomy:**
* Top Row: Category Pill (e.g., `HEALTH`, `CIVIC`, `WEATHER`) + ERC-8004 Reputation Badge (e.g., `Reputation #226`).


* Middle: App Title & Short Description.


* Stats Pill: Simple record count or data size (e.g., *"60,760 clinical trials"* or *"258 cities forecast"*).


* Action Bar: `Open App ↗` button + `WebMCP Ready` indicator pill.





#### Sample Apps to Render:

1. **Kingsfoil:**
* Category: `HEALTH`

* Description: Find clinical trials you qualify for, completely in-browser without logging queries.


* Subtext: *60,760 trials from ClinicalTrials.gov*



2. **Quorum:**
* Category: `CIVIC`

* Description: Local city council agendas, votes, and meeting minutes searchable by meaning.


* Subtext: *Gated access via x402*



3. **Nimbus:**
* Category: `WEATHER`

* Description: Live NWS warnings, 7-day forecasts, and historical storm events searchable by meaning.


* Subtext: *Prose forecasts for 258 US cities*




---

### Section 7: Footer

* **Left:** `Fangorn Network` copyright & tagline (*Data your agent can use*).


* **Right Links:** `Docs`, `GitHub`, `Discord`, `Privacy`.


---------

[10/5/2026 10:14 AM] Tony | Fangorn: here's what I was about to share btw: 
- https://openfridge.pages.dev/
- https://openbookshelf.pages.dev/#/
- https://sidequest-1mq.pages.dev/#/

These are all example apps that we built on top of the stack. They're intentionally simple for now, but it also showcases the e2e flow of everything we've built so far. Take a knowledge base, or many disparate datasets, fuse them in a graph, and then build embeddings. We then treat the resulting embeddings sort of like a game cartridge? pluggable agent database? I like to think of it like in the matrix when Neo suddenly learned Kung Fu

- build a knowledge graph (which can be extended/pruned at will) => build embeddings from the KG
- then take the embeddings and bundle them with a webapp (e.g. vite) and add a webmcp layer to it. 

Then we get two things in one:
1) for direct human interaction: a privacy-preserving static site with lightning fast search, integrated discovery and recommendation that doesn't spy on you, full functionality for free that even works offline, etc.
2) for agents: this is where things get really interesting imo. Instead of installing an MCP for each and every app, an agent only needs to install ONE MCP to be able to access ANY app registered on Fangorn. Then it spins up a headless chrome and can access any of the webmcp tools that aren't paywalled (else it can pay and use them). It can even do cross-app datamining/intelligence really easily this way.

We can also do per-vertex encryption and access control, meaning it can be used for monetizing or gating access to datasets at large, e.g. app.sond3r.com does this.

We've built out the markov kernel idea more as well, and it comes 'for free' when you build an  app using https://www.npmjs.com/package/@fangorn-network/westmarch (not ready yet, still needs some tweaks before we roll it out officially). Westmarch also has an agent skill that's useful for building fangorn apps. It follows a unique pattern that emerged out of some work I did at chainsafe - define a set of 'golden queries' that an app should be able to answer, then evaluate the dataset against these queries e.g. when new data is ingested in a nightly github action. If data quality or results degrade, then a PR is automatically opened to alert the app owner, and the data ingestion fails. Taking it a step further, we could use an agent to address the PR and attempt to make this a sort of self-improving database that better answers the golden queries over time.
[10/5/2026 10:21 AM] Tony | Fangorn: Each app also gets registered as an ERC-8004 agent, so earns reputation over time, has an identity, etc. https://testnet.8004scan.io/agents/arbitrum-sepolia/226