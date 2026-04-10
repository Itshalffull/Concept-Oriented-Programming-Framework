# Relation Resolution + Denormalization — Implementation Plan

**Version:** 1.0.0
**Date:** 2026-04-09
**Status:** Implementation-ready
**New concepts:** 2 (RelationResolver, RelationSpec)
**Modified concepts:** 1 (FieldDefinition — relation typeConfig expanded)
**New syncs:** 3
**Modified syncs:** 1 (compile-query)
**Modified widgets:** 3 (field-header-popover, field-config-drawer, schema-fields-editor)
**New widget:** 1 (relation-config-panel)

---

## 0. Design Summary

Three layers, each with a single responsibility:

| Layer | Concept | Decides |
|---|---|---|
| **Schema** | FieldDefinition | "author is a relation to Person" (structural) |
| **Infrastructure** | RelationResolver + Property | "denormalize author.name on Article" (performance) |
| **View** | RelationSpec | "I want author.name" (access) |
| **Query pipeline** | compile-query sync | "author.name is denormalized → project; else → join; if lazy → skip" (adaptive) |

The view author declares what they want. The system delivers it the fastest way available. If denormalization is later enabled for a field, all views automatically get faster — no view changes.

---

## 1. FieldDefinition Relation typeConfig

When a FieldDefinition has `fieldType: "relation"`, its `typeConfig` JSON carries:

```json
{
  "target": "Person",
  "cardinality": "single",
  "displayField": "name"
}
```

This is purely structural — what entity type does the relation point to, single or multiple, and what field identifies the target in pickers. No resolution strategy here.

### How it shows up in the schema editor

**Level 1 (column header popover):** When the user picks "Relation" from the type-picker, the popover shows:
- Target schema dropdown (which schema can be linked)
- Cardinality toggle (single / multiple)
- Display field selector (which field of the target shows in the cell)

**Level 2 (field-config-drawer):** The Settings tab shows the same three options with more space. Plus:
- "Include fields" multi-select — which target fields should be accessible to views
- This sets the denormalization candidates (not the strategy — that's infrastructure)

**Level 3 (schema-fields-editor):** The field row shows a badge like `→ Person` next to the type badge. Clicking edit opens the drawer at Level 2.

---

## 2. RelationResolver Concept (NEW)

Maintains denormalized relation fields on entities and propagates changes through the reference graph.

```
concept RelationResolver [R] {
  purpose {
    Resolve relation fields at write time by fetching target entity
    fields and writing them as dot-notation keys on the source entity
    record in the per-schema relation. Maintains a reverse index for
    efficient propagation when referenced entities change. The view
    layer never knows whether data is denormalized or not — it just
    projects dot-notation field names.
  }

  state {
    // Reverse index: who references whom
    referrer:     R -> String     // entity that holds the relation field
    target:       R -> String     // entity being referenced
    schema:       R -> String     // source schema
    field:        R -> String     // relation field name
    depth:        R -> Int        // hop depth (1 = direct, 2+ = transitive)
  }

  actions {
    resolve(entity: String)
      -> ok(resolvedFields: String), no_relations
      // Read entity's schemas, find relation FieldDefinitions with
      // denormalization config, fetch targets, write dot-notation fields,
      // register reverse refs.

    propagate(changedEntity: String)
      -> ok(updatedCount: Int), no_references
      // Find all entities referencing changedEntity via reverse index,
      // re-resolve their denormalized fields.

    backfill(schema: String, field: String)
      -> ok(processedCount: Int), not_found
      // Bulk-resolve a newly configured denormalization for all
      // existing entities with this schema.

    getReferences(entity: String)
      -> ok(references: String)
      // Return all reverse references for an entity (who points at me).

    clearDenormalized(schema: String, field: String)
      -> ok(clearedCount: Int), not_found
      // Remove denormalized fields when denormalization is disabled.
  }
}
```

### Auto-Denormalization (Smart Defaults)

**Nobody configures denormalization manually by default.** When a relation field is created with `include` fields, the system automatically decides whether to denormalize based on measurable properties:

#### When does denormalization trigger?

**Not at schema time.** Creating a relation field with `include: ["name", "avatar"]` just declares availability — it doesn't denormalize anything. No view has asked for those fields yet.

**At view time.** When a RelationSpec is created or updated (i.e., a view says "I want author.name"), the system evaluates whether to denormalize. The trigger is `RelationSpec/create` or `RelationSpec/addPath`, not `FieldDefinition/create`.

This means: zero write cost until a view actually needs the data. If you define 10 include fields but only 2 views use 3 of them, only those 3 get denormalized.

#### Decision logic (runs on RelationSpec/create and RelationSpec/addPath):

```
1. Count referencing entities:
   entities = count(entities with this schema)
   → entities < maxFanOut (default 10,000): AUTO-ENABLE
   → entities ≥ maxFanOut: SKIP, warn in Level 2 drawer

2. Check depth:
   → depth 1: AUTO-ENABLE
   → depth 2+: SKIP, require explicit opt-in

3. Check target write frequency (if metrics available):
   → < 10 writes/hour on target schema: AUTO-ENABLE
   → ≥ 10 writes/hour: WARN in Level 2 drawer

4. Store decision:
   Property/set(schema, "denormalize.{fieldId}", '{
     "auto": true,
     "enabled": true,
     "include": ["name", "avatar"],
     "depth": 1,
     "reason": "low-fanout-depth-1",
     "entityCount": 47,
     "decidedAt": "2026-04-09T..."
   }')
```

#### What users see at each level:

**Level 1 (popover):** User checks "include name, avatar" → denormalization happens silently. No toggle, no decision. The included fields just appear as projectable columns.

**Level 2 (drawer):** Shows a "Performance" section:
- If auto-enabled: "⚡ Pre-resolved (automatic) — 47 records, ~0.1ms reads"
- If auto-skipped: "⚠ Not pre-resolved — 52,000 records would cause high write amplification. [Enable anyway] [Keep as join-at-read]"
- If target is write-heavy: "⚠ Person records change 200x/day. Pre-resolving means 200×47 = 9,400 propagation writes/day. [Enable anyway] [Disable]"
- Manual override toggle: user can force enable/disable regardless of auto-decision

**Level 3 (full editor):** Shows denormalization dashboard:
- Per-field: denorm status, entity count, propagation cost estimate
- Schema-wide: "This schema causes ~N extra writes/day from denormalization"
- Bulk toggle for power users
- "Backfill" button for newly enabled fields
- "Clear" button to remove denormalized data

#### Single data source, three editors

The denormalization config lives in ONE place: the FieldDefinition's `typeConfig.denormalize` object. Per included field, it tracks whether denormalization is enabled and who made that decision.

```json
{
  "target": "Person",
  "cardinality": "single",
  "displayField": "name",
  "denormalize": {
    "name":   { "enabled": true,  "source": "auto",             "reason": "low-fanout-depth-1" },
    "avatar": { "enabled": true,  "source": "view:dashboard",   "reason": "view-requested" },
    "email":  { "enabled": false, "source": "schema-admin",     "reason": "write-heavy-target" }
  }
}
```

Three editors write to the same field via `FieldDefinition/update`:

| Editor | When | Writes `source` as |
|---|---|---|
| Auto-decision | RelationSpec first requests the field | `"auto"` |
| Schema admin | Level 2/3 drawer toggle | `"schema-admin"` |
| View author | View editor relation config | `"view:{viewName}"` |

Last write wins. `source` is provenance (who decided), not priority. There's no override hierarchy to resolve — the current value IS the truth.

**How compile-query uses it:**
```
1. Read FieldDefinition for the relation field
2. For each included field in RelationSpec:
   a. Check denormalize.{field}.enabled in typeConfig
   b. If true → project dot-notation key from denormalized record
   c. If false and lazy hint on RelationSpec → mark for client resolve
   d. If false and no lazy hint → inject join instruction
```

No separate Property, no override chain, no "which one wins" logic. One read from FieldDefinition, one answer.

**Reverting to auto:** Any editor can set `source: "auto"` to hand the decision back to the system. The next auto-evaluation (triggered by RelationSpec changes or propagation stats) will re-decide.

#### Growth handling (what happens when 50 records becomes 50,000)

The auto-decision at time T is based on conditions at time T. But entity counts grow. A denormalization that was cheap at 50 entities may become expensive at 50,000.

**Re-evaluation on every propagate:**

After each `RelationResolver/propagate` call, the handler records the propagation stats:

```
Property/set(schema, "denormalize.{fieldId}.stats", '{
  "lastPropagateCount": 847,
  "lastPropagateMs": 230,
  "totalPropagations": 1542,
  "avgPropagateMs": 45,
  "peakPropagateCount": 2100,
  "evaluatedAt": "2026-04-09T..."
}')
```

**Degradation thresholds:**

| Metric | Warning | Auto-Downgrade |
|---|---|---|
| Propagation count per change | > 1,000 | > 10,000 |
| Propagation latency | > 500ms | > 5,000ms |
| Daily propagation writes | > 100,000 | > 1,000,000 |

When a threshold is crossed:

1. **Warning tier:** Set `"degraded": true` on the Property. Level 2 drawer shows: "⚠ author.name was auto-denormalized at 50 Articles. There are now 52,000. Propagation takes 2.3s per Person update. [Keep] [Switch to join-at-read]"

2. **Auto-downgrade tier:** Set `"enabled": false, "autoDowngraded": true`. Level 2 drawer shows: "⛔ Denormalization auto-disabled — propagation exceeded 10,000 writes. Views now use join-at-read. [Re-enable] [Keep disabled]"

On auto-downgrade, existing denormalized fields are NOT immediately removed (that would be another expensive operation). They become stale but harmless — the compile-query sync falls back to join-at-read, ignoring the stale denormalized values. A background cleanup can remove them later.

**Recovery:** If entity count drops (e.g., old records archived), the next propagate re-evaluates and can auto-re-enable if conditions are met again.

#### Configuration storage:

The denormalization config lives on the FieldDefinition's `typeConfig` — NOT as a separate Property. RelationResolver reads `FieldDefinition/get(schema, fieldId)` during `resolve()`, checks `typeConfig.denormalize.{field}.enabled`, and writes dot-notation fields for enabled includes.

No separate config store. No Property lookups. One read from FieldDefinition, one source of truth.

### How it shows up in the schema editor

**Level 1 (column header popover):** Not shown — denormalization is an infrastructure concern, not casual editing.

**Level 2 (field-config-drawer):** A "Performance" section in the Settings tab. Content is context-dependent:
- If auto-enabled: "⚡ Pre-resolved (automatic)" with stats and a "Disable" override
- If auto-skipped with reason: warning explaining why + "Enable anyway" button
- Manual override always available but tucked behind the auto-decision
- Depth selector only shown when depth > 1 is possible (target has relations)
- Shows propagation cost estimate: "~N writes/day from updates to Person records"

**Level 3 (schema-fields-editor):** Relation field rows show a small lightning bolt icon (⚡) when denormalization is enabled. The full editor's field detail pane shows denormalization stats and a "Backfill" button for newly enabled fields.

---

## 3. RelationSpec Concept (NEW — view suite)

Declares what relation data a view wants to access. Purely declarative — no strategy.

```
concept RelationSpec [R] {
  purpose {
    Declare which relation fields a view wants resolved. Each path
    names a relation field and the target fields to include. The
    query pipeline decides how to resolve: if denormalized, project
    directly; if not, join at read time; if marked lazy, skip and
    let the client resolve.
  }

  state {
    name:   R -> String
    paths:  R -> String   // JSON: [{ field, include, lazy? }]
  }

  actions {
    create(name: String, paths: String)
      -> ok, duplicate

    get(name: String)
      -> ok, not_found

    update(name: String, paths: String)
      -> ok, not_found

    addPath(name: String, field: String, include: String, lazy: Boolean?)
      -> ok, not_found, duplicate_path

    removePath(name: String, field: String)
      -> ok, not_found, path_not_found

    remove(name: String)
      -> ok, not_found

    list()
      -> ok
  }
}
```

### Path structure

Three path shapes — forward, reverse, and link — all resolved by the same infrastructure:

```json
[
  { "field": "author", "include": ["name", "avatar"] },
  { "field": "author.company", "include": ["name", "logo"], "lazy": true },
  { "reverse": "author", "sourceSchema": "Article", "include": ["title", "publishedAt"], "lazy": true },
  { "link": "mentions", "include": ["title"], "lazy": true }
]
```

#### Forward field paths — follow a relation field on THIS entity

- `field` — relation field path from FieldDefinition (dot-notation for multi-hop)
- `include` — which target fields to project
- `lazy` — optional, default false. When true AND not denormalized, client resolves

Example: "Show me my author's name" → `{ "field": "author", "include": ["name"] }`

Deep: "Show me my author's company's name" → `{ "field": "author.company", "include": ["name"] }`

#### Reverse field paths — find entities whose field points at THIS entity

- `reverse` — the field name on the SOURCE entity
- `sourceSchema` — which schema has this field
- `include` — which source entity fields to project
- `lazy` — optional, default true (reverse paths are often unbounded)
- `maxCount` — optional, max entities to resolve (default 10)

Example: On a Person page, "Show me all Articles where I'm the author" →
`{ "reverse": "author", "sourceSchema": "Article", "include": ["title", "publishedAt"] }`

**Reverse and deep linking are the same problem** — resolve data from a different entity via a graph edge. The only difference is direction. Resolution strategies are identical:

| Strategy | Forward (single) | Forward (deep) | Reverse |
|---|---|---|---|
| Denormalize | `author.name` on Article | `author.company.name` on Article | `articles_as_author` on Person |
| Join at read | Single join | Chained joins | Join through reverse index |
| Lazy | Client fetches | Client fetches | Client fetches |

The reverse index (`relation-refs`) supports both directions. `resolve()` follows forward edges. Reverse paths read the same index backward.

**Denormalization config for reverse** lives on the same FieldDefinition.typeConfig:

```json
{
  "target": "Person",
  "cardinality": "single",
  "denormalize": {
    "name": { "enabled": true, "source": "auto" },
    "avatar": { "enabled": true, "source": "auto" }
  },
  "denormalizeReverse": {
    "enabled": true,
    "include": ["title", "publishedAt"],
    "maxCount": 5,
    "source": "auto"
  }
}
```

No auto-created reverse FieldDefinition needed. Reverse is a path direction in RelationSpec, not a separate field. The denormalization system writes reverse data when configured.

#### Link paths — untyped reverse lookups (not field-based)

- `link` — "backlinks" or "mentions"
- `include` — which source entity fields to project
- `lazy` — optional, default true
- `maxCount` — optional, default 10

```json
{ "link": "backlinks", "include": ["title", "schema"], "lazy": true }
{ "link": "mentions", "include": ["title"], "lazy": true }
```

These are for references that don't come from schema fields — `[[mentions]]` in rich text bodies, manual Reference links. Everything else (tags, categories, author, taxonomy terms) is a relation field in the content-native model — accessed via forward or reverse field paths.

RelationSpec does NOT control denormalization strategy. For field paths (forward and reverse), denorm config lives on FieldDefinition.typeConfig. For link paths, denorm config lives on a Property. RelationSpec only declares what the view wants.

### Resolution rules (in compile-query sync)

For each path in RelationSpec:
1. **Read FieldDefinition** for the relation field
2. **Check typeConfig.denormalize.{includedField}.enabled:**
   - YES → project the dot-notation key from the per-schema relation (zero cost)
3. **Not denormalized, lazy=true on the path:** Add to projection as `{ key: "author.company.name", resolve: "lazy" }` — client fetches asynchronously
4. **Not denormalized, lazy=false (default):** Inject `QueryProgram/join` instruction

### How it shows up in editors

**In the view editor** (when configuring a view's RelationSpec):

```
┌────────────────────────────────────────────┐
│  Relation Fields                           │
│  ──────────────────────────────────────── │
│  author (→ Person)                         │
│    ☑ name     ⚡ denormalized (auto)       │
│    ☑ avatar   ⚡ denormalized (auto)       │
│    ☐ email                                 │
│    ☐ lazy (use if not denormalized)        │
│    [Enable denormalization]                │ ← writes to FieldDefinition
│                                            │
│  author.company (→ Company)                │
│    ☑ name     🔄 join-at-read             │
│    ☐ logo                                  │
│    ☑ lazy (load after initial render)      │
│    [Enable denormalization]                │ ← writes to FieldDefinition
│                                            │
│  Checking a field adds it to this view's   │
│  RelationSpec. Enabling denormalization     │
│  updates the FieldDefinition (affects all  │
│  views of this schema).                    │
└────────────────────────────────────────────┘
```

The view author sees:
- Which relation fields are available (from FieldDefinition type config)
- Current denorm status (reading from FieldDefinition, same as schema editor sees)
- Checkboxes to include fields in this view's RelationSpec
- `lazy` checkbox per path (stored on RelationSpec, not FieldDefinition)
- "Enable denormalization" button — writes to FieldDefinition, affects all views. The button shows a confirmation: "This will pre-resolve author.name for all 47 Article records. All views using this field will benefit."

**In the schema editor** (Level 2 drawer): Shows the same denormalization status from the same FieldDefinition record. The schema admin can enable/disable denormalization, and sees which views request each included field (via SchemaUsage). Both editors read and write the same data.

### ViewShell integration

ViewShell gets:
- New state field: `relation: V -> String` (RelationSpec ref)
- `relation` added to valid features set

.view files declare:
```
features {
  filter
  sort
  relation
  projection
}
```

---

## 4. Syncs

### 4.1 relation-resolve-on-save.sync

Triggers RelationResolver when any entity is saved:

```
sync RelationResolveOnSave [eventual]
purpose: "Resolve denormalized relation fields when an entity is saved."

when {
  ContentStorage/save: [ id: ?id ] => [ ok: _ ]
}
then {
  RelationResolver/resolve: [ entity: ?id ]
}
```

The handler is smart — if the entity has no schemas with relation fields, `resolve` returns `no_relations` immediately. Minimal cost for non-relational entities.

### 4.2 relation-propagate-on-save.sync

Triggers reverse propagation when an entity changes:

```
sync RelationPropagateOnSave [eventual]
purpose: "Re-resolve denormalized fields on entities that reference the changed entity."

when {
  ContentStorage/save: [ id: ?id ] => [ ok: _ ]
}
then {
  RelationResolver/propagate: [ changedEntity: ?id ]
}
```

The handler checks the reverse index. If nobody references this entity, returns `no_references` immediately.

### 4.3 relation-field-bridges-linking.sync (NEW)

**Currently missing:** Schema relation fields and the Reference/Backlink/Relation linking graph are completely disconnected. Setting `author: "person-42"` on an Article stores a string but the linking graph has no idea about it. The backlinks panel, reference graph, and "what links here" don't see schema relation fields.

This sync bridges them:

```
sync RelationFieldBridgesLinking [eventual]
purpose: "When a relation field value is set on an entity, create a
Relation record in the linking graph so backlinks, reference graph,
and relation queries all see schema-based relations."

when {
  ContentStorage/save: [ id: ?id ] => [ ok: _ ]
}
where {
  Schema/getSchemasFor: [ entity_id: ?id ] => [ ok: ?schemas ]
  FieldDefinition/list: [ schema: ?schemas ] => [ ok: ?fields ]
  filter(?fields where fieldType = "relation")
}
then {
  // For each relation field with a value:
  Relation/create: [
    source: ?id,
    target: ?fieldValue,
    type: ?fieldId,
    schema: ?schema
  ]
}
```

This means:
- Setting `article.author = "person-42"` automatically creates `Relation(article-1 → person-42, type: "author")`
- The existing backlink infrastructure picks it up — Person-42's backlinks panel shows "Referenced by Article-1 (author)"
- The reference graph sees the link
- Removing or changing the field value updates/removes the Relation record

**Important:** This sync should also REMOVE stale Relation records when a field value changes. If author changes from person-42 to person-99, the old Relation to person-42 is deleted and a new one to person-99 is created.

### 4.4 compile-query.sync (MODIFIED)

Add a new variant that handles RelationSpec:

```
sync CompileQueryWithRelations
purpose: "Inject join instructions for non-denormalized relation paths."

when {
  ViewShell/resolve: [ ... ] => [ ok: ?shell ]
}
where {
  guard(?features contains "relation")
  guard(?relation != "")
  RelationSpec/get: [ name: ?relation ] => [ ok: ?paths ]
}
then {
  // For each path where NOT denormalized AND NOT lazy:
  //   QueryProgram/join: [ source: ?targetRelation, localField: ?field, ... ]
  // For lazy paths: add to projection metadata
}
```

---

## 5. Reverse Index

The reverse index is maintained by RelationResolver and stored in a `relation-refs` storage relation:

```
Key: "{targetEntity}::{referringEntity}::{field}"
Value: {
  referrer: "article-1",
  target: "person-42",
  schema: "Article",
  field: "author",
  depth: 1
}
```

With a secondary index on the target field:
```
storage.ensureIndex('relation-refs', 'target');
```

`propagate("person-42")` does:
```
find('relation-refs', { target: 'person-42' })
→ [{ referrer: "article-1", schema: "Article", field: "author" }, ...]
```

For multi-hop (Article → Author → Company), transitive refs are stored:
```
relation-refs/"company-7::article-1::author.company" = {
  referrer: "article-1", target: "company-7",
  schema: "Article", field: "author.company", depth: 2
}
```

When Company changes, propagation finds article-1 directly without scanning through Person.

---

## 6. Schema Editor Integration

### Level 1 — Column Header Popover

When editing a **relation** field:

```
┌─────────────────────────────────┐
│  Author                          │
│  ─────────────────────────────  │
│  Type:  ▾  Relation          ⓘ  │
│  ─ Target ──────────────────    │
│  Schema:  ▾ Person              │
│  Display:  ▾ name               │
│  Cardinality: ● Single ○ Multi  │
│  ─ Show in columns ─────────   │
│  ☑ name                        │
│  ☑ avatar                      │
│  ☐ email                       │
│  ☐ phone                       │
│  ─────────────────────────────  │
│  Sort by this field  ›          │
│  Filter by this field ›         │
│  Configure ›                    │ ← opens Level 2
│  Delete                ⌫        │
└─────────────────────────────────┘
```

"Show in columns" checkboxes control which target fields appear as additional columns in the table. These map to the RelationSpec `include` array. When checked, `author.name` appears as a column header.

### Level 2 — Field Config Drawer

When configuring a **relation** field:

```
┌─────────────────────────────────────────┐
│  Author (Relation → Person)       [×]   │
│  ─────────────────────────────────────  │
│  Tabs: [Settings] [Validations] [Perf]  │
│                                          │
│  ─ Target ────────────────────────────  │
│  Schema:     ▾ Person                    │
│  Display:    ▾ name                      │
│  Cardinality: ● Single ○ Multiple        │
│                                          │
│  ─ Included Fields ──────────────────── │
│  Fields from Person available to views:  │
│  ☑ name          ☑ avatar               │
│  ☐ email         ☐ phone                │
│  ☐ company (→ Company)                  │
│     └ ☐ name   ☐ logo  (depth 2)       │
│                                          │
│  ─ Pre-resolve (Performance) ────────── │
│  ⚡ Auto-enabled (47 records, depth 1)   │
│  Denormalized: name, avatar              │
│  ~12 propagation writes/day              │
│  [Override: Disable for all views]       │
│  [Backfill now]  [Clear denormalized]    │
│                                          │
│  ─ Per-View Overrides ─────────────────│
│  Content List: ⚡ denormalize (auto)     │
│  Dashboard:    ⚡ denormalize (auto)     │
│  Admin Table:  🔄 join (view override)   │
│                                          │
│  ─ Usage ──────────────────────────────│
│  Used by 3 views:                        │
│    • Content List (author.name column)   │
│    • Article Detail (author sidebar)     │
│    • Dashboard (author.avatar card)      │
└─────────────────────────────────────────┘
```

The "Included Fields" section shows a tree — checking a deeper field (like `company.name`) automatically increments depth. The "Pre-resolve" section is the denormalization toggle. Usage shows which views access this relation data (from SchemaUsage).

### Level 3 — Schema Fields Editor

```
┌─────────────────────────────────────────────────────────────┐
│  ◆ Article                                    [⚙] [Save]    │
│  Tabs: [Fields] [Form] [Display]                            │
│                                                             │
│  FIELDS                                    [+ Add] [+ Reuse]│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ⋮⋮ Title          Aa text      ★ Required    [⚙] [×]   ││
│  │ ⋮⋮ Slug           Aa text      ★ Unique      [⚙] [×]   ││
│  │ ⋮⋮ Body           📝 rich-text  ★ Required    [⚙] [×]   ││
│  │ ⋮⋮ Author         → Person ⚡   includes 2    [⚙] [×]   ││
│  │    └─ name, avatar (denormalized)                        ││
│  │ ⋮⋮ Tags           ▾▾ multi-select             [⚙] [×]   ││
│  │ ⋮⋮ Published at   📅 date                     [⚙] [×]   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  [Export JSON]  [Import JSON]                                │
└─────────────────────────────────────────────────────────────┘
```

Relation fields show:
- `→ Person` badge (target schema)
- ⚡ icon when denormalization is enabled
- `includes 2` badge (how many target fields are included)
- Expandable sub-row showing which fields are included and their denormalization status

---

## 7. .view File Syntax

```
view "article-list" {
  shell: "article-list"

  features {
    filter
    sort
    relation
    projection
    pagination
  }

  fixture default {
    dataSource: {
      kind: "concept-action",
      config: "{\"concept\":\"ContentNode\",\"action\":\"listBySchema\",\"params\":{\"schema\":\"Article\"}}"
    }
    relation: {
      paths: "[{\"field\":\"author\",\"include\":[\"name\",\"avatar\"]},{\"field\":\"author.company\",\"include\":[\"name\"],\"lazy\":true}]"
    }
    sort: {
      keys: "[{\"field\":\"title\",\"direction\":\"asc\"}]"
    }
    projection: {
      fields: "[{\"key\":\"title\"},{\"key\":\"author.name\",\"label\":\"Author\"},{\"key\":\"author.avatar\",\"label\":\"\",\"formatter\":\"avatar\"},{\"key\":\"author.company.name\",\"label\":\"Company\"}]"
    }
    presentation: {
      displayType: "table"
    }
  }

  purpose {
    Article list with resolved author names and avatars. Author
    data is denormalized for instant reads. Company name resolves
    lazily on the client.
  }

  invariants {
    always "purity is read-only": { purity = "read-only" }
    always "has relation feature": { enabledFeatures contains "relation" }
  }
}
```

---

## 8. Widget Changes

### 8.1 relation-config-panel Widget (NEW)

Reusable panel for configuring relation fields, used inside field-header-popover and field-config-drawer:

```
widget relation-config-panel {
  anatomy {
    root, targetSchemaSelect, displayFieldSelect, cardinalityToggle,
    includeFieldTree, includeFieldCheckbox, depthIndicator,
    denormToggle, denormFieldCheckboxes, denormDepthSelect,
    denormStats, backfillButton, clearButton, usageList
  }

  states: collapsed [initial], expanded, backfilling

  props: schema, fieldId, targetSchema, currentConfig
}
```

### 8.2 Modified widgets

**field-header-popover.widget** — add relation-config-panel to compose block; show target/cardinality/include-checkboxes when fieldType is "relation"

**field-config-drawer.widget** — add "Performance" tab for denormalization config; embed relation-config-panel in Settings tab for relation fields

**schema-fields-editor.widget** — show `→ Target` badge and ⚡ denorm indicator on relation field rows; expandable sub-row for included fields

---

## 9. ViewShell + View Suite Changes

### ViewShell state addition
```
relation: V -> String    // RelationSpec ref name
```

### ViewShell features set expansion
Add `"relation"` to valid features.

### compile-query.sync new variant
`CompileQueryWithRelations` — checks denormalization status per path, injects joins for non-denormalized non-lazy paths.

### view-resolve.sync addition
Guard on `features contains "relation"`, fetch RelationSpec.

---

## 10. Full Clef-Base Integration Checklist

### Code changes required

| Change | File(s) | Notes |
|---|---|---|
| Add `"relation"` to VALID_VIEW_FEATURES | `handlers/ts/framework/view-spec-parser.ts` | Parser currently rejects `relation` in features block |
| Add `relation: V -> String` to ViewShell state | `specs/view/view-shell.concept`, handler | New child spec ref slot |
| RelationResolver handler | `handlers/ts/app/relation-resolver.handler.ts` | Functional StorageProgram |
| RelationSpec handler | `handlers/ts/view/relation-spec.handler.ts` | Functional StorageProgram (view suite) |
| Add RelationSpec to view suite.yaml | `specs/view/suite.yaml` | Recommended concept |
| Register handlers in kernel | `clef-base/lib/kernel.ts` | RelationResolver + RelationSpec |
| `ensureIndex('relation-refs', 'target')` | `clef-base/lib/kernel.ts` | Reverse index for propagation |
| Add `relation` to ViewShell features default | `handlers/ts/view/view-shell.handler.ts` | So existing views don't break |

### Syncs required

| Sync | Trigger | Effect |
|---|---|---|
| relation-resolve-on-save | ContentStorage/save | RelationResolver/resolve |
| relation-propagate-on-save | ContentStorage/save | RelationResolver/propagate |
| relation-field-bridges-linking | ContentStorage/save (relation field changed) | Relation/create in linking graph |
| linking-bridges-relation-field | Relation/create (typed, matching field) | Property/set on source entity |
| compile-query-with-relations | ViewShell/resolve (relation feature) | Inject joins for non-denormalized paths |

### Unified relation type registry

FieldDefinition IS the type registry for relations. The Relation concept's `type` field should reference a FieldDefinition, not be an independent free-form string.

When `FieldDefinition/create(schema: "Article", fieldId: "author", fieldType: "relation", target: "Person")` is called, "author" becomes a known relation type. When `Relation/create(source, target, type: "author")` is created, the system knows it maps to Article→Person.

This means:
- FieldDefinition defines the type: name, target schema, cardinality, constraints
- Relation records reference the type by name
- The reference-picker widget shows only valid targets (from FieldDefinition.typeConfig.target)
- The linking graph UI shows typed relations with schema badges

### Two kinds of RelationSpec paths: field and link

RelationSpec supports two path types:

**Field paths** — resolve through FieldDefinition (typed, schema-bound, single/multi):
```json
{ "field": "author", "include": ["name", "avatar"] }
```

**Link paths** — reverse lookups through the Reference/Backlink graph (always multi):
```json
{ "link": "backlinks", "include": ["title", "schema"], "lazy": true }
{ "link": "mentions", "include": ["title"], "lazy": true }
```

Valid `link` types:
- `"backlinks"` — all entities that reference this entity (via Reference/Backlink)
- `"mentions"` — entities that mention this entity in rich text content

That's it. Everything else (tags, categories, author, assignee, related articles) is already a relation field on a schema — accessed via `field` paths, not `link` paths. The content-native model unifies all forward-direction relations as schema fields.

`link` paths exist only for **reverse lookups** — "who points at me?" — which is the one thing a field can't express (fields go Article → Person, not Person ← Article).

**Denormalization works for both.** "Denormalize the titles of my 3 most recent backlinks" is handled by the same RelationResolver infrastructure as "denormalize author.name." The resolver doesn't care where the link came from — it resolves target entity fields and writes dot-notation keys.

For link paths, the denormalization config lives on a Property (not FieldDefinition, since there's no field):
```
Property/set("Article", "denormalize.backlinks", '{
  "enabled": true, "include": ["title", "schema"], "source": "auto",
  "maxCount": 10
}')
```

`maxCount` limits how many linked entities to denormalize (backlinks can be unbounded — you don't want to denormalize 10,000 backlink titles).

### Bidirectional bridge

The field ↔ linking graph bridge works both directions:

**Field → Linking:** When a relation field value is set, create a `Relation` record. The existing `bidirectional-links.sync` then triggers `Backlink/reindex`, so backlinks panel sees the link.

**Linking → Field:** When a typed `Relation` is created AND the type matches a FieldDefinition fieldId on the source's schema, set the field value via `Property/set`. This means creating a Relation through the graph UI auto-populates the schema field.

**Untyped References and `[[mentions]]` do NOT backfill fields.** Only typed Relations with a `type` matching a relation field name trigger the reverse bridge.

### Seeds required

| Seed file | Contents |
|---|---|
| `clef-base/seeds/RelationSpec.seeds.yaml` | Example relation specs for existing views that show related entity fields |

### Views to update

Any existing view that displays related entity data (e.g., "Author" column on article list) should get a RelationSpec ref and `relation` in features. The data currently comes from client-side resolution or hardcoded joins — this standardizes it.

### Widget: reference-picker

The inline-cell-editor already composes a `reference-picker` for relation fields. This widget needs to:
- Search target entities by display field
- Show recent/frequent targets
- Support "create on miss" (type a name that doesn't exist → offer to create)
- Show the target's display field in the cell after selection

If `reference-picker.widget` doesn't exist yet, it needs to be created as part of this work.

---

## 11. Type-Picker Presets for Relation Fields

The type-picker (Level 1) shows **presentational types** that map to `fieldType: "relation"` with preset widget/formatter combinations. Users see familiar names; storage is unified.

| Picker label | Icon | fieldType | target | widget | formatter |
|---|---|---|---|---|---|
| Tags | 🏷 | relation | Tag | tag-chips | colored-chips |
| Category | 📂 | relation | TaxonomyTerm | taxonomy-picker | badge |
| Person | 👤 | relation | Person | person-picker | avatar-name |
| Link to record | → | relation | (user picks) | reference-picker | linked-title |

All four create `FieldDefinition` with `fieldType: "relation"`. The difference is the preset `target`, `widget`, and `formatter` values. Power users can change any of these in the Level 2 drawer.

"Tags" in the picker → under the hood:
```json
{
  "fieldType": "relation",
  "typeConfig": { "target": "Tag", "cardinality": "multiple" },
  "widget": "tag-chips",
  "formatter": "colored-chips"
}
```

Tag and TaxonomyTerm entities are ContentNodes with their respective schemas. Assigning a tag to an Article is setting a relation field value — same as setting an author. The Tag/addTag and Taxonomy/tagEntity actions are bridged via the field↔linking sync.

---

## 12. Schema YAML → FieldDefinition Pipeline

Schema YAMLs in `clef-base/schemas/` already declare `type: Reference` fields (e.g., `author: Reference` on Article). These need to create FieldDefinitions when processed.

The ContentTypeScaffoldGen (or a boot-time sync) should:

1. Read schema YAML `type: Reference` fields
2. Create `FieldDefinition` with `fieldType: "relation"` and `target` from the YAML
3. Set `widget` and `formatter` from the YAML's `display` hints (if any)
4. Wire the field↔linking bridge sync

This ensures schema YAMLs are the source of truth for content-native schemas, and FieldDefinitions are created automatically — no manual setup needed.

---

## 13. Kanban Cards

| Card | PRD Sections | Blocked By | Blocks | Priority | Commit |
|---|---|---|---|---|---|
| **MAG-565** RelationResolver Concept + Handler (forward, reverse, propagate) | §2, §5 | — | MAG-567, MAG-569 | high | |
| **MAG-566** RelationSpec Concept + Handler + ViewShell Integration | §3, §10 | — | MAG-567, MAG-569 | high | |
| **MAG-567** Syncs: resolve, propagate, field↔linking bridge (bidir), compile-query | §4, §10 | MAG-565, MAG-566 | MAG-569 | high | |
| **MAG-568** Widgets: relation-config-panel, reference-picker, tag-chips, taxonomy-picker + Type-Picker Presets | §6, §8, §11 | — | MAG-569 | medium | |
| **MAG-569** Integration Tests + Parser Update + Schema YAML Pipeline + Seeds | §7, §10, §12 | MAG-565–568 | — | medium | |

---

## 11. Open Questions

1. **Auto-denormalization heuristic** — Should RelationResolver automatically denormalize fields that are accessed by 3+ views? This would make the system self-optimizing. The data is there (SchemaUsage + RelationSpec tracking). Risk: unexpected write amplification.

2. **Max fan-out safety** — When propagating, if a Company is referenced by 50,000 Articles, the propagate action could be very expensive. Should there be a circuit breaker? Options: async queue with rate limiting, skip propagation above threshold and mark records as stale.

3. **Lazy resolution protocol** — How does the client know a field is lazy? Options: projection metadata (`{ resolve: "lazy", targetConcept: "Company", targetField: "name" }`), or a separate `lazyFields` array in the query result.

4. **Denormalization and VersionSpace** — If an entity is in a VersionSpace branch, should denormalized fields resolve against the branch's version of the target? Probably yes, but adds complexity to the resolve handler.
