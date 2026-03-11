why# ClefOS Implementation Plan

**Synthesized from:** Clef Base Platform spec, CMS/App Studio design, ClefOS architecture spec
**Clef framework dependency:** COPF v0.18.0, Concept Library v0.4.0, Clef Surface v0.4.0
**Date:** 2026-03-06

---

## 1. What this is

ClefOS is a concept-oriented application platform — the reference application that proves Clef can build real software, and that the software it builds can build more software. It is to Clef what Drupal is to PHP, except the output is not limited to websites. From a single concept-oriented app definition, ClefOS produces deployable software for web, phone, desktop, web3, and companion devices.

Four traditions converge in the design:

- **Drupal** contributes the dual-domain entity model, typed data tree, bundles, field/widget/formatter triad, taxonomy, comments, media, three-valued access control, configuration-as-code, and admin-grade operability.
- **Notion/Tana/Coda** contribute the "record is also a page" bridge, progressive structuring, schema-as-mixin, embedded views, formulas, and virtual collections.
- **Roam/Logseq/Obsidian** contribute block references, backlinks, graph overlays, query blocks, daily notes, and transclusion.
- **Clef** contributes concept independence, sync-driven coordination, derived concepts, Bind as universal interface generation, Surface as multi-platform UI, and Score as graph/file/runtime inspection.

The result is a general app-builder and runtime whose base abstraction is a reflectable entity graph, whose edng model unifies structured and unstructured content, and whose distribution model unifies software packages, UI packages, and interface manifests.

---

## 2. Foundational architecture

### 2.1 The single most important design decision

Entity is a **shared reflective interface**, not a god concept. Drupal's Entity API is powerful but overloaded — it mixes storage, forms, rendering, access, routing, and configuration into one mega-abstraction. ClefOS decomposes that into independent concepts (ContentStorage, FormBuilder, DisplayMode, Renderer, TypeSystem, AccessControl) coordinated by syncs, while still exposing a shared Drupal-like entity surface via the entity-reflection suite.

The entity-reflection interface does not replace concept-specific actions. An Article concept still has `create`, `update`, `publish` with their own semantics. Entity-reflection adds a parallel generic layer — `EntityReflection/load(type, id)`, `EntityReflection/save(type, id, fields)`, `EntityReflection/query(type, filters)` — that delegates to concept-specific actions via routing syncs. Any concept that stores persistent records opts in by declaring entity-reflection conformance in its `suite.yaml`.

### 2.2 Two entity domains

All entities belong to one of two domains:

**Content entities** are user-facing, mutable runtime data. They support fields, revisions, translations, comments, and content pages. Examples: articles, pages, media items, taxonomy terms, user profiles, comments, process instances, captured data records. They live in the app's primary storage backend and are managed through the content-facing UI.

**Config entities** are structural metadata that defines how the app behaves: content types (bundles), field definitions, view configurations, workflow definitions, display modes, automation rules, theme settings, bind manifests, deployed concept specs. They serialize to YAML for version control and deployment. They are managed through the admin-facing UI.

The distinction drives authorization (users edit content, admins configure the app), deployment (config exports/imports across environments), caching (config changes rarely and caches aggressively), and the dual-manifest Bind architecture.

### 2.3 The typed data tree

Every piece of data follows a typed data hierarchy: Entity → FieldItemList → FieldItem → Property → raw value. Each node carries type information (TypeSystem), validation constraints (Validator), and change propagation (EventBus subscriptions). This is a **reflection protocol**, not a persistence mandate — concepts can store data however they want, but when reflected as entities they expose typed-data navigation. This enables generic validation, serialization (JSON/YAML/GraphQL/CLI flags), widget selection, permissions, diff/versioning, and bind projection without knowing concrete types.

### 2.4 Bundles and schemas

Entity types support **bundles** — configurable subtypes that share the same underlying concept but carry different field configurations. Article and Page are both ContentNode entities but carry different fields. Bundles are config entities that attach field definitions to entity types via the Schema concept.

Schemas also operate as **mixins** (Tana's supertag pattern). A schema is a first-class entity independent of any container, with support for single inheritance and composition. Applying a schema to an entity materializes its fields without destroying existing content. This gives you both Drupal's stable admin/content-type layer and Tana's "apply structure later" flexibility.

Practical rule: bundles provide the stable admin/content-type layer; schemas provide attachable progressive structure; collections provide container membership; views provide projections over either.

### 2.5 The field triad

Each field has three independent concerns, expressed as three concepts coordinated by syncs:

- **FieldType** — what data it stores (value kind, cardinality, validation constraints, storage shape, relation target rules, query semantics, formula compatibility), implemented via Property and TypeSystem.
- **FieldWidget** — how it renders for editing on each platform, mapping to Surface interactors and affordances rather than recreating Drupal widgets directly. The platform adapter chooses the concrete widget.
- **FieldFormatter** — how it renders for display (compact/expanded, list/table/card/canvas, target-specific representations for CLI/API/docs), implemented via Renderer and DisplayMode.

### 2.6 References, relations, and selection plugins

Two systems for entity connections, kept consistent by `relation-reference-bridge.sync`:

- **Relations** — typed, labeled, bidirectional connections with cardinality constraints. For semantic links: assigned-to, author-of, depends-on, belongs-to-project.
- **References/Backlinks** — lightweight, schema-less forward links with automatic reverse indexing. For wiki links, block refs, inline mentions, Roam-style page references.

Selection plugins control which entities can be referenced from which fields. A "category" field on an Article might only allow terms from the "Topics" vocabulary. Selection providers include default filter, taxonomy-scoped, view-based query, and custom. This mirrors Drupal's entity reference selection handlers.

---

## 3. The unified page engine

### 3.1 Every entity is also a page

Every entity has two zones, unified through the PageAsRecord concept:

The **structured zone** consists of typed fields conforming to the entity's schema — queryable, displayable through Views, editable through FormBuilder forms. This is the Drupal side.

The **unstructured zone** is a content page attached to every entity — a Roam/Notion/Logseq-like document made of ContentNode blocks containing prose, headings, images, embeds, block references, backlinks, code, and any other content type. This is the entity's narrative, documentation, and living context.

The structured zone renders above the body (Notion-style property panel) or inline within the body (Tana-style fields as child nodes). Users can start freeform and progressively formalize by applying schemas.

### 3.2 Four interoperable page layers

Each entity page composes four layers:

1. **Property region** — bundle, schemas, status, relations, taxonomy, workflow, permissions, metadata.
2. **Body region** — rich block/paragraph tree with references, embeds, formulas, comments, and block-level views.
3. **View region** — embedded tables, boards, lists, graphs, calendars, dashboards, charts, query results.
4. **Layout region** — optional explicit page layout with sections, tabs, sidebars, controls, and nested structured components.

### 3.3 Blocks and paragraphs unified

Each block combines Roam blocks and Drupal paragraphs:

From Roam/Logseq: unique IDs, referenceable via `((block-id))`, embeddable/transcludable, bidirectional links via `[[entity-name]]`, backlink inheritance from outline ancestors, participation in the Query system.

From Drupal Paragraphs: each block is an entity that owns its sub-blocks (composition, not aggregation). Block types have schemas — a "callout" block carries a severity field, a "code" block carries a language field. Blocks support hierarchical revisions and are extensible through the same bundle/schema mechanism as any entity.

### 3.4 One editor, two modes

Rather than separate editors, a single composition engine with two modes over a shared composition tree:

- **Document-first mode** — prose/outliner flow, slash commands, embedded views.
- **Layout-first mode** — regions/components/panels/forms/cards/grids.

Deep symmetry rule: anything in the structured layout editor is embeddable in the document editor via slash commands, and anything in the document editor can be elevated into a structured layout slot. This fuses layout builder, document editor, and view builder into one composition system.

### 3.5 Display modes, form modes, and document modes

Three aligned mode systems, all config entities:

**Display modes** — how an entity is shown: full page, summary card, table row, chip, API summary, MCP tool description, watch summary.

**Form modes** — how an entity is edited: quick edit, full edit, admin edit, mobile compact edit, bulk edit.

**Document modes** — how the body tree is presented: prose, bullets, numbered, task list, table, cards, kanban, timeline. Cascade down the subtree unless overridden. This gives "page can be prose or bullets or tables" behavior.

### 3.6 Queries over both zones

The Query concept operates across structured and unstructured zones. Structured queries filter by field values, schemas, relations, and taxonomy. Unstructured queries filter by backlinks, block references, tags, embedded properties, and full-text search. Queries embed within content pages as live-updating blocks — the Notion linked-database / Logseq embedded-query pattern. Simple queries compile down to advanced Datalog/SQL logic via a dual-mode pattern.

### 3.7 Collections: concrete and virtual

Collections support both concrete membership (explicit members, like databases/tables/folders) and virtual membership (live queries, search nodes, smart folders). Views project over either kind.

### 3.8 Progressive formalization

Content follows a predictable lifecycle — users enter at any stage and advance incrementally:

1. **Capture** — freeform content in a daily note or scratch page (ContentNode, DailyNote)
2. **Organize** — move blocks into collections, add to outlines (Collection, Outline)
3. **Classify** — apply a schema/tag; structured fields appear (Schema, Tag, PageAsRecord). Structure-detector plugins (kv_detector, llm_detector) can quietly identify dates, tags, and key-value pairs in freeform text and propose promotions.
4. **Connect** — create relations; rollups aggregate across connections (Relation, Formula)
5. **Compute** — add formulas, embedded queries, computed views (Formula, Query, View)
6. **Automate** — create automation rules triggered by field changes or schema application (AutomationRule, Workflow)
7. **Interact** — add controls (buttons, sliders, toggles) that operate on structured data (Control)
8. **Share** — embed synced content, publish views, expose via API (SyncedContent, View, Bind)

---

## 4. Formulas and semantic computation

Formulas operate at five scopes, not just table columns:

- **Field formulas** — computed structured properties on entities.
- **View formulas** — computed columns and aggregations in views.
- **Inline formulas** — document-embedded computed values.
- **Graph formulas** — traversal-based computations over relations/references.
- **Semantic extraction formulas** — AI-driven metadata extraction from unstructured body content.

This is one of the keys to making ClefOS more powerful than Drupal without abandoning structure.

---

## 5. Taxonomy, comments, files, and media

### 5.1 Taxonomy as infrastructure

The Taxonomy concept provides hierarchical classification vocabularies. Vocabularies are config entities; terms are content entities forming trees. Applied wherever hierarchical classification makes sense — not just user content but all entities. A vocabulary of "Concept Categories" classifies concepts in the registry. A vocabulary of "Widget Types" classifies Surface widgets. Taxonomy, backlinks/reference graph, and typed relation graph are complementary, not competing.

### 5.2 Universal commenting

Every entity can receive comments, attached polymorphically via entity type + entity ID + field name (materialized-path threading). Defaults vary by domain: content entities get prominent public comments; config entities get tucked-away admin comments for design discussion and review; block entities get optional inline annotations.

### 5.3 File and media lifecycle

FileManagement handles upload, temporary/permanent lifecycle, reference-counted resource tracking, and garbage collection. Media wraps heterogeneous assets (local files, remote video, embedded content) behind a uniform entity interface via MediaSource providers. Media entities are full entities — they have content pages, participate in taxonomy, and can receive comments. Additionally supports package assets, theme assets, build artifacts, remote references via federated storage, and per-platform previews.

---

## 6. The dual-manifest Bind architecture

### 6.1 Config manifest (developer-facing)

Covers all config entities and developer-facing concepts. From this manifest, Bind generates: a config CLI with subcommand groups mirroring the config entity hierarchy; a config REST API with OpenAPI spec; a config MCP server for AI-assisted administration; a config GraphQL schema; an admin SDK; a `.claude` directory with `CLAUDE.md` plus equivalents for Gemini and Codex; and Claude Skills for common admin workflows.

### 6.2 Content manifest (user-facing)

Covers all content entities and user-facing concepts: CRUD, content pages, queries, views, taxonomy, comments, media, search, user profiles, domain concepts. Generates the same family of outputs: CLI, REST API, MCP server, GraphQL schema, user SDK, and Claude Skills.

### 6.3 Custom manifests via UI

Beyond the two defaults, users create new Bind manifests through a structured admin interface — not a raw file editor. The UI lets you select concepts, configure groupings (API resources, CLI trees, MCP tool groups, GraphQL namespaces), set per-concept metadata (auth, rate limits, pagination, field visibility), define action sequences for documentation, preview generated interfaces, and compose manifests from other manifests (a public API manifest exposing a subset of the content manifest, a partner API adding integration endpoints). Each custom manifest produces its own complete set of interface targets.

The bind editing UI naturally integrates Projection, Grouping, ActionGuide, Annotation, Middleware, and Target provider concepts. The AutomationTarget generates automation manifests and supports structured runtime dispatch, integrated directly into the bind UI.

---

## 7. Multi-platform deployment targets

One app definition, many target surfaces. The concept layer, sync layer, schema layer, and content layer are completely platform-independent. Per-platform differences are limited to which Surface adapter renders widgets, which PlatformAdapter handles navigation/lifecycle/storage, which Bind targets generate interfaces, which deployment target packages the result, and which rendering strategy applies per page.

### 7.1 Web (Next.js)

Default deployment to Vercel. Per-page rendering strategy is a config entity property, changeable in the admin UI:

- **SPA** — client-side rendering, full interactivity. Dashboards, admin interfaces, interactive editors.
- **Pure static (SSG)** — pre-rendered at build. Marketing pages, docs, blogs.
- **Hydrated (SSR + hydration)** — server-rendered with client interactivity. Content pages needing SEO + interactivity.
- **Pure server (RSC)** — React Server Components, no client JS. Data-heavy, minimal-interactivity pages.
- **Pure in-browser** — no server; runs entirely via WASM or service worker. Offline-capable views.

### 7.2 Phone (Android/iOS, offline-first)

Native apps via Jetpack Compose (Android) and SwiftUI (iOS) through Surface adapters. Offline-first: stores entity data locally via Replica, syncs via SyncPair when online, resolves conflicts via ConflictResolution (CRDTs or LWW). Backend remains the Bind-generated REST/GraphQL API.

### 7.3 Desktop (Linux/Windows/macOS)

Platform-native frontends: GTK (Linux), WinUI (Windows), AppKit or SwiftUI (macOS). Backend can be a local server, local SQLite, or remote API — configurable per deployment via the Env concept.

### 7.4 Web3 (Ethereum L2 + IPFS)

A **subset** of the concept vocabulary. Important entities (ownership records, governance votes, financial transactions) store state on an Ethereum L2 smart contract via SolidityGen-generated interfaces with Foundry tests. Frontend deploys to IPFS as a static site, accessed via ENS domains. A sync bridge (Connector + SyncPair) connects on-chain and off-chain state bidirectionally. Fraud proof platform is a provider choice, not an architectural decision.

### 7.5 Companion devices (watches)

Display and notification endpoints, not full authoring environments. Sync with phone/desktop via SyncPair. Display entity data through simplified Surface widgets for small screens. Provide notifications, quick capture (voice-to-entity via Capture), and status glances (View with watch-specific display modes). Cannot edit config entities. Generated from the same concepts with a watch-specific Surface theme and a reduced Bind manifest exposing only read and quick-action operations.

---

## 8. Authorization and access control

### 8.1 Defaults

Role-based access control with built-in roles: anonymous, authenticated, editor, admin. Custom roles are config entities.

Three-valued access algebra: allowed, neutral, forbidden. Results compose via OR (any allowed + none forbidden = granted) for entity access and AND (all must allow) for route access. Every access result carries cacheability metadata.

Entity-level access via AccessControl policies attached to entity types. Field-level access via per-field visibility on bundle configs. Page/body region access and block-level access where needed. Platform-aware access (watch may be read-only). Bind exposure access (who can use which CLI/MCP/API actions).

### 8.2 Extensible

Because Authentication, Authorization, and AccessControl are independent concepts wired by syncs, any piece can be replaced or extended: swap auth providers (cookie, OAuth, SAML, passkey) via PluginRegistry; add group-scoped access (Group concept for workspace-level RBAC); add process-based authorization (WorkItem for task-level access); add content moderation (Workflow gating publication transitions behind permission checks).

---

## 9. Automation, workflow, and processes

### 9.1 Three-tier dispatch

**Tier 1 — SyncEngine (structural wiring).** Every cross-concept delegation. Users don't directly interact but see its effects: saving an entity triggers cache invalidation, search indexing, URL alias generation, and provenance tracking.

**Tier 2 — EventBus (application pub/sub).** Dynamic subscriber management, priority ordering, dead-letter queues, event history. Used when listeners are dynamic — plugins registering event handlers at installation time.

**Tier 3 — AutomationRule (user-configurable rules).** End users configure event-condition-action rules through the admin UI. Conditions delegate to evaluateWhere; actions dispatch through AutomationDispatch to registered providers (ManifestAutomationProvider for build-time registries, SyncAutomationProvider for runtime user-defined syncs). AutomationScope provides allowlist/denylist control. Users can create triggers, conditions, actions, schedules, approvals, scopes, and manage a draft/validated/active/suspended lifecycle — all as entities.

### 9.2 Content moderation workflow

Default "Content Moderation" workflow with Draft → Review → Published → Archived states. Transitions require permissions; publishing triggers cache invalidation and search indexing via syncs.

### 9.3 Heavyweight process orchestration

For multi-step approval chains, LLM-assisted content processing, and external integrations: ProcessSpec (reusable blueprints), ProcessRun (execution instances), StepRun (step lifecycle), FlowToken (parallel fork/join), ProcessVariable (scoped execution data with merge strategies), WorkItem (human task assignment gated by Approval, with SLA tracking via Timer and Escalation), ConnectorCall (external API), LLMCall (language model interactions using ToolRegistry for secure, versioned API access, with EvaluationRun auto-repair loops), and ProcessEvent (append-only audit ledger).

The process suite's six sub-suites are independently installable.

---

## 10. Rendering, caching, and streaming

ClefOS adopts Drupal's render pipeline patterns for efficient structured-component rendering:

- Declarative render tree.
- Cache lookup before subtree render.
- Cacheability metadata bubbling upward.
- Placeholdering for dynamic subtrees.
- Progressive streaming/patching for dynamic regions.

This is critical for pages mixing cached document body, live view widgets, user-specific controls, workflow state badges, comments, and inline query results.

---

## 11. Content storage backends

### 11.1 Defaults per target

- **Web (Next.js/Vercel):** PostgreSQL for content, filesystem/S3 for media, environment variables + Vercel KV for config.
- **Mobile (Android/iOS):** SQLite (via Replica) for local offline storage, syncing to server PostgreSQL.
- **Desktop:** SQLite for local-first, optional server sync.
- **Web3:** Smart contract state on-chain, IPFS for media, SQLite for local cache.

### 11.2 Federated storage

The federated ContentStorage provider enables entities whose data spans multiple backends. A WikipediaArticle entity might store internal_notes locally while fetching article content from the Wikipedia API. Federation is configured per-schema through `Schema.associations.providers`, not hard-coded — changing where data comes from is a config change, not a code change.

### 11.3 Swappable in the UI

Storage backends are config entities. Move from PostgreSQL to CockroachDB? Change the provider. Add Redis caching? Enable the Cache concept's integration sync. The storage layer is a concept, not an assumption.

---

## 12. Package management and the concept browser

### 12.1 Installable units

The browser handles: concept specs, derived concepts, sync packs, widget packs, theme packs, bind manifest presets, provider implementations, storage backends, deployment target presets, templates (including package-aware templates for distributing starter apps and workflow packs), full suites, and full starter apps.

Suites remain the authoring and packaging boundary (declaring concepts, sync tiers, optional providers, dependencies, shared type-parameter mappings), but the install browser resolves smaller units too. Suite = package publishing unit; install plan = resolved graph of whichever pieces are needed.

### 12.2 Dependency resolution

PubGrub algorithm across concepts, derived concepts, widgets, themes, providers, bind targets, platform adapters, required syncs, and recommended syncs. Content-addressed storage ensures reproducible installs.

### 12.3 Install UX

The browser shows: what the package adds, which entities it reflects, which UI surfaces it contributes, which bind targets it generates, which runtimes/platforms it supports, which permissions it requires, which syncs are required vs recommended, and what storage/deploy/provider assumptions it makes.

### 12.4 Compatibility profiles

Packages declare which platforms, runtimes, bind targets, and provider assumptions they support.

### 12.5 Starter apps

Publish a resolved set of concepts + views + widgets + themes + bind manifests + deploy defaults as a reusable application base. Users install "issue tracker," "CRM," "knowledge base," or "governance workspace" as starting points and extend from there.

---

## 13. Synced content and templates

Templates and synced content serve different purposes:

**Templates** — for new entity defaults, new page defaults, new bundle defaults, bind manifest templates, deployment target templates. Installable as package artifacts.

**Synced content / transclusion** — for reusable disclaimer sections, shared design notes, embedded source-of-truth blocks, dashboards echoing content from elsewhere, package-provided default snippets.

---

## 14. Score IDE and concept navigation

### 14.1 Dual graph explorer

**Software graph** — concepts, syncs, derived concepts, suites, widgets, themes, bind manifests, deployment configs, AST nodes and file structure.

**Runtime/content graph** — entities, blocks, references, relations, collections, views, comments, workflows.

Bridge behavior: from any entity, jump to its managing frontend page, its underlying file/spec, its bind exposures, its related concepts, its provider configuration, or its traces/tests.

### 14.2 Specific UI tools

- **Concept graph navigator** — visual graph of all concepts, sync connections, suite memberships, dependency relationships. Click to navigate to the .concept spec or the entity management UI.
- **Sync chain viewer** — trace any action through the sync chain, see which syncs fire, which concepts are invoked, what data flows. FlowTrace provides runtime data; UI renders as interactive tree.
- **AST explorer** — drill into parsed AST via SyntaxTree, navigate definitions via DefinitionUnit, see symbol references via Symbol and ScopeGraph.
- **Hierarchical tracing** — derivedContext tags visually group runtime execution traces, keeping debug scopes cleanly separated by feature boundary.

---

## 15. DevOps and deployment pipeline

### 15.1 Default pipeline

Every app ships with a preconfigured pipeline managed by Deploy suite concepts:

- **Local development:** `clef dev` runs a hot-reloading dev server with all targets available locally.
- **Testing:** `clef test` runs conformance tests, contract tests, snapshot tests, with intelligent test selection based on change impact.
- **Staging on Vercel:** preview deployments for every PR with full app in staging environment.
- **Production on Vercel:** progressive rollout (canary, blue-green, rolling via the Rollout concept).
- **Mobile/desktop builds via cloud:** deployment pipeline triggers cloud-based builds for Android (Gradle), iOS (Xcode Cloud), and desktop (Linux, Windows, macOS).

### 15.2 Config sync and GitOps

ConfigSync serializes all structural configuration to YAML. Environments (dev, staging, prod) inherit configuration as code via layered overrides. Progressive delivery handled out of the box.

### 15.3 Swappable in the UI

The deployment DAG routes to pluggable providers — IaC providers (Terraform, Pulumi, DockerCompose) and Runtime providers (Vercel, AWS Lambda, K8s, CloudRun) are swappable directly in the admin UI. GitOps providers support ArgoCD, Flux, and custom CI integration. Every aspect is a config entity.

---

## 16. New concepts introduced by ClefOS

Only three concepts are new to ClefOS; everything else assembles from the existing library:

- **EntityReflection** — the uniform entity interface, providing generic load/save/delete/query/list-fields/get-display/get-form operations delegated to concept-specific actions via routing syncs. Owns entity type registry, bundle definitions, and field attachment metadata.
- **ConceptBrowser** — package discovery and installation UI. Owns installed package state, registry connections, preview computations, and installation workflows. Delegates dependency resolution to KitManager and content-addressed storage to the package management infrastructure.
- **AppShell** — root derived concept composing all of ClefOS's features into a single application. Owns navigation structure, default layouts, top-level routing. Operational principle: "After installing ClefOS, you can create content entities through the content UI, configure the application through the admin UI, and extend it through the concept browser."

---

## 17. Concept inventory

**From the existing Concept Library (v0.4.0):** Foundation (ContentNode, ContentParser, ContentStorage, Intent, Outline, PageAsRecord, Property, TypeSystem), Infrastructure (Cache, ConfigSync, EventBus, Pathauto, PluginRegistry, Validator), Classification (Namespace, Schema, Tag, Taxonomy), Content (Canvas, Comment, DailyNote, SyncedContent, Template, Version), Linking (Alias, Backlink, Reference, Relation), Presentation (DisplayMode, FormBuilder, Renderer, View), Query/Retrieval (ExposedFilter, Query, SearchIndex), Automation (AutomationRule, Control, Queue, Workflow), Data Organization (Collection, Graph), Computation (ExpressionLanguage, Formula, Token), Collaboration (Flag, Group), Media (FileManagement, MediaAsset), Notification (Notification), Layout (Component), Identity (Authentication, Authorization, AccessControl, Session), Data Integration (DataSource, Connector, Capture, FieldMapping, Transform, Enricher, SyncPair, DataQuality, Provenance, ProgressiveSchema), Automation Providers (AutomationDispatch, AutomationScope, ManifestAutomationProvider, SyncAutomationProvider, AutomationTarget).

**From the Interface/Bind suite:** Projection, Generator, ApiSurface, Middleware, Grouping, ActionGuide, Annotation, EnrichmentRenderer, and the Target/Sdk/Spec coordination concepts with providers.

**From Clef Surface (v0.4.0):** All 29 concepts across 7 suites.

**From the Deploy suite:** DeployPlan, Rollout, Migration, Health, Env, Telemetry, Artifact, and all coordination+provider concepts.

**Optionally installable:** Process Kit (20 concepts, 6 sub-suites), Governance Kit (60 concepts, 7 sub-suites), Formal Verification Suite (7 concepts).

---

## 18. What you can build

ClefOS is not one application — it is an application platform. The same base becomes: a CMS (Drupal-like), a project management tool (Notion-like), a knowledge base (Roam-like), a CRM, a data integration platform, an internal tools builder, a collaborative workspace, or any combination — configured through the admin UI, deployed through the same pipeline, extensible through the concept browser.

---

## 19. Architectural rules

1. Entity is a shared interface, not a god concept.
2. Every meaningful entity can have both structured properties and a page body.
3. Bundles and schemas both exist; bundles are stable subtype profiles, schemas are attachable mixins.
4. Views, layouts, and documents are one composition system with multiple editing modes.
5. Packages can install concepts, syncs, widgets, themes, providers, bind manifests, or full suites.
6. Bind manifests are first-class entities edited through thoughtful UI.
7. All apps get config-side and content-side bind surfaces by default.
8. Platforms are target surfaces over one concept graph, not separate app definitions.
9. Storage/integration emerge from provider selection and sync chains, not giant orchestration concepts.
10. Score must inspect both software structure and runtime/content structure in one navigable graph.

---

## 20. Implementation plan

### Phase 1 — Reflective entity foundation (weeks 1–8)

**Goal:** Everything is an entity with a shared interface over the typed data tree.

Deliverables:
- EntityReflection concept with load/save/delete/query/list-fields operations, delegating to concept-specific actions via routing syncs.
- Typed data tree implementation (Entity → FieldItemList → FieldItem → Property → raw value) as a reflection protocol.
- Content/config dual-domain split with appropriate storage, caching, and serialization behaviors.
- Bundle system — config entities attaching Schema-defined field configurations to entity types.
- Field triad wiring — FieldType, FieldWidget, FieldFormatter as three independent concepts coordinated by syncs, mapped into Surface interactors and affordances.
- Reference and Relation concepts with selection plugins for constrained entity references.
- Taxonomy concept with Vocabulary (config) and Term (content) entities, attachable to any entity via fields.
- Comment concept with polymorphic attachment (entity type + entity ID + field name), materialized-path threading, and domain-appropriate defaults.
- FileManagement with reference-counted lifecycle; Media with source-plugin abstraction.
- Identity suite defaults (RBAC, three-valued access algebra, entity-level and field-level access).

### Phase 2 — Unified page/record editor (weeks 9–16)

**Goal:** Every entity has a dual-zone page combining structured properties and an unstructured block tree.

Deliverables:
- PageAsRecord concept unifying structured zone and unstructured body zone on every entity.
- Block/paragraph system — blocks as entities with unique IDs, schema-bearing subtypes, hierarchical revisions, and ownership composition.
- Block capabilities: bidirectional links, block references, transclusion (SyncedContent), backlink inheritance, outline hierarchy.
- Four-layer page surface: property region, body region, view region, layout region.
- Single composition engine with document-first and layout-first editing modes.
- Slash-command embedding of any Surface Control element into block prose.
- Display modes, form modes, and document modes as config entities, with document mode cascading.
- DailyNote integration for capture-first workflows.
- Template system for new entities, pages, bundles, and blocks, including package-aware templates.

### Phase 3 — View/layout/query fusion (weeks 17–24)

**Goal:** Structured data, embedded views, queries, and formulas work seamlessly within and across entity pages.

Deliverables:
- Collection concept supporting both concrete and virtual membership.
- View builder generating table, list, gallery, board/kanban, calendar, timeline, graph, tree, and dashboard layouts — all as config entities.
- Query concept operating across both structured and unstructured zones, with dual-mode compilation (simple → Datalog/SQL).
- Embeddable query blocks within content pages (live-updating inline queries).
- ExposedFilter generalized into page-embeddable filter controls.
- Formula system at all five scopes: field, view, inline, graph, and semantic extraction.
- View modes for block subtrees: same query rendering as table in one context, kanban in another.
- Progressive formalization pipeline: structure-detector plugins (kv_detector, llm_detector) proposing promotions from freeform text to typed properties.

### Phase 4 — Package browser and Bind workbench (weeks 25–34)

**Goal:** Apps are extensible via a browser and generate their own interfaces through configurable Bind manifests.

Deliverables:
- ConceptBrowser concept with discovery, preview, install, and configure flows.
- KitManager integration with PubGrub dependency resolution and content-addressed storage.
- Compatibility profiles for packages (platforms, runtimes, bind targets, provider assumptions).
- Starter app publishing and installation.
- Dual-manifest Bind architecture: config manifest and content manifest auto-generated for every app.
- Bind manifest editing UI: concept selection, grouping, per-concept metadata (auth, rate limits, pagination, field visibility), action sequences, preview, manifest composition.
- Generated outputs per manifest: CLI, REST API, MCP server, GraphQL schema, SDK, OpenAPI spec, Claude Skills, `.claude` / `.gemini` / `.codex` directories.
- AutomationTarget integration in bind UI.

### Phase 5 — Multi-platform surfaces and DevOps (weeks 35–44)

**Goal:** The same app definition deploys to web, phone, desktop, web3, and watches with a default pipeline.

Deliverables:
- Web target: Next.js on Vercel with per-page rendering strategy (SPA, SSG, SSR, RSC, pure in-browser) as a config entity property.
- Mobile targets: Android (Jetpack Compose) and iOS (SwiftUI) via Surface adapters, offline-first with Replica/SyncPair/ConflictResolution.
- Desktop targets: GTK (Linux), WinUI (Windows), AppKit/SwiftUI (macOS).
- Watch targets: WearCompose (Android Wear), WatchKit (Apple Watch) as read-only telemetry nodes with reduced Bind manifests.
- Web3 target: SolidityGen for smart contract interfaces, IPFS frontend, Connector/SyncPair oracle bridge.
- Storage backend configuration per entity type in admin UI; federated storage via ContentStorage providers.
- Default deployment pipeline: `clef dev`, `clef test`, staging on Vercel, production with progressive rollout, cloud-triggered mobile/desktop builds.
- ConfigSync for GitOps with layered environment overrides.
- Pluggable IaC providers (Terraform, Pulumi, DockerCompose) and Runtime providers (Vercel, AWS Lambda, K8s, CloudRun) swappable in UI.

### Phase 6 — Score deep integration and automation (weeks 45–52)

**Goal:** Score provides full inspection across software structure and runtime content; the automation layer is complete.

Deliverables:
- Concept graph navigator with visual graph of all concepts, sync connections, suite memberships.
- Sync chain viewer for tracing actions through the sync chain.
- AST explorer via SyntaxTree and DefinitionUnit.
- Hierarchical tracing with derivedContext tags for feature-scoped debug.
- Dual navigation mode: every entity reachable via file representation and frontend UI, with instant switching.
- Three-tier automation dispatch fully wired: SyncEngine, EventBus, AutomationRule.
- AutomationRule UI for end-user event-condition-action rules with AutomationScope safety.
- Workflow concept with default Content Moderation workflow.
- Process suite integration (when installed): ProcessSpec, ProcessRun, StepRun, FlowToken, ProcessVariable, WorkItem with Timer/Escalation SLA tracking, LLMCall with ToolRegistry and EvaluationRun auto-repair, ProcessEvent audit ledger.
- Render pipeline: declarative render tree, cache-before-render, cacheability bubbling, placeholdering, progressive streaming.
- AppShell derived concept composing everything into the root application.

---

## 20. Comparison notes and collapse justifications

### What was merged

All three source documents agreed on the core architecture (entity reflection, dual domains, typed data tree, bundles, field triad, dual-zone pages, blocks-as-paragraphs, dual-manifest Bind, multi-platform targets, taxonomy, comments, media, Score, package browser, automation). This plan preserves the full consensus without repetition.

### What was promoted from individual documents

- **Four-layer page surface** (property/body/view/layout regions) — from the CMS/App Studio doc. The Base Platform doc described this more loosely; the four-layer decomposition is cleaner for implementation.
- **Form modes** alongside display and document modes — from CMS/App Studio. The Base Platform doc only covered display modes and document modes; form modes are necessary for the editing story.
- **Five-scope formula system** — from CMS/App Studio. The Base Platform doc mentioned formulas but didn't enumerate scopes; the five-scope model (field, view, inline, graph, semantic extraction) is the right level of ambition.
- **Render pipeline with cacheability bubbling** — from CMS/App Studio. Neither other doc covered rendering performance; this is essential for pages mixing cached and dynamic content.
- **Compatibility profiles and starter apps** — from CMS/App Studio. Important for the package ecosystem to work at scale.
- **Structure-detector plugins** (kv_detector, llm_detector) — from ClefOS. Concrete naming for progressive formalization agents.
- **Dual-mode query compilation** — from ClefOS. The simple-to-Datalog/SQL compilation path is an important implementation detail.
- **Timer/Escalation for SLA tracking** and **EvaluationRun auto-repair loops** — from ClefOS. Useful process-suite details that the other docs glossed over.

### What was collapsed

- **CMS/App Studio's workbench naming** (EntityWorkbench, ContentWorkbench, etc.) — collapsed into the concept decomposition itself. The workbench metaphor is a UI presentation choice, not an architectural decision. The underlying concepts are what matter; how they group in the navigation is a Surface/AppShell concern that should emerge from the concept graph rather than being prescribed upfront.
- **CMS/App Studio's per-section entity lists** (§5.1 and §5.2 listing every content-side and config-side entity) — collapsed into the concept inventory and the entity-reflection description. The lists were useful for scoping but redundant with the concept inventory.
- **ClefOS's section 6 (Score IDE)** — absorbed into the more detailed Score treatment from the Base Platform doc, which specifies concrete UI tools (concept graph navigator, sync chain viewer, AST explorer, dual navigation).
- **CMS/App Studio's §24 (Renderer, caching, streaming)** — promoted to its own section but stripped of Drupal-specific implementation details that don't apply to a concept-oriented architecture. The principles (declarative render tree, cache-before-render, cacheability bubbling, placeholdering, streaming) transfer; the PHP-specific patterns don't.

### What was intentionally NOT collapsed

- **Both "bundles" and "schemas"** — all three documents agree these serve different purposes (stable admin subtypes vs. attachable progressive structure) and must coexist.
- **Both "references" and "relations"** — lightweight schema-less links and typed semantic connections serve different use cases, kept consistent by a bridge sync.
- **All five deployment targets** (web, mobile, desktop, web3, watch) — despite web3 and watch being niche, they validate the platform-independence claim and are architecturally cheap once Surface adapters exist.
- **Three-tier automation** — SyncEngine, EventBus, and AutomationRule serve genuinely different coordination needs (structural wiring, dynamic pub/sub, user-configurable rules) and collapsing them would lose important safety and scoping properties.
