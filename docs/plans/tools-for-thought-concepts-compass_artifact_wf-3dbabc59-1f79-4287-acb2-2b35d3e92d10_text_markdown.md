# Design patterns for thought tools, modeled as composable concepts

**Roam Research, Obsidian, and Logseq converge on 14 reusable architectural patterns that can be cleanly separated into independent, spec-driven concepts with their own state, actions, and purpose — then coordinated through declarative synchronizations.** These three applications differ radically in storage philosophy (cloud-first Datascript, local-first Markdown files, hybrid outliner-database), yet they share a remarkably stable set of functional concepts. This analysis extracts each pattern from the concrete implementations, formalizes it as a COPF concept, and maps the synchronizations that wire them into a working system. The result is a blueprint for building any tools-for-thought application from composable, independently testable concept modules.

---

## Three architectures, one conceptual skeleton

Each tool makes a fundamentally different bet on its atomic unit and storage model, but all three arrive at the same set of functional capabilities. Understanding these architectural choices reveals which properties belong to each concept versus which emerge from synchronization.

**Roam Research** treats the **block** as the universal atom. Pages are just blocks with a `:node/title` attribute. Everything lives in a Datascript in-memory database — an entity-attribute-value (EAV) triple store running in the browser. Every block carries a 9-character UID (`:block/uid`), content string (`:block/string`), ordered children (`:block/children`), all ancestors (`:block/parents`), containing page (`:block/page`), and forward references (`:block/refs`). The backend stores a daily-snapshotted Datascript database plus a transaction log; the client materializes the full DB from snapshot + replayed transactions — essentially event-sourcing. Backlinks are computed by reverse-querying the `:block/refs` index. Tags (`#tag`) are syntactic sugar for page references. User-defined attributes use `Attribute:: value` syntax stored as plain text with parsed page references. Queries use full Datalog with `[:find ... :where ...]` clauses against the EAV store.

**Obsidian** treats the **page** (a Markdown file on disk) as the primary unit. A vault is just a folder. On startup, the `MetadataCache` parses every `.md` file and builds an in-memory index of links, tags, headings, frontmatter, and block IDs. Forward links are stored in `resolvedLinks` (a map of source paths to destination paths); backlinks are computed at query time by inverting this map — no persistent reverse index exists. Properties live in YAML frontmatter with a typed system (text, number, date, checkbox, link) enforced vault-wide since v1.4. Tags are a separate classification mechanism from links, supporting nesting (`#parent/child`). The Dataview community plugin transforms the vault into a queryable database with its own SQL-inspired DQL language operating over a `FullIndex`. The plugin architecture exposes `vault`, `workspace`, `metadataCache`, and `fileManager` APIs to TypeScript plugins running in-process.

**Logseq** occupies a hybrid position: block-first outliner backed by Datascript, with files as the serialization layer. In the legacy file version, pages map to Markdown/Org-mode files in `pages/` and `journals/` directories, parsed by the OCaml-based **mldoc** parser into Datascript entities. Sibling ordering uses a left-pointer (`:block/left`) scheme. The new DB version replaces files with **SQLite-WASM** persistence, renames blocks and pages to unified "nodes," introduces fractional indexing for ordering (`:block/order` with strings like `"a0"`, `"a0V"`), and promotes properties to first-class Datascript entities with Malli-validated typed schemas. A Web Worker isolates all database operations from the UI thread via Comlink IPC. Logseq's namespaced pages (`cat/tony`) create a tree overlay via `:block/namespace` references — a hierarchical organization layer absent from Roam and Obsidian.

Despite these differences, every tool ships the same 14 functional capabilities. That convergence is the evidence that these are genuine, reusable concepts.

---

## The 14 concepts: state, actions, purpose, and interactions

### Concept 1 — Block (atomic content unit with identity)

**Purpose.** Provide an addressable, manipulable unit of content smaller than a document, enabling granular reference, reuse, and querying.

**State.** Each Block owns: `id: UniqueID` (Roam's 9-char UID, Logseq's UUID, Obsidian's `^block-id`), `content: RichText` (the text/markdown string), `metadata: Map<Key, Value>` (creation time, edit time, author), `format: Enum{markdown, org}` (relevant for Logseq's dual-format support).

**Actions.** `create(content, metadata) → Block` generates a new block with a fresh unique ID. `update(id, newContent)` modifies content and updates edit metadata. `delete(id)` removes the block and all its owned state. `getContent(id) → RichText` retrieves current content. `setMetadata(id, key, value)` attaches arbitrary metadata.

**Interactions.** Block is the foundational concept — nearly every other concept depends on it. Outline uses Block as its node type. Backlink parses Block content to discover references. Property attaches structured data to Block. Query retrieves sets of Blocks. Template generates Blocks. The Block concept itself knows nothing about hierarchy, linking, or properties — those emerge from synchronization.

**Reusability.** Any content system needing addressable, fine-grained content units (collaborative editors, CMS block editors, annotation systems) can reuse this concept. The key insight from Roam's architecture: **a page is just a Block with a title attribute**, collapsing the page/block distinction into a single concept with an optional property.

---

### Concept 2 — Outline (tree-structured content)

**Purpose.** Organize Blocks into a hierarchical parent-child tree with ordered siblings, enabling indentation-based structure and focused navigation.

**State.** `parentOf: Map<BlockID, BlockID>` (each block's parent), `childrenOf: Map<BlockID, OrderedList<BlockID>>` (each block's ordered children), `isCollapsed: Map<BlockID, Boolean>` (expand/collapse state per node).

Roam denormalizes this with both `:block/children` (immediate children) and `:block/parents` (all ancestors) for query performance — finding "is this block under page X?" becomes a single datom lookup rather than recursive traversal. Logseq's DB version uses **fractional indexing** strings for `:block/order`, enabling conflict-free insertion between any two siblings without renumbering.

**Actions.** `indent(blockId)` moves a block to become the last child of its previous sibling. `outdent(blockId)` moves a block to become the next sibling of its current parent. `moveUp(blockId)` / `moveDown(blockId)` reorder among siblings. `collapse(blockId)` / `expand(blockId)` toggle child visibility. `zoom(blockId)` makes a subtree the root of the current view. `reparent(blockId, newParentId, position)` moves a block to an arbitrary location.

**Interactions.** Outline depends on Block (nodes are Blocks). Outline synchronizes with Backlink (moving a block to a new page updates its page context). Outline synchronizes with Query (queries can filter by ancestor chain). The denormalized ancestor list (Roam's `:block/parents`) is an optimization that couples Outline state to Query performance.

**Reusability.** Any hierarchical content system — task managers, file browsers, document outliners (WorkFlowy, Dynalist), code editors with folding — can reuse this concept. The fractional indexing pattern from Logseq is particularly valuable for collaborative scenarios, as shown in Kleppmann et al.'s research on CRDT-based tree move operations.

---

### Concept 3 — Backlink (bidirectional association discovery)

**Purpose.** Automatically surface reverse references, so that when A links to B, B knows about A — enabling emergent structure discovery without manual index maintenance.

**State.** `forwardRefs: Map<BlockID, Set<EntityID>>` (which entities each block references — stored as `:block/refs` in Roam/Logseq, as `resolvedLinks` in Obsidian), `backlinks: Map<EntityID, Set<BlockID>>` (computed reverse index — which blocks reference each entity).

**Actions.** `addReference(sourceBlockId, targetEntityId)` records a forward reference (triggered when content containing `[[...]]` or `((...))` is saved). `removeReference(sourceBlockId, targetEntityId)` removes a forward reference. `getBacklinks(entityId) → Set<BlockID>` returns all blocks referencing the entity. `getUnlinkedMentions(entityId, allBlocks) → Set<BlockID>` performs full-text search for the entity's name in blocks that don't have explicit references — a computationally expensive but discovery-rich operation.

The critical architectural question is **when backlinks are computed**. Roam and Logseq compute them via Datascript's reverse index on `:block/refs` (a ref-type attribute with cardinality-many), which is maintained at transaction time and supports efficient reverse traversal through the AVET index. Obsidian computes backlinks **at query time** by scanning all cached files — no persistent reverse index. The community `Backlink Cache` plugin addresses this with a persistent reverse map.

**Interactions.** Backlink depends on Block (source and target are Blocks/pages). Backlink synchronizes with the content parser: whenever Block content changes, the parser extracts `[[page references]]` and `((block references))` and calls `addReference` / `removeReference`. Backlink feeds into Graph (backlinks define edges). Backlink feeds into Query (queries can filter by "blocks referencing X").

**Reusability.** Any system that benefits from automatic reverse-reference discovery: wikis, knowledge bases, citation networks, dependency trackers, social graphs. The forward-ref + computed-backlink pattern is the standard implementation. Tim Berners-Lee noted in his original "HyperText Design Issues: Topology" document that bidirectional links "add information for free" by allowing the system to deduce inverse relationships.

---

### Concept 4 — Graph (emergent structure from links)

**Purpose.** Represent and visualize the network of connections between content units, enabling discovery of clusters, orphans, and unexpected relationships.

**State.** `nodes: Set<EntityID>` (all pages/blocks in the graph), `edges: Set<(EntityID, EntityID)>` (directed connections derived from references), `layout: Map<EntityID, Position2D>` (computed positions for visualization).

**Actions.** `addNode(entityId)` / `removeNode(entityId)` manage the node set. `addEdge(source, target)` / `removeEdge(source, target)` manage directed edges. `computeLayout(algorithm, params) → Map<EntityID, Position2D>` runs a layout algorithm (force-directed is universal across all three tools — nodes repel, edges attract, simulation iterates to equilibrium). `getNeighbors(entityId, depth) → Subgraph` extracts the local neighborhood (Obsidian's "local graph" is considered best-in-class). `filterNodes(predicate) → Subgraph` enables filtering by tags, folders, or other criteria.

**Interactions.** Graph depends on Backlink (edges come from forward/backward references). Graph depends on Block (nodes are content entities). Graph synchronizes with Tag (graph view can color-code by tag). Graph is a **read-only derived view** — it never modifies content, only visualizes structure. This is consistent across all three tools: the graph is always secondary to editing.

**Reusability.** Knowledge graph visualization, social network analysis, dependency mapping, citation networks. The force-directed layout with configurable parameters (center force, repel force, link force, link distance) is a standard physics simulation applicable to any graph visualization.

---

### Concept 5 — DailyNote (time-indexed capture)

**Purpose.** Provide a frictionless, temporally-organized entry point for content capture, reducing the "where should I put this?" decision to zero.

**State.** `dateFormat: String` (configurable format, e.g., `"YYYY-MM-DD"` or `"January 19th, 2021"`), `templateId: Optional<TemplateID>` (template applied on creation), `targetFolder: Path` (where daily notes are stored), `today: Date` (current date, auto-computed).

The architectural insight across all three tools is that **daily notes are not a special entity type**. In Roam, a daily note is simply a page with a date-formatted `:node/title` and a predictable UID (the date in `MM-DD-YYYY` format). In Obsidian, it's a Markdown file with a date-formatted filename. In Logseq, it's a page with `:block/journal-day` set to an integer like `20260218`. The "magic" is entirely in the convention and the auto-creation trigger.

**Actions.** `getOrCreateToday() → Page` checks if today's page exists; if not, creates it from the template. `navigateToDate(date) → Page` opens or creates a note for an arbitrary date. `listRecent(n) → List<Page>` returns the last n daily notes in reverse chronological order.

**Interactions.** DailyNote synchronizes with Block (a daily note is a Page, which is a Block with a title). DailyNote synchronizes with Template (applies a template on creation). DailyNote synchronizes with Query (queries can use date-based inputs like `:today`, `:7d-before`). Logseq's journal-first design makes DailyNote the **default home view** — the deepest integration of this concept.

**Reusability.** Any journaling system, daily standup tool, time-series note system, or logging application. The pattern of "date-formatted entity name as temporal index" is trivially portable. The frictionless capture philosophy — defaulting to today's page rather than requiring users to choose a location — is a UX pattern with broad applicability.

---

### Concept 6 — Query (structured retrieval over unstructured content)

**Purpose.** Enable database-like querying over content that was authored as free-form text, bridging the gap between unstructured writing and structured retrieval.

**State.** `queryExpression: QueryAST` (the parsed query), `resultSet: List<Block>` (matching blocks), `isLive: Boolean` (whether the query re-executes on data changes), `renderMode: Enum{table, list, task, calendar}` (how results are displayed).

Three distinct query engines implement this concept. **Roam** exposes full Datalog over its Datascript EAV store: `[:find (pull ?b [*]) :where [?b :block/refs ?p] [?p :node/title "TODO"]]`. **Logseq** uses the same Datalog foundation with both simple queries (`{{query (and [[page1]] (task TODO))}}`) that are internally compiled to Datalog, and advanced queries with `:find`/`:where` clauses. **Obsidian's Dataview** uses a SQL-inspired pipeline: `TABLE rating FROM #book WHERE rating > 4 SORT rating DESC`, operating over a `FullIndex` built from frontmatter, inline fields, and implicit file metadata. All three also support embedded JavaScript for arbitrary computation.

**Actions.** `parse(queryString) → QueryAST` parses query text into an AST. `execute(queryAST, database) → ResultSet` evaluates the query. `subscribe(queryAST, callback)` registers a live query that re-fires on changes (Roam's `roam.datascript.reactive` namespace provides this). `render(resultSet, mode) → View` displays results inline.

**Interactions.** Query reads from Block, Property, Tag, Backlink, and Outline state. Query synchronizes with DailyNote (special date-based input variables). Query is typically embedded within a Block (the query text lives in a block's content, and results render below it). The **dual-mode pattern** — simple queries for casual use, advanced queries for power users — is universal across all three tools and is a key reusability insight.

**Reusability.** Any system where users author unstructured content but need structured retrieval: CMS platforms, research databases, project management tools, code documentation systems. The Datalog-over-EAV pattern (Roam/Logseq) is particularly powerful because the flexible schema naturally accommodates the emergent structure of personal knowledge bases.

---

### Concept 7 — Property (structured metadata on unstructured content)

**Purpose.** Attach typed, queryable key-value metadata to content units, enabling structured operations (filtering, sorting, aggregation) over otherwise unstructured text.

**State.** `properties: Map<BlockID, Map<Key, TypedValue>>` (properties per block/page), `typeRegistry: Map<Key, PropertyType>` (vault/graph-wide type definitions), `closedValues: Map<Key, Set<AllowedValue>>` (enum constraints, as in Logseq's DB version).

Property type systems vary significantly. Obsidian enforces **one type per property name vault-wide** (text, list, number, checkbox, date, datetime, link) stored in `.obsidian/types.json`. Logseq's DB version has the richest system: properties are first-class Datascript entities with namespaced identifiers (`logseq.property.*`, `user.property.*`), Malli schema validation, cardinality control, and closed-value sets (enums). Roam's approach is the loosest: `Attribute:: value` is syntactic sugar parsed from block content, with no schema enforcement — the `::` convention creates implicit triples (block = subject, attribute name = predicate, value = object).

**Actions.** `set(blockId, key, value)` attaches or updates a property. `get(blockId, key) → TypedValue` retrieves a property value. `delete(blockId, key)` removes a property. `defineType(key, type, constraints)` registers a property type in the registry. `listAll(blockId) → Map<Key, TypedValue>` returns all properties on a block.

**Interactions.** Property depends on Block (properties attach to Blocks). Property feeds into Query (queries filter/sort by property values). Property synchronizes with Template (templates can pre-populate properties). Logseq's evolution illustrates a key design tension: in the file version, properties are parsed from text (`key:: value` in the block content string); in the DB version, properties are **first-class entities** independent of content text. This transition from "metadata-as-text-convention" to "metadata-as-schema" is a major architectural shift.

**Reusability.** Any content system needing structured metadata: CMS field systems, database record metadata, task attributes, product catalogs. The progressive formalization pattern — starting with untyped conventions and evolving toward enforced schemas — mirrors how real knowledge bases mature.

---

### Concept 8 — Tag (flat classification)

**Purpose.** Provide a lightweight, orthogonal classification mechanism that crosscuts hierarchical organization, enabling multi-dimensional categorization without folder duplication.

**State.** `tags: Map<BlockID, Set<TagName>>` (tags per block/page), `tagIndex: Map<TagName, Set<BlockID>>` (reverse index for fast lookup), `hierarchy: Tree<TagName>` (nested tag structure, supported in Obsidian and Logseq).

A critical implementation difference: **in Roam, tags are page references** — `#tag` is identical to `[[tag]]` under the hood, stored in `:block/refs`. There is no separate tag concept; tags and links are the same mechanism. In Obsidian, tags are a **distinct metadata type** indexed separately from wikilinks, with their own `TagCache` in the MetadataCache and support for nested hierarchies (`#projects/mobile/ios`). In Logseq's DB version, tags evolve into a **class/type system** where tagging a block with `#Task` assigns it to the `:logseq.class/Task` class, inheriting predefined properties (status, priority, deadline).

**Actions.** `addTag(blockId, tagName)` attaches a tag. `removeTag(blockId, tagName)` detaches a tag. `getByTag(tagName) → Set<BlockID>` retrieves all blocks with a tag. `getChildren(tagName) → Set<TagName>` returns child tags in a hierarchy. `rename(oldTag, newTag)` renames across all occurrences.

**Interactions.** Tag depends on Block. Tag feeds into Query (filter by tag), Graph (color-code by tag), and Property (in Logseq DB, tags and classes converge). The Roam approach of unifying tags with links simplifies the concept model but loses the semantic distinction. The Logseq approach of elevating tags to classes adds power but complexity.

**Reusability.** Tagging systems in social media, content management, email, bookmarking. The key design decision is whether tags are a separate concept or a specialization of linking — Roam's unification is simpler, Obsidian's separation is more expressive.

---

### Concept 9 — Embed / Transclusion (content reuse without duplication)

**Purpose.** Display content from one location inside another, maintaining a single source of truth while enabling contextual reuse — Ted Nelson's original vision of "the same content knowably in more than one place."

**State.** `embeds: Map<BlockID, Set<EmbedTarget>>` (which blocks embed which targets), `embedType: Map<(BlockID, EmbedTarget), Enum{reference, embed}>` (display mode — reference shows text only; embed shows full subtree with children and supports in-place editing).

Roam distinguishes **three levels**: block references `((uid))` show the target's text inline as read-only with distinct styling; block embeds `{{embed: ((uid))}}` render the full subtree with in-place editability (true transclusion); and aliases `[display text](((uid)))` show custom text linking to the target. Obsidian uses `![[Page]]` for page embeds, `![[Page#heading]]` for section embeds, and `![[Page^block-id]]` for block embeds — all rendered in preview mode. Logseq mirrors Roam's syntax.

**Actions.** `createReference(sourceBlockId, targetId)` inserts a read-only reference. `createEmbed(sourceBlockId, targetId)` inserts an editable transclusion. `resolve(embedTarget) → Block | Subtree` fetches current content of the target. `editThrough(embedId, newContent)` modifies the source block via the embed (only for full embeds, not references).

**Interactions.** Embed depends on Block and Outline (embeds can include subtrees). Embed synchronizes with Backlink (a reference/embed creates a forward ref tracked in `:block/refs`). The **single-source-of-truth** consistency model is critical: all three tools resolve embeds at render time by looking up the current content of the target entity. There are no copies to synchronize — changes propagate instantly because the embed is a live pointer, not a snapshot.

**Reusability.** Component libraries in design tools, shared content blocks in CMS, code snippet libraries, any system needing DRY content. The key consistency insight: render-time resolution eliminates sync problems entirely, at the cost of requiring the source to always be available.

---

### Concept 10 — Template (reusable content pattern)

**Purpose.** Define reusable content structures that can be instantiated with dynamic values, reducing repetitive creation and enforcing consistent patterns.

**State.** `templates: Map<TemplateID, BlockTree>` (the template definition as a tree of blocks), `variables: Map<TemplateID, Set<VariableDefinition>>` (dynamic placeholders), `triggers: Map<TemplateID, TriggerCondition>` (auto-application rules).

Complexity escalates from simple to programmable across tools. Obsidian's core templates support `{{title}}`, `{{date}}`, `{{time}}`; the Templater plugin adds full JavaScript execution with `<% %>` tags, file operations, web requests, and conditional logic. Roam's SmartBlocks use `<%COMMAND%>` syntax supporting date calculation, Datalog queries, conditionals, and arbitrary JS. Logseq offers built-in templates with date variables and `/template` invocation.

**Actions.** `define(templateId, blockTree, variables)` creates a template. `instantiate(templateId, targetLocation, variableBindings) → BlockTree` creates a copy of the template with variables resolved. `registerTrigger(templateId, condition)` sets up auto-application (e.g., Templater's "template on file creation in folder"). `mergeProperties(templateProperties, existingProperties) → Properties` handles the frontmatter merge behavior (Obsidian merges template properties with existing ones).

**Interactions.** Template depends on Block and Outline (templates are block trees). Template synchronizes with DailyNote (daily notes apply templates on creation). Template synchronizes with Property (template instantiation can set properties). Template can invoke Query (SmartBlocks can embed query results during instantiation).

**Reusability.** Any system with repeated content structures: project management templates, email templates, code scaffolding, form builders. The escalation from static text substitution to programmable generation is a universal pattern.

---

### Concept 11 — Namespace (hierarchical page organization)

**Purpose.** Provide a hierarchical overlay on the flat page namespace, enabling taxonomy-like organization without rigid folder structures.

**State.** `namespaceOf: Map<PageID, PageID>` (child page → parent page relationship), `separator: String` (the `/` character in Logseq).

This concept is most fully realized in Logseq, where creating `[[cat/tony]]` automatically creates a parent page `cat` and sets `:block/namespace` on the child. Obsidian achieves similar results through nested folders and nested tags (`#parent/child`). Roam has no native namespace mechanism.

**Actions.** `createNamespacedPage(fullPath) → Page` creates the page and all ancestor pages. `getChildren(pageId) → Set<PageID>` returns all direct children in the namespace. `getHierarchy(pageId) → Tree<PageID>` returns the full subtree. `move(pageId, newParentPath)` reparents a page.

**Interactions.** Namespace depends on Block (pages are Blocks). Namespace synchronizes with Graph (namespace relationships add edges). Namespace feeds into Query (Logseq's `(namespace [[parent]])` filter). The tension between flat (graph-based) and hierarchical (namespace-based) organization is a fundamental design choice — Logseq offers both simultaneously.

---

### Concept 12 — Canvas (spatial arrangement)

**Purpose.** Enable free-form, 2D spatial arrangement of content cards, breaking out of the linear/hierarchical constraints of text and outlines.

**State.** `nodes: Set<CanvasNode>` where each node has `id, type: Enum{text, file, link, group}, position: (x, y), dimensions: (width, height), content: varies`, `edges: Set<CanvasEdge>` where each edge has `id, fromNode, toNode, fromSide, toSide, label`.

Obsidian's **JSON Canvas** format (open-sourced at jsoncanvas.org, MIT license) is the most well-specified implementation — a JSON document with `nodes[]` and `edges[]` arrays. Logseq's whiteboards are built on the **tldraw** library, with shapes stored as regular Datascript blocks (enabling queries over whiteboard content — a unique integration). Roam has no native canvas.

**Actions.** `addNode(type, position, content) → CanvasNode` places a new card. `moveNode(nodeId, newPosition)` repositions. `connectNodes(fromId, toId, label) → CanvasEdge` creates a visual connection. `groupNodes(nodeIds) → GroupNode` creates a container. `embedFile(fileId, position)` references an existing page on the canvas.

**Interactions.** Canvas synchronizes with Block (text nodes contain Blocks; file nodes reference pages). In Logseq, canvas shapes ARE Blocks (tagged `:ls-type :whiteboard-shape`), so they participate in the full query and reference system. In Obsidian, text cards do NOT appear in backlinks until converted to files — a notable limitation of the file-based architecture.

---

### Concept 13 — Alias (multiple names for the same entity)

**Purpose.** Allow an entity to be referenced by multiple names, supporting abbreviations, translations, and contextual naming.

**State.** `aliases: Map<EntityID, Set<AliasName>>` (alternative names per entity).

Obsidian stores aliases in YAML frontmatter (`aliases: [name1, name2]`). When typing `[[`, autocomplete matches both filenames and aliases, generating `[[Full Name|Alias]]` format links. Logseq stores aliases as `:block/alias` (a ref-type attribute with cardinality-many). Roam supports `[display text](((uid)))` syntax for per-reference aliasing rather than entity-level aliases.

**Actions.** `addAlias(entityId, aliasName)` registers an alternative name. `removeAlias(entityId, aliasName)` unregisters. `resolve(name) → EntityID` resolves any name (primary or alias) to its entity.

**Interactions.** Alias synchronizes with Backlink (alias matches should appear in backlinks). Alias synchronizes with Query (queries should match aliases). Alias feeds into link resolution (the core resolution algorithm must check aliases).

---

### Concept 14 — Version (content history)

**Purpose.** Track changes over time, enabling rollback and audit of content evolution.

**State.** `history: Map<EntityID, OrderedList<(Timestamp, Snapshot)>>` (versioned snapshots per entity).

Roam's architecture naturally supports versioning through its transaction log — the append-only datom model preserves history (`:create/time`, `:edit/time`, `:create/email`, `:edit/email` on every block). Jeff Chen demonstrated recovering deleted Roam data by replaying the transaction log. Obsidian Sync maintains version history for rollback. Logseq's file-based version can leverage git; the DB version uses a transaction pipeline with SQLite.

**Actions.** `snapshot(entityId) → Version` captures current state. `listVersions(entityId) → List<Version>` returns history. `rollback(entityId, versionId)` restores a previous state. `diff(versionA, versionB) → ChangeSet` computes differences.

---

## How concepts synchronize into a working system

The power of the COPF model lies not in individual concepts but in **declarative synchronizations** — the wiring that connects independently defined concepts into coherent behavior. Here are the critical synchronizations extracted from the three tools.

**Block.update → Backlink.recompute.** When a Block's content changes, a parser extracts `[[page references]]` and `((block references))`, then calls `Backlink.addReference` and `Backlink.removeReference` to update the forward-ref index. This is the most fundamental synchronization — it's what makes bidirectional linking automatic rather than manual.

**Backlink.forwardRefs → Graph.edges.** The Graph concept derives its edge set entirely from Backlink's forward reference map. Every addition or removal of a reference triggers `Graph.addEdge` or `Graph.removeEdge`. The Graph never writes to content; it is a pure read-derived view.

**Outline.reparent → Backlink.updateContext.** When a block moves to a new page (via indent/outdent/drag), the `:block/page` and `:block/parents` references change. This must trigger Backlink to update the block's page context, since queries that filter by page need accurate ancestry. Roam's denormalized `:block/parents` (storing all ancestors) means moving a block requires updating this attribute for the block and all descendants — a cascade synchronization.

**DailyNote.getOrCreateToday → Template.instantiate.** When a daily note is created, if a template is configured, Template.instantiate fires with the date as a variable binding. The resulting block tree is inserted as children of the new daily-note page.

**Block.update → Property.reparse** (in text-convention systems). In Roam and Logseq's file version, properties are parsed from block content (`key:: value`). Every Block content update triggers Property to re-extract key-value pairs. In Logseq's DB version and Obsidian's Properties system, this synchronization is replaced by direct Property.set calls through the UI — the property is no longer embedded in content text.

**Tag.addTag → Property.set** (in Logseq DB). When a block is tagged with `#Task`, the Tag concept synchronizes with Property to auto-populate class-inherited properties (status, priority, deadline). Tags become a class/type system where tagging triggers schema enforcement.

**Query.execute → Block.getContent + Property.get + Backlink.getBacklinks + Tag.getByTag + Outline.getAncestors.** Query is the most connected concept — it reads from nearly every other concept's state. The dual-mode pattern (simple queries compiled to advanced queries) is a synchronization between two query interfaces sharing the same execution engine.

**Embed.resolve → Block.getContent + Outline.getChildren.** At render time, Embed looks up the current content and child tree of its target, producing a live view. Edits through an embed synchronize back via `Block.update` on the source entity.

---

## What makes these patterns genuinely reusable

The convergence of three independently developed tools on the same 14 concepts is strong evidence of their generality. Several properties make them particularly suitable for a COPF framework.

**Independence of state.** Each concept owns clearly bounded state. Block owns content. Outline owns hierarchy. Backlink owns references. Property owns metadata. No concept needs to know the internal state of another — they communicate only through defined actions. This is precisely Daniel Jackson's concept design principle: a concept is a "nanoservice" with its own API, independent of other concepts.

**Synchronization as the integration layer.** The tools differ not in which concepts they implement but in **how they wire the synchronizations**. Roam's "tags are links" unification means Tag synchronizes through Backlink rather than maintaining its own index. Obsidian's "backlinks computed at query time" means the Backlink→Graph synchronization is lazy rather than eager. Logseq's "properties are first-class entities" means the Block.update→Property.reparse synchronization is replaced by direct Property CRUD. These are all configuration choices in the synchronization layer, not changes to the concepts themselves.

**Progressive formalization.** The pattern of starting with text conventions (`key:: value` in block content) and evolving toward structured schemas (typed property entities) appears across multiple concepts. This suggests a meta-pattern: COPF concepts should support a **spectrum from convention-based to schema-enforced** operation, with synchronizations that can be swapped as the system matures.

**The EAV triple store as universal substrate.** Both Roam and Logseq chose Datascript's entity-attribute-value model as their storage layer, and for good reason: the flexible schema naturally accommodates the emergent structure of personal knowledge. Every COPF concept's state can be represented as EAV triples — Block attributes are triples, Outline parent-child relationships are ref-typed triples, Backlink references are ref-typed triples, Property key-values are triples. This suggests that **a COPF runtime for tools-for-thought should use an EAV store as its concept state substrate**, with Datalog as the query language.

**Local-first as an architectural constraint.** Kleppmann et al.'s seven ideals of local-first software — no spinners, cross-device, offline-capable, collaborative, long-lived, private, user-controlled — map directly to concept design constraints. Each concept's state must be representable as a CRDT or support CRDT-compatible merge operations. Obsidian's file-based approach demonstrates that even the simplest storage model (files + in-memory index) can satisfy most local-first ideals, while Logseq's dual-database architecture (Datascript in memory + SQLite for persistence) shows how to add query power without sacrificing local-first properties.

---

## Conclusion: a concept-oriented blueprint

The 14 patterns extracted from Roam, Obsidian, and Logseq form a **complete, composable toolkit** for building tools-for-thought applications. Block and Outline provide the content substrate. Backlink and Graph provide emergent structure. DailyNote provides frictionless capture. Query bridges unstructured authoring and structured retrieval. Property, Tag, and Namespace provide three complementary classification mechanisms at different granularities. Embed enables content reuse. Template enables pattern reuse. Canvas breaks out of linearity. Alias provides naming flexibility. Version provides temporal safety.

The most important finding is that **the differences between these three tools are almost entirely in their synchronization wiring, not in their concept definitions**. Roam's genius is unifying pages and blocks into a single concept. Obsidian's genius is using the filesystem as the concept state substrate, gaining interoperability. Logseq's genius is evolving from text-convention-based properties to schema-enforced typed entities while maintaining the same concept interfaces. A COPF framework that implements these 14 concepts with configurable synchronizations could reproduce any of the three tools — or create novel combinations that none of them offer today.