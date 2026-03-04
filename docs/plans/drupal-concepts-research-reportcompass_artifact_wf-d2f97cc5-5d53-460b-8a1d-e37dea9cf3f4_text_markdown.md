# Drupal's architecture decoded as composable COPF concepts

Drupal 10/11's architecture contains **at least 25 distinct, reusable design patterns** that can be extracted and modeled as independent COPF concepts — purpose-driven nanoservices with their own state, actions, and operational principles, coordinated through declarative synchronizations. The entity system, plugin architecture, and event-driven lifecycle together form a rich substrate of patterns applicable far beyond PHP CMSes. Some subsystems (Taxonomy, Cache, Workflow, Flag) map almost perfectly to Jackson's concept model, while others (Entity/Field/Render pipeline) represent deeply coupled meta-frameworks that must be decomposed before they can serve as independent concepts. This analysis extracts every major pattern, evaluates its independence, and maps the synchronizations that would coordinate them in a COPF application.

---

## The dual-domain entity model: Drupal's architectural spine

Drupal's most fundamental architectural decision is bifurcating all data into two entity families — **content entities** (user-facing, mutable data) and **config entities** (system settings, exportable as YAML). This **Dual-Domain Object pattern** underpins everything.

**Content entities** (`ContentEntityBase`) store runtime data — nodes, users, taxonomy terms, comments, media, files. They support fields, revisions, translations, and live in SQL tables auto-generated from field definitions. **Config entities** (`ConfigEntityBase`) store structural metadata — content types, views, roles, field storage definitions, image styles. They serialize to YAML for deployment across environments. The two families share a common `EntityInterface` but diverge in storage, lifecycle, and management semantics.

The entity type hierarchy itself is built on the **Plugin pattern** — entity types are discovered via PHP 8 attributes (`#[ContentEntityType]`, `#[ConfigEntityType]`), making the container for all data an extensible, discoverable plugin. Entity types delegate behavior to swappable **handler objects** (storage, access, forms, view builders, route providers), implementing a uniform **Strategy pattern** across all entity operations. This means any entity type can swap its persistence backend, access logic, or rendering strategy without affecting other subsystems.

The **Typed Data system** gives every piece of data in Drupal self-describing metadata, forming a navigable tree: Entity → FieldItemList → FieldItem → Property → raw value. Each node in this tree carries type information, validation constraints, and change propagation (`onChange()` fires upward). This **Composite/Self-Describing Data pattern** enables generic operations — serialization, validation, transformation — without knowing concrete types. For COPF modeling, the Typed Data system represents a standalone **TypeSystem** concept with purpose "make all data introspectable," owning type definitions as state, and providing `resolve`, `validate`, `navigate`, and `serialize` actions.

---

## 27 extractable COPF concepts from Drupal's subsystems

Each subsystem below is analyzed for its concept candidacy — purpose, state, actions, and independence level. Concepts are organized by domain.

### Identity and access concepts

**Authentication** owns user credentials, sessions, and authentication provider chains. State: user accounts, hashed passwords, sessions (database-backed). Actions: `register`, `login`, `logout`, `resetPassword`. Drupal implements a **Strategy pattern** for authentication providers (cookie, OAuth, SAML, Basic Auth) — each implements `AuthenticationProviderInterface` with `applies(Request)` and `authenticate(Request)`. The operational principle: "after setting a password, presenting it authenticates you." **Independence: high** — this concept works identically in any application.

**Authorization (RBAC)** owns roles, permissions, and the permission-checking logic. State: roles (config entities), permission sets per role. Actions: `grantPermission`, `revokePermission`, `assignRole`, `checkPermission`. Drupal's two built-in roles (`anonymous`, `authenticated`) plus configurable custom roles implement classic **Role-Based Access Control**. The special UID 1 super-admin bypasses all checks. **Independence: high** — RBAC is universal.

**Access Control (Three-Valued Logic)** deserves its own concept. Drupal's `AccessResultInterface` implements a tri-state algebra: `allowed`, `neutral`, `forbidden`. Results compose via `orIf()` (entity access — any allowed + none forbidden = granted) and `andIf()` (route access — all must allow). Every access result carries **cacheability metadata** (tags, contexts, max-age), enabling cached access decisions with correct invalidation. This **Chain of Responsibility with cacheable policy objects** pattern is Drupal's most sophisticated access innovation. State: transient access results. Actions: `check`, `combine`, `cache`. **Independence: high** — the algebra is universally applicable.

### Content and classification concepts

**ContentStorage** (the Entity Storage subsystem) implements the **Repository pattern** with pluggable backends. State: entity data in SQL tables (or any backend). Actions: `create`, `load`, `save`, `delete`, `query`. The SQL storage auto-generates schema from field definitions (**Schema-on-Write**) with four table layouts depending on entity capabilities (simple, translatable, revisionable, or both). Storage handlers are per-entity-type and swappable. **Independence: high** — storage abstraction is universal.

**Bundle (Configurable Subtype)** models the pattern of defining subtypes of an entity with different field configurations. State: bundle definitions (config entities like `NodeType`, `MediaType`). Actions: `defineBundle`, `attachField`, `removeField`. Bundles are the mechanism that lets "Article" and "Page" both be nodes yet carry different fields. **Independence: moderate** — tightly coupled with FieldDefinition and ContentStorage.

**Field (Composable Data Attachment)** separates into three sub-concepts following the **Type-Widget-Formatter triad** — a specialized MVC pattern at the field level. **FieldType** (Model) defines storage schema and property definitions. **FieldWidget** (Input/Controller) defines form rendering. **FieldFormatter** (Output/View) defines display rendering. Each is an independent plugin type; one FieldType can have many Widgets and Formatters. State: field storage configs, field instance configs, field data. Actions: `defineField`, `getValue`, `setValue`, `validate`. **Independence: moderate** — the triad pattern is reusable, but the three are interdependent.

**EntityReference (Association)** implements foreign-key relationships between entities with **Selection plugins** controlling which entities can be referenced (default filter or Views-based). Referenced entities lazy-load via computed properties. State: reference target_id values. Actions: `reference`, `dereference`, `query`. **Independence: high** — the association pattern is universal.

**Taxonomy (Hierarchical Classification)** is Drupal's cleanest COPF concept candidate. Vocabularies (config entities) define classification schemes; terms (content entities) form trees with parent-child relationships. State: vocabularies, terms, hierarchy edges. Actions: `createVocabulary`, `addTerm`, `setParent`, `tagEntity`, `untagEntity`. Operational principle: "after tagging content with a term, searching by that term finds the content." Terms connect to content via standard entity references, making the coupling minimal. **Independence: very high** — hierarchical tagging is universal (product categories, geographic regions, skill trees).

**Comment (Threaded Discussion Attachment)** uses a **materialized path** pattern for threading — the `thread` field encodes hierarchy as vancode strings (e.g., "01/", "01.01/") enabling efficient sorted queries. Comments attach polymorphically to any entity via `entity_type + entity_id + field_name`. State: comments, thread paths, host references. Actions: `addComment`, `reply`, `publish`, `unpublish`, `delete`. **Independence: high** — threaded discussion is universal, and the polymorphic attachment makes it entity-agnostic.

### Media and file concepts

**FileManagement (Reference-Counted Resource)** implements **reference counting** for file lifecycle. Files start temporary (status=0), become permanent when referenced, and are garbage-collected when unreferenced. The `file_usage` table tracks which modules/entities reference each file. Stream wrappers (`public://`, `private://`) implement a **Strategy pattern** for storage access policy. State: file entities, usage records. Actions: `upload`, `addUsage`, `removeUsage`, `garbageCollect`. **Independence: high** — reference-counted resource management is universal.

**Media (Source-Abstracted Asset)** wraps heterogeneous asset types (local files, images, remote video via oEmbed) behind a uniform entity interface using **MediaSource plugins** — a **Façade pattern**. Each media type maps to a source plugin that handles thumbnails, metadata extraction, and asset-specific behavior. State: media entities, source field data. Actions: `createMedia`, `extractMetadata`, `generateThumbnail`. **Independence: moderate** — depends on FileManagement concept for local assets.

### Composition and layout concepts

**Block (Pluggable Component with Conditional Placement)** combines two patterns: blocks as **plugins** (discoverable, configurable content units) and visibility as **Condition plugins** (composable predicates evaluating context like current path, content type, user role). Block placement config entities bridge plugins to theme regions. State: block definitions, placement configs, visibility conditions. Actions: `renderBlock`, `placeBlock`, `evaluateVisibility`. **Independence: moderate** — the plugin+condition pattern is highly reusable, but placement depends on a layout/region system.

**Paragraphs (Composite Content Components)** implements the **Composite pattern** for structured content. Paragraph types define schemas; paragraph instances compose into trees via nested entity reference revisions. The host entity **owns** its paragraphs (composition, not aggregation) — each revision of the host creates new paragraph revisions. State: paragraph types, paragraph instances, composition tree. Actions: `addParagraph`, `reorder`, `nest`, `removeParagraph`. **Independence: high** — component-based content composition is the same pattern as React components, WordPress Gutenberg blocks, or Contentful structured content.

### Query and display concepts

**Views (Configuration-Driven Query Builder)** is Drupal's most plugin-intensive subsystem, with **9 plugin types**: Display (where: page, block, feed), Style (how: table, grid, list), Row (per-item: fields, rendered entity), Field handlers, Filter handlers, Sort handlers, Argument/Contextual filter handlers, Relationship handlers (JOINs), and Area handlers (header/footer). A View config entity stores the full query definition; at runtime, each handler adds conditions/columns/joins to a query object. State: view configurations, cached query results. Actions: `defineView`, `addFilter`, `addSort`, `addRelationship`, `execute`, `render`. **Independence: low as implemented** (deeply coupled to Entity/Field/Routing) — but the **abstract pattern** of a configuration-driven query builder with pluggable handlers is highly reusable.

**DisplayMode (Named Presentation Profile)** provides multiple presentation configurations for the same data. View modes control rendering (field formatters per mode); form modes control editing (field widgets per mode). State: display mode definitions, per-bundle formatter/widget configs. Actions: `defineMode`, `configureFieldDisplay`, `renderInMode`. **Independence: high** — the pattern of named presentation profiles is universal (GraphQL field selections, API response schemas).

### Workflow and automation concepts

**Workflow (Finite State Machine)** is a clean two-layer design: the generic Workflows module provides config-entity state machines (states + transitions), while Content Moderation provides a `WorkflowType` plugin that maps states to entity publication status. States carry `published` and `default_revision` flags. Transitions require permissions. State: workflow definitions, current entity states. Actions: `defineState`, `defineTransition`, `transition`, `getCurrentState`. Operational principle: "after transitioning content to 'published,' it becomes visible to the public." **Independence: very high** — finite state machines are universal.

**Rules/ECA (Event-Condition-Action)** is the closest Drupal pattern to COPF's synchronization model. It implements a **Production Rule System**: events trigger rule evaluation; conditions filter by predicate; actions execute side-effects. ECA (the modern successor) provides ~500 actions, 70 conditions, and 200 events with BPMN visual editing. State: rule definitions, execution history. Actions: `defineRule`, `evaluateConditions`, `executeActions`. **Independence: very high** — ECA/IFTTT/Zapier logic is universal. This pattern IS essentially COPF's synchronization engine made explicit.

### Utility and infrastructure concepts

**Cache (Declarative Metadata Bubbling)** is Drupal's most innovative infrastructure concept. Three metadata dimensions — **cache tags** (invalidation: "what data does this depend on?"), **cache contexts** (variation: "what does this vary by?"), and **cache max-age** (TTL) — **bubble upward** through the render tree. Tags merge via union, contexts merge via union, max-age takes the minimum. This ensures the final response's cacheability accurately reflects all its components. Two page cache layers operate: Internal Page Cache (full HTTP response for anonymous users) and Dynamic Page Cache (render arrays with auto-placeholdering for authenticated users). State: cached items in bins, invalidation tags. Actions: `set`, `get`, `invalidate`, `invalidateByTags`. **Independence: very high** — declarative cache invalidation via tags is a universal pattern (used by Apollo Client, Fastly, Varnish).

**ConfigSync (Configuration as Code)** serializes all structural settings to YAML, enabling Git-based deployment with environment-specific override layers (`settings.php` → module overrides → theme overrides). The import process validates against site UUID to prevent cross-site contamination. State: active config (database), sync directory (YAML files). Actions: `export`, `import`, `override`, `diff`. **Independence: high** — configuration-as-code with layered overrides is universal.

**Queue (Producer-Consumer with Plugin Workers)** provides deferred task processing. Queue items are enqueued with arbitrary data; QueueWorker plugins process items during cron within time budgets. Backends are swappable (database, Redis, RabbitMQ). State: queue items. Actions: `enqueue`, `claim`, `process`, `release`, `delete`. **Independence: very high** — message queues are universal.

**Token (String Template Interpolation)** provides typed placeholder substitution with chaining (`[node:author:mail]` traverses entity relationships). Token providers register available placeholders; consumers call `replace($text, $context)`. State: none persistent (providers registered at runtime). Actions: `replace`, `getAvailableTokens`, `scan`. **Independence: very high** — template variable interpolation is universal (Mustache, Liquid, mail merge).

**Pathauto (Template-Based Slug Generator)** applies Token patterns to URL generation. Pattern config entities define per-bundle URL templates; on entity save, tokens resolve against entity data, then normalize (transliterate, slugify, deduplicate). State: pattern definitions. Actions: `generateAlias`, `bulkGenerate`, `cleanString`. **Independence: high** — URL slug generation from templates is universal (Django slugify, Rails friendly_id).

**Flag (User-Entity Toggle Relation)** generalizes all "user marks entity" interactions (bookmarks, likes, follows, spam reports) into a single reusable system. Flag config entities define relation types; Flagging content entities record instances with metadata. State: flag definitions, flagging records, counts. Actions: `flag`, `unflag`, `isFlagged`, `getCount`. **Independence: very high** — named boolean user-entity relations are universal (Twitter likes, Reddit votes).

**Group (Scoped Namespace with Tenant RBAC)** creates isolated content spaces with their own membership, roles, and permissions — separate from global roles. Group Relationships (join entities) link groups to content, with metadata on the relationship itself. State: groups, memberships, group roles, group relationships. Actions: `createGroup`, `addMember`, `assignGroupRole`, `addContent`, `checkGroupAccess`. **Independence: high** — organization-scoped RBAC is universal (GitHub orgs, Slack workspaces, multi-tenant SaaS).

---

## How the plugin system enables concept-like extensibility

Drupal's plugin architecture is the primary mechanism that makes subsystems extensible, and it closely mirrors COPF's emphasis on polymorphic, purpose-driven units. The system has four components: **Plugin Types** (contracts/interfaces), **Discovery** (finding plugins via PHP attributes, YAML, or hooks), **Managers** (Abstract Factories registered as services), and **Instances** (the functional units).

Three discovery innovations deserve attention. First, **attribute-based discovery** (Drupal 10.2+) uses PHP 8 attributes on classes placed in convention-based namespace directories — plugins are found automatically without registration files, implementing the **Service Locator pattern** transparently. Second, **Plugin Derivatives** allow a single plugin class to dynamically represent multiple instances — `SystemMenuBlock` generates one block per menu, `EntityDeriver` creates typed data plugins per entity type — implementing a **Dynamic Factory / Prototype pattern**. Third, **alter hooks** (`hook_{type}_info_alter()`) let any module modify plugin definitions after discovery, enabling cross-cutting behavioral modification.

**Over 30 plugin types** exist in core: Block, FieldType, FieldWidget, FieldFormatter, Action, Condition, DataType, Constraint, ImageEffect, Filter, Layout, Migration (source/process/destination), and the 9 Views plugin types. Each plugin type is effectively a concept extension point — new field types, new block types, new search backends can be added without modifying existing code (the **Open/Closed Principle**).

In COPF terms, the plugin system itself is a meta-concept — **PluginRegistry** — with purpose "enable extensible, discoverable functionality units." State: plugin definitions (cached). Actions: `discover`, `createInstance`, `getDefinitions`, `alterDefinitions`. Its operational principle: "after placing a plugin class in the correct namespace with the correct attribute, the system discovers and makes it available without manual registration."

---

## The synchronization map: how Drupal concepts interact

In COPF, synchronizations are declarative event-based coordination rules. Drupal implements these through three mechanisms: **hooks** (procedural callbacks), **Symfony events** (object-oriented pub/sub), and **entity lifecycle callbacks** (preSave/postSave). Here are the key synchronizations that would be needed to compose these concepts:

**Content lifecycle syncs:**
- `ContentStorage.save(entity) → Cache.invalidateByTags([entity_type:id])` — saving content invalidates related caches
- `ContentStorage.save(entity) → Search.queueForIndexing(entity)` — saved content enters the search indexing queue
- `ContentStorage.save(entity) → Pathauto.generateAlias(entity)` — saved content gets automatic URL aliases
- `ContentStorage.delete(entity) → Comment.deleteByHost(entity) + FileManagement.removeUsage(entity) + Pathauto.deleteAlias(entity)` — deletion cascades

**Access syncs:**
- `Authentication.login(user) → Session.create(user)` — login creates session
- `ContentStorage.access(entity, operation, user) → Authorization.checkPermission(user, permission) AND AccessControl.evaluate(entity, operation)` — access checking chains through RBAC and entity-specific logic
- `Group.addContent(group, entity) → AccessControl.overrideAccess(entity, group.checkMembership)` — grouped content uses group-scoped access

**Workflow syncs:**
- `Workflow.transition(entity, 'published') → ContentStorage.setPublished(entity, true) + Cache.invalidateByTags([entity_type_list])` — publishing triggers status change and cache invalidation
- `ContentModeration.transition(entity, from, to) → Authorization.checkPermission(user, transition_permission)` — transitions require permission

**Commerce syncs (complex domain):**
- `Cart.addItem(user, product) → Order.createDraft(user) + OrderItem.create(product, quantity)` — adding to cart creates/updates draft order
- `Checkout.complete(order) → Payment.authorize(order, gateway) + Workflow.transition(order, 'fulfillment') + Queue.enqueue('order_confirmation', order)` — checkout triggers payment, state transition, and async notification
- `Promotion.evaluate(order) → PriceResolver.applyAdjustment(orderItem, discount)` — promotions modify pricing via adjustments

**ECA (Rules) as explicit sync engine:**
The Rules/ECA module IS a synchronization engine — it lets administrators define `when Event → if Conditions → then Actions` rules stored as configuration. This maps directly to COPF's sync model: `sync Event.occurs(context) when Condition.evaluate(context) → Action.execute(context)`. The key insight is that **Drupal already has COPF-like synchronization infrastructure in its ECA module**, but it's an optional add-on rather than the fundamental coordination mechanism.

---

## What maps cleanly versus what requires decomposition

**Near-perfect COPF concepts** (independent, clear purpose, minimal coupling): Taxonomy, Cache, Workflow, Flag, Token, Queue, Authentication, Authorization, Pathauto. These have singular purposes, well-defined state boundaries, and operate polymorphically on generic targets.

**Good candidates requiring minor decoupling**: Comment (polymorphic attachment is clean, but threading logic is tightly coupled to SQL), Media (depends on FileManagement for local assets), Group (the join-entity architecture is elegant but access override mechanism couples to Drupal's node grants), Search API (backend abstraction is excellent, but deep entity tracking creates coupling).

**Requires decomposition before COPF modeling**: The Entity/Field/Form/Render pipeline. Drupal's Entity API is a "God concept" — it serves as content storage, configuration storage, routing target, form source, render source, and access target simultaneously. A COPF redesign would split this into: **ContentStorage** (CRUD persistence), **FieldDefinition** (data schema composition), **FormBuilder** (input rendering), **ViewRenderer** (output rendering), **DisplayMode** (presentation profiles), and **TypeSystem** (self-describing metadata). These would be coordinated through explicit syncs rather than the current deep integration.

Similarly, **Views** would decompose into: **QueryBuilder** (filter/sort/join construction), **QueryExecutor** (backend-specific execution), **ResultRenderer** (style/row/field display), and **ExposedInterface** (user-facing filter/sort controls).

---

## The render pipeline and caching as cross-cutting orchestration

Drupal's render pipeline converts structured data arrays into HTTP responses through a multi-stage process that functions as a **Composite Renderer with Deferred Evaluation**. Render arrays — hierarchical associative arrays with `#type`, `#theme`, `#cache`, `#access`, and `#lazy_builder` properties — form a declarative tree processed depth-first. The `Renderer::render()` method recursively checks access, resolves cache, calls pre-render callbacks, processes element types, renders children, bubbles cacheability metadata upward, and stores results in render cache.

The **auto-placeholdering** innovation automatically detects uncacheable subtrees (max-age=0 or high-cardinality contexts like `session` or `user`) and replaces them with placeholders. **BigPipe** then streams the cached page skeleton immediately, replacing placeholders via injected `<script>` tags as dynamic content renders server-side. This achieves the equivalent of edge-side includes without a CDN.

In COPF terms, the render pipeline would be modeled as a **Renderer** concept synchronized with **Cache**: `sync Renderer.renderSubtree(element) → Cache.lookup(element.#cache.keys, element.#cache.contexts)` and `sync Renderer.completeRender(element) → Cache.store(result, tags, contexts, maxAge)`. The bubbling model is a sync pattern: `sync ChildRenderer.complete(child) → ParentRenderer.mergeCacheability(child.tags, child.contexts, min(child.maxAge, parent.maxAge))`.

---

## Conclusion: Drupal as a concept composition laboratory

Drupal's 20-year evolution has produced a rich ecosystem of patterns that, when viewed through the COPF lens, reveals both the power and limits of concept-oriented design in practice. **The most important architectural insight is that Drupal's plugin system already provides concept-like polymorphism** — any plugin type is effectively a concept extension point where new implementations can be added without modifying existing code. The ECA module provides explicit COPF-like synchronization. And the entity system's dual-domain model (content vs. config) cleanly separates runtime data from structural metadata.

The patterns most transferable to any language or framework are: **three-valued access control algebra** (allowed/neutral/forbidden with cacheable results), **declarative cache invalidation via tag bubbling**, **the Type-Widget-Formatter triad** for field-level MVC, **reference-counted resource lifecycle** for managed files, **materialized path threading** for hierarchical discussions, **chain resolvers** for price/store/checkout resolution in Commerce, and **the processor pipeline** from Search API (index-time and query-time transformations behind a pluggable backend). These patterns encode deep domain knowledge in language-agnostic architectural structures — exactly what COPF concepts are meant to capture.

The frontier challenge for any COPF implementation of these patterns is handling the **Entity API meta-framework problem**: Drupal's most powerful feature (everything-is-an-entity) is also its deepest coupling point. A true concept-oriented redesign would accept that "Entity" is not one concept but six, connected through carefully designed synchronizations rather than deep class inheritance.