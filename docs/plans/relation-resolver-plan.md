# Relation Resolution + Denormalization — Implementation Plan

**Version:** 1.0.0
**Date:** 2026-04-09
**Status:** Implementation-ready
**New concepts:** 2 (RelationResolver, RelationSpec)
**Modified concepts:** 1 (FieldDefinition — relation typeConfig expanded)
**New syncs:** 2
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

#### When auto-denormalization is overridden:

```
Property/set(schema, "denormalize.{fieldId}", '{
  "auto": false,              // user overrode
  "enabled": false,           // explicitly disabled
  "reason": "user-disabled",
  "overriddenBy": "admin",
  "overriddenAt": "2026-04-09T..."
}')
```

The Level 2 drawer shows "Pre-resolution disabled (manual override)" with an "Auto-detect" button to revert to system decision.

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

The denormalization config lives as a Property on the schema, keyed by field:

```
Property/set("Article", "denormalize.author", '{
  "auto": true,
  "enabled": true,
  "include": ["name", "avatar"],
  "depth": 1,
  "reason": "low-fanout-depth-1"
}')
```

RelationResolver reads these properties during `resolve()`. When `enabled: true`, it writes dot-notation fields. When `enabled: false` or absent, no denormalization — the compile-query sync falls back to join-at-read.

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

```json
[
  { "field": "author", "include": ["name", "avatar"] },
  { "field": "author.company", "include": ["name", "logo"], "lazy": true }
]
```

- `field` — the relation field path (dot-notation for multi-hop)
- `include` — which target fields to make available for projection
- `lazy` — optional, default false. When true AND not denormalized, client resolves instead of server join

### Resolution rules (in compile-query sync)

For each path in RelationSpec:
1. **Check denormalized:** Does the per-schema relation already have `{field}.{include[0]}`?
   - YES → just add to projection (zero cost)
2. **Not denormalized, lazy=false (default):** Inject `QueryProgram/join` instruction
3. **Not denormalized, lazy=true:** Add to projection as `{ key: "author.company.name", resolve: "lazy" }` — the client fetches asynchronously after initial render

### How it shows up in the schema editor

Not directly — RelationSpec is configured through the view system (ViewShell features). But the schema editor's **field-config-drawer** shows which views use each relation field (via SchemaUsage), so the admin can see "3 views access author.name" and decide whether to enable denormalization.

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

### 4.3 compile-query.sync (MODIFIED)

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
│  ☑ Pre-resolve for fast reads            │
│  Denormalized fields:                    │
│    ☑ name  ☑ avatar                      │
│  Depth: [1 ▾]                            │
│  ⚡ Denormalized on 47 Article records   │
│  [Backfill now]  [Clear denormalized]    │
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

## 10. Kanban Cards

| Card | PRD Sections | Blocked By | Blocks | Priority | Commit |
|---|---|---|---|---|---|
| **MAG-565** RelationResolver Concept + Handler | §2 | — | MAG-567, MAG-569 | high | |
| **MAG-566** RelationSpec Concept + Handler | §3 | — | MAG-567, MAG-569 | high | |
| **MAG-567** Resolution Syncs + compile-query Update | §4, §9 | MAG-565, MAG-566 | MAG-569 | high | |
| **MAG-568** relation-config-panel Widget + Schema Editor Updates | §6, §8 | — | MAG-569 | medium | |
| **MAG-569** Integration Tests + ViewShell Update + .view Examples | §5, §7, §9 | MAG-565–568 | — | medium | |

---

## 11. Open Questions

1. **Auto-denormalization heuristic** — Should RelationResolver automatically denormalize fields that are accessed by 3+ views? This would make the system self-optimizing. The data is there (SchemaUsage + RelationSpec tracking). Risk: unexpected write amplification.

2. **Max fan-out safety** — When propagating, if a Company is referenced by 50,000 Articles, the propagate action could be very expensive. Should there be a circuit breaker? Options: async queue with rate limiting, skip propagation above threshold and mark records as stale.

3. **Lazy resolution protocol** — How does the client know a field is lazy? Options: projection metadata (`{ resolve: "lazy", targetConcept: "Company", targetField: "name" }`), or a separate `lazyFields` array in the query result.

4. **Denormalization and VersionSpace** — If an entity is in a VersionSpace branch, should denormalized fields resolve against the branch's version of the target? Probably yes, but adds complexity to the resolve handler.
