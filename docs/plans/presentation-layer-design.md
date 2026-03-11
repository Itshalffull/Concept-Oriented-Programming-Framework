# Clef Base — Presentation Layer Design

**Version 0.1.0 — 2026-03-11**
**Clef framework dependency:** Clef v0.18.0, Concept Library v0.4.0, Clef Surface v0.4.0
**Scope:** DisplayMode, FieldPlacement, Layout integration, View contextual filters
**Status:** Architecture specification — supersedes inline DisplayMode references in Clef Base v0.33.0

---

## 1. Problem statement

Clef Base v0.33.0 references DisplayMode approximately 40 times across the specification. It appears in the Presentation suite listing, in rendering pipeline descriptions, in sync examples, in implementation checklists, and in every discussion of how entities are displayed. But no formal `.concept` specification exists for it. There is no state declaration, no action list, no invariant, no purpose block.

The references that do exist are inconsistent with each other. DisplayMode is simultaneously described as:

- A per-field formatter/visibility config (§2.1.5, §2.4)
- A layout structure for entity pages (implementation item 12: "Create DisplayMode entity 'entity-page'")
- A container for responsive breakpoint rules (§3.4.3)
- A block-level view mode switcher (§3.2: "View modes are DisplayMode config entities applied at the block level")
- A role-based field visibility mechanism (§12)
- The second half of a `(Schema, DisplayMode)` rendering selector (§3.1.3)

These are at least four distinct responsibilities collapsed into one unnamed concept. This document defines the presentation layer as a clean set of concepts with formal specs, clear ownership boundaries, and explicit wiring.

---

## 2. Design goals

1. **One admin entry point.** When an admin says "configure how Article looks in full-page mode," they open one screen — the DisplayMode config for `(Article, full)`. Everything reachable from there: the layout structure, the field placements, the embedded Views, the responsive rules. The concept decomposition is invisible to the admin unless they want to reuse pieces independently.

2. **The same field in multiple places.** An Article's title can appear as an h1 in the hero area, as plain text in the sidebar, and as a cell in a View row — each with independent formatter configuration. No field is limited to one appearance per mode.

3. **Views inside display modes.** A DisplayMode can contain Views with contextual filters — "show backlinks for this entity," "show related items by the same author." The View doesn't know what entity it will filter by until render time. The rendering context provides the entity.

4. **The triple-zone entity page is config, not code.** The standard Clef Base entity page (structured fields, block editor, related zone) is a Layout config entity — a default template. Admins can replace it, extend it, or use a completely different layout for any Schema+mode combination.

5. **Progressive customization.** Zero config gets a working display (WidgetResolver auto-renders every field). Adding a DisplayMode customizes field order and formatters. Adding a Layout adds spatial structure. Adding ComponentMappings adds fully custom widget wiring. Each layer is optional and additive.

---

## 3. Concept inventory and ownership

The presentation layer consists of five concepts. Two are new (DisplayMode, FieldPlacement). One is extended (View gains contextual filters). Two are unchanged but clarified in their relationship to DisplayMode (Component/Layout, ComponentMapping).

| Concept | Suite | Location | New / Extended / Unchanged | Core responsibility |
|---------|-------|----------|---------------------------|-------------------|
| DisplayMode | Presentation | **Repertoire** | New formal spec (existed informally) | Named rendering configuration for a Schema+mode pair |
| FieldPlacement | Presentation | **Repertoire** | New | One field's display config in one rendering context |
| View | Query/Retrieval | **Repertoire** | Extended — gains contextual filter source type | Queryable content lists with static, exposed, and contextual filters |
| Component (Layout) | Layout | **Repertoire** | Unchanged — relationship to DisplayMode clarified | Spatial arrangement of areas with responsive rules |
| ComponentMapping | Presentation | **Repertoire** | Unchanged | Admin-configured data-to-widget slot bindings |

### 3.1 Repertoire vs Clef Base — what goes where

The guiding principle: **Repertoire concepts are general-purpose and portable — they work in any Clef application, not just Clef Base.** A calendar app, a game, a CLI tool built on Clef can use DisplayMode to configure how its entities render. Clef Base is the specific application platform that wires these Repertoire concepts to its ContentNode model, ships default config entities, and provides the admin UI.

**Repertoire (general-purpose library, usable in any Clef app):**

| Artifact | Type | Why Repertoire |
|----------|------|---------------|
| `DisplayMode.concept` | Concept spec | Keyed by `(Schema, mode_id)` — references Schema, Layout, FieldPlacement, ComponentMapping. None of these are ContentNode-specific. Any Clef app with Schemas has display modes. |
| `FieldPlacement.concept` | Concept spec | Stores field + formatter config. References Schema-qualified field names. No dependency on ContentNode or the shared pool. |
| View contextual filter extension | Concept extension | View is already Repertoire. Contextual filters are a general-purpose filter source — "bind this filter from the rendering context" is useful anywhere a View is embedded, not just in Clef Base entity pages. |
| `DisplayModeResolveStrategy.sync` | Sync | Wires Renderer to DisplayMode. Both are Repertoire concepts. |
| `DisplayModeUsesLayout.sync` | Sync | Wires DisplayMode to Component/Layout. Both are Repertoire concepts. |
| `DisplayModeUsesMapping.sync` | Sync | Wires DisplayMode to ComponentMapping. Both are Repertoire concepts. |
| `ViewResolvesContextualFilters.sync` | Sync | Wires View's contextual filters to the rendering context. General-purpose. |
| `AreaRendersFieldPlacement.sync` | Sync | Wires Component/Layout areas to FieldPlacement rendering. General-purpose. |
| `FieldPlacementUsesMapping.sync` | Sync | Wires FieldPlacement to ComponentMapping delegation. General-purpose. |
| `display-as-picker.widget` | Widget spec (Surface) | A general-purpose picker that reads from DisplayMode and Schema. Any app can use it. |

**Clef Base (application platform, depends on ContentNode model):**

| Artifact | Type | Why Clef Base |
|----------|------|--------------|
| Layout entity "triple-zone-default" | Config entity | The three-area layout (structured fields, block editor, related zone) is a Clef Base convention. The block editor zone assumes ContentNode children in an Outline tree. The related zone assumes the Clef Base linking and embedding model. A calendar app wouldn't ship this. |
| Layout entity "flat-default" | Config entity | A sensible default, but one that reflects Clef Base's auto-generation conventions. |
| Layout entity "two-column-sidebar" | Config entity | Same — a Clef Base default template. |
| Related-zone Views (backlinks, similar, unlinked refs, graph neighbors) | Config entities | These Views have contextual filters bound to `context.entity` and query Backlink, SemanticEmbedding, and Graph — all wired to Clef Base's ContentNode pool. |
| Auto-generation logic in ConceptBrowser install step 4 | Sync / orchestration | "When a Schema is installed, create three DisplayMode configs, generate FieldPlacements from the Schema's fields, reference the triple-zone Layout" — this is Clef Base's opinionated install workflow. The Repertoire concepts don't know about auto-generation. |
| `schema.yaml` for DisplayMode | Deployment artifact | Maps DisplayMode state to ContentNode Properties in the shared pool. This is the Clef Base integration layer — it makes DisplayMode instances into ContentNodes so they participate in the admin UI, ConfigSync export, and the shared query system. Without `schema.yaml`, DisplayMode still works (sovereign storage), it just isn't a ContentNode. |
| `schema.yaml` for FieldPlacement | Deployment artifact | Same — Clef Base integration for FieldPlacement as a ContentNode. |
| Admin UI screens (DisplayMode management, FieldPlacement config panel, Layout area editor) | UI config | The admin experience is a Clef Base concern. It's built from Clef Base's own composition primitives (Views, ComponentMappings, Layouts) and assumes the ContentNode admin shell. |
| `display-as-picker` placement in entity page header, embed toolbar, etc. | UI integration | Where the picker widget appears is a Clef Base layout decision. The widget itself is Repertoire; its placement in the triple-zone header, embed block toolbar, and Canvas context menu is Clef Base wiring. |

### 3.2 The boundary in practice

A developer building a Clef app that is **not** Clef Base — say, a project management tool — can use all the Repertoire pieces directly:

- Define Schemas for Task, Sprint, Board
- Create DisplayMode configs: `(Task, "card")`, `(Task, "row")`, `(Sprint, "overview")`
- Create FieldPlacements for each mode
- Create Layouts for how screens are arranged
- Use Views with contextual filters to show "tasks in this sprint"
- Drop `display-as-picker` into the UI

They get the full presentation layer without ContentNode, without the shared pool, without ConceptBrowser auto-generation, and without the triple-zone convention. Their app's storage, install workflow, and default layouts are their own concern.

Clef Base is the opinionated layer on top that says: "Everything is a ContentNode. Schemas install with sensible defaults. The entity page has three zones. The admin UI is built from the same primitives users build with." That opinion lives in Clef Base's config entities, `schema.yaml` files, and orchestration syncs — not in the Repertoire concepts themselves.

---

## 4. DisplayMode concept

### 4.1 Purpose

DisplayMode is the named, admin-configured rendering specification for entities of a given Schema. It answers the question: "When someone asks to view an Article in teaser mode, what do they see?" Every rendering context in the system — View rows, embed blocks, entity pages, Canvas items, Reference fields — selects a `(Schema, mode_id)` pair. DisplayMode resolves that pair to a concrete rendering strategy.

### 4.2 Concept spec

```
@version(1)
concept DisplayMode [D] {

  purpose {
    Named rendering configuration for entities of a given Schema.
    Each instance specifies how to display entities when a rendering
    context requests a particular (schema, mode_id) pair. The display
    strategy is one of: a Layout with FieldPlacements and embedded
    Views, a ComponentMapping for full widget takeover, or a flat
    ordered list of FieldPlacements rendered sequentially.
  }

  state {
    modes: set D
    name: D -> String                    // human-readable label ("Full Page", "Teaser Card")
    mode_id: D -> String                 // machine name ("full", "teaser", "card")
    schema: D -> String                  // which Schema this mode applies to ("Article")

    strategy {
      // Exactly one of these three should be set. If none are set,
      // the mode uses the flat_fields list with WidgetResolver defaults.
      layout: D -> option String         // Layout entity ID — spatial areas with placements
      component_mapping: D -> option String  // ComponentMapping ID — full widget takeover
    }

    // Flat field list — used when no layout and no component_mapping.
    // Also used as the "default field config" that Layout areas inherit
    // from when they don't override a field's config.
    flat_fields {
      placements: D -> list String       // ordered list of FieldPlacement IDs
    }

    // Mode-level settings
    config {
      role_visibility: D -> option String   // role-based visibility rules for the entire mode
      cacheable: D -> option Bool           // whether rendered output can be cached
    }
  }

  actions {
    action create(schema: String, mode_id: String, name: String) {
      -> ok(mode: D) {
        Creates a new display mode for the given Schema. Auto-generates
        a default FieldPlacement for every field on the Schema, ordered
        by field weight. The flat_fields list is populated with these
        default placements. No layout or component_mapping is set —
        the mode starts in flat-field-list mode.
      }
      -> already_exists(schema: String, mode_id: String) {
        A mode with this (schema, mode_id) pair already exists.
      }
    }

    action resolve(schema: String, mode_id: String) {
      -> ok(mode: D) {
        Returns the DisplayMode for the given (schema, mode_id) pair.
        This is the primary lookup action — every rendering context
        calls this to get the display configuration.
      }
      -> not_found(schema: String, mode_id: String) {
        No mode configured. Caller should fall back to WidgetResolver
        automatic rendering with no display customization.
      }
    }

    action set_layout(mode: D, layout: String) {
      -> ok(mode: D) {
        Assigns a Layout entity to this mode. Rendering will use the
        Layout's spatial areas. Clears component_mapping if set.
      }
      -> not_found(mode: D) {
        The mode does not exist.
      }
    }

    action clear_layout(mode: D) {
      -> ok(mode: D) {
        Removes the Layout assignment. Rendering falls back to the
        flat_fields list or WidgetResolver defaults.
      }
    }

    action set_component_mapping(mode: D, mapping: String) {
      -> ok(mode: D) {
        Assigns a ComponentMapping for full widget takeover. Rendering
        delegates entirely to this mapping. Clears layout if set.
      }
    }

    action clear_component_mapping(mode: D) {
      -> ok(mode: D) {
        Removes the ComponentMapping assignment.
      }
    }

    action set_flat_fields(mode: D, placements: list String) {
      -> ok(mode: D) {
        Sets the ordered list of FieldPlacement IDs for flat rendering.
        Used when no layout is assigned, or as the default field config
        that Layout areas can inherit from.
      }
    }

    action get(mode: D) {
      -> ok(mode: D, name: String, mode_id: String, schema: String,
            layout: option String, component_mapping: option String,
            placements: list String) {
        Returns the full configuration of a display mode.
      }
      -> not_found(mode: D) {
        The mode does not exist.
      }
    }

    action delete(mode: D) {
      -> ok() {
        Removes the display mode. All FieldPlacements owned by this
        mode are orphaned and garbage-collected.
      }
      -> not_found(mode: D) {
        The mode does not exist.
      }
    }

    action list_for_schema(schema: String) {
      -> ok(modes: list D) {
        Returns all display modes configured for a Schema. This is
        what powers the "Display as" picker — the picker shows the
        available mode_ids for each of the entity's applied Schemas.
      }
    }
  }

  invariant {
    after create(schema: "Article", mode_id: "full", name: "Full Page")
          -> ok(mode: m)
    then resolve(schema: "Article", mode_id: "full")
         -> ok(mode: m)
  }

  invariant {
    after create(schema: "Article", mode_id: "teaser", name: "Teaser Card")
          -> ok(mode: m)
    then list_for_schema(schema: "Article")
         -> ok(modes: ms)
    and  ms includes m
  }

  invariant {
    after create(schema: "Article", mode_id: "full", name: "Full Page")
          -> ok(mode: m)
    and   set_layout(mode: m, layout: "triple-zone-default")
          -> ok(mode: m)
    then  get(mode: m) -> ok(layout: "triple-zone-default",
                             component_mapping: null)
  }

  invariant {
    after create(schema: "Article", mode_id: "full", name: "Full Page")
          -> ok(mode: m)
    and   set_component_mapping(mode: m, mapping: "article-hero-card")
          -> ok(mode: m)
    then  get(mode: m) -> ok(component_mapping: "article-hero-card",
                             layout: null)
  }
}
```

### 4.3 Resolution priority

When Renderer encounters a `(schema, mode_id, entity)` triple, the resolution order is:

1. **Resolve the DisplayMode.** Call `DisplayMode/resolve(schema, mode_id)`. If not found, fall through to WidgetResolver automatic rendering — every field on the Schema rendered in default order with default formatters. No customization.

2. **Check component_mapping.** If the DisplayMode has a `component_mapping` set, delegate entirely to `ComponentMapping/render`. The ComponentMapping's SlotSources pull whatever data they need from the entity. This is the "full widget takeover" path — one widget renders the entire entity.

3. **Check layout.** If the DisplayMode has a `layout` set, delegate to `Component/renderLayout`. The Layout iterates its areas. Each area is either structured (containing FieldPlacements, View references, and ComponentMapping references) or unstructured (rendering the block editor). This is the spatial composition path.

4. **Fall back to flat_fields.** If neither component_mapping nor layout is set, render the DisplayMode's `flat_fields` list — an ordered sequence of FieldPlacements, each rendered independently through its configured formatter. This is the simplest customization: field order and formatters, no spatial structure.

5. **Empty flat_fields.** If the flat_fields list is also empty (a newly created mode where defaults were cleared), fall through to WidgetResolver automatic rendering.

### 4.4 Auto-generation on Schema install

*Note: This section describes Clef Base behavior, not Repertoire behavior. The DisplayMode concept itself is a general-purpose Repertoire concept with no awareness of auto-generation. The auto-generation logic lives in Clef Base's ConceptBrowser install workflow (Track B3 in §13).*

When a new Schema is installed via ConceptBrowser (or created through the admin UI), the following DisplayMode configs are auto-generated:

- **"default"** — References the triple-zone default Layout. Area 1 gets FieldPlacements for all fields with default formatters. Area 2 is unstructured (block editor). Area 3 contains the standard related-zone Views with contextual filters.
- **"full"** — Same as "default" initially. Exists as a separate mode so admins can customize the entity page display independently from the default.
- **"teaser"** — No layout. Flat field list with title, summary (if present), and thumbnail (if present). Three FieldPlacements with compact formatters.

These defaults give every Schema a working entity page, a working teaser display, and a customizable full display — all from auto-generated config.

---

## 5. FieldPlacement concept

### 5.1 Purpose

FieldPlacement represents one field's display configuration in one rendering context. It is the unit that gets placed into Layout areas or into DisplayMode flat field lists. The same Schema field can have multiple FieldPlacements with different formatters, labels, and visibility rules — enabling the same field to appear multiple times on the same page with different presentations.

### 5.2 Concept spec

```
@version(1)
concept FieldPlacement [P] {

  purpose {
    One field's display configuration in one rendering context.
    Stores which field to render, how to format it, label
    overrides, visibility rules, and optional ComponentMapping
    delegation for custom field-level rendering. Multiple
    FieldPlacements can reference the same source field with
    different configurations.
  }

  state {
    placements: set P
    source_field: P -> String            // Schema-qualified field name ("Article.title")
    formatter: P -> String               // formatter type ("heading", "plain_text", "date_relative", etc.)
    formatter_options: P -> option String // JSON-encoded formatter config (heading level, date format, etc.)

    label {
      label_display: P -> String         // "above" | "inline" | "hidden" | "visually_hidden"
      label_override: P -> option String // custom label text (null = use field's default label)
    }

    visibility {
      visible: P -> Bool                 // master visibility toggle
      role_visibility: P -> option String  // role-based visibility rules (null = visible to all)
    }

    // Optional delegation to ComponentMapping for custom field rendering.
    // When set, the field's value is passed as context to the mapping's
    // SlotSources, and the mapping's widget wraps the field's display.
    field_mapping: P -> option String    // ComponentMapping ID
  }

  actions {
    action create(source_field: String, formatter: String) {
      -> ok(placement: P) {
        Creates a new field placement with the given field and formatter.
        Defaults: label_display "above", visible true, no label override,
        no role restrictions, no field_mapping.
      }
    }

    action configure(placement: P, formatter: option String,
                     formatter_options: option String,
                     label_display: option String,
                     label_override: option String) {
      -> ok(placement: P) {
        Updates the placement's display configuration. Only non-null
        parameters are applied (partial update).
      }
      -> not_found(placement: P) {
        The placement does not exist.
      }
    }

    action set_visibility(placement: P, visible: Bool,
                          role_visibility: option String) {
      -> ok(placement: P) {
        Updates visibility settings.
      }
    }

    action set_field_mapping(placement: P, mapping: String) {
      -> ok(placement: P) {
        Assigns a ComponentMapping for custom field-level rendering.
        The field's value is passed as context to the mapping.
      }
    }

    action clear_field_mapping(placement: P) {
      -> ok(placement: P) {
        Removes ComponentMapping delegation. Field renders through
        its formatter directly.
      }
    }

    action get(placement: P) {
      -> ok(placement: P, source_field: String, formatter: String,
            formatter_options: option String, label_display: String,
            label_override: option String, visible: Bool,
            field_mapping: option String) {
        Returns the full placement configuration.
      }
      -> not_found(placement: P) {
        The placement does not exist.
      }
    }

    action delete(placement: P) {
      -> ok() {
        Removes the placement. Consumers referencing this placement
        (DisplayMode flat_fields, Layout areas) must handle the
        missing reference gracefully — skip the field in rendering.
      }
    }

    action duplicate(placement: P) {
      -> ok(new_placement: P) {
        Creates a copy of the placement with the same configuration.
        Used when placing the same field in a second location — the
        admin duplicates the placement and then customizes the copy's
        formatter independently.
      }
    }
  }

  invariant {
    after create(source_field: "Article.title", formatter: "heading")
          -> ok(placement: p)
    and   configure(placement: p, formatter_options: "{\"level\": 1}")
          -> ok(placement: p)
    then  get(placement: p) -> ok(source_field: "Article.title",
                                  formatter: "heading",
                                  formatter_options: "{\"level\": 1}")
  }

  invariant {
    after create(source_field: "Article.title", formatter: "heading")
          -> ok(placement: p)
    and   duplicate(placement: p) -> ok(new_placement: p2)
    then  get(placement: p2) -> ok(source_field: "Article.title",
                                   formatter: "heading")
  }
}
```

### 5.3 Relationship to DisplayMode and Layout

FieldPlacements are referenced by ID from two places:

- **DisplayMode.flat_fields** — an ordered list of FieldPlacement IDs for the no-layout rendering path.
- **Layout area content** — a Layout area that is structured can contain an ordered list of FieldPlacement IDs (and View references, and ComponentMapping references). This is the spatial rendering path.

FieldPlacement itself has no knowledge of where it is placed. It does not reference a DisplayMode or a Layout area. It is a standalone config entity that describes "show field X with formatter Y." This independence is what allows the same FieldPlacement to be referenced from multiple places (though in practice, each placement instance is usually unique to its context, created via `duplicate` when the admin wants the same field in two areas with different config).

### 5.4 Formatter resolution

When Renderer encounters a FieldPlacement, the resolution order is:

1. **Check field_mapping.** If the placement has a `field_mapping` (ComponentMapping ID), delegate to `ComponentMapping/render` with the field's value as context. The ComponentMapping's widget wraps the field display.

2. **Use formatter.** Renderer passes the formatter type and options to Surface's WidgetResolver pipeline. WidgetResolver finds the appropriate widget for the formatter type on the current platform. For example, formatter "heading" with options `{"level": 1}` resolves to an `<h1>` on web, a large bold `Text` on mobile, etc.

3. **Fall back.** If the formatter type is not recognized by WidgetResolver, fall back to WidgetResolver's automatic resolution based on the field's data type (same path as if no FieldPlacement existed).

---

## 6. View contextual filters

### 6.1 Problem

Views embedded in a DisplayMode's Layout need to filter dynamically based on the entity being displayed. The "Backlinks" View in the related zone must show backlinks *to the current entity*. The "Comments" View must show comments *on the current entity*. A "Same Author" View must filter by the current entity's author field.

Static filters can't do this — the entity isn't known until render time. Exposed filters require user interaction. A third filter source type is needed: **contextual**, where the filter value comes from the rendering context.

### 6.2 Filter source types

View's filter system gains a `source` discriminator on each filter. Every filter specifies where its value comes from:

| Source | Value determined | Example |
|--------|-----------------|---------|
| **static** | At config time by the admin | `status = "published"` |
| **exposed** | At view time by the user (via ExposedFilter widget) | `tag = ___` (user picks) |
| **contextual** | At render time from the rendering context | `Backlink.target = {{context.entity}}` |

### 6.3 Contextual filter spec

A contextual filter declares what it needs from the rendering context using a binding expression. The binding expression references a path into the context object that Renderer passes when rendering a View inside a Layout area.

```
// Extension to View concept state — new filter_source field on each filter

state {
  // ... existing View filter state ...

  filter_source {
    source_type: F -> String          // "static" | "exposed" | "contextual"
    context_binding: F -> option String  // binding expression, only for contextual
    // e.g. "context.entity" — the whole entity ID
    // e.g. "context.entity.author" — a specific field value
    // e.g. "context.schema" — the active Schema name
    // e.g. "context.mode_id" — the active DisplayMode mode_id
    fallback_behavior: F -> option String  // "hide" | "show_empty" | "ignore_filter"
    // What to do if the context doesn't provide the bound value.
    // "hide" — don't render the View at all
    // "show_empty" — render the View with an empty result set
    // "ignore_filter" — run the View without this filter (show all)
  }
}
```

New actions on View:

```
action add_contextual_filter(view: V, field: String,
                             operator: String,
                             context_binding: String,
                             fallback_behavior: String) {
  -> ok(filter: F) {
    Adds a filter whose value is bound from the rendering context.
    The operator ("equals", "contains", "in", "references") determines
    how the bound value is compared to the field's values in results.
  }
  -> invalid_binding(binding: String) {
    The binding expression doesn't match a known context path.
  }
}
```

### 6.4 Context object

When Renderer renders a View inside a Layout area (or any other context that provides an entity), it passes a context object:

```
context: {
  entity: String            // ContentNode ID of the entity being displayed
  schema: String            // the active Schema in this rendering context
  mode_id: String           // the DisplayMode mode_id
  fields: {                 // resolved field values from the entity
    "Article.title": "...",
    "Article.author": "user-123",
    "Article.tags": ["tag-1", "tag-2"],
    ...
  }
}
```

The contextual filter's `context_binding` is a dot-path into this object. `context.entity` gets the entity ID. `context.fields.Article.author` gets the author field value. The View's query engine resolves the binding before executing the query.

### 6.5 Fallback behavior

When a View with contextual filters is rendered outside a context that provides the bound value — for example, a View with `context.entity` is placed on a standalone page with no entity — the `fallback_behavior` determines what happens:

- **"hide"** — The View is not rendered at all. The Layout area skips it. This is the safe default.
- **"show_empty"** — The View renders its chrome (header, empty state message) but with no results.
- **"ignore_filter"** — The contextual filter is dropped and the View runs with only its static and exposed filters. This is useful for Views that should show "all backlinks" when not in an entity context but "backlinks to this entity" when they are.

### 6.6 Examples

**Backlinks View (used in triple-zone related zone):**

```yaml
view: "backlinks"
filters:
  - field: "Backlink.target"
    operator: "equals"
    source_type: "contextual"
    context_binding: "context.entity"
    fallback_behavior: "hide"
  - field: "Backlink.source.status"
    operator: "equals"
    source_type: "static"
    value: "published"
```

**Comments View (used in entity page):**

```yaml
view: "entity-comments"
filters:
  - field: "Comment.thread_root"
    operator: "equals"
    source_type: "contextual"
    context_binding: "context.entity"
    fallback_behavior: "hide"
sort:
  - field: "Comment.created_at"
    direction: "desc"
```

**Same-Author Articles View (custom, admin-created):**

```yaml
view: "same-author-articles"
filters:
  - field: "Article.author"
    operator: "equals"
    source_type: "contextual"
    context_binding: "context.fields.Article.author"
    fallback_behavior: "hide"
  - field: "ContentNode.id"
    operator: "not_equals"
    source_type: "contextual"
    context_binding: "context.entity"
    fallback_behavior: "ignore_filter"
  - field: "Article.status"
    operator: "equals"
    source_type: "static"
    value: "published"
layout_type: "card-grid"
row_display_mode: "teaser"
```

**Semantic Similarity View (used in triple-zone related zone):**

```yaml
view: "similar-entities"
filters:
  - field: "SemanticEmbedding.similar_to"
    operator: "embedding_similarity"
    source_type: "contextual"
    context_binding: "context.entity"
    fallback_behavior: "hide"
  - field: "SemanticEmbedding.score"
    operator: "greater_than"
    source_type: "static"
    value: 0.7
sort:
  - field: "SemanticEmbedding.score"
    direction: "desc"
limit: 10
```

---

## 7. Layout integration

### 7.1 Relationship to Component concept

The Component concept (Layout suite) already handles spatial arrangement of areas. This document does not redefine it. The key clarification is what Layout areas can contain and how they interact with DisplayMode.

A Layout is a spatial arrangement of **areas**. Each area has:

- **content_mode** — `structured` or `unstructured`
- **content_refs** — an ordered list of references to content items (FieldPlacements, Views, ComponentMappings)
- **responsive_rules** — per-breakpoint behavior (visible, hidden, stacked, reordered)

### 7.2 Area content types

A structured area's `content_refs` list can contain references to three kinds of entities, distinguished by a type discriminator:

| Type | Entity referenced | What renders |
|------|------------------|-------------|
| `field_placement` | FieldPlacement ID | A single field with its configured formatter |
| `view_embed` | View ID | A View's results, with contextual filters resolved from the rendering context |
| `component_mapping` | ComponentMapping ID | A custom widget with data wired into slots |

An unstructured area has no `content_refs`. It renders the entity's Outline tree of child blocks (the block editor). Only one unstructured area per Layout is typical, though multiple are allowed (each would render a different subtree or the same tree with different block view modes).

### 7.3 Default Layouts shipped with Clef Base

**"triple-zone-default"** — The standard entity page layout.

```yaml
layout: "triple-zone-default"
areas:
  - id: "fields"
    content_mode: "structured"
    content_refs: []           # populated by auto-generated FieldPlacements per Schema
    responsive:
      mobile: "visible"
      tablet: "visible"
      desktop: "visible"

  - id: "content"
    content_mode: "unstructured"
    responsive:
      mobile: "visible"
      tablet: "visible"
      desktop: "visible"

  - id: "related"
    content_mode: "structured"
    content_refs:
      - type: "view_embed"
        view: "backlinks"           # View with contextual filter on context.entity
      - type: "view_embed"
        view: "similar-entities"    # View with contextual filter on context.entity
      - type: "view_embed"
        view: "unlinked-references" # View with contextual filter on context.entity
      - type: "view_embed"
        view: "graph-neighbors"     # View with contextual filter on context.entity
    responsive:
      mobile: "stacked"
      tablet: "visible"
      desktop: "visible"
```

**"flat-default"** — A single structured area, no blocks, no related zone. Used for teaser, card, and compact modes when a Layout is desired but spatial complexity is not.

```yaml
layout: "flat-default"
areas:
  - id: "fields"
    content_mode: "structured"
    content_refs: []
    responsive:
      mobile: "visible"
      desktop: "visible"
```

**"two-column-sidebar"** — Main content with a structured sidebar. Alternative to triple-zone for entity pages where the related zone should be a side panel.

```yaml
layout: "two-column-sidebar"
areas:
  - id: "main"
    content_mode: "structured"
    content_refs: []
    responsive:
      mobile: "visible"
      tablet: "visible"
      desktop: "visible"

  - id: "content"
    content_mode: "unstructured"
    responsive:
      mobile: "visible"
      tablet: "visible"
      desktop: "visible"

  - id: "sidebar"
    content_mode: "structured"
    content_refs: []
    responsive:
      mobile: "stacked"       # sidebar stacks below main on mobile
      tablet: "stacked"
      desktop: "visible"      # sidebar beside main on desktop
```

### 7.4 Responsive rules ownership

Responsive rules live on the Layout's areas, not on DisplayMode. They describe spatial adaptation: which areas are visible at which breakpoints, how areas reorder when stacked, whether areas collapse into tabs on small screens. This is a Component/Layout concern.

DisplayMode does not own responsive rules. The v0.33.0 spec's statement that responsive rules are "DisplayMode properties" (§3.4.3) is corrected: they are Layout area properties. DisplayMode references a Layout; the Layout owns the responsive behavior.

---

## 8. Rendering pipeline

### 8.1 Full resolution chain

```
1. Rendering context provides (schema, mode_id, entity)
   │
2. DisplayMode/resolve(schema, mode_id)
   │
   ├─ not_found → WidgetResolver automatic (render all fields, default formatters)
   │
   └─ ok(mode) →
       │
       ├─ mode.component_mapping is set
       │   └─ ComponentMapping/render(mapping, context: {entity, schema})
       │      → full widget takeover, done
       │
       ├─ mode.layout is set
       │   └─ Component/renderLayout(layout, context: {entity, schema, mode_id, fields})
       │      │
       │      ├─ For each structured area:
       │      │   ├─ For each content_ref type "field_placement":
       │      │   │   └─ FieldPlacement/get → Renderer/renderField(field, formatter, options)
       │      │   │      → Surface/WidgetResolver → platform widget
       │      │   │
       │      │   ├─ For each content_ref type "view_embed":
       │      │   │   └─ View/execute(view, context)
       │      │   │      → resolve contextual filters from context
       │      │   │      → query → results
       │      │   │      → render each row via row's (schema, display_mode) pair
       │      │   │
       │      │   └─ For each content_ref type "component_mapping":
       │      │       └─ ComponentMapping/render(mapping, context)
       │      │
       │      └─ For each unstructured area:
       │          └─ Outline/render(entity.children) → block editor
       │
       └─ neither set → render mode.flat_fields
           │
           └─ For each FieldPlacement ID in flat_fields:
               └─ FieldPlacement/get → Renderer/renderField → Surface → widget
```

### 8.2 Syncs

**DisplayMode resolution sync** — routes Renderer to the correct strategy:

```yaml
sync DisplayModeResolveStrategy [eager]
when {
  Renderer/render: [ schema: ?schema; display_mode: ?mode; entity: ?entity ]
}
where {
  DisplayMode: { ?dm schema: ?schema; mode_id: ?mode }
}
then {
  DisplayMode/get: [ mode: ?dm ]
}
```

**Layout delegation sync** — when DisplayMode has a layout, delegate to Component:

```yaml
sync DisplayModeUsesLayout [eager]
when {
  DisplayMode/get: [ mode: ?dm; layout: ?layout ]
    => [ ok ]
}
where {
  filter(?layout != null)
  Renderer/render: [ schema: ?schema; display_mode: ?mode; entity: ?entity ]
  DisplayMode: { ?dm schema: ?schema; mode_id: ?mode }
}
then {
  Component/renderLayout: [ layout: ?layout;
                            context: { entity: ?entity,
                                       schema: ?schema,
                                       mode_id: ?mode } ]
}
```

**ComponentMapping takeover sync** — when DisplayMode has a component_mapping, delegate:

```yaml
sync DisplayModeUsesMapping [eager]
when {
  Renderer/render: [ schema: ?schema; display_mode: ?mode; entity: ?entity ]
}
where {
  DisplayMode: { ?dm schema: ?schema; mode_id: ?mode;
                 component_mapping: ?mapping_id }
  filter(?mapping_id != null)
}
then {
  ComponentMapping/render: [ mapping: ?mapping_id;
                             context: { entity: ?entity, schema: ?schema } ]
}
```

**View contextual filter resolution sync** — when a View executes inside a rendering context, resolve contextual filters:

```yaml
sync ViewResolvesContextualFilters [eager]
when {
  View/execute: [ view: ?view; context: ?ctx ]
}
where {
  View: { ?view filters: ?filters }
  filter(?filters has_contextual_filters)
}
then {
  View/resolveContextualFilters: [ view: ?view;
                                   filters: ?filters;
                                   context: ?ctx ]
}
```

**FieldPlacement rendering sync** — when a Layout area renders a field placement:

```yaml
sync AreaRendersFieldPlacement [eager]
when {
  Component/renderAreaItem: [ item_type: "field_placement";
                              item_ref: ?placement_id;
                              context: ?ctx ]
}
where {
  FieldPlacement: { ?p; source_field: ?field;
                    formatter: ?fmt; formatter_options: ?opts;
                    visible: true }
  filter(?p == ?placement_id)
}
then {
  Renderer/renderField: [ field: ?field;
                          formatter: ?fmt;
                          formatter_options: ?opts;
                          context: ?ctx ]
}
```

**FieldPlacement with ComponentMapping delegation sync:**

```yaml
sync FieldPlacementUsesMapping [eager]
when {
  Component/renderAreaItem: [ item_type: "field_placement";
                              item_ref: ?placement_id;
                              context: ?ctx ]
}
where {
  FieldPlacement: { ?p; source_field: ?field;
                    field_mapping: ?mapping_id; visible: true }
  filter(?p == ?placement_id)
  filter(?mapping_id != null)
}
then {
  ComponentMapping/render: [ mapping: ?mapping_id;
                             context: { field: ?field, value: ?ctx[?field] } ]
}
```

---

## 9. The triple-zone entity page, fully traced

This section traces the complete rendering of an Article's entity page through the system, demonstrating how all concepts interact.

### 9.1 Setup (admin config, one-time)

Schema "Article" is installed. ConceptBrowser auto-generates:

1. **Three DisplayMode configs:**
   - `(Article, default)` — references Layout "triple-zone-default"
   - `(Article, full)` — references Layout "triple-zone-default"
   - `(Article, teaser)` — no layout, flat_fields only

2. **FieldPlacements for "Article, default" area "fields":**
   - Placement A: `Article.title`, formatter "heading", options `{"level": 1}`
   - Placement B: `Article.author`, formatter "entity_reference", options `{"display_mode": "compact"}`
   - Placement C: `Article.published_date`, formatter "date_relative"
   - Placement D: `Article.body_summary`, formatter "rich_text", options `{"truncate": 200}`
   - Placement E: `Article.tags`, formatter "tag_list"

3. **FieldPlacements for "Article, teaser" flat_fields:**
   - Placement F: `Article.title`, formatter "heading", options `{"level": 3}`
   - Placement G: `Article.body_summary`, formatter "plain_text", options `{"truncate": 100}`
   - Placement H: `Article.thumbnail`, formatter "image", options `{"size": "small"}`

4. **Related-zone Views** (shared across all Schemas, contextual filters):
   - "backlinks" View — contextual filter `Backlink.target = context.entity`
   - "similar-entities" View — contextual filter `SemanticEmbedding.similar_to = context.entity`
   - "unlinked-references" View — contextual filter `Backlink.getUnlinkedMentions.entity = context.entity`
   - "graph-neighbors" View — contextual filter `Graph.neighbors.entity = context.entity`

### 9.2 Render (every page view)

User navigates to Article "Design Patterns in Clef" (entity ID: `article-42`).

```
Step 1: Renderer receives (schema: "Article", mode_id: "default", entity: "article-42")

Step 2: DisplayMode/resolve("Article", "default") → ok(mode: dm-1)
        dm-1 has layout: "triple-zone-default", component_mapping: null

Step 3: Component/renderLayout("triple-zone-default", context: {
          entity: "article-42",
          schema: "Article",
          mode_id: "default",
          fields: { Article.title: "Design Patterns in Clef",
                    Article.author: "user-7",
                    Article.published_date: "2026-03-10",
                    Article.body_summary: "A look at how...",
                    Article.tags: ["architecture", "clef"] }
        })

Step 4: Layout iterates areas:

  Area "fields" (structured):
    content_refs:
      [A] FieldPlacement → Article.title as heading h1
          → WidgetResolver → <h1>Design Patterns in Clef</h1>
      [B] FieldPlacement → Article.author as entity_reference compact
          → WidgetResolver → <a href="/user/7">Trinley</a>
      [C] FieldPlacement → Article.published_date as date_relative
          → WidgetResolver → <time>yesterday</time>
      [D] FieldPlacement → Article.body_summary as rich_text truncated
          → WidgetResolver → <p>A look at how...</p>
      [E] FieldPlacement → Article.tags as tag_list
          → WidgetResolver → <div class="tags"><span>architecture</span>...</div>

  Area "content" (unstructured):
    → Outline/render(children of article-42)
    → Block editor with prose, [[links]], ((embeds)), slash commands

  Area "related" (structured):
    content_refs:
      [backlinks View] → View/execute with context
          → resolves contextual filter: Backlink.target = "article-42"
          → query → 5 results
          → renders each through its row display mode
      [similar-entities View] → View/execute with context
          → resolves contextual filter: similar_to = "article-42"
          → query → 3 results
          → renders each through "similarity-card" ComponentMapping
      [unlinked-references View] → View/execute with context
          → resolves contextual filter: entity = "article-42"
          → query → 2 results
          → renders each through "mention-card" ComponentMapping
      [graph-neighbors View] → View/execute with context
          → resolves contextual filter: entity = "article-42"
          → query → 4 results

Step 5: Responsive rules applied:
  Desktop: all three areas visible, vertical stack
  Mobile: related area stacks below content, fonts scale down
```

### 9.3 Admin customization example

An admin wants the Article full page to have a hero banner area above the fields, showing the title overlaid on the featured image. They also want to show a "More by this author" section in the related zone.

```
1. Admin opens DisplayMode "Article / full"

2. Admin changes the layout from "triple-zone-default" to a custom layout
   they create: "article-hero-layout" with four areas:
   - "hero" (structured)
   - "fields" (structured)
   - "content" (unstructured)
   - "related" (structured)

3. Admin creates a ComponentMapping "article-hero-banner":
   - Widget: "hero-banner"
   - Slot "background_image" ← SlotSource entity_field("Article.featured_image")
   - Slot "title" ← SlotSource entity_field("Article.title")
   - Slot "subtitle" ← SlotSource entity_field("Article.published_date")

4. Admin places in area "hero":
   - content_ref: type "component_mapping", ref: "article-hero-banner"

5. Admin places in area "fields":
   - FieldPlacement: Article.author as "entity_reference"
   - FieldPlacement: Article.tags as "tag_list"
   (title is in the hero now, not here)

6. Area "content": unstructured (no changes)

7. Admin adds to area "related":
   - All existing related-zone Views (backlinks, similar, etc.)
   - New View "more-by-author" with contextual filter:
     Article.author = context.fields.Article.author
     AND ContentNode.id != context.entity
     AND Article.status = "published"

8. Admin saves. Article full pages now render with the hero layout.
   Teaser mode is unaffected — it still uses its flat field list.
```

---

## 10. Display mode for blocks

The Clef Base v0.33.0 spec states that block subtree view modes (document, bullets, table, kanban) are "DisplayMode config entities applied at the block level." This document clarifies the design.

Block-level view modes are **not DisplayMode instances**. DisplayMode is keyed by `(Schema, mode_id)` and applies to entity rendering. A block subtree's presentation as a table or kanban board is a **View layout_type** applied to an inline query whose data source is "children of this block."

The mechanism:

1. A block subtree in the Outline tree can be displayed in multiple ways: as flowing prose (the default), as an indented outline (bullets), as a numbered list, as a table, as a kanban board.

2. Each of these is a **View** whose data source is the block's children and whose `layout_type` determines the presentation. The View concept already has `layout_type` state for this purpose.

3. The user switches between view modes by toggling the block's `view_as` property, which is a reference to a View config. The View's layout_type controls presentation. The View's field visibility settings control which block properties appear as columns (in table mode) or cards (in kanban mode).

This is not a DisplayMode concern. DisplayMode answers "how does an entity of Schema X look in mode Y." Block view modes answer "how do the children of this block render as a collection" — which is what View does.

---

## 11. "View as" — a UI pattern, not a concept

### 11.1 What "view as" is

When a user looks at a ContentNode and switches from "view as Article" to "view as TaxonomyTerm," or from "full" to "teaser" within a Schema, they are choosing a `(schema, mode_id)` pair. That pair gets fed to `DisplayMode/resolve`, and the whole rendering pipeline runs with the new selection.

The question is whether the thing holding that selection is a concept. It is not. "View as" is a **UI pattern** — a picker widget that reads available options from DisplayMode and Schema, produces a `(schema, mode_id)` pair, and writes it to whatever rendering context hosts it.

### 11.2 Where the selection lives

The `(schema, mode_id)` selection is stored by its host context. Each host already has a natural place for it:

| Host context | Where the selection is stored | Persistence |
|-------------|------------------------------|-------------|
| **Embed block** | `display_schema` and `display_mode` properties on the block entity (Outline state) | Persistent — saved with the page |
| **Reference field** | FieldPlacement formatter options: `display_schema`, `display_mode` | Persistent — admin config |
| **Canvas item** | Canvas operational state per-item: `display_schema`, `display_mode` | Persistent — saved with canvas |
| **View row** | View state: `row_display_schema`, `row_display_mode` | Persistent — admin config |
| **Entity's own page** | URL parameter or client-side router state | Ephemeral — not persisted across sessions |

For the entity's own page, navigating to `/article/42` uses the entity's primary Schema + the "default" mode. Clicking the "view as" picker updates the URL to `/article/42?schema=TaxonomyTerm&mode=full` or updates client-side state. The selection doesn't persist unless the admin changes the entity's primary Schema designation.

### 11.3 Why it fails the concept test

No independent state — the selection is always stored on a host (block, field, canvas item, view, URL). No meaningful domain-specific actions — the only action is "set the pair," which is a generic write. No operational principles that compose via syncs — nothing reacts to a "view as" change except the renderer re-rendering with the new pair, which is a standard re-render, not a sync chain.

### 11.4 Widget spec: display-as-picker

The picker is a Surface widget. It appears wherever the user or admin needs to choose how a ContentNode is displayed.

```
widget display-as-picker {

  purpose {
    Lets a user or admin choose a (Schema, DisplayMode) pair for
    rendering a ContentNode. Shows available Schemas from the entity's
    applied Schema list, and available modes per Schema from
    DisplayMode/list_for_schema. Writes the selected pair to its
    host context.
  }

  anatomy {
    // The picker renders as a grouped dropdown or two-level menu.
    // Level 1: Schema names (from the entity's applied Schemas)
    // Level 2: Mode names (from DisplayMode/list_for_schema for each Schema)

    container {
      trigger -> button          // shows current selection, opens dropdown
      dropdown -> popover {
        schema_group -> group [repeats] {
          schema_label -> heading       // e.g. "Article", "TaxonomyTerm"
          mode_item -> option [repeats] // e.g. "Full Page", "Teaser", "Card"
        }
      }
    }
  }

  states {
    default    // collapsed, showing current selection as label
    open       // dropdown visible, user browsing options
    loading    // fetching available modes for a Schema
    empty      // entity has no Schemas applied (edge case, handle gracefully)
  }

  affordances {
    trigger:
      click -> toggleDropdown

    mode_item:
      click -> selectMode
      hover -> previewMode        // optional: show a tooltip preview of the mode

    dropdown:
      click_outside -> close
      escape -> close
  }

  interactor_type: "schema-mode-select"

  props {
    // Input
    entity_id: String             // the ContentNode being displayed
    schema_list: list String      // the entity's applied Schema names
    current_schema: String        // currently selected Schema
    current_mode: String          // currently selected mode_id

    // Output — written to host context on selection
    on_change: callback(schema: String, mode_id: String)
  }

  data_contract {
    // The widget calls DisplayMode/list_for_schema for each Schema
    // in schema_list to populate the dropdown. This is a read-only
    // query, not an action invocation — it can be cached aggressively.

    for each schema in schema_list:
      DisplayMode/list_for_schema(schema) -> modes
      render schema_group with schema_label = schema, mode_items = modes
  }

  a11y {
    role: "listbox" with grouped options
    trigger: aria-haspopup="listbox", aria-expanded=(open state)
    mode_item: role="option", aria-selected=(current selection)
    keyboard: arrow keys navigate between modes, enter selects,
              escape closes, tab moves to next focusable element
  }

  variants {
    compact {
      // Single dropdown combining Schema + mode into one flat list.
      // Used in tight spaces like embed block toolbars.
      // Format: "Article: Full Page", "Article: Teaser", "TaxonomyTerm: Full"
      anatomy_override: flat list instead of grouped
    }

    inline {
      // Renders as a segmented control or tab bar when there are
      // few options (≤ 4 total modes across all Schemas). Falls
      // back to dropdown when there are more.
      anatomy_override: segmented control or tabs
    }

    admin {
      // Extended version for admin display mode management screens.
      // Shows mode descriptions, edit links, and a "Create new mode"
      // action at the bottom of each Schema group.
      anatomy_override: adds description text per mode, edit icon, create action
    }
  }
}
```

### 11.5 Where the widget appears

**Entity page header.** The default triple-zone Layout includes the `display-as-picker` in the page header area, bound to the entity's Schema list. The `on_change` callback updates the URL parameter, triggering a re-render with the new `(schema, mode_id)` pair. Uses the `inline` variant when few modes exist, `default` variant otherwise.

**Embed block toolbar.** When a user embeds a ContentNode via `((block-id))` or a slash command, the embed block's floating toolbar includes a `display-as-picker` in `compact` variant. The `on_change` callback writes to the embed block's `display_schema` and `display_mode` properties (Outline state), triggering a re-render of the embedded content.

**Reference field formatter settings.** In the admin's FieldPlacement configuration panel for a Reference field, the formatter options include a `display-as-picker` in `admin` variant. The admin selects the default `(schema, mode_id)` pair for how referenced entities render through this placement. The `on_change` callback writes to the FieldPlacement's formatter_options.

**Canvas item context menu.** When a user right-clicks a referenced item on a Canvas, the context menu includes a "Display as" submenu powered by `display-as-picker` data. The `on_change` callback writes to the Canvas operational state for that item.

**View row configuration.** In the admin's View edit screen, the row display configuration includes a `display-as-picker` in `admin` variant. The admin selects how each result row renders. The `on_change` callback writes to the View's `row_display_schema` and `row_display_mode` state.

### 11.6 Preview on hover (optional enhancement)

The `previewMode` affordance on `mode_item` can trigger a lightweight preview — a tooltip-sized rendering of the entity through the hovered mode. This calls `Renderer/render` with the hovered `(schema, mode_id)` pair and a `preview: true` flag that tells the rendering pipeline to produce a scaled-down, non-interactive snapshot. The preview is optional and can be disabled for performance. It is particularly useful in the `admin` variant where the admin is deciding which mode to set as default.

---

## 12. Corrections to Clef Base v0.33.0

This section lists specific corrections to the Clef Base v0.33.0 spec based on this design.

| Section | Current text | Correction |
|---------|-------------|-----------|
| §2.1.1 (line 49) | "DisplayMode + ComponentMapping control rendering" | DisplayMode + FieldPlacement + ComponentMapping control rendering. FieldPlacement is the unit of per-field display config. |
| §2.1.5 (line 283) | "the DisplayMode config specifies a formatter" | The FieldPlacement config specifies a formatter. DisplayMode references FieldPlacements, which carry the formatter config. |
| §3.1.3 (line 1003) | "Every place that renders a ContentNode specifies a Schema + DisplayMode pair" — mechanism described in prose | Formalized as the `display-as-picker` widget (§11.4), a Surface widget in the Repertoire with compact, inline, and admin variants. Not a concept — a UI pattern whose selection is stored on its host context. |
| §3.2 (line 1032) | "View modes are DisplayMode config entities applied at the block level" | Block view modes are View configs with `layout_type` applied to an inline query of the block's children. They are not DisplayMode instances. |
| §3.4.3 (line 1076) | "they're DisplayMode properties stored as config entities" | Responsive rules are Layout area properties on the Component concept, stored as config entities. |
| §3.5.6 (line 1468) | "DisplayMode — component_mapping — ComponentMapping ID" | DisplayMode references ComponentMappings in two ways: mode-level `component_mapping` for full widget takeover, and indirectly through FieldPlacements that have `field_mapping` set. The table should list both. |
| §3.5.6 (line 1473) | "DisplayMode (field) — field_mapping per field" | Per-field `field_mapping` is on FieldPlacement, not on DisplayMode directly. |
| Item 12 (line 4268) | "Create DisplayMode entity 'entity-page'" | Create Layout entity "triple-zone-default" (Clef Base config entity); reference it from auto-generated DisplayMode configs for each Schema. The triple-zone layout is a Clef Base convention, not a Repertoire concept. |
| §14 (line 3649) | "Presentation (DisplayMode, FormBuilder, Renderer, View)" | Presentation (DisplayMode, FieldPlacement, FormBuilder, Renderer, View). FieldPlacement is a new concept in the Presentation suite. All five are Repertoire concepts. |
| §16.3 (line 4680) | "ComponentMapping + SlotSource — admin-configured data-to-widget bindings" listed as Clef Base work | ComponentMapping is a Repertoire concept (Presentation suite). The `schema.yaml` integration, default config entities, and admin UI for ComponentMapping are Clef Base work, but the concept itself is general-purpose. Same applies to DisplayMode and FieldPlacement. |

---

## 13. Implementation checklist

Work is organized by where it lands (Repertoire first, then Clef Base), not by phase. Repertoire work has no dependency on Clef Base and can be developed, tested, and released independently.

### Track R — Repertoire (general-purpose library)

All artifacts in this track go into existing Repertoire suites. They have no dependency on ContentNode, the shared pool, ConceptBrowser, or any Clef Base convention.

**R1 — Concept specs**

- [ ] Write `DisplayMode.concept` in `suites/presentation/` (§4.2 of this document)
- [ ] Write `FieldPlacement.concept` in `suites/presentation/` (§5.2 of this document)
- [ ] Extend `View.concept` in `suites/query-retrieval/` with contextual filter state and `add_contextual_filter` action (§6.3)
- [ ] Update `suites/presentation/suite.yaml` to include DisplayMode and FieldPlacement with param mappings

**R2 — Syncs (all in Repertoire suite sync directories)**

- [ ] Write `DisplayModeResolveStrategy.sync` in `suites/presentation/syncs/` — routes Renderer to DisplayMode
- [ ] Write `DisplayModeUsesLayout.sync` in `suites/presentation/syncs/` — delegates to Component/renderLayout when layout is set
- [ ] Write `DisplayModeUsesMapping.sync` in `suites/presentation/syncs/` — delegates to ComponentMapping when component_mapping is set
- [ ] Write `ViewResolvesContextualFilters.sync` in `suites/query-retrieval/syncs/` — resolves contextual filter bindings from rendering context
- [ ] Write `AreaRendersFieldPlacement.sync` in `suites/presentation/syncs/` — wires Layout area items to FieldPlacement rendering
- [ ] Write `FieldPlacementUsesMapping.sync` in `suites/presentation/syncs/` — delegates to ComponentMapping when field_mapping is set

**R3 — Widget spec (Surface)**

- [ ] Write `display-as-picker.widget` in `concept-interface/suites/widgets/` (§11.4) with compact, inline, and admin variants
- [ ] Implement `display-as-picker` in each Surface target: Next.js, React Native, AppKit, WinUI, GTK

**R4 — Repertoire conformance tests**

- [ ] DisplayMode CRUD and resolution tests (sovereign storage, no ContentNode dependency)
- [ ] FieldPlacement CRUD, duplicate, formatter resolution tests
- [ ] View contextual filter resolution with all three fallback behaviors (hide, show_empty, ignore_filter)
- [ ] Full rendering pipeline integration: DisplayMode → Layout → FieldPlacement → Surface widget
- [ ] Full rendering pipeline integration: DisplayMode → ComponentMapping → Surface widget
- [ ] Full rendering pipeline integration: DisplayMode → flat_fields → Surface widget
- [ ] `display-as-picker` widget: Schema list population, mode list population, variant rendering, keyboard navigation, a11y compliance

### Track B — Clef Base (application platform)

All artifacts in this track go into Clef Base. They depend on ContentNode, the shared pool, ConceptBrowser, and Clef Base conventions. Track R is a hard prerequisite — these concepts must exist before Clef Base can wire them.

**B1 — schema.yaml integration (makes DisplayMode and FieldPlacement into ContentNodes)**

- [ ] Write `schema.yaml` for DisplayMode — maps state to ContentNode Properties in the shared pool
- [ ] Write `schema.yaml` for FieldPlacement — maps state to ContentNode Properties in the shared pool
- [ ] Add DisplayMode and FieldPlacement to the config manifest (ConfigSync exports them as config, not content)
- [ ] Verify that ConfigSync round-trips DisplayMode + FieldPlacement + Layout references correctly

**B2 — Default config entities (shipped with Clef Base)**

- [ ] Create Layout entity "triple-zone-default" — three areas: structured (fields), unstructured (block editor), structured (related zone)
- [ ] Create Layout entity "flat-default" — single structured area, no blocks, no related zone
- [ ] Create Layout entity "two-column-sidebar" — main + sidebar with responsive stacking
- [ ] Create View entity "backlinks" with contextual filter `Backlink.target = context.entity`
- [ ] Create View entity "similar-entities" with contextual filter `SemanticEmbedding.similar_to = context.entity`
- [ ] Create View entity "unlinked-references" with contextual filter `Backlink.getUnlinkedMentions.entity = context.entity`
- [ ] Create View entity "graph-neighbors" with contextual filter `Graph.neighbors.entity = context.entity`

**B3 — ConceptBrowser auto-generation (install-time wiring)**

- [ ] Update ConceptBrowser install step 4: when a Schema is installed, auto-generate DisplayMode configs ("default", "full", "teaser")
- [ ] Auto-generation creates FieldPlacements for every field on the Schema with sensible default formatters
- [ ] "default" and "full" modes reference Layout "triple-zone-default"; area "fields" populated with auto-generated FieldPlacements; area "related" populated with the standard related-zone Views
- [ ] "teaser" mode uses flat_fields with title, summary, thumbnail FieldPlacements (if those fields exist on the Schema)

**B4 — Admin UI (built from Clef Base composition primitives)**

- [ ] DisplayMode management screen — list all modes per Schema, create/delete modes (this is a View + Layout, not a monolithic widget)
- [ ] DisplayMode edit screen — choose rendering strategy (layout / component_mapping / flat), configure FieldPlacements
- [ ] Layout area editor integration — drag FieldPlacements, Views, and ComponentMappings into areas
- [ ] FieldPlacement configuration panel — formatter picker, label options, visibility, field_mapping
- [ ] View contextual filter configuration UI — binding expression builder with autocomplete for context paths

**B5 — Widget placement (where `display-as-picker` appears in Clef Base)**

- [ ] Place `display-as-picker` (inline variant) in the triple-zone-default Layout's page header area
- [ ] Place `display-as-picker` (compact variant) in embed block floating toolbar
- [ ] Place `display-as-picker` (admin variant) in FieldPlacement configuration panel for Reference field formatters
- [ ] Wire `display-as-picker` into Canvas item context menu for referenced items
- [ ] Wire `display-as-picker` (admin variant) into View edit screen for row display configuration

**B6 — Clef Base conformance tests**

- [ ] Auto-generation on Schema install: verify three modes created with correct Layout references and FieldPlacements
- [ ] ConfigSync export/import round-trip for DisplayMode + FieldPlacement + Layout as ContentNodes
- [ ] Triple-zone entity page full render: DisplayMode → triple-zone Layout → FieldPlacements + block editor + related-zone Views with contextual filters
- [ ] `display-as-picker` integration: verify selection persistence per host context (embed block, canvas item, URL parameter)
