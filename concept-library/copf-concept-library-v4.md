# Clef Concept Library: Unified Kit Architecture

**Version 0.4.0 — 2026-02-19**

Unifies concepts extracted from three architectural analyses, an infrastructure audit, and a runtime concept definition analysis.

**Source analyses:**
- **Structured CMS** (Drupal 10/11): 27 concepts, with Entity API → 6 and Views → 4.
- **Unstructured knowledge tools** (Roam, Obsidian, Logseq): 14 concepts.
- **Hybrid structured/unstructured** (Notion, Tana, Coda): 10 concepts.
- **Infrastructure audit** (v0.3): 6 phantom concepts that existing concepts silently depend on.
- **Runtime concept analysis** (v0.4): How concepts can be defined at runtime, not just compile time. Introduces Intent (semantic layer) and extends Schema as a coordination hub for runtime concept definitions.

**Design principles:**
- Every concept is **independent**: own purpose, state, and actions. No concept "depends on" another.
- Kits bundle concepts and provide **syncs** (declarative coordination rules).
- Kits reference other kits' concepts via `uses` declarations (references, not dependencies).
- The **infrastructure audit** ensures every sync can actually execute at runtime — no magic assumed.
- **Runtime concept definition**: Concepts can be both static (`.concept` files compiled into the kernel) and dynamic (defined at runtime via Intent + Schema + behavioral associations). Users can create new concepts through the UI without code deployment.

**Total: 54 concepts across 15 suites.**

---

## 1. Cross-Kit Reference Mechanism

A suite declares which external concepts its syncs reference via `uses`. This is not a dependency — concepts remain independent. It tells the compiler "my syncs mention these concepts; resolve them from these suites."

```yaml
# kits/classification/suite.yaml
name: "@clef/classification"
version: 1.0.0
uses:
  "@clef/foundation":
    concepts: [ContentNode, Property]
concepts:
  - Tag
  - Taxonomy
  - Schema
  - Namespace
syncs:
  required:
    - schema-materializes-properties.sync
  recommended:
    - tag-feeds-taxonomy.sync
```

**Rules:**
- `uses` declares references, not dependencies. An app can use Classification without Foundation if it provides a ContentNode-compatible concept.
- Concepts themselves never reference other concepts. Only syncs reference multiple concepts.
- An app's `app.yaml` binds concrete concepts to kit references (type parameter alignment).

---

## 2. What Each Report Actually Said

### From the Drupal report

The report explicitly states: *"Drupal's Entity API is a 'God concept' — it serves as content storage, configuration storage, routing target, form source, render source, and access target simultaneously. A Clef redesign would split this into: **ContentStorage** (CRUD persistence), **FieldDefinition** (data schema composition), **FormBuilder** (input rendering), **ViewRenderer** (output rendering), **DisplayMode** (presentation profiles), and **TypeSystem** (self-describing metadata)."*

Similarly for Views: *"Views would decompose into: **QueryBuilder** (filter/sort/join construction), **QueryExecutor** (backend-specific execution), **ResultRenderer** (style/row/field display), and **ExposedInterface** (user-facing filter/sort controls)."*

Additional distinct concepts: Block (pluggable component with conditional placement), PluginRegistry (meta-concept for extensibility), Renderer (render pipeline with cache integration), and the Search API processor pipeline.

### From the TfT report

14 concepts, each with full state/actions/purpose: Block, Outline, Backlink, **Graph**, DailyNote, Query, Property, Tag, Embed/Transclusion, **Template**, Namespace, Canvas, Alias, Version.

Key finding: *"The differences between these three tools are almost entirely in their synchronization wiring, not in their concept definitions."*

### From the Hybrid report

10 concepts: ContentNode, **PageAsRecord**, Schema, View, Relation/Rollup, Formula, Collection, SyncedContent, Automation, Control.

PageAsRecord — the dual-zone entity where every record is also a document — was identified as the fundamental bridge concept.

### From the Infrastructure Audit (v0.3)

Six concepts that existing concepts silently assumed existed:

1. **ExpressionLanguage** — Formula, Query, AutomationRule, Token all invoke `evaluate(expression)` but nothing defines grammars, parsers, function registries, or evaluation engines.
2. **ContentParser** — The entire TfT progressive formalization pattern (`#tags`, `[[refs]]`, `key:: value`) depends on parsing raw text and extracting metadata, but no concept did this.
3. **Validator** — TypeSystem defines types and Schema defines fields, but nothing enforces constraints at write time.
4. **EventBus** — Every sync is declarative ("when X, do Y") but nothing dispatches events at runtime.
5. **Session** — Authentication.login() "creates a session" but session state (expiry, device, context) was unmodeled.
6. **Notification** — Comments, workflow transitions, mentions, flag thresholds all need to alert users but no delivery concept existed.

### From the Runtime Concept Analysis (v0.4)

Audit asked: "can concepts be defined at runtime, not just compile time?" Every system we studied does this — Drupal's content types are config entities created through the admin UI, Tana's supertags are user-created concepts, Notion databases are runtime-defined. Clef already has the pieces (Schema for structure, AutomationRule for behavior, View for presentation, Workflow for state machines) but lacked two things:

1. **No semantic layer** — Schema stores *what fields* a concept has, but not *why it exists* or *what it promises*. The purpose and operational principles from `.concept` files had no runtime equivalent. This led to the **Intent** concept.

2. **No coordination hub** — Creating a "Meeting" concept at runtime meant independently calling Schema.define, View.create, Workflow.define, AutomationRule.define, Template.define, Validator.addRule, etc. with no single artifact binding them together. This led to **extending Schema** to hold references to associated behavioral definitions.

The plugin-type question (are EmailChannel, MarkdownFormat, etc. concepts?) resolves cleanly: a plugin type's structural definition is a Schema, its behavioral implementation is a PluginRegistry entry, its instances are ContentNodes with that Schema applied. Configuration is runtime data; new behavioral implementations require code.

---

## 3. Concept Inventory

54 concepts across 15 suites. NEW marks additions since v0.2.

| # | Concept | Kit | Source |
|---|---------|-----|--------|
| 1 | ContentNode | Foundation | All three reports |
| 2 | ContentStorage | Foundation | Drupal (Entity decomp) |
| 3 | Outline | Foundation | Drupal + TfT |
| 4 | Property | Foundation | All three reports |
| 5 | TypeSystem | Foundation | Drupal (Typed Data) |
| 6 | PageAsRecord | Foundation | Hybrid |
| 7 | ContentParser | Foundation | v0.3 — Infrastructure audit |
| 8 | Intent | Foundation | **NEW v0.4** — Runtime concept analysis |
| 9 | Authentication | Identity | Drupal |
| 10 | Authorization | Identity | Drupal |
| 11 | AccessControl | Identity | Drupal |
| 12 | Session | Identity | v0.3 — Infrastructure audit |
| 13 | Reference | Linking | Drupal + TfT |
| 14 | Backlink | Linking | TfT |
| 15 | Relation | Linking | Drupal + Hybrid |
| 16 | Alias | Linking | TfT |
| 17 | Tag | Classification | TfT + Hybrid |
| 18 | Taxonomy | Classification | Drupal |
| 19 | Schema | Classification | Drupal (Bundle) + Hybrid — **Extended v0.4** as coordination hub |
| 20 | Namespace | Classification | TfT (Logseq) |
| 21 | Query | Query & Retrieval | All three reports |
| 22 | SearchIndex | Query & Retrieval | Drupal (Search API) |
| 23 | ExposedFilter | Query & Retrieval | Drupal (Views decomp) |
| 24 | View | Presentation | All three reports |
| 25 | DisplayMode | Presentation | Drupal (Entity decomp) |
| 26 | FormBuilder | Presentation | Drupal (Entity decomp) |
| 27 | Renderer | Presentation | Drupal (render pipeline) |
| 28 | Collection | Data Organization | Hybrid |
| 29 | Graph | Data Organization | TfT |
| 30 | DailyNote | Content | TfT |
| 31 | Comment | Content | Drupal |
| 32 | SyncedContent | Content | TfT + Hybrid |
| 33 | Template | Content | TfT |
| 34 | Canvas | Content | TfT |
| 35 | Version | Content | TfT |
| 36 | Formula | Computation | Hybrid |
| 37 | Token | Computation | Drupal |
| 38 | ExpressionLanguage | Computation | v0.3 — Infrastructure audit |
| 39 | Workflow | Automation | Drupal |
| 40 | AutomationRule | Automation | Drupal + Hybrid |
| 41 | Queue | Automation | Drupal |
| 42 | Control | Automation | Hybrid |
| 43 | Component | Layout | Drupal (Block module) |
| 44 | Cache | Infrastructure | Drupal |
| 45 | ConfigSync | Infrastructure | Drupal |
| 46 | Pathauto | Infrastructure | Drupal |
| 47 | PluginRegistry | Infrastructure | Drupal (plugin system) |
| 48 | EventBus | Infrastructure | v0.3 — Infrastructure audit |
| 49 | Validator | Infrastructure | v0.3 — Infrastructure audit |
| 50 | FileManagement | Media | Drupal |
| 51 | MediaAsset | Media | Drupal |
| 52 | Flag | Collaboration | Drupal |
| 53 | Group | Collaboration | Drupal |
| 54 | Notification | Notification | v0.3 — Infrastructure audit |

---

## 4. Kit Specifications

### Kit 1: Foundation (`@clef/foundation`)

The universal primitives. Every other suite's syncs reference these.

```yaml
name: "@clef/foundation"
version: 1.0.0
concepts:
  - ContentNode
  - ContentStorage
  - Outline
  - Property
  - TypeSystem
  - PageAsRecord
  - ContentParser
  - Intent
```

#### Intent

*Source: Runtime concept analysis — the semantic layer for any named definition*

**Purpose:** Capture the meaning, promises, and rationale of any named definition in the system, enabling documentation, discovery, AI-assisted authoring, and testable operational assertions.

- **State:** `intents: Map<TargetID, IntentRecord{name, purpose: String, operationalPrinciples: List<Assertion>, description: String, examples: List<Example>, version: SemVer, author: UserID, createdAt: Timestamp}>`
- **Actions:** `define(targetId, purpose, principles, description)`, `update(targetId, changes)`, `verify(targetId) → VerificationResult{passed, failed, untestable}`, `document(targetId) → Documentation`, `discover(query) → List<IntentRecord>`, `suggestFromDescription(naturalLanguage) → ProposedIntent`
- **Op principle:** "After defining an intent with operational principles, `verify` checks each principle as a testable assertion against the system's actual behavior; `discover` finds all definitions whose purpose matches a natural language query."

**Why Intent is a concept, not a description field:**

Three reasons Intent earns concept status:

1. **Active verification.** An operational principle like *"after scheduling a meeting, all attendees appear in the attendees list"* is a testable contract. `Intent.verify("Meeting")` can run these as assertions against the actual system. A description field is passive text. Intent is an active test harness for runtime-defined concepts.

2. **Universal attachment.** Intent doesn't just attach to Schema. It attaches to anything: a View ("this view shows overdue tasks sorted by priority"), a Workflow ("content moves from draft → review → published"), an AutomationRule ("when a ticket is marked urgent, the on-call person is notified"), a Collection, a Template, even another Kit. Every user-defined artifact benefits from having a reason for existing.

3. **AI-assisted authoring.** `Intent.suggestFromDescription("I need a way to track customer support tickets with priority levels, assignment, and SLA timers")` generates a proposed Intent with purpose, operational principles, and suggested Schema fields. The original natural language description is preserved so the system can be refined conversationally. Intent is the bridge between human goals and system configuration.

**How Intent relates to `.concept` files:**

A compiled `.concept` file's `name`, `purpose`, and `operationalPrinciple` fields are loaded into Intent at kernel startup. Runtime-defined concepts (created through the UI) store the same information in Intent directly. Both paths converge on the same concept — static concepts just have their Intent pre-populated from source files.

**How it wires to other concepts:**
- `Schema.defineSchema("Meeting", fields)` → `Intent.define("Meeting", purpose, principles)` — every Schema gets an Intent
- `Intent.verify("Meeting")` → runs operational principles as assertions: creates test data, performs operations, checks postconditions
- `Intent.discover("scheduling")` → searches all IntentRecords by purpose/description text
- `Intent.suggestFromDescription(text)` → uses ExpressionLanguage("ai-prompt") to generate proposed purpose, principles, and Schema fields
- `ConfigSync.export` includes Intent records alongside Schema, View, Workflow configs — the "why" travels with the "what"

#### ContentNode

*Source: Drupal Entity (data model) + Roam Block + Notion Block*

**Purpose:** Provide a universal, typed, addressable unit of content that can serve as document fragment, database record, media container, or any other content role.

- **State:** `id: UUID`, `type: NodeType`, `content: RichText | null`, `metadata: Map<String, Value>`, `created_at: Timestamp`, `updated_at: Timestamp`, `created_by: UserID`
- **Actions:** `create(type, content)`, `update(content)`, `delete()`, `setMetadata(key, value)`, `getMetadata(key)`, `changeType(newType)`
- **Op principle:** "After creating a ContentNode, it can be retrieved by its ID and its content reflects all updates."

Roam's insight: a page is just a block with a `:node/title` attribute — collapsing page/block into one concept. Drupal's insight: entities can be content or config via a type dimension.

#### ContentStorage

*Source: Drupal Entity Storage subsystem (decomposed from Entity API)*

**Purpose:** Persist and retrieve ContentNodes through a pluggable backend, abstracting storage concerns from the content model.

- **State:** `store: Map<NodeID, PersistedNode>`, `backend: StorageBackend`, `schemaMap: Map<NodeType, StorageSchema>`
- **Actions:** `save(node)`, `load(id)`, `loadMultiple(ids)`, `delete(id)`, `query(conditions, sorts, range)`, `generateSchema(nodeType, fields)`
- **Op principle:** "After saving a node, loading it by ID returns the same data; the backend can be swapped without changing the content model."

The Drupal report identifies four SQL table layouts depending on entity capabilities (simple, translatable, revisionable, or both). Roam uses Datascript (in-memory EAV with snapshot+transaction-log event sourcing). Obsidian uses the filesystem. Logseq DB uses SQLite-WASM. These are all implementations of the same concept: repository-pattern persistence with pluggable backends.

**Why separate from ContentNode:** ContentNode defines *what* an entity is (its data model). ContentStorage defines *how* it's persisted. This is the Entity/Repository separation from DDD. A ContentNode has no knowledge of storage; ContentStorage has no knowledge of content semantics.

#### Outline

*Source: Drupal Paragraphs + Roam/Logseq Outliner*

**Purpose:** Organize ContentNodes into an ordered tree with parent-child relationships, enabling hierarchical structure, indentation, and focused navigation.

- **State:** `parentOf: Map<NodeID, NodeID>`, `childrenOf: Map<NodeID, OrderedList<NodeID>>`, `isCollapsed: Map<NodeID, Boolean>`
- **Actions:** `indent(nodeId)`, `outdent(nodeId)`, `moveUp(nodeId)`, `moveDown(nodeId)`, `reparent(nodeId, newParentId, position)`, `collapse(nodeId)`, `expand(nodeId)`, `zoom(nodeId)`
- **Op principle:** "After indenting a node, it becomes the last child of its previous sibling."

Roam denormalizes with `:block/parents` (all ancestors) for fast "is this under page X?" queries. Logseq DB uses fractional indexing strings for conflict-free sibling insertion. Drupal's Paragraphs uses delta weights and host-entity ownership (composition, not aggregation — each host revision creates new paragraph revisions).

#### Property

*Source: Drupal FieldType + Obsidian Frontmatter + Notion Database Properties + Tana Supertag Fields*

**Purpose:** Attach typed, queryable key-value metadata to any ContentNode, enabling structured operations over unstructured content.

- **State:** `properties: Map<NodeID, Map<Key, TypedValue>>`, `typeRegistry: Map<Key, PropertyType>`, `closedValues: Map<Key, Set<AllowedValue>>`
- **Actions:** `set(nodeId, key, value)`, `get(nodeId, key)`, `delete(nodeId, key)`, `defineType(key, type, constraints)`, `listAll(nodeId)`
- **Op principle:** "After setting a property on a node, querying for that property value returns that node."

The Drupal report describes the Type-Widget-Formatter triad for fields. Property captures only the **Type** (data model) aspect. Widget (input rendering) → FormBuilder concept. Formatter (output rendering) → DisplayMode concept.

The TfT report documents the **progressive formalization** pattern: Roam uses `Attribute:: value` text conventions (no schema enforcement), Obsidian enforces one type per property name vault-wide, and Logseq DB promotes properties to first-class Datascript entities with Malli-validated typed schemas. This text-convention-to-schema evolution is what ContentParser + Validator make operational.

#### TypeSystem

*Source: Drupal Typed Data system*

**Purpose:** Make all data self-describing with introspectable type information, validation constraints, and navigable type hierarchies.

- **State:** `typeDefinitions: Map<TypeID, TypeDefinition>`, `constraints: Map<TypeID, List<Constraint>>`
- **Actions:** `resolve(typePath)`, `validate(value, typeId)`, `navigate(value, path)`, `serialize(value, format)`, `registerType(definition)`
- **Op principle:** "After registering a type definition, any value claimed to be that type can be validated and navigated."

Drupal's Typed Data creates a navigable tree: Entity → FieldItemList → FieldItem → Property → raw value. Each node carries type information, validation constraints, and change propagation (`onChange()` fires upward). This Composite/Self-Describing Data pattern enables generic operations (serialization, validation, transformation) without knowing concrete types.

**Relationship to Validator:** TypeSystem is declarative — it defines what types exist and their structure. Validator is operational — it enforces those constraints at write time. You can have TypeSystem without Validator (flexible mode) or Validator rules that aren't type-based (business logic constraints).

#### PageAsRecord

*Source: Hybrid report — the dual-zone entity pattern from Notion, Tana, Coda*

**Purpose:** Enable every structured data record to also function as a rich, freeform document container, and vice versa.

- **State:** `schemaProperties: Map<NodeID, Map<PropertyName, TypedValue>>` (structured data zone), `body: Map<NodeID, OrderedList<NodeID>>` (unstructured content zone), `schema: Map<NodeID, SchemaID | null>`, `collections: Map<NodeID, Set<CollectionID>>`
- **Actions:** `setProperty(nodeId, name, value)`, `getProperty(nodeId, name)`, `appendToBody(nodeId, childNode)`, `attachToSchema(nodeId, schema)`, `detachFromSchema(nodeId)`, `convertFromFreeform(nodeId, schema)`
- **Op principle:** "After attaching a schema to a freeform document, it gains queryable typed properties without losing its body content."

**Why separate from ContentNode:** ContentNode is the universal atom. PageAsRecord gives a ContentNode *two zones*: a structured property panel (conforming to a Schema) and an unstructured body (arbitrary content tree). Not every ContentNode is a PageAsRecord — a simple text block doesn't need dual-zone structure. But every database row in Notion, every supertag-bearing node in Tana, and every table row with a canvas column in Coda IS a PageAsRecord.

#### ContentParser

*Source: Infrastructure audit — the missing bridge for progressive formalization*

**Purpose:** Parse raw content text into a structured representation, and extract embedded metadata (references, tags, properties, embeds) as a side effect of parsing.

- **State:** `formats: Map<FormatID, FormatDefinition>`, `extractors: Map<FormatID, List<MetadataExtractor>>`, `astCache: Map<{ContentHash, FormatID}, ParsedAST>`
- **Actions:** `registerFormat(formatId, parser, serializer)`, `registerExtractor(formatId, extractor)`, `parse(content, formatId) → ParsedContent{ast, extractedMetadata}`, `serialize(ast, formatId) → String`, `extractRefs(content, formatId) → List<RefTarget>`, `extractTags(content, formatId) → List<TagName>`, `extractProperties(content, formatId) → Map<Key, Value>`, `extractEmbeds(content, formatId) → List<EmbedTarget>`, `transform(ast, visitor) → AST`
- **Op principle:** "After parsing content, all embedded references, tags, and properties are available as structured metadata without re-reading the text; after registering a new format, content in that format can be parsed and its metadata extracted."

**Why this was missing:** v0.2 had syncs like `ContentNode.update → Reference.reparse(content)` and `ContentNode.update → Property.reparse(content)` but no concept that actually performed the parsing. ContentParser is the mechanism that reads `[[page refs]]`, `((block refs))`, `#tags`, `key:: value` patterns, and `{{embed: ...}}` from raw text. Without it, the progressive formalization pattern — where typing conventions become structured data — has no implementation.

**Format instances (via PluginRegistry):**
- `markdown` — CommonMark + extensions (wikilinks, block refs, callouts)
- `org-mode` — Emacs org-mode syntax
- `html` — HTML with sanitization
- `richtext-json` — ProseMirror/TipTap JSON document model
- `plaintext` — no formatting, still extracts refs/tags/properties via conventions

**How it wires to other concepts:**
- `ContentNode.update(content)` → `EventBus.dispatch("content_node.updated")` → ContentParser.parse → extracts refs → Reference.addRef/removeRef
- `ContentParser.extractTags` → Tag.addTag/removeTag
- `ContentParser.extractProperties` → Property.set (the text-convention → structured property bridge)
- `ContentParser.extractEmbeds` → SyncedContent.createReference
- `SearchIndex.indexItem(node)` uses ContentParser.parse for tokenization
- `Renderer.render(node)` uses ContentParser.parse to get AST for rendering to HTML

---

### Kit 2: Identity (`@clef/identity`)

```yaml
name: "@clef/identity"
version: 1.0.0
concepts:
  - Authentication
  - Authorization
  - AccessControl
  - Session
```

#### Authentication

*Source: Drupal — authentication provider chains*

**Purpose:** Verify user identity through pluggable authentication providers.

- **State:** `accounts: Map<UserID, AccountRecord>`, `providers: List<AuthProvider>`
- **Actions:** `register(credentials)`, `login(credentials)`, `logout()`, `resetPassword(userId)`, `authenticate(request)`
- **Op principle:** "After setting a password, presenting it authenticates you."

Drupal implements a Strategy pattern for providers (cookie, OAuth, SAML, Basic Auth) — each implements `applies(Request)` and `authenticate(Request)`. The special UID 1 super-admin bypasses all checks.

#### Authorization

*Source: Drupal — Role-Based Access Control*

**Purpose:** Manage roles, permissions, and permission-checking logic.

- **State:** `roles: Map<RoleID, RoleDef>`, `permissions: Map<RoleID, Set<PermissionID>>`, `userRoles: Map<UserID, Set<RoleID>>`
- **Actions:** `grantPermission(roleId, permissionId)`, `revokePermission(roleId, permissionId)`, `assignRole(userId, roleId)`, `checkPermission(userId, permissionId)`
- **Op principle:** "After granting a permission to a role and assigning that role to a user, the user passes permission checks for that permission."

#### AccessControl

*Source: Drupal — three-valued access algebra*

**Purpose:** Compose access decisions from multiple sources using a three-valued logic algebra with cacheable results.

- **State:** Transient access results with cacheability metadata: `{result: allowed|neutral|forbidden, tags, contexts, maxAge}`
- **Actions:** `check(entity, operation, user)`, `orIf(resultA, resultB)` (any allowed + none forbidden = granted), `andIf(resultA, resultB)` (all must allow), `cache(result)`
- **Op principle:** "A `forbidden` result from any access checker overrides all `allowed` results; every access result carries cacheability metadata so the decision itself can be cached."

The Drupal report calls this Drupal's most sophisticated access innovation. Every access result carries cache tags, cache contexts, and max-age, enabling cached access decisions with correct invalidation.

#### Session

*Source: Infrastructure audit*

**Purpose:** Manage authenticated user sessions with lifecycle, device tracking, and context that other concepts use for personalization and access control.

- **State:** `sessions: Map<SessionID, {userId, createdAt, expiresAt, deviceInfo, refreshToken, metadata}>`, `activeSessions: Map<UserID, Set<SessionID>>`
- **Actions:** `create(userId, deviceInfo) → Session`, `validate(sessionId) → {valid, userId, metadata}`, `refresh(sessionId) → Session`, `destroy(sessionId)`, `destroyAll(userId)`, `getContext(sessionId) → SessionContext`
- **Op principle:** "After creating a session, validating it returns the associated user until it expires or is destroyed."

**Why this was missing:** Authentication.login() "creates a session" but v0.2 never modeled session state — expiry, device info, refresh tokens, or the session context that feeds into AccessControl checks and Cache variation. Drupal's `user` cache context (which triggers auto-placeholdering in the Renderer) depends on session identity.

**How it wires to other concepts:**
- `Authentication.login(credentials)` → `Session.create(userId, device)`
- `Authentication.logout()` → `Session.destroy(sessionId)`
- `AccessControl.check(entity, op)` uses `Session.getContext()` to get the current user
- `Cache` uses session context as a cache variation dimension (Drupal's `user` cache context)
- `Renderer.autoPlaceholder()` detects session-dependent subtrees for BigPipe streaming

---

### Kit 3: Linking (`@clef/linking`)

Four concepts: **Reference**, **Backlink**, **Relation**, **Alias**.

```yaml
name: "@clef/linking"
version: 1.0.0
uses:
  "@clef/foundation":
    concepts: [ContentNode]
concepts:
  - Reference
  - Backlink
  - Relation
  - Alias
```

#### Reference

*Source: Drupal EntityReference + Roam `[[refs]]` + Notion Relations*

**Purpose:** Store forward associations from a source content node to a target entity.

- **State:** `refs: Map<NodeID, Set<RefTarget{targetId, type, position}>>`
- **Actions:** `addRef(sourceId, targetId, type)`, `removeRef(sourceId, targetId)`, `getRefs(sourceId)`, `resolveTarget(refTarget)`
- **Op principle:** "After adding a reference from A to B, getRefs(A) includes B."

#### Backlink

*Source: TfT report — bidirectional association discovery*

**Purpose:** Automatically surface reverse references, so that when A links to B, B knows about A.

- **State:** `backlinks: Map<EntityID, Set<NodeID>>` (computed reverse index)
- **Actions:** `getBacklinks(entityId)`, `getUnlinkedMentions(entityId, allNodes)`, `reindex()`
- **Op principle:** "After Reference.addRef(A, B), Backlink.getBacklinks(B) includes A."

Architecturally: Reference stores forward links (written by the user). Backlink computes the reverse (derived from Reference state). Roam/Logseq compute backlinks via Datascript's reverse index on ref-type attributes. Obsidian computes at query time by scanning cached files.

#### Relation

*Source: Drupal EntityReference + Rollup + Notion Relations/Rollups*

**Purpose:** Typed, labeled, bidirectional connections between entities with aggregation support.

- **State:** `relations: Map<RelationID, RelationDef{name, sourceType, targetType, cardinality, isBidirectional}>`, `links: Set<{relationId, sourceId, targetId}>`, `rollups: Map<RollupID, RollupDef{relation, targetField, aggregation}>`
- **Actions:** `defineRelation(name, config)`, `link(relationId, sourceId, targetId)`, `unlink(relationId, sourceId, targetId)`, `getRelated(nodeId, relationId)`, `defineRollup(relation, targetField, aggregation)`, `computeRollup(rollupId, nodeId)`
- **Op principle:** "After linking A to B via relation R, getRelated(A, R) returns B; if R is bidirectional, getRelated(B, R) returns A."

**How Relation differs from Reference:** Reference is raw forward links extracted from content. Relation is named, typed, bidirectional connections with cardinality constraints and rollup aggregation. Relation is the Notion/Airtable model; Reference is the Roam/Obsidian model. Both are needed.

#### Alias

*Source: TfT report — multiple names for the same entity*

**Purpose:** Allow an entity to be referenced by multiple names.

- **State:** `aliases: Map<EntityID, Set<AliasName>>`
- **Actions:** `addAlias(entityId, aliasName)`, `removeAlias(entityId, aliasName)`, `resolve(name) → EntityID`
- **Op principle:** "After adding alias 'ML' for entity 'Machine Learning', resolving 'ML' returns the Machine Learning entity."

---

### Kit 4: Classification (`@clef/classification`)

Four concepts: **Tag**, **Taxonomy**, **Schema**, **Namespace**.

```yaml
name: "@clef/classification"
version: 1.0.0
uses:
  "@clef/foundation":
    concepts: [ContentNode, Property]
concepts:
  - Tag
  - Taxonomy
  - Schema
  - Namespace
```

#### Tag

**Purpose:** Lightweight, flat classification that crosscuts hierarchy.

- **State:** `tags: Map<NodeID, Set<TagName>>`, `tagIndex: Map<TagName, Set<NodeID>>`, `hierarchy: Tree<TagName>` (optional nested tags)
- **Actions:** `addTag(nodeId, tagName)`, `removeTag(nodeId, tagName)`, `getByTag(tagName)`, `getChildren(tagName)`, `rename(oldTag, newTag)`
- **Op principle:** "After tagging a node, searching by that tag finds the node."

In Roam, tags ARE page references (`#tag` = `[[tag]]`). In Obsidian, tags are a distinct metadata type with nesting (`#parent/child`). In Logseq DB, tags evolve into a class/type system. These are sync configuration choices, not concept differences.

#### Taxonomy

*Source: Drupal — cleanest Clef concept candidate*

**Purpose:** Hierarchical classification vocabularies with parent-child term relationships.

- **State:** `vocabularies: Map<VocabID, VocabDef>`, `terms: Map<TermID, {vocab, name, parent, weight}>`, `termIndex: Map<TermID, Set<NodeID>>`
- **Actions:** `createVocabulary(name)`, `addTerm(vocabId, name, parentTermId)`, `setParent(termId, parentTermId)`, `tagEntity(nodeId, termId)`, `untagEntity(nodeId, termId)`
- **Op principle:** "After tagging content with a term, searching by that term — or any of its ancestor terms — finds the content."

#### Schema

*Source: Drupal Bundle + Tana Supertag + Notion database schema — **Extended in v0.4** as runtime concept coordination hub*

**Purpose:** Named field sets (type-as-mixin) that can be applied to any ContentNode, defining what properties that node should have. Extended to serve as the coordination hub for runtime concept definitions by holding references to associated behavioral definitions.

- **State:** `schemas: Map<SchemaID, {name, fields: List<FieldDef>, extends: Set<SchemaID>, defaultContent, viewConfig, associations: SchemaAssociations}>`
  - `SchemaAssociations: {views: Set<ViewID>, workflow: WorkflowID | null, automations: Set<AutomationRuleID>, templates: Set<TemplateID>, validations: Set<ValidatorRuleID>, notifications: Set<NotificationTemplateID>, intent: IntentID | null}`
- **Actions:** `defineSchema(name, fields)`, `addField(schemaId, fieldDef)`, `extendSchema(childId, parentId)`, `applyTo(nodeId)`, `removeFrom(nodeId)`, `getEffectiveFields(schemaId)`, `associateView(schemaId, viewId)`, `associateWorkflow(schemaId, workflowId)`, `associateAutomation(schemaId, ruleId)`, `associateTemplate(schemaId, templateId)`, `associateValidation(schemaId, ruleId)`, `associateNotification(schemaId, templateId)`, `getAssociations(schemaId) → SchemaAssociations`, `export(schemaId) → ConceptBundle`, `import(bundle) → SchemaID`
- **Op principle:** "After applying a schema to a node, the node gains all the schema's fields as queryable properties; after associating a workflow with a schema, all nodes with that schema follow that workflow's state machine."

Follows Tana's schema-on-node model: schemas are first-class objects independent of containers. Drupal's Bundle is a Schema applied within a Collection. Notion's database schema is a Schema attached to a Collection. All are instances of the same concept.

**Schema as runtime concept definition (v0.4):**

Schema's `associations` field makes it the coordination hub for runtime-defined concepts. It doesn't *own* Views, Workflows, or AutomationRules — it holds **reference IDs** to independently-defined artifacts. Each referenced concept maintains its own state. Schema is the manifest that says "these things travel together as a coherent concept."

Example — defining a "Meeting" concept at runtime:
```yaml
# All of these are independent operations through their own concepts:
Intent.define("Meeting", purpose: "Coordinate scheduled gatherings...", principles: [...])
Schema.defineSchema("Meeting", fields: [date, attendees, status, agenda])
View.create("meetings-table", layout: "table", dataSource: "Meeting")
View.create("meetings-calendar", layout: "calendar", dataSource: "Meeting")
Workflow.define("meeting-lifecycle", states: [scheduled, in-progress, completed, cancelled])
Template.define("new-meeting", blockTree: [agenda-section, notes-section])
Validator.addRule("Meeting", "end_date", "after:start_date")
AutomationRule.define(trigger: "schema.applied:Meeting", action: "notify attendees")

# Schema binds them into one exportable unit:
Schema.associateView("Meeting", "meetings-table")
Schema.associateView("Meeting", "meetings-calendar")
Schema.associateWorkflow("Meeting", "meeting-lifecycle")
Schema.associateTemplate("Meeting", "new-meeting")
Schema.associateValidation("Meeting", "end-after-start")
Schema.associateAutomation("Meeting", "notify-on-schedule")

# Now export/import moves everything together:
bundle = Schema.export("Meeting")  # includes all associated IDs + their definitions
Schema.import(bundle)               # recreates Schema + all associated definitions
```

**How this resolves the plugin-type question:**

A plugin type like EmailChannel is modeled as:
- `Schema.defineSchema("EmailChannel", fields: [smtp_host, port, from_address, tls])` — structural definition
- `PluginRegistry.register("notification_channel", "email", EmailSendImplementation)` — behavioral implementation
- `ContentNode.create(type: "config", schema: "EmailChannel")` → configure an instance with Property.set
- Creating a new channel at runtime = creating a ContentNode with EmailChannel schema applied. No code deployment for configuration. Code deployment only for genuinely new behavioral implementations.

#### Namespace

*Source: TfT report — Logseq's hierarchical page organization*

**Purpose:** Hierarchical overlay on the flat page namespace via path separators.

- **State:** `namespaceOf: Map<PageID, PageID>`, `separator: String` (default `/`)
- **Actions:** `createNamespacedPage(fullPath)`, `getChildren(pageId)`, `getHierarchy(pageId)`, `move(pageId, newParentPath)`
- **Op principle:** "After creating `cat/tony`, a parent page `cat` exists and `getChildren(cat)` includes `tony`."

---

### Kit 5: Query & Retrieval (`@clef/query-retrieval`)

```yaml
name: "@clef/query-retrieval"
version: 1.0.0
uses:
  "@clef/foundation":
    concepts: [ContentNode, ContentStorage, ContentParser, Property]
  "@clef/classification":
    concepts: [Tag, Schema]
  "@clef/linking":
    concepts: [Reference, Backlink]
  "@clef/computation":
    concepts: [ExpressionLanguage]
concepts:
  - Query
  - SearchIndex
  - ExposedFilter
```

#### Query

*Source: Drupal Views (QueryBuilder + QueryExecutor) + Roam Datalog + Obsidian Dataview + Tana search nodes*

**Purpose:** Enable structured retrieval over content — filtering, sorting, grouping, and aggregating ContentNodes based on their properties, tags, references, and content.

- **State:** `expression: QueryAST`, `resultSet: List<NodeID>`, `isLive: Boolean`, `scope: QueryScope`
- **Actions:** `parse(queryString)`, `execute(storage)`, `subscribe(callback)`, `addFilter(field, operator, value)`, `addSort(field, direction)`, `addRelationship(joinPath)`, `setScope(scope)`
- **Op principle:** "After executing a query with a filter, the result set contains all nodes matching that condition."

**How ExpressionLanguage makes this work:** `Query.parse(queryString)` delegates to `ExpressionLanguage.parse("query-filter", queryString)` for filter condition parsing. The query's filter operators (equals, contains, between, in, regex) are functions registered in ExpressionLanguage's `query-filter` language. An app can register `ExpressionLanguage.registerLanguage("datalog", datalogGrammar)` to support Roam-style full Datalog queries alongside the simpler filter DSL.

#### SearchIndex

*Source: Drupal Search API — processor pipeline pattern*

**Purpose:** Maintain a secondary index optimized for full-text and faceted search, with pluggable backends and a two-stage processor pipeline.

- **State:** `indexes: Map<IndexID, IndexConfig>`, `processors: OrderedList<Processor>`, `backends: Map<BackendID, SearchBackend>`, `trackedItems: Map<IndexID, Set<NodeID>>`
- **Actions:** `createIndex(config, backend)`, `indexItem(nodeId)`, `removeItem(nodeId)`, `search(query, facets)`, `addProcessor(processor, stage: IndexTime|QueryTime)`, `reindex(indexId)`
- **Op principle:** "After indexing an item and searching for terms in its content, the item appears in results."

Uses ContentParser internally to get plain text from content for tokenization. Processors (tokenization, stemming, stopword removal, synonym expansion, spell correction) are registered via PluginRegistry.

#### ExposedFilter

*Source: Drupal Views decomposition (ExposedInterface aspect)*

**Purpose:** Allow end users to modify query parameters at runtime through interactive filter/sort controls.

- **State:** `exposedFilters: Map<FilterID, ExposedFilterConfig>`, `userInputs: Map<FilterID, Value>`, `defaultValues: Map<FilterID, Value>`
- **Actions:** `expose(filterId, config)`, `collectInput(filterId, userValue)`, `applyToQuery(query)`, `resetToDefaults()`
- **Op principle:** "After a user selects a filter value, the query re-executes with the user's constraint applied."

---

### Kit 6: Presentation (`@clef/presentation`)

```yaml
name: "@clef/presentation"
version: 1.0.0
uses:
  "@clef/foundation":
    concepts: [ContentNode, ContentParser, Property]
  "@clef/query-retrieval":
    concepts: [Query]
  "@clef/infrastructure":
    concepts: [Cache]
concepts:
  - View
  - DisplayMode
  - FormBuilder
  - Renderer
```

#### View

*Source: Drupal Views (display/style) + Notion/Tana/Coda view tabs*

**Purpose:** Provide multiple visual representations of the same dataset with independent layout, filter, sort, group, and visible-field configuration.

- **State:** `views: Map<ViewID, {name, dataSource, layout: LayoutType, filters, sorts, groups, visibleFields, formatting}>`
- **Actions:** `create(dataSource, layout)`, `setFilter(rules)`, `setSort(rules)`, `setGroup(field)`, `setVisibleFields(fieldIds)`, `changeLayout(layout)`, `duplicate()`, `embed(targetNodeId)`
- **Op principle:** "After changing a view's layout from table to board, the same data renders as a kanban board grouped by the specified field."

The `embed()` action is the key bridge — placing structured data views inline within unstructured document flow (Notion linked databases, Tana search node placement, Drupal Views block display).

#### DisplayMode

*Source: Drupal Entity decomposition — named presentation profiles*

**Purpose:** Define named configurations controlling how each field/property renders for display (view modes) and for editing (form modes).

- **State:** `modes: Map<ModeID, ModeDef>`, `fieldDisplayConfigs: Map<{SchemaID, ModeID, FieldID}, DisplayConfig>`, `fieldFormConfigs: Map<{SchemaID, ModeID, FieldID}, FormConfig>`
- **Actions:** `defineMode(name, type: ViewMode | FormMode)`, `configureFieldDisplay(schema, mode, field, formatter, settings)`, `configureFieldForm(schema, mode, field, widget, settings)`, `renderInMode(nodeId, modeId)`
- **Op principle:** "After configuring a field to use Formatter X in mode 'teaser' and Formatter Y in mode 'full', rendering the same entity in each mode shows different presentations."

**Why separate from View:** View is *which data* in *what layout*. DisplayMode is *how each field renders*. View selects and arranges; DisplayMode formats.

#### FormBuilder

*Source: Drupal Entity decomposition — input rendering*

**Purpose:** Generate and process data entry forms from schema definitions, mapping each field to an appropriate input widget.

- **State:** `formDefinitions: Map<FormID, FormDef>`, `widgetRegistry: Map<FieldType, List<WidgetPlugin>>`, `validationState: Map<FormID, Map<FieldID, ValidationResult>>`
- **Actions:** `buildForm(schema, mode, entity)`, `validate(formData, schema)`, `processSubmission(formData)`, `registerWidget(fieldType, widget)`, `getWidget(fieldType, mode)`
- **Op principle:** "After building a form from a schema, each field renders with an appropriate input widget; after submitting valid data, the entity's properties are updated."

**How Validator makes this work:** `FormBuilder.validate(formData, schema)` delegates to `Validator.validate(nodeId, formData)` which checks each field against TypeSystem constraints and Schema requirements. FormBuilder handles presentation of validation errors; Validator handles the actual constraint checking.

#### Renderer

*Source: Drupal render pipeline — Composite Renderer with Deferred Evaluation*

**Purpose:** Compose nested content into final output through a recursive, cache-aware pipeline with deferred evaluation and streaming.

- **State:** `renderTree: Tree<RenderElement>`, `placeholders: Map<PlaceholderID, LazyBuilder>`, `cacheability: {tags, contexts, maxAge}` (per render element)
- **Actions:** `render(element)`, `autoPlaceholder(element)`, `stream(response)`, `mergeCacheability(parent, child)`
- **Op principle:** "After rendering a content tree, the output's cacheability metadata accurately reflects all its components; uncacheable subtrees are replaced with placeholders and streamed later."

Uses ContentParser to convert ContentNode.content into renderable ASTs. Uses Cache for render caching with tag-based invalidation. Auto-placeholdering detects subtrees that vary by Session context and defers them for BigPipe-style streaming.

---

### Kit 7: Data Organization (`@clef/data-organization`)

```yaml
name: "@clef/data-organization"
version: 1.0.0
uses:
  "@clef/foundation":
    concepts: [ContentNode]
  "@clef/classification":
    concepts: [Schema, Tag]
  "@clef/linking":
    concepts: [Backlink]
concepts:
  - Collection
  - Graph
```

#### Collection

*Source: Notion Database + Tana Search Node + Coda Table*

**Purpose:** Group entities into queryable sets — both predefined containers (concrete) and dynamically computed sets (virtual).

- **State:** `collections: Map<CollectionID, {name, type: Concrete|Virtual, schema: SchemaID|null, members: Set<NodeID>, query: QueryAST|null, templates: List<TemplateID>}>`
- **Actions:** `addMember(nodeId)`, `removeMember(nodeId)`, `getMembers()`, `setSchema(schemaId)`, `createVirtual(query)`, `materialize()`
- **Op principle:** "For a concrete collection, getMembers() returns explicitly added nodes; for a virtual collection, it returns all nodes matching the query."

#### Graph

*Source: TfT report — emergent structure from links*

**Purpose:** Represent and visualize the network of connections between entities, enabling discovery of clusters, orphans, and relationships.

- **State:** `nodes: Set<EntityID>`, `edges: Set<{source: EntityID, target: EntityID}>`, `layout: Map<EntityID, Position2D>`
- **Actions:** `addNode(entityId)`, `removeNode(entityId)`, `addEdge(source, target)`, `removeEdge(source, target)`, `computeLayout(algorithm, params)`, `getNeighbors(entityId, depth)`, `filterNodes(predicate)`
- **Op principle:** "After computing a force-directed layout, nodes connected by edges cluster together; orphan nodes drift to the periphery."

Graph is a **read-only derived view** — it never modifies content, only visualizes structure. Edges derive entirely from Backlink's forward reference map.

---

### Kit 8: Content (`@clef/content`)

```yaml
name: "@clef/content"
version: 1.0.0
uses:
  "@clef/foundation":
    concepts: [ContentNode, Outline, Property]
  "@clef/linking":
    concepts: [Reference]
concepts:
  - DailyNote
  - Comment
  - SyncedContent
  - Template
  - Canvas
  - Version
```

#### DailyNote

*Source: TfT report — time-indexed capture*

**Purpose:** Frictionless, temporally-organized entry point for content capture.

- **State:** `dateFormat: String`, `templateId: Optional<TemplateID>`, `targetFolder: Path`, `today: Date`
- **Actions:** `getOrCreateToday() → Page`, `navigateToDate(date) → Page`, `listRecent(n) → List<Page>`
- **Op principle:** "After calling getOrCreateToday(), today's page exists and is ready for content."

Not a special entity type — just a ContentNode with a date-formatted name and auto-creation trigger. The "magic" is entirely convention and sync wiring.

#### Comment

*Source: Drupal — threaded discussion with materialized path*

**Purpose:** Threaded discussion attached polymorphically to any content entity.

- **State:** `comments: Map<CommentID, {hostNodeId, hostType, content, thread, author, status}>`, `threadPaths: Map<CommentID, VancodeString>`
- **Actions:** `addComment(hostNodeId, content)`, `reply(parentCommentId, content)`, `publish(commentId)`, `unpublish(commentId)`, `delete(commentId)`
- **Op principle:** "After replying to a comment, the reply appears nested beneath the parent in thread order."

#### SyncedContent

*Source: TfT Embed/Transclusion + Notion synced blocks + Tana references*

**Purpose:** Display content from one location inside another while maintaining a single source of truth.

- **State:** `originals: Map<OriginalID, NodeID>`, `references: Map<RefID, {original, location, position}>`
- **Actions:** `createReference(sourceId, targetLocation)`, `editOriginal(refId, newContent)`, `deleteReference(refId)`, `convertToIndependent(refId)`
- **Op principle:** "After editing content through a synced reference, the original and all other references reflect the change immediately."

Roam's three levels: block references (read-only inline), block embeds (editable transclusion), aliases (custom display text). All resolve at render time — changes propagate because the embed is a live pointer, not a snapshot.

#### Template

*Source: TfT report — reusable content patterns*

**Purpose:** Define reusable content structures that can be instantiated with dynamic values.

- **State:** `templates: Map<TemplateID, BlockTree>`, `variables: Map<TemplateID, Set<VariableDef>>`, `triggers: Map<TemplateID, TriggerCondition>`
- **Actions:** `define(templateId, blockTree, variables)`, `instantiate(templateId, targetLocation, bindings)`, `registerTrigger(templateId, condition)`, `mergeProperties(templateProperties, existingProperties)`
- **Op principle:** "After instantiating a template, a copy of the template's block tree appears at the target location with all variables resolved."

**How ExpressionLanguage makes this work:** Template variable expressions (`${date("YYYY-MM-DD")}`, `${node.title | slugify}`) are parsed and evaluated via `ExpressionLanguage.parse("template-expr", expression)`. An app can register simple text substitution or full JavaScript execution as Template's expression language.

#### Canvas

*Source: TfT report — spatial arrangement*

**Purpose:** Free-form, 2D spatial arrangement of content cards.

- **State:** `nodes: Set<CanvasNode{id, type, position, dimensions, content}>`, `edges: Set<CanvasEdge{id, fromNode, toNode, label}>`
- **Actions:** `addNode(type, position, content)`, `moveNode(nodeId, newPosition)`, `connectNodes(fromId, toId, label)`, `groupNodes(nodeIds)`, `embedFile(fileId, position)`
- **Op principle:** "After placing content on a canvas and connecting two cards, both the spatial arrangement and the connections are preserved."

Obsidian's JSON Canvas (open format, MIT license). In Logseq, canvas shapes ARE ContentNodes (tagged `:ls-type :whiteboard-shape`), so they participate in the query and reference system.

#### Version

*Source: TfT report — content history*

**Purpose:** Track content changes over time for rollback and audit.

- **State:** `history: Map<EntityID, OrderedList<{timestamp, snapshot, author}>>`
- **Actions:** `snapshot(entityId)`, `listVersions(entityId)`, `rollback(entityId, versionId)`, `diff(versionA, versionB)`
- **Op principle:** "After rolling back to a previous version, the entity's content matches its state at that version's timestamp."

---

### Kit 9: Computation (`@clef/computation`)

```yaml
name: "@clef/computation"
version: 1.0.0
uses:
  "@clef/foundation":
    concepts: [ContentNode, Property]
  "@clef/linking":
    concepts: [Relation]
  "@clef/infrastructure":
    concepts: [PluginRegistry]
concepts:
  - Formula
  - Token
  - ExpressionLanguage
```

#### Formula

*Source: Hybrid report — reactive computed values*

**Purpose:** Define reactive computed values derived from properties, relations, and cross-entity data.

- **State:** `formulas: Map<FormulaID, {expression, scope, dependencies, cachedResult}>`
- **Actions:** `evaluate(formulaId, context)`, `getDependencies(formulaId)`, `invalidate(formulaId)`, `setExpression(formulaId, expression)`
- **Op principle:** "After defining a formula `Price × Quantity` on a node, changing either property automatically recomputes the result."

Three paradigms: Notion's per-row mathematical formulas, Coda's cross-table list-oriented formulas, Tana's AI-powered semantic extraction. All three are expression types within ExpressionLanguage.

**How ExpressionLanguage makes this work:** `Formula.evaluate(formulaId, context)` calls `ExpressionLanguage.parse("formula", expression)` then `ExpressionLanguage.evaluate(ast, {props: Property.listAll(nodeId), related: Relation.getRelated(nodeId, *)})`. The formula language's function registry includes `prop()`, `now()`, `dateAdd()`, `sum()`, `if()`, etc. — all registered as ExpressionLanguage functions, extensible via PluginRegistry.

#### Token

*Source: Drupal — typed placeholder substitution with chain traversal*

**Purpose:** Replace typed placeholders in text using entity property traversal.

- **State:** `tokenTypes: Map<TokenTypeID, TokenProviderDef>`, `patterns: Map<String, TokenResolutionChain>`
- **Actions:** `replace(text, context) → String`, `getAvailableTokens(context) → List<TokenDef>`, `scan(text) → List<TokenMatch>`, `registerProvider(tokenType, resolver)`
- **Op principle:** "After calling replace with text containing `[node:author:mail]`, the token resolves to the node author's email address by traversing entity relationships."

**How ExpressionLanguage makes this work:** Token chain expressions (`[node:author:mail]`) are a simple expression language registered as `ExpressionLanguage.registerLanguage("token-chain", tokenChainGrammar)`. Each colon-separated segment is a navigation step resolved via Property.get and Relation traversal.

#### ExpressionLanguage

*Source: Infrastructure audit — the computational substrate*

**Purpose:** Define, parse, and evaluate expressions in pluggable languages, providing the computational substrate that Formula, Query, AutomationRule, Token, and Template build on.

- **State:** `grammars: Map<LanguageID, GrammarDefinition>`, `functionRegistry: Map<LanguageID, Map<FunctionName, FunctionDef>>`, `operatorRegistry: Map<LanguageID, Map<OperatorSymbol, OperatorDef>>`, `typeCoercions: Map<{FromType, ToType}, CoercionRule>`, `astCache: Map<ExpressionString, AST>`
- **Actions:** `registerLanguage(languageId, grammar)`, `registerFunction(languageId, name, implementation, signature)`, `registerOperator(languageId, symbol, precedence, implementation)`, `parse(languageId, expressionString) → AST`, `evaluate(ast, context: Map<String, Value>) → Value`, `typeCheck(ast, expectedType) → TypeCheckResult`, `getCompletions(languageId, partialExpression) → List<Completion>`
- **Op principle:** "After registering a function in a language, any expression in that language can invoke it; after parsing an expression, evaluating it against a context returns the computed value."

**Why this was missing:** v0.2 had Formula with `evaluate(expression)`, Query with `parse(queryString)`, AutomationRule with `evaluateConditions()`, Token with `replace()`, and Template with variable resolution — but none of them defined the grammar, parser, function registry, or evaluation engine that makes expressions work. ExpressionLanguage is the shared substrate.

**Language instances (registered via PluginRegistry):**
- `formula` — Notion-style row-scoped math: `prop("Price") * prop("Quantity")`
- `query-filter` — condition expressions: `status = "published" AND created > now() - 7d`
- `query-datalog` — full Datalog: `[:find ?b :where [?b :block/refs ?p]]`
- `template-expr` — template interpolation: `${date("YYYY-MM-DD")}`, `${node.title | slugify}`
- `token-chain` — Drupal-style chain resolution: `[node:author:mail]`
- `guard-expr` — workflow transition guards: `user.hasRole("editor") AND node.status != "archived"`
- `condition-expr` — automation conditions: `event.type = "content_saved" AND event.node.tags CONTAINS "urgent"`
- `ai-prompt` — Tana-style: natural language instruction evaluated by LLM as a computation step

---

### Kit 10: Automation (`@clef/automation`)

```yaml
name: "@clef/automation"
version: 1.0.0
uses:
  "@clef/foundation":
    concepts: [ContentNode, Property]
  "@clef/classification":
    concepts: [Schema]
  "@clef/computation":
    concepts: [ExpressionLanguage]
  "@clef/infrastructure":
    concepts: [EventBus]
concepts:
  - Workflow
  - AutomationRule
  - Queue
  - Control
```

#### Workflow

*Source: Drupal — finite state machine*

**Purpose:** Define state machines with named states and guarded transitions.

- **State:** `workflows: Map<WorkflowID, {states, transitions, currentStates: Map<EntityID, StateID>}>`
- **Actions:** `defineState(workflowId, name, config)`, `defineTransition(workflowId, from, to, guard)`, `transition(entityId, targetState)`, `getCurrentState(entityId)`
- **Op principle:** "After transitioning content to 'published,' it becomes visible to the public; transitions only succeed when guard conditions (evaluated via ExpressionLanguage) pass."

**How EventBus makes this work:** `Workflow.transition(entity, targetState)` dispatches `EventBus.dispatch("workflow.transitioned", {entity, from, to})`. Other concepts subscribe: Cache invalidation, Notification to reviewers, Content status changes.

#### AutomationRule

*Source: Drupal ECA + Coda automations*

**Purpose:** User-configurable event-condition-action rules that extend the sync engine.

- **State:** `rules: Map<RuleID, {trigger: EventPattern, conditions: List<ConditionExpr>, actions: List<ActionDef>, enabled: Boolean}>`
- **Actions:** `define(trigger, conditions, actions)`, `enable(ruleId)`, `disable(ruleId)`, `evaluate(event)`, `execute(ruleId, event)`
- **Op principle:** "After defining a rule 'when tag applied, if tag is #urgent, send notification,' applying the #urgent tag fires the notification."

**How EventBus + ExpressionLanguage make this work:** `AutomationRule.define(trigger, conditions, actions)` registers `EventBus.subscribe(trigger.eventType, listener)`. When the event fires, conditions are evaluated via `ExpressionLanguage.evaluate("condition-expr", conditionAST, eventContext)`. This IS Clef's sync engine made user-configurable — Drupal's ECA (500 actions, 70 conditions, 200 events) and Coda's automations implement exactly this pattern.

#### Queue

*Source: Drupal Queue API*

**Purpose:** Deferred task processing with pluggable backends and time-budgeted workers.

- **State:** `queues: Map<QueueID, List<QueueItem>>`, `workers: Map<QueueID, WorkerDef>`, `backends: Map<BackendID, QueueBackend>`
- **Actions:** `enqueue(queueId, data)`, `claim(queueId) → QueueItem`, `process(item)`, `release(item)`, `delete(item)`
- **Op principle:** "After enqueuing an item, a worker eventually claims and processes it."

Backends swappable (database, Redis, RabbitMQ). Workers run during cron within time budgets.

#### Control

*Source: Hybrid report — data-bound interactive elements*

**Purpose:** Interactive elements (buttons, sliders, toggles) that bind to data and trigger actions, making documents into application interfaces.

- **State:** `controls: Map<ControlID, {type, label, value, binding, action}>`
- **Actions:** `interact(controlId)`, `getValue(controlId)`, `setValue(controlId, value)`, `triggerAction(controlId)`, `embed(controlId, targetNodeId)`
- **Op principle:** "After a user clicks a button control, its bound action fires."

This is the Coda pattern: buttons that trigger automations, sliders that filter views, toggles that update properties.

---

### Kit 11: Layout (`@clef/layout`)

```yaml
name: "@clef/layout"
version: 1.0.0
uses:
  "@clef/foundation":
    concepts: [ContentNode]
concepts:
  - Component
```

#### Component

*Source: Drupal Block module — Pluggable Component with Conditional Placement*

**Purpose:** Discoverable, configurable content units placed in layout regions with conditional visibility.

- **State:** `components: Map<ComponentID, ComponentDef>`, `placements: Map<PlacementID, {componentId, region, weight, visibility}>`, `conditions: Map<ConditionID, ConditionPlugin>`
- **Actions:** `render(componentId, context)`, `place(componentId, region, weight)`, `setVisibility(placementId, conditions)`, `evaluateVisibility(placementId, context)`
- **Op principle:** "A component renders in its placed region only when all its visibility conditions evaluate to true for the current context."

Combines two patterns: components as plugins (discoverable via PluginRegistry) and visibility as composable condition predicates. Distinct from ContentNode (which is the *content*) — Component is the *container/widget* that wraps and conditionally displays content.

---

### Kit 12: Infrastructure (`@clef/infrastructure`)

```yaml
name: "@clef/infrastructure"
version: 1.0.0
concepts:
  - Cache
  - ConfigSync
  - Pathauto
  - PluginRegistry
  - EventBus
  - Validator
```

#### Cache

*Source: Drupal — declarative cache invalidation via tag bubbling*

**Purpose:** Cache computed results with three-dimensional metadata (tags, contexts, max-age) that bubble upward through composition hierarchies.

- **State:** `bins: Map<BinID, Map<CacheKey, CachedItem>>`, `tags: Map<Tag, Set<CacheKey>>`
- **Actions:** `set(key, value, tags, contexts, maxAge)`, `get(key, contexts)`, `invalidate(key)`, `invalidateByTags(tags)`
- **Op principle:** "After invalidating a cache tag, all items tagged with it are removed; cache metadata from child elements bubble to parents via union of tags, union of contexts, and minimum of max-age."

The Drupal report calls this *"Drupal's most innovative infrastructure concept."* Two page cache layers: Internal Page Cache (full HTTP for anonymous) and Dynamic Page Cache (render arrays with auto-placeholdering).

#### ConfigSync

*Source: Drupal — configuration as code*

**Purpose:** Serialize structural settings to YAML/JSON with environment-specific override layers and version-controlled deployment.

- **State:** `activeConfig: Map<ConfigKey, ConfigValue>` (database), `syncDirectory: Map<ConfigKey, YAMLFile>`, `overrideLayers: List<OverrideLayer>`
- **Actions:** `export()`, `import()`, `override(key, value, layer)`, `diff() → ChangeSet`
- **Op principle:** "After exporting config and importing on another environment, both environments have identical structural settings."

#### Pathauto

*Source: Drupal — template-based slug generation*

**Purpose:** Generate URL-safe slugs from content properties using configurable token-based patterns.

- **State:** `patterns: Map<{NodeType, SchemaID}, PatternDef>`, `aliases: Map<NodeID, Slug>`
- **Actions:** `generateAlias(nodeId)`, `bulkGenerate(nodeType)`, `cleanString(input)`
- **Op principle:** "After saving a node, its URL alias is automatically generated from the configured pattern."

Uses Token.replace for pattern resolution. Uses ExpressionLanguage indirectly through Token.

#### PluginRegistry

*Source: Drupal plugin system — meta-concept for extensibility*

**Purpose:** Enable extensible, discoverable functionality units that can be added without modifying existing code.

- **State:** `pluginTypes: Map<TypeID, PluginTypeDefinition>`, `definitions: Map<TypeID, Map<PluginID, PluginDefinition>>`, `cache: Map<TypeID, CachedDefinitions>`
- **Actions:** `discover(typeId)`, `createInstance(typeId, pluginId, config)`, `getDefinitions(typeId)`, `alterDefinitions(typeId, alterCallback)`, `derivePlugins(typeId, basePlugin)`
- **Op principle:** "After placing a plugin class in the correct namespace with the correct attribute, the system discovers and makes it available without manual registration."

Three discovery innovations from Drupal: attribute-based discovery, Plugin Derivatives (one class → many instances), and alter hooks (cross-cutting modification). In Clef, PluginRegistry makes extensible: Property types, View layouts, SearchIndex backends, Component types, FormBuilder widgets, ContentParser formats, ExpressionLanguage functions, and Notification channels.

#### EventBus

*Source: Infrastructure audit — the sync engine's runtime*

**Purpose:** Provide event registration, dispatch, and subscription infrastructure that makes Clef's declarative syncs actually execute.

- **State:** `eventTypes: Map<EventTypeID, EventTypeDef{name, payloadSchema, sourceConcept}>`, `listeners: Map<EventTypeID, PriorityQueue<Listener>>`, `history: RingBuffer<DispatchedEvent>`, `deadLetterQueue: List<FailedDelivery>`
- **Actions:** `registerEventType(eventTypeId, payloadSchema)`, `subscribe(eventTypeId, listener, priority)`, `unsubscribe(eventTypeId, listenerId)`, `dispatch(eventTypeId, payload) → List<ListenerResult>`, `dispatchAsync(eventTypeId, payload)`, `stopPropagation()`, `getHistory(eventTypeId, since)`
- **Op principle:** "After subscribing to an event type, every dispatch of that event triggers the listener; listeners execute in priority order; a failed listener does not prevent subsequent listeners from firing."

**Why this was missing:** Every Clef sync is declarative: `sync ContentNode.save → Cache.invalidate`. But something must dispatch `content_node.saved` at runtime and route it to registered listeners. EventBus is that something. Every `sync A.x → B.y` compiles to `EventBus.subscribe("a.x_completed", (e) => B.y(e.context))`.

The Drupal report describes three event mechanisms that are all EventBus implementations: hooks (procedural callbacks), Symfony events (object-oriented pub/sub), and entity lifecycle callbacks (preSave/postSave).

**How it changes the sync model:**
```
# Before (v0.2 — magic dispatch assumed):
sync ContentNode.save → Cache.invalidate

# After (v0.3 — infrastructure explicit):
ContentStorage.save(node) calls EventBus.dispatch("content_node.saved", {nodeId, changes})
EventBus delivers to listener registered by: Cache sync → Cache.invalidateByTags(e.tags)
EventBus delivers to listener registered by: SearchIndex sync → SearchIndex.queueForIndexing(e.nodeId)
EventBus delivers to listener registered by: Pathauto sync → Pathauto.generateAlias(e.nodeId)
```

#### Validator

*Source: Infrastructure audit — runtime constraint enforcement*

**Purpose:** Enforce data integrity constraints at runtime by intercepting writes and checking values against type definitions, schema requirements, and custom rules.

- **State:** `constraints: Map<ConstraintID, ConstraintDef>`, `schemaRules: Map<SchemaID, List<ValidationRule>>`, `fieldRules: Map<{SchemaID, FieldID}, List<ConstraintID>>`, `customValidators: Map<ValidatorID, ValidatorFunction>`
- **Actions:** `registerConstraint(constraintId, evaluator)`, `addRule(schemaId, fieldId, constraintId, params)`, `validate(nodeId, proposedChanges) → ValidationResult{valid, errors}`, `validateField(value, fieldType, constraints)`, `coerce(value, targetType)`, `addCustomValidator(validatorId, predicate)`
- **Op principle:** "After adding a 'required' constraint to a field, any attempt to save a node with that field empty produces a validation error; validation never mutates data, only approves or rejects."

**Why this was missing:** TypeSystem defines types. Schema defines required fields. But nothing in v0.2 actually *enforced* constraints at write time. Validator is the runtime gatekeeper.

**Why separate from TypeSystem:** TypeSystem is declarative (what types exist, how they compose, introspection). Validator is operational (interception, constraint checking, error collection, coercion). You might want TypeSystem without Validator (flexible/schema-less mode) or Validator rules that aren't type-based (business logic like "end date must be after start date").

**How it wires:**
- `ContentStorage.save(node)` → `Validator.validate(node, changes)` as a pre-save gate
- `FormBuilder.processSubmission(formData)` → `Validator.validate(nodeId, formData)`
- `Schema.applyTo(nodeId)` → `Validator.addRule` for each required field
- `TypeSystem.registerType(def)` → `Validator.registerConstraint` for type-level constraints
- `Property.set(nodeId, key, value)` → `Validator.validateField(value, typeRegistry[key], rules)`

---

### Kit 13: Media (`@clef/media`)

```yaml
name: "@clef/media"
version: 1.0.0
uses:
  "@clef/foundation":
    concepts: [ContentNode]
concepts:
  - FileManagement
  - MediaAsset
```

#### FileManagement

*Source: Drupal — reference-counted resource lifecycle*

**Purpose:** Manage file lifecycle with reference counting and garbage collection.

- **State:** `files: Map<FileID, FileRecord>`, `usageRecords: Map<FileID, Set<{module, entityId}>>`, `streamWrappers: Map<Scheme, StorageBackend>`
- **Actions:** `upload(data, destination)`, `addUsage(fileId, entityId)`, `removeUsage(fileId, entityId)`, `garbageCollect()`
- **Op principle:** "Files start temporary; they become permanent when referenced and are garbage-collected when unreferenced."

#### MediaAsset

*Source: Drupal Media — source-abstracted asset façade*

**Purpose:** Wrap heterogeneous asset types behind a uniform entity interface using pluggable source plugins.

- **State:** `mediaEntities: Map<MediaID, {type, sourceField, thumbnailUri}>`, `sourcePlugins: Map<MediaType, SourcePlugin>`
- **Actions:** `createMedia(type, source)`, `extractMetadata(mediaId)`, `generateThumbnail(mediaId)`
- **Op principle:** "After creating a media entity from a YouTube URL, it has a thumbnail and metadata just like a locally uploaded image would."

---

### Kit 14: Collaboration (`@clef/collaboration`)

```yaml
name: "@clef/collaboration"
version: 1.0.0
uses:
  "@clef/foundation":
    concepts: [ContentNode]
  "@clef/identity":
    concepts: [Authorization]
concepts:
  - Flag
  - Group
```

#### Flag

*Source: Drupal — user-entity toggle relation*

**Purpose:** Generalize all "user marks entity" interactions (bookmarks, likes, follows, spam reports) into a reusable system.

- **State:** `flagTypes: Map<FlagTypeID, FlagTypeDef>`, `flaggings: Map<{FlagTypeID, UserID, EntityID}, FlaggingRecord>`, `counts: Map<{FlagTypeID, EntityID}, Integer>`
- **Actions:** `flag(userId, entityId, flagType)`, `unflag(userId, entityId, flagType)`, `isFlagged(userId, entityId, flagType)`, `getCount(entityId, flagType)`
- **Op principle:** "After flagging an entity, isFlagged returns true and getCount increments."

#### Group

*Source: Drupal — scoped namespace with tenant RBAC*

**Purpose:** Isolated content spaces with their own membership, roles, and permissions separate from global roles.

- **State:** `groups: Map<GroupID, GroupDef>`, `memberships: Map<{GroupID, UserID}, MembershipRecord>`, `groupRoles: Map<GroupID, Map<RoleID, RoleDef>>`, `groupContent: Map<GroupID, Set<NodeID>>`
- **Actions:** `createGroup(name, type)`, `addMember(groupId, userId, role)`, `assignGroupRole(groupId, userId, roleId)`, `addContent(groupId, nodeId)`, `checkGroupAccess(groupId, entity, operation, user)`
- **Op principle:** "After adding content to a group, only group members with the appropriate group role can access it."

---

### Kit 15: Notification (`@clef/notification`)

```yaml
name: "@clef/notification"
version: 1.0.0
uses:
  "@clef/foundation":
    concepts: [ContentNode]
  "@clef/identity":
    concepts: [Session]
  "@clef/computation":
    concepts: [Token]
  "@clef/automation":
    concepts: [Queue]
  "@clef/infrastructure":
    concepts: [EventBus, PluginRegistry]
concepts:
  - Notification
```

#### Notification

*Source: Infrastructure audit — user-facing alert delivery*

**Purpose:** Deliver user-facing alerts across multiple channels when system events require human attention, with per-user subscription preferences and templated message formatting.

- **State:** `channels: Map<ChannelID, ChannelConfig>`, `templates: Map<TemplateID, NotificationTemplate>`, `subscriptions: Map<UserID, Map<EventPattern, ChannelPreference>>`, `inbox: Map<UserID, List<NotificationRecord>>`, `deliveryLog: List<{notificationId, channel, status, timestamp}>`
- **Actions:** `registerChannel(channelId, deliveryHandler)`, `defineTemplate(eventPattern, channelId, template)`, `subscribe(userId, eventPattern, channelIds)`, `unsubscribe(userId, eventPattern)`, `notify(userId, eventType, context)`, `markRead(notificationId)`, `getUnread(userId)`
- **Op principle:** "After subscribing to 'comment.posted' on the 'email' channel, whenever someone comments on the user's content, they receive an email formatted from the comment notification template."

**Why this was missing:** Comments need to alert authors. Workflow transitions need to alert reviewers. @mentions need to alert mentioned users. Flag thresholds need to alert moderators. Group membership changes need to alert new members. All of these were described as syncs in v0.2 but had no delivery mechanism.

**How it wires:**
- `EventBus.dispatch("comment.posted")` → `Notification.notify(hostContentAuthor, "comment.posted", context)`
- `EventBus.dispatch("workflow.transitioned", {to: "needs_review"})` → `Notification.notify(reviewer, ...)`
- `Flag.flag(user, entity, "spam")` when count > threshold → `Notification.notify(moderator, ...)`
- Notification internally uses `Token.replace(template.body, context)` for message formatting
- Notification internally uses `Queue.enqueue("notification_deliver", ...)` for async delivery
- Channels (in-app, email, push, webhook, SMS) are registered via `PluginRegistry.discover("notification_channel")`

---

## 5. Cross-Kit Sync Recipes (Revised)

All syncs now show EventBus dispatch making the wiring explicit.

### Recipe: "Structured CMS" (Drupal-like)

Kits: Foundation + Identity + Linking + Classification + Query & Retrieval + Presentation + Content(Comment, Version) + Layout + Computation + Automation + Media + Infrastructure + Collaboration + Notification

```
# Content lifecycle (all dispatched via EventBus)
ContentStorage.save(node)
  → EventBus.dispatch("content_node.saved")
  → [listener] Validator.validate(node, changes) — pre-save gate
  → [listener] Cache.invalidateByTags([type:id])
  → [listener] SearchIndex.queueForIndexing(nodeId)
  → [listener] Pathauto.generateAlias(nodeId)

ContentStorage.delete(node)
  → EventBus.dispatch("content_node.deleted")
  → [listener] Comment.deleteByHost(nodeId)
  → [listener] FileManagement.removeUsage(nodeId)
  → [listener] Pathauto.deleteAlias(nodeId)

# Access chain
ContentStorage.access(op, user)
  → Session.getContext() → get current user
  → AccessControl.check → Authorization.checkPermission

# Schema + presentation
Schema.define → Collection.createConcrete(schema)
FormBuilder.buildForm(schema, mode) → DisplayMode.getWidget(field, mode) for each field
Renderer.render(element) → Cache.lookup(keys, contexts)
Renderer.render(node) → ContentParser.parse(content, "html") → AST for rendering
Renderer.autoPlaceholder → detects Session-dependent subtrees

# Workflow
Workflow.transition("published")
  → EventBus.dispatch("workflow.transitioned")
  → [listener] ContentNode.setMetadata("status", "published")
  → [listener] Cache.invalidateByTags([type_list])
  → [listener] Notification.notify(author, "content.published")
```

### Recipe: "Tools for Thought" (Roam/Logseq-like)

Kits: Foundation + Linking + Classification(Tag only) + Query & Retrieval(Query only) + Computation(ExpressionLanguage) + Data Organization(Graph) + Content(DailyNote, SyncedContent, Template, Version) + Infrastructure(EventBus)

```
# The progressive formalization chain (now with explicit parsing)
ContentNode.update(content)
  → EventBus.dispatch("content_node.updated")
  → [listener] ContentParser.parse(content, "markdown")
    → ContentParser.extractRefs → Reference.addRef / removeRef
    → ContentParser.extractTags → Tag.addTag / removeTag
    → ContentParser.extractProperties → Property.set  (key:: value conventions)
    → ContentParser.extractEmbeds → SyncedContent.createReference

# Backlink derivation
Reference.addRef(source, target)
  → EventBus.dispatch("reference.added")
  → [listener] Backlink.index(target, source)
  → [listener] Graph.addEdge(source, target)

# Daily notes with templates
DailyNote.getOrCreateToday()
  → ContentNode.create(type: "page", title: todayFormatted)
  → EventBus.dispatch("daily_note.created")
  → [listener] Template.instantiate(dailyNoteTemplate, newPage, {date: today})
  → Template.instantiate uses ExpressionLanguage.evaluate("template-expr", ...)

# Outline changes propagate
Outline.reparent(block, newPage)
  → EventBus.dispatch("outline.reparented")
  → [listener] Backlink.updateContext(block, newPage)

# Queries use ExpressionLanguage
Query.parse("tag:TODO AND created > 7d ago")
  → ExpressionLanguage.parse("query-filter", filterString)
  → Query.execute(storage)
```

### Recipe: "Hybrid Workspace" (Notion/Tana-like)

Kits: Foundation + Identity + Linking + Classification + Query & Retrieval + Presentation + Data Organization + Content + Computation + Automation + Infrastructure + Notification

```
# Runtime concept definition (the v0.4 story)
Intent.define("Meeting", 
  purpose: "Coordinate scheduled gatherings with agendas and follow-ups",
  principles: ["after scheduling, all attendees are notified",
               "after completing, follow-up tasks are generated"])

Schema.defineSchema("Meeting", [date, attendees, status, agenda])
Schema.associateView("Meeting", calendarViewId)
Schema.associateWorkflow("Meeting", meetingLifecycleId)
Schema.associateTemplate("Meeting", newMeetingTemplateId)

# Schema application (the structured ↔ unstructured bridge)
Schema.applyTo(nodeId)
  → EventBus.dispatch("schema.applied")
  → [listener] PageAsRecord.materializeProperties(nodeId, schema.fields)
  → [listener] Validator.addRule(schemaId, fieldId, constraint) for each field
  → [listener] AutomationRule.evaluate("on_tag_applied", nodeId)

# AI-assisted concept creation
Intent.suggestFromDescription("I need to track support tickets with priority and SLA")
  → ExpressionLanguage.evaluate("ai-prompt", description)
  → returns proposed {intent, schema, views, workflow, automations}
  → user reviews and confirms
  → Schema.defineSchema + Schema.associateView + ... (bulk creation)

# AI-powered computed fields (Tana pattern)
AutomationRule.evaluate("on_tag_applied")
  → Formula.evaluate(aiPromptExpression, nodeContent)
  → ExpressionLanguage.evaluate("ai-prompt", ast, {content: node.content})
  → Property.set(nodeId, computedField, result)

# Inline databases
Collection.createVirtual(query) → View.create(collection, "table")
View.embed(pageNodeId) → ContentNode.addChild(viewWidget)

# Reactive formulas
Property.set(nodeId, "price", 100)
  → EventBus.dispatch("property.changed")
  → [listener] Formula.invalidate(dependentFormulas)
  → [listener] Formula.evaluate → ExpressionLanguage.evaluate("formula", ...)
  → [listener] Property.set(nodeId, "total", computedResult)

# Interactive controls
Control.interact(buttonId)
  → EventBus.dispatch("control.interacted")
  → [listener] AutomationRule.evaluate("on_button_press")
  → AutomationRule conditions evaluated via ExpressionLanguage.evaluate("condition-expr", ...)
  → AutomationRule actions execute

# Export/import runtime concepts
Schema.export("Meeting") → ConceptBundle (includes Intent + Schema + all associations)
Schema.import(bundle) → recreates everything in target workspace

# Verify runtime concept integrity
Intent.verify("Meeting")
  → creates test Meeting node
  → runs operational principles as assertions
  → reports: "2 passed, 0 failed, 1 untestable"
```

---

## 6. Completeness Check

### Source reports → Clef mapping

**Drupal (27 concepts):** All mapped. Entity API → 6 (ContentNode, ContentStorage, TypeSystem, Property, FormBuilder, DisplayMode). Views → 4 (Query, ExposedFilter, View, Renderer). Remaining 17 map directly.

**TfT (14 concepts):** All mapped. Block → ContentNode. Embed → SyncedContent. All others direct.

**Hybrid (10 concepts):** All mapped. Automation → AutomationRule. All others direct.

### Infrastructure audit (6 concepts) → which gaps each fills

| Phantom Concept | What It Makes Work |
|---|---|
| **ExpressionLanguage** | Formula.evaluate, Query.parse, AutomationRule.evaluateConditions, Workflow.checkGuard, Token.replace, Template variable resolution |
| **ContentParser** | The entire progressive formalization chain: `[[refs]]` → Reference, `#tags` → Tag, `key:: value` → Property, `{{embed}}` → SyncedContent. Also: SearchIndex tokenization, Renderer content→HTML |
| **Validator** | Schema field enforcement, Property type checking, FormBuilder submission validation, Workflow transition guards that include data requirements |
| **EventBus** | Every sync in the library. All event-condition-action patterns. AutomationRule's runtime. Cache invalidation triggers. Backlink reindexing. Pathauto generation. |
| **Session** | AccessControl.check needs current user. Cache needs user-based variation. Renderer needs session detection for auto-placeholdering. |
| **Notification** | Comment alerts, workflow review requests, @mention notifications, flag threshold alerts, group membership changes |

### Runtime concept analysis (v0.4) → which gaps each fills

| Addition | What It Makes Work |
|---|---|
| **Intent** | Runtime concept definitions have purpose, operational principles, and testable assertions — not just structural fields. AI-assisted concept creation from natural language. Concept discovery by purpose. Verification that concepts deliver on their promises. |
| **Schema extensions** | Runtime concept definitions are exportable/importable as single units. "What concepts exist?" has an answer. Plugin types (EmailChannel, MarkdownFormat) can be defined as Schema + PluginRegistry + ContentNode instances without code deployment. |

---

## 7. The Progressive Formalization Spectrum

Each step is additive. No content migration required. Infrastructure concepts (marked with ⚙) operate at every step.

```
⚙ EventBus — dispatches all transitions between steps
⚙ PluginRegistry — makes every step extensible
⚙ Validator — enforces constraints at write boundaries
⚙ ExpressionLanguage — evaluates expressions at every step that computes
⚙ Intent — captures the "why" at every step that defines something

Intend           → Capture          → Parse            → Persist
(Intent)         (ContentNode)      (ContentParser)    (ContentStorage)

→ Organize       → Classify         → Connect          → Retrieve
  (Outline,       (Tag, Schema       (Reference,        (Query,
   Canvas)         → PageAsRecord)    Relation)          SearchIndex,
                                                         ExposedFilter)

→ Present        → Compute          → Automate         → Interact
  (View,          (Formula,          (Workflow,          (Control)
   DisplayMode,    Token)             AutomationRule,
   FormBuilder,                       Queue)
   Renderer)

→ Share          → Define
  (SyncedContent,  (Schema.export     ← runtime concept definitions
   Template,        → ConceptBundle     package Intent + Schema +
   Version,         → Schema.import)    all associations for
   Notification)                        export/import/sharing
```

Not a sequence — a menu. An app enters at any point, uses any subset.

The "Define" step is new in v0.4: once a user has built up a concept through the earlier steps (Schema with fields, Views, Workflows, Automations, Intent), they can export it as a single bundle and share it with other workspaces. This is how Drupal's content type exports, Tana's supertag sharing, and Notion's database templates work — now modeled explicitly in the framework.

**Total: 54 concepts, 15 suites.**
