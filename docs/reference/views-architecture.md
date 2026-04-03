# Views Architecture — clef-base

This document describes how the View system works in clef-base, covering the
full pipeline from seed data through kernel storage to rendering.

---

## 1. Overview

The View system is a **data-driven query-to-render pipeline**. Every view in
the admin surface is a kernel entity — there are no hardcoded views. The
pipeline has three layers:

1. **View config** — a kernel entity describing what data to fetch and how to display it
2. **Data source** — a concept action invocation that returns rows
3. **Display type** — a layout component that renders the rows (table, card-grid, graph, etc.)

An optional fourth layer, **DisplayMode**, controls per-item rendering within
layouts that support it.

### Key Files

| File | Role |
|------|------|
| `clef-base/app/components/ViewRenderer.tsx` | Core component — loads View config, fetches data, applies filters, dispatches to display |
| `clef-base/app/components/LayoutRenderer.tsx` | Composes multiple Views into spatial arrangements |
| `clef-base/app/components/widgets/DisplayModeRenderer.tsx` | Per-item rendering via (Schema, mode_id) resolution |
| `clef-base/lib/use-concept-query.ts` | React hook for invoking concept actions |
| `clef-base/lib/view-types.ts` | Shared types (GroupConfig, GroupFieldConfig) |
| `clef-base/lib/row-actions.ts` | RowActionConfig type and resolver |
| `clef-base/lib/widget-selection.ts` | Display interactor mapping and widget resolution |
| `clef-base/seeds/View.seeds.yaml` | 26 admin view definitions |
| `clef-base/seeds/View.process.seeds.yaml` | 7 process automation view definitions |
| `clef-base/seeds/DisplayMode.seeds.yaml` | 28 display mode definitions + component mapping wiring |
| `clef-base/seeds/Layout.seeds.yaml` | 12 layout compositions |
| `clef-base/seeds/ComponentMapping.seeds.yaml` | 25 widget-to-data bindings with slot sources |

---

## 2. View Config Structure

A View is a kernel entity (concept: `View`) with these fields:

```typescript
interface ViewConfig {
  view: string;              // Unique ID (e.g. "content-list")
  dataSource: string;        // JSON: { concept, action, params? }
  layout: string;            // Display type: "table", "card-grid", "graph", etc.
  visibleFields: string;     // JSON: FieldConfig[]
  filters: string;           // JSON: FilterConfig[]
  sorts: string;             // JSON: sort config (parsed but minimally used)
  groups: string;            // JSON: GroupConfig (for collapsible table groups)
  controls: string;          // JSON: { create?, rowClick?, rowActions? }
  title: string;             // Display title
  description: string;       // Helper text
  defaultDisplayMode: string; // Per-item mode ID (e.g. "card", "table-row")
  useDisplayMode: string;    // "true" (default) or "false" — bypass display mode
}
```

All structured fields are stored as JSON strings in the kernel and parsed at
render time.

### Seed Example

```yaml
- view: content-list
  dataSource: '{"concept":"ContentNode","action":"list"}'
  layout: table
  visibleFields: '[{"key":"node","label":"Name"},{"key":"schemas","label":"Schemas","formatter":"schema-badges"}]'
  filters: '[{"field":"schemas","label":"Schema","type":"toggle-group"}]'
  controls: '{"create":{...},"rowClick":{"navigateTo":"/content/{node}"}}'
  title: Content
  description: Browse all content entities in the system.
  defaultDisplayMode: table-row
```

---

## 3. Data Flow

### 3.1 Queried Data (Standard Path)

This is the normal path — ViewRenderer fetches data from the kernel:

```
ViewRenderer(viewId="content-list")
  |
  v
1. View/get → load the View config entity
  |
  v
2. Parse JSON fields (dataSource, visibleFields, filters, controls, groups)
  |
  v
3. Resolve template variables in dataSource.params (e.g. {{entityId}})
  |
  v
4. useConceptQuery(concept, action, resolvedParams) → fetch raw data
  |
  v
5. If ContentNode data: enrich with Schema memberships (Schema/listMemberships)
  |
  v
6. Apply schemaFilter (from params) then interactive filters
  |
  v
7. Dispatch to display type component (TableDisplay, CardGridDisplay, etc.)
  |
  v
8. Per-item rendering via DisplayModeRenderer (if useDisplayMode=true)
```

**Template resolution**: DataSource params can contain `{{varName}}`
placeholders that are resolved from the `context` prop. This is how entity
detail views pass the current entity ID to child views.

```json
{"concept":"ContentNode","action":"get","params":{"node":"{{entityId}}"}}
```

### 3.2 Provided Data (Inline Mode)

ViewRenderer can bypass the data fetch entirely when given `inlineData`:

```tsx
<ViewRenderer
  inlineData={[{ node: "id1", name: "Item 1" }, ...]}
  inlineLayout="table"
  inlineFields={[{ key: "node", label: "ID" }, ...]}
  inlineGroupConfig={{ fields: [{ field: "status" }] }}
  compact={true}
/>
```

When `inlineData` is provided:
- View config loading is skipped (unless `viewId` is also provided)
- Data fetching is skipped entirely
- `inlineLayout`, `inlineFields`, and `inlineGroupConfig` override the view config
- `compact={true}` hides the header (title, badges, create button)

This is used for:
- Block children rendering (embedded views inside other views)
- Picker/selector modes with programmatic data
- Views composed by parent components without a seed definition

### 3.3 Picker Mode

When `onSelect` is provided, row clicks call `onSelect(row)` instead of
navigating. This enables ViewRenderer to function as an entity picker.

---

## 4. Data Source

The `dataSource` field is a JSON object:

```typescript
interface DataSourceConfig {
  concept: string;           // Concept name (e.g. "ContentNode")
  action: string;            // Action to invoke (e.g. "list")
  params?: Record<string, unknown>;  // Action parameters
}
```

Data is fetched via `useConceptQuery`, which:
1. Calls `invoke(concept, action, params)` on the kernel
2. Parses the `items` JSON string from list action responses
3. Returns `{ data, loading, error, refetch }`

### ContentNode Enrichment

When `dataSource.concept === "ContentNode"`, ViewRenderer performs an
additional enrichment step:

1. Fetches all schema memberships via `Schema/listMemberships`
2. Builds an `entity_id -> schemas[]` lookup map
3. Enriches each ContentNode with a `schemas` array field
4. Applies `schemaFilter` from params (if present) to pre-filter by schema

This is necessary because a ContentNode's identity is its set of applied
Schemas (per spec section 2.1), not a single "type" field.

---

## 5. Display Types

The `layout` field determines which display component renders the data.
There are **12 display type components**, divided into two categories:

### 5.1 Per-Item Layouts

These render each row individually and support `DisplayModeRenderer` for
per-item customization (when `useDisplayMode=true`):

| Layout | Component | Description |
|--------|-----------|-------------|
| `table` | `TableDisplay` | Tabular rows with sortable columns, grouping, and row actions |
| `card-grid` | `CardGridDisplay` | Responsive grid of cards with row actions |
| `board` | `BoardDisplay` | Kanban columns grouped by a field |

### 5.2 Holistic Layouts

These render the entire dataset as one visual structure and ignore
`DisplayModeRenderer`:

| Layout | Component | Description |
|--------|-----------|-------------|
| `graph` | `GraphDisplay` | Force-directed SVG node graph with schema-colored nodes |
| `stat-cards` | `StatCardsDisplay` | KPI metric cards (label + value + description) |
| `detail` | `DetailDisplay` | Key-value property grid for a single entity |
| `content-body` | `ContentBodyDisplay` | Block editor for unstructured content |
| `canvas` | `CanvasDisplay` | Free-form spatial canvas |
| `calendar` | `CalendarDisplay` | Calendar grid |
| `timeline` | `TimelineDisplay` | Chronological timeline |
| `tree` | `TreeDisplay` | Hierarchical tree |
| `board` | `BoardDisplay` | Kanban board (note: also per-item for cards within columns) |

### 5.3 Display Type Selection

The default layout comes from the View config's `layout` field. However,
ViewRenderer also supports **widget resolution** — it can ask the kernel's
`WidgetResolver` concept to recommend a different display component based on
the current theme context:

```typescript
invoke('WidgetResolver', 'resolve', {
  resolver: 'clef-base-view-resolver',
  element: interactor,      // e.g. "records-collection", "record-graph"
  context: JSON.stringify({
    platform: 'browser',
    viewport: 'desktop',
    density, motif, styleProfile, sourceType,
    optionCount: rowCount,
    fieldCount,
    tags: ['admin', 'view', layout, 'small-collection' | 'large-collection'],
  }),
});
```

The resolved widget is mapped back to a layout string via `mapWidgetToLayout()`.

---

## 6. Filtering

Views support two kinds of filters, both defined in the `filters` JSON array.

### 6.1 Interactive Filters (Toggle Groups)

User-facing filter buttons. Each button toggles a value on/off.

```typescript
interface FilterConfig {
  field: string;          // Entity field to filter on
  label?: string;         // Button group label
  type?: 'toggle-group';  // Filter type
  defaultOn?: string[];   // Values ON by default (if omitted, all values start ON)
  defaultOff?: string[];  // Values OFF by default
}
```

**Initialization**: On first data load, ViewRenderer extracts all unique
values for each filter field from the data. It then applies `defaultOn` /
`defaultOff` to determine the initial active set.

**Array field handling**: For array fields like `schemas`, the filter extracts
values by flattening across all rows. A row matches if ANY of its array
values are in the active set (OR semantics for multi-schema entities).

**Filter UI**: Each value renders as a toggle button with:
- A colored dot (from the `SCHEMA_COLORS` map for schema fields)
- The value label
- A count of matching rows
- An "all" toggle button for the entire field

### 6.2 Contextual Filters

Applied automatically without UI. Used for entity detail views where the
data should be scoped to the current entity.

```typescript
interface FilterConfig {
  source_type: 'contextual';
  field: string;              // Field to filter on
  operator: string;           // "equals", "contains", "embedding_similarity"
  context_binding: string;    // Context path (e.g. "context.entity")
  fallback_behavior: 'hide' | 'show-all';  // What to do when binding is unresolvable
}
```

When a contextual filter has `fallback_behavior: "hide"` and the context
binding can't be resolved (e.g. no `entityId` in context), the entire view
is hidden (`return null`).

**Examples from seeds**:
- Backlinks view: filter `target` equals `context.entity`
- Similar entities: filter by `embedding_similarity` to `context.entity`
- Graph neighbors: filter `neighbor_of` equals `context.entity`

### 6.3 Filter Application Order

```
Raw data → schemaFilter (from dataSource params) → contextual filters → interactive filters → displayData
```

---

## 7. Grouping

Grouping is configured via the `groups` JSON field or `inlineGroupConfig` prop.

```typescript
interface GroupFieldConfig {
  field: string;            // Field to group by
  sort?: 'asc' | 'desc';   // Group sort order
  hideEmpty?: boolean;      // Hide groups with no rows
  defaultCollapsed?: boolean; // Start collapsed
}

interface GroupConfig {
  fields: GroupFieldConfig[];   // Array of grouping fields
  hideEmpty?: boolean;          // Global hide-empty
}
```

**Parsing supports three formats**:
1. Full object: `{"fields": [{"field": "status", "sort": "asc"}]}`
2. JSON string shorthand: `"status"` (parsed as `{ fields: [{ field: "status" }] }`)
3. Plain string (unquoted): same as shorthand

**Behavior** (implemented in `TableDisplay`):
- Groups rows by the first grouping field
- Renders collapsible group headers with row counts
- Hides the grouping field from the regular table columns
- Only the first field in the `fields` array is currently used

**BoardDisplay** uses `groupBy` from the first group field to determine
kanban columns.

---

## 8. Sorting

The `sorts` field is parsed but minimally used in the current implementation.
Sorting is mostly handled implicitly by the data source (the concept action
returns data in its natural order) and by group-level sort configuration.

---

## 9. Field Configuration

Fields control what data is shown and how it's formatted.

```typescript
interface FieldConfig {
  key: string;           // Entity field name
  label?: string;        // Display label
  formatter?: string;    // Value formatter name
  visible?: boolean;     // Show/hide (default true)
  weight?: number;       // Sort order (future use)
}
```

### 9.1 Formatters

Formatters transform raw field values into styled React elements. They are
used consistently across TableDisplay, CardGridDisplay, DetailDisplay, and
DisplayModeRenderer.

| Formatter | Output |
|-----------|--------|
| `badge` | Colored badge pill |
| `boolean-badge` | "yes" (green) or "no" (gray) |
| `date` | Localized date string |
| `date-relative` | "today", "yesterday", "3d ago", or date |
| `date-absolute` | Localized date string |
| `json-count` | "N items" or "N entries" |
| `schema-badges` | Array of schema badges |
| `code` | Monospace code block |
| `truncate` | Max 60 chars + ellipsis |
| `json` | Pretty-printed JSON |
| `tag-list` | Array of badge pills |
| `entity-reference` | Info badge |
| `image` | `<img>` element |
| `heading` | Bold text |
| `rich-text` | HTML (dangerouslySetInnerHTML) |
| `plain-text` | Default — plain string |

### 9.2 Formatter Inference

`DisplayModeRenderer` can infer formatters from slot/prop names when no
explicit formatter is set:

| Name pattern | Inferred formatter |
|-------------|-------------------|
| `title`, `heading`, `name` | `heading` |
| `badge`, `status`, `type`, `kind` | `badge` |
| `tags`, `labels` | `tag_list` |
| `date`, `created`, `updated`, `*_at` | `date_relative` |
| `description`, `body`, `content` | `truncate` |
| `icon`, `image`, `avatar` | `image` |
| anything else | `plain_text` |

---

## 10. Controls

The `controls` JSON field configures interactive behaviors.

### 10.1 Create Form

```typescript
controls: {
  create: {
    concept: string;       // Concept to invoke
    action: string;        // Action name (e.g. "create")
    fields: Array<{
      name: string;
      label?: string;
      type?: 'text' | 'textarea' | 'select';
      options?: string[];  // For select type
      required?: boolean;
      placeholder?: string;
    }>;
  }
}
```

When `create` is defined, the view header shows a "Create" button that opens
a `CreateForm` overlay. After creation, the view refetches its data.

### 10.2 Row Click (Navigation)

```typescript
controls: {
  rowClick: {
    navigateTo: string;    // URL template with {fieldName} placeholders
  }
}
```

`{fieldName}` placeholders are resolved from the clicked row's data. Example:
`"/content/{node}"` navigates to `/content/my-entity-id`.

### 10.3 Row Actions

```typescript
interface RowActionConfig {
  key: string;            // Unique action ID
  concept: string;        // Concept to invoke
  action: string;         // Action name
  params: Record<string, string>;  // action_param → row_field mapping
  label: string | Array<{ when: { field: string; equals: unknown }; label: string }>;
  variant?: 'filled' | 'outlined' | 'ghost';
  condition?: { field: string; equals: unknown } | { field: string; notEquals: unknown };
}
```

Row actions render as buttons on each row/card. They support:
- **Conditional visibility**: Only show when a condition matches (e.g. show
  "Activate" only when `active === false`)
- **Dynamic labels**: Label can be a conditional array for context-dependent text
- **Param mapping**: Maps row field values to concept action parameters
- **Auto-refetch**: After a row action completes, the view refetches its data

---

## 11. Display Modes

A DisplayMode is a `(Schema, mode_id)` pair that defines how a single entity
is rendered within a per-item layout.

### 11.1 DisplayMode Config

Each DisplayMode entity has:

| Field | Description |
|-------|-------------|
| `schema` | Schema name (e.g. "ContentNode", "ProcessSpec") |
| `mode_id` | Mode identifier (e.g. "card", "table-row", "compact") |
| `name` | Human-readable name |
| `layout` | Optional layout reference for spatial composition |
| `component_mapping` | Optional ComponentMapping ID for widget takeover |
| `placements` | JSON array of FieldPlacement IDs for flat rendering |

### 11.2 Rendering Strategy Chain

DisplayModeRenderer resolves the mode and dispatches to a strategy:

```
1. ComponentMapping takeover (if component_mapping is set)
   → ComponentMapping/render → render tree with slots and sources

2. Layout composition (if layout is set)
   → Delegate to LayoutRenderer (currently falls back to flat fields)

3. Flat field placements (if placements has IDs)
   → FieldPlacement/list → render configured fields with formatters

4. SimpleFieldList fallback
   → Show all non-internal fields (first 8)
```

### 11.3 ComponentMapping

A ComponentMapping binds a widget to entity data:

```yaml
- name: card-default
  widget_id: card-widget
  schema: ContentNode
  display_mode: card
```

Each mapping has **slot bindings** that map widget slots to data sources:

```yaml
- mapping: mapping-1        # card-default
  slot_name: title
  sources: ["entity_field:node"]
- mapping: mapping-1
  slot_name: subtitle
  sources: ["entity_field:type"]
- mapping: mapping-1
  slot_name: metadata
  sources: ["entity_field:createdBy"]
```

**Source types**:
| Prefix | Behavior |
|--------|----------|
| `entity_field:fieldname` | Read field from the entity |
| `static_value:text` | Render literal text |
| `entity_reference_display:fieldname` | Render as an info badge |

### 11.4 How Views Reference Display Modes

A View's `defaultDisplayMode` field specifies which mode_id to use for
per-item rendering. ViewRenderer constructs the full mode key at render time:

```typescript
const rowSchema = row.schemas?.[0] ?? row.type ?? dataSource.concept ?? 'ContentNode';
// Looks up: DisplayMode.get("ContentNode:table-row")
```

When `useDisplayMode` is `"false"` (or the layout is holistic), the
DisplayMode layer is bypassed and the display component renders directly.

---

## 12. Layouts (Multi-View Composition)

A Layout composes multiple Views into a spatial arrangement.

```typescript
interface LayoutConfig {
  layout: string;      // Unique ID
  name: string;        // Human-readable name
  kind: string;        // Spatial kind
  title: string;       // Page title
  description: string; // Page description
  direction: string;   // For stack: "horizontal" or "vertical"
  gap: string;         // CSS gap
  columns: string;     // For grid: number of columns
  children: string;    // JSON array of LayoutChild
}

interface LayoutChild {
  type: 'view' | 'layout';   // Child type
  id: string;                 // View or Layout ID
  area?: string;              // Grid area name
  span?: number;              // Grid column span
}
```

### 12.1 Layout Kinds

| Kind | CSS | Description |
|------|-----|-------------|
| `stack` | Flexbox column/row | Vertical (default) or horizontal stack |
| `grid` | CSS Grid | N-column grid with span support |
| `split` | CSS Grid 1fr 1fr | 50/50 split |
| `sidebar` | CSS Grid 1fr 300px | Main content + sidebar |

### 12.2 Context Propagation

LayoutRenderer passes its `context` prop to all child ViewRenderers,
enabling template variable resolution:

```tsx
// EntityDetailView passes entity context
<LayoutRenderer layoutId="entity-detail" context={{ entityId: "my-node", entityPrimarySchema: "Concept" }} />

// LayoutRenderer passes context to each child
<ViewRenderer viewId="entity-properties" context={context} />
<ViewRenderer viewId="entity-content" context={context} />
```

Child views use `{{entityId}}` and `{{entityPrimarySchema}}` in their
dataSource params, which ViewRenderer resolves before fetching.

### 12.3 Recursive Composition

Layout children can reference other layouts (`type: "layout"`), enabling
nested composition:

```json
[
  {"type": "view", "id": "dashboard-stats"},
  {"type": "layout", "id": "nested-layout"},
  {"type": "view", "id": "content-list"}
]
```

---

## 13. Seed Definitions

### 13.1 View Seeds (View.seeds.yaml — 26 views)

| View ID | Layout | Data Source | Filters | Notes |
|---------|--------|-------------|---------|-------|
| `content-list` | table | ContentNode/list | schemas (toggle) | Main content browser |
| `schemas-list` | table | Schema/list | — | Schema definitions |
| `workflows-list` | table | Workflow/list | — | State machines |
| `automations-list` | table | AutomationRule/list | — | Automation rules |
| `taxonomy-list` | table | Taxonomy/list | — | Vocabularies |
| `themes-list` | card-grid | Theme/list | — | With activate/deactivate row actions |
| `display-modes-list` | card-grid | DisplayMode/list | schema (toggle) | DisplayMode browser |
| `views-list` | table | View/list | — | Meta: views of views |
| `mappings-list` | table | ComponentMapping/list | — | Widget bindings |
| `dashboard-stats` | stat-cards | ContentNode/stats | — | KPI cards, useDisplayMode=false |
| `dashboard-concepts` | table | ContentNode/list (schemaFilter=Concept) | — | Concept subset |
| `concept-graph` | canvas | ContentNode/list | schemas (toggle) | Full topology, useDisplayMode=false |
| `score-schemas` | card-grid | Schema/list | — | Schema browser |
| `syncs-list` | table | ContentNode/list (schemaFilter=Sync) | suite, tier (toggle) | Sync rules |
| `installed-suites` | table | AppInstallation/list | — | Installed suites |
| `entity-properties` | detail | ContentNode/get ({{entityId}}) | — | Entity detail zone |
| `entity-content` | content-body | ContentNode/get ({{entityId}}) | — | Entity content zone |
| `entity-same-schema` | table | ContentNode/list (schemaFilter={{entityPrimarySchema}}) | — | Related entities |
| `entity-all-content` | table | ContentNode/list | schemas (toggle) | Full entity list |
| `process-catalog` | card-grid | AutomationRule/list | enabled (toggle) | Process cards |
| `automations-rules-list` | table | AutomationRule/list | — | Rules table |
| `version-spaces-list` | card-grid | ContentNode/list (schemaFilter=VersionSpace) | — | Version spaces |
| `backlinks` | table | ContentNode/list | contextual (target=entity) | Hidden when no context |
| `similar-entities` | card-grid | ContentNode/list | contextual (embedding) | Hidden when no context |
| `unlinked-references` | table | ContentNode/list | contextual (mentions) | Hidden when no context |
| `graph-neighbors` | graph | ContentNode/list | contextual (neighbor) | Hidden when no context |
| `step-checks` | table | CheckVerification/list ({{stepRef}}) | status, mode (toggle) | Check results |

### 13.2 Process Views (View.process.seeds.yaml — 7 views)

| View ID | Layout | Data Source |
|---------|--------|-------------|
| `process-specs-list` | table | ProcessSpec/list |
| `process-runs-list` | table | ProcessRun/list |
| `step-runs-list` | table | StepRun/list ({{runId}}) |
| `process-dashboard-stats` | stat-cards | ProcessRun/stats |
| `run-dashboard` | stat-cards | ProcessRun/stats |
| `process-specs-cards` | card-grid | ProcessSpec/list |

### 13.3 Layout Seeds (Layout.seeds.yaml — 12 layouts)

| Layout ID | Kind | Children |
|-----------|------|----------|
| `dashboard` | stack | dashboard-stats + dashboard-concepts + content-list |
| `score` | stack | concept-graph + score-schemas |
| `syncs` | stack | syncs-list |
| `concept-browser` | stack | installed-suites + concept-graph |
| `entity-detail` | stack | entity-properties + entity-content + entity-same-schema + backlinks + similar-entities + unlinked-references + graph-neighbors |
| `multiverse` | stack | version-spaces-list |
| `triple-zone-default` | stack | Three areas: fields, content, related |
| `flat-default` | stack | Single structured area |
| `two-column-sidebar` | grid | Main + content + sidebar |
| `step-full-layout` | stack | header + lifecycle + input + output + error areas |
| `process-spec-page` | stack | header + step-graph + definitions + runs |
| `process-run-page` | stack | step-runs-list |

---

## 14. Relationship Diagram

```
                    LayoutRenderer
                    (spatial composition)
                         |
                    renders N children
                         |
                    ViewRenderer ────────────────────── inlineData path
                    (query + filter + display)           (bypass fetch)
                         |
               ┌─────────┼──────────┐
               |         |          |
          View/get   Concept/action  Schema/listMemberships
          (config)   (data fetch)    (ContentNode enrichment)
               |         |          |
               └─────────┼──────────┘
                         |
                    Filter Pipeline
                    (schemaFilter → contextual → interactive)
                         |
                    Display Type Component
                    (table, card-grid, graph, ...)
                         |
              ┌──────────┴──────────┐
              |                     |
         Holistic               Per-Item
         (graph, stat-cards,    (table, card-grid, board)
          detail, ...)               |
                              DisplayModeRenderer
                              (Schema:mode_id resolution)
                                     |
                           ┌─────────┼──────────┐
                           |         |          |
                     ComponentMapping  Layout   FlatFields
                     (widget slots)    (spatial) (vertical)
                           |
                     Slot → Source resolution
                     (entity_field, static_value, entity_reference_display)
```

---

## 15. Creating a New View

To add a new view, add an entry to `View.seeds.yaml` (or a domain-specific
seed file). The minimum required fields are:

```yaml
- view: my-new-view
  dataSource: '{"concept":"MyConcept","action":"list"}'
  layout: table
  visibleFields: '[{"key":"id","label":"ID"},{"key":"name","label":"Name"}]'
  controls: '{}'
  title: My View
  description: Description of what this view shows.
  defaultDisplayMode: table-row
```

Then ensure:
1. The concept and action exist in the kernel
2. A `DisplayMode` entry exists for the schema + mode_id pair (or set `useDisplayMode: 'false'`)
3. A `ComponentMapping` wires the display mode to widget slots (or the fallback renders fields directly)
4. If this view should appear in a page, add it to a `Layout` entry's children array
