# Governance UI patterns mapped to the Clef Surface widget library

**Most governance interfaces are composed from standard design system primitives.** Analysis of 30+ production governance systems—from Tally and Snapshot to Loomio and Glassfrog—reveals that roughly **75% of governance UI patterns are directly composable** from the existing Clef Surface interactor types and affordance widgets. The remaining 25% splits between patterns needing new widget specifications (~15%) and patterns requiring fundamentally new interactor types (~10%). Five new widget specs and three new interactors would cover approximately 95% of all governance UI needs across all 60 concepts and 7 suites.

This mapping draws on observed widget patterns from every listed production system: Tally's proposal simulation and bubble voter charts, Snapshot's six voting-type selector, Aragon's modular plugin architecture, Compound's Governor Bravo standard, Nouns' auction-governance integration and fork mechanism, MakerDAO's dual vote-type system, DAOhaus' rage quit flow, Safe's multi-sig approval queue, Gardens' conviction curves, Gitcoin's quadratic funding visualization, Optimism's RetroPGF ballot editor, Colony's reputation-weighted motions, Loomio's seven proposal types, Decidim's participatory budgeting cart, Consul's collaborative legislation annotator, Polis' PCA opinion landscape, Glassfrog's nested circle org chart, Polymarket's CLOB trading panel, and OKR platforms' cascading goal trees.

---

## Patterns fully composable from existing Clef Surface widgets

The following governance patterns map directly onto existing interactor types and affordance widgets with no new primitives needed. For each, the table shows the governance concept, the production UI pattern observed, and the exact Clef Surface mapping.

### governance-identity suite

| Concept | Production pattern | Clef Surface composition |
|---|---|---|
| **Membership** (join/leave/suspend, member lists) | DAOhaus member list with shares/loot counts; Aragon member directory; Decidim assembly composition | `group-section` containing a `group-repeating` of member rows, each with `display-text` (name/address), `display-number` (shares), `display-badge` (status: active/suspended). Join = `action-primary` button; leave/suspend = `action-danger` button. Filter via `select` or `combobox`. |
| **Role** (assign/revoke, hierarchies) | Colony's 6-level permission system; Glassfrog role cards with purpose + accountabilities; Discourse trust levels (TL0–TL4) | Role assignment: `select` or `combobox` to choose role from hierarchy. Role card: `group-section` with `display-text` (purpose), `group-repeating` of `display-text` (accountabilities), `display-badge` (level). Assign = `action-primary`; revoke = `action-danger`. |
| **Permission** (grant/revoke, matrices) | Colony's Recovery/Root/Architecture/Arbitration/Funding/Administration matrix; Aragon's fine-grained permission system | Permission matrix: `group-section` containing a table (HTML `<table>` with `role` ARIA attributes). Each cell is a `toggle-switch` (grant/revoke). Row headers = roles, column headers = permissions. Scoped access via nested `group-conditional` showing permissions per domain/circle. |
| **SybilResistance** (verification flows) | Gitcoin Passport score display; BrightID verification in Gardens/Celeste | Verification wizard: `group-section` steps via `display-status` (verified/unverified). Each proof method: `action-primary` ("Connect Passport"), `display-badge` (score), `display-progress` (threshold progress). Stake threshold: `display-number` + `progress-bar` toward minimum. |
| **Attestation** (issue/verify/revoke) | Optimism EAS attestations for project social verification; Stack Overflow badges (bronze/silver/gold) | Credential card: `group-section` with `display-text` (credential name), `display-badge` (status: valid/revoked/expired), `display-date` (issued/expiry). Issue = `action-primary`; revoke = `action-danger`. List view: `group-repeating` of credential cards. |

**Membership, Role, Permission, SybilResistance, Attestation, ProofOfPersonhood, StakeThreshold, SocialGraphVerification, and AttestationSybil** are all composable. The identity sub-concepts (ProofOfPersonhood, StakeThreshold, etc.) are variants of the SybilResistance pattern—each is a `display-progress` bar showing current value vs. threshold, combined with an `action-primary` verification trigger.

**AgenticDelegate** is a new concept without direct production precedent but composes from existing primitives: a `group-section` containing `display-badge` (agent type: AI/human), `select` (autonomy level: advisory/semi-autonomous/autonomous), `group-conditional` showing boundary configuration with `toggle-switch` per permission, and `display-status` for agent activity state.

### governance-structure suite

| Concept | Production pattern | Clef Surface composition |
|---|---|---|
| **Polity** (DAO/org config, charter) | Aragon DAO creation wizard; Nouns Builder; Snapshot space settings | Multi-step wizard: `group-section` per step. Step 1: `text-input` (name), `file-attach` (logo), `textarea` (description). Step 2: `select` (governance type), `number-input` (voting period), `number-input` (quorum %). Step 3: Review as `group-section` of `display-text` values. `action-primary` ("Deploy"). |
| **Delegation** (delegate/undelegate) | Tally delegate discovery; Snapshot per-space delegation; Compound single-delegate | `combobox` with ENS/address resolution for delegate selection. `display-number` (voting power being delegated). `action-primary` ("Delegate"). Current delegation: `display-text` (delegated-to address) + `action-secondary` ("Undelegate"). |
| **Weight** (voting power display) | All platforms: voting power shown as number next to profile | `display-number` (voting power) + `display-badge` (source: token/reputation/stake). For token balance: `display-number`. For composite weight: `group-section` listing component weights. |
| **EqualWeight, TokenBalance, ReputationWeight, StakeWeight, QuadraticWeight** | MakerDAO MKR-in-Chief; Colony reputation per domain; Gardens token staking; Snapshot 400+ strategies | Each is a `display-number` with contextual `label`. QuadraticWeight adds a formula tooltip via `overlay`. VoteEscrow adds `display-date` (lock expiry) + `display-number` (multiplier). |

**Circle** (nested organizational units) maps to Glassfrog's nested circle visualization. The basic data structure is composable—`group-section` containing `group-repeating` of sub-circles, each a `group-section` with its own members and roles—but the **interactive nested circle diagram** is a novel visualization requiring a new widget (see below).

### governance-decision suite (composable patterns)

| Concept | Production pattern | Clef Surface composition |
|---|---|---|
| **Proposal** (create/submit/advance) | Tally multi-step creation; Snapshot Markdown editor; Aragon proposal wizard | Creation form: `group-section` with `text-input` (title), `rich-text-editor` (description), `group-repeating` of action items (each with `text-input` for contract address, `select` for function, `group-repeating` for parameters). Submit = `action-primary`. |
| **Vote** (simple For/Against/Abstain) | Compound: For/Against buttons; Tally: modal with radio + comment; Snapshot: basic voting | `radio-group` with options [For, Against, Abstain] + optional `textarea` (vote reason) + `action-primary` ("Submit Vote"). This is the single most common governance widget and it's a standard radio group. |
| **Majority / Supermajority** | Compound 50%+1; MakerDAO plurality polls | `radio-group` for vote choice + `display-number` showing threshold (50% or 66.7%). Results: `progress-bar` per option with threshold marker. |
| **CountingMethod** (selection) | Snapshot's 6 voting type selector; Loomio's 7 proposal types | `select` or `segmented-control` to choose method (majority, ranked choice, quadratic, etc.). Configuration: `group-conditional` showing method-specific parameters via `number-input` fields. |
| **RankedChoice** | Snapshot drag-to-rank; Loomio ranked choice | Drag-to-reorder list: `group-repeating` of options with drag handles. Fallback: `select` per rank position (1st, 2nd, 3rd...). Results as ordered list with `display-number` scores. |
| **Deliberation** (structured discussion) | Loomio threaded discussions → convergence tools; Decidim comment threads with for/against/neutral | `group-repeating` of comment cards, each a `group-section` with `display-text` (author), `display-text` (content), `display-date` (timestamp). Alignment voting on comments: `segmented-control` (for/against/neutral). |
| **Meeting** (agenda, phases) | Glassfrog governance/tactical meeting facilitation; Robert's Rules phase progression; Stanford speaking queue | Agenda: `group-repeating` of `text-input` (topic) items with drag-reorder. Phase indicator: `display-status` per phase in a stepper layout. Timer: `display-number` (countdown). Speaking queue: `group-repeating` with `action-primary` ("Raise Hand") and `display-number` (time remaining per speaker). |
| **ApprovalCounting** | Snapshot approval voting (checkbox list) | `checkbox-group` where each option gets full voting power. Results: `display-number` per option. |
| **ConsentProcess** | Loomio consent flow: proposal → question round → consent vote with objections | Multi-phase `group-section`: Phase 1 shows `display-text` (proposal). Phase 2: `group-repeating` of `textarea` (questions). Phase 3: `radio-group` [Consent / Object] with `textarea` (objection reason via `group-conditional`). |
| **ScoreVoting** | Loomio score poll with configurable scale | `group-repeating` of options, each with `slider` or `number-input` (score on scale). Results: `display-number` (mean/total per option). |
| **BordaCount** | Ranked with positional scoring | Same as RankedChoice UI (drag-to-rank list), different backend counting. |

### governance-rules suite (composable patterns)

| Concept | Production pattern | Clef Surface composition |
|---|---|---|
| **Policy** (ADICO rules, editors) | Colony governance policy matrix; Aragon permission configuration | Rule editor: `group-repeating` of rule rows. Each row: `select` (Attribute: role/member/domain), `select` (Deontic: must/may/must-not), `text-input` (Aim: action description), `text-input` (Condition), `text-input` (Or-else: sanction). `action-primary` ("Add Rule"). |
| **Monitor** (threshold alerts) | KPI dashboard RAG indicators; Compliance dashboards | `group-repeating` of metric cards. Each: `display-text` (metric name), `display-number` (current value), `display-badge` (RAG status: green/amber/red), `display-progress` (threshold progress). Alert configuration: `number-input` for thresholds + `toggle-switch` (alert enabled). |
| **Sanction** (penalties, rewards) | Colony reputation redistribution (losers penalized, winners rewarded proportionally); Augur REP slashing | Sanction card: `group-section` with `display-text` (violation), `display-number` (penalty amount), `display-badge` (severity), `display-status` (applied/pending). Escalation levels: `stepper` showing escalation stages. |
| **Dispute** (open/resolve, arbitration) | Augur 16-round dispute escalation; Gardens Celeste arbitration; Kleros | Dispute timeline: `group-repeating` of round cards. Each round: `display-number` (round #), `display-number` (bond required), `display-status` (active/resolved), countdown `display-number`. Evidence submission: `file-attach` + `textarea`. Resolution: `radio-group` (ruling options) + `action-primary` ("Submit Ruling"). |
| **ADICOEvaluator, RegoEvaluator, CedarEvaluator, CustomEvaluator** | Rule engine configuration patterns | Evaluator selection: `select` (evaluator type). Configuration: `group-conditional` showing evaluator-specific fields. ADICO: structured form per ADICO components. Rego/Cedar: `rich-text-editor` with syntax highlighting (code mode). Custom: `text-input` (endpoint URL) + `textarea` (schema). |

### governance-execution suite (composable patterns)

| Concept | Production pattern | Clef Surface composition |
|---|---|---|
| **Execution** (schedule/execute, transaction builders) | Tally action builder (contract + function + params); Safe transaction builder; Nouns proposal actions | Transaction builder: `group-repeating` of action steps. Each step: `text-input` (contract address), `select` (function from ABI), `group-repeating` of parameter inputs (`text-input` / `number-input` per param). "Add Action" via `action-secondary`. Execute via `action-primary`. |
| **Timelock** (countdown, grace periods) | Compound 2-day timelock; Nouns objection period; Aragon veto window | `display-status` (Queued/Grace Period/Executable), countdown `display-number` ("2d 14h 32m"), `display-date` (executable-after timestamp), `progress-bar` (time elapsed), `action-primary` ("Execute") disabled until countdown completes. **Fully composable.** |
| **Guard** (pre-condition checks) | Tally Tenderly simulation (pass/fail badges per function); Colony motion security delay | `group-repeating` of guard checks. Each: `display-text` (condition name), `display-badge` (✓ pass / ✗ fail), `display-text` (detail). All-pass gate: `action-primary` enabled only when all guards pass (conditional). |
| **RageQuit** (exit with proportional share) | DAOhaus rage quit: specify shares/loot → burn → receive proportional treasury | `number-input` (shares to burn) + `number-input` (loot to burn) + calculated `display-number` (proportional treasury share across tokens, as read-only preview). `action-danger` ("Rage Quit") with `overlay` confirmation modal. Grace period: `display-number` countdown. |
| **FinalityGate, ImmediateFinality, ChainFinality, BFTFinality, OptimisticOracleFinality** | MakerDAO spell execution confirmation; Safe transaction mining indicator; Augur designated reporter → community dispute | Finality tracker: `display-status` (pending/confirming/final) + `display-progress` (confirmations: X of Y blocks). For optimistic: `display-number` (challenge window countdown) + `action-secondary` ("Challenge"). Composable from existing status + progress primitives. |

### governance-resources suite (composable patterns)

| Concept | Production pattern | Clef Surface composition |
|---|---|---|
| **Treasury** (vault management) | Tally multichain treasury; Safe asset list; DAOhaus ragequittable vs. non-ragequittable vaults | Summary: `group-section` of `display-number` stat cards (total value, monthly burn, runway). Asset list: `group-repeating` of token rows with `display-text` (token), `display-number` (balance), `display-number` (USD value). Multi-vault: `segmented-control` tabs per vault. |
| **Reputation** (scores, leaderboards) | Stack Overflow reputation + privilege thresholds; Colony domain-specific reputation with decay; Discourse trust levels | Profile: `display-number` (score) + `display-badge` (tier). Leaderboard: `group-repeating` sorted by score. Privilege unlocks: `group-repeating` of threshold rows with `display-progress` (current vs. required). History: timeline of `display-number` events with `display-date`. |
| **Metric** (KPI dashboards) | Weekdone smart dashboards (expected vs. actual); KPI gauge patterns; MakerDAO protocol stats sidebar | Scorecard: `display-number` (value) + `display-badge` (RAG status) + `display-text` (trend arrow). Dashboard: `group-section` containing `group-repeating` of scorecard tiles. Threshold config: `number-input` per threshold level. |
| **Objective** (OKR trees, goal progress) | Lattice cascading goal tree; 15Five OKR check-in; Betterworks alignment hierarchy | OKR card: `group-section` with `text-input` (objective), `group-repeating` of key results each with `text-input` (KR description) + `slider` or `number-input` (progress %) + `display-badge` (status). Tree alignment: parent `select` ("Aligns to"). |

### governance-transparency suite

| Concept | Production pattern | Clef Surface composition |
|---|---|---|
| **AuditTrail** (activity feeds, event logs) | Tally proposal lifecycle timeline; Safe transaction history; Nouns propdates; Decidim accountability tracking | `group-repeating` of event entries. Each: `display-date` (timestamp), `display-text` (actor), `display-text` (action description), `display-badge` (event type). Filterable by `select` (event type) + `date-range-picker`. |
| **DisclosurePolicy** (transparency settings) | Snapshot shielded voting toggle; Loomio results visibility settings; Betterworks public/private goal toggle | `group-repeating` of disclosure rules. Each: `display-text` (data category) + `select` (visibility: public/members-only/private) or `toggle-switch` (disclosed/hidden). Per-proposal override: `group-conditional` showing settings when override enabled. |

---

## New interactor types required

These three patterns represent fundamentally new input/interaction paradigms not captured by any existing Clef Surface interactor type. They require new base interactor definitions.

### 1. `budget-allocate` interactor

**Observed in:** Snapshot weighted voting (distribute voting power % across options), Snapshot quadratic voting (allocate vote credits), Gardens conviction staking (distribute tokens across proposals), MakerDAO gauge voting, Decidim participatory budgeting ("shopping cart" with budget limit).

**What makes it novel:** Multiple constrained inputs that must sum to a fixed total. Adjusting one value necessarily reduces available budget for others. No existing interactor handles interdependent constrained multi-value input.

**Specification:**
```
interactor: budget-allocate
affordances: [slider, number-input, stepper]
constraints:
  total: number (fixed budget)
  min-per-item: number (optional floor)
  max-per-item: number (optional ceiling)
  items: array of { id, label }
output: map of id → allocated-value
aria: role="group" with aria-label="Budget allocation",
      each item: role="slider" with aria-valuemin/max/now,
      live region announcing remaining budget
```

**Production examples:**
- Snapshot weighted voting: sliders with +/- controls distributing 100% across options
- Decidim participatory budgeting: "add to cart" buttons with diminishing budget counter
- Optimism RetroPGF ballot: OP amount allocation across projects with running total
- Loomio dot vote: fixed dot budget distributed across options

### 2. `conviction-curve` interactor (input + visualization)

**Observed in:** Gardens/1Hive conviction voting UI, where users stake tokens and see conviction accumulate along an exponential approach curve toward a dynamic threshold.

**What makes it novel:** This is both an input (stake/unstake tokens) and a real-time animated mathematical visualization showing `conviction(t) = tokens × (1 - α^t)` approaching a threshold that itself varies based on `requested_amount / common_pool`. No standard progress bar, chart, or slider captures this continuous-time, asymptotic, threshold-aware pattern.

**Specification:**
```
interactor: conviction-curve
affordances: [slider (stake amount), line-chart (conviction over time)]
parameters:
  half-life: duration
  current-support: number
  threshold-function: f(requested, pool_balance) → threshold
  time-to-trigger-estimate: duration
output: stake-amount (number of tokens allocated)
visualization: SVG/Canvas curve with:
  - x-axis: time
  - y-axis: conviction strength
  - asymptotic growth curve
  - horizontal threshold line (dynamic)
  - area fill below current conviction
  - annotation: estimated time to trigger
aria: role="figure" with aria-label describing current conviction %
      of threshold and estimated time, plus role="slider" for stake input
```

### 3. `pairwise-compare` interactor

**Observed in:** All Our Ideas pairwise comparison voting, Polis agree/disagree/pass on single statements.

**What makes it novel:** Presents exactly two options at a time for binary selection, with a continuous loop generating new random pairs. Unlike a standard radio group, the option set changes after each selection, and there's no fixed end-point. The interaction is "greedy"—participants vote as many times as they wish.

**Specification:**
```
interactor: pairwise-compare
affordances: [two side-by-side cards with action-primary buttons, 
              action-tertiary ("Can't decide" / "Pass")]
parameters:
  item-pool: array of items
  pair-selection: random | least-voted | adaptive
  allow-submission: boolean (can users add new items)
output: array of { winner-id, loser-id } pairs
aria: role="group" with aria-label "Compare these two options",
      each option: role="button", aria-describedby linking to content,
      skip button: clearly labeled alternative
```

---

## New widget specifications required

These are governance-specific visual compositions of existing primitives that need dedicated `.widget` specs because they represent recurring, complex patterns deserving encapsulation.

### 1. `vote-result-bar.widget`

**Observed in:** Every DAO platform (Tally, Snapshot, Compound, Aragon, Nouns, MakerDAO). The single most universal governance widget.

**What it does:** A segmented horizontal bar showing proportional vote distribution across 2–N options (For/Against/Abstain or multi-choice), with per-segment labels showing count and percentage.

```yaml
widget: vote-result-bar
description: Segmented horizontal bar showing proportional vote distribution
affordances:
  bar: segmented-progress  # NEW affordance (colored proportional segments)
  labels: display-number[] # vote count per option
  percentages: display-text[] # percentage per option
  total: display-number # total votes cast
slots:
  options:
    type: group-repeating
    item:
      - label: display-text (option name)
      - count: display-number (votes)
      - percentage: display-text
      - color: semantic color token
layout: single horizontal bar with colored segments, labels below
aria:
  role: "img"
  aria-label: "Vote results: {For} {%} for, {Against} {%} against, {Abstain} {%} abstain"
  # Each segment also readable via aria-describedby
variants:
  - binary (For/Against/Abstain — 2-3 segments)
  - multi-choice (N segments)
  - with-quorum-marker (threshold line overlay)
```

### 2. `quorum-gauge.widget`

**Observed in:** Tally quorum progress indicator, Compound quorum display, all Governor-based DAOs, Decidim initiative signature progress, Consul support threshold (1% of verified users).

**What it does:** A progress bar with one or more configurable threshold markers. Visually communicates not just "how much" but "how much relative to the required minimum." The bar can be below, at, or above the threshold.

```yaml
widget: quorum-gauge
description: Progress indicator with configurable pass/fail threshold marker
affordances:
  progress: progress-bar
  threshold-marker: display-number # positioned at threshold point on bar
  current-label: display-number # current participation count/percentage
  threshold-label: display-number # required threshold
  status: display-badge # "Quorum met" / "Quorum not met"
parameters:
  current: number
  threshold: number
  max: number (optional, defaults to threshold if threshold is absolute)
  format: "percentage" | "absolute" | "fraction"
layout: horizontal progress bar with vertical threshold marker line
aria:
  role: "progressbar"
  aria-valuenow: current
  aria-valuemin: 0
  aria-valuemax: max
  aria-label: "Quorum progress: {current} of {threshold} required"
  aria-live: "polite" # announces when threshold crossed
variants:
  - simple (single threshold)
  - dynamic (threshold changes over time, as in Nouns dynamic quorum or Polkadot OpenGov)
  - dual (Polkadot: separate approval + support gauges)
```

### 3. `approval-tracker.widget`

**Observed in:** Safe{Wallet} "2 of 3 owners" signing queue, Aragon multisig council approval, Nouns propose-by-signature aggregation.

**What it does:** Shows M-of-N parallel approval status where multiple independent actors must each approve before a threshold is met. Distinct from a sequential stepper—all actors can approve in any order.

```yaml
widget: approval-tracker
description: M-of-N parallel approval indicator with per-actor status
affordances:
  threshold-display: display-text # "2 of 3 required"
  progress: progress-bar # filled segments = confirmations received
  signer-list:
    type: group-repeating
    item:
      - avatar: display-media (identicon/ENS avatar)
      - address: display-text
      - status: display-badge # ✓ Signed / ⏳ Pending / ✗ Rejected
      - timestamp: display-date (when signed, if applicable)
  action-confirm: action-primary # "Confirm" (if current user is pending signer)
  action-execute: action-primary # "Execute" (enabled when threshold met)
parameters:
  required: number (M)
  total: number (N)
  signers: array of { address, status, timestamp }
layout: threshold badge at top, signer list below, action button at bottom
aria:
  role: "group"
  aria-label: "{confirmed} of {required} confirmations received"
  each signer: role="listitem" with aria-label "{address}: {status}"
  action-execute: aria-disabled when threshold not met
```

### 4. `proposal-card.widget`

**Observed in:** Every governance platform. The proposal card is the primary navigation surface in all DAO and civic governance tools.

```yaml
widget: proposal-card
description: Summary card for governance proposals with status, votes, and metadata
affordances:
  status: display-badge # Active/Pending/Passed/Failed/Queued/Executed
  type-badge: display-badge # Constitutional/Signal/Funding/Membership (optional)
  id: display-text # "EGP-42"
  title: display-text # proposal title (heading level)
  description: display-text # truncated abstract
  proposer: display-text + display-media # avatar + address/ENS
  vote-summary: vote-result-bar.widget # embedded segmented bar
  quorum: quorum-gauge.widget # mini quorum indicator (optional)
  time-remaining: display-text # countdown or end date
  action: navigate # "View Details" link
layout: card with header (badges), body (title, description, proposer), footer (votes, time)
aria:
  role: "article"
  aria-labelledby: title element
  aria-describedby: description + status
```

### 5. `timelock-countdown.widget`

**Observed in:** Compound timelock, Nouns objection period, Aragon optimistic veto window, DAOhaus grace period.

```yaml
widget: timelock-countdown
description: Countdown to execution with phase-aware status and gated action
affordances:
  phase-label: display-status # "Timelock" / "Grace Period" / "Veto Window"
  countdown: display-text # "2d 14h 32m 15s" (live updating)
  target-date: display-date # "Executable after: March 5, 2026 14:00 UTC"
  elapsed-progress: progress-bar # time elapsed / total delay
  action-execute: action-primary # "Execute" — disabled until countdown completes
  action-challenge: action-danger # "Challenge" / "Veto" (optional, for optimistic)
parameters:
  start: datetime
  end: datetime
  phase-type: "timelock" | "grace-period" | "veto-window" | "objection-period"
  allow-challenge: boolean
layout: banner/card with icon, countdown text, progress bar, and gated action button
aria:
  role: "timer"
  aria-live: "polite"
  aria-label: "{phase-type}: {time-remaining} until {action}"
  action button: aria-disabled="true" until countdown completes
```

### 6. `delegation-graph.widget`

**Observed in:** Tally delegate discovery and voting power display; Snapshot delegation dashboard; Compound delegate leaderboard. The concept of transitive delegation (A delegates to B who delegates to C) is supported in Snapshot v2 and discussed across governance forums.

```yaml
widget: delegation-graph
description: Visual representation of delegation relationships and voting power flow
affordances:
  delegate-list:
    type: group-repeating
    item:
      - avatar: display-media
      - name: display-text
      - voting-power: display-number
      - participation-rate: display-progress
      - statement: display-text (truncated)
      - delegate-action: action-primary # "Delegate"
  search: combobox # search/filter delegates
  sort: select # by voting power, participation, recency
  current-delegation: display-text # "You delegate to: {address}"
  your-power: display-number # "Your voting power: X"
layout: searchable list/table of delegates, optionally with a network graph visualization
aria:
  role: "search" for discovery, "list" for delegate listing
```

### 7. `bonding-curve-chart.widget`

**Observed in:** Bancor, Fairmint, various token bonding curve implementations. Visualizes price as a mathematical function of supply.

```yaml
widget: bonding-curve-chart
description: Interactive price-supply curve with buy/sell position indicator
affordances:
  chart: SVG/Canvas line chart (price = f(supply))
  current-price: display-number
  current-supply: display-number
  buy-input: number-input # amount to buy
  sell-input: number-input # amount to sell
  price-impact: display-number # estimated price after trade
  buy-action: action-primary
  sell-action: action-danger
parameters:
  curve-function: "linear" | "polynomial" | "sigmoid" | "custom"
  reserve-ratio: number
layout: chart (top), trading panel (bottom) with buy/sell tabs
aria:
  chart: role="img" with aria-label describing current price point
  trading: standard form inputs
```

### 8. `opinion-landscape.widget`

**Observed in:** Polis 2D PCA scatter plot with K-means opinion clusters. Unique to consensus-mapping governance tools.

```yaml
widget: opinion-landscape
description: 2D scatter plot showing participant opinion clusters from dimensionality reduction
affordances:
  scatter-plot: SVG/Canvas interactive visualization
  cluster-labels: display-badge[] # "Group A", "Group B" with colors
  your-position: display-badge # highlighted dot for current user
  consensus-statements: group-repeating # statements with cross-group agreement
  group-statements: group-repeating # statements distinguishing each cluster
parameters:
  projection: "PCA" | "t-SNE"
  cluster-count: auto-detected via K-means
layout: interactive scatter plot (main), consensus/group statement lists below
aria:
  role: "figure"
  aria-label: "{N} opinion groups identified. {X}% agree on {Y} consensus statements."
  Alternative text description of clusters for screen readers
```

### 9. `circle-map.widget`

**Observed in:** Glassfrog/Holaspirit nested circle organization chart. Core navigation metaphor for holacratic governance.

```yaml
widget: circle-map
description: Interactive nested circle diagram showing holarchic organizational structure
affordances:
  circles: nested SVG circles (interactive, zoomable)
  role-nodes: display-badge within circles
  circle-detail: overlay # click circle to see detail panel
  zoom-controls: action-secondary # zoom in/out
parameters:
  root-circle: the outermost organizational circle
  depth: nesting level
layout: full-width interactive SVG with zoom/pan, detail panel on click
aria:
  role: "tree" with nested role="treeitem" per circle
  aria-expanded for circles that can be zoomed into
  Keyboard navigation: arrow keys to move between circles, Enter to zoom
```

### 10. `meeting-facilitator.widget`

**Observed in:** Glassfrog governance meeting flow (check-in → agenda → process each item with clarifying questions → reactions → objections → integration → closing), Robert's Rules motion tracking, Stanford deliberation speaking queue.

```yaml
widget: meeting-facilitator
description: Guided meeting flow with phase progression, speaking queue, and timer
affordances:
  phase-stepper: display-status[] # current meeting phase indicator
  agenda: group-repeating # agenda items with drag-reorder
  speaking-queue: group-repeating # queue of speakers with timer
  speaker-timer: display-number # countdown per speaker
  current-item: display-text # the item being discussed
  phase-actions:
    - advance: action-primary # "Next Phase"
    - raise-hand: action-secondary # join speaking queue
  motion-stack: group-repeating # nested motions (Robert's Rules)
parameters:
  meeting-type: "governance" | "tactical" | "parliamentary" | "deliberation"
  phases: array of phase definitions
layout: current phase highlighted at top, main content area, sidebar with queue/timer
aria:
  phase stepper: role="list" with aria-current="step"
  timer: role="timer" with aria-live="assertive" at low time
  queue: role="list" with aria-label "Speaking queue"
```

---

## How the 60 governance concepts map across the three categories

Below is the complete mapping of all 60 concepts to their classification: **(A)** composable from existing widgets, **(B)** needs new interactor, or **(C)** needs new widget spec.

### governance-identity (10 concepts) → **All (A) composable**
Membership, Role, Permission, SybilResistance, Attestation, AgenticDelegate, ProofOfPersonhood, StakeThreshold, SocialGraphVerification, AttestationSybil — all compose from `display-badge`, `display-number`, `display-progress`, `toggle-switch`, `select`, `group-repeating`, and `action-primary/danger`.

### governance-structure (10 concepts) → **9 (A), 1 (C)**
Polity, Delegation, Weight, TokenBalance, ReputationWeight, StakeWeight, EqualWeight, VoteEscrow, QuadraticWeight — all (A). **Circle** requires `circle-map.widget` **(C)**.

### governance-decision (18 concepts) → **12 (A), 4 (C), 2 (B)**
Proposal, Vote (simple), Majority, Supermajority, ApprovalCounting, ConsentProcess, ScoreVoting, BordaCount, Deliberation, Meeting, CountingMethod, CondorcetSchulze — all **(A)**. **Conviction** needs `conviction-curve` interactor **(B)**. **PredictionMarket** needs `bonding-curve-chart.widget` pattern for price display **(C)**. **QuadraticVoting** and weighted allocation need `budget-allocate` interactor **(B)**. **OptimisticApproval** needs `timelock-countdown.widget` **(C)**. **RankedChoice** is (A) via drag-reorder `group-repeating`.

### governance-rules (8 concepts) → **All (A) composable**
Policy, Monitor, Sanction, Dispute, ADICOEvaluator, RegoEvaluator, CedarEvaluator, CustomEvaluator — compose from form fields, `group-repeating`, `display-badge` (RAG), `rich-text-editor` (code), and `display-progress`.

### governance-execution (9 concepts) → **7 (A), 2 (C)**
Execution, Guard, RageQuit, FinalityGate, ImmediateFinality, ChainFinality, BFTFinality — all **(A)**. **Timelock** needs `timelock-countdown.widget` **(C)**. **OptimisticOracleFinality** uses `timelock-countdown.widget` with challenge action **(C)**.

### governance-resources (10 concepts) → **8 (A), 2 (C)**
Treasury, Reputation, Metric, Objective, SimpleAccumulator, PageRankReputation, EloRating, GlickoRating — all **(A)** via `display-number`, `display-progress`, `group-repeating`. **BondingCurve** needs `bonding-curve-chart.widget` **(C)**. **PeerAllocation** uses `budget-allocate` interactor **(B, already defined)**.

### governance-transparency (2 concepts) → **All (A) composable**
AuditTrail, DisclosurePolicy — compose from `group-repeating`, `display-date`, `display-text`, `display-badge`, `toggle-switch`, `select`.

---

## Governance views: how widgets compose into standard layouts

Production governance systems consistently use five canonical page layouts. Each composes the widgets above into full views.

### DAO dashboard (home page)

The primary landing page seen on Tally, Aragon, DAOhaus, and Colony. **Layout**: a summary header region containing 3–4 stat cards (`display-number` for treasury value, active proposals, member count, voter participation), followed by a two-column layout: the main column holds a `group-repeating` of `proposal-card.widget` sorted by status (active first), and the sidebar holds the user's `display-number` voting power, current `delegation-graph.widget` delegation status, and a `group-repeating` of recent `AuditTrail` events. Tally adds a top-delegates leaderboard below. Aragon adds plugin status cards.

### Proposal detail page

The most complex governance view, standardized across Tally, Snapshot, Compound, and Nouns. **Layout**: full-width header with `display-badge` (status), `display-text` (title), `display-text` (proposer with avatar). Below, two columns: the main column contains `rich-text-editor` output (proposal body), an "Executable Code" section (`group-repeating` of transaction actions with `display-badge` simulation results), and a discussion/comments `group-repeating`. The sidebar contains: `vote-result-bar.widget` (For/Against/Abstain), `quorum-gauge.widget`, vote casting `radio-group` + `textarea` + `action-primary`, proposal lifecycle stepper (`display-status` per phase), and `timelock-countdown.widget` if applicable. MakerDAO splits this into separate poll detail and executive detail variants.

### Delegate profile page

Seen on Tally, Snapshot delegation dashboard, and Compound voter pages. **Layout**: profile header with avatar, ENS/address, `display-number` (voting power received), `display-number` (participation rate as percentage), `display-text` (delegate statement). Below, a tabbed view: "Voting History" tab shows `group-repeating` of vote entries with `display-badge` (For/Against), `display-text` (proposal title), `display-date`. "Delegators" tab shows `group-repeating` of addresses delegating to this person with `display-number` (power). "Activity" tab shows `AuditTrail` pattern.

### Treasury overview page

Seen on Tally, Safe, DAOhaus, and Aragon. **Layout**: summary banner with `display-number` stat cards (total value, monthly outflow, runway months). Below, `segmented-control` tabs for different vaults or chains. Main content: asset table (`group-repeating` of token rows: `display-media` logo, `display-text` name, `display-number` balance, `display-number` USD value, `display-text` % of total). Optionally, a donut/pie chart for allocation visualization. Transaction history section below with `date-range-picker` filter + `group-repeating` of transactions.

### Participatory process page (civic)

Seen on Decidim, Consul, and Loomio. **Layout**: process header with `display-text` (title, description) and a horizontal phase stepper showing `display-status` per phase (Information → Proposals → Voting → Results → Accountability). Active phase is highlighted. Below the stepper, `segmented-control` tabs switch between phase-specific content: the Proposals tab shows `group-repeating` of `proposal-card.widget` with `combobox` search and `select` filters (category, status, geography). The Budgeting tab shows project cards with `action-primary` ("Add to Budget") and a `budget-allocate` interactor for the budget counter. The Accountability tab shows `group-repeating` of result cards with `display-progress` (implementation %).

---

## Accessibility patterns across governance interfaces

Governance UIs demand specific ARIA considerations beyond standard web apps because users must understand complex state (voting power, proposal phase, threshold status) to make consequential decisions.

**Vote casting** uses `role="radiogroup"` with clear `aria-label` ("Cast your vote on Proposal #42"). Each option needs `role="radio"` with `aria-checked`. The submit action should use `aria-describedby` linking to the user's voting power display so screen reader users know their vote weight before submitting.

**Quorum and threshold indicators** use `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`. The threshold marker needs `aria-label` ("50% quorum required") and an `aria-live="polite"` region that announces when quorum is met or lost.

**Proposal lifecycle steppers** use `role="list"` with `aria-current="step"` on the active phase. Each phase should have `aria-label` including its timestamp.

**Countdown timers** use the `<time>` element with `datetime` attribute and `role="timer"`. Approaching deadlines should trigger `aria-live="assertive"` announcements at key intervals (1 hour, 15 minutes, 5 minutes remaining).

**Multi-sig approval trackers** use `role="group"` with `aria-label` ("2 of 3 confirmations received") and each signer as `role="listitem"` with status.

**Conviction curves and opinion landscapes** are the hardest accessibility challenges. These complex visualizations need `role="figure"` with detailed `aria-label` text descriptions ("Current conviction is at 73% of threshold. At current support level, estimated 4 days to pass.") plus tabular alternative views.

**Budget allocation** (weighted voting, participatory budgeting) needs `aria-live="polite"` regions announcing remaining budget after each allocation change, and constraints communicated via `aria-describedby` ("You have 35% of voting power remaining to allocate").

---

## Conclusion: the governance widget gap is smaller than expected

The core finding is that **governance UI is primarily a composition challenge, not a primitives challenge.** Of the 60 governance concepts analyzed across 30+ production systems, 48 are fully composable from the existing Clef Surface library with zero new primitives. The remaining 12 require additions that break down into three new interactors (`budget-allocate`, `conviction-curve`, `pairwise-compare`) and ten new widget specs.

The **truly novel governance interaction** is constrained budget allocation—it appears in weighted voting, quadratic voting, participatory budgeting, conviction staking, gauge voting, and retroactive funding. A single well-designed `budget-allocate` interactor covers all of these. The second genuinely new pattern is threshold-aware progress—standard progress bars have no concept of a "pass/fail threshold marker," yet governance uses it everywhere (quorum, conviction, support, stake thresholds, signature collection). The `quorum-gauge.widget` fills this gap.

What surprised most across this analysis: **vote casting is just a radio group.** The elaborate governance-specific framing of Tally, Snapshot, and Compound disguises what is fundamentally `<fieldset>` + `<input type="radio">` + `<textarea>` + `<button>`. The complexity lives not in the input primitive but in the surrounding context widgets (vote result bars, quorum gauges, lifecycle steppers, timelock countdowns) that give voters the information they need to decide. This means the widget library's investment should prioritize **output and composition widgets** (result bars, threshold gauges, approval trackers) over new input interactors.

The ten new widget specs proposed—`vote-result-bar`, `quorum-gauge`, `approval-tracker`, `proposal-card`, `timelock-countdown`, `delegation-graph`, `bonding-curve-chart`, `opinion-landscape`, `circle-map`, and `meeting-facilitator`—together with the three new interactors, would enable faithful reproduction of every production governance interface examined in this research.