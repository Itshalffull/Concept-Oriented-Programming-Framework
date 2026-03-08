# Clef Base — A concept-oriented application platform

**Version 0.33.0 — 2026-03-07**
**Clef framework dependency:** Clef v0.18.0, Concept Library v0.4.0, Clef Surface v0.4.0
**Status:** Architecture specification

---

## 1. Vision

Clef Base is a full-stack application platform built entirely from Clef concepts, syncs, widgets, binds, and themes. It is to Clef what Drupal is to PHP: the reference application that proves the framework can build real software — and that the software it builds can build more software.

The core idea is that every piece of data in the system is a **ContentNode** — a single universal entity type with composable Schema mixins. What makes a ContentNode into an article, a taxonomy term, a media asset, or a view is which Schemas are applied to it and which domain concepts provide behavior on top. Every ContentNode is simultaneously a structured record (with typed fields from its Schemas, queryable properties, and relations) and an unstructured document (with a Roam/Notion/Logseq-like content page made of blocks, backlinks, embeds, and hierarchical paragraphs), and a node in a knowledge graph (with related entities surfaced by embedding similarity, graph analysis, and unlinked references). The platform ships with a concept browser that can install new concepts, derived concepts, syncs, suites, themes, kits, and widgets at runtime — extending any running application the same way Drupal modules extend a Drupal site.

From a single concept-oriented app definition, Clef Base produces deployable software for the web (Next.js with per-page rendering strategy), phones (Android native, offline-first with sync), desktop (Linux, Windows, macOS via native frontends), web3 (data on an Ethereum L2, UI on IPFS), and companion devices (Android Wear, Apple Watch, open-source watches). The app is authored once in terms of concepts and widgets; Surface adapters and Bind targets handle the rest.

---

## 2. Architectural spine: entities all the way down

### 2.1 The entity model: one ContentNode, many Schemas

Drupal's deepest architectural insight is that everything — content, configuration, users, taxonomy terms, media, comments, automation rules, views, field definitions — is an entity. Clef Base adopts the insight but not the architecture.

**In Drupal,** the entity system has two levels: **entity types** and **bundles**. Entity types (Node, User, Comment, File, Media, TaxonomyTerm) are PHP classes extending `EntityInterface`. Each is a separate storage table, a separate code path, a separate plugin type. Bundles (Article, Page, Event) are subtypes within an entity type — they add fields but share the entity type's storage and behavior. A Node is always a Node. An Article is a Node with the Article bundle. You cannot make a Node also be a TaxonomyTerm — they are different entity types with different class hierarchies, different storage, different APIs.

**In Clef Base,** there is one entity: **ContentNode**. There are no entity types and no bundles. Instead, there are **Schemas** — composable, addable, removable data shapes that can be applied to any ContentNode at any time, in any combination. A Schema is not a subtype within a hierarchy. It is a **mixin**. Applying Schema "Article" to a ContentNode gives it article fields. Applying Schema "TaxonomyTerm" to the same ContentNode gives it taxonomy fields too. The ContentNode is now both an article and a taxonomy term. Removing Schema "Article" later hides the article fields — the ContentNode is now just a taxonomy term. Adding Schema "Media" makes it a taxonomy term that's also a media asset.

This is fundamentally different from Drupal in three ways:

**One storage pool, not many.** Drupal's entity types each have their own database tables. Nodes live in `node` and `node__field_*`. Users live in `users` and `users__field_*`. Taxonomy terms live in `taxonomy_term_data`. You can't query across entity types without custom code. In Clef Base, every ContentNode lives in the same shared pool (§13.1). A query for "everything tagged with #important" returns articles, taxonomy terms, views, media assets, daily notes — anything with that tag, regardless of which Schemas are applied. The shared pool is what makes universal search, the related zone (§3.1), and cross-Schema composition possible.

**Composable identity, not fixed type.** In Drupal, a node is created as type Article and stays type Article forever. You can change its bundle (convert Article to Page), but it's a migration — data moves between field tables, references break, revisions are lost. In Clef Base, Schemas are added and removed freely. A ContentNode can gain Schema "View" today and lose it tomorrow. Its identity is the set of Schemas currently applied, and that set changes over time through progressive formalization (§4.2). There is no "what type is this entity" question — there is only "which Schemas does this ContentNode currently have?"

**Behavior follows Schema, not type.** In Drupal, behavior is tied to entity type — Node has node access, node rendering, node forms. Comment has comment threading. Media has media processing. These are different code paths. In Clef Base, behavior follows Schema membership. When a ContentNode gains Schema "Media", media-related syncs activate and MediaAsset's actions become callable on it (§3.1.2). When it gains Schema "TaxonomyTerm", taxonomy syncs activate and Taxonomy's actions become callable. Both sets of behaviors operate independently on the same ContentNode. The concept's actions check Schema membership in their `where` clauses — they don't check entity type, because there is only one.

In Clef Base, "entity" is not a concept or a framework class. Every entity is a **ContentNode** — a single universal concept from the Foundation suite. What makes a ContentNode into an "article" or a "taxonomy term" or a "media asset" is which **Schemas** are applied to it. Domain concepts (Taxonomy, View, MediaAsset, Comment) provide behavior on top; a `schema.yaml` mapping tells the shared storage provider which concept state fields become ContentNode Properties and which stay in concept-local operational storage (§13.1). A small syncs-only suite wires cross-cutting lifecycle behaviors — cache invalidation, search indexing, backlink reindexing, daily note references — to ContentStorage completions. The concept doesn't know any of this. It just calls ContentStorage.

#### 2.1.1 CRUD convention and schema.yaml

A concept whose instances should behave as entities in Clef Base follows one Clef-level convention and ships one Clef Base deployment artifact.

**Convention — CRUD action names.** The concept has actions named `create`, `get`, `save` (or `update`), `delete`, and `query` (or `list`). These are not required to have exactly these names — the convention is that the concept has recognizable CRUD-shaped actions. Bind scans concept specs for these action shapes and generates uniform API surfaces from them.

Everything else — sovereign storage via ContentStorage, state declarations in the concept spec — is standard Clef framework behavior, not a Clef Base convention. Every Clef concept already has these.

**The Clef Base deployment artifact — `schema.yaml`.** Each suite that wants ContentNode integration ships a `schema.yaml` alongside its concept specs. This file explicitly maps concept state fields to Schema fields on ContentNodes. The shared ContentNode pool provider (§13.1) reads it to route mapped fields to ContentNode Properties and unmapped fields to concept-local storage. See §3.1.1 for the full mechanism with examples.

A concept with a `schema.yaml` gets the full Clef Base treatment: its instances are ContentNodes in the shared pool, tagged by Schema, with triple-zone pages (structured fields from the Schema, unstructured block editor, related zone). Its mapped fields are governed by Schema + Property + TypeSystem, which means FormBuilder generates forms, Renderer generates displays, Query filters by field values, and DisplayMode + ComponentMapping control rendering. Its unmapped fields stay in concept-local storage — the concept's actions can read and write them, but they're not visible in the entity's UI unless the concept exposes them through its own actions.

A concept without a `schema.yaml` still works in Clef Base — all its state goes to concept-local storage and it doesn't get ContentNode integration, Schema-governed fields, or the generic UI pipeline. This is appropriate for infrastructure concepts (Cache, Queue, SyncEngine) that have state but aren't user-facing entities.

A pure Schema with no associated concept (Schema "Article", Schema "SEO", Schema "Page") is created by the admin through the Schema management UI. No `schema.yaml`, no concept spec, no domain-specific actions — just a data shape that can be applied to any ContentNode. Mixin schemas like "Commentable" and "HasTags" also have no associated concept but ship with their paired concept's `schema.yaml` and `composition.yaml` (§2.4.3). FormBuilder generates forms, Renderer generates displays, the full UI pipeline works. CRUD comes from ContentNode's own actions, and any behavior beyond CRUD comes from syncs, workflow transitions, or hook syncs generated from the thing schema's `schema.yaml` (§2.1.3).

#### 2.1.2 The entity-lifecycle syncs-only suite

The entity-lifecycle suite contains **zero concepts** and a small fixed set of syncs. These syncs fire on ContentStorage completions — which means they fire for every concept that persists data, across the entire application. The sync count is O(lifecycle concerns), not O(entity types × lifecycle concerns).

```yaml
# Suite declaration
suite:
  name: entity-lifecycle
  version: 0.1.0
  description: "Cross-cutting lifecycle behaviors for all persistent entities"

concepts: {}   # none — this is a syncs-only suite

syncs:
  recommended:
    - save-invalidates-cache.sync
    - save-indexes-search.sync
    - save-generates-alias.sync
    - save-tracks-provenance.sync
    - save-reindexes-backlinks.sync
    - delete-cascades.sync
    - date-fields-reference-daily-notes.sync
```

The syncs:

Since all domain concepts in Clef Base use the shared ContentNode pool provider (§13.1), all saves flow through a single ContentStorage pool. The lifecycle syncs fire on that pool's `save` and `delete` completions. They differentiate ContentNodes by querying **which Schemas are applied** via `Schema/getSchemasFor`. Schema membership is the ContentNode's identity. A ContentNode with Schemas ["Article", "Commentable", "SEO"] gets cache tags for all three, is search-indexed with all three Schema names, and gets alias-generated using the "Article" Pathauto pattern.

The lifecycle syncs are **generic** — they don't know about any specific Schema, and they are O(7). Schema-specific domain behavior (thumbnail generation for media, cache invalidation for views) is handled separately by **hook syncs generated from `schema.yaml` at install time** — see §2.1.3.

```yaml
# 1. Cache invalidation on save — tags by Schema membership
sync SaveInvalidatesCache [eventual]
when {
  ContentStorage/save: [ id: ?id ] => [ ok: _ ]
}
where {
  Schema/getSchemasFor: [ entity_id: ?id ] => [ ok: ?schemas ]
}
then {
  Cache/invalidateByTags: [ tags: ?schemas ]
}

# 2. Search indexing on save (via queue for async processing)
sync SaveIndexesSearch [eventual]
when {
  ContentStorage/save: [ id: ?id ] => [ ok: _ ]
}
where {
  Schema/getSchemasFor: [ entity_id: ?id ] => [ ok: ?schemas ]
}
then {
  Queue/enqueue: [ queue: "search_indexing";
                   item: { schemas: ?schemas, id: ?id } ]
}

# 3. URL alias generation on save
# Fires for each Schema that has a Pathauto pattern configured.
# A ContentNode with Schema "Article" and Schema "TaxonomyTerm"
# could generate two aliases from two different patterns.
sync SaveGeneratesAlias [eventual]
when {
  ContentStorage/save: [ id: ?id ] => [ ok: _ ]
}
where {
  Schema/getSchemasFor: [ entity_id: ?id ] => [ ok: ?schemas ]
  Pathauto: { ?pattern schema_name: ?schema }
  filter(?schema in ?schemas)
}
then {
  Pathauto/generateAlias: [ schema: ?schema; entity_id: ?id;
                            namespace: null ]
}

# 4. Provenance tracking on save
sync SaveTracksProvenance [eventual]
when {
  ContentStorage/save: [ id: ?id ] => [ ok: _ ]
}
where {
  Schema/getSchemasFor: [ entity_id: ?id ] => [ ok: ?schemas ]
}
then {
  Provenance/record: [ entity_id: ?id; schemas: ?schemas;
                       activity: "save" ]
}

# 5. Backlink reindexing on save (for content with [[links]])
sync SaveReindexesBacklinks [eventual]
when {
  ContentStorage/save: [ id: ?id ] => [ ok: _ ]
}
then {
  Backlink/reindex: [ source_id: ?id ]
}

# 6. Cascade cleanup on delete
sync DeleteCascades [eager]
when {
  ContentStorage/delete: [ id: ?id ] => [ ok: _ ]
}
where {
  Schema/getSchemasFor: [ entity_id: ?id ] => [ ok: ?schemas ]
}
then {
  Comment/deleteByHost: [ host_id: ?id ]
  Reference/removeAllByTarget: [ target_id: ?id ]
  FileManagement/removeUsage: [ entity_id: ?id ]
  Backlink/removeAllRefs: [ source_id: ?id ]
  Pathauto/deleteAlias: [ entity_id: ?id ]
  Cache/invalidateByTags: [ tags: ?schemas ]
  SearchIndex/remove: [ entity_id: ?id ]
}

# 7. Date fields create references to daily notes
# Every DateTime property value becomes a typed reference to that date's
# DailyNote page. The edge label is the field name ("publish_date",
# "deadline", "event_date", "created_at", "updated_at").
# DailyNote/getOrCreateForDate ensures the daily note page exists — if
# no one has written on that date yet, it's created on demand. This
# makes every date in the system a navigable node: the March 6 daily
# note page shows all ContentNodes with any date field pointing to
# March 6. Because ContentStorage automatically sets `created_at` and
# `updated_at` DateTime fields on every save, revision tracking is
# covered: every save updates `updated_at`, which creates a reference
# to today's daily note with edge label "updated_at". No separate
# revision sync needed.
sync DateFieldsReferenceDailyNotes [eventual]
when {
  ContentStorage/save: [ id: ?id ] => [ ok: _ ]
}
where {
  # Find all DateTime-typed Property values on this ContentNode
  Property: { ?prop entity_id: ?id; field_type: "DateTime";
              field_name: ?field_name; value: ?date_value }
}
then {
  DailyNote/getOrCreateForDate: [ date: ?date_value ]
  Reference/addRef: [ source: ?id; target: ?daily_note_id;
                      label: ?field_name ]
}
```

Seven syncs. That's the entire entity lifecycle infrastructure. All seven fire on ContentStorage completions — six on `save`, one on `delete`, plus the daily note sync on `save`. No registration. No opt-in. No action maps. No routing syncs. The syncs are all `recommended` tier — any of them can be disabled if a specific application doesn't want, say, URL alias generation or daily note references.

The alias namespace syncs (stamping the active VersionContext/group/tenant namespace on `Alias/create`, resolving aliases through the namespace fallback chain on `Alias/resolve`) are not lifecycle syncs — they fire on Alias actions, not ContentStorage. They live in the version-space integration syncs alongside VersionAwareLoad and VersionAwareSave (§5.6). Additional namespace stamp syncs for groups, tenants, and locales are integration syncs in their respective suites.

Some of these syncs fire more broadly than strictly necessary (cache invalidation fires even for internal config saves, backlink reindexing fires even for entities with no rich text). This is correct by design — over-invalidating cache is safe, and the target concepts (`Cache`, `Backlink`, `SearchIndex`) are responsible for deciding whether a given entity type is relevant to them. The `where` clause filters where needed (sync 3 only fires when a Pathauto pattern is configured).

#### 2.1.3 Schema hook syncs (generated from schema.yaml)

The seven lifecycle syncs are generic — they don't know about specific Schemas. But domain concepts need Schema-specific behavior: MediaAsset needs to generate thumbnails when a ContentNode with Schema "Media" is saved. View needs to invalidate its cache. Taxonomy needs to update its hierarchy index.

The concepts themselves can't declare these syncs — they're Repertoire library concepts that don't know Schemas exist. The `schema.yaml` declares **lifecycle hooks**: which concept action to call when a ContentNode with this Schema is saved, when the Schema is applied, or when the Schema is removed.

```yaml
# media-suite/schema.yaml
schemas:
  Media:
    concept: MediaAsset
    primary_set: assets
    manifest: content
    hooks:
      on_save: MediaAsset/processIfNeeded
      on_apply: MediaAsset/initializeAsset
      on_remove: MediaAsset/cleanup
    fields:
      file_reference: { from: file_reference }
      mime_type: { from: mime_type }
      alt_text: { from: alt_text }
```

At install time, ConceptBrowser reads these hook declarations and **generates real sync files** — the same pattern Bind uses to generate API endpoints from concept specs. Each hook becomes a standard sync:

```yaml
# auto-generated from media-suite/schema.yaml at install time
sync Media_onSave [eventual]
when {
  ContentStorage/save: [ id: ?id ] => [ ok: _ ]
}
where {
  Schema/getSchemasFor: [ entity_id: ?id ] => [ ok: ?schemas ]
  filter("Media" in ?schemas)
}
then {
  MediaAsset/processIfNeeded: [ entity_id: ?id ]
}

sync Media_onApply [eager]
when {
  Schema/applyTo: [ entity_id: ?id; schema: "Media" ] => [ ok: _ ]
}
then {
  MediaAsset/initializeAsset: [ entity_id: ?id ]
}

sync Media_onRemove [eventual]
when {
  Schema/removeFrom: [ entity_id: ?id; schema: "Media" ] => [ ok: _ ]
}
then {
  MediaAsset/cleanup: [ entity_id: ?id ]
}
```

These are real syncs — they show up in Score's sync chain viewer, they can be individually deactivated through the admin UI, they follow all standard sync patterns, and they're traceable in FlowTrace. The `schema.yaml` hook declarations are the source of truth; the generated syncs are build artifacts, same as Bind-generated API endpoints.

**The total sync count is linear, not exponential:** O(7 lifecycle syncs) + O(hook declarations across all installed schema.yamls). Each concept declares maybe 1-3 hooks. A system with 20 concept-mapped Schemas might have 40 generated hook syncs — well within the sync engine's capacity. The sync engine evaluates pattern matches on every action completion regardless; adding 40 syncs with fast-failing `filter` checks is negligible.

**Available hooks:**

| Hook | Fires when | Typical use |
|------|-----------|-------------|
| `on_save` | ContentStorage/save for a ContentNode with this Schema | Process media, invalidate view cache, reindex taxonomy |
| `on_apply` | Schema/applyTo adds this Schema to a ContentNode | Initialize concept operational state, set defaults |
| `on_remove` | Schema/removeFrom removes this Schema from a ContentNode | Clean up concept operational state, garbage-collect |
| `on_delete` | ContentStorage/delete for a ContentNode with this Schema | Remove external resources, revoke permissions |

A ContentNode with Schema "Media" + Schema "View" that is saved triggers both `Media_onSave` and `View_onSave` independently — each generated sync evaluates its filter, each matching sync fires. Multiple Schemas means multiple hook syncs fire. The syncs don't know about each other.

#### 2.1.4 How Schema replaces bundles

In Drupal, bundles (NodeType, MediaType, etc.) are separate config entities that define subtypes with different field configurations. Clef Base has no separate Bundle concept. **Schema IS the subtype** — apply Schema "Article" to a ContentNode and it gains Article's fields. Multiple Schemas compose on one entity via the emergence pattern. See §2.4 for the full treatment.

#### 2.1.5 The typed data tree

The typed data tree (Entity → FieldItemList → FieldItem → Property → raw value) is not a concept — it is the **wire format** that Schema, Property, and TypeSystem produce when they compose. Schema defines the field structure. Property stores the values. TypeSystem validates and resolves types. The tree emerges from their interaction.

The Renderer and FormBuilder consume this tree through the Type-Widget-Formatter triad. For each field, the DisplayMode config specifies a formatter (how to render for display) and the FormBuilder config specifies a widget (how to render for editing). Surface's Interactor/Affordance/WidgetResolver pipeline maps the abstract formatter/widget type to a concrete platform-specific component. The chain — TypeSystem defines → Property stores → Schema structures → Renderer/FormBuilder consumes → Surface renders — produces working interfaces for any Schema without Schema-specific UI code.

This is the same chain Drupal uses, but without `EntityInterface` in the middle. The generic rendering and form generation work because Schema and Property provide a uniform data access layer — any code that can read Schema field definitions and Property values can render any entity, regardless of which concept owns it.

#### 2.1.6 Bind generates the uniform interface

The "uniform CRUD interface across all entity types" that EntityReflection was trying to provide is already Bind's job. Bind scans concept specs, identifies CRUD-shaped actions (by name, parameter shape, and return variants), and generates REST endpoints, GraphQL mutations/queries, CLI subcommands, MCP tools, and SDK methods.

A concept with `create(fields) → ok(entity)`, `get(id) → ok(entity)`, `save(id, fields) → ok(entity)`, `delete(id) → ok()`, and `query(filters) → ok(results)` gets a complete CRUD API surface from Bind without any additional declaration. Bind's Grouping concept organizes these into logical collections. Bind's Projection concept adds interface metadata (auth, pagination, rate limits). The result is the same uniform interface EntityReflection was trying to generate — but it's a build-time generation step, not a runtime dispatch layer.

#### 2.1.7 What new concepts install automatically get

When a new concept is installed through the ConceptBrowser (§10.2), the following happens — all from existing infrastructure, no EntityReflection involved:

1. **Persistence.** The concept gets a sovereign ContentStorage instance. Cross-cutting lifecycle syncs fire on its ContentStorage completions automatically (§2.1.2).
2. **Typed fields.** If the concept's schema is defined via Schema + Property, FormBuilder and Renderer can generate forms and displays. If the concept stores state in opaque fields without Schema governance, it gets CRUD but not generic UI.
3. **API endpoints.** Bind regenerates interface targets to include the new concept's actions. CRUD actions get REST/GraphQL/CLI/MCP surfaces automatically.
4. **Search.** The SaveIndexesSearch sync enqueues the concept's entities for search indexing. SearchIndex decides whether to index them based on its configuration.
5. **Cache.** The SaveInvalidatesCache sync fires on every save. Cache does the right thing.
6. **Provenance.** Every save and delete is tracked.

No concept registers with anything. No concept opts into anything. The lifecycle behaviors are structural properties of the sync wiring, not of individual concepts.

### 2.2 The dual-domain model: content and config

Following Drupal's bifurcation, Clef Base distinguishes content from config. But unlike Drupal (where the distinction is baked into class hierarchy — `ContentEntityBase` vs `ConfigEntityBase`), Clef has no framework-level classification mechanism. Concepts don't know whether they're "content" or "config." So where does the distinction live?

**The dual-manifest Bind architecture (§6) IS the answer.** Every Clef Base application has two preconfigured Bind manifests: a content manifest and a config manifest. Each manifest lists which **concepts** it includes — not which entities, not which Schemas, not which instances. Each manifest generates its own **physically separate** interface targets — its own REST API at its own base path, its own GraphQL schema at its own endpoint, its own CLI subcommand tree, its own MCP server. The manifests don't share endpoints. They are two independent APIs that happen to talk to the same underlying concepts.

#### 2.2.1 Manifests operate on concepts, not entities

This is the critical clarification. The content manifest says "ContentNode is content-facing." That means **every** ContentNode instance goes through the content API — regardless of whether it has Schema "Article" applied, Schema "Page" applied, or no Schema at all. A user creates a freeform page with no Schema? It's a ContentNode instance. ContentNode is in the content manifest. The page is accessible through the content API. No classification needed.

Creating a new Schema ("Recipe") does not change any manifest. Schema is a concept already in the config manifest (for admin CRUD) and in the content manifest (for read-only browsing). Creating a new Schema instance is just creating an entity of a concept that's already in both manifests. The API endpoints for Schema don't change — there's a new Schema entity accessible through the existing Schema endpoints, nothing more.

Applying Schema "Recipe" to an existing ContentNode doesn't change any manifest either. The ContentNode was already accessible through the content API. Now it has more fields (from the Schema). Those fields are served through the same ContentNode endpoints that already existed.

The only events that change a manifest are:
- **Concept installation** — a new suite is installed through ConceptBrowser, introducing concepts that weren't in any manifest before
- **Concept removal** — a suite is uninstalled, removing concepts from manifests
- **Admin manifest editing** — an admin explicitly changes which concepts or actions a manifest includes (§6.3)

None of these are content-creation events. Users creating pages, applying Schemas, writing in blocks, running queries — none of this touches manifests or triggers regeneration.

#### 2.2.2 How concepts join manifests

Manifest placement is a **Clef Base concern**, not a Clef framework concern. Suites in the Repertoire library don't know about manifests — their `suite.yaml` declares concepts, syncs, and providers, nothing about content vs config. The manifest placement lives in the suite's `schema.yaml` — the same Clef Base deployment artifact that maps concept state to ContentNode Properties (§3.1.1):

```yaml
# In a hypothetical recipe suite's schema.yaml
schemas:
  Recipe:
    concept: Recipe
    primary_set: recipes
    manifest: content                    # Clef Base manifest placement
    fields:
      title: { from: title }
      ingredients: { from: ingredients }
      instructions: { from: instructions }

  RecipeImportConfig:
    concept: RecipeImportConfig
    primary_set: configs
    manifest: config                     # admin-facing
    fields:
      source_url: { from: source_url }
      schedule: { from: schedule }
```

The `manifest` field is a recommendation from the suite's Clef Base integration author, not a hard constraint. During installation, the ConceptBrowser's Step 8 (Bind regeneration) reads these recommendations and adds each Schema's associated concept to the appropriate manifest with a default Projection (all CRUD actions exposed). The admin can override this — moving a concept to a different manifest, restricting its Projection, or placing it in both manifests with different Projections — through the manifest editing UI (§6.3).

If a `schema.yaml` doesn't declare `manifest` placements, or if a suite has no `schema.yaml` at all, the default is: concepts in suites whose names contain "config", "admin", "deploy", "scaffold", or "framework" go in the config manifest; everything else goes in the content manifest. This heuristic handles the common case; the admin can always correct it.

#### 2.2.3 When Bind regeneration happens

Bind generates API endpoints, CLI subcommands, MCP tools, GraphQL schemas, and SDK methods from manifests. Regeneration is a build step — it produces files (via the Emitter concept from the Generation suite) that the runtime serves. Regeneration happens:

- **On concept installation or removal** — ConceptBrowser Step 8 triggers regeneration for manifests that gained or lost concepts
- **On manifest Projection changes** — when an admin changes which actions a manifest exposes for a concept
- **On Middleware changes** — when an admin changes auth requirements for a manifest
- **On deployment** — the standard build pipeline regenerates all targets as part of the deploy flow

Regeneration does **not** happen when users create content, apply Schemas, modify entities, or do anything that's a content-creation event rather than a structural-change event. The API surface is stable between structural changes. This is the same model as Drupal: installing a module regenerates routes and caches; creating a node does not.

For the Next.js web target, regeneration produces new API route files and updated GraphQL schema files, which trigger a hot reload in development and a new build in production. For mobile and desktop targets, regeneration produces updated SDK client code. The Deploy suite's pipeline handles all of this as part of its standard build flow.

#### 2.2.4 Authentication, authorization, and access control

The dual-manifest architecture provides two layers of the auth story. AccessControl provides the third. Understanding which layer does what is essential.

**Layer 1 — Manifest Middleware (API-level).** Each manifest carries its own Middleware configuration (via the Middleware concept from the Interface suite). The config manifest's Middleware chain defaults to requiring admin-role authentication — every endpoint it generates checks for admin credentials before executing. The content manifest's Middleware chain defaults to requiring standard user authentication, with finer-grained permissions per action (authenticated users can create, editors can publish, anonymous users can read published content). These are not the same endpoint with conditional auth — they are different endpoints at different paths with different Middleware chains.

**Layer 2 — Manifest Projection (action-level).** When a concept appears in both manifests, the Projection concept controls which actions are exposed in each. The config manifest's Projection for Schema exposes `create`, `update`, `delete`, `list`, and `get`. The content manifest's Projection for Schema exposes only `list` and `get`. A user hitting the content API physically cannot reach Schema's `create` action — it doesn't exist at that endpoint.

**Layer 3 — AccessControl policies (entity-level).** This is what handles "dev docs are content, but only developers can see them." Both public articles and dev docs are ContentNode instances, both go through the content API, both have the same Middleware. What differs is the **AccessControl policy scoped to their Schema**.

AccessControl policies can be scoped to a Schema — not just to a concept. The policy "entities with Schema 'DevDoc' are viewable only by users with role 'developer'" is a config entity on the AccessControl concept. The content API endpoint for ContentNode exists for everyone. When a user queries or loads a ContentNode, AccessControl evaluates all applicable policies against the requesting user and the specific entity. A regular user loading an Article gets `allowed`. The same user loading a DevDoc gets `forbidden`. The API endpoint is the same; the access decision is per-entity, per-Schema.

This three-layer model handles every case:

- **Public blog posts.** ContentNode in content manifest. No restrictive AccessControl policy on Schema "Article." Everyone can read.
- **Dev documentation.** ContentNode in content manifest. AccessControl policy on Schema "DevDoc": only role 'developer' can view/edit. Regular users never see these entities in queries or direct loads — AccessControl filters them out.
- **Internal company notes.** ContentNode in content manifest. AccessControl policy on Schema "InternalNote": only role 'authenticated' can view. Anonymous users see nothing.
- **Schema definitions.** Schema concept in config manifest (full CRUD, admin auth) and content manifest (read-only, user auth). Any authenticated user can browse available Schemas. Only admins can create or modify them.
- **Workflow definitions.** Workflow concept in config manifest only. Only admins can access the API at all.

The UI reflects access transparently. The content UI shows ContentNode entities the current user has access to — the Query concept's results are filtered through AccessControl before display. A developer sees articles and dev docs. A regular user sees only articles. No separate "admin content area" is needed — the same content UI shows different things to different roles based on AccessControl policies, not based on which manifest the concept is in.

The admin UI shows concepts from the config manifest — Schema management, View configuration, Workflow definitions, etc. — protected by the config manifest's admin-auth Middleware. Dev docs don't appear here because they're content, not config. They appear in the content UI for users who have the developer role.

#### 2.2.5 Downstream behaviors

**Which UI shows it.** The content UI is generated from the content manifest. The admin UI is generated from the config manifest. Within each UI, what the user actually sees is filtered by AccessControl — the content UI queries ContentNode, and AccessControl policies remove entities the current user cannot access before results are displayed. A developer sees articles, dev docs, and internal notes. A regular user sees only articles. The UI is the same; the visible entity set differs per role.

**What ConfigSync exports.** ConfigSync reads the config manifest to determine which concepts produce deployment-exportable entities. All instances of concepts in the config manifest — Schema definitions, View configs, Workflow definitions, DisplayMode configs, AccessControl policies — are serialized to YAML. Instances of concepts only in the content manifest — articles, user profiles, comments — are not exported.

**Caching strategy.** The config manifest's generated API endpoints use aggressive caching (config changes rarely). The content manifest's generated API endpoints use standard cache invalidation via the entity-lifecycle syncs.

The default manifests are preconfigured by Clef Base — the config manifest includes Schema, DisplayMode, View, Workflow, AutomationRule, and other structural concepts; the content manifest includes ContentNode, MediaAsset, Taxonomy terms, and other user-facing concepts. Some concepts appear in both manifests with different Projections (Schema is fully writable through the config API, read-only through the content API). The manifests are themselves config-manifest entities, editable through the admin UI (§6.3).

This design means there is no `domain` field on Schema or any other concept. The content/config distinction is not an intrinsic property of data — it is a deployment-time configuration choice expressed through Bind manifests with separate Middleware chains. A community might decide that Taxonomy terms are config (curated by admins) rather than content (created by users). They move the Taxonomy concept from the content manifest to the config manifest, or restrict the content manifest's Projection to read-only. The terms don't change — same Schema, same fields, same storage. The generated API endpoints change: different base paths, different auth requirements, different action sets.

The ConfigSync concept manages config entity lifecycle across environments. It reads the config manifest to determine its scope, then exports matching entities as YAML files organized by concept. Importing config validates against a site UUID to prevent cross-site contamination (following Drupal's pattern), runs schema migrations if concept versions have changed, and applies environment-specific overrides from the Env concept's layered configuration.

### 2.3 The typed data tree

Every piece of data in Clef Base follows a typed data hierarchy: Entity → FieldItemList → FieldItem → Property → raw value. Schema defines the field structure, Property stores the values, TypeSystem validates and resolves types. The tree emerges from their interaction — it is a wire format, not a concept. See §2.1.5 for how Renderer and FormBuilder consume this tree through the Type-Widget-Formatter triad to produce working interfaces for any Schema-governed entity without entity-type-specific UI code.

### 2.4 Subtypes via Schema (replacing Drupal's bundles)

In Drupal, bundles (NodeType, MediaType, etc.) are separate config entities that attach field definitions to an entity type — Article and Page are both "node" bundles with different fields. Clef Base has no separate Bundle concept or entity. **Schema IS the subtype.** A Schema "Article" defines fields (title, body, author, category, publish_date), and applying that Schema to a ContentNode makes it an Article. A different Schema "Page" defines different fields (title, body). Both are Schemas applied to the same concept (ContentNode), producing differently-shaped entities.

This is simpler than Drupal's model and more powerful, because Schemas compose. An entity can have multiple Schemas applied simultaneously (Tana's emergence pattern). A ContentNode with Schema "Article" and Schema "Commentable" has the merged field set of both. Adding a Schema later doesn't require migrating data or changing entity type — the new fields materialize alongside existing content. Removing a Schema hides those fields without destroying the underlying Property values.

Each field defined by a Schema carries its own rendering metadata through the Type-Widget-Formatter triad. The field has a type (what data it stores, via Property and TypeSystem), a widget (how it renders for editing, resolved by Surface's Interactor → Affordance → WidgetResolver pipeline), and a formatter (how it renders for display, via Renderer and DisplayMode). The triad is expressed as three independent concepts coordinated by syncs — never as a single monolithic field object. DisplayMode configs (which are config entities on the DisplayMode concept) specify per-field formatter and visibility settings. FormBuilder configs specify per-field widget and visibility settings. Both reference the Schema's field definitions — not a separate bundle entity.

#### 2.4.1 Field mutability and system-managed fields

Every Schema field carries a `mutability` property that controls who can set it:

- **`editable`** (default) — Users can set and change this field through FormBuilder-generated forms. Standard content fields: title, body, category.
- **`readonly`** — Visible in the UI (Renderer displays it, DisplayMode can show/hide it), but FormBuilder does not render an edit widget for it. Can be set by concept actions and syncs, not by direct user input. Example: `comment_count` on Schema "Commentable" — updated by the Comment concept's `reply` action, displayed to users, but not directly editable.
- **`system`** — Set only by the storage provider or framework infrastructure. Not editable by any user action or concept action. Not shown in FormBuilder forms. Visible in Renderer output if the DisplayMode includes them (they often do — showing "Last updated: March 6" is useful). Users can see them but nobody can manually set them.

**Every ContentNode has three system-managed fields** that exist regardless of which Schemas are applied. These are not on any user-defined Schema — they are built into the ContentNode concept itself:

- **`created_at`** (DateTime, system) — Set by ContentStorage on first save. Never changes after creation.
- **`updated_at`** (DateTime, system) — Set by ContentStorage on every save. Always reflects the most recent modification.
- **`created_by`** (Reference to user, system) — Set by ContentStorage from the flow context's user on first save. Never changes after creation.

These three fields are DateTime/Reference Properties on the ContentNode like any other field — they participate in the full typed data tree, they're queryable, they're displayable through DisplayMode, and critically, the daily note sync (§2.1.2 sync 7) picks up `created_at` and `updated_at` as DateTime fields and creates References to the corresponding daily notes. This is how revision tracking works without a separate revision sync: every save updates `updated_at`, which creates a reference to today's daily note with edge label "updated_at."

TemporalVersion (§5.11) builds on these fields for its audit trail. Each TemporalVersion record stores the `updated_at` timestamp from the save that created it (system time) plus an optional `valid_time` (when the change is considered effective — defaults to system time, but can be backdated for data corrections). Point-in-time queries use these timestamps: "show me the article as it was on March 1st" finds the TemporalVersion record whose `valid_time` bracket contains March 1st and returns its field snapshot.

Concept-mapped Schemas can also declare readonly and system fields in their `schema.yaml`. For example, View's `schema.yaml` might map `last_executed_at` as `readonly` — View's `execute` action sets it, users can see when a view was last run, but they can't manually edit the timestamp:

```yaml
schemas:
  View:
    concept: View
    primary_set: views
    manifest: content
    fields:
      data_source: { from: data_source }
      filters: { from: filters }
      sorts: { from: sorts }
      layout_type: { from: layout_type }
      last_executed_at: { from: last_executed_at, mutability: readonly }
```

#### 2.4.2 The Schema definition format

A Schema is a ContentNode with Schema "Schema" applied (the bootstrap Schema — see §13.1). It defines fields, constraints, inheritance, metadata, and removal rules. Schemas can be created three ways: from a suite's `schema.yaml` at concept install time (§3.1.1), by an admin through the Schema management UI, or programmatically through the Schema concept's `create` action. All three produce the same Schema definition structure.

**Full format:**

```yaml
schema:
  name: DailyNote
  label: "Daily Note"
  description: "A journal page for a specific date."
  extends: Page                          # single inheritance (optional)
  icon: calendar                         # for the Schema picker UI
  category: Content                      # for grouping in the Schema browser

  # Schema-level constraints
  constraints:
    unique:
      - [date]                           # no two ContentNodes with this Schema
                                         # can have the same `date` value
    max_per_user:                        # at most N instances per user (optional)
    singleton: false                     # if true, only one instance can exist globally

  # Lifecycle hooks — concept actions called on Schema events (§2.1.3)
  # ConceptBrowser generates real sync files from these at install time
  hooks:
    on_save: DailyNote/refreshTemplate    # re-apply template if template field changed
    on_apply: DailyNote/initializeForDate  # set date if not set, apply template
    # on_remove and on_delete not declared — no cleanup needed

  # Schema-level removal rules
  removal:
    policy: prevent                      # prevent | cascade | detach
    # prevent: cannot remove this Schema from a ContentNode that has data in its fields
    #          (user must clear the fields first)
    # cascade: removing the Schema deletes the ContentNode entirely
    # detach:  removing the Schema hides the fields but preserves the ContentNode
    #          and all its other Schemas (this is the default)
    warn: true                           # show a confirmation dialog before removal

  fields:
    date:
      type: Date                         # see type list below
      required: true
      mutability: editable               # editable | readonly | system
      unique_within_schema: true         # shorthand for constraints.unique: [date]
      default: today                     # default value expression (optional)
      description: "The date this note represents."

    title:
      type: String
      required: false
      mutability: readonly               # auto-generated from date, not user-editable
      default: "{{date | format('MMMM D, YYYY')}}"  # Formula expression for computed default
      description: "Display title, auto-generated from the date."

    template:
      type: Reference
      target_schema: Template            # selection plugin: only ContentNodes with Schema "Template"
      required: false
      mutability: editable
      description: "Template to use when creating a new daily note."
```

**Field types** (the `type` property). These are TypeSystem types, each with their own validation, FormBuilder widget, and Renderer formatter:

| Type | Description | FormBuilder widget | Example |
|------|-------------|-------------------|---------|
| `String` | Plain text, single line | text-input | "My Article" |
| `RichText` | Formatted text with inline elements | rich-text-editor | Paragraphs with bold, links, etc. |
| `Int` | Integer number | number-input | 42 |
| `Float` | Decimal number | number-input (with decimal) | 3.14 |
| `Decimal` | Fixed-precision decimal | number-input (with precision) | 19.99 |
| `Boolean` | True/false | checkbox | true |
| `Date` | Calendar date without time | date-picker | 2026-03-06 |
| `DateTime` | Date with time | datetime-picker | 2026-03-06T14:30:00Z |
| `Enum` | Value from a fixed set | select / radio-buttons | "draft" from {draft, review, published} |
| `Reference` | Link to another ContentNode | entity-picker | ContentNode ID |
| `File` | File attachment | file-upload | File reference |
| `Image` | Image attachment (extends File) | image-upload with preview | Image reference |
| `Color` | Color value | color-picker | #FF5733 |
| `URL` | Web address | url-input | https://example.com |
| `Email` | Email address | email-input | user@example.com |
| `Geo` | Geographic coordinates | map-picker | {lat: 44.47, lng: -72.16} |
| `JSON` | Arbitrary structured data | code-editor | {"key": "value"} |
| `Formula` | Computed expression | formula-editor | "count(children)" |

**Field properties** beyond `type`:

```yaml
field_name:
  type: String                    # required — the TypeSystem type
  required: true                  # default: false — must have a value to save
  mutability: editable            # editable | readonly | system (see §2.4.1)
  cardinality: 1                  # 1 (single value, default) | N (fixed max) | unlimited
  default: "Untitled"             # default value or Formula expression
  description: "..."              # admin-facing help text
  placeholder: "Enter title..."   # form widget placeholder text
  unique_within_schema: false     # no two ContentNodes with this Schema can share this value
  hidden: false                   # if true, not shown in default DisplayMode (still queryable)

  # For Reference fields
  target_schema: Article          # selection plugin: only show ContentNodes with this Schema
  target_vocabulary: Topics       # for taxonomy references: only terms from this vocabulary

  # For Enum fields
  options:                        # the allowed values
    draft: "Draft"
    review: "In Review"
    published: "Published"
    archived: "Archived"

  # For String / RichText fields
  max_length: 255                 # character limit
  min_length: 1                   # minimum characters
  pattern: "^[a-z0-9-]+$"        # regex validation

  # For Int / Float / Decimal fields
  min: 0
  max: 100

  # For cardinality > 1 (list fields)
  min_items: 1                    # minimum number of items
  max_items: 10                   # maximum number of items
  sortable: true                  # user can drag-reorder items
```

**Schema-level constraints:**

```yaml
constraints:
  unique:
    - [date]                      # single-field uniqueness
    - [vocabulary, name]          # composite uniqueness: unique name within a vocabulary

  required_schemas:               # this Schema can only be applied to ContentNodes
    - Media                       # that already have Schema "Media" applied
                                  # (dependency — "Image requires Media")

  incompatible_schemas:           # this Schema cannot coexist with these
    - ArchivePage                 # (mutual exclusion)

  max_instances: null             # global max (null = unlimited, 1 = singleton)
  max_per_user: null              # per-user max (null = unlimited)
```

**Lifecycle hooks** (for concept-mapped Schemas only — see §2.1.3):

```yaml
hooks:
  on_save: MediaAsset/processIfNeeded       # called on ContentStorage/save
  on_apply: MediaAsset/initializeAsset      # called on Schema/applyTo
  on_remove: MediaAsset/cleanup             # called on Schema/removeFrom
  on_delete: MediaAsset/deleteExternalFiles  # called on ContentStorage/delete
```

Each hook generates a real sync file at install time. The concept action must accept `entity_id: String` as a parameter. Hooks are optional — a Schema with no hooks has no generated syncs. Admin-created Schemas (no concept) cannot declare hooks since there's no concept action to call.

**Removal rules** control what happens when Schema/removeFrom is called on a ContentNode:

- **`detach`** (default): The Schema is removed, its fields are hidden (Property values preserved in storage but not visible through any Schema). The ContentNode continues to exist with its other Schemas. If the ContentNode has no remaining Schemas, it's a blank ContentNode.
- **`prevent`**: Cannot remove the Schema while any of its fields have values. The user must clear the fields first. Useful for Schemas whose data is expensive to recreate (Schema "Media" — removing it would orphan the file reference).
- **`cascade`**: Removing the Schema deletes the ContentNode entirely. Only appropriate for Schemas that ARE the ContentNode's identity — removing Schema "DailyNote" from a daily note page deletes the page. Use with caution; the `warn: true` flag shows a confirmation dialog.

**Schema inheritance** (`extends`):

```yaml
schema:
  name: Image
  extends: Media                  # inherits all of Media's fields
  fields:
    dimensions: { type: String }  # adds Image-specific fields
    focal_point: { type: Geo }
    alt_text: { type: String, required: true }  # overrides Media's optional alt_text as required
```

A Schema that `extends` another inherits all parent fields. The child can add new fields and override inherited field properties (making optional fields required, changing defaults, narrowing constraints). A child cannot remove inherited fields or widen their types. Field name conflicts between parent and child resolve in favor of the child's definition. The inheritance chain is stored on the Schema ContentNode and is walked at field-resolution time — no flattening.

**Computed fields** use the `Formula` type or a `default` expression:

```yaml
fields:
  full_name:
    type: Formula
    expression: "concat(first_name, ' ', last_name)"
    mutability: readonly                # computed, not user-editable
    description: "Auto-computed from first and last name."

  word_count:
    type: Formula
    expression: "word_count(body)"
    mutability: readonly

  is_overdue:
    type: Formula
    expression: "due_date < today() and status != 'completed'"
    mutability: readonly
```

Formula fields are evaluated by the ExpressionLanguage concept at render time and on save (for queryability). They reference other fields on the same ContentNode by name. They're always `readonly` — the value is computed, not stored.

#### 2.4.3 Thing schemas, mixin schemas, and composition

Schemas fall into two categories based on how they relate to ContentNodes:

**Thing schemas** define what a ContentNode IS. Schema "Comment" (author, timestamp, body), Schema "File" (file_data, mime_type, size), Schema "TaxonomyTerm" (name, vocabulary, parent), Schema "Media" (source_type, thumbnail, alt_text), Schema "View" (data_source, filters, sorts, layout_type), Schema "Canvas" (name, background, default_zoom), Schema "DailyNote" (date, template). These have associated concepts with domain behavior, declare lifecycle hooks in their `schema.yaml`, and define what actions are callable on the ContentNode.

**Mixin schemas** add capability to a host ContentNode. Schema "Commentable" (comments_enabled, require_approval, max_depth), Schema "HasTags" (tags field referencing TaxonomyTerm ContentNodes), Schema "HasFeaturedImage" (featured_image field referencing Media ContentNodes), Schema "HasAttachments" (attachments field referencing File ContentNodes), Schema "SEO" (meta_title, meta_description, canonical_url). These are pure data shapes — no associated concept, no lifecycle hooks. They add fields and configuration to whatever ContentNode they're applied to.

**The pairing pattern.** Thing schemas and mixin schemas are often paired: Comment ↔ Commentable, TaxonomyTerm ↔ HasTags, File ↔ HasAttachments, Media ↔ HasFeaturedImage. The connection is a Reference field on the mixin that targets ContentNodes with the thing schema. Commentable adds configuration to the host; Comment instances Reference the host with edge label "comment_on." HasTags adds a tags Reference field to the host; TaxonomyTerm instances are the targets.

Not every thing schema needs a mixin. Schema "View" has no "HasView" — you embed views via References with display-as (§3.1.3). Schema "Canvas" has no "HasCanvas." The mixin pattern only makes sense when the feature adds **configuration to the host** beyond just a reference — comment settings, tag vocabulary scoping, attachment cardinality limits. If all you need is a reference, add a Reference field directly.

**Intra-suite composition: `includes`.**

When a thing schema and its parent always go together within the same suite, the child schema declares `includes`:

```yaml
# In media-suite/schema.yaml
schemas:
  Media:
    concept: MediaAsset
    primary_set: assets
    manifest: content
    fields:
      file_reference: { from: file_reference }
      mime_type: { from: mime_type }
      alt_text: { from: alt_text }

  Image:
    concept: MediaAsset
    extends: Media               # inherits Media's fields
    includes: [Media]            # applying Image auto-applies Media
    manifest: content
    fields:
      dimensions: { from: dimensions }
      focal_point: { from: focal_point }
```

When Schema "Image" is applied to a ContentNode, Schema "Media" is automatically applied too (if not already present). Removing Schema "Image" also removes Schema "Media" (unless Media was applied independently before Image). They are one unit — the `includes` is enforced, not a default.

**Cross-suite composition: `composition.yaml`.**

When schemas from different suites should go together, a `composition.yaml` ships alongside the mixin suite's `schema.yaml`. This declares **default composition rules** — which schemas should be auto-applied when a target schema is applied:

```yaml
# comment-suite/composition.yaml
compositions:
  - when: Article
    apply: [Commentable]
    default: true                # applied automatically, but removable by admin
  - when: Page
    apply: [Commentable]
    default: true
  - when: Media
    apply: [Commentable]
    default: true
  - when: DailyNote
    apply: [Commentable]
    default: false               # not applied by default, but suggested in the UI
```

At install time, ConceptBrowser reads `composition.yaml` and **generates real sync files** — the same pattern as hook syncs (§2.1.3) and Bind-generated API endpoints. Each composition rule becomes a named sync. The shipped `composition.yaml` provides defaults; the admin manages the generated syncs through the sync browser after installation.

**How composition syncs work at runtime:**

```yaml
# auto-generated from comment-suite/composition.yaml at install time
sync Composition_Article_Commentable [eager]
when {
  Schema/applyTo: [ entity_id: ?id; schema: "Article" ] => [ ok: _ ]
}
then {
  Schema/applyTo: [ entity_id: ?id; schema: "Commentable" ]
}
```

These are standard syncs — they show up in the sync browser, they're traceable in FlowTrace, they appear in Score's sync chain viewer. The sync browser tags them with a `composition` pattern so they can be filtered and shown in a "Schema Compositions" section of the admin UI alongside other sync categories.

**Admin management of composition rules:**

- **View all rules:** The sync browser filters by the `composition` tag — showing all composition syncs, which schemas they trigger, which target schemas they apply, and which suite installed them.
- **Disable a rule:** Deactivate the sync through the sync browser. Standard sync deactivation — the sync stops being evaluated by the sync engine. No regeneration needed.
- **Delete a rule:** Remove the sync file. Standard sync removal.
- **Add a new rule:** Through the automation UI's "Add composition rule" shortcut — a form that generates a sync with the composition pattern ("when Schema X is applied, also apply Schema Y"). This is just the automation UI generating a sync of a specific shape, not a separate concept.
- **Override for specific ContentNodes:** A composition rule is a default. If an admin doesn't want a specific Article to be commentable, they remove Schema "Commentable" from that ContentNode. The composition sync doesn't re-apply on subsequent saves — it only fires on `Schema/applyTo`, not on `ContentStorage/save`. Once removed, it stays removed until someone explicitly re-applies it.

**The constraint system interacts with composition:**

- `required_schemas: [Media]` on Schema "Image" means Image CANNOT be applied without Media already present. This is a hard constraint — an error, not an auto-apply. The user must apply Media first (or Image's `includes` must list Media).
- `incompatible_schemas: [ArchivePage]` means the two schemas cannot coexist. If a composition sync tries to apply an incompatible schema, `Schema/applyTo` rejects it — the constraint is enforced by the Schema concept, not by the sync.
- `includes` is stronger than composition rules — included schemas are removed when the parent is removed. Composition-applied schemas persist independently.

**Composition rules vs includes — when to use which:**

| | `includes` | `composition.yaml` |
|--|-----------|-------------------|
| **Scope** | Within one `schema.yaml` | Across suites |
| **Binding** | Enforced — removal cascades | Default — removable independently |
| **Authority** | Suite author | Suite author (default), admin (runtime) |
| **Use case** | "Image always has Media" | "Articles should be Commentable" |
| **Regeneration** | Never (built into Schema/applyTo) | Only on rule creation/deletion |

**Tooling:**

Like `schema.yaml`, `composition.yaml` gets a parser and scaffold generator:

- **CompositionYamlParser** — provider on SpecParser. Validates that trigger and target schemas exist, checks for circular compositions, and produces sync file specifications for ConceptBrowser Step 4.
- **CompositionYamlScaffold** — provider on Generator. Given a mixin schema, suggests composition rules based on which content-manifest schemas exist. `clef scaffold composition-yaml --schema Commentable` generates a starter file listing all content-type schemas as potential triggers.

### 2.5 Entity references, typed inline links, and selection plugins

Entities reference each other through two linking levels — the Relation concept (typed, labeled, bidirectional, with cardinality constraints) and the Reference/Backlink concepts (lightweight, schema-less forward links with automatic reverse indexing). The `relation-reference-bridge.sync` keeps both systems consistent: Relation links automatically appear in Reference/Backlink queries.

**Typed inline links.** In the unstructured zone, `[[Entity Name]]` creates a schema-less Reference — simple, fast, low-friction. But users can optionally specify an edge type: `[[Entity Name|inspires]]` or `[[Entity Name|blocks]]` or `[[Entity Name|cites]]`. The syntax after the pipe is a Relation label. When the content parser extracts this link, a sync promotes it from a plain Reference to a typed Relation with the specified label — the link gains semantic meaning without the user leaving the prose editor.

Edge labels are freeform by default — users type whatever label makes sense. But if a Taxonomy vocabulary called "Link Types" exists, the block editor's autocomplete suggests existing labels from that vocabulary when the user types the `|` character, encouraging consistency without enforcing it. This is the same progressive formalization pattern: start freeform, converge on shared vocabulary over time.

Typed inline links appear in the related zone's "Links and backlinks" section (§3.1) with their edge label displayed. They participate in graph analysis — the "nearby entities" section can weight connections by edge type (two entities sharing "blocks" edges are more operationally relevant than two sharing "mentions" edges). They are queryable — "find all entities that this entity `inspires`" is a Query filter on Relation label.

The promotion sync:

```yaml
sync TypedInlineLinkPromotion [eager]
when {
  Reference/addRef: [ source: ?source; target: ?target;
                      label: ?label ]
}
where {
  filter(?label != null)
}
then {
  Relation/link: [ source_entity: ?source; target_entity: ?target;
                   label: ?label; direction: "unidirectional" ]
}
```

When no label is specified (`[[Entity Name]]` without a pipe), the Reference stays schema-less and no Relation is created. The `relation-reference-bridge.sync` still ensures that any Relation created by other means (Schema relation fields, admin UI) appears in the Reference/Backlink index. The two systems are complementary: Reference is the universal low-friction layer; Relation is the typed semantic layer; typed inline links bridge them from within prose.

**Selection plugins** control which entities can be referenced from which fields. A "category" field on an Article might only allow references to terms from the "Topics" vocabulary. Selection is implemented as a provider on the Relation concept: when a relation field is configured, a selection provider (default filter, taxonomy-scoped, view-based query, or custom) determines the candidate set. This mirrors Drupal's entity reference selection handlers.

---

## 3. Every entity is also a page

### 3.1 The triple-zone entity

This is the architectural centerpiece. Every entity in Clef Base has three zones — not just a database record or a document, but a living node in a knowledge graph.

The **structured zone** consists of typed fields conforming to the entity's schemas. These are the fields defined by the Schemas applied to the entity, stored as Property values, queryable through the Query concept, displayable through View configurations, and editable through FormBuilder-generated forms. This is the Drupal side of the platform.

The **unstructured zone** is a content page attached to every entity — a Roam/Notion/Logseq-like document made of blocks. This page is the entity's PageAsRecord body: an ordered tree of ContentNode blocks that can contain prose, headings, images, embeds, block references, backlinks, code, and any other content type. The page is the entity's narrative, its documentation, its living context.

The **related zone** surfaces the entity's connections to the rest of the knowledge graph. It is computed, not authored — the system assembles it from the Linking, Query, Graph, and Discovery suite data. The related zone has four sections:

**Similar entities.** Every ContentNode (both its structured field values and its unstructured block content) is embedded via the SemanticEmbedding concept (Discovery suite). ContentNodes whose embedding similarity exceeds a configurable threshold appear here, ranked by similarity score. If the similar ContentNode is a block or sub-entity rather than a top-level page, the display shows the parent page it belongs to, with the matching block highlighted. Embedding providers are pluggable (CodeBERT, OpenAI, Voyage, etc.) and Schemas can configure which provider to use and what similarity threshold to apply. This is the "you might not know these are related, but they are" section — emergent connections the user didn't explicitly create.

**Links and backlinks.** All explicit connections to and from this entity, from both structured and unstructured sources, unified into a single view. Structured links (Relation fields from Schemas — "Author", "Category", "Assigned To") show the edge label as the relationship type. Unstructured links (`[[Entity Name]]` and `((block-id))` references in block content) show the edge label if one was specified via the typed inline link syntax (§2.5), or "references" as a default. Backlinks show which entities link to this one, with the same edge labeling. The display groups by edge type and shows context — the sentence or block where the link appears.

**Unlinked references.** Any time the name (or alias, via the Alias concept) of this entity appears in a field value or block content elsewhere in the system, without an explicit `[[link]]`, it appears here. This is the Backlink concept's `getUnlinkedMentions` action — a full-text scan for the entity's name across all content. The display shows the mentioning entity, the block or field where the name appears, and a one-click action to convert the unlinked mention into an explicit link. This is how you discover connections that exist semantically but haven't been formalized yet.

**Nearby entities.** Entities that are not directly linked to this one but share many of the same connections — structurally adjacent in the graph. A project that shares three team members, two tags, and a deadline month with another project is "nearby" even if no one explicitly linked them. The Graph concept (Data Organization suite) provides the topology; graph analysis algorithm providers compute the proximity. Pluggable algorithms include common-neighbors count, Jaccard similarity over shared edges, Adamic-Adar (weights rare shared connections higher), and community detection (entities in the same detected community are nearby). The admin configures which algorithm(s) to use and what threshold to apply.

The three zones are unified through the PageAsRecord concept from the bridging research. The structured zone renders above the body (Notion-style property panel) or inline within the body (Tana-style fields as child nodes). The unstructured zone renders below or around the structured fields. The related zone renders as a collapsible panel alongside (desktop) or below (mobile) the other two zones. Users can progressively formalize: start with freeform content in the page body, then add structure by applying schemas, then discover connections through the related zone and convert them into explicit links or relations.

All three zones work for Score entities too. A `.concept` spec file viewed through the Score UI has its structured zone (the concept's fields — name, purpose, version), its unstructured zone (documentation, notes, design rationale), and its related zone (similar concepts by embedding, syncs that reference this concept, concepts that share the same suite, unlinked mentions in other specs). You can traverse the entire concept graph through the related zone — not just through explicit sync wiring, but through semantic similarity, shared connections, and naming co-occurrence.

#### 3.1.1 How the zones attach: ContentNode IS the entity

There is no separate "article entity" that "has a page." The Article IS a ContentNode. Applying Schema "Article" to a ContentNode gives it article fields — that's the structured zone. The ContentNode's children (via the Outline concept) are the block tree — that's the unstructured zone. The related zone is computed from the Linking, Graph, and Discovery suite data against this ContentNode's ID.

This is the cleanest model because it requires no attachment mechanism. ContentNode is already in the Foundation suite. Schema-as-mixin already applies to ContentNode instances. The Outline concept already manages ContentNode parent-child hierarchies. Blocks are ContentNodes. Pages are ContentNodes. Articles are ContentNodes with Schema "Article" applied. There is no join table, no special "body" reference field, no separate PageAsRecord instance that bridges an article to its page. It is one entity with three computed aspects:

- **Structured zone:** Schema fields stored via Property on this ContentNode
- **Unstructured zone:** This ContentNode's children via Outline
- **Related zone:** Computed from Backlink, Relation, SemanticEmbedding, and Graph state for this ContentNode's ID

Schema and Outline are independent concepts that each operate on ContentNode through syncs. They don't know about each other. A ContentNode with Schema fields but no children is a pure structured record. A ContentNode with children but no Schema is a freeform page. A ContentNode with both is the triple-zone entity. A ContentNode with neither is a blank node waiting for content. All four states are valid — the zones emerge from the data that exists, not from a mode flag.

**But concepts have sovereign storage.** Every Clef concept owns its own ContentStorage instance. Taxonomy has Taxonomy's storage. View has View's storage. These concepts exist in the Repertoire library and work in any Clef app — not just Clef Base. We can't change them. We can't remove their storage. We can't make them reference ContentNode.

**The Clef Base storage provider resolves this.** In Clef, ContentStorage is a concept with pluggable backend providers. Clef Base configures a **shared ContentNode pool provider** as the storage backend for every domain concept. The concept thinks it has sovereign storage — and from its perspective, it does. `Taxonomy/addTerm` calls `ContentStorage/save` and gets back data. But the provider implementation under the hood:

1. Creates a ContentNode in the shared pool (or finds an existing one by ID)
2. Applies the concept's Schema (e.g., "TaxonomyTerm") if not already present
3. Stores **mapped fields** as Properties on the ContentNode
4. Stores **unmapped fields** in concept-local storage, keyed by ContentNode ID

**The mapping is explicit, not inferred.** Each suite ships a `schema.yaml` alongside its concept specs. This file declares which concept state fields map to which Schema fields — the entity data that lives on the ContentNode. Anything NOT mapped stays in concept-local storage — operational state that the concept needs but users don't see.

```yaml
# taxonomy-suite/schema.yaml
schemas:
  TaxonomyTerm:
    concept: Taxonomy
    primary_set: terms           # which set T becomes "ContentNodes with this Schema"
    manifest: content            # Clef Base manifest placement
    fields:
      name: { from: name }                    # T -> String
      description: { from: description }      # T -> RichText
      vocabulary: { from: vocabulary }        # T -> Reference
      parent: { from: parent }               # T -> option Reference
    # hierarchy_cache and ordering sub-groups are NOT listed
    # → they stay in Taxonomy's concept-local storage

  Vocabulary:
    concept: Taxonomy
    primary_set: vocabularies
    manifest: config
    fields:
      name: { from: vocab_name }
      description: { from: vocab_description }
      hierarchy_type: { from: hierarchy_type }
```

```yaml
# view-suite/schema.yaml
schemas:
  View:
    concept: View
    primary_set: views
    manifest: content
    fields:
      data_source: { from: data_source }
      filters: { from: filters }
      sorts: { from: sorts }
      layout_type: { from: layout_type }
      last_executed_at: { from: last_executed_at }
    # cached_results sub-group is NOT listed → concept-local storage

  # Workflow's states and transitions ARE entity data — the admin configures them
  # The schema.yaml makes this explicit rather than guessing from syntax
```

```yaml
# workflow-suite/schema.yaml
schemas:
  Workflow:
    concept: Workflow
    primary_set: workflows
    manifest: config
    fields:
      name: { from: name }
      description: { from: description }

  WorkflowState:
    concept: Workflow
    primary_set: states           # sub-group with its own set — mapped as a sub-entity Schema
    manifest: config
    parent_field: state_workflow   # links back to the parent Workflow ContentNode
    fields:
      name: { from: state_name }
      is_published: { from: state_is_published }

  WorkflowTransition:
    concept: Workflow
    primary_set: transitions
    manifest: config
    parent_field: transition_from
    fields:
      from_state: { from: transition_from }
      to_state: { from: transition_to }
      permission: { from: transition_permission }
    # execution_history sub-group is NOT listed → concept-local storage
```

The `schema.yaml` is a **Clef Base deployment artifact** — not part of the Clef framework. Concept specs are unchanged. Suites that want to work in Clef Base ship a `schema.yaml`. Suites that don't care about Clef Base omit it — the shared pool provider falls back to treating the entire concept state as concept-local storage (the concept still works, it just doesn't get ContentNode integration, triple-zone pages, or cross-Schema composition).

ConceptBrowser reads the `schema.yaml` at install time (Step 4). For each schema declared, it creates a Schema ContentNode with the listed fields and their types (inferred from the concept spec's state declarations). Default DisplayMode and FormBuilder configs are auto-generated. The storage provider registers the mapping so it knows how to route fields on save/load.

**Schemas can also be created independently.** A `schema.yaml` is one way Schemas get created — at concept install time, mapped to concept state. But admins can also create Schemas through the admin UI at any time, with no associated concept. Schema "SEO" with fields meta_title, meta_description, canonical_url — no concept, no `schema.yaml`, just a data shape. Schema "Analytics" with fields tracking_id, consent_required — again, pure admin-created data shape. These admin-created Schemas work identically to concept-mapped Schemas in the ContentNode pool. Mixin schemas like "Commentable" and "HasTags" are a middle ground — they have no associated concept, but they ship with their paired thing schema's `schema.yaml` and `composition.yaml` rather than being admin-created (§2.4.3).

**schema.yaml tooling.** Like every other YAML artifact in the Clef framework (`.concept`, `.sync`, `.widget`, `.theme`, `suite.yaml`, `interface.yaml`, `deploy.yaml`), `schema.yaml` gets a parser and a scaffold generator — both implemented as provider concepts plugged into existing framework infrastructure:

- **SchemaYamlParser** — a provider on the SpecParser concept (Score suite). Registers with PluginRegistry under the `spec_parser` plugin type for the `.schema.yaml` extension. Parses the YAML, validates field type references against TypeSystem, validates `primary_set` references against the concept spec's state declarations, validates `manifest` values, and produces a structured intermediate representation consumed by ConceptBrowser (Step 4) and the shared pool provider. Parse errors are surfaced through the same validation pipeline as concept spec errors — the ConceptBrowser's `preview` action reports them before installation.

- **SchemaYamlScaffold** — a provider on the Generator concept (Generation suite). Registers under the `scaffold` plugin type. Given a concept spec, it reads the state block and generates a starter `schema.yaml` with all direct fields pre-mapped and all named sub-groups commented out as operational. The suite developer runs `clef scaffold schema-yaml --concept Taxonomy` and gets a `schema.yaml` file to review and edit. Fields that need `mutability: readonly` or different `manifest` placement are flagged with `# TODO` comments for the developer to resolve.

Both providers follow the coordination+provider pattern — they plug into existing concepts (SpecParser, Generator) without those concepts knowing about `schema.yaml`. SpecParser parses whatever file types its registered providers handle. Generator scaffolds whatever artifact types its registered providers handle. No framework changes needed.

**Set membership = Schema membership.** The `primary_set` declaration in `schema.yaml` tells the provider that Taxonomy's `terms: set T` resolves to "all ContentNodes with Schema TaxonomyTerm." The provider doesn't maintain a separate registry of set members — Schema membership in the shared pool IS set membership. This is what makes cross-Schema composition work.

**This is a deployment-level configuration choice.** The same Taxonomy concept in a standalone Clef app (without Clef Base) uses a regular Postgres provider. All of Taxonomy's state goes in its own tables — entity data and operational data together. No ContentNode pool, no Schema tags, no shared storage. The concept spec is identical in both deployments. Only the storage provider config differs.

**What this enables: seamless cross-Schema composition.** A user creates a taxonomy term via `Taxonomy/addTerm`. The provider creates a ContentNode with Schema "TaxonomyTerm." Later, the user applies Schema "View" to that same ContentNode via the Schema picker. Now View's provider can find it — because View's `views: set V` resolves to "all ContentNodes with Schema View," and this ContentNode now qualifies. `View/execute` reads the View fields, runs the query, writes cached results to View's concept-local storage. Taxonomy's `getTree` still finds it via Schema "TaxonomyTerm." Both concepts operate on the same ContentNode, each seeing their own Schema's fields, each maintaining their own operational state, neither knowing the other exists.

The reverse also works. A user creates a View via `View/create`. The provider creates a ContentNode with Schema "View." Later, the user applies Schema "TaxonomyTerm" and sets a vocabulary and parent. `Taxonomy/setParent` lazily initializes Taxonomy's operational state for this ContentNode (hierarchy position, ordering index) on first access. The ContentNode is now both a View and a taxonomy term — a queryable, categorizable item in a vocabulary hierarchy.

Removing a Schema is clean too. Remove Schema "View" from the ContentNode — View fields disappear from Properties, `View/list` no longer finds it, View's operational state for this ID becomes orphaned and gets garbage-collected on the next cleanup cycle. Taxonomy's state is unaffected.

#### 3.1.2 Two tiers: Schema gives data, concepts give behavior

Every entity type in Clef Base is built from two tiers composed on top of ContentNode. The concepts in the Repertoire library are unchanged — they work in any Clef app. The `schema.yaml` that ships with each suite tells the Clef Base storage provider how to map concept state to ContentNode Properties.

**Tier 1 — Schema (data shape).** Schema defines fields. These are the fields declared in the suite's `schema.yaml` — the entity data that lives on ContentNodes as Properties. Schema "Article" has title, body, author, category, publish_date. Schema "Media" has file_reference, mime_type, alt_text, dimensions. Schema "View" has data_source, filters, sorts, layout_type. Schemas compose — apply multiple to one ContentNode, fields merge. Some Schemas are thing schemas with associated concepts and lifecycle hooks (§2.4.3). Others are mixin schemas that ship with a suite but have no associated concept — Schema "Commentable" adds comment configuration fields, Schema "HasTags" adds a tags Reference field. Still others are pure data shapes created by admins — Schema "SEO", Schema "Analytics" — with no suite, no concept, and no hooks. All three kinds work identically in the ContentNode pool.

**Tier 2 — Concept (domain behavior).** Domain concepts provide actions, operational principles, and operational state. The concept's actions are the API surface — users call `Taxonomy/addTerm`, not `ContentNode/create`. The concept's operational state (fields NOT mapped in `schema.yaml` — hierarchy caches, processing queues, execution plans) lives in concept-local storage, separate from the ContentNode pool. The concept test determines whether a concept is warranted.

Here is how the major entity types break down:

| Schema | Concept | What the concept adds | Operational state (concept-local) |
|--------|---------|----------------------|----------------------------------|
| Article | — | Nothing. "Publish" is a Workflow transition sync; "archive" is a status field change. | None |
| Comment | Comment | `reply`, `moderate`, `resolve`, `flag` — threading and moderation actions | Moderation queue |
| Media | MediaAsset | `generateThumbnail`, `transcode`, `extractMetadata` — async processing | Processing queue, thumbnail cache |
| View | View | `execute`, `refresh` — query computation with caching | Cached query results, execution plans |
| Workflow | Workflow | `transition`, `getCurrentState` — state machine logic | Transition permissions, state definitions |
| AutomationRule | AutomationRule | `evaluate`, `execute`, `enable`, `disable` | Execution history, schedule state |
| DailyNote | DailyNote | `getOrCreateForDate` — auto-creation on date access | Date format config, template reference |
| File | FileManagement | `upload`, `addUsage`, `removeUsage`, `garbageCollect` | Usage counts, stream wrapper config |
| TaxonomyTerm | Taxonomy | `addTerm`, `setParent`, `reorder`, `getTree` | Hierarchy cache, vocabulary ordering |
| Vocabulary | Taxonomy | (same concept — vocabularies are Taxonomy's config) | Hierarchy type, constraint rules |
| Role | — | Nothing beyond Schema fields. Identity suite provides auth behavior. | None |
| Page | — | Nothing. Pure data shape. | None |
| Canvas | Canvas | `addItem`, `moveItem`, `drawConnector`, `promoteConnector`, `surfaceExistingReferences` — spatial positioning and connector management | Item positions, connector paths, spatial index |
| *Mixin schemas (§2.4.3):* | | | |
| Commentable | — | No concept. Configuration fields for comment behavior on the host. Paired with Comment (thing schema). | None |
| HasTags | — | No concept. Adds tags Reference field. Paired with TaxonomyTerm (thing schema). | None |
| HasFeaturedImage | — | No concept. Adds featured_image Reference field. Paired with Image (thing schema). | None |
| HasAttachments | — | No concept. Adds attachments Reference list. Paired with File (thing schema). | None |
| SEO | — | No concept. Adds meta_title, meta_description, canonical_url. No pairing. | None |

The pattern: thing schemas have associated concepts with domain behavior and lifecycle hooks (§2.1.3). Mixin schemas are pure data shapes with no concept — they ship with their paired thing schema's `schema.yaml` and `composition.yaml` (§2.4.3). Admin-created schemas (Article, Page, SEO) have no concept and no suite. If the only behavior is CRUD + field changes + workflow transitions, no concept is needed — Schema + entity-lifecycle syncs handle everything. A concept is warranted when there are domain-specific actions with non-trivial logic or ephemeral operational state that shouldn't be user-visible entity data.

**When a Schema is applied to a ContentNode, what happens:**

1. The Schema's fields materialize as Property values on the ContentNode (progressive formalization — §4.2)
2. If the Schema has an associated concept, the concept's storage provider discovers this ContentNode via Schema membership. The concept's `set T` collection now includes this ContentNode. The concept's actions become callable on this ContentNode — the action's where-clause checks for Schema membership and passes.
3. If the concept has operational state for this ContentNode (e.g., View has cached results), it initializes lazily on first access — the same behavior as after a fresh `create`.
4. **Hook syncs generated from `schema.yaml` activate** (§2.1.3). If the Schema's `schema.yaml` declares `on_save`, `on_apply`, or other hooks, the generated syncs fire. When Schema "Media" is applied, the `Media_onApply` sync calls `MediaAsset/initializeAsset`. When a ContentNode with Schema "Media" is saved, the `Media_onSave` sync calls `MediaAsset/processIfNeeded`. Multiple Schemas means multiple hook syncs fire independently — each checks its own Schema membership.
5. DisplayMode configs for that Schema become applicable (see §3.1.3 below).

**When a Schema is removed from a ContentNode:**

1. The Schema's fields are hidden (underlying Property values are preserved but no longer visible through the Schema)
2. The concept's `set T` no longer includes this ContentNode — its actions return `not_found` for this ID
3. The concept's operational state for this ContentNode becomes orphaned and is garbage-collected on the next cleanup cycle
4. The `on_remove` hook sync fires (if declared in the Schema's `schema.yaml`), calling the concept's cleanup action. Generated hook syncs that check for this Schema's membership (`on_save`, `on_delete`) stop matching for this ContentNode — the filter fails because the Schema is no longer applied.

#### 3.1.3 Multi-schema display: "display as"

When a ContentNode has multiple Schemas applied, it doesn't show all of them at once. Every rendering context chooses **which Schema to display as**. The same ContentNode looks completely different depending on which Schema perspective the context selects.

**The rendering context determines the Schema perspective.** A ContentNode with Schema "View" + Schema "TaxonomyTerm" + Schema "Commentable" renders differently in every context:

- In a **taxonomy browser**, the context is "display as TaxonomyTerm." The taxonomy term's DisplayMode applies: name, description, parent term, vocabulary, position in hierarchy.
- In a **view builder**, the context is "display as View." The view's DisplayMode applies: data source, filters, sorts, layout type, preview of results.
- In a **comment thread**, the context is "display as Commentable." The comment configuration and comment list render.
- On the ContentNode's **own page**, the user sees the entity's layout (§3.4) with areas configured by the admin. One area might show Article fields, another might embed the View results, a sidebar might show the taxonomy position. The page layout is the place where multiple Schema perspectives compose — through layout areas, each configured to display a specific Schema's fields or a ComponentMapping.

**How "display as" works mechanically.** Every place that renders a ContentNode specifies a Schema + DisplayMode pair. The View concept's row renderer specifies "display as Article in teaser mode." The taxonomy browser specifies "display as TaxonomyTerm in tree-item mode." The layout editor's areas each specify their Schema perspective. The ComponentMapping system (§3.5) can wire fields from any of the ContentNode's Schemas into any widget — it's not limited to one Schema's fields.

**Embedding and referencing.** When a ContentNode is embedded in another page (via `((block-id))` or a Reference field), the **user who embeds it chooses** how to display it. The embed block carries a `display_schema` property — a picker that shows the embedded ContentNode's applied Schemas. Embedding a ContentNode that has Schema "View" + Schema "TaxonomyTerm" + Schema "Article" shows a "Display as:" dropdown with those three options plus "Custom" (which opens a ComponentMapping configuration). The user picks "Display as: View" and the embed renders the view's live results. They pick "Display as: Article" and it renders the article's teaser. They can change the selection at any time by clicking the embed and updating the display-as property.

The same picker appears for Reference fields in the structured zone. A Reference field to a ContentNode that has multiple Schemas shows a "Display as:" option in the field formatter settings — configurable per-reference, not just per-field.

The `entity_reference_display` SlotSource provider (§3.5.2) takes a `display_schema` parameter for this purpose. When a ComponentMapping uses this source, the `display_schema` can be hardcoded by the admin or left as "user's choice" — in which case the embed block's `display_schema` property is used at render time.

**The entity's own page.** When you navigate directly to a ContentNode's page, the layout (§3.4) determines what you see. The admin configures the page layout with areas, and each area can show different Schema perspectives. A ContentNode that is both a View and a TaxonomyTerm might have a page layout with:

- A structured area showing TaxonomyTerm fields (where it sits in the hierarchy)
- A structured area showing the View's live query results
- An unstructured area for documentation and notes
- The related zone sidebar

This is configured through the layout editor and ComponentMappings — not through automatic multi-Schema stacking. If no custom layout exists, the default page layout uses the ContentNode's **primary Schema** (the first Schema applied, or the one the admin designates as primary) for the structured zone's default display.

**Custom multi-Schema displays.** When the admin wants a display that draws fields from multiple Schemas simultaneously — an "Article + SEO" card that shows the title from Schema "Article" and the meta description from Schema "SEO" in a single widget — they create a ComponentMapping (§3.5) that binds specific fields from specific Schemas to the widget's slots. The ComponentMapping doesn't care which Schema a field comes from; it references fields by Schema-qualified name (`Article.title`, `SEO.meta_description`).

**Field name conflicts.** Two Schemas defining a field with the same name. Schema inheritance handles this for `extends` relationships — the child's field definition overrides the parent's. For unrelated Schemas applied via emergence (no inheritance), field names must be unique across applied Schemas. If Schema "Article" has a `title` field and Schema "SEO" also has a `title` field, the second Schema application fails with a name collision error. The admin must rename one of the fields (Schema's `renameField` action) or use a field alias before applying both Schemas. This is the same constraint Tana has with identically-named supertag fields, and is rare in practice because Schemas namespace their field names by convention (`seo.title` rather than `title`).

### 3.2 Block system: paragraphs meet Roam blocks

Each block in the content page combines the properties of Roam blocks and Drupal paragraphs.

**From Roam/Logseq blocks:** Each block has a unique ID, can be referenced from anywhere via `((block-id))` syntax, can be embedded/transcluded into other pages, inherits backlinks from its ancestors in the outline hierarchy, supports bidirectional links via `[[entity-name]]` syntax, and participates in the full Query system. The Backlink concept maintains the reverse index; the Embed concept handles transclusion; the Outline concept manages the tree hierarchy.

**From Drupal paragraphs:** Each block is an entity that owns its sub-blocks (composition, not aggregation). Block types have schemas — a "callout" block type carries a severity field, a "code" block type carries a language field, a "table" block type carries column definitions. Blocks support hierarchical revisions: revising a parent entity creates new revisions for all its child blocks. Block types are extensible through the same Schema mechanism as any other entity — define a new Schema for a new block type, and it becomes available.

**View modes for blocks.** Each block subtree has a configurable view mode that determines how it and its children render: as a document (flowing prose), as bullets (indented outline), as numbered items, as a table, as a kanban board, or as any custom view mode. View modes are DisplayMode config entities applied at the block level. This mirrors Drupal's display modes while adding the block-level flexibility of Notion's database views.

### 3.3 Queries across all zones

The Query concept operates across all three zones. Structured queries filter by field values, schemas, relations, and taxonomy terms. Unstructured queries filter by backlinks, block references, tags, properties embedded in block content, and full-text search. Related-zone queries filter by embedding similarity, graph proximity, and unlinked mention co-occurrence. Queries can be embedded within any content page as live-updating blocks — the same pattern as Notion's linked databases, Tana's search nodes, and Logseq's embedded queries.

Query results themselves have configurable view modes. A query embedded in a project page might render as a table of tasks; the same query embedded in a dashboard might render as a kanban board. The View concept handles this separation of data from presentation.

### 3.4 The unified layout editor

Content pages support layouts, similar to how Coda pages work. A layout is a spatial arrangement of **areas** — columns, sections, tabs, accordions — into which content can be placed. The Component concept from the Layout suite handles spatial composition.

#### 3.4.1 Every area is either structured or unstructured

Each area in a layout has a **content mode**: structured or unstructured. This is a property of the area, not of the content inside it.

A **structured area** renders through the Schema → Property → Renderer → Surface pipeline. It shows form fields, views, controls, ComponentMappings, and data-bound widgets. The admin configures what appears via DisplayMode and ComponentMapping configs. This is the Drupal side — the managed display page.

An **unstructured area** is a live block editor — the Roam/Notion/Logseq-like editing surface. Users type prose, create block hierarchies, embed queries, insert `[[links]]` and `((block refs))`, and use slash commands to insert widgets, views, or controls inline. This is the tools-for-thought side.

An area can switch modes at any time. Converting a structured area to unstructured preserves the field values as editable blocks. Converting an unstructured area to structured applies progressive formalization — block content is analyzed by ProgressiveSchema's structure detectors to suggest field mappings. The area mode is a config property, changeable through the layout editor's context menu on any area.

#### 3.4.2 Splitting, merging, and rearranging areas

Areas are manipulable through direct interaction in the layout editor:

**Split.** Any area can be split horizontally or vertically. Splitting a two-column layout into three columns, or splitting a full-width area into a main + sidebar, is a drag handle on the area's edge. Each resulting area independently has its own content mode — you can split a full-width unstructured area into a narrow structured sidebar (showing a field panel) and a wide unstructured main area (showing the block editor). This nests recursively: an area within a split can itself be split.

**Merge.** Adjacent areas can be merged back into one. Content from both areas combines — if both were unstructured, their block trees merge in order; if one was structured and one unstructured, the merged area becomes unstructured with the structured fields converted to blocks.

**Move.** Areas can be dragged to rearrange. In the layout editor, each area has a drag handle. Moving an area preserves its content mode and all its content.

**Resize.** Area boundaries are draggable to change proportional widths. A 50/50 split can be dragged to 30/70 or 70/30.

#### 3.4.3 Responsive behavior

Each area carries **responsive configuration** that determines how the layout adapts across viewport sizes. This is stored on the Component concept's layout config and consumed by the Surface Viewport concept.

**Per-area responsive rules.** Each area declares its behavior at each breakpoint (mobile, tablet, desktop, wide). Options per breakpoint: visible (show the area), hidden (collapse it entirely), stacked (full-width, stacking vertically with siblings instead of sitting side-by-side), or reordered (change the area's position relative to siblings). A sidebar that's beside the main content on desktop can stack below it on mobile, or hide entirely on watch.

**Responsive presets.** Common patterns are available as one-click presets: "sidebar collapses on mobile" (sidebar stacks below main on mobile breakpoint), "equal columns stack" (all columns go full-width on mobile), "hero disappears on small" (hero area hidden below tablet), "tab on mobile, side-by-side on desktop" (areas render as tabs on mobile, as adjacent panels on desktop).

**Custom breakpoints.** The default breakpoints (mobile: 0-640px, tablet: 641-1024px, desktop: 1025-1440px, wide: 1441px+) are config on the Surface Viewport concept, editable in the admin UI. Custom breakpoints can be added for specific design needs.

The admin edits responsive rules in a visual preview that shows the layout at each breakpoint simultaneously — a multi-viewport preview panel. Changes to responsive rules are config, not code — they're DisplayMode properties stored as config entities and exported by ConfigSync.

#### 3.4.4 The convergence

The structured and unstructured editors converge because both operate on the same underlying data: ContentNode blocks arranged in an Outline tree, optionally governed by Schema field definitions, rendered through Surface widgets. The layout's areas are the containers; each area's content mode determines which editing experience the user sees. Anything available as a widget in a structured area can be inserted into an unstructured area via slash commands. Anything authored as blocks in an unstructured area can be referenced from a structured area's ComponentMapping via `widget_embed` or `entity_field` SlotSources.

### 3.5 Admin-side component mapping: wiring data to widgets

Surface's WidgetResolver provides the automatic path — given a field's metadata, it classifies an interactor type and resolves to the best widget. This works for the default case: a text field gets a text-input widget, a date field gets a date-picker, a reference field gets an entity-select. But site builders need the manual path too. Drupal's UI Patterns module solves this by letting admins pick a component and visually map entity fields and other data sources into that component's slots and props, all stored as configuration. Clef Base needs the same capability. It requires two new concepts and one syncs-only integration layer.

#### 3.5.1 The ComponentMapping concept

ComponentMapping is a general-purpose, referenceable config entity that stores how a widget receives its data. It is not scoped only to entity display modes — it can be used anywhere a widget renders: as an entity display, as a View row template, as a View wrapper, as a layout section, as a block, as a field formatter, or as a Control display. Other concepts reference it by ID.

```
@version(1)
concept ComponentMapping [M] {

  purpose {
    Store admin-configured bindings between data sources and widget
    slots/props, enabling site builders to control how widgets render
    in any context — entity displays, view rows, layout sections,
    blocks, field formatters, and controls.
  }

  state {
    mappings: set M
    name: M -> String               // admin-facing label ("Article Teaser Card")
    widget_id: M -> String          // which Widget this mapping uses
    variant: M -> option String     // which widget variant

    // Optional entity scope. When set, this mapping applies to entities
    // of the given Schema in the given DisplayMode. When null, the mapping
    // is standalone — it gets its data entirely from SlotSources (views,
    // static values, formulas, etc.) without an entity context.
    scope {
      scope_schema: M -> option String
      scope_display_mode: M -> option String
    }

    slot_bindings {
      bindings: set M
      binding_mapping: M -> M
      binding_slot: M -> String           // slot name on the widget
      binding_sources: M -> list String   // ordered list of SlotSource IDs
    }

    prop_bindings {
      p_bindings: set M
      p_binding_mapping: M -> M
      p_binding_prop: M -> String         // prop name on the widget
      p_binding_source: M -> String       // single SlotSource ID
    }
  }

  actions {
    action create(name: String, widget_id: String,
                  schema: option String, display_mode: option String) {
      -> ok(mapping: M) {
        Creates a new mapping. If schema and display_mode are set, this is
        an entity-scoped mapping. If both are null, this is a standalone
        mapping that can be referenced from Views, layouts, and blocks.
      }
    }

    action bind_slot(mapping: M, slot: String, sources: list String) {
      -> ok(binding: M) {
        Maps one or more data sources to a widget slot.
      }
      -> slot_not_found(slot: String) {
        The widget does not have a slot with this name.
      }
    }

    action bind_prop(mapping: M, prop: String, source: String) {
      -> ok(binding: M) {
        Maps a single data source to a widget prop.
      }
      -> prop_not_found(prop: String) {
        The widget does not have a prop with this name.
      }
      -> type_mismatch(expected: String, got: String) {
        The source's output type does not match the prop's expected type.
      }
    }

    action resolve_for_entity(schema: String, display_mode: String) {
      -> ok(mapping: M) {
        Returns the entity-scoped mapping for a Schema+DisplayMode.
      }
      -> not_configured() {
        No explicit mapping exists. Use automatic WidgetResolver resolution.
      }
    }

    action get(mapping: M) {
      -> ok(mapping: M, name: String, widget_id: String) {
        Returns a mapping by ID. Used when other concepts reference a
        mapping directly rather than resolving by Schema+DisplayMode.
      }
      -> not_found(mapping: M) {
        The mapping does not exist.
      }
    }

    action render(mapping: M, context: String) {
      -> ok(render_tree: String) {
        Resolves all SlotSources in the mapping against the provided context
        (which may include an entity, a view result set, a field value, or
        nothing for standalone mappings), assembles the widget with resolved
        slot/prop values, and returns the render tree.
      }
    }
  }

  invariant {
    after create(name: "Article Teaser Card", widget_id: "card-horizontal",
                 schema: "Article", display_mode: "teaser") -> ok(mapping: m)
    and   bind_slot(mapping: m, slot: "heading",
                    sources: ["src_title"]) -> ok(binding: _)
    then  resolve_for_entity(schema: "Article", display_mode: "teaser")
          -> ok(mapping: m)
  }
}
```

#### 3.5.2 The SlotSource concept

SlotSource is a coordination concept with providers. Each provider knows how to extract data from a specific Drupal-equivalent source and produce renderable output suitable for a widget slot or prop. This is Clef's equivalent of UI Patterns 2's source plugin system.

```
@version(1)
concept SlotSource [S] {

  purpose {
    Provide pluggable data retrieval for widget slots and props,
    enabling admin-configured bindings between diverse data sources
    (entity fields, views, nested widgets, static values, blocks)
    and widget anatomy.
  }

  state {
    sources: set S
    source_type: S -> String        // provider plugin ID
    source_config: S -> String      // provider-specific configuration (serialized)
    source_label: S -> String       // admin-facing label
    processor_chain: S -> list String // ordered list of transform/processor plugin IDs
  }

  actions {
    action create(source_type: String, config: String, label: String) {
      -> ok(source: S) {
        Creates a configured data source instance. The source_type
        determines which provider plugin handles data retrieval.
        Config is provider-specific.
      }
      -> invalid_config(source_type: String, errors: String) {
        The config is invalid for this provider type.
      }
    }

    action resolve(source: S, context: String) {
      -> ok(output: String) {
        Retrieves data from the source given the current rendering context
        (which entity, which display mode, which field values are available).
        Plugin-dispatched to the registered provider. The output passes
        through the processor chain before returning.
      }
      -> unavailable(reason: String) {
        The source data could not be retrieved (field doesn't exist on
        this entity, view returned no results, etc.).
      }
    }
  }
}
```

**Provider plugins (via PluginRegistry):**

| Provider | Description | Config | Output |
|----------|-------------|--------|--------|
| `entity_field` | Renders an entity field using its configured formatter | `{ field: "title", formatter: "plain_text" }` | Rendered field output |
| `entity_field_value` | Returns the raw field value (for props, not slots) | `{ field: "status", property: "value" }` | Raw typed value |
| `static_value` | Returns a literal value configured by the admin | `{ value: "Read more", type: "string" }` | The literal value |
| `widget_embed` | Nests another widget with its own recursive ComponentMapping | `{ widget_id: "badge", mapping: { ... } }` | Rendered widget |
| `view_embed` | Embeds a View query result | `{ view_id: "related_articles", display: "block_1" }` | Rendered view |
| `block_embed` | Embeds a placeable block (from the Component/Layout system) | `{ block_id: "recent_comments" }` | Rendered block |
| `menu` | Renders a navigation menu | `{ menu_id: "main", depth: 2 }` | Rendered menu tree |
| `formula` | Evaluates a Formula expression | `{ expression: "count(related_tasks)" }` | Computed value |
| `entity_reference_display` | Renders a referenced entity in a specified display mode | `{ field: "author", display_mode: "compact" }` | Rendered referenced entity |

**Processors** (applied via the `processor_chain` on each source):

| Processor | Description | Config |
|-----------|-------------|--------|
| `truncate` | Truncate text to N characters | `{ length: 200, ellipsis: true }` |
| `date_format` | Format a date value | `{ format: "M j, Y" }` |
| `image_style` | Apply an image style/transform | `{ style: "thumbnail_200x200" }` |
| `strip_html` | Remove HTML tags | `{ allowed_tags: ["b", "i"] }` |
| `fallback` | Use a default if source is empty | `{ default: "Untitled" }` |
| `token_replace` | Interpolate entity values into a template string | `{ template: "By {author} on {date}" }` |

Processors are Transform concept providers (from the Data Integration suite) — the same plugin type used in data integration pipelines. No new concept needed for processors.

#### 3.5.3 How it integrates with the existing rendering pipeline

The existing rendering pipeline is: Schema → Property → Renderer → DisplayMode → Surface → pixels. ComponentMapping inserts itself as an optional override between Renderer and Surface:

```
Schema defines fields
    ↓
Property stores values
    ↓
Renderer begins rendering for a DisplayMode
    ↓
ComponentMapping/resolve(schema, display_mode)
    ├── ok(mapping) → use explicit mapping:
    │     Widget specified by mapping.widget_id
    │     For each slot: SlotSource/resolve(source, context)
    │     For each prop: SlotSource/resolve(source, context)
    │     Assemble into widget render tree
    │
    └── not_configured → use automatic path:
          WidgetResolver/resolve per field (existing pipeline)
          Each field rendered independently with its formatter
```

The sync that wires this:

```yaml
sync ComponentMappingOverride [eager]
when {
  Renderer/render: [ schema: ?schema; display_mode: ?mode; entity: ?entity ]
}
where {
  ComponentMapping: { ?m schema: ?schema; display_mode: ?mode }
}
then {
  # For each slot binding in the mapping, resolve sources
  ComponentMapping/preview: [ mapping: ?m; entity_id: ?entity ]
}
```

When no ComponentMapping exists for a Schema+DisplayMode combination, the sync's `where` clause fails to match, and the existing automatic Renderer → WidgetResolver pipeline runs unchanged. This is the zero-config default — every entity gets a working display from WidgetResolver without any admin intervention. ComponentMapping is the progressive customization layer.

#### 3.5.4 The admin UI for component mapping

The admin UI for ComponentMapping is itself a Surface composition, not a new concept. It provides:

**Widget picker.** Browse available widgets filtered by the Affordance system — only widgets that can serve as entity-level containers appear (widgets with slots that accept renderable content). Each widget shows a thumbnail, its slot names, its prop types, and a live preview with sample data. This is the Component Library — a View over Widget and Affordance state, rendered at a browsable route in the admin UI.

**Slot mapping form.** For each slot on the selected widget, a form lets the admin add one or more sources. Sources are selected from a dropdown of available SlotSource providers. Each provider shows its own config form (the `entity_field` provider shows a field picker filtered to the current Schema's fields with a formatter selector; the `view_embed` provider shows a View picker; the `widget_embed` provider opens a recursive mapping form for the nested widget). Multiple sources in a slot render in order — an image source followed by a caption source fills a media slot with both.

**Prop mapping form.** For each prop on the selected widget, a form lets the admin bind a single source. Props are type-checked — a boolean prop only shows sources that produce boolean values (entity_field_value for checkbox fields, static_value with boolean, formula that returns boolean). The Affordance system's type metadata drives this filtering.

**Processor configuration.** On each source, an expandable "Transform" section lets the admin add processors. Each processor shows its own config form. Processors can be reordered via drag-and-drop. The processor chain applies in order — truncate, then strip_html, then fallback.

**Live preview.** As the admin configures the mapping, a live preview panel shows the entity rendered through the current mapping config. The preview updates as sources and processors are changed. This uses ComponentMapping's `preview` action.

**Nesting.** The `widget_embed` source provider enables recursive composition. An admin mapping a "card" widget might bind its "footer" slot to a `widget_embed` source that uses a "button-group" widget with its own slot→source mappings. The admin UI presents this as a nested mapping form — click into a slot, choose "Embed widget," pick the widget, and configure its mappings. This nesting can go arbitrarily deep.

#### 3.5.5 Integration with consuming concepts

ComponentMapping is a referenceable config entity. Other concepts don't know its internals — they store a ComponentMapping ID in their own config, and a sync wires the rendering. Here is how each consuming concept integrates.

**Entity display via DisplayMode.** The primary use case. When a DisplayMode config is created for Schema "Article" + mode "teaser", the admin can set its `component_mapping` field to a ComponentMapping ID. When Renderer encounters this DisplayMode, a sync fires:

```yaml
sync DisplayModeUsesMapping [eager]
when {
  Renderer/render: [ schema: ?schema; display_mode: ?mode; entity: ?entity ]
}
where {
  DisplayMode: { ?dm mode_schema: ?schema; mode_id: ?mode;
                 component_mapping: ?mapping_id }
  filter(?mapping_id != null)
}
then {
  ComponentMapping/render: [ mapping: ?mapping_id;
                             context: { entity: ?entity, schema: ?schema } ]
}
```

When the DisplayMode has no `component_mapping` set (the default), the `where` clause fails and the automatic WidgetResolver pipeline runs. This is one field on an existing concept (DisplayMode), one sync, and no changes to Renderer or WidgetResolver.

**View rows.** The View concept already has state for row rendering configuration (layout type, visible fields, formatting). A new optional field `row_mapping` stores a ComponentMapping ID. When set, each entity in the View's result set renders through that mapping instead of through the View's built-in field list.

```yaml
sync ViewRowUsesMapping [eager]
when {
  View/renderRow: [ view: ?view; entity: ?entity ]
}
where {
  View: { ?view row_mapping: ?mapping_id }
  filter(?mapping_id != null)
}
then {
  ComponentMapping/render: [ mapping: ?mapping_id;
                             context: { entity: ?entity } ]
}
```

In the admin UI, the View builder's "Row style" section adds a "Component mapping" option alongside existing row styles (fields, rendered entity). Selecting it shows a picker for available ComponentMappings filtered to the View's base Schema. The admin can also create a new ComponentMapping inline from the View builder and it saves as a standalone config entity reusable elsewhere.

**View wrapper (style).** Beyond individual rows, the entire View result set can render inside a ComponentMapping. A "style_mapping" field on View wraps the full result set — the view results become a SlotSource feeding into one of the wrapper widget's slots.

```yaml
sync ViewStyleUsesMapping [eager]
when {
  View/renderResults: [ view: ?view; results: ?results ]
}
where {
  View: { ?view style_mapping: ?mapping_id }
  filter(?mapping_id != null)
}
then {
  ComponentMapping/render: [ mapping: ?mapping_id;
                             context: { results: ?results, view: ?view } ]
}
```

A View of Articles configured with `row_mapping` → "Article Card" and `style_mapping` → "Card Grid" produces: each article rendered as a card, then all cards wrapped in a responsive grid widget. The "Card Grid" ComponentMapping's main slot receives the rendered row results as a list. Props like column count, gap size, and responsive breakpoints come from prop bindings (static values or formula sources).

**Layout sections.** The Component concept (Layout suite) manages spatial regions — columns, tabs, accordions, hero sections. Each region can hold blocks, entity displays, or mapped widgets. A `component_mapping` field on a layout region config allows a ComponentMapping to fill that region.

```yaml
sync LayoutRegionUsesMapping [eager]
when {
  Component/renderRegion: [ layout: ?layout; region: ?region ]
}
where {
  Component: { ?layout region_mapping: ?region_mapping }
  filter(?region_mapping != null)
}
then {
  ComponentMapping/render: [ mapping: ?region_mapping;
                             context: { layout: ?layout, region: ?region } ]
}
```

This is how you build a page layout where the hero section is a ComponentMapping that pulls the page's featured image into a full-width widget, the sidebar is a ComponentMapping wrapping a View of recent posts, and the footer is a standalone ComponentMapping with static content and a menu source. Each region references a ComponentMapping by ID.

**Blocks.** Any standalone ComponentMapping (scope_schema and scope_display_mode both null) can be placed as a block in the block layout system. The Component concept's block placement config stores the ComponentMapping ID. The block renders by calling `ComponentMapping/render` with no entity context — all data comes from the mapping's SlotSources (views, static values, menus, formulas).

This is how you create a "Featured Articles" block: create a standalone ComponentMapping using a "card-carousel" widget, bind its main slot to a `view_embed` source pointing at a "Featured Articles" View, bind its title prop to a `static_value` source, and place the mapping as a block in a layout region. The block is fully configured through the admin UI without code.

**Field formatters.** An individual field on a DisplayMode can use a ComponentMapping to control how that single field renders. DisplayMode's per-field formatter config gains an optional `field_mapping` reference. When set, the field's value is passed as context to the ComponentMapping's SlotSources, and the mapping's widget wraps the field's display.

```yaml
sync FieldFormatterUsesMapping [eager]
when {
  Renderer/renderField: [ field: ?field; value: ?value;
                          display_mode: ?dm ]
}
where {
  DisplayMode: { ?dm field_config: ?fc }
  filter(?fc[?field].field_mapping != null)
  bind(?fc[?field].field_mapping as ?mapping_id)
}
then {
  ComponentMapping/render: [ mapping: ?mapping_id;
                             context: { field: ?field, value: ?value } ]
}
```

A link field on an Article might use a ComponentMapping that wraps it in a "button" widget — the link's URL maps to the button's href prop, the link's label maps to the button text slot, and a `static_value` source maps "primary" to the button's variant prop. An image field might use a ComponentMapping that wraps it in a "figure" widget with the image in the media slot and a related caption field in the caption slot (pulling the caption via an `entity_field` source from the same entity).

**Controls.** The Control concept (Automation suite) provides interactive elements — buttons, sliders, toggles — that bind to data and trigger actions. A Control's display can reference a ComponentMapping. Instead of using the default widget that WidgetResolver selects for the control type, the admin specifies a ComponentMapping that wraps the control in a richer widget context.

```yaml
sync ControlUsesMapping [eager]
when {
  Control/render: [ control: ?control ]
}
where {
  Control: { ?control display_mapping: ?mapping_id }
  filter(?mapping_id != null)
}
then {
  ComponentMapping/render: [ mapping: ?mapping_id;
                             context: { control: ?control } ]
}
```

A "Submit for review" button might use a ComponentMapping that wraps the button in a "confirmation-card" widget — the card's heading slot shows the article title (entity_field source), the body slot shows a summary (entity_field with truncate processor), and the action slot contains the actual button control. The button's action binding (which triggers a Workflow transition) is preserved — the ComponentMapping only controls display, not behavior.

**Embedded in the unstructured page editor.** Any ComponentMapping can be embedded in a content page's block tree via slash commands (§3.4). Typing `/component` in the block editor shows available ComponentMappings — both entity-scoped and standalone. Selecting one inserts a block that renders through the mapping. For entity-scoped mappings, the admin picks which entity to display. For standalone mappings, the data comes from the mapping's SlotSources. This is the bridge between the unstructured Roam-like editor and the structured Drupal-like display system — a slash command that drops a fully-configured widget into prose.

#### 3.5.6 Summary: what references what

| Consumer concept | Config field added | What it stores | Context passed to render |
|-----------------|-------------------|---------------|------------------------|
| **DisplayMode** | `component_mapping` | ComponentMapping ID | entity + schema |
| **View** (rows) | `row_mapping` | ComponentMapping ID | entity (per row) |
| **View** (wrapper) | `style_mapping` | ComponentMapping ID | result set + view |
| **Component/Layout** (region) | `region_mapping` | ComponentMapping ID | layout + region |
| **Component/Layout** (block) | `block_mapping` | ComponentMapping ID | none (standalone) |
| **DisplayMode** (field) | `field_mapping` per field | ComponentMapping ID | field + value |
| **Control** | `display_mapping` | ComponentMapping ID | control |
| **ContentNode** (page embed) | block reference | ComponentMapping ID | entity or none |

Every integration is: one optional ID field on an existing concept + one sync that fires when the field is set. No integration requires modifying the ComponentMapping concept itself. No integration requires the consuming concept to know what a ComponentMapping contains. The consuming concept stores an opaque ID; the sync calls `ComponentMapping/render` with the appropriate context; ComponentMapping resolves its SlotSources and returns a render tree.

#### 3.5.7 Creating composite widgets from the admin side

With ComponentMapping referenceable from every rendering context, site builders can create rich composite displays without code. The workflow:

1. **Create a ComponentMapping.** Pick a widget (card, hero-banner, pricing-table, carousel), configure its variant, bind entity fields and other sources to its slots and props. Give it a name ("Article Teaser Card").

2. **Use it everywhere.** Reference the mapping from a DisplayMode (all Article teasers use this card), from a View (search results render as this card), from a layout region (the homepage hero uses this mapping with a featured article), and from the page editor (embed the card in a project's documentation page).

3. **Nest mappings.** A "Feature Comparison Table" ComponentMapping uses a table widget. Its row slot uses a `widget_embed` source that references another ComponentMapping ("Feature Row") which uses a table-row widget with cells bound to feature fields. The table's header slot uses a `static_value` source. Nesting is unbounded — the admin builds complex UIs by composing simple mapped widgets.

4. **Reuse across Schemas.** A standalone ComponentMapping that uses only `view_embed` and `static_value` sources works with any Schema. A "Recent Items" sidebar block mapping references a View that could show Articles, Tasks, or any other content type depending on the View's configuration. The mapping doesn't know or care which Schema the View returns — it wraps whatever the View produces in the widget's slots.

This is not the same as creating a new `.widget` file (which defines a headless component with anatomy, states, affordances, and interactor types). Admin-created ComponentMappings are configured assemblies of existing widgets — they wire data into slots and compose widgets into higher-order displays. The developer creates the primitives (`.widget` files). The site builder composes the primitives into application-specific displays (ComponentMappings). The user sees the result.

### 3.6 Every screen is a composition, not a monolithic widget

There are no monolithic screen-level widgets in Clef Base. Every screen — the entity page, the taxonomy browser, the view builder, the admin dashboard, the concept browser, the version space manager — is a **layout** (§3.4) filled with **areas**, each area either structured (rendering through DisplayModes and ComponentMappings) or unstructured (the block editor). Every piece of UI that shows data is a **View** (a query with a display mode) or a **ComponentMapping** (data wired into a widget's slots). The entire application UI is composed from the same primitives that users use to build their own pages.

This is a design principle, not an implementation detail. It means:

- Every part of every screen can be rearranged, replaced, or extended through the admin UI
- The same Views and ComponentMappings that appear in a "built-in" screen can be embedded in user-created pages
- Custom screens are built from the same building blocks as platform screens — there's no privileged internal UI layer

Here is how the major screens decompose:

**The entity page (triple-zone).** Not a monolithic "EntityPage" widget. It's a layout with three areas:

- **Top area (structured):** Renders the entity's fields through the active Schema's DisplayMode. If the admin has set a ComponentMapping for this Schema+DisplayMode, it renders through that. Otherwise, WidgetResolver's automatic pipeline renders each field independently. The "display as" picker (§3.1.3) is a standard `single-choice` widget bound to the ContentNode's Schema list.
- **Middle area (unstructured):** The block editor — an Outline tree of ContentNode children. Standard slash commands, `[[links]]`, `((embeds))`. No special "entity body" component.
- **Bottom area (structured):** The related zone. This is a set of Views:
  - "Similar" = a View querying SemanticEmbedding results, row-rendered via a "similarity-card" ComponentMapping
  - "Links & Backlinks" = a View querying Reference/Backlink results grouped by edge label, rendered via a "link-list" ComponentMapping
  - "Unlinked References" = a View querying Backlink/getUnlinkedMentions, rendered via a "mention-card" ComponentMapping with a one-click "convert to link" Control
  - "Nearby" = a View querying Graph analysis results, rendered via a "graph-neighbor" ComponentMapping

Each of these Views is a standard View ContentNode with a ComponentMapping for its row display. They can be individually hidden, reordered, or replaced. An admin who wants to add a fifth section to the related zone — say, "Recent Comments" — adds a View to the layout. An admin who wants the related zone as a sidebar instead of below the content changes the layout's responsive config.

**The taxonomy browser.** Not a monolithic "TaxonomyBrowser" widget. It's a layout with two areas:

- **Left area (structured):** A View querying all ContentNodes with Schema "TaxonomyTerm" in the selected vocabulary, rendered via a "tree" ComponentMapping that respects the `parent` field for hierarchy. The tree ComponentMapping uses Outline-derived nesting — each node shows its children indented. Clicking a term navigates to its entity page.
- **Right area (structured):** The selected term's entity page (the same triple-zone layout described above, embedded in this area). Alternatively, an admin could configure this as an unstructured area for inline editing.

**The View builder.** Not a monolithic "ViewBuilder" widget. It's a layout with three areas:

- **Top area (structured):** The View's Schema "View" fields rendered through their DisplayMode — data_source (entity picker), filters (filter builder ComponentMapping), sorts (sort configuration ComponentMapping), layout_type (single-choice widget).
- **Middle area (structured):** A live preview. This is the View's own `execute` results, rendered through the View's configured row ComponentMapping. The preview updates as the admin changes filters and sorts above.
- **Bottom area (unstructured):** Documentation for this View — notes on when to use it, who it's for, what it shows. This is the entity's standard unstructured zone.

**The admin dashboard.** Not a monolithic "AdminDashboard" widget. It's a layout configured by the admin with areas showing:

- A View of recently modified ContentNodes across all Schemas, rendered via a "recent-activity" ComponentMapping
- A View of ContentNodes with Schema "AutomationRule" that have `status: failed`, rendered via an "alert-card" ComponentMapping
- A View of pending workflow transitions (ContentNodes awaiting review), rendered via a "moderation-queue" ComponentMapping
- An unstructured area for admin notes and documentation

The admin can add, remove, reorder, and resize these areas. Each View is a standard View ContentNode. Each ComponentMapping is a standard ComponentMapping ContentNode. The "admin dashboard" is not a platform concept — it's a page with a layout.

**The concept browser.** Not a monolithic "ConceptBrowser" widget. It's a layout with:

- A View of available packages from registries, rendered via a "package-card" ComponentMapping showing name, version, description, install status
- A View of installed packages, rendered via a "installed-package" ComponentMapping with version, update availability, and uninstall Control
- A detail panel (structured area) showing the selected package's concept specs, syncs, and dependency tree — rendered through ComponentMappings that display Score concept graph data

**The version space manager.** Not a monolithic widget. It's a layout with:

- A View of all VersionSpace ContentNodes the user can access, rendered via a "space-card" ComponentMapping showing status, owner, override count, last activity
- A detail panel with a View of overrides in the selected space (queried from VersionSpace state), rendered via a "diff-card" ComponentMapping
- Controls for merge, rebase, promote, archive — standard Control widgets bound to VersionSpace actions

**The implication.** Because every screen is a composition of Views, ComponentMappings, layout areas, and Controls, there is no "internal UI" vs "user UI" distinction. The taxonomy browser is a page. The admin dashboard is a page. The concept browser is a page. They're all ContentNodes with layouts. An admin can clone the concept browser's layout, modify it, and create a "simplified package installer" page for non-admin users. A developer can embed the version space manager's override View in a project page. The platform's own UI is made of the same stuff users build with.

### 3.7 Canvas: spatial content surfaces

The block editor (§3.2) organizes content hierarchically — blocks in an Outline tree. Schema fields (§2.4) organize content as structured records. Canvas provides a third mode: **spatial**. Items at x,y coordinates on an infinite 2D surface, connected by lines, arranged freeform. Think Miro, FigJam, tldraw — but built from the same ContentNode + Schema + display-as primitives as everything else.

#### 3.7.1 Canvas as a concept

Canvas is a concept in the Content suite. Like every other domain concept in Clef Base, Schema "Canvas" is a composable mixin — **any ContentNode can gain Schema "Canvas" and become a spatial surface.** Apply it to a ContentNode that already has Schema "Article" and it's both an article and a diagram — display-as "Article" shows article fields, display-as "Canvas" shows the spatial surface. Apply it to a ContentNode with Schema "TaxonomyTerm" and it's both a taxonomy term and a visual map. The Canvas concept's actions (`addItem`, `drawConnector`, `surfaceExistingReferences`) become callable on any ContentNode that has Schema "Canvas" applied, regardless of what other Schemas it has.

To have an article *with a diagram inside it* (rather than an article that IS a diagram), embed a Reference to a Canvas ContentNode in the article's unstructured zone, with display-as "Canvas." Two ContentNodes — the article and the canvas — linked by a Reference. Or configure the article's page layout with two areas: one displaying as Article, one displaying as Canvas — same ContentNode, both perspectives visible simultaneously.

Schema "Canvas" defines entity-data fields: `name` (String), `description` (RichText), `background` (Enum: blank | grid | dots | lined), `default_zoom` (Float). The Canvas concept adds spatial operations: `addItem`, `moveItem`, `resizeItem`, `removeItem`, `drawConnector`, `promoteConnector`, `demoteConnector`, `surfaceExistingReferences`, `frame`, `group`. Operational state (concept-local storage): item positions, connector path data (bezier curves, routing), spatial index for viewport queries, group membership.

A ContentNode with Schema "Canvas" has the full triple-zone treatment. Its structured zone shows the canvas fields (name, description, background settings). When displayed as "Canvas" (§3.1.3), the spatial surface renders as the content body — items at their x,y positions with connectors between them. Its related zone shows entities linked to the canvas and nearby canvases.

To embed a canvas in a page, use a Reference with display-as "Canvas" — the spatial surface renders inline in the layout area, just like embedding a View renders live query results inline.

#### 3.7.2 Items on the canvas

Every item on a canvas is a ContentNode. The Canvas concept stores each item's spatial data in its operational state, keyed by `(canvas_id, item_contentnode_id)`: `x`, `y`, `width`, `height`, `rotation`, `z_index`.

Items come in two kinds:

**Local items** — ContentNodes owned by the canvas through Outline (composition). They exist because the canvas exists. Deleting the canvas deletes them. These are:

- **Text blocks.** A ContentNode with children (blocks) — same as a block in a page, just spatially positioned instead of Outline-ordered. Type prose, add formatting, embed `[[links]]`.
- **Shapes.** ContentNodes with Schema "Shape" — fields for `shape_type` (rectangle, circle, diamond, sticky_note, callout), `fill_color`, `stroke_color`, `stroke_width`, `text_content`. Sticky notes are shapes with `shape_type: sticky_note`.
- **Frames.** ContentNodes with Schema "Frame" — named regions of the canvas that group items spatially. A frame has `name`, `background_color`, and serves as a navigable section (the canvas sidebar lists frames for quick navigation). Items inside a frame's bounds are visually grouped.
- **Freeform drawings.** ContentNodes with Schema "Drawing" — SVG path data for sketch/pen strokes.

Since local items are ContentNodes, they get the full treatment. A sticky note is searchable (its text is indexed). A frame has a related zone (backlinks from items placed inside it). A text block can have Schemas applied to it — apply Schema "Task" to a text block on the canvas and it gains task fields (status, assignee, due date). The text block is now both a canvas item and a task, queryable as either.

**Referenced items** — References from the canvas to existing ContentNodes elsewhere in the system. The entity exists independently. Removing it from the canvas removes the Reference; the entity is untouched.

Referenced items use the **display-as picker** (§3.1.3). Drop a ContentNode onto the canvas and choose how to display it:

- "Display as Article in card mode" → renders as a card showing title, author, teaser
- "Display as View in results mode" → renders live query results right on the board
- "Display as Canvas in thumbnail mode" → renders a nested canvas preview (clicking zooms in)
- "Display as TaxonomyTerm in badge mode" → renders as a small labeled badge
- "Display as Media in preview mode" → renders image/video preview
- "Display as [any Schema] in [any DisplayMode]" → the full combinatorial space

The same ContentNode can appear on multiple canvases, displayed differently on each.

#### 3.7.3 Three kinds of connectors

Lines between items on a canvas come in three kinds. This distinction is critical — it's what makes Canvas both a freeform diagramming tool AND a graph editor over the system's linking data.

**Local connectors** — visual-only lines on this canvas. Stored in Canvas's operational state. No Reference created in the linking system. Drawing "Step 1 → Step 2" in a flowchart doesn't create a system-wide relationship between those ContentNodes. This is the default when a user draws a line. Local connectors have visual properties: line style (solid, dashed, dotted), arrow type (none, forward, backward, both), color, label text, bezier curve path.

**Semantic connectors** — real typed References between the ContentNodes. Created when the user explicitly promotes a local connector ("Make this a real link") or draws a connector in semantic mode. `Canvas/promoteConnector` calls `Reference/addRef(source, target, label)` — the same typed Reference as `[[target|label]]` in prose. The connector appears in both items' related zones, participates in graph analysis, is queryable. The canvas stores additional visual data (path, style) in operational state, but the underlying relationship exists independently of the canvas.

**Surfaced connectors** — existing References between items that are already on the canvas, discovered and visualized. If Item A and Item B are both on this canvas, and A already has a Reference to B (created in prose, in a Relation field, on another canvas, wherever), the canvas can show it. `Canvas/surfaceExistingReferences` queries for all References between the canvas's items and returns them for optional visualization. The user sees the graph of connections between everything on their board — connections they may not have known existed.

Surfaced connectors render with a distinct visual style (lighter, or with an icon indicating they're external) so users can distinguish "lines I drew" from "connections the system found."

**Connector operations:**

- `drawConnector(canvas, source, target, label)` → creates a local connector. Default action when dragging between items.
- `promoteConnector(canvas, source, target)` → converts a local connector to semantic. Creates a Reference. The visual line stays; the underlying data becomes a system-wide link.
- `demoteConnector(canvas, source, target)` → converts a semantic connector to local. Removes the Reference. The visual line stays; the system-wide link is deleted.
- `surfaceExistingReferences(canvas)` → discovers References between all items on the canvas. Returns a list of surfaceable connections for the user to toggle on/off.
- `hideConnector(canvas, reference_id)` → stops showing a surfaced connector on this canvas without deleting the underlying Reference.

#### 3.7.4 Canvas as a visual graph editor

The combination of referenced items + surfaced connectors makes every canvas a potential **visual graph editor** over the system's Reference/Relation data.

**Workflow:** Drop ten ContentNodes onto a canvas. Call `surfaceExistingReferences`. See the connection graph between them — arrows representing References created anywhere in the system (from prose links, Relation fields, other canvases, automated syncs). Rearrange spatially to make sense of the structure. Apply a layout algorithm (force-directed, hierarchical, circular — Canvas providers via PluginRegistry) for automatic arrangement. Draw new local connectors as annotations. Promote interesting ones to real links. The canvas is a workspace for exploring and editing the knowledge graph visually.

**Interesting compositions:**

- **Schema "Canvas" + Schema "View":** A canvas whose items are auto-populated from a query. The View's results are placed on the canvas (via layout algorithm providers: force-directed, grid, hierarchical). The user can then rearrange them spatially. It's a visual query result — like a Miro board that auto-populates from a database query. New results appear as unpositioned items; removed results disappear.
- **Schema "Canvas" + Schema "TaxonomyTerm":** A taxonomy term that IS a diagram. A vocabulary of "System Architectures" where each term is a canvas showing component relationships. Navigate the taxonomy tree, click a term, see the architecture diagram.
- **Nested canvases:** A frame or referenced item on a canvas can be a Canvas ContentNode displayed as "Canvas in thumbnail mode." Clicking zooms into the nested canvas. Infinite spatial nesting.
- **Canvas-driven Concept Graph:** The Score UI's concept graph navigator (§10.1) is a Canvas ContentNode with all installed concepts as referenced items and their sync connections as surfaced connectors. Force-directed layout arranges them. The developer rearranges to highlight architectural patterns. The canvas IS the architecture diagram — editable, explorable, and backed by the real sync graph.

#### 3.7.5 Repertoire gap: the existing Canvas concept vs. what Clef Base needs

The existing `Canvas` concept in the Content suite (`repertoire/concepts/content/canvas.concept`, @version(2)) is minimal: three actions (`addNode`, `moveNode`, `groupNodes`) with state for `canvases`, `nodes`, and `positions`. It delegates node connections to Graph (via `canvas-connections.sync`) and file embedding to FileManagement (via `canvas-file-embed.sync`). This is a good, focused concept — it does spatial placement — but Clef Base's §3.7 vision requires substantially more.

**What needs to become new repertoire concepts (not Clef-Base-specific):**

The following decomposition creates reusable, independently motivated concepts that any Clef app could use, following Jackson's methodology:

| New Concept | Suite | Purpose (independently motivated) | Syncs with Canvas |
|---|---|---|---|
| **SpatialConnector** | Content | Typed connections between spatial items — visual-only, semantic (backed by Reference), and surfaced (discovered from existing References). Owns connector visual state: path data, style, arrow type, label. | `Canvas/addNode` → `SpatialConnector/surfaceExistingReferences` |
| **Frame** | Content | Named spatial regions that group items. Owns bounds, background, and navigation index. | `Canvas/addNode` → `Frame/checkContainment` |
| **SpatialLayout** | Content (coordination) | Layout algorithm dispatch for spatial surfaces — force-directed, hierarchical, grid, circular. Follows the coordination+provider pattern using PluginRegistry. | `Canvas/groupNodes` → `SpatialLayout/arrange` |
| **Shape** | Content | Basic geometric primitives (rectangle, circle, diamond, sticky_note, callout) with fill, stroke, and text content. | None — composed via Schema on ContentNodes placed on Canvas |

**What stays on the existing Canvas concept (extend, don't replace):**

The existing Canvas concept should be extended (bumped to @version(3)) with these additional actions:
- `removeItem(canvas, item)` — remove an item from the canvas
- `resizeItem(canvas, item, width, height)` — resize an item on the canvas

The connector operations (`drawConnector`, `promoteConnector`, `demoteConnector`, `surfaceExistingReferences`) move to the new SpatialConnector concept. The framing operations (`frame`) move to the new Frame concept.

**What is Clef-Base-specific (stays in Clef Base, not repertoire):**

- The Schema definitions for "Canvas", "Shape", "Frame", "Drawing" (Schema is a Clef Base entity concept, not a Repertoire concept)
- The `schema.yaml` mapping Canvas state to ContentNode Properties
- The triple-zone page configuration for Canvas ContentNodes
- The display-as picker integration (§3.1.3) for how items render on the canvas
- The composition rule "Schema Canvas + Schema View = auto-populated visual query results"

#### 3.7.6 Canvas decomposition (following §3.6)

Following the composition principle, the canvas UI is not a monolithic "CanvasEditor" widget. It's a layout with:

- **Main area:** The spatial surface — a ComponentMapping that renders Canvas's items at their x,y positions with their display-as modes, draws connectors between them, and handles drag/move/resize interactions. This ComponentMapping wraps the Surface Canvas widget (a specialized rendering surface for spatial content, like a scrollable/zoomable viewport).
- **Left sidebar (structured):** A View of the canvas's frames (ContentNodes with Schema "Frame" that are children of this canvas), rendered as a navigable list. Clicking a frame pans the canvas to that region.
- **Right sidebar (structured):** The selected item's entity page — the same triple-zone layout embedded in a panel. Shows the selected item's fields, body, and related zone. Edit a sticky note's text, view a referenced article's metadata, check a task's status — without leaving the canvas.
- **Bottom panel (structured):** A Control panel with canvas-level actions — layout algorithm selector (single-choice widget), zoom level (slider), grid toggle (checkbox), export (action button).

Each of these is a standard View, ComponentMapping, or Control. An admin can reconfigure the layout — move the sidebar, add a View of "recently added items," embed a comment thread for the canvas.

---

## 4. Taxonomy, classification, and progressive structuring

### 4.1 Taxonomy as a first-class system

The Taxonomy concept provides hierarchical classification. Like everything else, taxonomies are ContentNodes with Schemas — and critically, **any ContentNode can become a taxonomy term** by having Schema "TaxonomyTerm" applied to it.

**Schema "Vocabulary"** defines a classification scheme. Fields: `name` (String), `description` (RichText), `hierarchy_type` (flat | single_parent | multiple_parents). A vocabulary ContentNode represents the scheme itself — "Topics", "Regions", "Skill Levels". Vocabularies are in the config manifest (admins manage the classification schemes; users populate them).

**Schema "TaxonomyTerm"** defines a term within a vocabulary. Fields: `name` (String), `description` (RichText), `vocabulary` (Reference to a ContentNode with Schema "Vocabulary"), `parent` (Reference to another TaxonomyTerm ContentNode, optional — for hierarchy). The Taxonomy concept provides `addTerm`, `setParent`, `reorder`, and `getTree` actions for hierarchical operations beyond basic CRUD.

The taxonomy editor UI is a convenience that creates new ContentNodes with Schema "TaxonomyTerm" auto-applied. But you can also apply Schema "TaxonomyTerm" to an existing ContentNode that already has other Schemas. A ContentNode with Schema "View" can also gain Schema "TaxonomyTerm" — now it's both a View AND a taxonomy term. You've created a taxonomy of views. A ContentNode with Schema "Media" can gain Schema "TaxonomyTerm" — now it's both a media asset and a taxonomy term, classifiable within a vocabulary hierarchy. This isn't a special feature — it's the natural consequence of Schema composition.

This means you can build things like: a vocabulary of "Design Patterns" where each term is also a View (showing all entities tagged with that pattern), or a vocabulary of "Team Members" where each term is also a user profile with Schema "UserProfile", or a vocabulary of "Project Phases" where each term is also a kanban board via Schema "View" with layout_type = "kanban."

**Schema "HasTags"** is a mixin schema (§2.4.3) that adds a `tags` field (list of References to ContentNodes with Schema "TaxonomyTerm") to any ContentNode. The taxonomy suite ships a `composition.yaml` that auto-applies HasTags to common content-type Schemas like Article and Page. The field's selection plugin (§2.5) can be scoped to a specific vocabulary — "only terms from the Topics vocabulary."

Taxonomy isn't restricted to user-facing content. An admin can create composition rules to apply Schema "HasTags" to config-manifest Schemas too. A vocabulary of "Concept Categories" classifies concepts in the registry. A vocabulary of "Deployment Targets" classifies environments. A vocabulary of "Widget Types" classifies Surface widgets. Taxonomy is infrastructure, not just content decoration.

### 4.2 Schema-as-mixin and progressive formalization

The Schema concept operates as a mixin (Tana's supertag pattern). A schema is a first-class entity independent of any collection or container. Schemas define typed fields, support single inheritance (`extends`), and can be composed by applying multiple schemas to the same entity (emergence). Applying a schema to an entity materializes its fields without destroying existing content. See §2.4.3 for the formal distinction between thing schemas, mixin schemas, `includes` for intra-suite composition, and `composition.yaml` for cross-suite auto-application rules.

This enables progressive formalization — the meta-pattern that emerges from the Notion/Tana/Coda research. The lifecycle of content in Clef Base follows a predictable path:

1. **Capture** — Write freeform content in a daily note or scratch page (ContentNode, DailyNote)
2. **Organize** — Move blocks into collections, add to outlines (Collection, Outline)
3. **Classify** — Apply a schema/tag to the entity; structured fields appear (Schema, Tag, PageAsRecord)
4. **Connect** — Create relations to other entities; typed inline links add semantic edges (Relation, Reference, Formula)
5. **Discover** — The related zone surfaces connections you didn't create: similar entities by embedding, nearby entities by graph analysis, unlinked name mentions (SemanticEmbedding, Graph, Backlink). Convert discoveries into explicit links with one click.
6. **Compute** — Add formula fields, embedded queries, computed views (Formula, Query, View)
7. **Automate** — Create automation rules triggered by field changes or schema application (AutomationRule, Workflow)
8. **Interact** — Add controls (buttons, sliders, toggles) that operate on structured data (Control)
9. **Share** — Embed synced content, publish views, expose via API (SyncedContent, View, Bind)

Users can enter at any stage and advance incrementally. Nothing forces structure upfront; nothing prevents it later.

---

## 5. Parallel version spaces: the multiverse model

### 5.1 Beyond history — parallel realities

> **Repertoire placement note:** The existing Versioning suite (`repertoire/concepts/versioning/`) provides 11 core concepts (ContentHash, Ref, DAGHistory, Patch, Diff, Merge, Branch, TemporalVersion, SchemaEvolution, ChangeStream, RetentionPolicy) plus 8 pluggable providers (4 diff algorithms: Myers, Patience, Histogram, Tree; 4 merge strategies: ThreeWay, Recursive, Lattice, Semantic). VersionSpace and VersionContext described below are **not** in the Versioning suite — they belong in a new **Multiverse suite** in the repertoire, because parallel reality overlays are independently useful outside Clef Base (any collaborative Clef app could use them). The Multiverse suite syncs heavily with the Versioning suite: VersionSpace's `merge` action delegates to `Merge/finalize`, its `diff` action delegates to `Diff/diff`, its `rebase` delegates to `Diff/diff` + conflict resolution, and its `fork_point` state is a ContentHash reference. The simple `Version` concept in the Content suite (`snapshot`, `rollback`, `diff`) remains for single-entity point-in-time snapshots — it and TemporalVersion and VersionSpace are three complementary systems at different abstraction levels.
>
> **New Multiverse suite (proposed for repertoire):**
>
> | Concept | Purpose | Key syncs with Versioning |
> |---|---|---|
> | **VersionSpace** | Parallel reality overlays with copy-on-write entity overrides | `merge` → `Merge/finalize`, `diff` → `Diff/diff`, `fork_point` → `ContentHash/store` |
> | **VersionContext** | Per-user version space stack tracking and resolution | `resolve_for` calls `VersionSpace/resolve` walking the stack |
> | **SearchSpace** | Scoped overlay indexes for version-aware search | Layers on `SearchIndex`, `Backlink`, `SemanticEmbedding` base indexes |
>
> The Multiverse suite `uses` the Versioning suite for diff/merge/content-addressing and the Collaboration suite for ConflictResolution. Integration syncs between Multiverse and ContentStorage (§5.6) are Clef-Base-specific (the `version-aware-load.sync` and `version-aware-save.sync`) because they depend on the shared ContentNode pool model.

Most systems treat versioning as linear history: a timeline of changes you can roll back. Clef Base adds a second dimension: **parallel version spaces** — alternate realities of the same content that coexist simultaneously. A version space is not a branch in the git sense (developer-facing, file-level, merge-or-abandon). It is a user-facing, entity-level, recursively composable overlay that changes what the user sees and works with as they navigate the application.

The base version is the shared canonical reality. Anyone can fork a version space from it — private (only the creator sees it), shared (a group navigates it together), or public (visible to everyone, but only participants can edit within it). Unlike git, version spaces are **recursive**: within a version space, any sub-entity or sub-tree can be forked again into its own version space, creating a tree of nested realities. A user navigating the site is always in a specific version context — base, or a stack of nested version spaces — and everything they see is filtered through that context.

The model serves several use cases that traditional versioning cannot. A content team can fork a version space to explore a major site redesign without affecting the live site; individual members within that fork can each experiment with different approaches to specific pages. A research group can maintain competing hypotheses as parallel version spaces of their data, each with different categorizations, annotations, and interpretations. A governance process can let stakeholders propose changes in their own version spaces, with formal merge ceremonies to accept proposals into base.

### 5.2 The VersionSpace concept

```
@version(1)
concept VersionSpace [V] {

  purpose {
    Maintain parallel, recursively composable overlays of entity state,
    enabling users and groups to inhabit alternate realities of the same
    content simultaneously.
  }

  state {
    spaces: set V
    name: V -> String
    parent: V -> option V               // null = forked from base; set = nested fork
    root_scope: V -> option String       // null = whole-application fork
                                         // set = scoped to a specific entity/subtree
    visibility: V -> { private | shared | public }
    status: V -> { draft | active | proposed | merged | archived }
    created_by: V -> String              // user ID
    created_at: V -> DateTime
    fork_point: V -> option String       // content hash of parent's state at fork time
                                          // used by merge, rebase, and diff to detect
                                          // what changed in the parent since the fork

    membership {
      members: set V
      member_space: V -> V
      member_user: V -> String
      member_role: V -> { owner | editor | viewer }
    }

    overrides {
      // Copy-on-write overlay: only ContentNodes actually modified in this
      // space store overrides. Everything else reads through to parent.
      // Since every entity is a ContentNode (§3.1.1), overrides key by
      // entity_id alone — Schema membership is on the ContentNode, not
      // on the override.
      override_entries: set V
      override_space: V -> V
      override_entity_id: V -> String
      override_fields: V -> String       // serialized field values (delta, not full copy)
      override_operation: V -> { create | modify | delete }
      override_at: V -> DateTime
    }

    // Recursive sub-spaces within this space
    children: V -> list V

    // History of base reality swaps (global, not per-space)
    base_history {
      snapshots: set V
      snapshot_content_hash: V -> String   // content-addressed snapshot of base at that point
      snapshot_promoted_from: V -> option V // which space was promoted, if any
      snapshot_timestamp: V -> DateTime
      snapshot_label: V -> String          // auto-generated or user-provided label
    }
  }

  actions {
    action fork(name: String, parent: V, scope: String, visibility: String) {
      -> ok(space: V) {
        Creates a new version space. If parent is null, forks from base.
        If scope is null, the space covers the entire application. If scope
        is set to an entity ID, the space covers only that entity and its
        descendants (blocks, sub-entities, referenced entities within the
        subtree). The space starts with zero overrides — all reads pass
        through to the parent until the first modification.
      }
      -> parent_not_found(parent: V) {
        The specified parent version space does not exist or is archived.
      }
      -> scope_not_found(scope: String) {
        The scoped entity does not exist.
      }
    }

    action enter(space: V, user: String) {
      -> ok() {
        Sets this space as the user's active version context (or pushes it
        onto their version context stack if entering a sub-space within
        an already-active parent space). All subsequent load/save/query
        operations for this user resolve through this space's overlay.
      }
      -> access_denied(user: String) {
        The user is not a member of a private/shared space.
      }
      -> archived(space: V) {
        The space is archived and cannot be entered.
      }
    }

    action leave(space: V, user: String) {
      -> ok() {
        Removes this space from the user's version context stack. If it was
        the only space, the user returns to base. If it was a sub-space,
        the user returns to the parent space.
      }
    }

    action write(space: V, entity_id: String,
                 fields: String) {
      -> ok(override: V) {
        Creates or updates an override in this space. The override stores
        only the changed fields (delta), not a full copy. If this is the
        first modification to this entity in this space, copy-on-write
        creates the override entry.
      }
      -> read_only(space: V, user: String) {
        The user has viewer role and cannot write.
      }
    }

    action create_in_space(space: V, fields: String) {
      -> ok(override: V, entity_id: String) {
        Creates a new entity that exists only in this version space. The
        entity is invisible from the parent space or base. If the space is
        later merged, the entity materializes in the target.
      }
    }

    action delete_in_space(space: V, entity_id: String) {
      -> ok(override: V) {
        Marks an entity as deleted in this version space. The entity still
        exists in the parent/base but is invisible when navigating within
        this space. If the space is later merged, the deletion applies to
        the target.
      }
    }

    action resolve(space: V, entity_id: String) {
      -> ok(fields: String, source: String) {
        Resolves the current state of an entity as seen from this version
        space. Walks the space's ancestry chain (space → parent → ... → base),
        applying overrides at each level. Returns the merged field values
        and which space each field's value came from (for UI attribution).
        This is the core read path for version-aware entity loading.
      }
      -> not_found(entity_id: String) {
        The entity does not exist in this space or any ancestor, or it
        has been deleted in this space.
      }
    }

    action propose(space: V, target: V, message: String) {
      -> ok() {
        Transitions the space to status=proposed, signaling that the owner
        wants its overrides merged into the target space (or into base if
        target is null). This creates a review surface where target space
        members can see the proposed changes.
      }
      -> already_proposed(space: V) {
        The space is already in proposed status.
      }
    }

    action merge(space: V, target: V, strategy: String) {
      -> ok(merged_count: Int, conflict_count: Int) {
        Applies the space's overrides to the target (or base if target is
        null). For each override: if the target entity has not changed since
        the fork point, the override applies cleanly. If both have changed,
        the conflict resolution strategy determines the outcome. Created
        entities materialize in the target. Deleted entities are removed
        from the target. After merge, the source space transitions to
        status=merged. The target (or base) gains all the source's changes.
        This is a one-directional, terminal operation for the source space.
      }
      -> conflicts(conflicts: String) {
        Unresolvable conflicts exist. Returns the conflict set for
        manual resolution. The merge does not proceed until all
        conflicts are resolved.
      }
    }

    action sync_spaces(space_a: V, space_b: V, direction: String,
                       strategy: String) {
      -> ok(a_to_b_count: Int, b_to_a_count: Int, conflict_count: Int) {
        Synchronizes changes between two sibling or unrelated version spaces
        without merging either into the other. Both spaces survive and remain
        active. Direction is "a_to_b", "b_to_a", or "bidirectional".

        For bidirectional sync: changes unique to A flow into B's overrides,
        changes unique to B flow into A's overrides, and changes to the same
        entity in both spaces are resolved via the conflict strategy. After
        sync, both spaces contain the union of their non-conflicting changes
        plus resolved conflicts.

        This is the mechanism for keeping parallel realities partially aligned
        — e.g., two research hypotheses that share methodology changes but
        diverge on interpretation.
      }
      -> conflicts(conflicts: String) {
        Bidirectional conflicts that could not be auto-resolved.
      }
      -> incompatible_scope(space_a: V, space_b: V) {
        The two spaces have non-overlapping scopes and share no entities
        to synchronize.
      }
    }

    action cherry_pick(source: V, target: V,
                       entity_id: String) {
      -> ok() {
        Copies a single entity's override from the source space into the
        target space. If the target already has an override for this entity,
        the conflict strategy from the target's config applies. The source
        space is not modified. This enables selective cross-pollination
        between version spaces — "I like what they did with this one article
        in their version, pull that into mine."
      }
      -> not_overridden(source: V, entity_id: String) {
        The source space has no override for this entity. There is nothing
        to cherry-pick.
      }
      -> conflict(existing_override: String, incoming_override: String) {
        The target already has a different override for this entity.
        Returns both for manual resolution.
      }
    }

    action promote_to_base(space: V) {
      -> ok(old_base_snapshot: V) {
        Replaces the current base reality with this version space's resolved
        state. This is the nuclear option — it does not merge individual
        overrides but wholesale swaps what "base" means.

        The operation:
        1. Snapshots the current base as a new archived version space
           (old_base_snapshot) so it is never lost
        2. Materializes all of this space's resolved state (walking the
           full override chain) into base storage
        3. Recalculates all other active version spaces' overrides relative
           to the new base (overrides that now match the new base are
           dissolved; overrides that diverge from the new base are preserved
           as deltas against the new base)
        4. Archives the promoted space (it IS the base now)
        5. Records a provenance event for the base swap

        All users currently in base see the new reality immediately. Users
        in other version spaces see their space's overrides resolved against
        the new base.
      }
      -> has_children(children: list V) {
        The space has active sub-spaces. They must be merged or archived
        before promotion (promoting a space with sub-spaces would create
        ambiguity about which sub-space overrides to include).
      }
      -> access_denied() {
        Only the space owner and system admins can promote to base.
      }
    }

    action rebase(space: V) {
      -> ok(dissolved_count: Int, preserved_count: Int) {
        Re-computes this space's overrides against the current base. If
        base has changed since the space was forked (either through direct
        edits or because another space was promoted), some overrides may
        now be redundant (the base independently arrived at the same value)
        and are dissolved. Other overrides may now conflict with base
        changes and need resolution.

        This is the mechanism for keeping a long-lived version space fresh:
        "base has evolved since I forked — pull in the base changes and
        reconcile." Unlike merge (which is terminal for the source), rebase
        updates the space's fork point to the current base and adjusts
        overrides accordingly. The space remains active.
      }
      -> conflicts(conflicts: String) {
        Base changes conflict with overrides in this space. Returns the
        conflict set for resolution. Unresolved conflicts block the rebase.
      }
    }

    action diff(space: V) {
      -> ok(changes: String) {
        Returns all overrides in this space as a structured changeset:
        which entities were created, modified, or deleted, and for
        modifications, which fields changed and what the before/after
        values are (relative to the parent).
      }
    }

    action archive(space: V) {
      -> ok() {
        Transitions the space to status=archived. It can no longer be
        entered or modified, but its overrides are preserved for
        historical reference. Active users in this space are moved to
        the parent or base.
      }
    }
  }

  invariant {
    after fork(name: "redesign", parent: null, scope: null,
               visibility: "shared") -> ok(space: s)
    and   write(space: s, entity_id: "a1",
                fields: "{title: \"New Title\"}") -> ok(override: _)
    then  resolve(space: s, entity_id: "a1")
          -> ok(fields: f, source: _)
          where f contains "New Title"
    and   merge(space: s, target: null, strategy: "field_merge")
          -> ok(merged_count: 1, conflict_count: 0)
    then  resolve(space: null, entity_id: "a1")
          -> ok(fields: f, source: "base")
          where f contains "New Title"
  }
}
```

### 5.3 Copy-on-write overlay semantics

A version space does **not** copy all content when forked. It starts empty — zero overrides. Every entity read in a version space triggers the `resolve` action, which walks the ancestry chain: first check if this space has an override for this entity; if not, check the parent space; if not, check the parent's parent; continue until reaching base. This is copy-on-write: only the first modification to an entity in a space creates an override. Subsequent modifications update that same override.

Overrides store **field-level deltas**, not full entity copies. If an Article has 20 fields and you change the title in a version space, the override contains only `{title: "New Title"}`. The other 19 fields resolve from the parent. This means version spaces are storage-efficient — thousands of version spaces that each tweak a few entities consume minimal additional storage. It also means changes in the parent or base automatically flow through to child spaces for fields that haven't been overridden.

When a version space creates a new entity (one that doesn't exist in the parent), the override has `operation: create` and stores the complete field set. When a version space deletes an entity (marks it invisible), the override has `operation: delete` and stores no field data — it is a tombstone that short-circuits the resolution chain.

### 5.4 Recursive composition

The recursive model is what makes version spaces fundamentally different from git branches. Within a version space, any entity or subtree can be forked again into a sub-space. A user's **version context** is a stack of active spaces, from the broadest to the most specific.

A concrete example: a research team forks a version space called "Hypothesis A" covering the entire project. Within that space, researcher Alice forks a sub-space scoped to just the "Methodology" page, where she's trying a different analytical approach. Researcher Bob forks a different sub-space scoped to the "Dataset" entity, where he's experimenting with alternative data cleaning parameters.

Alice's version context stack is: base → "Hypothesis A" → "Alice's Methodology". When she navigates to the Methodology page, she sees her version. When she navigates to the Dataset page, she sees Bob's changes if she's also entered Bob's sub-space, or the "Hypothesis A" version if she hasn't, or the base version if "Hypothesis A" hasn't modified the Dataset entity. When she navigates to an unrelated page that nobody in "Hypothesis A" has touched, she sees base.

The `resolve` action handles this by walking the stack: for each entity, check the most specific active space first, then walk outward. Scoping is respected — Alice's Methodology sub-space only has overrides for entities within the Methodology page's subtree (the page itself, its blocks, and entities referenced exclusively from that page). Queries automatically respect the version context: a query for "all articles tagged with #methodology" returns results as seen from Alice's current stack.

```
Version Context Stack (Alice):
┌─────────────────────────────────────────┐
│ Sub-space: "Alice's Methodology"        │ ← checked first for Methodology entities
│   scope: entity "methodology-page"      │
├─────────────────────────────────────────┤
│ Space: "Hypothesis A"                   │ ← checked for everything else
│   scope: whole application              │
├─────────────────────────────────────────┤
│ Base                                    │ ← fallback for unmodified entities
└─────────────────────────────────────────┘

Entity resolution for "methodology-page":
  → Alice's Methodology has override? YES → return Alice's version

Entity resolution for "dataset":
  → Alice's Methodology has override? NO (out of scope)
  → Hypothesis A has override? Check... YES → return Hypothesis A version

Entity resolution for "unrelated-article":
  → Alice's Methodology has override? NO (out of scope)
  → Hypothesis A has override? NO (nobody touched it)
  → Base → return base version
```

### 5.5 The VersionContext concept

```
@version(1)
concept VersionContext [C] {

  purpose {
    Track each user's active version space stack so that all
    ContentStorage operations resolve through the correct overlay chain.
  }

  state {
    contexts: set C
    context_user: C -> String
    context_stack: C -> list String      // ordered list of VersionSpace IDs,
                                          // broadest first, most specific last
    context_updated_at: C -> DateTime
  }

  actions {
    action push(user: String, space_id: String) {
      -> ok(context: C) {
        Adds a version space to the user's stack. If the space is a
        sub-space of an already-active space, it is placed after its
        parent in the stack. If the space is a top-level fork and
        another top-level space is already active, the user must
        leave the existing one first (only one top-level space at a time,
        but unlimited recursive sub-spaces within it).
      }
      -> conflict(existing: String) {
        A top-level space is already active and the new space is also
        top-level. Leave the existing space first.
      }
    }

    action pop(user: String, space_id: String) {
      -> ok(context: C) {
        Removes a version space from the user's stack. If it has sub-spaces
        on the stack above it, those are also removed (popping a parent
        pops all children).
      }
    }

    action get(user: String) {
      -> ok(stack: list String) {
        Returns the user's current version context stack. An empty list
        means the user is in base.
      }
      -> no_context(user: String) {
        No context exists for this user (equivalent to base).
      }
    }

    action resolve_for(user: String, entity_id: String) {
      -> ok(fields: String, source_space: String) {
        Convenience action that combines VersionContext/get with
        VersionSpace/resolve, walking the user's stack to produce
        the resolved entity state. This is the action that the
        entity-lifecycle suite's version-aware routing sync calls.
      }
    }
  }
}
```

### 5.6 Integration with ContentStorage

The version-aware load path adds a single sync between ContentStorage and VersionContext. When ContentStorage/load fires, a routing sync checks whether the requesting user has an active version context. If they do, the load resolves through VersionContext instead of returning the base storage value.

```yaml
# entity-lifecycle/syncs/version-aware-load.sync
sync VersionAwareLoad [eager]
when {
  ContentStorage/load: [ id: ?id ]
}
where {
  bind(flow.user as ?user)
  VersionContext: { ?ctx context_user: ?user; context_stack: ?stack }
  filter(length(?stack) > 0)
}
then {
  VersionContext/resolve_for: [ user: ?user;
                                entity_id: ?id ]
}
```

Saves work similarly. When a user in a version space saves an entity, the save is intercepted and routed to VersionSpace/write instead of the base ContentStorage. The override is stored in the version space; the base entity is not modified.

```yaml
# entity-lifecycle/syncs/version-aware-save.sync
sync VersionAwareSave [eager]
when {
  ContentStorage/save: [ id: ?id; data: ?fields ]
}
where {
  bind(flow.user as ?user)
  VersionContext: { ?ctx context_user: ?user; context_stack: ?stack }
  filter(length(?stack) > 0)
  bind(resolve_applicable_space(?stack, ?id) as ?space)
}
then {
  VersionSpace/write: [ space: ?space;
                        entity_id: ?id;
                        fields: ?fields ]
}
```

Queries are version-aware through SearchSpace overlay indexes. The Query concept routes search through SearchSpace with the user's active version space as the scope (§5.6.1). SearchSpace merges the base index with the scope's overlay: overlay entries win for entities modified in the space, tombstones exclude entities deleted in the space, and entities created only in the space appear from the overlay. Field values on matched entities are resolved through VersionContext to apply overrides. This means queries always return what the user would see in their current reality — including content that exists only in their version space.

#### 5.6.1 Version-space lifecycle: what fires and what doesn't

The VersionAwareSave sync intercepts ContentStorage/save before it completes. The save never reaches base ContentStorage, so the seven entity-lifecycle syncs (§2.1.2) — cache invalidation, search indexing, URL alias generation, provenance tracking, backlink reindexing, cascade deletion, and date-field daily note references — never fire for version-space edits. This is intentional. Walking through each:

**Cache invalidation — fires, but scoped.** The user in the version space needs to see their own edits. But invalidating the global cache would force rebuilds for users who aren't in that space and wouldn't see the change. One additional sync fires on VersionSpace/write completions, invalidating only cache entries tagged with the space ID:

```yaml
sync VersionSpaceWriteInvalidatesCache [eventual]
when {
  VersionSpace/write: [ space: ?space;
                        entity_id: ?id ] => [ ok: _ ]
}
then {
  Cache/invalidateByTags: [ tags: { space: ?space, type: ?type } ]
}
```

**Search, backlinks, and embeddings — SearchSpace overlay indexes.** The global SearchIndex, Backlink index, and SemanticEmbedding index all reflect base reality. Entities created in a version space don't exist in any base index — a user who creates a new page in "Hypothesis A" and searches for it would get nothing. Rather than coupling each index concept to version-space awareness, a single new concept handles all scoped overlay indexing.

**SearchSpace** is a coordination concept with providers. It maintains scoped overlay indexes — small, ephemeral indexes that layer on top of base indexes. Each active version space gets a SearchSpace scope. The concept doesn't know what it's indexing (text, links, embeddings); providers handle the index type. SearchSpace knows about scopes, overlays, and merge-at-query-time.

```
@version(1)
concept SearchSpace [S] {

  purpose {
    Maintain scoped overlay indexes that layer on top of base search
    indexes, enabling version spaces, groups, and tenants to have
    independent search state without polluting shared indexes.
  }

  state {
    scopes: set S
    scope_id: S -> String           // version space ID, group ID, tenant ID
    scope_type: S -> String         // "version_space", "group", "tenant"
    scope_parent: S -> option S     // for nested scopes (recursive version spaces)
    
    entries {
      index_entries: set S
      entry_scope: S -> S
      entry_provider: S -> String   // which index provider ("text", "backlink", "embedding")
      entry_entity_id: S -> String
      entry_operation: S -> { index | tombstone }
      entry_data: S -> String       // provider-specific indexed data
    }
  }

  actions {
    action index(scope_id: String, provider: String,
                 entity_id: String, data: String) {
      -> ok(entry: S) {
        Indexes an entity in the scoped overlay. Plugin-dispatched to the
        provider for actual index structure maintenance. The entry stores
        only the delta — the base index is not modified.
      }
    }

    action tombstone(scope_id: String, provider: String,
                     entity_id: String) {
      -> ok(entry: S) {
        Marks an entity as absent in this scope. At query time, tombstones
        filter out base index results for this entity.
      }
    }

    action query(scope_id: String, provider: String,
                 query_expr: String) {
      -> ok(results: list String) {
        Queries the base index (delegated to the provider's base query)
        and merges with the scope's overlay: overlay entries win for
        entities in both, tombstones exclude base entries, scope-only
        entries are injected. For nested scopes, walks the scope chain
        and merges at each level (most specific wins).
      }
      -> no_scope(scope_id: String) {
        The scope does not exist. Fall through to base-only query.
      }
    }

    action clear(scope_id: String) {
      -> ok() {
        Removes all overlay entries for this scope. Called when a version
        space is archived, merged, or promoted.
      }
    }

    action materialize(scope_id: String) {
      -> ok(count: Int) {
        Writes all overlay entries to their respective base indexes and
        clears the scope. Called when a version space is promoted to base
        or merged. Each entry dispatches to its provider's base-index
        write action.
      }
    }
  }
}
```

**Providers (via PluginRegistry):**

| Provider | Base index concept | What it indexes | Overlay data |
|----------|-------------------|-----------------|-------------|
| `text` | SearchIndex | Full-text content for search | Tokenized text + field values |
| `backlink` | Backlink | Forward/reverse link references | Link source → target pairs |
| `embedding` | SemanticEmbedding | Vector embeddings for similarity | Embedding vectors |

Each provider knows how to: (1) maintain its index structure for overlay entries, (2) query the base index concept, (3) merge base results with overlay results, and (4) materialize overlay entries into the base index.

**Sync wiring for version spaces:**

```yaml
# Index modified/created entities in the space's overlay
sync VersionSpaceWriteIndexes [eventual]
when {
  VersionSpace/write: [ space: ?space;
                        entity_id: ?id ] => [ ok: _ ]
}
then {
  SearchSpace/index: [ scope_id: ?space; provider: "text";
                       entity_id: ?id;
                       data: ?resolved_content ]
  SearchSpace/index: [ scope_id: ?space; provider: "backlink";
                       entity_id: ?id;
                       data: ?extracted_links ]
  SearchSpace/index: [ scope_id: ?space; provider: "embedding";
                       entity_id: ?id;
                       data: ?computed_embedding ]
}

# Tombstone deleted entities in the space's overlay
sync VersionSpaceDeleteTombstones [eventual]
when {
  VersionSpace/delete_in_space: [ space: ?space;
                                  entity_id: ?id ] => [ ok: _ ]
}
then {
  SearchSpace/tombstone: [ scope_id: ?space; provider: "text";
                           entity_id: ?id ]
  SearchSpace/tombstone: [ scope_id: ?space; provider: "backlink";
                           entity_id: ?id ]
  SearchSpace/tombstone: [ scope_id: ?space; provider: "embedding";
                           entity_id: ?id ]
}

# When promoting to base, materialize all overlays
sync PromoteMaterializesSearchSpace [eager]
when {
  VersionSpace/promote_to_base: [ space: ?space ] => [ ok: _ ]
}
then {
  SearchSpace/materialize: [ scope_id: ?space ]
}

# When archiving, clear the overlay
sync ArchiveClearsSearchSpace [eventual]
when {
  VersionSpace/archive: [ space: ?space ] => [ ok: _ ]
}
then {
  SearchSpace/clear: [ scope_id: ?space ]
}
```

**Generality beyond version spaces.** SearchSpace is not version-space-specific. The same concept handles:

- **Group-scoped search.** The Group concept (Collaboration suite) could create a SearchSpace scope for each group, indexing group-private content. Users searching within a group query SearchSpace with the group's scope ID, seeing group content merged with the global index.
- **Tenant isolation.** A multi-tenant deployment could create a SearchSpace scope per tenant, ensuring tenant data only appears in that tenant's search results (via tombstones on other tenants' content).
- **Preview/staging.** A staging environment could use SearchSpace to show how search results would change after a batch import, without touching the production index.

The related zone's "Links and backlinks" section (§3.1) queries through SearchSpace with the user's active version space as the scope — so it correctly reflects version-space link additions and removals. The "Similar entities" section does the same with the embedding provider. No concept other than SearchSpace needs to know about version spaces, groups, or tenants.

**URL alias generation — namespaced via sync on Alias, not via Pathauto.** Pathauto generates aliases without knowing about namespaces, version spaces, groups, or tenants. It calls `Alias/create(entity, path)` and is done. The namespace is stamped onto the alias *after* creation by a version-space integration sync that fires on `Alias/create` and reads the active context from the flow. These syncs live here in the version-space integration layer, not in the entity-lifecycle suite — they fire on Alias actions, not ContentStorage completions.

The Alias concept (Linking suite) gains a `namespace` field on its own state — an opaque string, not a reference to any other concept. Alias stores it; Alias doesn't interpret it. Base aliases have namespace `null` (the global namespace).

Two syncs handle namespacing. Neither lives in Pathauto — they're in the entity-lifecycle suite:

```yaml
# Stamp namespace onto aliases created within a version space
sync AliasStampVersionSpaceNamespace [eager]
when {
  Alias/create: [ entity: ?entity; path: ?path ] => [ ok: ?alias ]
}
where {
  bind(flow.user as ?user)
  VersionContext: { ?ctx context_user: ?user; context_stack: ?stack }
  filter(length(?stack) > 0)
  # Get the innermost active space
  bind(last(?stack) as ?space)
}
then {
  Alias/setNamespace: [ alias: ?alias; namespace: ?space ]
}

# Resolve aliases through the user's active namespace chain
sync AliasResolveWithNamespace [eager]
when {
  Alias/resolve: [ path: ?path ]
}
where {
  bind(flow.user as ?user)
  VersionContext: { ?ctx context_user: ?user; context_stack: ?stack }
  # Try the most specific namespace first, then walk outward
  Alias: { ?alias path: ?path; namespace: ?ns }
  filter(?ns in ?stack OR ?ns == null)
  # Pick the most specific match
  bind(most_specific(?alias, ?stack) as ?best)
}
then {
  Alias/resolve: [ alias: ?best ]
}
```

Pathauto doesn't know namespaces exist. Alias doesn't know what a VersionContext is. The sync wires them together. The flow context (`flow.user` → VersionContext lookup) provides the namespace. This is the standard Clef pattern: concepts are independent, syncs coordinate.

When Pathauto generates an alias inside a version space (because VersionSpaceWriteGeneratesAlias fires Pathauto after a space write), the alias is created normally, then the AliasStampVersionSpaceNamespace sync fires on the Alias/create completion and stamps the space ID. When Pathauto generates an alias in base (the standard SaveGeneratesAlias sync), no VersionContext exists for the user, the where clause fails, and the alias keeps namespace `null`.

Resolution: when a user in "Hypothesis A" hits `/articles/my-article`, the AliasResolveWithNamespace sync checks namespaces in stack order — the space ID first, then `null`. If the space has an alias for that path, it wins. If not, the base alias serves.

When a space is promoted to base, the promote sync updates the space's aliases to namespace `null` (replacing base aliases for the same paths). When a space is archived, its aliases are cleared.

The version-space Pathauto sync itself also stays clean — it just triggers normal Pathauto alias generation without any namespace parameter:

```yaml
sync VersionSpaceWriteGeneratesAlias [eventual]
when {
  VersionSpace/write: [ space: ?space;
                        entity_id: ?id ] => [ ok: _ ]
}
where {
  Schema/getSchemasFor: [ entity_id: ?id ] => [ ok: ?schemas ]
  Pathauto: { ?pattern schema_name: ?schema }
  filter(?schema in ?schemas)
}
then {
  Pathauto/generateAlias: [ schema: ?schema;
                            entity_id: ?id;
                            namespace: ?space ]
}
# The AliasStampVersionSpaceNamespace sync then fires on
# the Alias/create that Pathauto produces, stamping the namespace.
```

**Namespaces beyond version spaces.** The `namespace` field on Alias is an opaque string. Other sync suites can stamp other namespace values using the same pattern — a sync that fires on Alias/create and stamps a group ID, tenant ID, or locale code based on the flow context. The same resolution sync walks the user's active context stack (VersionContext, group membership, tenant, locale) to pick the most specific matching alias. Additional stamp syncs are integration syncs in their respective suites (Collaboration suite for groups, a multi-tenant suite for tenants, the Content suite for locale). Each stamps independently; resolution merges all applicable namespaces into a single fallback chain.

**Provenance tracking — handled by VersionSpace's own state.** Each override in VersionSpace carries `override_at` timestamps and the space's membership state records who made changes. Full Provenance records are created when overrides merge into base — the merge action writes to base ContentStorage, triggering SaveTracksProvenance.

**Cascade deletion — not applicable.** `delete_in_space` creates a tombstone override, not an actual deletion. No cascading needed — the entity still exists in base. When a space with deletions is merged or promoted, the merge writes actual deletions to base ContentStorage, triggering DeleteCascades.

**Daily note references — handled through SearchSpace.** When a user in a version space sets a date field or saves a ContentNode (which updates its `updated_at` DateTime field), the date-to-daily-note references should exist within that space's reality but not pollute the base daily notes. The VersionSpaceWriteIndexes sync (above) already feeds VersionSpace/write completions into SearchSpace's backlink provider. The date-field references are Reference entries, which Backlink tracks. So they flow into the space's SearchSpace overlay automatically — the daily note for March 6, when viewed from within "Hypothesis A," shows ContentNodes with date fields pointing to March 6 from that space's edits. When the space is promoted or merged, SearchSpace/materialize writes these references to the base Backlink index, and they appear on the base daily notes.

### 5.7 Merge and conflict resolution

Merging a version space into its target follows a per-entity, per-field conflict resolution model. The Merge concept from the Versioning suite and the ConflictResolution concept from the Collaboration suite provide the infrastructure; VersionSpace adds the entity-level orchestration.

For each override in the source space:

1. **Clean merge (no conflict).** The target entity's field has not changed since the fork point. The override applies directly. This is the common case — most entities in a version space were not also modified in the target.

2. **Auto-resolvable conflict.** Both the source space and the target modified the same entity, but on different fields. The `field_merge` conflict resolver handles this: non-overlapping field changes merge cleanly, producing an entity that incorporates both sets of changes.

3. **True conflict.** Both the source space and the target modified the same field on the same entity. The configured conflict resolver determines the outcome. Available strategies (via PluginRegistry on VersionSpace):
   - `source_wins`: the version space's value takes precedence
   - `target_wins`: the target's value takes precedence
   - `manual_queue`: both values are presented to a reviewer in a merge UI, with a diff showing the fork-point value, the source change, and the target change
   - `three_way_merge`: for rich text fields (content pages, block bodies), the Diff and Merge concepts from the Versioning suite produce a three-way merge using the fork-point content as the common ancestor
   - `llm_merge`: an LLMCall asks a language model to synthesize both versions into a coherent result (with human review before acceptance)

4. **Created entities.** Entities that exist only in the source space are materialized in the target — they become real base entities (or real entities in the target space, if merging into another space rather than base).

5. **Deleted entities.** Entities marked as deleted in the source space are removed from the target. If the target also modified the entity (not just left it unchanged), this is flagged as a conflict for manual review.

Merging is recursive: if the source space has sub-spaces, those sub-spaces' overrides are flattened into the source space before merging into the target. A sub-space override for entity X takes precedence over the parent space's override for entity X (the innermost version wins within the source).

### 5.8 Inter-space sync, cherry-pick, rebase, and promoting to base

Merge is one-directional and terminal — the source space ends up in `status=merged` and is done. The following operations cover the cases where you want to keep spaces alive while exchanging changes between them, or wholesale swap what "base" means.

#### 5.8.1 Syncing between sibling version spaces

`sync_spaces` keeps two parallel realities partially aligned without collapsing either. This is the mechanism for cases like: "two research teams are exploring different hypotheses, but they agree on methodology improvements and want those shared."

In one-directional sync (`a_to_b`), all overrides in space A that space B lacks are copied into B as new overrides. B's existing overrides are untouched. A is unchanged. In bidirectional sync, changes unique to each side flow to the other, and true conflicts (same entity, same field, different values in both spaces) go through the conflict resolver.

The sync uses the `fork_point` state to determine what's new. If space A and space B share a common ancestor (they were both forked from the same parent), the common ancestor's state at fork time is the baseline. Changes in A since the ancestor that don't exist in B flow to B, and vice versa. If the spaces share no common ancestor (forked from different parents or different points in base history), the sync computes a diff between each space's resolved state and identifies non-overlapping changes.

After sync, both spaces remain active with their own identities. Users in space A see A's resolved state (now including B's non-conflicting changes). Users in space B see B's resolved state (now including A's non-conflicting changes). Neither space is merged or archived.

#### 5.8.2 Cherry-picking individual entities

`cherry_pick` is the surgical version of sync — pull a single entity's override from one space into another. This enables browsing a colleague's version space, finding a specific change you like, and pulling just that change into your own space.

The cherry-pick workflow in the UI: navigate to a version space (you can browse any public or shared space you have access to), find an entity that differs from your current reality (entities with overrides show the version-diff affordance), and choose "pull into my space." The override is copied — the source space is never modified.

If your space already has an override for that entity, the cherry-pick surfaces a three-way diff: the common ancestor value, the source space's value, and your space's value. You choose how to resolve, or use the configured conflict strategy.

Cherry-pick also works recursively for sub-entities. Cherry-picking a page that has been modified in the source space also offers to pull the page's block-level overrides (child entities within the page's outline tree). You can accept the whole subtree or pick individual blocks.

#### 5.8.3 Rebasing against an evolved base

Long-lived version spaces can drift from base. `rebase` pulls base changes into the space without terminating the space. It recalculates the space's overrides relative to the current base:

1. Compute the diff between the old fork point and the current base state
2. For each base change, check if the space has an override for that entity
3. If no override exists: the base change flows through automatically (the space already sees base for non-overridden entities, so nothing to do — just update the fork point)
4. If an override exists and it matches the new base value: the override is **dissolved** (it's now redundant — the base independently arrived at the same value)
5. If an override exists and it conflicts with the base change: flag as a rebase conflict for resolution

After rebase, the space's `fork_point` is updated to the current base content hash. The space remains active. Users in the space see the same resolved state they saw before for overridden entities, plus any new base changes for entities they hadn't overridden. Dissolved overrides reduce the space's storage footprint.

Rebase is particularly important after a `promote_to_base` event (§5.8.4), since all active spaces need to recalculate their overrides against the new base.

#### 5.8.4 Promoting a version space to base reality

`promote_to_base` is the most consequential operation in the version space system. It does not merge individual overrides into base — it replaces base entirely with the promoted space's resolved state. The old base is preserved as a historical snapshot so it can be examined or even restored.

The lifecycle of a base promotion:

**Step 1 — Snapshot the current base.** A content-addressed snapshot of the current base state is stored in `base_history`. This snapshot is a point-in-time record: every entity's field values as they exist in base right now. The snapshot gets an auto-generated label ("Base before promotion of 'Redesign 2026' — 2026-03-06T14:30:00Z") and the ID of the space being promoted. This snapshot is itself a read-only version space — you can `enter` it to browse what base used to look like.

**Step 2 — Materialize the promoted space.** The promoted space's full resolved state (walking the complete override chain from the space through its ancestry to the old base) is computed and written to base storage. Every override is applied. Entities created in the space become real base entities. Entities deleted in the space are removed from base.

**Step 3 — Recalculate all other active spaces.** Every active version space that was forked from the old base (or from the old base's descendants) needs its overrides recalculated against the new base. The system runs an automatic `rebase` on each active space:
- Overrides that now match the new base (because the promoted space contained the same changes) are dissolved
- Overrides that diverge from the new base are preserved as deltas against the new base
- True conflicts (the space had one value, the promoted space had a different value for the same entity) are flagged for the space owner to resolve

**Step 4 — Archive the promoted space.** The promoted space transitions to `status=merged` — its overrides are now the base, so the space itself is redundant.

**Step 5 — Notify and record.** A Provenance record logs the base swap. All users currently in base see the new reality immediately. Users in other spaces are notified that base has changed and may see rebase conflicts in their spaces.

The old base snapshot in `base_history` can be restored by promoting it back. This creates a new snapshot of the current base (which was the promoted space's content), and restores the old base. The cycle can repeat indefinitely — base_history is an append-only log of base states, each accessible as a read-only version space.

**Access control.** `promote_to_base` requires explicit authorization — by default, only users with the admin role can promote a space. This can be refined through AccessControl policies: a governance workflow might require a formal proposal (via `VersionSpace/propose`), votes from stakeholders (via the Governance Kit if installed), and admin approval before promotion proceeds.

#### 5.8.5 Summary of space-to-space operations

| Operation | Direction | Source survives? | Target modified? | Use case |
|-----------|-----------|-----------------|-----------------|----------|
| `merge` | source → target | No (becomes `merged`) | Yes (gains overrides) | "We're done — apply our changes" |
| `sync_spaces` | A ↔ B or A → B | Both survive | Both gain changes | "Keep parallel realities partially aligned" |
| `cherry_pick` | source → target (one entity) | Yes (unchanged) | Yes (gains one override) | "Pull just this change into my version" |
| `rebase` | base → space | Yes (refreshed) | Space's overrides recalculated | "Pull in base evolution, keep my changes" |
| `promote_to_base` | space → base | No (becomes base) | Base is replaced entirely | "This version IS the new canonical reality" |

### 5.9 Version-aware automations

The AutomationRule concept gains a `version_scope` property that determines how the rule interacts with version spaces. This is a field on the AutomationRule config entity, configurable in the admin UI.

**`base` scope (default).** The automation operates only on the base version. Changes made within version spaces do not trigger base-scoped automations. When the automation modifies an entity, the modification happens in base. This is the safe default — automations like "send notification when article is published" should only fire for the canonical reality.

**`current` scope.** The automation operates within whatever version space the triggering user is in. If Alice publishes an article within "Hypothesis A", a current-scoped notification rule fires and sends a notification to "Hypothesis A" members — but not to base-reality users. Modifications happen within the triggering space. This enables version-space-specific workflows: "when a page in this space is marked 'ready for review', notify the space owner."

**`all` scope.** The automation runs across every active version space (and base) independently. A data quality check configured with `all` scope validates every version of every entity, regardless of which space it was modified in. This is expensive — it multiplies execution by the number of active spaces — and is intended for cross-reality consistency checks, not for high-frequency rules.

**`propagate` scope.** The automation runs in base, and the result is automatically overridden into all active version spaces that haven't already overridden the affected entity. A background enrichment job (auto-tagging, AI field extraction) configured with `propagate` scope enriches the base entity and pushes those enrichments through to all version spaces where the entity hasn't been independently modified. This keeps version spaces current with base-reality improvements without overwriting intentional divergences.

```yaml
# entity-lifecycle/syncs/automation-version-dispatch.sync
sync AutomationVersionDispatch [eager]
when {
  AutomationRule/triggered: [ rule: ?rule; event: ?event; user: ?user ]
}
where {
  AutomationRule: { ?rule version_scope: ?scope }
}
then {
  # scope = "base": execute against base only
  # scope = "current": resolve user's VersionContext, execute in that space
  # scope = "all": enumerate all active spaces, execute in each
  # scope = "propagate": execute in base, then push to non-overridden spaces
  AutomationDispatch/dispatch: [ rule: ?rule; event: ?event;
                                  version_scope: ?scope; user: ?user ]
}
```

### 5.10 Surface integration: widgets for version spaces

Every UI surface the version spaces system needs was audited against the existing Surface widget library (~30 interactor types, ~40 affordance declarations). Most version-space UIs compose from existing primitives. Three new interactor types and seven new widgets are needed. No new Surface concepts are required — everything fits within the existing Interactor/Affordance/WidgetResolver pipeline.

#### 5.10.1 Composed from existing widgets (no new specs)

**Version space browser.** The main list of spaces a user can see (their own, shared, public). This is a standard entity list rendered through the existing View concept with a DisplayMode configured for VersionSpace entities. Fields like name, status, visibility, member count, and override count map to existing interactor types: `display-text`, `display-badge`, `display-status`. The "Fork new space" button is `action-primary`. Filter controls (by status, by visibility, by owner) are standard `ExposedFilter` widgets. Nothing new needed.

**Space creation form.** Name (text-short), parent space (single-pick entity reference), scope entity (single-pick entity reference), visibility (single-choice with 3 options → radio-group or segmented). All existing interactor types and affordances. The entity-reference fields use the standard selection plugin mechanism from §2.5.

**Rebase progress and result view.** Shows dissolved overrides, preserved overrides, and conflicts after a rebase. This composes from `display-progress` (overall progress bar), `group-repeating` (list of overrides), `display-badge` (dissolved/preserved/conflict status per override), and `action-primary`/`action-danger` for conflict resolution buttons. All existing.

**Promote-to-base confirmation.** A high-stakes destructive action confirmation. The confirmation dialog is a standard `group-section` with `display-text` for the impact summary ("This will replace base reality with 47 changes across 12 Schemas. 3 active version spaces will need rebase."), `display-number` for counts, and `action-danger` for the confirm button. All existing — this is a composition, not a new widget.

**Space membership management.** Adding/removing members and setting roles. Standard `multi-pick` (user selection) + `single-choice` (role: owner/editor/viewer per member) + `repeating-group` (member list). All existing.

**Cherry-pick entity list.** When cherry-picking from a source space, the UI shows overridden entities with checkboxes for selection. This is a standard `multi-choice` interactor over a filtered entity list. The entity list comes from `VersionSpace/diff`, rendered through the existing View concept. The "Pull selected into my space" button is `action-primary`. All existing.

**Space sync direction picker.** Choosing A→B, B→A, or bidirectional for `sync_spaces`. This is `single-choice` with 3 options — the `radio-card` affordance (specificity 12, maxOptions: 4, comparison: true) handles this naturally. Custom label rendering for the directional arrows can use the existing `radio-card` widget's slot system (each card has a Slot for custom content). No new widget needed.

#### 5.10.2 New interactor types

Three new entries in the Interactor standard library:

**`context-stack`** (category: navigation). Represents a layered stack of active contexts that the user can navigate, enter, or leave. Properties: `{ stackable: true, maxDepth: "unbounded", navigable: true, dismissable: true }`. This captures the version context indicator pattern but is reusable for any stacked navigation context — feature flags, A/B test variants, permission simulation, preview modes.

**`diff-view`** (category: output). Represents a comparison between two or three versions of the same entity or field, showing what changed. Properties: `{ wayCount: 2 | 3, granularity: "field" | "line" | "character", interactive: boolean }`. Two-way diffs compare current vs. previous; three-way diffs add the common ancestor for merge conflict resolution. The `interactive` property determines whether the user can resolve conflicts inline (choose left/right/both per hunk) or just view the diff.

**`overlay-indicator`** (category: output). Represents a small visual marker that decorates another widget to convey additional state — specifically, that the underlying entity or field has been modified in the current version space. Properties: `{ position: "corner" | "border" | "inline", semantic: "modified" | "created" | "deleted" | "conflict" }`. This is the "colored dot on overridden entities" pattern, but generalized so it can also indicate draft status, unsaved changes, or sync conflicts.

#### 5.10.3 New widget specs and affordance declarations

Seven new `.widget` files, each declaring anatomy, states, and affordances:

**`context-breadcrumb.widget`** — Serves `context-stack` on desktop/tablet. Anatomy: a horizontal bar with stacked context chips, each showing the space name and a dismiss button, plus a dropdown trigger for switching to sibling spaces. The rightmost chip is the most specific active space. States: collapsed (show only the deepest space name + depth count), expanded (show full stack). Affordance: `context-breadcrumb → context-stack [specificity: 10] when platform: "desktop" | "tablet"`.

**`context-badge.widget`** — Serves `context-stack` on mobile and watch. Anatomy: a compact floating badge showing the deepest space name with a color tint. Tapping expands to the full stack as a bottom sheet (mobile) or scrollable list (watch). Affordance: `context-badge → context-stack [specificity: 10] when platform: "mobile" | "watch"`.

**`context-bar.widget`** — Serves `context-stack` as a persistent Shell chrome bar. Anatomy: a full-width bar below the navigation header with the space name, visibility icon, nesting breadcrumb, and quick-action buttons (leave space, switch space, view diff from base). Color-coded by space status (active: accent color, proposed: amber, archived: gray). This is the primary reality indicator. Affordance: `context-bar → context-stack [specificity: 15] when placement: "shell-chrome"` (highest specificity wins when the Shell chrome region requests a context-stack widget).

**`diff-inline.widget`** — Serves `diff-view` for field-level and line-level diffs. Anatomy: a single column showing the merged content with insertions highlighted in green and deletions in red (struck through). For three-way diffs, ancestor content that was changed by both sides gets a conflict marker. Interactive mode adds accept/reject buttons per hunk. Affordance: `diff-inline → diff-view [specificity: 8] when viewport: "compact" | granularity: "line"`.

**`diff-side-by-side.widget`** — Serves `diff-view` for field-level diffs on wide viewports. Anatomy: two (or three) columns showing the source version, the target version, and optionally the common ancestor. Changed fields are highlighted; matching fields are dimmed. For entity-level diffs, each row is a field; for rich text diffs, each row is a paragraph or block. Interactive mode adds "use left" / "use right" / "use both" controls per field. Affordance: `diff-side-by-side → diff-view [specificity: 12] when viewport: "wide", granularity: "field"`.

**`diff-unified.widget`** — Serves `diff-view` for character-level diffs. Anatomy: a single column with character-level change highlighting (word diff). For code blocks and formulas where character-level precision matters. Affordance: `diff-unified → diff-view [specificity: 10] when granularity: "character"`.

**`override-dot.widget`** — Serves `overlay-indicator`. Anatomy: a small colored circle positioned at the top-right corner of the decorated widget. Color encodes semantic: blue for modified, green for created, red for deleted, amber for conflict. Hovering shows a tooltip with "Modified in [space name] — click to view diff." Clicking triggers the `diff-view` interactor for this entity. Affordance: `override-dot → overlay-indicator [specificity: 10]`.

#### 5.10.4 New layout compositions

Two new compositions combine existing and new widgets into purpose-built panels. These are not new concepts — they are derived UI patterns assembled from existing Surface primitives using the Layout Component concept and the UISchema composition mechanism.

**Merge resolution panel.** A layout that combines: a `diff-side-by-side` or `diff-inline` widget showing the conflict, a `single-choice` widget for selecting a resolution strategy (source wins / target wins / manual edit / LLM merge), a preview area showing the resolved result (using `display-text` or the entity's standard `DisplayMode`), and `action-primary` / `action-secondary` buttons for "Accept resolution" and "Skip to next conflict." The panel iterates through all conflicts from a `VersionSpace/merge` or `VersionSpace/rebase` result.

The UISchema for this panel:

```yaml
# merge-resolution-panel.uischema
layout: vertical
children:
  - element: diff-view
    interactor: diff-view
    props:
      wayCount: 3
      granularity: field
      interactive: true
      source: $conflict.source_value
      target: $conflict.target_value
      ancestor: $conflict.fork_point_value
  - element: strategy-picker
    interactor: single-choice
    props:
      options: [source_wins, target_wins, manual_edit, three_way_merge, llm_merge]
      default: three_way_merge
  - element: result-preview
    interactor: display-text
    props:
      value: $resolved_preview
  - layout: horizontal
    children:
      - element: accept
        interactor: action-primary
        props: { label: "Accept" }
      - element: skip
        interactor: action-secondary
        props: { label: "Next conflict" }
```

**Version comparison panel.** A layout for browsing how the same entity looks in two different version spaces (or a space vs. base). Two entity detail views rendered side-by-side, each resolved through a different VersionContext. The panel header shows which space each side represents, with a swap button. Fields that differ are highlighted using `overlay-indicator` on each field. This is composed from two instances of the entity's standard `DisplayMode` view, each with a VersionContext override parameter injected via UISchema props.

#### 5.10.5 Summary: Surface impact

| Category | Count | Items |
|----------|-------|-------|
| New interactor types | 3 | `context-stack`, `diff-view`, `overlay-indicator` |
| New `.widget` specs | 7 | context-breadcrumb, context-badge, context-bar, diff-inline, diff-side-by-side, diff-unified, override-dot |
| New affordance declarations | 7 | One per widget, binding to the 3 new interactor types |
| New layout compositions | 2 | Merge resolution panel, version comparison panel |
| New Surface concepts | 0 | All fits within existing Interactor/Affordance/WidgetResolver pipeline |
| Existing widgets reused | ~15 | display-badge, display-status, display-text, display-progress, radio-card, radio-group, action-primary, action-danger, multi-choice, single-choice, group-repeating, group-section, fieldset, tabs, text-short |

### 5.11 History and version spaces as complementary systems

Version spaces (parallel realities) and version history (linear change log) are independent, complementary systems. Both operate through the Versioning suite, but at different levels.

**Version history** — powered by TemporalVersion (Versioning suite) — tracks every change to every ContentNode as an append-only temporal record. Each record captures the ContentNode's field values at the time of the save, timestamped with the ContentNode's system-managed `updated_at` field (§2.4.1) as system time and an optional `valid_time` (when the change is considered effective — defaults to system time, but can be backdated for data corrections). This gives you point-in-time queries ("show me the article as it was on March 1st" — find the record whose `valid_time` bracket contains March 1st), audit trails ("who changed this field and when" — each record inherits `created_by` from the save's flow context), and rollback ("undo the last 3 changes to this entity" — restore the field snapshot from 3 records ago). History operates within a single reality: base has its history, and each version space has its own independent history of overrides.

**Version spaces** — powered by VersionSpace — give you parallel presents, not sequential pasts. You fork a space, make changes, and those changes coexist alongside the base reality. Merging a space into base creates history entries (the merge itself is a recorded event in TemporalVersion), but the two systems are decoupled.

The combination is powerful: within "Hypothesis A", Alice can view the history of changes made in that space, roll back a specific override without affecting other overrides, and compare the current state of the space to its state at the fork point. Cross-reality history queries are also possible: "show me all changes to this entity across all version spaces in the last week" uses TemporalVersion's query with a version-space filter to produce a complete activity view.

---

## 6. The dual-manifest Bind architecture

Every Clef Base application generates **two Bind manifests** — two complete interface specifications that produce independent but complementary interface targets.

### 6.1 The config manifest (developer-facing)

The config manifest covers all config entities and developer-facing concepts: content type definitions, field configurations, schema management, view builder, workflow definitions, automation rule management, theme settings, deployment configuration, concept registry, suite management, bind target configuration, and Score graph navigation.

From this manifest, Bind generates:

- A **config CLI** for developers, with subcommand groups mirroring the config entity hierarchy (`clef config content-type list`, `clef config field add`, `clef config workflow export`)
- A **config REST API** for programmatic administration, with an OpenAPI spec
- A **config MCP server** for AI-assisted administration, with tool definitions for every config action
- A **config GraphQL schema** for rich admin UIs
- An **admin SDK** in the configured languages
- A `.claude` directory with a `CLAUDE.md` file describing the project's architecture, concept inventory, and available admin operations — plus equivalent files for Gemini and Codex (`GEMINI.md`, `CODEX.md`)
- Claude Skills definitions for common admin workflows

### 6.2 The content manifest (user-facing)

The content manifest covers all content entities and user-facing concepts: content CRUD, content pages, queries, views, taxonomy navigation, comments, media management, search, user profiles, and application-specific domain concepts.

From this manifest, Bind generates:

- A **content CLI** for power users and automation scripts
- A **content REST API** with an OpenAPI spec
- A **content MCP server** for AI-assisted content operations
- A **content GraphQL schema** for rich user-facing UIs
- A **user SDK** in the configured languages
- Claude Skills for common content workflows

### 6.3 Custom manifests via UI

Beyond the two default manifests, users can create new Bind manifests through the admin UI. This is not a raw file editor — it is a structured interface that lets you:

- Select which concepts to include in the manifest
- Configure how concepts group into API resource collections, CLI subcommand trees, MCP tool groups, or GraphQL namespaces (using the Grouping concept from the Interface suite)
- Set per-concept interface metadata: authentication requirements, rate limits, pagination strategies, field visibility (using the Projection and Middleware concepts)
- Define action sequences for documentation and onboarding (using the ActionGuide concept)
- Preview the generated interface in each target format before committing
- Compose manifests from other manifests, creating layered API surfaces (a public API manifest that exposes a subset of the content manifest, a partner API manifest that adds specific integration endpoints)

Each custom manifest produces its own complete set of interface targets — CLI, REST, MCP, GraphQL, SDK, OpenAPI spec, Skills — all generated by Bind from the manifest definition.

---

## 7. Deployment targets and cross-platform rendering

### 7.1 Web: Next.js with per-page rendering strategy

The default web deployment target is Next.js on Vercel. The platform provides a single Next.js application where each page's rendering strategy is configurable via Schema "RouteConfig" — a config-manifest Schema applied to ContentNodes that represent routes:

- **SPA (Single-Page Application):** Client-side rendering, full interactivity, no server round-trips after initial load. For dashboards, admin interfaces, interactive editors.
- **Pure static (SSG):** Pre-rendered at build time. For marketing pages, documentation, blogs.
- **Hydrated (SSR + hydration):** Server-rendered with client-side interactivity. For content pages that need SEO plus interactivity.
- **Pure server (RSC):** React Server Components, no client JavaScript. For data-heavy pages where interactivity is minimal.
- **Pure in-browser:** No server at all; runs entirely in the browser via WASM or service worker. For offline-capable views.

The rendering strategy is a field on Schema "RouteConfig" — changeable in the admin UI without touching code. Surface's FrameworkAdapter concept handles the translation from headless widget specs to React components. The existing React adapter in surface-render already does this; the Next.js deployment target adds route configuration and build-time generation.

### 7.2 Phone: Android native, offline-first

The mobile deployment target produces an Android-native app (via Jetpack Compose through Surface's Compose adapter) with an offline-first architecture. The app stores entity data locally using the Replica concept from the Collaboration suite, syncs with the server when online via the SyncPair concept from the Data Integration suite, and resolves conflicts through the ConflictResolution concept.

The backend for mobile can remain Next.js (API routes) or any suitable server — the Bind-generated REST/GraphQL API is the contract, not the server implementation.

iOS support follows the same pattern using Surface's SwiftUI adapter. The backend choice is independent of the frontend.

### 7.3 Desktop: native frontends, shared backend

Desktop deployment targets use platform-native frontend libraries through Surface adapters:

- **Linux:** GTK adapter (surface-render already declares this)
- **Windows:** WinUI adapter
- **macOS:** AppKit adapter (or SwiftUI adapter, sharing code with iOS)

The backend can be a local Next.js server, a local SQLite database accessed directly, or a remote API — configurable per deployment. The Env concept from the Deploy suite manages environment-specific settings.

### 7.4 Web3: Ethereum L2 data, IPFS UI

The web3 deployment target splits the application across decentralized infrastructure. The architecture has four layers — on-chain state, off-chain state, the oracle bridge between them, and the decentralized frontend — each built from existing Clef concepts wired by sync chains.

#### 7.4.1 On-chain layer: SolidityGen + ChainMonitor

Concepts that require on-chain presence declare `capabilities { requires crypto }` and `capabilities { requires persistent-storage }`. The SolidityGen framework concept generates Solidity contract interfaces from their concept specs: state fields become contract storage variables, actions become external functions, and return variants become Solidity events.

Not every concept goes on-chain. The Solidity target is a **subset** — typically ownership records, governance votes, financial transactions, and attestations whose integrity depends on decentralized consensus. The Schema for each on-chain content type marks which fields have on-chain representations (`storage: remote`) and which are off-chain only (`storage: local`). A ContentNode with Schema "GovernanceProposal" stores votes on-chain and discussion notes off-chain.

The **ChainMonitor** concept (`@gate`, from the Web3 suite) tracks transaction finality on the L2. When a transaction is submitted, ChainMonitor begins an async wait. Its action completion fires with one of three variants: `finalized` (the transaction is in a finalized block and the fraud proof window has passed), `reorged` (the block containing the transaction was reorganized — the sync chain must fire a compensating action to undo local state changes), or `timeout` (finality was not reached within the configured window).

The fraud proof platform is selected as a provider on ChainMonitor via PluginRegistry. Whether the L2 uses optimistic rollups with fault proofs (Optimism-style) or ZK rollups with validity proofs (zkSync-style) is a provider choice configured per deployment. ChainMonitor's interface is the same either way — `awaitFinality(txHash)` returns `finalized` or `reorged`, regardless of the finality mechanism underneath.

#### 7.4.2 Off-chain layer: standard Clef Base

The off-chain layer is a standard Clef Base deployment — PostgreSQL for ContentNode storage, media on IPFS (via a FileManagement stream wrapper that uses the IPFS HTTP API instead of S3), and the full Clef Base UI. This is where most user interaction happens: creating content, editing pages, running queries, managing workflows. The off-chain layer stores the complete state of every ContentNode, including fields that have on-chain representations.

The **Web3 Content** concept (from the Web3 suite) provides IPFS storage operations: pin, unpin, resolve CID, and fetch. It registers as a FileManagement stream wrapper provider, so `ipfs://` URIs work anywhere a file path works — media fields, file attachments, and static assets.

The **Wallet** concept (from the Web3 suite) handles cryptographic identity: signature verification, message signing, address derivation, and wallet connection flows. It registers as an Authentication provider, so wallet-based login works through the standard Identity suite without any auth-specific code in the web3 layer.

#### 7.4.3 The oracle bridge: SyncPair + Connector + FieldMapping

The oracle bridge is the critical piece that keeps on-chain and off-chain state consistent. It is built entirely from existing Data Integration concepts — SyncPair for bidirectional sync, Connector for protocol abstraction, FieldMapping for data shape translation — plus a new `ethereum_l2` Connector provider and a set of bridge-specific syncs.

**The `ethereum_l2` Connector provider** registers with PluginRegistry under the `connector_protocol` plugin type. It implements the standard Connector interface — `read(query)`, `write(data)`, `test()`, `discover()` — using ethers.js (or viem) to interact with the L2's JSON-RPC endpoint and deployed contracts.

```yaml
# connector provider registration
PluginRegistry.register("connector_protocol", "ethereum_l2", EthereumL2ConnectorPlugin)

# DataSource config for the L2
DataSource:
  name: "app_l2"
  uri: "https://rpc.optimism.example.com"
  credentials:
    private_key: { secret_ref: "deployer_key" }
  metadata:
    chain_id: 420
    contracts:
      governance: "0x1234..."
      ownership: "0x5678..."
      attestation: "0xabcd..."
```

**The oracle SyncPair** establishes bidirectional correspondence between off-chain ContentNodes and on-chain contract state. Each Schema that has fields marked `storage: remote` gets a SyncPair configured with the `ethereum_l2` connector on one side and the standard `sql` connector (the off-chain database) on the other.

```yaml
# Schema for an entity with on-chain fields
Schema: "GovernanceProposal"
  fields:
    # On-chain fields (stored in the governance contract)
    - proposal_id: { type: uint256, storage: remote, chain_field: "proposalId" }
    - proposer: { type: address, storage: remote, chain_field: "proposer" }
    - vote_count_for: { type: uint256, storage: remote, chain_field: "forVotes" }
    - vote_count_against: { type: uint256, storage: remote, chain_field: "againstVotes" }
    - status: { type: enum, storage: remote, chain_field: "state" }
    # Off-chain fields (stored locally)
    - title: { type: string, storage: local }
    - description: { type: richtext, storage: local }
    - discussion_thread: { type: reference, storage: local }
    - internal_notes: { type: richtext, storage: local }
    - related_proposals: { type: list<reference>, storage: local }
  associations:
    storage_backend: "federated"
    providers:
      connector_protocol: "ethereum_l2"
      field_mapper: "abi_decoder"
      conflict_resolver: "chain_wins"   # On-chain state is always authoritative
    federation_config:
      source: "app_l2"
      contract: "governance"
      cache_ttl: 15                     # L2 block time in seconds
      read_only_remote: false           # Can submit transactions
      local_fields: ["title", "description", "discussion_thread",
                     "internal_notes", "related_proposals"]
```

**The `abi_decoder` FieldMapping provider** translates between Solidity ABI-encoded data and Clef's typed data tree. It uses the contract's ABI JSON to map Solidity types to Property types: `uint256` → `Int`, `address` → `String`, `bytes32` → `Bytes`, `string` → `String`, tuple types → nested records. This provider handles both directions — decoding contract call results into entity fields, and encoding entity field updates into contract call parameters.

#### 7.4.4 Bridge sync chains

The oracle bridge operates through four sync chains that handle reading, writing, event listening, and finality tracking.

```yaml
# ─── READ: off-chain loads on-chain state ───
sync OracleReadChainState [eager]
when {
  ContentStorage/loadRequested: [ id: ?id; schema: ?schema ]
}
where {
  filter(?schema.associations.storage_backend == "federated")
  filter(?schema.associations.providers.connector_protocol == "ethereum_l2")
}
then {
  Connector/read: [ source: ?schema.federation_config.source;
                    contract: ?schema.federation_config.contract;
                    id: ?id ]
}

sync OracleDecodeResponse [eager]
when {
  Connector/read: [ source: ?source; contract: ?contract; id: ?id ]
    => [ ok: ?raw_data ]
}
where {
  filter(?source.metadata.chain_id != null)
}
then {
  FieldMapping/apply: [ data: ?raw_data; mapper: "abi_decoder";
                        contract: ?contract ]
}

# ─── WRITE: off-chain pushes state to chain ───
sync OracleWriteToChain [eager]
when {
  ContentStorage/saveRequested: [ node: ?node; schema: ?schema ]
}
where {
  filter(?schema.associations.storage_backend == "federated")
  filter(?schema.associations.providers.connector_protocol == "ethereum_l2")
  filter(NOT ?schema.federation_config.read_only_remote)
}
then {
  FieldMapping/reverse: [ data: ?node; mapper: "abi_decoder" ]
}

sync OracleSubmitTransaction [eager]
when {
  FieldMapping/reverse: [ data: ?node; mapper: "abi_decoder" ]
    => [ ok: ?encoded_data ]
}
then {
  Connector/write: [ data: ?encoded_data;
                     source: ?schema.federation_config.source;
                     contract: ?schema.federation_config.contract ]
}

sync OracleAwaitFinality [eager]
when {
  Connector/write: [ data: ?data; source: ?source; contract: ?contract ]
    => [ ok: ?tx_hash ]
}
then {
  ChainMonitor/awaitFinality: [ tx_hash: ?tx_hash; chain: ?source ]
}

# Finality success: confirm the local state
sync OracleFinalized [eager]
when {
  ChainMonitor/awaitFinality: [ tx_hash: ?tx_hash ]
    => [ finalized: ?block ]
}
then {
  Provenance/record: [ entity: ?tx_hash; activity: "chain_finalized";
                       metadata: ?block ]
}

# Finality failure: reorg detected, compensate
sync OracleReorged [eager]
when {
  ChainMonitor/awaitFinality: [ tx_hash: ?tx_hash ]
    => [ reorged: ?details ]
}
then {
  Provenance/rollback: [ batch: ?tx_hash ]
  Notification/send: [ channel: "admin"; message: "Chain reorg detected";
                       details: ?details ]
}

# ─── EVENT LISTENING: chain events update off-chain ───
# The ethereum_l2 connector provider runs a background event listener
# (via Capture subscription) that detects new contract events and
# emits them as captured items into the standard sync chain.

sync OracleEventCapture [eventual]
when {
  Capture/itemCaptured: [ item: ?event; source: ?source ]
}
where {
  filter(?source.metadata.chain_id != null)
  filter(?event.type == "contract_event")
}
then {
  FieldMapping/apply: [ data: ?event.data; mapper: "abi_decoder" ]
}

sync OracleEventToEntity [eager]
when {
  FieldMapping/apply: [ data: ?event_data; mapper: "abi_decoder" ]
    => [ ok: ?mapped ]
}
where {
  filter(?mapped.context.source == "chain_event")
}
then {
  ContentStorage/save: [ node: ?mapped; schema: ?mapped.schema ]
}

# ─── LOOP PREVENTION ───
# SyncPair's originId mechanism prevents infinite loops:
# changes that originated from a chain event carry
# originId="chain:{txHash}", and the OracleWriteToChain sync
# filters them out (skip changes that originated on-chain).
sync OracleLoopGuard [eager]
when {
  ContentStorage/saveRequested: [ node: ?node; schema: ?schema ]
}
where {
  filter(?node.originId starts_with "chain:")
  filter(?schema.associations.providers.connector_protocol == "ethereum_l2")
}
then {
  # Short-circuit: save locally only, do NOT submit to chain
  ContentStorage/saveLocal: [ node: ?node; schema: ?schema ]
}
```

#### 7.4.5 IPFS for frontend hosting

The web3 frontend deploys to IPFS as a static site. The build process is:

1. The standard Next.js build runs with `output: 'export'` producing a static site
2. The Artifact concept (Deploy suite) creates a content-addressed build artifact
3. A deploy sync pins the artifact directory to IPFS via the Web3 Content concept's `pin` action
4. The IPFS CID is published to an ENS name via Wallet's `sign` action and a resolver update transaction
5. ChainMonitor awaits finality on the ENS update
6. The frontend is accessible at `appname.eth` via any IPFS gateway

The static frontend includes the `ethereum_l2` Connector client code (ethers.js) for direct contract reads, and routes writes through the off-chain API server (which handles transaction signing via the server-side Wallet concept). Users with their own wallets can sign transactions directly from the browser, bypassing the server for write operations — the Surface Browser PlatformAdapter detects wallet availability and routes accordingly.

### 7.5 Companion devices: watches

Watch targets (Android Wear via Surface's WearCompose adapter, Apple Watch via WatchKit adapter, open-source watches) are **display and notification endpoints**, not full authoring environments. They:

- Sync with the phone and desktop apps via the SyncPair concept
- Display entity data through simplified Surface widget specs optimized for small screens
- Provide native functions: notifications (Notification concept), quick capture (voice-to-entity via Capture concept), status glances (View concept with watch-specific display modes)
- Cannot edit config entities or modify app structure

Watch apps are generated from the same concept definitions as the full apps but with a watch-specific Surface theme and a reduced Bind manifest that exposes only read and quick-action operations.

### 7.6 Unified authoring, platform-specific rendering

The critical point: the application is authored **once** in terms of concepts, syncs, derived concepts, schemas, widgets, themes, and bind manifests. The per-platform differences are:

- Which Surface adapter renders the widgets (React, Compose, SwiftUI, GTK, WinUI, Ink, WearCompose, WatchKit)
- Which PlatformAdapter handles navigation, lifecycle, and storage (Browser, Desktop, Mobile, Terminal, Watch)
- Which Bind targets generate the interface layer (REST, GraphQL, CLI, MCP)
- Which deployment target packages and ships the result (Vercel, Play Store, App Store, Flathub, IPFS)
- Which rendering strategy applies per page (for web targets)

The concept layer, the sync layer, the schema layer, and the content layer are completely platform-independent.

---

## 8. Authorization, access control, and commenting

### 8.1 Preconfigured authorization

Clef Base ships with the Identity suite (Authentication, Authorization, AccessControl, Session) preconfigured. The defaults are:

- **Role-based access control** with built-in roles: anonymous, authenticated, editor, admin. Custom roles are ContentNodes with Schema "Role" (config-manifest — managed by admins through the admin UI).
- **Three-valued access algebra** following Drupal's model: allowed, neutral, forbidden. Results compose via OR (any allowed + none forbidden = granted) for entity access and AND (all must allow) for route access. Every access result carries cacheability metadata.
- **Concept-level access** via AccessControl policies attached to concepts. These are the broadest policies ("only authenticated users can create ContentNode instances").
- **Schema-scoped access** via AccessControl policies attached to Schemas. This is how you restrict specific subtypes ("ContentNodes with Schema 'DevDoc' are viewable only by role 'developer'"). Schema-scoped policies compose with concept-level policies — both must allow. See §2.2.4 for the three-layer auth model.
- **Field-level access** via per-field visibility settings on Schema and DisplayMode configurations. Individual fields can be hidden from specific roles even when the entity is visible. Field-level access composes with field mutability (§2.4.1) — a `readonly` field is never editable regardless of role, and a `system` field is never directly settable, but both can be hidden from specific roles via field-level access.

### 8.2 Customizable and extendable

Authorization is not a black box. Because Authentication, Authorization, and AccessControl are independent concepts wired by syncs, any piece of the authorization chain can be replaced or extended:

- Swap the authentication provider (cookie, OAuth, SAML, passkey) via PluginRegistry
- Add group-scoped access (the Group concept from the Collaboration suite provides workspace-level RBAC, like Drupal's Group module)
- Add process-based authorization (the process-human suite's WorkItem concept provides task-level access control)
- Add content moderation workflows (the Workflow concept gates publication state transitions behind permission checks)

### 8.3 Universal commenting

The Comment concept (Content suite) provides threaded discussion on any entity. Its instances are ContentNodes (following the ContentNode-IS-the-entity pattern from §3.1.1) — they have Schema-governed fields, an unstructured body zone, and a related zone like any other entity. What Comment adds as a concept is domain-specific behavior: `reply` (create a child comment via Outline), `moderate` (approve, reject, or flag a comment with state transitions), `resolve` (mark a thread as resolved), and `flag` (report a comment for review). These actions have their own return variants and operational principles — "after replying to a comment, the reply appears as a child in the thread and the host entity's comment count increments."

This is the two-tier pattern described in §3.1.2. Some entity types need only Schema (Article is just fields + workflow transitions via syncs). Others need a concept for domain-specific behavior — Comment adds `reply` and `moderate`, MediaAsset adds `transcode`, View adds `execute`. The concept test is about meaningful actions with domain-specific variants — Schema gives you the data; the concept gives you the domain logic.

**How Comment attaches to hosts.** A comment References its host entity with edge label "comment_on" (a typed inline link — §2.5). Threading uses Outline parent-child hierarchy — a reply to a comment is an Outline child of that comment. No separate materialized-path threading needed.

**Schema "Commentable"** is a mixin schema (§2.4.3) that adds comment configuration fields to a host ContentNode: whether comments are enabled, whether they require approval, maximum thread depth, default display position (inline, below content, sidebar panel). The comment suite ships a `composition.yaml` that auto-applies Commentable to Article, Page, and Media ContentNodes by default — the admin can disable or modify these composition rules, or add new ones for custom Schemas. Removing Schema "Commentable" from a specific ContentNode disables commenting on that entity without deleting existing comments.

**Comment visibility** follows the three-layer auth model (§2.2.4). Schema-scoped AccessControl policies on Comment's Schema restrict who can create, view, or moderate comments. For entities accessed through the config manifest, comments require admin auth. For content-manifest entities, comments are public by default with Schema-scoped policies for finer control. Comments on a DevDoc entity inherit the DevDoc's AccessControl restrictions.

**Comments in the UI.** Comments appear in the host's related zone (the "comment_on" Reference shows up in "Links and backlinks"). For the familiar threaded-comment UX, a ComponentMapping (§3.5) for Schema "Commentable" renders the comment tree below the entity's unstructured zone — querying for Comments referencing this entity, rendered via a "comment-thread" widget with Outline-derived nesting and a reply form at each level.

---

## 9. File and media management

File and media management follows the same ContentNode + Schema + concept pattern as everything else. There are no special "file entities" or "media entities" — there are ContentNodes with file and media Schemas applied, and concepts (FileManagement, MediaAsset) that provide the domain-specific behavior.

### 9.1 Schema "File" and the FileManagement concept

Applying Schema "File" to a ContentNode makes it a file. Schema "File" defines fields: `file_data` (Bytes — the actual file content or a stream reference), `mime_type` (String), `size` (Int), `filename` (String), `stream_wrapper` (String — "public://", "private://", "s3://", "ipfs://"), `status` (temporary | permanent), and `upload_date` (DateTime).

The FileManagement concept provides behavior beyond CRUD: `upload` (receive file data and create the ContentNode with Schema "File" applied), `addUsage` / `removeUsage` (reference counting — track which other ContentNodes reference this file), and `garbageCollect` (delete temporary files and unreferenced permanent files). Stream wrappers are providers on FileManagement — each wrapper (public, private, S3, IPFS) knows how to store and retrieve file bytes for its protocol.

A file ContentNode has the full triple-zone treatment: its structured zone shows file metadata, its unstructured zone can hold documentation or notes about the file, and its related zone shows all entities that reference this file (through the "usage" References that FileManagement tracks). You can comment on a file, link to it, tag it with taxonomy terms, search for it by content or metadata.

### 9.2 Schema "Media" and the MediaAsset concept

Schema "Media" composes on top of Schema "File" (via Schema inheritance) and adds: `source_type` (local_file | image | remote_video | embedded | audio), `thumbnail` (Reference to another file ContentNode), `alt_text` (String), `caption` (RichText), and `credit` (String). Each media type (image, video, document, audio, remote_video) is a Schema that extends "Media" with type-specific fields — Schema "Image" adds `dimensions` and `focal_point`; Schema "Video" adds `duration` and `transcript_reference`; Schema "RemoteVideo" adds `embed_url` and `provider`.

The MediaAsset concept provides processing behavior: `generateThumbnail`, `transcode` (async, for video/audio), and `extractMetadata` (EXIF, duration, dimensions). MediaSource providers handle the heterogeneous asset types — a local file provider stores bytes via FileManagement, a remote video provider fetches oEmbed data from YouTube/Vimeo, an embedded provider stores an embed code.

### 9.3 Adding files and media to entities: Schema composition

Attaching file or media capability to an entity is Schema composition — the same mixin pattern described in §2.4.3.

**Schema "HasFeaturedImage"** adds a `featured_image` field (Reference to a ContentNode with Schema "Image"). Apply it to any ContentNode and it gets a featured image field. The field renders as an image upload widget in the form (Surface's Interactor classifies it as `file-attach`, the image upload widget's Affordance matches) and as a responsive image in the display. To make all articles have a featured image, create a composition rule in `composition.yaml` or through the admin UI: "when Article is applied, also apply HasFeaturedImage."

**Schema "HasAttachments"** adds an `attachments` field (list of References to ContentNodes with Schema "File", cardinality unlimited). A composition rule can auto-apply it to any content-type Schema — or admins can apply it to individual ContentNodes as needed.

**Schema "HasGallery"** adds a `gallery` field (list of References to ContentNodes with Schema "Image", with ordering). Useful for product pages, portfolios, or any entity that needs an ordered image collection.

These are not special Schemas built into the platform — they're standard mixin schemas that ship with the media suite's `schema.yaml` and `composition.yaml`. An admin can create additional media mixins through the Schema management UI. The convention is that file/media reference fields use a selection plugin (§2.5) scoped to ContentNodes with the appropriate media Schema. An "image" reference field only shows ContentNodes with Schema "Image" in its picker. A "file" reference field shows all ContentNodes with Schema "File" (which includes "Media" and all its subtypes, since Schema inheritance means an Image IS a File).

This replaces Drupal's distinction between "file fields" and "media reference fields" with a single mechanism: Schema reference fields with selection plugins. The power comes from Schema composition — any entity can gain file or media capability by applying the appropriate mixin Schema, and the fields render appropriately through Surface's Interactor → Affordance → WidgetResolver pipeline without any file-specific UI code.

---

## 10. Score UI and concept navigation

### 10.1 Full Score visualization

The Score system (the code representation and semantic query infrastructure) gets a complete UI in Clef Base. Following the composition principle from §3.6, the Score UI is not a monolithic application — it is a layout with structured areas, each rendering Views and ComponentMappings over Score data:

- **Concept graph navigator:** A structured area containing a View over all concepts in the application, rendered via a "graph-canvas" ComponentMapping that uses the Graph concept for topology and the Surface Canvas widget for rendering. Clicking a concept node navigates to its entity page (every concept is a ContentNode). Sync connections, suite memberships, and dependency relationships are References — they appear in each concept's related zone automatically.
- **Sync chain viewer:** A structured area containing a View queried from FlowTrace data, rendered via a "flow-tree" ComponentMapping. Traces show which syncs fire, which concepts are invoked, and what data flows between them — all as a tree widget with expandable nodes.
- **AST explorer:** A structured area with a View over SyntaxTree/DefinitionUnit/Symbol data for the selected file, rendered via a "tree-inspector" ComponentMapping. Symbol references and scoping via ScopeGraph are displayed as links in the related zone.
- **Dual navigation mode:** Every entity page has a "source" toggle — a Control that switches between the entity's frontend display (its Schema-driven structured zone) and its file representation (a code-view ComponentMapping showing the `.concept` spec). The toggle is a standard `single-choice` Control on the entity page's layout.
- **Schema browser (Clef Base addition):** A structured area with a View over all Schemas in the application — both concept-mapped Schemas (from `schema.yaml`) and admin-created Schemas. The **SchemaYamlScore** provider (a plugin on the Score SemanticLayer concept, registered via PluginRegistry) makes `schema.yaml` files browsable as Score entities alongside `.concept` and `.sync` files. Each Schema appears as a node in the concept graph, linked to its associated concept (if any) by a "maps_to" Reference. Schema fields appear as child nodes with their type, mutability, and constraint metadata. The schema browser shows: which fields map to which concept state fields (`from:` mapping), which fields are operational (unmapped), which Schemas share fields through inheritance (`extends:`), and which Schemas have constraints (uniqueness, required_schemas, removal policies). This makes the concept-to-Schema mapping inspectable and navigable through the same Score API used for concept specs — querying "which Schemas reference this concept's state" is a standard Score semantic query.

### 10.2 Concept browser and package management

The concept browser is the centerpiece of Clef Base's extensibility — the equivalent of Drupal's module installer. It is itself a Clef concept (ConceptBrowser) with its own state, actions, and operational principles, wired to KitManager, PluginRegistry, Surface, and Bind through declarative syncs.

#### 10.2.1 The ConceptBrowser concept

```
@version(1)
concept ConceptBrowser [P] {

  purpose {
    Discover, preview, install, update, and remove packages (suites, kits,
    concepts, themes, widgets) from registries, managing the full lifecycle
    of application extensibility at runtime.
  }

  state {
    packages: set P
    package_name: P -> String
    package_version: P -> String
    package_registry: P -> String         // registry URL this came from
    package_status: P -> { available | previewing | installing | installed |
                           update_available | updating | removing | removed | failed }
    package_content_hash: P -> String     // content-addressed identifier
    package_manifest: P -> String         // serialized KitManifest
    package_dependencies: P -> list String // resolved dependency list
    package_installed_at: P -> option DateTime
    package_error: P -> option String     // last error message if failed

    registries {
      registry_entries: set P
      registry_url: P -> String
      registry_name: P -> String
      registry_enabled: P -> Bool
      registry_last_synced: P -> option DateTime
    }

    previews {
      preview_entries: set P
      preview_package: P -> P
      preview_new_schemas: P -> list String
      preview_new_syncs: P -> list String
      preview_new_providers: P -> list String
      preview_new_widgets: P -> list String
      preview_dependency_tree: P -> String     // serialized dependency DAG
      preview_conflicts: P -> list String      // conflicts with installed packages
      preview_size_impact: P -> Int            // estimated size in bytes
    }
  }

  actions {
    action search(query: String, registry: String) {
      -> ok(results: list P) {
        Queries the specified registry (or all enabled registries) for packages
        matching the search term. Results include name, version, description,
        download count, and content hash.
      }
      -> registry_unreachable(registry: String) {
        The specified registry could not be contacted.
      }
    }

    action preview(package_name: String, version: String) {
      -> ok(preview: P) {
        Downloads the package manifest without installing. Runs dependency
        resolution via KitManager (PubGrub). Computes impact analysis: which
        new Schemas become available, which syncs activate, which providers register,
        which widgets become available, which existing concepts gain new syncs.
        Detects conflicts with installed packages (version incompatibilities,
        naming collisions, sync conflicts).
      }
      -> not_found(package_name: String) {
        The package does not exist in any enabled registry.
      }
      -> resolution_failed(conflicts: String) {
        PubGrub could not find a compatible dependency resolution. Returns
        the conflict set explaining which version constraints are incompatible.
      }
    }

    action install(package_name: String, version: String) {
      -> ok(installed: P) {
        Installs the package and all its resolved dependencies. See §10.2.3
        for the full installation workflow.
      }
      -> already_installed(package_name: String, version: String) {
        This exact version is already installed.
      }
      -> resolution_failed(conflicts: String) {
        Dependency resolution failed.
      }
      -> installation_failed(step: String, error: String) {
        Installation failed at the specified step. The system rolls back
        all changes from this installation attempt.
      }
    }

    action update(package_name: String, target_version: String) {
      -> ok(updated: P) {
        Updates an installed package to a new version. Runs migration
        (schema changes via the Migration concept) if the package version
        increment requires it. Re-generates affected Surface widgets and
        Bind targets.
      }
      -> not_installed(package_name: String) {
        The package is not currently installed.
      }
      -> migration_failed(from: String, to: String, error: String) {
        The schema migration between versions failed. The system rolls
        back to the previous version.
      }
    }

    action remove(package_name: String) {
      -> ok() {
        Removes the package. Deactivates its syncs, unregisters its providers,
        removes its Schemas and associated storage (after checking that no
        ContentNodes with those Schemas exist), removes its Surface widgets, and
        regenerates affected Bind targets.
      }
      -> has_data(schemas: list String, counts: list Int) {
        ContentNodes with this package's Schemas still exist. User must delete or
        migrate the data before removing the package.
      }
      -> depended_upon(dependents: list String) {
        Other installed packages depend on this one. They must be removed
        first or updated to versions that no longer require this package.
      }
    }

    action sync_registries() {
      -> ok(updated_count: Int) {
        Refreshes the package index from all enabled registries. Detects
        available updates for installed packages.
      }
    }
  }

  invariant {
    after install(package_name: "taxonomy-extra", version: "1.0.0")
         -> ok(installed: p)
    then search(query: "taxonomy-extra", registry: "all")
         -> ok(results: rs) where rs includes p with status installed
    and  remove(package_name: "taxonomy-extra")
         -> ok()
    then search(query: "taxonomy-extra", registry: "all")
         -> ok(results: rs) where rs includes p with status available
  }
}
```

#### 10.2.2 Discovery and dependency resolution

Discovery begins when a user searches the concept browser or browses a registry index. The ConceptBrowser queries enabled registries — the Repertoire standard library (always enabled), Clef Hub (the community registry), and any custom registries the admin has configured. Registry communication uses the `clef_remote` Connector provider, so registry access works through the standard Data Integration infrastructure.

Each registry entry is a **content-addressed package**. The package's content hash is computed from the hash of all its constituent files (concept specs, sync files, widget specs, theme files, suite.yaml, `schema.yaml`, and `composition.yaml` if present). This is the same content-addressing pattern used by the package management infrastructure: two packages with the same content hash are identical regardless of when or where they were published.

**Schema discovery.** Packages that include a `schema.yaml` advertise their Schemas in the registry index alongside their concepts. The concept browser's search UI supports filtering by Schema — "show me packages that provide a Schema with fields for geolocation" or "show me packages with a Canvas Schema." Each Schema in the registry listing shows: its fields (with types), its associated concept (if any), its manifest placement (content or config), its constraints, and its removal policy. This lets site builders evaluate a package's data model before installing.

**Standalone Schema packages.** Not every package contains concepts. A package can ship only a `schema.yaml` with no concept specs — a pure data-shape package. Schema "SEO," Schema "OpenGraph," Schema "Accessibility" might be published as standalone packages with no associated behavior, installable through the concept browser alongside concept-bearing packages. ConceptBrowser's installation pipeline handles them: Step 4 (create Schemas) runs, Steps 5-6 (register providers, activate syncs) are no-ops, Step 7 (generate widgets) runs for the new Schemas, Step 8 (regenerate Bind) adds the Schemas to the appropriate manifests.

When the user selects a package for preview, ConceptBrowser delegates dependency resolution to the **KitManager** framework concept, which implements the **PubGrub** algorithm. PubGrub takes the new package's dependency declarations (from its `suite.yaml` `uses` section), the currently installed packages and their versions, and the available packages in the registry index, and either produces a complete dependency resolution (a set of package versions that satisfies all constraints) or reports an incompatibility with a human-readable explanation of which constraints conflict.

The resolution result feeds into the preview: which packages will be installed as dependencies, what total size impact, which Schemas will be created, and whether any naming collisions or sync conflicts exist with already-installed packages.

#### 10.2.3 The installation workflow

Installation is a multi-step transactional process. If any step fails, the entire installation rolls back to the pre-installation state. The steps execute through the standard sync chain infrastructure — each step is a sync that fires on the previous step's completion.

**Step 1 — Download and verify.** All packages in the resolution set are downloaded from their registries. Each package's content hash is verified against the registry's published hash. Files are stored in content-addressed storage (the same storage layer used by the Artifact concept in the Deploy suite). If any download fails or hash verification fails, installation aborts.

```yaml
sync InstallDownload [eager]
when {
  ConceptBrowser/install: [ package_name: ?name; version: ?version ]
    => [ resolving: ?resolution ]
}
then {
  # For each package in the resolution set:
  Artifact/store: [ content: ?package_files; hash: ?expected_hash ]
}

sync InstallVerify [eager]
when {
  Artifact/store: [ content: ?files; hash: ?expected ]
    => [ ok: ?stored ]
}
where {
  filter(?stored.computed_hash == ?expected)
}
then {
  ConceptBrowser/markVerified: [ package: ?stored ]
}
```

**Step 2 — Parse and validate specs.** All `.concept` and `.sync` files are parsed by SpecParser and SyncParser. If any file fails to parse, installation aborts. SyncCompiler compiles syncs to verify they reference concepts that either already exist or are part of this installation batch. The overlap prevention checks from §10.4 of the Clef reference run automatically: naming collisions, action overlap, and cross-layer bleeding are detected and reported.

**Step 3 — Schema migration.** If the package introduces new Schemas or modifies existing ones, the Migration concept (Deploy suite) runs schema migrations: `expand` (add new tables/columns for new Schema fields), `migrate` (move data if needed), `contract` (remove deprecated structures). For fresh installations of new Schemas, this is just the expand phase — creating storage structures for the new fields.

**Step 4 — Create Schemas, compositions, and default display/form modes.** If the suite ships a `schema.yaml`, ConceptBrowser reads it and creates Schema ContentNodes for each declared schema. Fields are created on each Schema based on the `fields` mapping, with types inferred from the concept spec's state declarations. `includes` declarations are registered so that applying the parent Schema auto-applies the included Schemas (§2.4.3). Default DisplayMode configs ("default", "teaser", "full") and FormBuilder configs ("default", "inline") are auto-generated from the Schema field definitions. The storage provider registers the field mapping so it knows how to route concept state to ContentNode Properties vs concept-local storage. If the suite also ships a `composition.yaml`, ConceptBrowser generates composition sync files for each rule (§2.4.3) and registers them with the SyncEngine. After this step, ContentNodes with these Schemas have typed fields, auto-composition syncs are active, and the Schemas can be rendered generically. If the suite has no `schema.yaml`, no Schemas are created and the concept uses concept-local storage for all its state (it still works, but without ContentNode integration).

**Step 5 — Register providers with PluginRegistry.** For each provider plugin declared in the package, PluginRegistry receives a `register` call with the plugin type, plugin ID, and implementation reference. After this step, concepts that use the coordination+provider pattern can dispatch to the new providers.

**Step 6 — Activate syncs and generate hook syncs.** Required syncs from the package's `suite.yaml` are compiled and registered with the SyncEngine. Recommended syncs are activated with their default settings. Integration syncs are activated only if the providers they depend on are present. If the package's `schema.yaml` declares lifecycle hooks (`on_save`, `on_apply`, `on_remove`, `on_delete`), ConceptBrowser generates real sync files from the hook declarations (§2.1.3) and registers them with the SyncEngine. After this step, the new concepts are wired into the application's sync chains, and Schema-specific behavior activates automatically when the Schema is applied to any ContentNode.

**Step 7 — Generate Surface widgets.** The `surface-integration` suite's syncs fire for each new Schema, producing widget specs for list views, detail views, and form views based on the Schema's field definitions. The WidgetParser parses the specs, WidgetGen generates framework-specific components via the active FrameworkAdapter, and the widgets are registered with the WidgetResolver. After this step, ContentNodes with the new Schemas have working UIs.

**Step 8 — Regenerate Bind targets.** For each new concept, the ConceptBrowser reads the `manifest:` placement from the suite's `schema.yaml` (§2.2.2) and adds the concept to the appropriate manifest with a default Projection. Then both the config manifest and content manifest are regenerated. The Generator concept plans the regeneration, Target providers (REST, GraphQL, CLI, MCP) produce updated interface files, and the Emitter writes them. After this step, the new concepts are accessible through the API surfaces specified by their manifest placement.

**Step 9 — Update ConceptBrowser state.** The package's status transitions from `installing` to `installed`, the `installed_at` timestamp is set, and the content hash is recorded. A Provenance record is created for the installation event.

```yaml
# The full installation sync chain (simplified)
sync InstallPipeline [eager]
when { ConceptBrowser/install => [ ok: ?pkg ] }
then { Queue/enqueue: [ queue: "installation"; item: ?pkg; stage: "download" ] }

sync InstallStage [eager]
when { Queue/itemReady: [ queue: "installation"; item: ?pkg; stage: ?stage ] }
then {
  # Dispatches to the appropriate step based on ?stage
  # Each step completion enqueues the next stage
  # Any failure triggers rollback via Provenance/rollback
}
```

#### 10.2.4 Update and rollback

Updates follow the same pipeline as installation but with an additional migration phase. When updating from version 1.0 to 2.0 of a package:

1. The new version is downloaded and verified alongside the old
2. Schema migration runs the `expand/migrate/contract` sequence for any state changes between `@version` numbers
3. Syncs are deactivated, updated, and reactivated
4. Surface widgets and Bind targets are regenerated
5. If any step fails, the Migration concept's rollback capability restores the previous schema, the old version's syncs are reactivated, and the package status reverts

Rollback after a successful update is also possible through the Provenance concept's batch rollback: `Provenance/rollback(batch: "install:package-name:2.0.0")` undoes all state changes from the update.

#### 10.2.5 Removal safeguards

Removing a package is potentially destructive. The ConceptBrowser enforces two safeguards:

**Data existence check.** Before removing a package that introduces Schemas, ConceptBrowser queries ContentStorage to count ContentNodes with those Schemas applied. If any exist, removal is blocked with a `has_data` error listing the Schemas and counts. The user must either delete the data, migrate it (remove the Schema and apply a different one), or export it before removal can proceed.

**Dependency check.** Before removing a package, ConceptBrowser checks whether any other installed package declares it as a dependency in its `suite.yaml` `uses` section. If dependents exist, removal is blocked with a `depended_upon` error listing the dependent packages.

#### 10.2.6 Integration with the Clef ecosystem apps

The ConceptBrowser does not operate in isolation — it delegates to the existing Clef ecosystem apps (`clef-registry`, `clef-hub`, `clef-account`, `clef-cli-bootstrap`, `clef-web`) for registry operations, authentication, and distribution. This section documents how ConceptBrowser maps onto those apps and what extensions each app needs to support the full package management workflow described in §10.2.1–§10.2.5.

##### How ConceptBrowser maps to the ecosystem

```
┌─────────────────────────────────────────────────────────────────────┐
│  Clef Base Instance (running ConceptBrowser)                       │
│                                                                     │
│  ConceptBrowser/search ──→ RegistryProxy ──→ clef-registry/search  │
│  ConceptBrowser/preview ──→ RegistryProxy ──→ clef-registry/lookup │
│                          ──→ ComponentManifestProxy ──→ clef-registry/ComponentManifest/lookup │
│                          ──→ Resolver (local PubGrub)               │
│  ConceptBrowser/install ──→ ContentStore ←── clef-registry/Download/resolve │
│                          ──→ (9-step pipeline, all local)           │
│  ConceptBrowser/sync_registries ──→ RegistryProxy ──→ clef-registry/search (full index) │
│                                                                     │
│  Auth for publish ──→ AccountProxy ──→ clef-account/Authentication  │
│  CLI install ──→ clef-cli-bootstrap/Download ──→ clef-registry      │
│  Web discovery ──→ clef-hub (browse/search UI) ──→ clef-registry    │
│  Docs for packages ──→ clef-web (landing/docs pages)                │
└─────────────────────────────────────────────────────────────────────┘
```

**ConceptBrowser → clef-registry.** ConceptBrowser's `search`, `preview`, and `sync_registries` actions delegate to clef-registry through the same proxy pattern used by clef-hub. A Clef Base instance connects to one or more registries (Repertoire is local, Clef Hub and custom registries are remote). The `clef_remote` Connector provider (§10.2.2) maps to clef-registry's REST API surface (defined in `clef-registry/app.interface.yaml`). ConceptBrowser queries Registry/search for discovery, Registry/lookup + ComponentManifest/lookup for preview metadata, Download/resolve for artifact URLs, and ContentStore/retrieve for verified package downloads.

**ConceptBrowser → clef-account.** Publication (not browsing/installation) requires authentication. When a Clef Base user publishes a package back to a registry, ConceptBrowser delegates auth to clef-account via the same AccountProxy pattern used by clef-registry and clef-hub. The `auth-guard-on-publish` sync in clef-registry validates publisher identity against clef-account.

**ConceptBrowser → clef-hub (indirect).** ConceptBrowser does not call clef-hub directly. Instead, they share the same upstream: clef-registry. Clef-hub provides the web browsing UI for the registry; ConceptBrowser provides the in-app browsing UI within Clef Base. Both query the same registry index. Comments, flags, and attribution on clef-hub are orthogonal to ConceptBrowser's installation workflow — they enrich the browsing experience but don't affect package resolution or installation.

**clef-cli-bootstrap → ConceptBrowser.** The CLI's `clef install <package>` command is a thin wrapper: it delegates to ConceptBrowser/install on the local Clef Base instance (or, for standalone Clef apps without Clef Base, delegates directly to the Package suite's Installer concept). The CLI's SelfUpdate concept is independent — it updates the CLI binary itself, not application packages.

##### Required extensions to clef-registry

The existing clef-registry tracks modules, component manifests, content blobs, downloads, and audit results. The spec's package management model (§10.2.2–§10.2.3) introduces artifacts that clef-registry does not yet fully index. The following extensions are needed:

**1. ComponentManifest must track schema.yaml and composition.yaml artifacts.**

The current ComponentManifest concept tracks: `concepts`, `syncs`, `derived`, `widgets`, `handlers`. The spec (§10.2.2) states that each registry entry advertises its Schemas and that search supports filtering by Schema fields. ComponentManifest needs additional state:

```
// Additions to ComponentManifest [C] state:
schemas: C -> list {
  name: String,                    // e.g., "TaxonomyTerm"
  concept: option String,          // associated concept, if any (e.g., "Taxonomy")
  manifest_placement: String,      // "content" or "config"
  fields: list {
    name: String,                  // e.g., "name", "parent", "vocabulary"
    type: String,                  // e.g., "String", "Reference", "Enum"
    from: option String,           // concept state field mapping, if any
    mutable: Bool,
    constraints: list String       // e.g., "required", "unique"
  },
  includes: list String,           // schema inheritance
  removal_policy: String           // e.g., "forbid", "cascade", "nullify"
}
compositions: C -> list {
  source_schema: String,           // e.g., "Article"
  target_schema: String,           // e.g., "HasTags"
  rule: String,                    // e.g., "auto_apply"
  condition: option String         // optional guard
}
themes: C -> list {
  name: String,                    // e.g., "ocean-blue"
  extends: option String,          // parent theme
  spec_path: String                // path within package
}
```

This enables the spec's Schema discovery feature: "show me packages that provide a Schema with fields for geolocation" becomes a `ComponentManifest/search` query filtering on `schemas[].fields[].name` and `schemas[].fields[].type`. The `component-manifest-on-publish` sync in clef-registry must be updated to extract schema.yaml, composition.yaml, and .theme files from the package and populate these new fields.

**2. Registry/publish must validate schema.yaml and composition.yaml.**

The `publish-gate` sync currently validates concept specs and sync files. It must also parse and validate schema.yaml (checking field type validity, `from:` mapping references to actual concept state fields, `includes` references to known schemas) and composition.yaml (checking that source and target schemas exist in the package or its dependencies). The Publisher/package action must include schema.yaml and composition.yaml in the content hash computation alongside concept specs, sync files, widget specs, theme files, and suite.yaml.

**3. Registry search must support Schema-aware filtering.**

Registry/search currently queries by name and metadata. For the spec's concept browser, it must also support:
- Filtering by Schema name: `search(query: "geolocation", filter: "schema")`
- Filtering by Schema field type: `search(query: "canvas", filter: "schema_field_type:Canvas")`
- Filtering by package kind: `search(query: "", filter: "kind:schema-only")` — for standalone Schema packages (§10.2.2) that ship only schema.yaml with no concept specs
- Filtering by theme: `search(query: "dark", filter: "theme")`

This can be implemented by extending Registry/search's `query` parameter to accept structured filter syntax, or by adding a dedicated `searchByCapability` action that delegates to ComponentManifest/search.

**4. Download must support package-level (not just binary) artifact resolution.**

The existing Download concept is oriented toward per-platform binary distribution (artifact_id + platform + version_range → CDN URL). Package installation (§10.2.3, Step 1) needs to download source packages (concept specs, sync files, schema.yaml, etc.) — not platform-specific binaries. Download needs a mode that resolves a package by `(name, namespace, version)` → content-addressed blob URL in ContentStore, distinct from the binary artifact resolution used by clef-cli-bootstrap.

This can be addressed by:
- Adding a `kind` field to Download entries: `"binary"` (existing) vs `"package"` (new)
- Or creating a separate `PackageDownload` action on Registry that returns a ContentStore hash directly, bypassing the platform-specific Download concept

The recommended approach is to add `kind` to Download, keeping a single distribution concept for both binaries and source packages. The `download-register-on-publish` sync in clef-registry already fires on publish; it should register both the source package blob (kind: "package") and any pre-built binary artifacts (kind: "binary").

##### Required extensions to clef-hub

Clef-hub is the web-based browsing UI for the registry. The spec's concept browser (§10.2.2) describes Schema-aware discovery that clef-hub should also surface in its web interface:

**1. Schema browsing proxy and UI.**

Add a `SchemaProxy` concept (or extend RegistryProxy) that proxies ComponentManifest schema data to the hub frontend. The package detail page in clef-hub should display:
- Schema fields with types and constraints
- Schema-to-concept mappings (which concept state fields map to which Schema fields)
- Schema inheritance (`includes` / `extends`)
- Composition rules (which schemas auto-apply when the package is installed)
- Removal policies

This mirrors what the concept browser's detail panel shows in Clef Base, but in the web browsing context.

**2. Schema-aware search.**

RegistryProxy/search should support the same Schema-aware filter syntax added to clef-registry (§10.2.6 extension 3 above). The hub search UI should offer faceted filtering by: package kind (suite, concept, schema-only, theme), Schema names, Schema field types, and theme names.

**3. Theme preview.**

Add a theme preview capability that renders a package's theme tokens (palette, typography, spacing) visually on the package detail page. This uses ContentParser (already in clef-hub) extended with a theme-rendering ComponentMapping.

##### Required extensions to clef-cli-bootstrap

**1. Package install command support.**

Clef-cli-bootstrap currently handles only self-update. When the full CLI is installed, `clef install <package>` must delegate to either:
- ConceptBrowser/install (for Clef Base instances), or
- the Package suite's Installer concept (for standalone Clef apps)

The bootstrap itself doesn't need changes — this routing logic lives in the full CLI, which clef-cli-bootstrap delegates to after self-update. However, clef-cli-bootstrap's Download concept (which resolves artifacts from clef-registry) should be updated to support the new `kind: "package"` download type, so that `clef install` can fetch source packages, not just CLI binaries.

##### Required extensions to clef-web

**1. Package documentation pages.**

clef-web currently serves static content (homepage, docs, FAQ). Published packages should be able to contribute documentation pages to clef-web. This requires:
- A sync between Registry/publish and clef-web's ContentNode/create, so that when a package is published with a `docs/` directory, its documentation pages are created as ContentNodes on clef-web
- clef-web's RegistryProxy should be extended to fetch package README content (currently only fetches download links)
- The navigation Outline should include a "Packages" section linking to auto-generated package documentation pages

This is a lower-priority extension — clef-hub already renders READMEs. Clef-web's role is the official documentation site, so package docs here would be curated (e.g., featured packages, tutorials) rather than auto-generated from every published package.

##### Artifact coverage matrix

The following matrix shows which artifacts the spec's ConceptBrowser workflow requires, and where each artifact is stored, indexed, validated, and displayed across the ecosystem:

| Artifact | Stored in | Indexed by | Validated by | Browsed in | Status |
|---|---|---|---|---|---|
| `.concept` specs | clef-registry/ContentStore | clef-registry/ComponentManifest (concepts field) | publish-gate sync → SpecParser | clef-hub + ConceptBrowser | **Exists** |
| `.sync` rules | clef-registry/ContentStore | clef-registry/ComponentManifest (syncs field) | publish-gate sync → SyncParser | clef-hub + ConceptBrowser | **Exists** |
| `.derived` compositions | clef-registry/ContentStore | clef-registry/ComponentManifest (derived field) | publish-gate sync → DerivedParser | clef-hub + ConceptBrowser | **Exists** |
| `.widget` specs | clef-registry/ContentStore | clef-registry/ComponentManifest (widgets field) | publish-gate sync (needs WidgetParser) | clef-hub + ConceptBrowser | **Partial** — indexed but not validated by WidgetParser at publish time |
| `.theme` specs | clef-registry/ContentStore | **Missing** — not in ComponentManifest | **Missing** — not validated at publish time | **Missing** — not browsable | **Needs extension** |
| `suite.yaml` | clef-registry/ContentStore | clef-registry/Registry (dependencies field) | clef-registry/Manifest/validate | clef-hub (package detail) | **Exists** |
| `schema.yaml` | clef-registry/ContentStore | **Missing** — not in ComponentManifest | **Missing** — not validated at publish time | **Missing** — not browsable | **Needs extension** |
| `composition.yaml` | clef-registry/ContentStore | **Missing** — not in ComponentManifest | **Missing** — not validated at publish time | **Missing** — not browsable | **Needs extension** |
| `.handler.ts` implementations | clef-registry/ContentStore | clef-registry/ComponentManifest (handlers field) | publish-gate sync (basic) | clef-hub + ConceptBrowser | **Exists** |
| Content hash (package-level) | clef-registry/Registry (artifact_hash) | clef-registry/ContentStore (per-blob) | clef-registry/ContentStore/verify | N/A (internal) | **Exists** — but hash computation must include schema.yaml, composition.yaml, and .theme files |

##### Content hash computation update

The spec (§10.2.2) states: "The package's content hash is computed from the hash of all its constituent files (concept specs, sync files, widget specs, theme files, suite.yaml, `schema.yaml`, and `composition.yaml` if present)." The Publisher/package action in clef-registry currently computes the content hash from the package blob. This is correct at the blob level, but the ComponentManifest registration must also verify that the hash covers all expected file types. The recommended implementation: Publisher/package sorts all package files by path, computes individual SHA256 hashes, and then computes the package hash as SHA256 of the concatenated `(path, hash)` pairs. This deterministic ordering ensures content-addressing works correctly regardless of filesystem ordering or archive format.

##### Summary of required changes

| App | Change | Priority | Reason |
|---|---|---|---|
| **clef-registry** | Add `schemas`, `compositions`, `themes` fields to ComponentManifest | **High** | ConceptBrowser preview/search requires Schema-aware metadata |
| **clef-registry** | Add Schema/composition/theme validation to publish-gate sync | **High** | Package integrity — invalid schema.yaml should fail publication |
| **clef-registry** | Add Schema-aware filtering to Registry/search | **High** | ConceptBrowser search UX requires filtering by Schema fields |
| **clef-registry** | Add `kind: "package"` to Download concept | **Medium** | Source package download vs binary artifact download |
| **clef-registry** | Add WidgetParser + ThemeParser validation to publish-gate | **Medium** | Full spec validation at publish time |
| **clef-hub** | Add Schema browsing (proxy + UI) | **High** | Web-based Schema discovery mirrors ConceptBrowser |
| **clef-hub** | Add Schema-aware search filtering | **High** | Faceted search by Schema name/field/type |
| **clef-hub** | Add theme preview rendering | **Low** | Visual theme browsing enhancement |
| **clef-cli-bootstrap** | Support `kind: "package"` in Download | **Medium** | CLI `clef install` for source packages |
| **clef-web** | Extend RegistryProxy for package README content | **Low** | Package documentation on the docs site |
| **clef-web** | Add package documentation page generation sync | **Low** | Auto-generated docs for published packages |

---

## 11. Default DevOps and deployment pipeline

### 11.1 Single pipeline

Every Clef Base application ships with a preconfigured development, testing, building, and deployment pipeline managed by the Deploy suite concepts (DeployPlan, Rollout, Migration, Health, Env, Telemetry, Artifact, and the various coordination+provider concepts for runtime, secrets, IaC, GitOps, builders, and toolchains).

The default pipeline provides:

- **Local development:** `clef dev` runs a hot-reloading development server (DevServer concept) with all deployment targets available locally.
- **Testing:** `clef test` runs the full test suite — conformance tests (Conformance concept), contract tests (ContractTest concept), snapshot tests (Snapshot concept), with intelligent test selection based on change impact (TestSelection concept).
- **Staging on Vercel:** Preview deployments for every pull request, with the full application running in a staging environment (Env concept with dev/staging/prod configuration).
- **Production on Vercel:** The default web deployment target, with progressive rollout (Rollout concept supporting canary, blue-green, and rolling strategies).
- **Mobile builds via cloud:** The deployment pipeline triggers cloud-based builds for Android (Gradle) and iOS (Xcode Cloud) apps, producing preview builds for staging and release builds for production.
- **Desktop builds via cloud:** Similarly, desktop builds for Linux, Windows, and macOS are triggered as part of the deployment pipeline.

### 11.2 Swappable in the UI

Every aspect of the deployment pipeline is configurable through the admin UI because every aspect is a config entity. Want to deploy to AWS instead of Vercel? Change the Runtime provider. Want to use Terraform instead of Pulumi for infrastructure? Change the IaC provider. Want to add a GitHub Actions workflow instead of the built-in pipeline? The GitOps provider supports ArgoCD, Flux, and custom CI integration.

The config manifest's CLI and MCP targets provide programmatic access to all deployment operations, enabling AI-assisted DevOps through Claude Skills.

---

## 12. The automation layer

### 12.1 Three-tier dispatch in Clef Base

Clef Base inherits Clef's three-tier dispatch model, and all three tiers are active and visible in the platform:

**Tier 1 — SyncEngine (structural wiring).** The foundational layer. Every cross-concept delegation uses syncs. Users do not directly interact with this layer, but they see its effects everywhere: saving a content entity triggers cache invalidation, search indexing, URL alias generation, and provenance tracking — all via syncs.

**Tier 2 — EventBus (application pub/sub).** Dynamic subscriber management, priority ordering, dead-letter queues, and event history. Used when the set of listeners is dynamic — for example, when plugins register event handlers at installation time.

**Tier 3 — AutomationRule (user-configurable rules).** End users configure their own event-condition-action rules through the admin UI. "When a new Article is published and its category is 'News', send a notification to the editors channel." AutomationRule conditions delegate evaluation to the SyncEngine's `evaluateWhere`; actions dispatch through the AutomationDispatch concept to registered providers (ManifestAutomationProvider for build-time action registries, SyncAutomationProvider for runtime user-defined syncs). AutomationScope provides allowlist/denylist control over which actions user-defined automations can invoke.

All three tiers are **version-space-aware**: each AutomationRule carries a `version_scope` property (base, current, all, or propagate) that determines whether it fires only in the canonical reality, in the triggering user's current version space, across all active spaces, or in base with propagation to non-overridden spaces. See §5.9 for the full version-aware automation model.

### 12.1.1 Extending automations with concept/provider plugins

> **Cross-reference with actual codebase:** The Automation Providers suite (`repertoire/concepts/automation-providers/`) already implements the coordination+provider pattern for automation extensibility. AutomationDispatch is a coordination concept that looks up `provider_name` in PluginRegistry under type `"automation-provider"` and delegates execution. Two built-in providers ship: ManifestAutomationProvider (build-time action registries with schema validation) and SyncAutomationProvider (runtime user-defined syncs). New providers can be added by any suite — the pattern is:
>
> 1. Create a new concept implementing the provider interface (a concept with an `execute` action that accepts a rule reference and context)
> 2. Register it with PluginRegistry under type `"automation-provider"` via a sync (following the pattern in `manifest-provider-registration.sync` and `sync-provider-registration.sync`)
> 3. Add a dispatch routing sync from `AutomationDispatch/dispatch` to the new provider (following `dispatch-to-manifest.sync` and `dispatch-to-sync.sync`)
>
> **This pattern already works.** The Extension suite (`repertoire/concepts/extension/`) provides additional infrastructure: ContributionPoint lets hosts define extension points that plugins contribute to, and ExtensionHost manages the lifecycle of installed extensions. In Clef Base, the ConceptBrowser (§10.2) orchestrates installation, which includes running provider registration syncs for any new automation providers a suite ships.
>
> **What Clef Base adds on top (not repertoire):**
>
> | Clef Base concern | How it extends automation | Where it lives |
> |---|---|---|
> | Version-aware dispatch | `version_scope` property on AutomationRule + AutomationVersionDispatch sync (§5.9) | Clef Base entity-lifecycle syncs |
> | Schema-triggered hooks | `schema.yaml` lifecycle hooks generate hook syncs at install time (§2.1.3) | Clef Base installation workflow |
> | ConceptBrowser integration | Installation triggers provider registration syncs | Clef Base ConceptBrowser sync chains |
> | Admin UI for rule config | AutomationRule rendered through the content manifest's Schema/DisplayMode pipeline | Clef Base UI composition |
>
> **Potential new provider types (each would be a new repertoire concept):**
>
> | Provider concept | Suite placement | Purpose |
> |---|---|---|
> | **LLMAutomationProvider** | LLM suite (or new LLM-Automation integration) | Execute automation actions via LLM calls — e.g., "when article is published, generate SEO summary via LLMCall" |
> | **WebhookAutomationProvider** | Process-Automation suite (already has WebhookInbox) | Fire outgoing webhooks as automation actions — external system integration |
> | **ProcessAutomationProvider** | Process-Foundation suite | Trigger ProcessSpec execution as an automation action — start a multi-step workflow from a rule |
> | **GovernanceAutomationProvider** | Governance-Execution suite | Route automation actions through governance gates — "create proposal before executing destructive action" |
>
> Each of these follows the same pattern: concept + registration sync + dispatch routing sync. The architecture is already extensible — no framework changes needed, only new provider concepts in the repertoire.

### 12.2 Workflow as content moderation

The Workflow concept from the Automation suite provides finite state machines for content lifecycle management. The default configuration includes a "Content Moderation" workflow with Draft → Review → Published → Archived states, mirroring Drupal's content moderation module. Transitions require permissions; publishing triggers cache invalidation and search indexing via syncs.

### 12.3 Process orchestration

For more complex orchestrations — multi-step approval chains, LLM-assisted content processing, external system integrations — the Process suite provides full process modeling. ProcessSpec defines reusable blueprints; ProcessRun tracks execution instances; StepRun manages individual step lifecycle; FlowToken handles parallel fork/join semantics; ProcessVariable stores process-scoped data; WorkItem manages human task assignment; ConnectorCall tracks external API invocations; LLMCall manages language model interactions; EvaluationRun assesses quality; and ProcessEvent provides an append-only audit ledger.

The Process suite's six sub-suites (process-foundation, process-human, process-automation, process-reliability, process-llm, process-observability) are independently installable — a simple app might only need process-foundation and process-human, while a complex enterprise workflow might use all six.

---

## 13. Content storage backends

### 13.1 The shared ContentNode pool provider

Clef Base's defining storage decision: every domain concept's ContentStorage is configured with the **shared ContentNode pool provider**. This is what makes "everything is a ContentNode" work without changing any concept specs.

The provider reads the suite's `schema.yaml` (§3.1.1) and does three things:

**Mapped fields → ContentNode Properties.** Fields declared in `schema.yaml` are stored as Property values on the ContentNode, governed by the concept's Schema. When `Taxonomy/addTerm` calls `ContentStorage/save`, the provider creates a ContentNode, applies Schema "TaxonomyTerm", and writes the mapped fields (name, description, vocabulary, parent) as Properties.

**Unmapped fields → concept-local storage.** State fields NOT declared in `schema.yaml` are stored in a concept-local side table, keyed by ContentNode ID. Taxonomy's hierarchy cache, View's cached query results, MediaAsset's processing queue — these go in concept-local storage, not on the ContentNode.

**Set membership → Schema membership.** The `primary_set` declaration in `schema.yaml` tells the provider that a concept's `set T` resolves to "all ContentNodes with this Schema applied." `Taxonomy/query` returns all ContentNodes with Schema "TaxonomyTerm." This is what makes cross-Schema composition work — applying Schema "TaxonomyTerm" to a ContentNode that was created by View makes it visible to Taxonomy's queries.

### 13.2 Default backends per target

Each deployment target ships with a sensible default backend for the shared pool:

- **Web (Next.js/Vercel):** PostgreSQL for the shared ContentNode pool, filesystem/S3 for file data (ContentNodes with Schema "File"), PostgreSQL side tables for concept-local operational storage, environment variables + Vercel KV for config
- **Mobile (Android/iOS):** SQLite (via the Replica concept) for the local ContentNode pool, syncing to the server's PostgreSQL
- **Desktop:** SQLite for local-first storage, with optional server sync
- **Web3:** Smart contract state for fields marked `storage: remote` on their Schema, IPFS for file data, SQLite for local cache

### 13.3 Federated storage

The federated ContentStorage provider from the Data Integration kit enables ContentNodes whose field data spans multiple backends. A ContentNode with Schema "WikipediaArticle" might store `internal_notes` and `quality_score` locally while fetching the article content from the Wikipedia API. A ContentNode with Schema "ExternalProduct" might store pricing from a Shopify API while maintaining local inventory notes. Federation is configured per-Schema through `Schema.associations`, not hard-coded — changing where data comes from is a config change, not a code change.

### 13.4 Portability: concepts in non-Clef-Base apps

The same Taxonomy concept from the Repertoire library works in a standalone Clef app that has never heard of Clef Base. In that deployment, Taxonomy's ContentStorage uses a regular Postgres provider — all of Taxonomy's state (entity data and operational data) goes in Taxonomy's own table. No ContentNode pool, no Schema tags, no shared storage, no triple-zone entity model. The concept spec is identical. Only the storage provider config differs. This is a deployment-time choice, not an architectural constraint on the concept.

### 13.5 Swappable in the UI

Storage backends are config-manifest ContentNodes (managed through the admin UI). The admin UI exposes storage backend configuration per Schema — you can configure different backends for different Schemas if needed (e.g., high-write Schemas on a time-series database, media Schemas on object storage). Want to move from PostgreSQL to CockroachDB? Change the storage provider. Want to add Redis caching in front of the database? Enable the Cache concept's integration sync. The platform's storage layer is a concept, not an assumption.

---

## 14. Concept inventory for Clef Base

Clef Base assembles concepts from across the Clef ecosystem. The following suites form the platform's foundation:

**From the existing Repertoire (62+ suites, verified against codebase):**

*Core suites (17):*
Foundation (ContentNode, ContentParser, ContentStorage, Intent, Outline, PageAsRecord, Property, TypeSystem), Infrastructure (Cache, ConfigSync, EventBus, Pathauto, PluginRegistry, Validator), Classification (Namespace, Schema, Tag, Taxonomy), Content (Canvas, Comment, DailyNote, SyncedContent, Template, Version), Linking (Alias, Backlink, Reference, Relation), Presentation (DisplayMode, FormBuilder, Renderer, View), Query/Retrieval (ExposedFilter, Query, SearchIndex), Automation (AutomationRule, Control, Queue, Workflow), Data Organization (Collection, Graph), Computation (ExpressionLanguage, Formula, Token), Collaboration (Flag, Group, CausalClock, Replica, ConflictResolution, Attribution, Signature, InlineAnnotation, PessimisticLock + 4 resolution provider variants), Media (FileManagement, MediaAsset), Notification (Notification), Layout (Component), Identity (Authentication, Authorization, AccessControl, Session), Data Integration (DataSource, Connector, Capture, FieldMapping, Transform, Enricher, SyncPair, DataQuality, Provenance, ProgressiveSchema), Automation Providers (AutomationDispatch, AutomationScope, ManifestAutomationProvider, SyncAutomationProvider).

*Versioning suite (11 core + 8 providers):*
ContentHash, Ref, DAGHistory, Patch, Diff (coordination), Merge (coordination), Branch, TemporalVersion, SchemaEvolution, ChangeStream, RetentionPolicy. Diff providers: MyersDiff, PatienceDiff, HistogramDiff, TreeDiff. Merge providers: ThreeWayMerge, RecursiveMerge, LatticeMerge, SemanticMerge. All use PluginRegistry for algorithm selection.

*Extension suite (7 core + browser sub-suite):*
ExtensionManifest, ExtensionHost, ContributionPoint, ExtensionMessaging, ExtensionPermission, ExtensionStorage, ExtensionConfig. Browser sub-suite: BrowserExtensionHost, ContentScript, BackgroundWorker, BrowserPermission, BrowserAction, BrowserManifestTarget + 4 browser target providers (Chrome, Firefox, Edge, Safari).

*Note: All concepts above are standard Repertoire library concepts — unchanged, portable, usable in any Clef app. In Clef Base, each suite ships a `schema.yaml` that maps concept state fields to Schema fields on ContentNodes (§3.1.1). The shared ContentNode pool provider (§13.1) reads this mapping to route data: mapped fields become ContentNode Properties, unmapped fields go to concept-local storage. This enables cross-Schema composition (a ContentNode that is both a View and a TaxonomyTerm). Concepts with no domain behavior beyond CRUD (Article, Page, Role) are pure Schemas — no concept, no `schema.yaml` needed. See §3.1.2 for the full entity type breakdown.*

**From the Interface/Bind suite:**
Projection, Generator, ApiSurface, Middleware, Grouping, ActionGuide, Annotation, EnrichmentRenderer, and the Target/Sdk/Spec coordination concepts with their providers.

**From Clef Surface (7 suites):**
surface-core (DesignToken, Element, UISchema, Binding, Signal), surface-component (Widget, Machine, Slot, Interactor, Affordance, WidgetResolver), surface-render, surface-theme, surface-app (Navigator, Host, Transport, Shell, PlatformAdapter), surface-spec, surface-integration.

**From the Deploy suite:**
DeployPlan, Rollout, Migration, Health, Env, Telemetry, Artifact, and all coordination+provider concepts.

**From the Process Kit (when installed):**
20 concepts across 6 sub-suites: process-foundation (ProcessSpec, ProcessRun, StepRun, FlowToken, ProcessVariable, ProcessEvent), process-human (WorkItem, Approval, Escalation), process-automation (ConnectorCall, WebhookInbox, Timer), process-reliability (RetryPolicy, CompensationPlan, Checkpoint), process-observability (Milestone, ProcessMetric), process-llm.

**From the Governance Kit (when installed):**
60+ concepts across 7 sub-suites: governance-decision (Proposal, Vote, CountingMethod, Quorum, Conviction, PredictionMarket, OptimisticApproval, Deliberation, Meeting + 9 counting method variants), governance-structure (Polity, Circle, Delegation, Weight + 6 weight source variants), governance-rules (Policy, Monitor, Sanction, Dispute + 4 evaluator variants), governance-identity (Membership, Role, Permission, SybilResistance, Attestation, AgenticDelegate + 4 sybil method variants), governance-resources (Treasury, Reputation, Metric, Objective, BondingCurve + 5 reputation algorithm variants), governance-transparency (AuditTrail, DisclosurePolicy), governance-execution (Execution, Timelock, Guard, FinalityGate, RageQuit + 4 finality provider variants).

**From the LLM Kit (when installed):**
7 sub-suites: llm-core (LLMProvider, ModelRouter), llm-agent, llm-conversation, llm-prompt, llm-rag, llm-training, llm-safety.

**From the Formal Verification Suite (when installed):**
FormalProperty, Contract, Evidence, VerificationRun, SolverProvider, SpecificationSchema + solver provider variants.

**From the Package suite:**
Manifest, Resolver, Lockfile, Registry, FeatureFlag, ComponentManifest, Fetcher, Installer, ContentStore, Publisher, Auditor, Download, SelfUpdate.

---

### 14.1 New repertoire concepts needed for Clef Base

The following concepts do not yet exist in the repertoire but are general-purpose enough that they belong there, not in Clef Base. They should be created as new suites or additions to existing suites before Clef Base implementation begins.

**New Multiverse suite (addition to repertoire):**

| Concept | Purpose | Key syncs |
|---|---|---|
| **VersionSpace** | Parallel reality overlays with copy-on-write entity overrides, recursive sub-spaces, membership, merge/proposal workflows (see §5.2) | `merge` → Versioning/`Merge/finalize`, `diff` → Versioning/`Diff/diff`, `fork_point` → Versioning/`ContentHash/store` |
| **VersionContext** | Per-user version space stack tracking and entity resolution (see §5.5) | `resolve_for` calls `VersionSpace/resolve` |
| **SearchSpace** | Scoped overlay indexes layered on base indexes — used by version spaces, group isolation, tenant isolation, staging previews | Layers on `SearchIndex`, `Backlink`, `SemanticEmbedding` |

Suite dependencies: `uses` versioning (for Diff, Merge, ContentHash), collaboration (for ConflictResolution), infrastructure (for PluginRegistry).

**New concepts for the Content suite (additions to existing suite):**

| Concept | Purpose | Replaces in Canvas |
|---|---|---|
| **SpatialConnector** | Typed connections between spatial items — visual-only, semantic (backed by Reference), surfaced (discovered from existing References). Connector operations: draw, promote, demote, surface, hide. | Canvas §3.7.3 connector operations |
| **Frame** | Named spatial regions for grouping items with bounds, background, navigation index. | Canvas §3.7.2 frame items |
| **SpatialLayout** | Layout algorithm dispatch (force-directed, hierarchical, grid, circular) via PluginRegistry coordination+provider pattern. | Canvas §3.7.4 layout algorithms |
| **Shape** | Basic geometric primitives with fill, stroke, text. Independently useful outside Canvas (diagram concepts, flowcharts). | Canvas §3.7.2 shape items |

The existing Canvas concept (@version(2)) should be extended to @version(3) with `removeItem` and `resizeItem` actions — its scope stays focused on spatial placement.

**Potential new automation providers (additions to existing suites):**

| Provider concept | Suite | Purpose |
|---|---|---|
| **LLMAutomationProvider** | LLM-Core or new integration suite | Execute automation actions via LLM calls |
| **WebhookAutomationProvider** | Process-Automation | Fire outgoing webhooks as automation actions |
| **ProcessAutomationProvider** | Process-Foundation | Trigger ProcessSpec execution from automation rules |
| **GovernanceAutomationProvider** | Governance-Execution | Route actions through governance gates |

All follow the existing coordination+provider pattern in the Automation Providers suite.

---

### 14.2 Concepts that stay Clef-Base-specific

These concepts are specific to the Clef Base application platform and do not belong in the repertoire:

- **entity-lifecycle** — A syncs-only suite (zero concepts) containing seven cross-cutting lifecycle syncs that fire on ContentStorage completions: cache invalidation, search indexing, URL alias generation, provenance tracking, backlink reindexing, cascade deletion, and date-field references to daily notes (revision tracking is covered because ContentStorage automatically sets `updated_at`, which is a DateTime field). See §2.1.2. Schema-specific domain behavior is handled by hook syncs generated from `schema.yaml` at install time (§2.1.3) — these are separate from the lifecycle suite. Alias namespace syncs (for version spaces, groups, tenants) are also separate — they fire on Alias actions and live in their respective integration suites (§5.6, §2.2.4).

- **ConceptBrowser** — The package discovery, preview, installation, update, and removal concept (see §10.2.1 for full spec). Owns installed package state, registry connections, preview computations, dependency resolution results, and installation history. Orchestrates the nine-step installation workflow (§10.2.3) through sync chains, with transactional rollback on failure. *Note: the repertoire already has a Package suite (Manifest, Resolver, Lockfile, Registry, etc.) — ConceptBrowser is the Clef-Base-specific orchestrator that composes those concepts with the shared ContentNode pool and Schema system.*

- **AppShell** — The root derived concept that composes all of Clef Base's features into a single application. Composes ConceptBrowser and the default suites. Its surface actions map to the content UI entry point, the admin UI entry point, and the concept browser. Its operational principle: "After installing Clef Base, create content entities through the content UI, configure the application through the admin UI, and extend it through the concept browser."

- **ComponentMapping** — Admin-configured bindings between entity data and widget slots/props (see §3.5.1 for full spec). Owns mapping configs keyed by Schema+DisplayMode, with slot bindings (one or more sources per slot) and prop bindings (one source per prop). Provides the manual override path — when a ComponentMapping exists for a Schema+DisplayMode, the Renderer uses it instead of WidgetResolver's automatic resolution.

- **SlotSource** — Coordination concept with providers for pluggable data retrieval into widget slots and props (see §3.5.2 for full spec). Providers include entity_field, static_value, widget_embed (recursive nesting), view_embed, block_embed, menu, formula, and entity_reference_display. Each source carries a processor chain using Transform providers for truncation, date formatting, image styling, etc.

- **Version-space integration syncs** — `version-aware-load.sync`, `version-aware-save.sync`, `AutomationVersionDispatch.sync`, and other syncs that wire the Multiverse suite's VersionSpace/VersionContext to Clef Base's shared ContentNode pool and entity-lifecycle system (§5.6).

- **Schema definitions** — "Canvas", "Shape", "Frame", "Drawing", "Vocabulary", "TaxonomyTerm", "HasTags", "File", "Media", and all other Schema entities are Clef-Base-specific ContentNode types, not repertoire concepts.

- **schema.yaml mappings** — Per-suite deployment artifacts that map concept state fields to ContentNode Properties. These are Clef Base's mechanism for integrating repertoire concepts into the shared entity pool.

- **composition.yaml syncs** — Not a concept. `composition.yaml` files generate standard syncs at install time (§2.4.3), each firing on `Schema/applyTo` to auto-apply mixin schemas. These syncs are tagged with a `composition` pattern for filtering in the sync browser. Admins manage them through the sync browser (enable, disable, delete) and create new ones through the automation UI's composition shortcut.

---

## 15. What you can build

Clef Base is not one application — it is an application platform. The concept browser and the dual-manifest Bind architecture mean that the same platform can become:

- A **content management system** (Drupal-like): install content types, configure fields and views, build editorial workflows, deploy a website
- A **project management tool** (Notion-like): use the PageAsRecord triple-zone model, create task schemas with kanban views, embed queries in project pages, discover related tasks through the related zone
- A **knowledge base** (Roam-like): daily notes, backlinks, graph visualization, progressive formalization from freeform to structured
- A **CRM**: install customer/contact/deal schemas, configure sales pipeline workflows, build dashboards with formula-computed metrics
- A **data integration platform**: install connectors, configure capture pipelines, use progressive schema detection to structure incoming data
- An **internal tools builder**: use the Control concept for interactive forms, AutomationRule for business logic, Bind for API generation
- A **collaborative workspace** (with the Collaboration suite): real-time editing, CRDT-based conflict resolution, version history, attribution
- A **decentralized application**: on-chain governance and ownership via the web3 deployment target, with the oracle bridge (§7.4.3) keeping off-chain UX and on-chain consensus in sync

All of these emerge from the same concept library, configured through the admin UI, deployed through the same pipeline, and extensible through the concept browser. The platform captures Drupal's 20-year insight — that the most powerful CMS is the one that can become anything — and generalizes it to any application domain, any deployment target, and any programming paradigm through the Clef concept model.

---

## 16. Implementation plan: repertoire-first, then Clef Base

### 16.1 Principle: general concepts go in repertoire first

Clef Base should not contain general-purpose concepts. If a concept is independently useful outside the Clef Base application platform, it belongs in the repertoire. The implementation order reflects this: build general concepts first, then compose them into Clef Base via syncs, schema.yaml mappings, and derived concepts.

---

### 16.1.1 Implementation stack

Two categories of implementation work appear throughout this plan and should never be confused.

**Backend concept handlers** implement a concept's actions. Two distinct handler codebases cover all targets:

- **Next.js** — the canonical handler implementation and complete web target: fp-ts functional TypeScript concept handlers, functional React widgets, and a routing handler generator that produces Next.js API routes and page routes from the Bind manifest with per-route rendering strategy (SSR/SSG/SPA/ISR per RouteConfig). Wherever this plan says "Next.js handler", it means all three of these together.
- **Solidity** — full hand-implemented handlers for concepts declaring `capabilities { requires crypto; requires persistent-storage }` that are deployed on-chain in the web3 target. SolidityGen generates handler skeletons from concept specs (the same way TypeScriptGen generates Next.js skeletons), but the business logic inside each action must be fully implemented in Solidity. Foundry tests must also be fully implemented.

**Hono** is not a separate handler implementation. It is the same fp-ts concept handlers as Next.js mounted on a Hono router (running on Bun) for the desktop local server target. The Bind routing handler generator produces a Hono routing layer alongside the Next.js routing layer — no handler code is duplicated or reimplemented.

**Local runtimes** — mobile and desktop both run concept handlers locally rather than connecting to a remote server. The fp-ts handler code is identical to Next.js in both cases; only the storage adapter and server layer differ:

- **Mobile (React Native)** — fp-ts handlers bundle directly into the React Native JS runtime. No HTTP server layer — React Native calls handlers in-process. Storage: SQLite via a SQLite ContentNodePoolProvider adapter. Offline-first: Replica manages the local ContentNode copy, SyncPair handles bidirectional sync with the remote Next.js server when online, ConflictResolution resolves conflicts on sync. The local sync engine runs in the RN JS thread evaluating syncs against local SQLite state.
- **Desktop (GTK/WinUI/AppKit)** — fp-ts handlers mounted on a local Hono server running on Bun. Storage: SQLite via the same SQLite ContentNodePoolProvider adapter as mobile. Offline-first with optional server sync via SyncPair, same as mobile.

**Server topology by deployment target:**

- **Web** — Next.js on Vercel. Handles SSR/SSG/ISR/SPA per RouteConfig. PostgreSQL-backed ContentNodePoolProvider.
- **Mobile (iOS + Android)** — React Native frontend + fp-ts handlers in-process. SQLite-backed ContentNodePoolProvider. Replica + SyncPair sync to remote Next.js server when online.
- **Desktop (Linux/Windows/macOS)** — platform widget frontend + local Hono server on Bun. SQLite-backed ContentNodePoolProvider. Replica + SyncPair sync to remote Next.js server when online.
- **Watch (Apple Watch/Android Wear)** — WatchKit/WearCompose frontend. Connects to the remote Next.js server (or the phone's local runtime when on the same device). No independent local runtime on watch.
- **Web3** — Next.js off-chain; Solidity on-chain. Oracle bridge syncs keep them consistent.

**Widget implementation targets:**

- **Next.js** — functional React widgets (web)
- **React Native** — shared-logic React widget layer extended with RN primitives (iOS + Android). Shares ~70–80% of widget logic with Next.js via a headless shared React layer sitting below both. Native phone frameworks (SwiftUI, Compose) are not needed — React Native covers both platforms from one codebase.
- **AppKit** — macOS desktop widgets
- **WinUI** — Windows desktop widgets
- **GTK** — Linux desktop widgets
- **WatchKit** — Apple Watch widgets
- **WearCompose** — Android Wear widgets

---

### 16.2 Repertoire work (prerequisite to Clef Base)

#### Track A: Multiverse suite (new suite in repertoire)

**Rationale:** Parallel version spaces are useful in any collaborative Clef app, not just Clef Base.

1. Create the Multiverse suite in `repertoire/concepts/multiverse/`
2. Create `VersionSpace.concept` — the core overlay concept (§5.2 spec). All actions:
   - `fork`, `read`, `write`, `resolve`, `diff`, `merge`
   - `list_members`, `add_member`, `remove_member`
   - `propose`, `list_proposals`, `approve_proposal`, `reject_proposal`, `schedule_execution`
   - `execute_in_space` — sets VersionContext for a single action execution; required by the version-aware automation model (§16.4)
   - `sync_spaces`, `cherry_pick`, `rebase`, `promote_to_base`
3. Create `VersionContext.concept` (§5.5 spec). Actions: `push`, `pop`, `peek`, `resolve_for`, `is_active`, `list_active`
4. Create `SearchSpace.concept` (§5.6.1). Actions: `createLayer`, `removeLayer`, `query`, `invalidateLayer`
5. Create `suite.yaml` with `uses: [versioning, collaboration, infrastructure]`
6. Create syncs:
   - `versionspace-merge-delegates-to-merge.sync`
   - `versionspace-diff-delegates-to-diff.sync`
   - `versionspace-fork-stores-content-hash.sync`
   - `versionspace-conflict-delegates-to-conflict-resolution.sync`
   - `searchspace-layers-on-search-index.sync`
   - `searchspace-layers-on-backlink.sync`
   - `searchspace-layers-on-semantic-embedding.sync`
7. Implement Next.js handlers for VersionSpace, VersionContext, SearchSpace (all actions)
8. Create conformance tests for all three concepts

**Key design decision:** VersionSpace's `merge` action delegates to the Versioning suite's `Merge` concept, which already has pluggable strategies via PluginRegistry. VersionSpace adds entity-level orchestration on top.

---

#### Track B: Canvas decomposition (extend existing Content suite)

**Rationale:** Spatial connectors, frames, shapes, and layout algorithms are independently useful.

1. Extend Canvas concept to `@version(3)` — add `removeItem`, `resizeItem` actions
2. Create `SpatialConnector.concept`. Actions: `draw`, `promote`, `demote`, `surface`, `hide`, `list`, `delete`
3. Create `Frame.concept`. Actions: `create`, `resize`, `rename`, `addItem`, `removeItem`, `delete`, `list`
4. Create `Shape.concept`. Actions: `create`, `update`, `delete`, `list`
5. Create `SpatialLayout.concept` — layout algorithm dispatch (coordination concept). Actions: `apply`, `registerProvider`, `listProviders`
6. Create SpatialLayout provider concepts: `ForceDirectedLayout.concept`, `HierarchicalLayout.concept`, `GridLayout.concept`, `CircularLayout.concept`
7. Create syncs:
   - `canvas-connector-surface.sync`
   - `connector-promote-creates-reference.sync`
   - `frame-containment-check.sync`
   - `force-directed-layout-registration.sync`
   - `hierarchical-layout-registration.sync`
   - `grid-layout-registration.sync`
   - `circular-layout-registration.sync`
8. Implement Next.js handlers: SpatialConnector, Frame, Shape, SpatialLayout, all four layout providers
9. Update content `suite.yaml`
10. Create conformance tests for all new concepts and updated Canvas

---

#### Track C: Automation provider concepts (extend existing suites)

**Rationale:** Each provider type is useful in any Clef app with automations.

1. Create `LLMAutomationProvider.concept` in the LLM suite. Action: `execute(rule, context)` → `ok | error | ratelimited`
2. Create `WebhookAutomationProvider.concept` in process-automation. Action: `execute(rule, context)` → `ok | error | timeout | unreachable`
3. Create `ProcessAutomationProvider.concept` in process-foundation. Action: `execute(rule, context)` → `ok | error | blocked`
4. Create `GovernanceAutomationProvider.concept` in governance-execution. Action: `execute(rule, context)` → `ok | rejected | pending_quorum`
5. For each: implement Next.js handler, create registration sync and dispatch routing sync following the pattern in the automation-providers suite
6. Create conformance tests for each provider

---

#### Track D: Extension suite integration with automations

1. Create `automation-provider-contribution-point.sync`
2. Create `extension-install-registers-automation-providers.sync`

---

#### Track E: Ecosystem app extensions for package management (prerequisite to ConceptBrowser)

**Rationale:** ConceptBrowser delegates discovery, resolution, and download to the clef-* ecosystem apps. Those apps currently lack support for schema.yaml, composition.yaml, and .theme specs. See §10.2.6 for the full gap analysis.

**Phase E1 — clef-registry: ComponentManifest artifact coverage (high priority)**

1. Extend `ComponentManifest.concept` — add `schemas`, `compositions`, and `themes` state fields with per-field metadata. Implement Next.js handler changes
2. Update `component-manifest-on-publish.sync` — extract schema.yaml, composition.yaml, and .theme files from the published package blob
3. Extend `ComponentManifest/search` — support querying by Schema name, field name/type, composition rules, theme name
4. Add `ComponentManifest/register` parameter validation — reject if `schemas` reference concepts not in the package's `concepts` list (unless `from:` is absent)
5. Update `clef-registry/derived/clef-registry.derived` — add `searchBySchema`, `searchByTheme` surface queries
6. Create conformance tests

**Phase E2 — clef-registry: Publication pipeline validation (high priority)**

1. Extend `publish-gate.sync` — schema.yaml validation: field type validity, `from:` mapping correctness, `includes` reference validity, `removal_policy` values
2. Extend `publish-gate.sync` — composition.yaml validation: source/target schema existence, rule type validity
3. Extend `publish-gate.sync` — .theme file validation via ThemeParser
4. Extend `publish-gate.sync` — .widget file validation via WidgetParser
5. Update `Publisher/package` — deterministic content hash: sort files by path, SHA256 per file, SHA256 of concatenated `(path, hash)` pairs
6. Create conformance tests for publication rejection on each invalid artifact type

**Phase E3 — clef-registry: Download concept extension (medium priority)**

1. Add `kind: D -> { binary | package }` to `Download.concept` state. Implement Next.js handler changes
2. Update `Download/register` — accept `kind`; default `"binary"` for backward compatibility
3. Update `Download/resolve` — `kind: "package"` resolves by `(name, namespace, version)` → ContentStore blob URL
4. Update `download-register-on-publish.sync` — register both source package blob and pre-built binary artifacts on publish
5. Update clef-cli-bootstrap's `Download.concept` proxy — support `kind: "package"`
6. Create conformance tests for dual-kind resolution

**Phase E4 — clef-hub: Schema-aware browsing (high priority, parallelizable with E1–E2)**

1. Add `SchemaProxy.concept` to clef-hub. Actions: `lookupSchemas(module_id, version)`, `searchBySchema(query, field_filter)`. Implement Next.js handler
2. Update package detail page — display Schema fields, types, constraints, Schema-to-concept mappings, inheritance, composition rules, removal policies
3. Extend `RegistryProxy/search` — pass Schema-aware filter syntax through to ComponentManifest/search
4. Add faceted search UI — filter by package kind, Schema names, field types, theme names
5. Update `clef-hub/derived/clef-hub.derived` — add SchemaProxy surface queries and new search filters
6. Create conformance tests

**Phase E5 — clef-web: Package documentation (low priority, after E1–E4)**

1. Extend `clef-web/concepts/registry-proxy.concept` — add action to fetch package README. Implement Next.js handler changes
2. Add `docs-on-featured-publish.sync`
3. Update Outline generation — include a "Packages" navigation section

---

#### Track F: Version Space Surface widgets (§5.10)

**Rationale:** The version spaces system requires new interactor types, widget specs, affordance declarations, UISchema layout compositions, and surface-integration syncs. No new Surface concepts are needed. This track is exclusively widget and Surface work — no backend concept handlers apply.

**F1 — Interactor type additions (surface-component suite)**

1. `context-stack` — category: navigation; properties: `{ stackable: true, maxDepth: "unbounded", navigable: true, dismissable: true }`
2. `diff-view` — category: output; properties: `{ wayCount: 2 | 3, granularity: "field" | "line" | "character", interactive: boolean }`
3. `overlay-indicator` — category: output; properties: `{ position: "corner" | "border" | "inline", semantic: "modified" | "created" | "deleted" | "conflict" }`

**F2 — Widget spec files and target implementations**

Create seven `.widget` spec files and implement each in every applicable target. The shared React headless layer (logic and state, no platform primitives) is extracted first and shared between Next.js and React Native implementations.

**`context-breadcrumb.widget`** — serves `context-stack` on desktop/tablet. Affordance: specificity 10, platform: "desktop" | "tablet".
Targets: Next.js, AppKit, WinUI, GTK

**`context-badge.widget`** — serves `context-stack` on mobile and watch. Affordance: specificity 10, platform: "mobile" | "watch".
Targets: React Native, WearCompose, WatchKit

**`context-bar.widget`** — serves `context-stack` as persistent shell-chrome. Affordance: specificity 15, placement: "shell-chrome".
Targets: Next.js, React Native, AppKit, WinUI, GTK

**`diff-inline.widget`** — serves `diff-view` for compact/line-level diffs. Affordance: specificity 8, viewport: "compact" or granularity: "line".
Targets: Next.js, React Native, AppKit, WinUI, GTK

**`diff-side-by-side.widget`** — serves `diff-view` for field-level diffs on wide viewports. Affordance: specificity 12, viewport: "wide", granularity: "field". Wide-viewport only.
Targets: Next.js, AppKit, WinUI, GTK

**`diff-unified.widget`** — serves `diff-view` for character-level diffs. Affordance: specificity 10, granularity: "character".
Targets: Next.js, React Native, AppKit, WinUI, GTK

**`override-dot.widget`** — serves `overlay-indicator`. Affordance: specificity 10.
Targets: Next.js, React Native, AppKit, WinUI, GTK, WearCompose, WatchKit

**F3 — Affordance declarations**

Register one Affordance entry per widget spec (7 total) with WidgetResolver.

**F4 — UISchema layout compositions (§5.10.4)**

1. `merge-resolution-panel.uischema` — diff-view (3-way, interactive) + single-choice strategy picker + display-text preview + action-primary/action-secondary. Full YAML in §5.10.4
2. `version-comparison-panel.uischema` — two entity detail views side-by-side, each resolved through a different VersionContext; overridden fields decorated with `overlay-indicator`

**F5 — Surface integration syncs (surface-integration suite)**

1. `version-context-populates-shell-chrome.sync`
2. `override-indicator-decorates-entity-fields.sync`

---

#### Track G: Web3 integration (§7.4)

**G1 — EthereumL2Connector concept**

1. Create `EthereumL2Connector.concept` in `repertoire/concepts/data-integration/` — registers with PluginRegistry under `connector_protocol`. Standard Connector interface: `read(query)`, `write(data)`, `test()`, `discover()`
2. Implement Next.js handler (ethers.js or viem) — full business logic required
3. Create `ethereum-l2-connector-registration.sync`
4. Create conformance tests

**G2 — AbiDecoderFieldMapping concept**

1. Create `AbiDecoderFieldMapping.concept` — registers with PluginRegistry under `field_mapper`. Actions: `apply(data, mapper)`, `reverse(data, mapper)`
2. Implement Next.js handler (ethers.js ABI decoder) — full business logic required
3. Create `abi-decoder-fieldmapping-registration.sync`
4. Create conformance tests

**G3 — Bridge sync chain**

Ten `.sync` files implementing the oracle bridge (§7.4.4):

1. `oracle-read-chain-state.sync`
2. `oracle-decode-response.sync`
3. `oracle-write-to-chain.sync`
4. `oracle-submit-transaction.sync`
5. `oracle-await-finality.sync`
6. `oracle-finalized.sync`
7. `oracle-reorged.sync`
8. `oracle-event-capture.sync`
9. `oracle-event-to-entity.sync`
10. `oracle-loop-guard.sync`

**G4 — IPFS frontend deployment syncs**

1. `ipfs-publish-frontend.sync`
2. `ens-update-resolver.sync`

**G5 — ChainMonitor L2 provider variants**

1. Confirm or create `OptimismProvider.concept` — full Next.js handler implementation. Create registration sync
2. Confirm or create `ZkSyncProvider.concept` — full Next.js handler implementation. Create registration sync

**G6 — Solidity concept implementations**

SolidityGen generates handler skeletons for all concepts declaring `requires crypto` + `requires persistent-storage`. Each skeleton requires full Solidity business logic implementation and full Foundry test implementation.

---

### 16.3 Clef Base work (after repertoire and ecosystem extensions are ready)

#### Item 1: entity-lifecycle syncs-only suite (§2.1.2)

Zero concepts. Seven cross-cutting lifecycle syncs.

1. Create `clef-base/suites/entity-lifecycle/suite.yaml` — `concepts: {}`, all 7 syncs as `recommended` tier
2. Create seven `.sync` files:
   - `save-invalidates-cache.sync`
   - `save-indexes-search.sync`
   - `save-generates-alias.sync`
   - `save-tracks-provenance.sync`
   - `save-reindexes-backlinks.sync`
   - `delete-cascades.sync`
   - `date-fields-reference-daily-notes.sync`
3. Create conformance tests

---

#### Item 2: schema.yaml infrastructure (§2.1.1, §2.1.3, §2.4.3)

**2a — File format specifications**

1. Write the formal grammar for `schema.yaml` (see §2.4.2 for full format)
2. Write the formal grammar for `composition.yaml`

**2b — Parsers and validators**

1. Implement `schema.yaml` parser in Next.js
2. Implement `composition.yaml` parser in Next.js
3. Add local validation to `clef install` — same validator as Track E2

**2c — Hook sync generator**

1. Implement hook sync generator in Next.js: reads `schema.yaml` at install time, generates `.sync` files for each declared hook, tagged with `generated-hook`
2. Wire into ConceptBrowser/install — after schema.yaml parsing, before provider registration

**2d — schema.yaml files for bundled suites**

- `foundation/schema.yaml`
- `content/schema.yaml` — Canvas, Comment, DailyNote, Template
- `classification/schema.yaml` — Tag, Taxonomy
- `linking/schema.yaml` — Alias, Reference, Relation
- `media/schema.yaml` — FileManagement, MediaAsset
- `presentation/schema.yaml` — View
- `automation/schema.yaml` — AutomationRule
- `identity/schema.yaml` — roles only; auth/session state stays concept-local
- `versioning/schema.yaml` — Branch, TemporalVersion
- `collaboration/schema.yaml` — InlineAnnotation, Attribution

**2e — composition.yaml files for mixin schemas**

1. `has-tags.composition.yaml`
2. `commentable.composition.yaml`

---

#### Item 3: Version-space integration syncs (§5.6)

Syncs only — no concept handlers.

1. `version-aware-load.sync`
2. `version-aware-save.sync`
3. `AutomationVersionDispatch.sync`
4. `alias-namespace-stamp-versionspace.sync`
5. `alias-namespace-stamp-group.sync`
6. `alias-namespace-stamp-tenant.sync`
7. `alias-namespace-stamp-locale.sync`
8. `searchspace-layers-on-backlink.sync`
9. `searchspace-layers-on-semantic-embedding.sync`

---

#### Item 4: ComponentMapping + SlotSource (§3.5)

**4a — ComponentMapping concept**

1. Write `ComponentMapping.concept` spec (§3.5.1). Actions: `configure`, `getMapping`, `deleteMapping`, `listMappings`
2. Implement Next.js handler for all four actions
3. Create conformance tests

**4b — SlotSource coordination concept**

1. Write `SlotSource.concept` spec (§3.5.2). Action: `resolve(source_config, entity_id, context)` → resolved value
2. Implement Next.js handler
3. Create conformance tests

**4c — SlotSource provider concepts**

Concept spec and Next.js handler for each of the eight providers:

1. `EntityFieldSource`
2. `StaticValueSource`
3. `WidgetEmbedSource`
4. `ViewEmbedSource`
5. `BlockEmbedSource`
6. `MenuSource`
7. `FormulaSource`
8. `EntityReferenceDisplaySource`

For each: registration sync (PluginRegistry under `slot_source_provider`) and conformance tests.

**4d — Integration syncs**

1. `resolver-uses-component-mapping.sync`
2. `slot-source-dispatches-to-provider.sync`
3. Eight provider-registration syncs

---

#### Item 5: ConceptBrowser (§10.2)

*Hard prerequisites: E1 and E2. E3 needed before install works end-to-end. E4 and E5 can proceed in parallel.*

**5a — ConceptBrowser concept spec** — full action inventory (§10.2.1):

- `search`, `preview`, `install`, `update`, `remove`, `rollback`, `pin`, `configure`, `list`, `listInstalled`

**5b — Next.js handler** — full implementation of all ten actions

**5c — Installation workflow syncs**

1. `concept-browser-install-resolves-deps.sync`
2. `concept-browser-install-checks-lockfile.sync`
3. `concept-browser-install-downloads.sync`
4. `concept-browser-install-validates.sync`
5. `concept-browser-install-migrates.sync`
6. `concept-browser-install-activates.sync`
7. `concept-browser-install-registers-providers.sync`
8. `concept-browser-install-hooks.sync`
9. `concept-browser-install-indexes.sync`
10. `concept-browser-rollback.sync`

**5d — Suite and tests**

1. `suite.yaml` with `uses: [package, foundation, classification, infrastructure]`
2. Conformance tests: successful install, dependency conflict, rollback on validation failure, update with migration, removal with dependent check

---

#### Item 6: AppShell (§14.2)

1. Write `AppShell.derived` spec
2. Create `AppShell.suite.yaml`
3. Create conformance tests

---

#### Item 7: Schema definitions (§14.2)

1. **Canvas.schema**
2. **Shape.schema**
3. **Frame.schema**
4. **Drawing.schema** — composite: Canvas + Frame + Shape; `drawing.composition.yaml`
5. **Vocabulary.schema**
6. **TaxonomyTerm.schema**
7. **HasTags.schema** (mixin) — `has-tags.composition.yaml`
8. **Commentable.schema** (mixin) — `commentable.composition.yaml`
9. **File.schema**
10. **Media.schema**
11. **RouteConfig.schema**

---

#### Item 8: Storage adapters

Two ContentNodePoolProvider storage adapters are required — one for PostgreSQL (web) and one for SQLite (mobile and desktop). The pool provider interface is identical; only the storage backend differs.

**8a — PostgreSQL ContentNodePoolProvider adapter**

1. Implement `PostgreSQLPoolAdapter` — implements the `ConceptStorage` interface against a PostgreSQL backend. Mapped fields → ContentNode Properties table. Unmapped fields → concept-local side tables. Set membership → Schema membership queries
2. Register with PluginRegistry under `content_storage_provider`; configured as the default for web and web3 deployment targets
3. Conformance tests: mapped field round-trip, unmapped field isolation, cross-Schema query, conflict resolution delegation

**8b — SQLite ContentNodePoolProvider adapter**

1. Implement `SQLitePoolAdapter` — same `ConceptStorage` interface as PostgreSQL adapter but backed by SQLite (via better-sqlite3 in React Native's JS runtime and in Bun for desktop). Schema is identical — same tables, same queries, different driver
2. Register with PluginRegistry under `content_storage_provider`; configured as the default for mobile and desktop deployment targets
3. Conformance tests: same test suite as PostgreSQL adapter, run against SQLite

**8c — Replica + SyncPair wiring for offline-first targets**

Mobile and desktop both use Replica for local state management and SyncPair for sync with the remote Next.js server. This wiring is the same for both targets.

1. Create `offline-first-suite/suite.yaml` — syncs-only suite (zero concepts)
2. Create syncs:
   - `replica-initializes-from-remote.sync` — on first launch or explicit pull, fetches the current state of all ContentNodes from the remote Next.js API via SyncPair and populates the local SQLite pool
   - `replica-syncs-on-connection.sync` — on network reconnect, calls SyncPair/sync to push local changes and pull remote changes
   - `replica-resolves-conflicts-on-sync.sync` — on SyncPair/sync → `conflict`, delegates to ConflictResolution with the configured strategy (LWW for non-collaborative fields, AddWins for tags by default)
   - `replica-queues-writes-when-offline.sync` — on ContentStorage/save while offline (network unavailable), enqueues the write to Queue for replay when SyncPair/sync next fires
   - `replica-applies-remote-changes.sync` — on SyncPair/sync → `ok(remote_changes)`, applies each remote change to the local SQLite pool via ContentStorage/save, skipping conflict detection for non-conflicting changes
3. Conformance tests: offline write queues correctly; reconnect triggers sync; conflict resolution fires on diverged writes; remote changes apply cleanly to local pool

---

#### Item 9: Deployment manifests (§7, §11, §13)

1. **`web.deploy.yaml`** — Runtime: Vercel. Target: Next.js (fp-ts handlers + functional React widgets + routing handler generator). Storage: PostgreSQL ContentNodePoolProvider. Rendering: RouteConfig schema controls SSR/SSG/SPA/ISR per route
2. **`phone.deploy.yaml`** — Target: React Native (iOS + Android). Runtime: fp-ts handlers in-process in RN JS runtime. Storage: SQLite ContentNodePoolProvider. Offline-first: Replica + SyncPair + ConflictResolution (offline-first-suite). Sync target: remote Next.js server via Bind-generated REST API
3. **`desktop-linux.deploy.yaml`** — Target: GTK. Local server: Hono on Bun (same fp-ts handlers, Hono routing layer). Storage: SQLite ContentNodePoolProvider. Offline-first: offline-first-suite. Sync target: remote Next.js server
4. **`desktop-windows.deploy.yaml`** — Target: WinUI. Local server: Hono on Bun. Storage: SQLite. Offline-first: offline-first-suite
5. **`desktop-macos.deploy.yaml`** — Target: AppKit. Local server: Hono on Bun. Storage: SQLite. Offline-first: offline-first-suite
6. **`web3.deploy.yaml`** — Runtime: Vercel (off-chain) + Ethereum L2 (on-chain). Target: Next.js (off-chain) + Solidity (on-chain, full implementation required). Storage: federated (PostgreSQL off-chain, EthereumL2Connector on-chain). ChainMonitor: Optimism or zkSync per config. IPFS for media + static frontend. ENS name for frontend resolution
7. **`watch-apple.deploy.yaml`** — Target: WatchKit. Runtime: connects to phone's local RN runtime when paired, or remote Next.js server directly. Display-only: notifications and read-only entity summaries
8. **`watch-android.deploy.yaml`** — Target: WearCompose. Runtime: connects to phone's local RN runtime when paired, or remote Next.js server directly. Display-only same as above

---

#### Item 10: Hono routing layer

The Bind routing handler generator currently produces a Next.js routing layer. A Hono target must be added so desktop apps can run a local server with the same fp-ts handlers.

1. Add Hono as a target in the Bind routing handler generator — produces a Hono router mounting all concept action handlers at the correct endpoints, mirroring the Next.js API route structure
2. Add `hono` as a Target provider in the Interface suite (alongside Rest, GraphQL, gRPC, CLI, MCP, ClaudeSkills)
3. Implement the Hono Target provider — generates Hono route files from the ConceptManifest IR
4. Conformance tests: Hono-generated routes match Next.js-generated routes for the same manifest

---

#### Item 11: Authorization wiring (§8.1)

Syncs-only suite — zero concepts.

1. Create `clef-base/suites/identity-integration/suite.yaml` — `concepts: {}`, all syncs as `required` tier
2. Create syncs:
   - `access-control-on-content-load.sync`
   - `access-control-on-content-save.sync`
   - `access-control-on-schema-apply.sync`
3. Create default role entity configs: `admin`, `editor`, `viewer`
4. Create default Permission entities linking roles to Schemas
5. Conformance tests

---

#### Item 12: Triple-zone entity page Surface wiring (§3.1)

No new concept handlers — Surface and sync work only.

1. Create `triple-zone-layout.uischema` — Zone 1: fieldset widget; Zone 2: canvas-embed widget; Zone 3: entity-list widget (SemanticEmbedding + Backlink + Reference)
2. Create DisplayMode entity "entity-page"; set as default for all ContentNodes
3. Implement `triple-zone-layout` widget in each target that renders entity pages: Next.js, React Native, AppKit, WinUI, GTK
4. Create surface-integration syncs:
   - `entity-page-uses-triple-zone.sync`
   - `related-zone-populates-via-embedding.sync`
   - `block-zone-renders-via-canvas.sync`
5. Conformance tests

---

#### Item 13: Dual-manifest Bind wiring (§6)

1. Create `config.interface.yaml` — admin-facing: content type management, field configuration, view builder, workflow config, automation rules, theme settings, deploy config, ConceptBrowser, Score navigation. Targets: REST + GraphQL + CLI + MCP
2. Create `content.interface.yaml` — user-facing: ContentNode CRUD per Schema, search, collaboration, media upload, notification preferences. Targets: REST + GraphQL + Next.js routing generator + Hono routing generator + typed clients for React Native
3. Run the Bind generation pipeline for both manifests — Next.js and Hono routing generators both run as part of this step
4. Conformance tests

---

#### Item 14: Score UI integration (§10.1)

Score UI is admin-only — Next.js only for widget implementations.

1. Create DisplayMode "score-graph" entity config
2. Create `score-impact-panel.uischema`
3. Create `score-trace-panel.uischema`
4. Implement `score-impact-panel` — Next.js
5. Implement `score-trace-panel` — Next.js
6. Create `score-graph-renders-via-graph-widget.sync`
7. Register Score entry points in `config.interface.yaml`
8. Conformance tests

---

### 16.4 Automation + Multiverse interaction model

The version-aware automation model (§5.9) requires syncs bridging the Multiverse suite and the Automation Providers suite. This integration lives in Clef Base because it depends on the shared ContentNode pool.

```
Automation path in a version space:

1. User saves entity in VersionSpace "Hypothesis A"
2. version-aware-save.sync writes override to VersionSpace
3. ContentStorage/save fires lifecycle syncs (entity-lifecycle suite)
4. AutomationRule/triggered fires for matching rules
5. AutomationVersionDispatch.sync checks rule.version_scope:
   - "base"      → skip (we're in a version space)
   - "current"   → dispatch with VersionContext pointing to "Hypothesis A"
   - "all"       → enumerate all active spaces, dispatch in each
   - "propagate" → dispatch in base, then VersionSpace/write to non-overridden spaces
6. AutomationDispatch/dispatch routes to provider (Manifest, Sync, LLM, Webhook, etc.)
7. Provider executes within the resolved VersionContext
```

VersionSpace needs `execute_in_space(space, action, params)` to set the VersionContext for a single action execution — already included in Track A step 2.

---

### 16.5 Summary: what goes where

| Artifact | Location | Why |
|---|---|---|
| VersionSpace, VersionContext, SearchSpace | Repertoire: `multiverse/` suite | General-purpose parallel reality |
| SpatialConnector, Frame, Shape, SpatialLayout + providers | Repertoire: extend `content/` suite | General-purpose spatial content |
| LLMAutomationProvider, WebhookAutomationProvider, ProcessAutomationProvider, GovernanceAutomationProvider | Repertoire: respective suites | General-purpose automation backends |
| Extension ↔ Automation integration syncs | Repertoire: `extension/` + `automation-providers/` | General-purpose plugin extensibility |
| context-stack / diff-view / overlay-indicator interactor types | Repertoire: surface-component suite | Reusable across any versioned app |
| 7 .widget specs + all target implementations | Repertoire: surface-spec suite | Reusable widgets |
| Merge resolution + version comparison UISchemas | Repertoire: surface-integration suite | Reusable layout compositions |
| Surface integration syncs (version context, override indicator) | Repertoire: surface-integration suite | Reusable surface bridging |
| EthereumL2Connector, AbiDecoderFieldMapping, OptimismProvider, ZkSyncProvider | Repertoire: `data-integration/` + `web3/` suites | General-purpose web3 connectors |
| Oracle bridge syncs (10), IPFS/ENS syncs | Repertoire: `web3/` suite | Reusable bridge pattern |
| ComponentManifest extensions + publish-gate validation | `clef-registry/` (Track E1–E2) | Registry integrity and Schema-aware discovery |
| Download kind: "package" | `clef-registry/` + `clef-cli-bootstrap/` (Track E3) | Source package download |
| SchemaProxy + faceted search | `clef-hub/` (Track E4) | Web-based Schema browsing |
| Package README proxy + docs pages | `clef-web/` (Track E5) | Curated documentation |
| Hono target in Bind routing generator | Interface suite | Reusable desktop local server target |
| entity-lifecycle syncs-only suite | Clef Base | Fires on shared ContentNode pool |
| schema.yaml + composition.yaml parsers + hook sync generator | Clef Base | Pool-provider initialization; install-time generation |
| schema.yaml files for all bundled suites | Clef Base | Deployment artifacts |
| Version-space integration syncs (9) | Clef Base | Depends on shared ContentNode pool |
| ConceptBrowser, AppShell, ComponentMapping, SlotSource + 8 providers | Clef Base | Application-platform-specific orchestration |
| Schema definitions (11 schemas + composition.yaml files) | Clef Base | Schema is a Clef Base entity concept |
| PostgreSQL ContentNodePoolProvider adapter | Clef Base | Web/web3 storage backend |
| SQLite ContentNodePoolProvider adapter | Clef Base | Mobile + desktop local storage backend |
| offline-first-suite (Replica + SyncPair wiring syncs) | Clef Base | Mobile + desktop offline-first pattern |
| Deployment manifests (8 targets) | Clef Base | Per-application deployment configuration |
| Authorization wiring (identity-integration syncs) | Clef Base | Pre-wires Identity suite to ContentNode CRUD |
| Triple-zone entity page UISchema + target implementations | Clef Base | ContentNode-specific layout |
| Dual-manifest Bind wiring + routing generator runs | Clef Base | Application-specific interface boundary |
| Score UI panel widgets (Next.js only) + config manifest entries | Clef Base | Admin UI only |

---

### 16.6 Implementation checklist

Every artifact required for a complete initial delivery. **[R]** = repertoire. **[CB]** = Clef Base. "Next.js handler" means fp-ts handlers + functional React widgets + routing integration. "Solidity implementation" means full hand-written business logic — SolidityGen produces the skeleton only.

**Multiverse suite [R]**
- [x] VersionSpace.concept
- [x] VersionContext.concept
- [x] SearchSpace.concept
- [x] 7 sync files
- [x] VersionSpace — Next.js handler
- [x] VersionContext — Next.js handler
- [x] SearchSpace — Next.js handler
- [x] suite.yaml
- [x] Conformance tests (3 concepts)

**Content suite extensions [R]**
- [x] Canvas.concept @version(3)
- [x] SpatialConnector.concept — Next.js handler
- [x] Frame.concept — Next.js handler
- [x] Shape.concept — Next.js handler
- [x] SpatialLayout.concept (coordination) — Next.js handler
- [x] ForceDirectedLayout.concept — Next.js handler
- [x] HierarchicalLayout.concept — Next.js handler
- [x] GridLayout.concept — Next.js handler
- [x] CircularLayout.concept — Next.js handler
- [x] 7 sync files
- [x] Conformance tests

**Automation provider concepts [R]**
- [x] LLMAutomationProvider.concept — Next.js handler
- [x] WebhookAutomationProvider.concept — Next.js handler
- [x] ProcessAutomationProvider.concept — Next.js handler
- [x] GovernanceAutomationProvider.concept — Next.js handler
- [x] 8 sync files
- [x] Conformance tests

**Extension ↔ Automation syncs [R]**
- [x] automation-provider-contribution-point.sync
- [x] extension-install-registers-automation-providers.sync

**Version Space Surface [R]**
- [x] context-stack interactor type
- [x] diff-view interactor type
- [x] overlay-indicator interactor type
- [x] Shared React headless widget layer (logic/state, shared by Next.js and React Native)
- [x] context-breadcrumb.widget spec — Next.js — AppKit — WinUI — GTK
- [x] context-badge.widget spec — React Native — WearCompose — WatchKit
- [x] context-bar.widget spec — Next.js — React Native — AppKit — WinUI — GTK
- [x] diff-inline.widget spec — Next.js — React Native — AppKit — WinUI — GTK
- [x] diff-side-by-side.widget spec — Next.js — AppKit — WinUI — GTK
- [x] diff-unified.widget spec — Next.js — React Native — AppKit — WinUI — GTK
- [x] override-dot.widget spec — Next.js — React Native — AppKit — WinUI — GTK — WearCompose — WatchKit
- [x] 7 affordance declarations
- [x] merge-resolution-panel.uischema
- [x] version-comparison-panel.uischema
- [x] version-context-populates-shell-chrome.sync
- [x] override-indicator-decorates-entity-fields.sync

**Web3 provider concepts [R]**
- [x] EthereumL2Connector.concept — Next.js handler (full implementation)
- [x] AbiDecoderFieldMapping.concept — Next.js handler (full implementation)
- [x] OptimismProvider.concept — Next.js handler (full implementation)
- [x] ZkSyncProvider.concept — Next.js handler (full implementation)
- [x] 10 oracle bridge sync files
- [x] ipfs-publish-frontend.sync
- [x] ens-update-resolver.sync
- [x] Solidity implementations for on-chain concepts (SolidityGen skeletons + full business logic + Foundry tests)
- [x] Conformance tests

**clef-registry (E1–E2) [R]**
- [x] ComponentManifest.concept extensions — Next.js handler update
- [x] component-manifest-on-publish.sync update
- [x] publish-gate.sync validation extensions
- [x] Publisher/package deterministic hash update
- [x] clef-registry.derived surface query updates
- [x] Conformance tests

**clef-registry (E3) [R]**
- [x] Download.concept kind field — Next.js handler update
- [x] download-register-on-publish.sync update
- [x] clef-cli-bootstrap Download proxy update
- [x] Conformance tests

**clef-hub (E4) [R]**
- [x] SchemaProxy.concept — Next.js handler
- [x] RegistryProxy/search update
- [x] Faceted search UI — Next.js widget
- [x] clef-hub.derived update
- [x] Conformance tests

**clef-web (E5) [R]**
- [x] registry-proxy.concept README fetch — Next.js handler update
- [x] docs-on-featured-publish.sync
- [x] Outline generation update

**entity-lifecycle suite [CB]**
- [x] suite.yaml (zero concepts)
- [x] 7 sync files
- [x] Conformance tests

**schema.yaml infrastructure [CB]**
- [x] schema.yaml grammar spec
- [x] composition.yaml grammar spec
- [x] schema.yaml parser — Next.js
- [x] composition.yaml parser — Next.js
- [x] Hook sync generator — Next.js
- [x] schema.yaml files (10 bundled suites)
- [x] composition.yaml files (drawing, has-tags, commentable)
- [x] Conformance tests

**Version-space integration syncs [CB]**
- [x] 9 sync files

**ComponentMapping + SlotSource [CB]**
- [x] ComponentMapping.concept — Next.js handler
- [x] SlotSource.concept (coordination) — Next.js handler
- [x] EntityFieldSource — Next.js handler
- [x] StaticValueSource — Next.js handler
- [x] WidgetEmbedSource — Next.js handler
- [x] ViewEmbedSource — Next.js handler
- [x] BlockEmbedSource — Next.js handler
- [x] MenuSource — Next.js handler
- [x] FormulaSource — Next.js handler
- [x] EntityReferenceDisplaySource — Next.js handler
- [x] 10 sync files
- [x] Conformance tests

**ConceptBrowser [CB]**
- [x] ConceptBrowser.concept
- [x] ConceptBrowser — Next.js handler (10 actions, full implementation)
- [x] 10 installation workflow sync files
- [x] suite.yaml
- [x] Conformance tests

**AppShell [CB]**
- [x] AppShell.derived spec
- [x] AppShell suite.yaml
- [ ] Conformance tests

**Schema definitions [CB]**
- [x] 11 schema entity config files
- [x] drawing.composition.yaml
- [x] has-tags.composition.yaml
- [x] commentable.composition.yaml

**Storage adapters [CB]**
- [x] PostgreSQLPoolAdapter — Next.js implementation (full)
- [x] SQLitePoolAdapter — Next.js implementation (full, runs in RN JS runtime and Bun)
- [x] PluginRegistry registration sync for each adapter
- [x] Conformance tests (same test suite run against both adapters)

**offline-first-suite [CB]**
- [x] suite.yaml (zero concepts)
- [x] replica-initializes-from-remote.sync
- [x] replica-syncs-on-connection.sync
- [x] replica-resolves-conflicts-on-sync.sync
- [x] replica-queues-writes-when-offline.sync
- [x] replica-applies-remote-changes.sync
- [x] Conformance tests: offline write queuing, reconnect sync, conflict resolution, remote change application

**Deployment manifests [CB]**
- [x] web.deploy.yaml (Next.js + PostgreSQL)
- [x] phone.deploy.yaml (React Native + SQLite + offline-first-suite)
- [x] desktop-linux.deploy.yaml (GTK + Hono + SQLite + offline-first-suite)
- [x] desktop-windows.deploy.yaml (WinUI + Hono + SQLite + offline-first-suite)
- [x] desktop-macos.deploy.yaml (AppKit + Hono + SQLite + offline-first-suite)
- [x] web3.deploy.yaml (Next.js + PostgreSQL + Solidity)
- [x] watch-apple.deploy.yaml (WatchKit)
- [x] watch-android.deploy.yaml (WearCompose)

**Hono routing layer [CB]**
- [x] Hono Target provider concept — Next.js handler
- [x] Hono route file generator (added to Bind routing handler generator)
- [x] Hono registration sync (Interface suite)
- [x] Conformance tests (Hono routes match Next.js routes for same manifest)

**Authorization wiring [CB]**
- [x] identity-integration suite.yaml (zero concepts)
- [x] 3 sync files
- [x] Default role + permission entity config files
- [ ] Conformance tests

**Triple-zone entity page [CB]**
- [x] Shared React headless triple-zone layer (logic/state)
- [x] triple-zone-layout.uischema
- [x] DisplayMode "entity-page" entity config
- [x] triple-zone-layout — Next.js
- [ ] triple-zone-layout — React Native
- [ ] triple-zone-layout — AppKit
- [ ] triple-zone-layout — WinUI
- [ ] triple-zone-layout — GTK
- [x] 3 surface-integration sync files
- [ ] Conformance tests

**Dual-manifest Bind wiring [CB]**
- [x] config.interface.yaml
- [x] content.interface.yaml
- [x] Bind generation run (Next.js routing generator + Hono routing generator)
- [ ] Conformance tests

**Score UI integration [CB]**
- [x] DisplayMode "score-graph" entity config
- [x] score-impact-panel.uischema
- [x] score-trace-panel.uischema
- [x] score-impact-panel — Next.js
- [x] score-trace-panel — Next.js
- [x] score-graph-renders-via-graph-widget.sync
- [x] Score entries in config.interface.yaml
- [ ] Conformance tests

**Rationale:** Parallel version spaces are useful in any collaborative Clef app, not just Clef Base. A research tool, a wiki, a governance platform — all could use VersionSpace independently.

1. Create the Multiverse suite in `repertoire/concepts/multiverse/`
2. Create `VersionSpace.concept` — the core overlay concept (§5.2 spec)
3. Create `VersionContext.concept` — per-user stack tracking (§5.5 spec)
4. Create `SearchSpace.concept` — scoped overlay indexes (§5.6.1)
5. Create suite.yaml with `uses: [versioning, collaboration, infrastructure]`
6. Create syncs:
   - `versionspace-merge-delegates-to-merge.sync` (VersionSpace/merge → Merge/finalize)
   - `versionspace-diff-delegates-to-diff.sync` (VersionSpace/diff → Diff/diff)
   - `versionspace-fork-stores-content-hash.sync` (VersionSpace/fork → ContentHash/store)
   - `versionspace-conflict-delegates-to-conflict-resolution.sync`
   - `searchspace-layers-on-search-index.sync`
7. Create handlers for all three concepts
8. Create conformance tests

**Key design decision:** VersionSpace's `merge` action delegates to the Versioning suite's `Merge` concept, which already has pluggable strategies (ThreeWayMerge, RecursiveMerge, LatticeMerge, SemanticMerge) via PluginRegistry. No new merge infrastructure needed — VersionSpace adds entity-level orchestration on top.

#### Track B: Canvas decomposition (extend existing Content suite)

**Rationale:** Spatial connectors, frames, shapes, and layout algorithms are independently useful. A diagram tool, a mind map, a flowchart builder — all could use these without the full Canvas + ContentNode model.

1. Extend Canvas concept to @version(3) — add `removeItem`, `resizeItem`
2. Create `SpatialConnector.concept` — typed connections between spatial items
3. Create `Frame.concept` — named spatial regions
4. Create `Shape.concept` — geometric primitives
5. Create `SpatialLayout.concept` — layout algorithm coordination+provider
6. Create SpatialLayout providers: `ForceDirectedLayout`, `HierarchicalLayout`, `GridLayout`, `CircularLayout`
7. Create syncs:
   - `canvas-connector-surface.sync` (Canvas/addNode → SpatialConnector/surfaceExistingReferences)
   - `connector-promote-creates-reference.sync` (SpatialConnector/promoteConnector → Reference/addRef)
   - `frame-containment-check.sync` (Canvas/addNode → Frame/checkContainment)
   - SpatialLayout provider registration syncs
8. Update content suite.yaml
9. Create handlers and conformance tests

#### Track C: Automation provider concepts (extend existing suites)

**Rationale:** Each provider type is useful in any Clef app with automations, not just Clef Base.

1. Create `LLMAutomationProvider.concept` in the LLM suite (or a new llm-automation integration suite)
2. Create `WebhookAutomationProvider.concept` in process-automation
3. Create `ProcessAutomationProvider.concept` in process-foundation
4. Create `GovernanceAutomationProvider.concept` in governance-execution
5. For each: registration sync + dispatch routing sync following the pattern in automation-providers suite
6. Create handlers and tests

#### Track D: Extension suite integration with automations

**Rationale:** The Extension suite's ContributionPoint concept already provides the mechanism for plugins to contribute to extension points. Automation providers should be discoverable as contribution points.

1. Create sync: `automation-provider-contribution-point.sync` — defines an `automation-provider` ContributionPoint that extensions can contribute to
2. Create sync: `extension-install-registers-automation-providers.sync` — when an extension with automation provider contributions is installed, auto-register with PluginRegistry
3. This enables third-party extensions (installed via ConceptBrowser in Clef Base, or ExtensionHost in any Clef app) to add new automation provider types at runtime

#### Track E: Ecosystem app extensions for package management (prerequisite to ConceptBrowser)

**Rationale:** ConceptBrowser (§10.2) delegates discovery, resolution, and download to the clef-* ecosystem apps. Those apps currently lack support for the new artifact types (schema.yaml, composition.yaml, .theme specs) that the package management workflow requires. These extensions must land before ConceptBrowser can be implemented — ConceptBrowser's `preview` action depends on Schema-aware ComponentManifest data, and its `search` action depends on Schema-aware registry filtering. See §10.2.6 for the full gap analysis and artifact coverage matrix.

**Phase E1 — clef-registry: ComponentManifest artifact coverage (high priority)**

1. Extend `ComponentManifest.concept` — add `schemas`, `compositions`, and `themes` state fields (see §10.2.6 for full field definitions). The `schemas` field must include per-field metadata (name, type, `from:` mapping, mutability, constraints) to support Schema-aware search
2. Update `component-manifest-on-publish.sync` — extract schema.yaml, composition.yaml, and .theme files from the published package blob and populate the new ComponentManifest fields
3. Extend `ComponentManifest/search` action — support querying by Schema name, Schema field name/type, composition rules, and theme name. This is what ConceptBrowser/search and clef-hub's search UI will delegate to
4. Add `ComponentManifest/register` parameter validation — reject registration if `schemas` reference concepts not present in the package's `concepts` list (unless the `from:` field is absent, indicating an operational Schema field)
5. Update `clef-registry/derived/clef-registry.derived` — add the new ComponentManifest surface queries (`searchBySchema`, `searchByTheme`) to the derived concept's surface query section
6. Create conformance tests for Schema-aware component manifest registration and search

**Phase E2 — clef-registry: Publication pipeline validation (high priority)**

1. Extend `publish-gate.sync` — add schema.yaml validation: check field type validity against known types, verify `from:` mappings reference actual concept state fields in the package, validate `includes` references to schemas within the package or declared dependencies, validate `removal_policy` values
2. Extend `publish-gate.sync` — add composition.yaml validation: verify source and target schemas exist in the package or its declared dependencies, validate rule types (`auto_apply`, conditional)
3. Extend `publish-gate.sync` — add .theme file validation via ThemeParser (currently only .concept and .sync files are validated at publish time)
4. Extend `publish-gate.sync` — add .widget file validation via WidgetParser (currently indexed in ComponentManifest but not parsed/validated at publish time)
5. Update `Publisher/package` — ensure content hash computation includes schema.yaml, composition.yaml, and .theme files. Implement deterministic hash: sort all package files by path, compute per-file SHA256, then SHA256 the concatenated `(path, hash)` pairs
6. Create conformance tests for publication rejection on invalid schema.yaml, composition.yaml, and .theme files

**Phase E3 — clef-registry: Download concept extension (medium priority)**

1. Add `kind` field to `Download.concept` state: `kind: D -> { binary | package }`. Binary is the existing per-platform artifact mode (used by clef-cli-bootstrap). Package is the new source-package mode (used by ConceptBrowser/install)
2. Update `Download/register` — accept `kind` parameter; default to `"binary"` for backward compatibility
3. Update `Download/resolve` — accept optional `kind` filter; when `kind: "package"`, resolve by `(name, namespace, version)` → ContentStore blob URL instead of `(artifact_id, platform, version_range)` → CDN URL
4. Update `download-register-on-publish.sync` — register both source package blob (kind: "package") and any pre-built binary artifacts (kind: "binary") on publish
5. Update clef-cli-bootstrap's `Download.concept` (proxy) — support `kind: "package"` so `clef install` can fetch source packages
6. Create conformance tests for dual-kind resolution

**Phase E4 — clef-hub: Schema-aware browsing (high priority, parallelizable with E1–E2)**

1. Add `SchemaProxy.concept` to clef-hub (or extend `RegistryProxy`) — proxy ComponentManifest schema data to the hub frontend, with actions: `lookupSchemas(module_id, version)`, `searchBySchema(query, field_filter)`
2. Update clef-hub's package detail page — display Schema fields with types and constraints, Schema-to-concept mappings, Schema inheritance, composition rules, and removal policies
3. Extend `RegistryProxy/search` — support the Schema-aware filter syntax from clef-registry (Phase E1 step 3), passing structured filters through to ComponentManifest/search
4. Add faceted search UI — filter by package kind (suite, concept, schema-only, theme), Schema names, Schema field types, theme names
5. Update `clef-hub/derived/clef-hub.derived` — add SchemaProxy surface queries and the new search filters to the derived concept
6. Create conformance tests for schema proxy and faceted search

**Phase E5 — clef-web: Package documentation (low priority, after E1–E4)**

1. Extend `clef-web/concepts/registry-proxy.concept` — add action to fetch package README content from clef-registry (currently only fetches download links)
2. Add sync: `docs-on-featured-publish.sync` — when a curated/featured package is published, create a ContentNode documentation page on clef-web via ContentNode/create
3. Update Outline generation — include a "Packages" section in the navigation tree linking to package documentation pages
4. This is lower priority because clef-hub already renders READMEs; clef-web's role is curated official documentation

### 16.3 Clef Base work (after repertoire and ecosystem extensions are ready)

1. **entity-lifecycle syncs-only suite** — the seven cross-cutting lifecycle syncs (§2.1.2)
2. **schema.yaml infrastructure** — the `schema.yaml` + `composition.yaml` mechanism for mapping concept state to ContentNode Properties (§2.1.1, §2.1.3, §2.4.3)
3. **Version-space integration syncs** — `version-aware-load.sync`, `version-aware-save.sync`, `AutomationVersionDispatch.sync` (§5.6, §5.9)
4. **ComponentMapping + SlotSource** — admin-configured data-to-widget bindings (§3.5)
5. **ConceptBrowser** — package management orchestrator (§10.2). *Depends on Track E (ecosystem app extensions)*: ConceptBrowser/search delegates to clef-registry's Schema-aware ComponentManifest search (E1), ConceptBrowser/preview requires Schema metadata from ComponentManifest (E1), ConceptBrowser/install downloads source packages via Download kind: "package" (E3), and the publish-gate must validate schema.yaml/composition.yaml before packages reach ConceptBrowser (E2). Track E phases E1 and E2 are hard prerequisites; E3 is needed before install works end-to-end; E4 (clef-hub) and E5 (clef-web) are independent and can proceed in parallel.
6. **AppShell** — root derived concept (§14.2)
7. **Schema definitions** — all the Schema entities (Canvas, Shape, Frame, etc.)
8. **Deployment manifests** — per-target deployment configurations (§7, §11, §13)

### 16.4 Automation + Multiverse interaction model

The version-aware automation model (§5.9) requires syncs that bridge the Multiverse suite and the Automation Providers suite. This integration lives in Clef Base (because it depends on the shared ContentNode pool), but the design should inform the Multiverse suite's API:

```
Automation path in a version space:

1. User saves entity in VersionSpace "Hypothesis A"
2. version-aware-save.sync writes override to VersionSpace
3. ContentStorage/save fires lifecycle syncs (entity-lifecycle suite)
4. AutomationRule/triggered fires for matching rules
5. AutomationVersionDispatch.sync checks rule.version_scope:
   - "base" → skip (we're in a version space)
   - "current" → dispatch with VersionContext pointing to "Hypothesis A"
   - "all" → enumerate all active spaces, dispatch in each
   - "propagate" → dispatch in base, then VersionSpace/write to non-overridden spaces
6. AutomationDispatch/dispatch routes to provider (Manifest, Sync, LLM, Webhook, etc.)
7. Provider executes within the resolved VersionContext
```

VersionSpace needs an action `execute_in_space(space, action, params)` that sets the VersionContext for a single action execution — this enables automation providers to run within a specific version space. This should be added to the VersionSpace concept spec in the Multiverse suite.

### 16.5 Summary: what goes where

| Artifact | Location | Why |
|---|---|---|
| VersionSpace, VersionContext, SearchSpace | Repertoire: `multiverse/` suite | General-purpose parallel reality — useful in any collaborative app |
| SpatialConnector, Frame, Shape, SpatialLayout + providers | Repertoire: extend `content/` suite | General-purpose spatial content — useful in any diagram/canvas app |
| LLMAutomationProvider, WebhookAutomationProvider, ProcessAutomationProvider, GovernanceAutomationProvider | Repertoire: respective suites | General-purpose automation backends — useful in any automated app |
| Extension ↔ Automation integration syncs | Repertoire: `extension/` + `automation-providers/` suites | General-purpose plugin extensibility for automations |
| ComponentManifest `schemas`/`compositions`/`themes` fields | `clef-registry/` (Track E1) | ConceptBrowser search/preview requires Schema-aware metadata from registry |
| schema.yaml + composition.yaml + .theme + .widget validation in publish-gate | `clef-registry/` (Track E2) | Package integrity — all artifact types must be validated before publication |
| Download `kind: "package"` support | `clef-registry/` + `clef-cli-bootstrap/` (Track E3) | Source package download distinct from binary artifact download |
| Schema-aware filtering in Registry/search | `clef-registry/` (Track E1) | ConceptBrowser and clef-hub need Schema-aware discovery |
| SchemaProxy + faceted search UI | `clef-hub/` (Track E4) | Web-based Schema browsing mirrors ConceptBrowser's in-app browsing |
| Package README proxy + documentation pages | `clef-web/` (Track E5) | Curated package documentation on the official docs site |
| entity-lifecycle syncs, schema.yaml, version-space integration syncs | Clef Base | Depends on shared ContentNode pool model |
| ConceptBrowser, AppShell, ComponentMapping, SlotSource | Clef Base | Application-platform-specific orchestration (ConceptBrowser depends on Track E) |
| Schema definitions (Canvas, Shape, etc.) | Clef Base | Schema is a Clef Base entity concept |
| Deployment manifests, storage configs | Clef Base | Application-platform-specific deployment |