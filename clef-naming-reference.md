# Clef — Naming Reference

> **Clef** is a framework for composable software. You write independent concepts — spec-driven services with their own state. You wire them with syncs — declarative rules for when one concept triggers another. The sync engine runs it all. Bind generates every programmatic interface — REST, CLI, MCP, Claude Skills — so LLMs can use your app instantly. Surface generates cross-platform UIs from the same specs. Score makes your entire codebase queryable as data — every file, symbol, concept, sync, and runtime event becomes a traversable node that LLMs can reason over. Clef's Repertoire gives you battle-tested concepts across 16 suites, so you never reinvent the wheel.

**Tagline:** *"Define once. Compose everywhere."*

---

## Branded Terms

Only six terms carry the Clef brand. Everything else uses plain, self-describing language.

| Term | What it is | Used how |
|------|-----------|----------|
| **Clef** | The framework itself | "Built with Clef" |
| **Repertoire** | The standard library of reusable app-building concepts (16 suites) | "Check the Repertoire" |
| **Suite** | A bundle of related concepts | "The Identity Suite" |
| **Score** | The queryable representation of your entire app — code, structure, and runtime as data | "The Score shows which syncs have never fired" |
| **Surface** | UI generation system (React, SwiftUI, Compose, etc.) | "Clef Surface generates cross-platform UIs" |
| **Bind** | Programmatic interface generation (REST, GraphQL, CLI, MCP, SDKs) | "Run `clef bind` to regenerate the MCP server" |

---

## Core Architecture Terms (Plain, Not Branded)

These are technical terms that stay self-describing. No glossary needed.

| Term | What it is |
|------|-----------|
| **concept** | An independent, spec-driven service with its own state, actions, and purpose |
| **sync** | A declarative coordination rule between concepts |
| **action** | An operation a concept can perform |
| **completion** | The result of an action, tagged with a variant |
| **variant** | A named outcome of an action (ok, error, notfound, etc.) |
| **state** | A concept's owned data, defined as typed relations |
| **invariant** | A testable operational principle |
| **sync engine** | The runtime that matches completions and fires syncs |
| **manifest** | The language-neutral intermediate representation of a concept |
| **handler** | The generated code skeleton a developer fills in |
| **codegen** | Code generation from concept specs (not separately branded) |

---

## File Extensions

| File | Extension | Example |
|------|-----------|---------|
| Concept spec | `.concept` | `user.concept` |
| Sync spec | `.sync` | `registration-flow.sync` |
| Widget spec | `.widget` | `dialog.widget` |
| Theme spec | `.theme` | `light.theme` |
| Suite manifest | `suite.yaml` | `identity/suite.yaml` |
| Deploy manifest | `.deploy.yaml` | `production.deploy.yaml` |
| Interface manifest | `.interface.yaml` | `api.interface.yaml` |
| Project config | `clef.yaml` | `clef.yaml` |

---

## Project Structure

What `clef init` scaffolds and what grows from there.

```
my-app/
├── clef.yaml                    # Project config (name, version, target languages, adapters)
├── concepts/                    # Concept specs — one .concept file per concept
│   ├── user.concept
│   ├── article.concept
│   ├── comment.concept
│   └── ...
├── syncs/                       # Sync specs — one .sync file per coordination rule
│   ├── registration-flow.sync
│   ├── article-publish.sync
│   └── ...
├── widgets/                     # Widget specs (Surface) — one .widget file per widget
│   ├── dialog.widget
│   ├── article-card.widget
│   └── ...
├── themes/                      # Theme specs (Surface) — one .theme file per theme
│   ├── light.theme
│   └── dark.theme
├── interfaces/                  # Interface manifests (Bind) — what to generate and how
│   ├── api.interface.yaml       # REST + GraphQL config
│   ├── cli.interface.yaml       # CLI config
│   └── mcp.interface.yaml       # MCP server config
├── deploys/                     # Deploy manifests — environment-specific deployment config
│   ├── production.deploy.yaml
│   ├── staging.deploy.yaml
│   └── local.deploy.yaml
├── suites/                      # Custom suites (your app's own reusable bundles)
│   └── billing/
│       ├── suite.yaml
│       ├── invoice.concept
│       ├── payment.concept
│       └── invoice-payment.sync
├── handlers/                    # Developer-written handler implementations
│   ├── ts/                      # TypeScript handlers
│   │   ├── user.handler.ts
│   │   ├── article.handler.ts
│   │   └── ...
│   ├── rust/                    # Rust handlers (if targeting Rust)
│   └── ...
├── generated/                   # All generated code (do not edit)
│   ├── ts/                      # Generated TypeScript (types, stubs, sync engine wiring)
│   ├── rust/                    # Generated Rust
│   ├── graphql/                 # Generated GraphQL schemas
│   ├── openapi/                 # Generated OpenAPI specs
│   ├── react/                   # Generated React components (Surface)
│   ├── swiftui/                 # Generated SwiftUI views (Surface)
│   └── ...
├── bind/                        # Generated interface entry points (Bind)
│   ├── rest/                    # REST server
│   ├── cli/                     # CLI binary
│   ├── mcp/                     # MCP server
│   ├── claude-skills/           # Claude Skill definitions
│   ├── sdk-ts/                  # TypeScript SDK
│   └── ...
├── tests/                       # Test files
│   ├── conformance/             # Auto-generated conformance tests
│   ├── contract/                # Cross-concept contract tests
│   └── integration/             # Developer-written integration tests
├── migrations/                  # Schema migration files
└── .clef/                       # Clef cache and build artifacts (gitignored)
    ├── score/                   # Score index (static + runtime)
    ├── build/                   # Compiled syncs, manifests
    └── cache/                   # Content hashes, incremental build state
```

### Key conventions

- **One concept per file** — `concepts/user.concept`, not `concepts/identity/user.concept` (suites handle grouping)
- **One sync per file** — named after the coordination it describes, not the concepts it touches
- **`generated/` is fully disposable** — `clef generate` rebuilds everything; never hand-edit
- **`handlers/` is where you write code** — Clef generates the skeleton, you fill in the logic
- **`bind/` is fully disposable** — `clef bind` rebuilds all interface targets
- **`.clef/score/`** — the Score index lives here; rebuilt by `clef build`, queried by `clef score`

### Clef Framework Source Structure

The framework itself — what lives in the Clef repo.

```
clef/
├── clef.yaml                           # Framework root config
│
├── repertoire/                         # The Repertoire — 16 suites of reusable app concepts
│   ├── foundation/
│   │   ├── suite.yaml
│   │   ├── content-node.concept
│   │   ├── intent.concept
│   │   ├── schema.concept
│   │   ├── type-system.concept
│   │   ├── property.concept
│   │   └── syncs/
│   ├── identity/
│   │   ├── suite.yaml
│   │   ├── authentication.concept
│   │   ├── authorization.concept
│   │   ├── access-control.concept
│   │   ├── session.concept
│   │   └── syncs/
│   ├── content/
│   ├── classification/
│   ├── infrastructure/
│   ├── automation/
│   ├── data-integration/
│   ├── data-organization/
│   ├── computation/
│   ├── collaboration/
│   ├── linking/
│   ├── presentation/
│   ├── query/
│   ├── media/
│   ├── notification/
│   └── web3/
│
├── framework/                          # Framework-internal suites (not Repertoire)
│   ├── generation/                     # Build pipeline internals
│   │   ├── suite.yaml
│   │   ├── resource.concept
│   │   ├── kind-system.concept
│   │   ├── build-cache.concept
│   │   ├── generation-plan.concept
│   │   ├── emitter.concept
│   │   └── syncs/
│   ├── deploy/                         # Deployment pipeline
│   │   ├── suite.yaml
│   │   ├── deploy-plan.concept
│   │   ├── rollout.concept
│   │   ├── migration.concept
│   │   ├── health.concept
│   │   ├── env.concept
│   │   ├── providers/
│   │   └── syncs/
│   └── test/                           # Testing infrastructure
│       ├── suite.yaml
│       ├── conformance.concept
│       ├── contract-test.concept
│       ├── flaky-test.concept
│       ├── snapshot.concept
│       └── syncs/
│
├── bind/                               # Clef Bind — programmatic interface generation
│   ├── suite.yaml
│   ├── projection.concept
│   ├── generator.concept
│   ├── surface.concept
│   ├── target.concept
│   ├── providers/
│   │   ├── rest/
│   │   ├── graphql/
│   │   ├── grpc/
│   │   ├── cli/
│   │   ├── mcp/
│   │   ├── claude-skills/
│   │   ├── openapi/
│   │   ├── asyncapi/
│   │   ├── sdk-ts/
│   │   ├── sdk-python/
│   │   ├── sdk-go/
│   │   ├── sdk-rust/
│   │   ├── sdk-java/
│   │   └── sdk-swift/
│   └── syncs/
│
├── surface/                            # Clef Surface — UI generation
│   ├── core/
│   │   ├── suite.yaml
│   │   ├── design-token.concept
│   │   ├── element.concept
│   │   ├── ui-schema.concept
│   │   ├── binding.concept
│   │   ├── signal.concept
│   │   └── syncs/
│   ├── component/
│   │   ├── suite.yaml
│   │   ├── anatomy.concept
│   │   ├── machine.concept
│   │   ├── slot.concept
│   │   ├── widget.concept
│   │   └── syncs/
│   ├── render/
│   │   ├── suite.yaml
│   │   ├── layout.concept
│   │   ├── viewport.concept
│   │   ├── framework-adapter.concept
│   │   ├── providers/               # 14 platform adapters
│   │   │   ├── react/
│   │   │   ├── vue/
│   │   │   ├── svelte/
│   │   │   ├── solid/
│   │   │   ├── swiftui/
│   │   │   ├── compose/
│   │   │   ├── react-native/
│   │   │   ├── ink/
│   │   │   └── ...
│   │   └── syncs/
│   ├── theme/
│   │   ├── suite.yaml
│   │   ├── elevation.concept
│   │   ├── motion.concept
│   │   ├── palette.concept
│   │   ├── theme.concept
│   │   ├── typography.concept
│   │   └── syncs/
│   └── app/
│       ├── suite.yaml
│       ├── host.concept
│       ├── navigator.concept
│       ├── shell.concept
│       ├── transport.concept
│       ├── providers/               # 5 platform adapters
│       │   ├── web/
│       │   ├── ios/
│       │   ├── android/
│       │   ├── desktop/
│       │   └── terminal/
│       └── syncs/
│
├── score/                              # Clef Score — code-as-data representation
│   ├── parse/                          # Parse layer
│   │   ├── suite.yaml
│   │   ├── syntax-tree.concept
│   │   ├── language-grammar.concept
│   │   ├── definition-unit.concept
│   │   ├── content-digest.concept
│   │   ├── structural-pattern.concept
│   │   ├── file-artifact.concept
│   │   ├── providers/
│   │   │   ├── grammars/            # Tree-sitter grammars
│   │   │   │   ├── typescript/
│   │   │   │   ├── rust/
│   │   │   │   ├── python/
│   │   │   │   ├── swift/
│   │   │   │   ├── json/
│   │   │   │   ├── yaml/
│   │   │   │   ├── concept-spec/    # .concept grammar
│   │   │   │   ├── sync-spec/       # .sync grammar
│   │   │   │   ├── widget-spec/     # .widget grammar
│   │   │   │   ├── theme-spec/      # .theme grammar
│   │   │   │   └── ...
│   │   │   └── patterns/            # Structural pattern engines
│   │   │       ├── tree-sitter-query/
│   │   │       ├── ast-grep/
│   │   │       └── comby/
│   │   └── syncs/
│   ├── symbol/                         # Symbol layer
│   │   ├── suite.yaml
│   │   ├── symbol.concept
│   │   ├── symbol-occurrence.concept
│   │   ├── scope-graph.concept
│   │   ├── symbol-relationship.concept
│   │   ├── providers/
│   │   │   ├── extractors/          # Symbol extractors per language
│   │   │   │   ├── typescript/
│   │   │   │   ├── rust/
│   │   │   │   ├── python/
│   │   │   │   ├── concept-spec/
│   │   │   │   ├── sync-spec/
│   │   │   │   ├── widget-spec/
│   │   │   │   ├── theme-spec/
│   │   │   │   └── universal/       # Tree-sitter fallback
│   │   │   └── scope/               # Scope resolution per language
│   │   │       ├── typescript/
│   │   │       ├── rust/
│   │   │       ├── concept/
│   │   │       ├── sync/
│   │   │       └── stack-graphs/
│   │   └── syncs/
│   ├── semantic/                       # Semantic layer
│   │   ├── suite.yaml
│   │   ├── concept-entity.concept
│   │   ├── action-entity.concept
│   │   ├── variant-entity.concept
│   │   ├── state-field.concept
│   │   ├── sync-entity.concept
│   │   ├── widget-entity.concept
│   │   ├── anatomy-part-entity.concept
│   │   ├── widget-state-entity.concept
│   │   ├── widget-prop-entity.concept
│   │   ├── theme-entity.concept
│   │   ├── interactor-entity.concept
│   │   ├── runtime-flow.concept
│   │   ├── runtime-coverage.concept
│   │   ├── performance-profile.concept
│   │   ├── error-correlation.concept
│   │   └── syncs/
│   ├── analysis/                       # Analysis layer
│   │   ├── suite.yaml
│   │   ├── dependence-graph.concept
│   │   ├── data-flow-path.concept
│   │   ├── program-slice.concept
│   │   ├── analysis-rule.concept
│   │   ├── providers/
│   │   │   ├── dependence/          # Dependence providers per language
│   │   │   │   ├── typescript/
│   │   │   │   ├── concept/
│   │   │   │   ├── sync/
│   │   │   │   ├── widget/
│   │   │   │   ├── theme/
│   │   │   │   ├── datalog/
│   │   │   │   └── universal/
│   │   │   └── engines/             # Analysis rule engines
│   │   │       ├── datalog/
│   │   │       ├── graph-traversal/
│   │   │       └── pattern-match/
│   │   └── syncs/
│   └── discovery/                      # Discovery layer
│       ├── suite.yaml
│       ├── semantic-embedding.concept
│       ├── providers/
│       │   ├── embedding/           # Embedding model providers
│       │   │   ├── codebert/
│       │   │   ├── openai/
│       │   │   └── voyage/
│       │   └── search/              # Search index providers
│       │       ├── trigram/
│       │       ├── suffix-array/
│       │       └── symbol-index/
│       └── syncs/
│
├── runtime/                            # Sync engine and runtime core
│   ├── sync-engine/                    # Sync matching, evaluation, firing
│   ├── action-log/                     # Append-only action log
│   ├── flow-trace/                     # Runtime flow tracing
│   ├── telemetry/                      # Observability export
│   └── adapters/                       # Storage and platform adapters
│       ├── postgres/
│       ├── sqlite/
│       ├── redis/
│       └── ...
│
├── cli/                                # The `clef` CLI
│   ├── commands/
│   │   ├── init.ts
│   │   ├── generate.ts
│   │   ├── build.ts
│   │   ├── dev.ts
│   │   ├── check.ts
│   │   ├── test.ts
│   │   ├── deploy.ts
│   │   ├── trace.ts
│   │   ├── surface.ts
│   │   ├── bind.ts
│   │   ├── score.ts
│   │   ├── suite.ts
│   │   └── migrate.ts
│   └── ...
│
├── codegen/                            # Code generation pipeline
│   ├── ir/                             # Intermediate representation (manifest)
│   ├── emitters/                       # Language-specific emitters
│   │   ├── typescript/
│   │   ├── rust/
│   │   ├── swift/
│   │   ├── solidity/
│   │   └── ...
│   └── templates/                      # Generation templates
│
└── docs/                               # Framework documentation
    ├── architecture.md
    ├── getting-started.md
    ├── guides/
    └── reference/
```

---

## CLI

Standard developer verbs. Musical only where it's actually clearer than the plain alternative (it isn't, so we don't).

```
clef init              # Scaffold a new project
clef generate          # Generate code from concept specs
clef build             # Compile syncs, build cache
clef dev               # Hot-reloading dev server
clef check             # Validate specs, check patterns
clef test              # Run conformance and contract tests
clef deploy            # Deploy to target environment
clef trace             # Debug flow traces
clef surface           # Generate UI targets
clef bind              # Generate API/CLI/MCP/SDK targets
clef score             # Query the Score (symbols, flows, impact, search, coverage)
clef suite             # Manage suites and concepts
clef migrate           # Schema migrations
```

---

## Suites (The Repertoire)

The Repertoire is the standard library of reusable app-building concepts. These are what you reach for when building an application.

| Suite | Purpose | Example Concepts |
|-------|---------|-----------------|
| **Foundation Suite** | Core building blocks | ContentNode, Intent, Schema, TypeSystem, Property |
| **Identity Suite** | Auth and access | Authentication, Authorization, AccessControl, Session |
| **Content Suite** | Content management | Canvas, Comment, DailyNote, Template, Version |
| **Classification Suite** | Taxonomy and tagging | Namespace, Schema, Tag, Taxonomy |
| **Infrastructure Suite** | System plumbing | Cache, EventBus, Validator, ConfigSync, PluginRegistry |
| **Automation Suite** | Workflows and queues | AutomationRule, Control, Queue, Workflow |
| **Data Integration Suite** | External data | Connector, DataSource, FieldMapping, Transform, SyncPair |
| **Data Organization Suite** | Data structures | Collection, Graph |
| **Computation Suite** | Expressions and formulas | ExpressionLanguage, Formula, Token |
| **Collaboration Suite** | Team features | Flag, Group |
| **Linking Suite** | References and relations | Alias, Backlink, Reference, Relation |
| **Presentation Suite** | Display and forms | DisplayMode, FormBuilder, Renderer, View |
| **Query Suite** | Search and retrieval | ExposedFilter, Query, SearchIndex |
| **Media Suite** | Files and assets | FileManagement, MediaAsset |
| **Notification Suite** | Alerts and messaging | Notification |
| **Web3 Suite** | Blockchain integration | ChainMonitor, Content (IPFS), Wallet |

### Framework-Internal Suites

These power Clef's own tooling — not part of the Repertoire.

| Suite | Internal to | Purpose |
|-------|------------|---------|
| **Deploy Suite** | Clef | DeployPlan, Rollout, Migration, Health, Env + providers |
| **Generation Suite** | Clef | Resource, KindSystem, BuildCache, GenerationPlan, Emitter |
| **Test Suite** | Clef | Conformance, ContractTest, FlakyTest, Snapshot |
| **Bind Suite** | Clef Bind | Projection, Generator, Surface, Target + 14 providers (incl. Claude Skills) |
| **Layout Suite** | Clef Surface | Component |

### Surface Suites (Internal to Clef Surface)

| Suite | Purpose |
|-------|---------|
| **Surface Core Suite** | DesignToken, Element, UISchema, Binding, Signal |
| **Surface Component Suite** | Anatomy, Machine, Slot, Widget |
| **Surface Render Suite** | Layout, Viewport, FrameworkAdapter + 14 platform adapters |
| **Surface Theme Suite** | Elevation, Motion, Palette, Theme, Typography |
| **Surface App Suite** | Host, Navigator, Shell, Transport + 5 platform adapters |

---

## Generation Layers Explained

### Clef Bind (Programmatic Interfaces)

Generates the ways machines and LLMs talk to your app:

| Target | What it generates |
|--------|------------------|
| REST | OpenAPI spec + route handlers |
| GraphQL | Schema + resolvers |
| CLI | Command-line interface with help, flags, subcommands |
| MCP | Model Context Protocol server for LLM tool use |
| Claude Skills | Skill definitions for Claude's computer use environment |
| gRPC | Protocol buffer definitions + service stubs |
| SDK (TS, Python, Go, Rust, Java, Swift) | Typed client libraries |
| OpenAPI / AsyncAPI | Spec documents |

### Clef Surface (Visual Interfaces)

Generates the UIs humans interact with:

| Target | What it generates |
|--------|------------------|
| React | Components, hooks, state management |
| Vue | Components, composables |
| Svelte | Components, stores |
| SwiftUI | Views, view models |
| Compose | Composables |
| React Native | Cross-platform mobile components |
| + 8 more adapters | See Surface Render Suite |

---

## Clef Score (Code as Data)

The Score is the queryable representation of your entire Clef application. Every file, symbol, concept, sync, widget, theme, and runtime event becomes a traversable node. This is what makes Clef natively LLM-friendly — an LLM doesn't need to grep through source files, it queries the Score.

### Static Score

Built from your source files at rest. Three layers, each building on the one below:

| Layer | What it captures | Example query |
|-------|-----------------|---------------|
| **Parse layer** | Lossless syntax trees for every file (via Tree-sitter), structural patterns, content hashes | "Find all functions matching this pattern" |
| **Symbol layer** | Cross-file identity, scope resolution, typed relationships between named entities | "Show me all files that import this module" |
| **Semantic layer** | Concepts, actions, variants, syncs, state fields, widgets, themes as first-class queryable nodes | "What's the complete chain of effects from User/register?" |

The static Score answers questions about what your code *declares*: what concepts exist, how syncs wire them together, what the flow graph looks like, what would break if you changed a state field.

### Runtime Score

Built from execution data as your app runs. Correlates every runtime event back to its static entity:

| What it tracks | Example query |
|----------------|---------------|
| **Flow correlation** | "Show me the actual execution path vs. what the flow graph predicted" |
| **Coverage** | "Which variants have syncs but have never fired in production?" |
| **Performance** | "What's the slowest sync chain, and where's the bottleneck?" |
| **Error correlation** | "This request failed — walk me back to the root cause with source locations" |
| **Widget lifecycle** | "Which widgets have unnecessary re-renders, and what signal writes cause them?" |

The runtime Score answers questions about what your code *does*: which paths actually execute, where time is spent, what errors occur and why.

### Why Score Matters for LLMs

Traditional codebases are opaque to LLMs — an LLM has to read files, infer structure, and hold a mental model in context. The Score eliminates this:

- An LLM can query "what concepts does this sync reference?" instead of parsing sync files
- An LLM can query "if I change Article's state schema, what breaks?" instead of tracing dependencies manually
- An LLM can query "which variants are dead?" instead of auditing every sync pattern
- An LLM can query "why did this request fail?" and get a root-cause chain with source locations
- Combined with Bind (which exposes Score queries as MCP tools and Claude Skills), any LLM can navigate, debug, and modify a Clef app through structured queries rather than raw file access

---

## How to Talk About Clef

### In documentation

> Clef builds software as compositions of fully independent, spec-driven services called **concepts**, coordinated by declarative **syncs**. Concepts never reference each other's state. All inter-concept coordination lives in sync files.
>
> **Clef Score** makes your entire codebase queryable as data. The static Score indexes every file, symbol, concept, sync, and widget into a traversable graph. The runtime Score correlates execution events — flows, coverage, errors, performance — back to their declared structure. Together, they let LLMs navigate and reason over your app through structured queries instead of raw file access.
>
> **Clef Bind** generates programmatic interfaces — REST APIs, CLIs, MCP servers, Claude Skills, GraphQL endpoints, and SDKs — directly from your concept specs, making every Clef app instantly accessible to LLMs. **Clef Surface** generates cross-platform visual interfaces across React, SwiftUI, Compose, and other UI frameworks from the same specs — doing for frontends what Clef does for backends.
>
> The **Clef Repertoire** ships with 16 suites of battle-tested concepts covering identity, content, data integration, infrastructure, and more.

### In casual conversation

- "We added a new concept to the Identity Suite"
- "Run `clef bind` to regenerate the MCP server"
- "The Surface layer handles all the cross-platform UI stuff"
- "Check the Repertoire, there's probably a concept for that already"
- "The sync between User and Password handles the registration flow"
- "Write the concept spec, Clef generates the rest"
- "Query the Score to see which syncs have never fired"
- "The runtime Score shows that variant has zero coverage in prod"

### Describing to someone new

> "Clef is a programming framework designed for LLMs. Each piece of your app is an independent concept with its own spec, state, and actions — so big projects never overwhelm context. Syncs wire concepts together declaratively. The Score makes your entire codebase queryable as data — an LLM doesn't read files, it queries structure. Bind generates REST APIs, CLIs, MCP servers, and Claude Skills so your app is instantly accessible to AI. Surface generates cross-platform UIs from the same specs. You write the concept once and get everything."

### The six key selling points

1. **Total concept independence** — big projects don't overwhelm context
2. **Spec-first** — semantics in the spec, so reasoning is always there
3. **Clef Score** — your entire app is queryable as data, static and runtime, so LLMs can navigate structure instead of reading files
4. **Clef Bind** — every app automatically accessible by LLMs via MCP, Claude Skills, CLIs, REST, and SDKs
5. **Clef Surface** — every app automatically gets cross-platform UIs, doing for frontends what Clef does for backends
6. **Clef Repertoire** — rock-solid core, easily extended without reinventing the wheel

---

## What's Branded vs. What's Plain

| Branded (6 terms) | Plain (everything else) |
|--------------------|------------------------|
| Clef (framework) | concepts, syncs, actions, variants |
| Repertoire (standard library) | state, invariants, completions |
| Suite (concept bundles) | generate, build, test, deploy |
| Score (code-as-data representation) | static score, runtime score, parse layer, symbol layer, semantic layer |
| Surface (UI generation) | sync engine, codegen, migrations |
| Bind (programmatic interfaces) | handlers, manifests, schemas |

The rule: if someone reading docs for the first time needs a glossary to understand a term, it shouldn't be branded. Six branded terms is enough to give the framework identity without creating a translation layer.
