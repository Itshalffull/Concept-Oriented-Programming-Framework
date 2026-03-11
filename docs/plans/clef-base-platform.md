# Clef Base — A concept-oriented application platform

**Version 0.1.0 — 2026-03-06**
**Clef framework dependency:** COPF v0.18.0, Concept Library v0.4.0, Clef Surface v0.4.0
**Status:** Architecture specification

---

## 1. Vision

Clef Base is a full-stack application platform built entirely from Clef concepts, syncs, widgets, binds, and themes. It is to Clef what Drupal is to PHP: the reference application that proves the framework can build real software — and that the software it builds can build more software.

The core idea is that every piece of data in the system is an **entity**, accessed through the entity-reflection suite's shared interface. Every entity is simultaneously a structured record (with typed fields, schemas, relations, and queryable properties) and an unstructured document (with a Roam/Notion/Logseq-like content page made of blocks, backlinks, embeds, and hierarchical paragraphs). The platform ships with a concept browser that can install new concepts, derived concepts, syncs, suites, themes, kits, and widgets at runtime — extending any running application the same way Drupal modules extend a Drupal site.

From a single concept-oriented app definition, Clef Base produces deployable software for the web (Next.js with per-page rendering strategy), phones (Android native, offline-first with sync), desktop (Linux, Windows, macOS via native frontends), web3 (data on an Ethereum L2, UI on IPFS), and companion devices (Android Wear, Apple Watch, open-source watches). The app is authored once in terms of concepts and widgets; Surface adapters and Bind targets handle the rest.

---

## 2. Architectural spine: entities all the way down

### 2.1 The entity-reflection suite

Drupal's deepest architectural insight is that everything — content, configuration, users, taxonomy terms, media, comments, automation rules, views, field definitions — is an entity. Clef Base adopts this wholesale. The entity-reflection suite provides a uniform interface over every concept whose instances make sense as entities. Any concept that stores persistent records opts in by declaring entity-reflection conformance in its `suite.yaml`, and the suite's syncs provide a shared vocabulary of operations: load, save, delete, query, list fields, get display, get form.

The entity-reflection interface does not replace concept-specific actions. An Article concept still has `create`, `update`, `publish` actions with their own semantics and return variants. Entity-reflection adds a parallel generic layer — `EntityReflection/load(type, id)`, `EntityReflection/save(type, id, fields)`, `EntityReflection/query(type, filters)` — that delegates to concept-specific actions via routing syncs. This is the same pattern as Drupal's `EntityInterface`: every entity type implements it, but each also has type-specific methods.

### 2.2 The dual-domain model: content and config

Following Drupal's bifurcation, every entity in Clef Base belongs to one of two domains.

**Content entities** are user-facing, mutable runtime data. They support fields, revisions, translations, comments, and content pages. Examples: articles, pages, media items, taxonomy terms, user profiles, comments, process instances, captured data records. Content entities are stored in the app's primary storage backend and are managed through the content-facing UI.

**Config entities** are structural metadata. They define how the app behaves: content types (bundles), field definitions, view configurations, workflow definitions, display modes, automation rules, theme settings, bind manifests, deployed concept specs. Config entities serialize to YAML-compatible formats for version control and deployment. They are managed through the admin-facing UI.

The distinction matters for authorization (users edit content; admins configure the app), for deployment (config entities export/import across environments), for caching (config entities change rarely and cache aggressively), and for the dual-manifest Bind architecture described in §5.

### 2.3 The typed data tree

Every piece of data in Clef Base follows a typed data hierarchy inspired by Drupal's Typed Data system: Entity → FieldItemList → FieldItem → Property → raw value. Each node in this tree carries type information via the TypeSystem concept, validation constraints via the Validator concept, and change propagation through EventBus subscriptions. This enables generic operations — serialization, validation, transformation, display, form generation — without knowing concrete types. The FormBuilder and Renderer concepts in the Presentation suite consume this tree to produce interfaces automatically.

### 2.4 Bundles: configurable subtypes

Entity types support **bundles** — configurable subtypes that share the same underlying concept but carry different field configurations. An Article bundle and a Page bundle are both ContentNode entities, but Article carries author, publish date, and category fields while Page carries only a body. Bundles are config entities (like Drupal's `NodeType`) that attach field definitions to an entity type. The Schema concept from the Classification suite holds the field definitions; bundles bind schemas to entity types.

This follows the Type-Widget-Formatter triad from Drupal's field system. Each field has a type (what data it stores, via Property and TypeSystem), a widget (how it renders for editing, via FormBuilder and Surface), and a formatter (how it renders for display, via Renderer and DisplayMode). The triad is expressed as three independent concepts coordinated by syncs — never as a single monolithic field object.

### 2.5 Entity references and selection plugins

Entities reference each other through the Relation concept (for typed, labeled, bidirectional connections with cardinality constraints) and the Reference/Backlink concepts (for lightweight, schema-less forward links with automatic reverse indexing). The `relation-reference-bridge.sync` keeps both systems consistent.

Selection plugins control which entities can be referenced from which fields. A "category" field on an Article might only allow references to terms from the "Topics" vocabulary. Selection is implemented as a provider on the Relation concept: when a relation field is configured, a selection provider (default filter, taxonomy-scoped, view-based query, or custom) determines the candidate set. This mirrors Drupal's entity reference selection handlers.

---

## 3. Every entity is also a page

### 3.1 The dual-zone entity

This is the architectural centerpiece that bridges structured and unstructured content. Every entity in Clef Base has two zones.

The **structured zone** consists of typed fields conforming to the entity's schema. These are the fields defined by the bundle's Schema, stored as Property values, queryable through the Query concept, displayable through View configurations, and editable through FormBuilder-generated forms. This is the Drupal side of the platform.

The **unstructured zone** is a content page attached to every entity — a Roam/Notion/Logseq-like document made of blocks. This page is the entity's PageAsRecord body: an ordered tree of ContentNode blocks that can contain prose, headings, images, embeds, block references, backlinks, code, and any other content type. The page is the entity's narrative, its documentation, its living context.

The two zones are unified through the PageAsRecord concept from the bridging research. The structured zone renders above the body (Notion-style property panel) or inline within the body (Tana-style fields as child nodes). The unstructured zone renders below or around the structured fields. Users can progressively formalize: start with freeform content in the page body, then add structure by applying schemas (Tana's supertag pattern), and structured fields appear without moving any content.

### 3.2 Block system: paragraphs meet Roam blocks

Each block in the content page combines the properties of Roam blocks and Drupal paragraphs.

**From Roam/Logseq blocks:** Each block has a unique ID, can be referenced from anywhere via `((block-id))` syntax, can be embedded/transcluded into other pages, inherits backlinks from its ancestors in the outline hierarchy, supports bidirectional links via `[[entity-name]]` syntax, and participates in the full Query system. The Backlink concept maintains the reverse index; the Embed concept handles transclusion; the Outline concept manages the tree hierarchy.

**From Drupal paragraphs:** Each block is an entity that owns its sub-blocks (composition, not aggregation). Block types have schemas — a "callout" block type carries a severity field, a "code" block type carries a language field, a "table" block type carries column definitions. Blocks support hierarchical revisions: revising a parent entity creates new revisions for all its child blocks. Block types are extensible through the same bundle/schema mechanism as any other entity.

**View modes for blocks.** Each block subtree has a configurable view mode that determines how it and its children render: as a document (flowing prose), as bullets (indented outline), as numbered items, as a table, as a kanban board, or as any custom view mode. View modes are DisplayMode config entities applied at the block level. This mirrors Drupal's display modes while adding the block-level flexibility of Notion's database views.

### 3.3 Queries over unstructured content

The Query concept operates across both zones. Structured queries filter by field values, schemas, relations, and taxonomy terms. Unstructured queries filter by backlinks, block references, tags, properties embedded in block content, and full-text search. Queries can be embedded within any content page as live-updating blocks — the same pattern as Notion's linked databases, Tana's search nodes, and Logseq's embedded queries.

Query results themselves have configurable view modes. A query embedded in a project page might render as a table of tasks; the same query embedded in a dashboard might render as a kanban board. The View concept handles this separation of data from presentation.

### 3.4 The unified layout editor

Content pages support layouts, similar to how Coda pages work. A layout is a spatial arrangement of zones — columns, sections, tabs, accordions — into which both structured and unstructured content can be placed. The Component concept from the Layout suite handles spatial composition.

The structured layout editor (for placing form fields, views, controls, and widgets) and the unstructured content editor (for writing prose, creating block trees, embedding queries) are unified into a single editing experience. Anything available as a widget in the structured editor can be inserted into the unstructured editor via slash commands. Anything authored as blocks in the unstructured editor can be embedded in the structured layout. The editors converge because both operate on the same underlying entity: ContentNode blocks arranged in an Outline tree, optionally governed by Schema field definitions, rendered through Surface widgets.

---

## 4. Taxonomy, classification, and progressive structuring

### 4.1 Taxonomy as a first-class system

The Taxonomy concept provides hierarchical classification vocabularies. Vocabularies are config entities defining classification schemes (Topics, Regions, Skill Levels). Terms are content entities forming trees within vocabularies. Entities receive taxonomy references through standard Relation fields.

By default, Taxonomy is applied wherever hierarchical classification makes sense — not just user-facing content but all entities. A vocabulary of "Concept Categories" classifies concepts in the registry. A vocabulary of "Deployment Targets" classifies environments. A vocabulary of "Widget Types" classifies Surface widgets. Taxonomy is infrastructure, not just content decoration.

### 4.2 Schema-as-mixin and progressive formalization

The Schema concept operates as a mixin (Tana's supertag pattern). A schema is a first-class entity independent of any collection or container. Schemas define typed fields, support single inheritance (`extends`), and can be composed by applying multiple schemas to the same entity (emergence). Applying a schema to an entity materializes its fields without destroying existing content.

This enables progressive formalization — the meta-pattern that emerges from the Notion/Tana/Coda research. The lifecycle of content in Clef Base follows a predictable path:

1. **Capture** — Write freeform content in a daily note or scratch page (ContentNode, DailyNote)
2. **Organize** — Move blocks into collections, add to outlines (Collection, Outline)
3. **Classify** — Apply a schema/tag to the entity; structured fields appear (Schema, Tag, PageAsRecord)
4. **Connect** — Create relations to other entities; rollups aggregate across connections (Relation, Formula)
5. **Compute** — Add formula fields, embedded queries, computed views (Formula, Query, View)
6. **Automate** — Create automation rules triggered by field changes or schema application (AutomationRule, Workflow)
7. **Interact** — Add controls (buttons, sliders, toggles) that operate on structured data (Control)
8. **Share** — Embed synced content, publish views, expose via API (SyncedContent, View, Bind)

Users can enter at any stage and advance incrementally. Nothing forces structure upfront; nothing prevents it later.

---

## 5. The dual-manifest Bind architecture

Every Clef Base application generates **two Bind manifests** — two complete interface specifications that produce independent but complementary interface targets.

### 5.1 The config manifest (developer-facing)

The config manifest covers all config entities and developer-facing concepts: content type definitions, field configurations, schema management, view builder, workflow definitions, automation rule management, theme settings, deployment configuration, concept registry, suite management, bind target configuration, and Score graph navigation.

From this manifest, Bind generates:

- A **config CLI** for developers, with subcommand groups mirroring the config entity hierarchy (`clef config content-type list`, `clef config field add`, `clef config workflow export`)
- A **config REST API** for programmatic administration, with an OpenAPI spec
- A **config MCP server** for AI-assisted administration, with tool definitions for every config action
- A **config GraphQL schema** for rich admin UIs
- An **admin SDK** in the configured languages
- A `.claude` directory with a `CLAUDE.md` file describing the project's architecture, concept inventory, and available admin operations — plus equivalent files for Gemini and Codex (`GEMINI.md`, `CODEX.md`)
- Claude Skills definitions for common admin workflows

### 5.2 The content manifest (user-facing)

The content manifest covers all content entities and user-facing concepts: content CRUD, content pages, queries, views, taxonomy navigation, comments, media management, search, user profiles, and application-specific domain concepts.

From this manifest, Bind generates:

- A **content CLI** for power users and automation scripts
- A **content REST API** with an OpenAPI spec
- A **content MCP server** for AI-assisted content operations
- A **content GraphQL schema** for rich user-facing UIs
- A **user SDK** in the configured languages
- Claude Skills for common content workflows

### 5.3 Custom manifests via UI

Beyond the two default manifests, users can create new Bind manifests through the admin UI. This is not a raw file editor — it is a structured interface that lets you:

- Select which concepts to include in the manifest
- Configure how concepts group into API resource collections, CLI subcommand trees, MCP tool groups, or GraphQL namespaces (using the Grouping concept from the Interface suite)
- Set per-concept interface metadata: authentication requirements, rate limits, pagination strategies, field visibility (using the Projection and Middleware concepts)
- Define action sequences for documentation and onboarding (using the ActionGuide concept)
- Preview the generated interface in each target format before committing
- Compose manifests from other manifests, creating layered API surfaces (a public API manifest that exposes a subset of the content manifest, a partner API manifest that adds specific integration endpoints)

Each custom manifest produces its own complete set of interface targets — CLI, REST, MCP, GraphQL, SDK, OpenAPI spec, Skills — all generated by Bind from the manifest definition.

---

## 6. Deployment targets and cross-platform rendering

### 6.1 Web: Next.js with per-page rendering strategy

The default web deployment target is Next.js on Vercel. The platform provides a single Next.js application where each page's rendering strategy is configurable as a property of the page's route config entity:

- **SPA (Single-Page Application):** Client-side rendering, full interactivity, no server round-trips after initial load. For dashboards, admin interfaces, interactive editors.
- **Pure static (SSG):** Pre-rendered at build time. For marketing pages, documentation, blogs.
- **Hydrated (SSR + hydration):** Server-rendered with client-side interactivity. For content pages that need SEO plus interactivity.
- **Pure server (RSC):** React Server Components, no client JavaScript. For data-heavy pages where interactivity is minimal.
- **Pure in-browser:** No server at all; runs entirely in the browser via WASM or service worker. For offline-capable views.

The rendering strategy is a config entity property — changeable in the admin UI without touching code. Surface's FrameworkAdapter concept handles the translation from headless widget specs to React components. The existing React adapter in surface-render already does this; the Next.js deployment target adds route configuration and build-time generation.

### 6.2 Phone: Android native, offline-first

The mobile deployment target produces an Android-native app (via Jetpack Compose through Surface's Compose adapter) with an offline-first architecture. The app stores entity data locally using the Replica concept from the Collaboration suite, syncs with the server when online via the SyncPair concept from the Data Integration suite, and resolves conflicts through the ConflictResolution concept.

The backend for mobile can remain Next.js (API routes) or any suitable server — the Bind-generated REST/GraphQL API is the contract, not the server implementation.

iOS support follows the same pattern using Surface's SwiftUI adapter. The backend choice is independent of the frontend.

### 6.3 Desktop: native frontends, shared backend

Desktop deployment targets use platform-native frontend libraries through Surface adapters:

- **Linux:** GTK adapter (surface-render already declares this)
- **Windows:** WinUI adapter
- **macOS:** AppKit adapter (or SwiftUI adapter, sharing code with iOS)

The backend can be a local Next.js server, a local SQLite database accessed directly, or a remote API — configurable per deployment. The Env concept from the Deploy suite manages environment-specific settings.

### 6.4 Web3: Ethereum L2 data, IPFS UI

The web3 deployment target splits the application across decentralized infrastructure:

- **Data backend:** Important entities (ownership records, governance votes, financial transactions) store their state on an Ethereum L2 smart contract. The SolidityGen framework concept generates contract interfaces from concept specs. The ChainMonitor concept tracks finality. Fraud proofs run on whichever fraud proof platform is most suitable at deployment time — this is a provider choice, not an architectural decision.
- **UI hosting:** The frontend deploys to IPFS as a static site with client-side rendering, accessed via ENS domains.
- **Oracle sync:** A sync bridge connects the on-chain state with the off-chain state of the same entities, so content authored in the web UI appears on-chain and vice versa. The Connector concept handles the bridge; the SyncPair concept manages bidirectional state.

The Solidity target is necessarily a **subset** of the full concept vocabulary — only concepts that can express their state and actions as smart contract interfaces deploy on-chain. The Web3 suite (ChainMonitor, Content, Wallet) provides the primitives.

### 6.5 Companion devices: watches

Watch targets (Android Wear via Surface's WearCompose adapter, Apple Watch via WatchKit adapter, open-source watches) are **display and notification endpoints**, not full authoring environments. They:

- Sync with the phone and desktop apps via the SyncPair concept
- Display entity data through simplified Surface widget specs optimized for small screens
- Provide native functions: notifications (Notification concept), quick capture (voice-to-entity via Capture concept), status glances (View concept with watch-specific display modes)
- Cannot edit config entities or modify app structure

Watch apps are generated from the same concept definitions as the full apps but with a watch-specific Surface theme and a reduced Bind manifest that exposes only read and quick-action operations.

### 6.6 Unified authoring, platform-specific rendering

The critical point: the application is authored **once** in terms of concepts, syncs, derived concepts, schemas, bundles, widgets, themes, and bind manifests. The per-platform differences are:

- Which Surface adapter renders the widgets (React, Compose, SwiftUI, GTK, WinUI, Ink, WearCompose, WatchKit)
- Which PlatformAdapter handles navigation, lifecycle, and storage (Browser, Desktop, Mobile, Terminal, Watch)
- Which Bind targets generate the interface layer (REST, GraphQL, CLI, MCP)
- Which deployment target packages and ships the result (Vercel, Play Store, App Store, Flathub, IPFS)
- Which rendering strategy applies per page (for web targets)

The concept layer, the sync layer, the schema layer, and the content layer are completely platform-independent.

---

## 7. Authorization, access control, and commenting

### 7.1 Preconfigured authorization

Clef Base ships with the Identity suite (Authentication, Authorization, AccessControl, Session) preconfigured. The defaults are:

- **Role-based access control** with built-in roles: anonymous, authenticated, editor, admin. Custom roles are config entities.
- **Three-valued access algebra** following Drupal's model: allowed, neutral, forbidden. Results compose via OR (any allowed + none forbidden = granted) for entity access and AND (all must allow) for route access. Every access result carries cacheability metadata.
- **Entity-level access** via AccessControl policies attached to entity types. Policies are config entities; new policies are installable from the concept browser.
- **Field-level access** via per-field visibility settings on bundle configurations.

### 7.2 Customizable and extendable

Authorization is not a black box. Because Authentication, Authorization, and AccessControl are independent concepts wired by syncs, any piece of the authorization chain can be replaced or extended:

- Swap the authentication provider (cookie, OAuth, SAML, passkey) via PluginRegistry
- Add group-scoped access (the Group concept from the Collaboration suite provides workspace-level RBAC, like Drupal's Group module)
- Add process-based authorization (the process-human suite's WorkItem concept provides task-level access control)
- Add content moderation workflows (the Workflow concept gates publication state transitions behind permission checks)

### 7.3 Universal commenting

Every entity can receive comments. The Comment concept attaches polymorphically to any entity type via entity type + entity ID + field name — the same materialized-path threading pattern from Drupal.

The difference is in defaults: for content entities (articles, pages, media), comments are front-and-center in the UI with public visibility. For config entities (field definitions, workflow configs, view settings), comments are available but tucked behind an admin panel, visible only to users with admin roles. This mirrors how developers use comments on code review — every config change can be annotated and discussed, but the commenting UI is not the primary interface for config entities.

---

## 8. File and media management

The Media suite (FileManagement, MediaAsset) provides the file/media infrastructure, following Drupal's architecture:

- **Files** are entities with reference counting. Files start temporary, become permanent when referenced by another entity, and are garbage-collected when unreferenced. Stream wrappers handle storage access policy (public, private, S3, IPFS).
- **Media** entities wrap heterogeneous assets — local files, images, remote video, embedded content — behind a uniform interface via MediaSource providers. Each media type (image, video, document, audio, remote video) is a bundle with its own schema and display modes.
- **Fields** can reference files or media entities. An "image" field on an Article renders an upload widget in the form and a responsive image in the display. A "document" field renders a file picker and a download link.

Media entities are full entities in the system — they have content pages (for metadata, usage tracking, alt text, captions), they participate in taxonomy (media can be categorized), and they can receive comments (for review workflows).

---

## 9. Score UI and concept navigation

### 9.1 Full Score visualization

The Score system (the code representation and semantic query infrastructure) gets a complete UI in Clef Base. The Score UI provides:

- **Concept graph navigator:** A visual graph showing all concepts in the application, their sync connections, their suite memberships, and their dependency relationships. Both the Graph concept and the Surface Canvas widget render this. Clicking a concept node navigates to either its file representation (the `.concept` spec) or its frontend management UI (the entity list for that concept type).
- **Sync chain viewer:** Trace any action through the sync chain, seeing which syncs fire, which concepts are invoked, and what data flows between them. The FlowTrace concept provides the runtime data; the UI renders it as an interactive tree.
- **AST explorer:** For any file in the project, drill into the parsed AST via the SyntaxTree concept. Navigate individual definitions (functions, classes, concept specs) via DefinitionUnit. See symbol references and scoping via Symbol and ScopeGraph.
- **Dual navigation mode:** Every entity in the system can be reached through two paths: its **file representation** (where it lives on disk, its source code, its spec) and its **frontend UI** (where it is managed in the running application). The Score UI provides instant switching between these two views for any entity.

### 9.2 Concept browser and package management

The concept browser is the centerpiece of Clef Base's extensibility — the equivalent of Drupal's module installer. Through the browser, users can:

- **Discover** concepts, suites, kits, derived concepts, syncs, themes, and widgets from the Repertoire standard library and from third-party registries. The KitManager framework concept handles installation and dependency resolution (PubGrub algorithm). The content-addressed storage system ensures reproducible installs.
- **Install** new capabilities at runtime. Installing a suite adds its concepts to the entity-reflection system, registers its providers with PluginRegistry, activates its syncs, generates its Surface widgets, and creates its Bind interface targets. The installation process follows the same sync chain as any other data flow: detect → validate → transform → store → track.
- **Preview** what a new concept adds before installing: which entity types it introduces, which syncs it wires, which existing concepts it extends, and which Surface widgets it provides.
- **Configure** installed concepts through the standard admin UI. Every concept's configuration is a config entity, editable through the same FormBuilder-generated interface as any other config entity.
- **Extend** existing apps from any of the pre-built Clef applications (clef-account, clef-hub, clef-registry, etc.) as starting points, installing additional concepts on top.

---

## 10. Default DevOps and deployment pipeline

### 10.1 Single pipeline

Every Clef Base application ships with a preconfigured development, testing, building, and deployment pipeline managed by the Deploy suite concepts (DeployPlan, Rollout, Migration, Health, Env, Telemetry, Artifact, and the various coordination+provider concepts for runtime, secrets, IaC, GitOps, builders, and toolchains).

The default pipeline provides:

- **Local development:** `clef dev` runs a hot-reloading development server (DevServer concept) with all deployment targets available locally.
- **Testing:** `clef test` runs the full test suite — conformance tests (Conformance concept), contract tests (ContractTest concept), snapshot tests (Snapshot concept), with intelligent test selection based on change impact (TestSelection concept).
- **Staging on Vercel:** Preview deployments for every pull request, with the full application running in a staging environment (Env concept with dev/staging/prod configuration).
- **Production on Vercel:** The default web deployment target, with progressive rollout (Rollout concept supporting canary, blue-green, and rolling strategies).
- **Mobile builds via cloud:** The deployment pipeline triggers cloud-based builds for Android (Gradle) and iOS (Xcode Cloud) apps, producing preview builds for staging and release builds for production.
- **Desktop builds via cloud:** Similarly, desktop builds for Linux, Windows, and macOS are triggered as part of the deployment pipeline.

### 10.2 Swappable in the UI

Every aspect of the deployment pipeline is configurable through the admin UI because every aspect is a config entity. Want to deploy to AWS instead of Vercel? Change the Runtime provider. Want to use Terraform instead of Pulumi for infrastructure? Change the IaC provider. Want to add a GitHub Actions workflow instead of the built-in pipeline? The GitOps provider supports ArgoCD, Flux, and custom CI integration.

The config manifest's CLI and MCP targets provide programmatic access to all deployment operations, enabling AI-assisted DevOps through Claude Skills.

---

## 11. The automation layer

### 11.1 Three-tier dispatch in Clef Base

Clef Base inherits Clef's three-tier dispatch model, and all three tiers are active and visible in the platform:

**Tier 1 — SyncEngine (structural wiring).** The foundational layer. Every cross-concept delegation uses syncs. Users do not directly interact with this layer, but they see its effects everywhere: saving a content entity triggers cache invalidation, search indexing, URL alias generation, and provenance tracking — all via syncs.

**Tier 2 — EventBus (application pub/sub).** Dynamic subscriber management, priority ordering, dead-letter queues, and event history. Used when the set of listeners is dynamic — for example, when plugins register event handlers at installation time.

**Tier 3 — AutomationRule (user-configurable rules).** End users configure their own event-condition-action rules through the admin UI. "When a new Article is published and its category is 'News', send a notification to the editors channel." AutomationRule conditions delegate evaluation to the SyncEngine's `evaluateWhere`; actions dispatch through the AutomationDispatch concept to registered providers (ManifestAutomationProvider for build-time action registries, SyncAutomationProvider for runtime user-defined syncs). AutomationScope provides allowlist/denylist control over which actions user-defined automations can invoke.

### 11.2 Workflow as content moderation

The Workflow concept from the Automation suite provides finite state machines for content lifecycle management. The default configuration includes a "Content Moderation" workflow with Draft → Review → Published → Archived states, mirroring Drupal's content moderation module. Transitions require permissions; publishing triggers cache invalidation and search indexing via syncs.

### 11.3 Process orchestration

For more complex orchestrations — multi-step approval chains, LLM-assisted content processing, external system integrations — the Process suite provides full process modeling. ProcessSpec defines reusable blueprints; ProcessRun tracks execution instances; StepRun manages individual step lifecycle; FlowToken handles parallel fork/join semantics; ProcessVariable stores process-scoped data; WorkItem manages human task assignment; ConnectorCall tracks external API invocations; LLMCall manages language model interactions; EvaluationRun assesses quality; and ProcessEvent provides an append-only audit ledger.

The Process suite's six sub-suites (process-foundation, process-human, process-automation, process-reliability, process-llm, process-observability) are independently installable — a simple app might only need process-foundation and process-human, while a complex enterprise workflow might use all six.

---

## 12. Content storage backends

### 12.1 Default backends per target

Each deployment target ships with a sensible default storage backend:

- **Web (Next.js/Vercel):** PostgreSQL for content entities, filesystem/S3 for media, environment variables + Vercel KV for config
- **Mobile (Android/iOS):** SQLite (via the Replica concept) for local offline storage, syncing to the server's PostgreSQL
- **Desktop:** SQLite for local-first storage, with optional server sync
- **Web3:** Smart contract state for on-chain entities, IPFS for media, SQLite for local cache

### 12.2 Federated storage

The federated ContentStorage provider from the Data Integration kit enables entities whose data spans multiple backends. A WikipediaArticle entity might store `internal_notes` and `quality_score` locally while fetching the article content from the Wikipedia API. An ExternalProduct might store pricing from a Shopify API while maintaining local inventory notes. Federation is configured per-schema through `Schema.associations`, not hard-coded — changing where data comes from is a config change, not a code change.

### 12.3 Swappable in the UI

Storage backends are managed as config entities. The admin UI exposes storage backend configuration per entity type. Want to move from PostgreSQL to CockroachDB? Change the storage provider. Want to add Redis caching in front of the database? Enable the Cache concept's integration sync. The platform's storage layer is a concept, not an assumption.

---

## 13. Concept inventory for Clef Base

Clef Base assembles concepts from across the Clef ecosystem. The following suites form the platform's foundation:

**From the existing Concept Library (v0.4.0):**
Foundation (ContentNode, ContentParser, ContentStorage, Intent, Outline, PageAsRecord, Property, TypeSystem), Infrastructure (Cache, ConfigSync, EventBus, Pathauto, PluginRegistry, Validator), Classification (Namespace, Schema, Tag, Taxonomy), Content (Canvas, Comment, DailyNote, SyncedContent, Template, Version), Linking (Alias, Backlink, Reference, Relation), Presentation (DisplayMode, FormBuilder, Renderer, View), Query/Retrieval (ExposedFilter, Query, SearchIndex), Automation (AutomationRule, Control, Queue, Workflow), Data Organization (Collection, Graph), Computation (ExpressionLanguage, Formula, Token), Collaboration (Flag, Group), Media (FileManagement, MediaAsset), Notification (Notification), Layout (Component), Identity (Authentication, Authorization, AccessControl, Session), Data Integration (DataSource, Connector, Capture, FieldMapping, Transform, Enricher, SyncPair, DataQuality, Provenance, ProgressiveSchema), Automation Providers (AutomationDispatch, AutomationScope, ManifestAutomationProvider, SyncAutomationProvider, AutomationTarget).

**From the Interface/Bind suite:**
Projection, Generator, ApiSurface, Middleware, Grouping, ActionGuide, Annotation, EnrichmentRenderer, and the Target/Sdk/Spec coordination concepts with their providers.

**From Clef Surface (v0.4.0):**
All 29 concepts across 7 suites — surface-core, surface-component, surface-render, surface-theme, surface-app, surface-spec, surface-integration.

**From the Deploy suite:**
DeployPlan, Rollout, Migration, Health, Env, Telemetry, Artifact, and all coordination+provider concepts.

**From the Process Kit (when installed):**
20 concepts across 6 sub-suites for workflow orchestration.

**From the Governance Kit (when installed):**
60 concepts across 7 sub-suites for formal governance processes.

**From the Formal Verification Suite (when installed):**
7 concepts for property verification and quality signaling.

**New to Clef Base:**
- **EntityReflection** — The uniform entity interface concept, providing generic load/save/delete/query/list-fields/get-display/get-form operations delegated to concept-specific actions via routing syncs. Owns entity type registry, bundle definitions, and field attachment metadata.
- **ConceptBrowser** — The package discovery and installation UI concept. Owns installed package state, registry connections, preview computations, and installation workflows. Delegates dependency resolution to KitManager and content-addressed storage to the package management infrastructure.
- **AppShell** — The root derived concept that composes all of Clef Base's features into a single application. Owns the navigation structure, default layouts, and top-level routing. Its operational principle: "After installing Clef Base, you can create content entities through the content UI, configure the application through the admin UI, and extend it through the concept browser."

---

## 14. What you can build

Clef Base is not one application — it is an application platform. The concept browser and the dual-manifest Bind architecture mean that the same platform can become:

- A **content management system** (Drupal-like): install content types, configure fields and views, build editorial workflows, deploy a website
- A **project management tool** (Notion-like): use the PageAsRecord dual-zone model, create task schemas with kanban views, embed queries in project pages
- A **knowledge base** (Roam-like): daily notes, backlinks, graph visualization, progressive formalization from freeform to structured
- A **CRM**: install customer/contact/deal schemas, configure sales pipeline workflows, build dashboards with formula-computed metrics
- A **data integration platform**: install connectors, configure capture pipelines, use progressive schema detection to structure incoming data
- An **internal tools builder**: use the Control concept for interactive forms, AutomationRule for business logic, Bind for API generation
- A **collaborative workspace** (with the Collaboration suite): real-time editing, CRDT-based conflict resolution, version history, attribution

All of these emerge from the same concept library, configured through the admin UI, deployed through the same pipeline, and extensible through the concept browser. The platform captures Drupal's 20-year insight — that the most powerful CMS is the one that can become anything — and generalizes it to any application domain, any deployment target, and any programming paradigm through the Clef concept model.
