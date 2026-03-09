# Bridging structured and unstructured data: design patterns from Notion, Tana, and Coda

**Ten reusable, spec-driven software concepts emerge from decomposing how Notion, Tana, and Coda each solve the same fundamental problem: letting a single entity be both a freeform document and a queryable database record.** These concepts—each with independent state, actions, and purpose—can be modeled as first-class primitives in a Concept-Oriented Programming Framework (COPF) and coordinated through declarative synchronizations. The patterns are not tool-specific; they define a design space between fully structured CMS systems (Drupal, Airtable) and fully unstructured knowledge tools (Roam, Obsidian). What follows is an architectural deep-dive into each tool, a cross-cutting analysis of how they bridge the structured-unstructured gap, and a precise COPF specification for each extracted concept.

---

## Three architectures, one problem

Each tool picks a different base primitive and builds upward from it, producing fundamentally different answers to the same question: *How do you make data simultaneously writable as prose and queryable as a database?*

**Notion chooses the Block.** Every piece of content—paragraph, heading, image, database row, even a page—is a block entity stored in PostgreSQL with four core attributes: a UUID, a type string, a properties map, and an ordered content array of child block IDs. Pages are blocks whose children render as a document. Databases are collections of page-blocks that share a property schema. The critical unification: **every database row IS a page**, so every structured record doubles as a freeform document. Notion stores **200+ billion blocks** across 480 logical shards on 96 physical PostgreSQL instances, with 90% of upserts being updates rather than inserts—reflecting the note-editing-heavy workload. The block tree uses dual pointers: `content[]` arrays for downward rendering and `parent` attributes for upward permission traversal.

**Tana chooses the Node.** Everything—fields, views, commands, settings, workspaces—is a node in a graph. Nodes are atomic (no soft line breaks), uniquely identified, and owned by exactly one parent in an outline hierarchy. The breakthrough is the **Supertag**: a tag that simultaneously classifies a node ("this is a #book") and defines its schema (Author, Topic, Rating fields appear automatically). Supertags support single inheritance (`#author` extends `#person`) and multiple application on one node (`#task` + `#work` merge both field sets, a pattern Tana calls "emergence"). Unlike Notion, where schema lives on a database collection, Tana's schema lives on the tag and can be applied to any node anywhere in the graph—retroactively, incrementally, and composably.

**Coda chooses the Table-in-a-Document.** A Coda doc is a unified container holding prose, tables, controls (buttons, sliders), formulas, and automations on the same canvas. Tables are relational databases, not spreadsheet grids—each with typed columns, stable IDs, and a powerful list-oriented formula language where `Tasks.Filter(Status = "Done").Count()` can appear inline on the page surface alongside narrative text. The signature feature is the **Canvas Column**: a column type where each cell contains a full rich-content page, embedding freeform documents inside structured records at the cell level. Coda's formula language operates on columns-as-lists rather than individual cells, closer to functional programming than to Excel.

---

## How the structured-unstructured bridge actually works

The design space these tools occupy sits between Drupal-style structured CMS (schema-first, content-typed, fields predefined) and Roam/Obsidian-style unstructured knowledge tools (text-first, backlinks, no schema). Positioning on this spectrum:

```
Fully Structured ←————————————————————————→ Fully Unstructured
Drupal   Airtable   Coda   Notion   Tana   Roam/Logseq   Obsidian
```

Four architectural mechanisms produce the bridge:

**The dual-identity entity.** In Notion, a database row IS a page with arbitrary nested blocks beneath its property panel. In Tana, any bullet point IS a potential database record once tagged. In Coda, canvas columns embed rich documents inside table cells, and row detail views expand records into full pages. The pattern: **every structured record is also a container for unstructured content, and every piece of unstructured content is potentially a structured record.**

**Schema timing.** Notion uses schema-on-write for databases (define properties first, then populate) but schema-free for plain pages. Tana uses schema-on-read—write first in the outliner, tag later, fields appear retroactively. Coda leans schema-on-write (define table columns, then build). The progressive structuring pattern is most fully realized in Tana, where the transition from unstructured to structured requires only applying a supertag to an existing node, never moving content to a different location.

**View multiplexing.** All three tools separate data from presentation through configurable views. Notion binds views to specific databases (table, board, timeline, calendar, gallery, list views as tabs on one collection). Tana decouples views from containers entirely—live search nodes query the full graph and render results as tables, cards, calendars, or outlines, placeable anywhere. Coda creates linked views of tables that can appear on different pages. The scope hierarchy matters: Tana's graph-wide queries are most powerful; Notion's database-scoped views are most predictable; Coda's document-scoped views balance both.

**Computation spanning both worlds.** Notion formulas are row-scoped within a single database. Coda formulas span tables and appear inline on the page canvas. Tana's computation model uses AI-powered fields: define a supertag schema, attach AI prompts to fields, and the system extracts structured data from unstructured content automatically. This represents three paradigms—**mathematical formulas** (Notion/Coda), **declarative queries** (Tana search nodes), and **semantic extraction** (Tana AI fields)—each bridging structured and unstructured data at different levels of abstraction.

---

## Schema-on-node versus schema-on-collection versus schema-on-table

This is the deepest architectural divergence among the three tools and the one with the most significant implications for COPF concept design.

**Notion: schema-on-collection.** A database object defines a property schema (typed fields with names, IDs, and configurations). Every page-row in that database inherits this schema. A page belongs to exactly one database. To give a page structured properties, you must first create a database, define its schema, then add the page to it. The schema is the database's metadata; the page carries property values.

**Tana: schema-on-node.** A supertag defines fields, but any node can receive any supertag at any time. Multiple supertags compose their fields via emergence. The schema is not bound to a collection; it travels with the tag. A node tagged `#book` and `#gift` simultaneously has fields from both supertags. Searching for `#book` across the entire workspace produces a virtual collection—the "database" is a live query, not a pre-existing container. This means **collections are computed, not declared**.

**Coda: schema-on-table.** Column types define a table's schema. Each table has its own column set. Tables are independent objects within a document. To add structure, you create a table and define its columns—similar to Notion's approach but within the document context rather than the workspace. Coda's formula language then weaves tables together computationally.

The COPF implication: the Schema concept must be independent of both the Collection concept and the Entity concept. Tana proves schemas can be first-class objects that attach to instances via tagging rather than to containers via collection membership.

---

## Cross-entity relations across the three models

Notion implements **typed bidirectional relations** between databases. Creating a relation property in Database A automatically generates a reciprocal property in Database B. Rollup properties then aggregate across these relations (count, sum, average, min, max, date range). Notion's Formula 2.0 can traverse relations: `prop("Relation").prop("Email")` accesses properties on related pages. This is the closest model to relational database foreign keys.

Tana uses **field-based semantic references**. An instance field on a `#book` supertag can point to nodes tagged `#person`. The person's Reference section then shows "Appears as Author in [book name]." These are labeled, typed connections—not generic backlinks. However, Tana's community has identified a gap: **bidirectional field symmetry is incomplete**. Setting Book→Author creates a backlink on the Author, but the Author node doesn't gain a corresponding "Books" field automatically. This is the active frontier of Tana's architectural evolution—the tension between graph-style backlinks and relational-style foreign keys.

Coda uses **formula-based lookups**. Cross-table references are computed via formulas: `OtherTable.Filter(Project = thisRow)` pulls related rows. Lookups are unidirectional by default—you must create a reciprocal formula on the other table manually. Coda compensates with computational power: formulas can chain, iterate (`FormulaMap`), and aggregate across any table in the document.

For COPF, the Relation concept must support three flavors: declarative bidirectional (Notion), semantic labeled (Tana), and computed (Coda). The cleanest abstraction is a Relation concept with state `{sourceEntity, targetEntity, label, direction}` that synchronizes with a Rollup/Aggregation concept for cross-relation computation.

---

## Templates, transclusion, and content reuse

**Notion's synced blocks** implement transclusion through original/pointer semantics. An original synced block (`synced_from: null`) holds the source content. Duplicate synced blocks (`synced_from: { block_id: "..." }`) are pointers. Edits to any instance propagate to all others. This works across pages and workspaces. The API enforces the pattern: content is only modifiable on the original; duplicates are read-only pointers.

**Tana's references** share the same node ID. Copying a node and pasting it as a reference (Cmd+V) creates a mirror—editing any reference edits the original everywhere. References appear with dashed outlines visually. Unlike Notion's synced blocks (which wrap content in a container), Tana's references operate at the node level—any individual node can be referenced, not just explicitly marked blocks.

**Coda's canvas column templates** implement content reuse differently. A template page can be assigned as the default value for a canvas column. Each new row receives an independent copy of this template—not a live reference but a stamped instance. Changes to the template affect future rows only. Cross-doc syncing creates live-updating data references between documents, but at the table level rather than the content level.

For COPF, this suggests two distinct concepts: a **SyncedContent** concept (live transclusion with pointer semantics, as in Notion/Tana) and a **Template** concept (stamped instances with optional schema enforcement, as in all three tools).

---

## Embedded computation across the structured-unstructured divide

The computation models represent three distinct paradigms with different trade-offs:

**Notion's per-row formulas** are expressions evaluated in the context of a single database row. They access properties via `prop("Name")`, support conditionals (`if()`), date arithmetic (`dateAdd()`), string manipulation, and since Formula 2.0, list operations (`map()`, `filter()`) and relation traversal. Scope is limited to one database. Formulas cannot reference other databases directly except through relations. This keeps the model simple but constrains cross-database analytics.

**Coda's list-oriented reactive formulas** operate on columns-as-lists. `Tasks.Filter(Status = "Done" AND Priority = "High").Count()` is a single expression spanning an entire table. The `FormulaMap()` function enables iteration: `List.FormulaMap(CurrentValue * 2)`. Canvas formulas (typed with `=` on the page surface) bring computed values into the document flow outside any table. Named formulas create reusable document-wide computations. `WithName()` provides let-bindings. `RunActions()` enables side effects from formulas. This is the most computationally powerful model.

**Tana's AI-enhanced fields** represent a paradigm shift. Instead of mathematical formulas, the schema itself specifies what to extract. An AI-enabled field on a `#meeting` supertag reads the node's name, children, other fields, and description, then determines a value (action items, summary, sentiment). AI commands can chain: if dependent fields are empty and AI-enabled, they populate first. The prompt workbench uses variables (`${context}`, `${content}`, `${source}`) to reference node data. This is **declarative semantic computation**: define the desired output shape, and AI fills the gap between unstructured input and structured output.

---

## Ten COPF concepts extracted from the design space

Each concept below is specified with its single purpose, owned state, key operations, interactions with other concepts, reusability beyond these specific tools, and how it bridges structured and unstructured data. Concepts are designed to be composed through declarative synchronizations in a COPF framework.

### Concept 1: ContentNode

**Purpose.** Provide a universal, typed, composable primitive that represents any piece of content—text, media, structured record, or container.

**State.**
```
ContentNode {
  id: UUID
  type: NodeType           // paragraph, heading, image, toggle, database, page...
  properties: Map<String, Value>  // type-specific attributes
  children: OrderedList<ContentNode.id>  // downward rendering pointers
  parent: ContentNode.id   // upward ownership/permission pointer
  content: RichText | null // inline text content with annotations
  created_at: Timestamp
  last_edited_at: Timestamp
  created_by: User.id
}
```

**Key operations.** `create(type, properties, parent)`, `update(properties)`, `delete()`, `move(newParent, position)`, `addChild(child, position)`, `removeChild(child)`, `changeType(newType)` (preserves properties where compatible), `getAncestors()` (for permission traversal).

**Interactions.** Synchronized with **Schema** (when a node gains a type-tag, schema fields materialize as child nodes or property entries). Synchronized with **View** (nodes are the data that views project). Synchronized with **SyncedContent** (a node can be either an original or a reference pointer).

**Reusability.** This is the "everything is a file" pattern for content systems. Any application combining documents and data—wiki systems, project management tools, knowledge bases, CMS platforms—benefits from a universal content primitive. The `changeType()` operation (Notion's "Turn into") is especially powerful: it lets users restructure content without data loss.

**Bridge mechanism.** The same node can carry both `properties` (structured, typed, queryable) and `children` (unstructured, freeform, nestable). A node with type "database_row" has typed properties conforming to a schema AND arbitrary child nodes forming a document. This dual capacity is the fundamental bridge.

---

### Concept 2: PageAsRecord

**Purpose.** Enable every structured data record to also function as a rich, freeform document container, and vice versa.

**State.**
```
PageAsRecord {
  id: UUID
  schemaProperties: Map<PropertyName, TypedValue>  // structured data zone
  body: OrderedList<ContentNode.id>                 // unstructured content zone
  schema: Schema.id | null    // which schema (if any) governs this record
  collections: Set<Collection.id>  // which collections this record belongs to
}
```

**Key operations.** `setProperty(name, value)`, `getProperty(name)`, `appendToBody(contentNode)`, `removeFromBody(contentNode)`, `attachToSchema(schema)`, `detachFromSchema()`, `convertFromFreeform(schema)` (retroactively add structured properties to an existing document).

**Interactions.** Synchronized with **Schema** (properties conform to schema definitions). Synchronized with **Collection** (record appears in collection query results when it matches). Synchronized with **View** (the properties zone renders in table/board/calendar views; the body zone renders when the record is opened as a page). Synchronized with **Template** (new records can be pre-filled with both property values and body content).

**Reusability.** Any system that needs entities to be both queryable records and readable documents—CRM (deal as document), project management (task as specification), research (paper as annotated entry), HR (employee as profile page). The pattern eliminates the false choice between "is this a database entry or a page?"

**Bridge mechanism.** The entity physically contains both a structured zone (typed properties, conforming to a schema, queryable and filterable) and an unstructured zone (arbitrary content tree). The schema properties provide machine-queryable structure; the body provides human-readable narrative. Notion implements this as the property panel above page content; Tana implements it as supertag fields appearing as child nodes; Coda implements it as row detail views with canvas columns.

---

### Concept 3: Schema (type-as-mixin)

**Purpose.** Define a set of typed fields that can be attached to any entity, supporting inheritance and composition, without binding the schema to a specific container.

**State.**
```
Schema {
  id: UUID
  name: String
  fields: OrderedList<FieldDefinition>
  extends: Set<Schema.id>        // inheritance (supertag extends supertag)
  defaultContent: List<ContentNode>  // template body for new instances
  viewConfig: ViewConfiguration | null  // default view for collections of this type
  triggers: List<EventTrigger>    // on-add, on-modify event handlers
}

FieldDefinition {
  id: UUID
  name: String
  type: FieldType   // text, number, date, select, multi-select, relation, 
                    // formula, AI-extracted, checkbox, URL, email, person, file
  options: List<String> | null  // for select/multi-select
  targetSchema: Schema.id | null  // for relation fields: what type of entity
  formula: Expression | null  // for computed fields
  aiPrompt: String | null     // for AI-extracted fields
  defaultValue: Value | null
  required: Boolean
  pinned: Boolean             // show prominently in UI
}
```

**Key operations.** `addField(fieldDefinition)`, `removeField(fieldId)`, `extendSchema(parentSchema)` (inherit all parent fields), `getEffectiveFields()` (resolve inheritance chain to produce complete field set), `applyTo(entity)` (tag an entity with this schema), `removeFrom(entity)`, `getInstances()` (query all entities tagged with this schema).

**Interactions.** Synchronized with **PageAsRecord** (applying a schema to an entity materializes fields on that entity). Synchronized with **Collection** (schemas implicitly define virtual collections—all entities with a given schema). Synchronized with **Relation** (relation fields on a schema create cross-entity links). Synchronized with **Formula** (formula fields depend on other fields for computation). Synchronized with **View** (schema defines which fields are available for view configuration).

**Reusability.** The mixin pattern from object-oriented programming, applied to data schemas. Any system with user-definable types—form builders, CMS platforms, ERP systems, entity-component systems in game engines—benefits from schemas that compose via inheritance and multiple application. The key insight from Tana: **schemas should be first-class objects independent of containers**, enabling progressive structuring.

**Bridge mechanism.** A schema transforms an unstructured entity into a structured one by adding typed fields without destroying the entity's freeform content. Multiple schemas can compose on one entity (Tana's emergence), meaning an entity's structure grows incrementally. The `defaultContent` field seeds new instances with both structured fields AND unstructured template content, blending both worlds at creation time.

---

### Concept 4: View

**Purpose.** Provide multiple visual representations of the same underlying dataset, each with independent filter, sort, group, and layout configuration, without duplicating data.

**State.**
```
View {
  id: UUID
  name: String
  dataSource: DataSource        // a Collection, a Query, or a Table reference
  layout: LayoutType            // table, board, timeline, calendar, list, 
                                // gallery, chart, form, cards, outline, tabs
  filters: List<FilterRule>     // compound AND/OR conditions on properties
  sorts: List<SortRule>         // ordered sort criteria
  groups: GroupConfig | null    // property to group by, collapsed state
  visibleFields: OrderedList<FieldDefinition.id>  // which columns/properties show
  formatting: ConditionalFormatRules | null
  cardConfig: CardConfig | null // for board/gallery: preview source, size
  timelineConfig: TimelineConfig | null  // for timeline: date property, scale
}

DataSource = CollectionRef(Collection.id) 
           | QueryRef(Query)             // Tana-style: live search as data source
           | TableRef(Table.id)          // Coda-style: explicit table reference
```

**Key operations.** `create(dataSource, layout)`, `setFilter(filterRules)`, `setSort(sortRules)`, `setGroup(property)`, `setVisibleFields(fieldIds)`, `changeLayout(newLayout)`, `duplicateView()`, `embed(targetLocation)` (place this view as a block/node in another page—Notion's linked database, Tana's search node placement, Coda's view-of-table embedding).

**Interactions.** Synchronized with **PageAsRecord** (records matching the view's filter appear in the view; edits within the view modify the source records). Synchronized with **Schema** (available filters and visible fields come from the schema's field definitions). Synchronized with **Collection** (the view projects a collection's contents). Never duplicates data—purely a configuration lens.

**Reusability.** The Model-View separation pattern, made user-configurable at runtime. Any data-driven application benefits: dashboards, admin panels, reporting tools, project trackers, CRM systems. The `embed()` operation is the key bridging action—it allows structured data views to appear inline within unstructured document flow (Notion's linked databases on any page, Coda's table views embedded in prose).

**Bridge mechanism.** Views render structured data within unstructured contexts. Embedding a board view of tasks inside a project specification page places queryable, filterable structured data directly in the reading flow of prose. The same data appears as a calendar on one page and a table on another—the document provides narrative context while the view provides computational access.

---

### Concept 5: Relation and Rollup

**Purpose.** Create typed, navigable connections between entities across different schemas/collections, and compute aggregate values across those connections.

**State.**
```
Relation {
  id: UUID
  name: String
  sourceSchema: Schema.id
  targetSchema: Schema.id
  direction: Unidirectional | Bidirectional
  cardinality: OneToOne | OneToMany | ManyToMany
  reciprocalRelation: Relation.id | null  // for bidirectional: the auto-created inverse
  label: String                           // semantic name, e.g., "Author", "Assigned To"
}

Rollup {
  id: UUID
  name: String
  sourceRelation: Relation.id    // which relation to traverse
  targetField: FieldDefinition.id  // which field on related entities to aggregate
  function: RollupFunction        // count, sum, average, min, max, 
                                  // earliest_date, latest_date, percent_checked,
                                  // show_original, show_unique
  result: ComputedValue           // reactively updated
}
```

**Key operations.** `createRelation(source, target, label, direction)`, `link(entityA, entityB)`, `unlink(entityA, entityB)`, `getRelated(entity)`, `getBacklinks(entity)`, `createRollup(relation, field, function)`, `recompute(rollup)`.

**Interactions.** Synchronized with **Schema** (relation fields are defined on schemas; rollup fields appear as computed properties). Synchronized with **PageAsRecord** (linking two records creates navigable connections in both records' property panels and reference sections). Synchronized with **View** (related entities can appear as linked tokens in views; rollup values appear as computed columns). Synchronized with **Formula** (formulas can traverse relations: `prop("Relation").prop("Email")`).

**Reusability.** This is the foreign key + aggregation pattern from relational databases, made accessible in a no-code context. Any system with interconnected entities—graph databases, ERPs, knowledge graphs, social networks—needs typed relations with aggregation. The three-model comparison reveals the design space: Notion's declarative bidirectional relations are cleanest for simple use cases; Tana's labeled graph edges are most flexible; Coda's formula-based lookups are most powerful computationally.

**Bridge mechanism.** Relations connect entities that are simultaneously documents and records. Following a relation from a project page to its team member pages navigates both the structured dimension (showing aggregated task counts via rollups) and the unstructured dimension (opening the team member's profile page with its freeform content). The relation concept makes the graph of documents also a queryable relational database.

---

### Concept 6: Formula (embedded reactive computation)

**Purpose.** Enable declarative, reactive computation that derives values from both structured properties and cross-entity data, updating automatically when source data changes.

**State.**
```
Formula {
  id: UUID
  expression: Expression        // the formula source code
  scope: FormulaScope           // Row | Table | Document | Graph
  dependencies: Set<DataReference>  // properties, tables, relations this formula reads
  resultType: ValueType
  cachedResult: Value | null
  placement: Inline | ColumnFormula | CanvasFormula | NamedFormula
}

Expression = PropertyRef(name) 
           | Literal(value) 
           | FunctionCall(name, args)
           | Conditional(condition, then, else)
           | ListOperation(source, operation)  // filter, map, sort, reduce
           | RelationTraversal(relation, targetProperty)
           | AIExtraction(prompt, context)      // Tana-style semantic computation
```

**Key operations.** `evaluate(context)`, `getDependencies()`, `invalidate()` (mark for recomputation when a dependency changes), `setExpression(expr)`, `getResult()`.

**Interactions.** Synchronized with **Schema** (formula fields are part of schema definitions; formulas reference schema-defined properties). Synchronized with **Relation** (formulas can traverse relations to access related entity properties). Synchronized with **View** (formula results appear as computed columns in views). Synchronized with **PageAsRecord** (canvas formulas render computed values inline within page body content).

**Reusability.** Reactive computation is foundational to spreadsheets, data pipelines, UI frameworks (React, Svelte), and stream processing systems. The COPF Formula concept generalizes across all of these. The key design spectrum is **scope**: Notion limits formulas to single-row context; Coda allows cross-table list operations; Tana adds AI-powered semantic extraction. A reusable Formula concept should support all three scopes through its expression language.

**Bridge mechanism.** Formulas compute structured values from unstructured inputs. Coda's canvas formulas place computed values (`= Tasks.Filter(Status = "In Progress").Count()`) directly in prose. Tana's AI fields extract structured metadata from freeform text. The formula itself can live in either world: as a column formula (structured) or as an inline page formula (unstructured).

---

### Concept 7: Collection (virtual and concrete)

**Purpose.** Group entities into queryable sets, supporting both predefined containers (Notion databases, Coda tables) and dynamically computed collections (Tana search nodes).

**State.**
```
Collection {
  id: UUID
  name: String
  type: Concrete | Virtual
  schema: Schema.id           // shared property schema for members
  members: Set<PageAsRecord.id>  // for Concrete: explicitly added entities
  query: Query | null            // for Virtual: live search definition
  templates: List<Template.id>
}

Query {
  conditions: List<QueryCondition>  // AND/OR/NOT with field predicates
  scope: CollectionScope            // SingleCollection | Workspace | Graph
}
```

**Key operations.** `addMember(entity)`, `removeMember(entity)`, `query(filters, sorts)`, `getMembers()`, `setSchema(schema)`, `createFromQuery(query)` (create a virtual collection from a search definition), `materialize()` (convert virtual to concrete by fixing current results).

**Interactions.** Synchronized with **Schema** (collection defines which schema governs its members; for virtual collections, the query filters by schema/tag). Synchronized with **View** (views read from collections as their data source). Synchronized with **PageAsRecord** (entities are members of collections, either by explicit containment or by matching a query). Synchronized with **Template** (collections own templates that pre-fill new members).

**Reusability.** The concrete/virtual collection duality maps to materialized vs. computed views in databases, static vs. dynamic playlists in music apps, folders vs. smart folders in file systems. Any system that organizes entities benefits from supporting both explicit grouping and query-based grouping. Tana's innovation is making virtual collections (search nodes) first-class, embeddable entities rather than ephemeral query results.

**Bridge mechanism.** Concrete collections (Notion databases, Coda tables) impose structure by requiring entities to conform to a schema upon entry. Virtual collections (Tana search nodes) discover structure by querying across all content. The first model is schema-on-write; the second is schema-on-read. Supporting both in one concept enables the full spectrum of progressive structuring.

---

### Concept 8: SyncedContent (transclusion)

**Purpose.** Enable the same content to appear in multiple locations with synchronized editing—a single source of truth rendered in multiple contexts.

**State.**
```
SyncedContent {
  id: UUID
  originalNode: ContentNode.id    // source of truth
  references: Set<ReferenceInstance>
  syncMode: LiveBidirectional | SnapshotOnCreate
}

ReferenceInstance {
  id: UUID
  locationParent: ContentNode.id  // where this reference appears
  position: Integer               // position within parent's children
  originalNode: ContentNode.id    // points back to source of truth
}
```

**Key operations.** `createOriginal(contentNode)`, `createReference(original, targetLocation)`, `edit(content)` (applied to original; propagated to all references), `deleteReference(ref)` (removes one appearance; original persists), `deleteOriginal()` (removes all references or promotes one to original), `convertToIndependent(ref)` (break sync, make this reference a standalone copy).

**Interactions.** Synchronized with **ContentNode** (synced content wraps content nodes; editing the original triggers updates on all reference locations). Synchronized with **PageAsRecord** (synced content can appear within page bodies across multiple pages). Synchronized with **View** (embedded views of databases are a form of synced content—the data source is the "original" and each embedded view is a "reference").

**Reusability.** Transclusion is foundational to content management systems, documentation platforms (single-sourcing), and collaborative tools. Git submodules, symbolic links, database views, and React component composition all implement variations of this pattern. The original/pointer architecture from Notion's synced blocks is the cleanest implementation: one original holds content; N references are pointers. Tana's approach (references share the same node ID) is even more elegant—there's no wrapper, just the same entity existing in multiple locations.

**Bridge mechanism.** SyncedContent enables structured data to appear within unstructured contexts without duplication. A product specification table can be synced into both a technical document and a sales pitch. Editing in either location updates the single source. This collapses the boundary between "the database version" and "the document version" of the same information.

---

### Concept 9: Automation (document-embedded event-driven actions)

**Purpose.** React to data changes and user actions with triggered operations, embedding event-driven architecture within the content system.

**State.**
```
Automation {
  id: UUID
  name: String
  trigger: Trigger
  conditions: List<Condition> | null
  actions: OrderedList<Action>
  enabled: Boolean
  lastRun: Timestamp | null
  executionLog: List<ExecutionRecord>
}

Trigger = OnRowCreated(collection) 
        | OnFieldChanged(collection, field) 
        | OnTagApplied(schema)           // Tana: supertag added to node
        | OnButtonPressed(button) 
        | OnSchedule(cronExpression) 
        | OnExternalEvent(webhook)

Action = ModifyRecord(target, fieldUpdates)
       | CreateRecord(collection, properties)
       | DeleteRecord(target)
       | SendNotification(recipients, message)
       | CallExternalAPI(endpoint, payload)  // Coda Pack actions
       | RunAIExtraction(target, prompt)     // Tana AI commands
       | ExecuteFormula(expression)
```

**Key operations.** `create(trigger, actions)`, `enable()`, `disable()`, `execute(context)`, `addCondition(condition)`, `addAction(action)`, `getExecutionLog()`.

**Interactions.** Synchronized with **PageAsRecord** (automations react to record creation and property changes). Synchronized with **Schema** (tag-application triggers fire when schemas are applied). Synchronized with **Formula** (actions can execute formulas; conditions can evaluate formula expressions). Synchronized with **Control** (button controls trigger automations). Synchronized with **Collection** (automations scope their triggers to specific collections).

**Reusability.** Event-driven automation is universal: CI/CD pipelines, database triggers, IFTTT/Zapier recipes, AWS Lambda functions, and Slack workflow builders all implement this pattern. The COPF Automation concept makes it composable with content concepts—the trigger/condition/action structure is the same, but triggers come from content events (row created, tag applied, field changed) rather than system events.

**Bridge mechanism.** Automations react to changes in structured data and can produce unstructured outcomes (notification messages, AI-generated summaries) or vice versa (parsing unstructured input into structured records). Tana's "On supertag added" trigger is the purest bridge: the act of classifying unstructured content (applying a tag) triggers structured data processing (AI field extraction, notifications, status updates).

---

### Concept 10: Control (data-bound interactive element)

**Purpose.** Provide interactive UI elements that simultaneously serve as data inputs, display widgets, and action triggers, collapsing the view/controller distinction.

**State.**
```
Control {
  id: UUID
  type: ControlType       // button, slider, toggle, selectList, textInput, scale
  label: String
  value: Value | null     // current state of the control
  binding: DataBinding    // what data this control reads/writes
  action: Action | null   // what happens on interaction (for buttons)
  disabled: Expression    // formula that determines if control is interactive
  placement: CanvasInline | TableCell | FormField
}

DataBinding = PropertyBinding(entity, field)    // bound to a record's property
            | FormulaBinding(expression)        // displays a computed value
            | ControlVariable(name)             // standalone named value
```

**Key operations.** `interact(newValue)` (user changes the control), `getValue()`, `setValue(value)`, `triggerAction()` (for buttons), `evaluate_disabled()`, `embed(location)`.

**Interactions.** Synchronized with **PageAsRecord** (controls bound to entity properties update those properties on interaction). Synchronized with **Automation** (button presses trigger automations). Synchronized with **Formula** (control values can be referenced in formulas; formulas can determine control state). Synchronized with **View** (controls can appear within views, e.g., button columns in table views).

**Reusability.** Data-bound controls are the foundation of every UI framework (React state, Vue reactivity, Svelte stores, Angular two-way binding). The COPF Control concept abstracts this for document-embedded applications. Coda's implementation is the reference: buttons in table cells that trigger `RunActions()` combining multiple operations atomically. This pattern is directly applicable to internal tools, low-code platforms, and interactive documentation.

**Bridge mechanism.** Controls inject interactivity into documents. A slider embedded in prose controls a filter parameter on a nearby table view. A button in a table cell triggers an automation that sends a Slack message. The control sits in the unstructured flow (the page canvas) but operates on structured data (record properties, collection membership). It makes the document itself an application interface.

---

## Declarative synchronizations that compose these concepts

The power of COPF emerges not from individual concepts but from their synchronization. Here are the critical synchronization rules that produce the structured-unstructured bridge:

**Schema × ContentNode → PageAsRecord.** When a Schema is applied to a ContentNode (tagging), the node gains structured properties defined by the schema while retaining its unstructured content body. This is the foundational bridge synchronization. In Tana: "when `tag(node, supertag)` fires on Schema, `materializeFields(node, supertag.fields)` fires on PageAsRecord."

**Collection × View → Embedded structured data.** When a View is embedded in a ContentNode's body, structured data from a Collection renders inline within unstructured content. In Notion: a linked database view appears as a block inside a prose page. In Coda: a table view sits between paragraphs of text.

**Relation × Formula × Rollup → Cross-entity computation.** When a Relation links entities, Formulas can traverse the link, and Rollups aggregate across it. This chain enables: "show the total estimated hours for all tasks related to this project" as a computed value within a project's page.

**Automation × Schema → Progressive structuring pipeline.** When a Schema's "on-add" trigger fires, Automations execute AI extraction, notification, or data transformation actions. This means: tagging a raw meeting transcript with `#meeting` automatically extracts attendees, action items, and dates into structured fields.

**Control × Automation × PageAsRecord → Interactive documents.** A button control triggers an automation that modifies a record's properties. The document surface becomes an application interface where user interactions flow through to structured data operations.

These synchronization rules are **declarative**: they specify what happens when concept actions co-occur, not how. The COPF runtime resolves them, enabling the same concepts to compose differently in different applications—a project tracker, a CRM, a knowledge base, or a content management system—all from the same ten primitives.

---

## The deeper pattern: progressive formalization

Across all three tools and all ten concepts, one meta-pattern emerges: **progressive formalization**—the ability to start with raw, unstructured content and incrementally add structure, computation, automation, and interactivity without ever migrating data or rebuilding from scratch.

The progression follows a predictable path: **capture** (ContentNode) → **organize** (Collection, View) → **classify** (Schema applied to PageAsRecord) → **connect** (Relation, Rollup) → **compute** (Formula) → **automate** (Automation) → **interact** (Control) → **share** (SyncedContent, View embedding).

Tana optimizes for the early stages (capture and classify). Coda optimizes for the later stages (compute, automate, interact). Notion occupies the broadest middle ground. A COPF framework implementing all ten concepts would span the entire progression, letting users enter at any stage and advance incrementally—which is precisely what makes the design space between structured CMS and unstructured knowledge tools so architecturally rich.