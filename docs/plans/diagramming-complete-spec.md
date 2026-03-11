# Clef Diagramming Kit — Complete Implementation Specification

**Version 2.0.0 — 2026-03-10**
**Depends on:** Clef v0.18.0, Concept Library v0.4.0, Clef Surface v0.4.0, Clef Base v0.33.0

---

## Part 1: Clef Base Architectural Context

This section provides everything an implementer needs to know about the Clef Base platform to build Canvas and diagramming features. All of this already exists and is stable — the implementer builds ON TOP of it.

### 1.1 The entity model: ContentNode + Schema

Every piece of data in Clef Base is a **ContentNode** — a single universal entity type. There are no entity types and no bundles. Instead, **Schemas** are composable, addable, removable data shapes applied to any ContentNode at any time, in any combination.

A Schema is a mixin. Applying Schema "Article" to a ContentNode gives it article fields. Applying Schema "TaxonomyTerm" to the same ContentNode gives it taxonomy fields too. The ContentNode is now both an article and a taxonomy term. Removing Schema "Article" later hides the article fields.

**One storage pool.** Every ContentNode lives in the same shared pool. A query for "everything tagged with #important" returns articles, taxonomy terms, media assets, canvases — anything with that tag, regardless of Schemas applied.

**Composable identity.** Schemas are added and removed freely. A ContentNode can gain Schema "View" today and lose it tomorrow. Its identity is the set of Schemas currently applied.

**Behavior follows Schema.** When a ContentNode gains a Schema, related concept actions become callable. When it gains Schema "Media", media syncs activate. When it gains Schema "TaxonomyTerm", taxonomy syncs activate. Both operate independently on the same ContentNode.

**When a Schema is applied:**
1. Fields materialize as Property values on the ContentNode
2. If the Schema has an associated concept, the concept's `set T` now includes this ContentNode; its actions become callable
3. Hook syncs from `schema.yaml` fire (`on_apply`, `on_save`, etc.)
4. DisplayMode configs for that Schema become applicable

### 1.2 The triple-zone entity

Every entity in Clef Base has three zones:

**Structured zone** — typed fields conforming to the entity's Schemas. Stored as Property values, queryable, displayable through View, editable through FormBuilder forms.

**Unstructured zone** — a content page attached to every entity (Roam/Notion-like). An ordered tree of ContentNode blocks via the Outline concept. Contains prose, headings, images, embeds, `[[links]]`, `((block refs))`, slash commands.

**Related zone** — computed connections to the knowledge graph. Four sections:
- **Similar entities** — by SemanticEmbedding similarity
- **Links and backlinks** — all explicit connections (Reference, Relation, inline links)
- **Unlinked references** — name mentions without explicit links
- **Nearby entities** — structurally adjacent via Graph concept analysis (shared connections)

The zones emerge from data: Schema fields stored via Property (structured), ContentNode children via Outline (unstructured), Backlink/Relation/SemanticEmbedding/Graph state (related). A ContentNode with Schema fields but no children is a pure record. One with children but no Schema is a freeform page. One with both is the full triple-zone entity.

### 1.3 Multi-Schema display: "display as"

When a ContentNode has multiple Schemas, every rendering context chooses **which Schema to display as**. A ContentNode with Schema "View" + Schema "TaxonomyTerm" renders differently in a taxonomy browser ("display as TaxonomyTerm") vs. a view builder ("display as View") vs. on its own page (admin-configured layout with areas per Schema).

Every place that renders a ContentNode specifies a Schema + DisplayMode pair. The ComponentMapping system can wire fields from any Schema into any widget — it's not limited to one Schema's fields.

**Embedding and referencing.** When a ContentNode is embedded in another page (via `((block-id))` or a Reference field), the user who embeds it chooses the display-as perspective via a dropdown showing all applied Schemas.

### 1.4 The rendering pipeline

The rendering chain: **TypeSystem defines → Property stores → Schema structures → Renderer/FormBuilder consumes → Surface renders**.

Each field has a type (Property + TypeSystem), a widget (how to edit, resolved by Surface's Interactor → Affordance → WidgetResolver pipeline), and a formatter (how to display, via Renderer + DisplayMode). The triad is three independent concepts coordinated by syncs.

**WidgetResolver** provides the automatic path — given field metadata, it classifies an interactor type and resolves to the best widget. A text field gets a text-input, a date field gets a date-picker, a reference field gets an entity-select. Zero-config default.

**ComponentMapping** provides the manual override path — admins pick a widget and visually map entity fields and other data sources into the widget's slots and props. When a ComponentMapping exists for a Schema+DisplayMode, the Renderer uses it instead of WidgetResolver.

**SlotSource** is a coordination concept with providers for pluggable data retrieval into widget slots: `entity_field`, `static_value`, `widget_embed` (recursive nesting), `view_embed`, `block_embed`, `menu`, `formula`, `entity_reference_display`.

### 1.5 Layout areas

Content pages support layouts — spatial arrangements of **areas** (columns, sections, tabs, accordions). The Component concept (Layout suite) handles this. Each area has a content mode: structured (renders through Schema → Renderer → Surface pipeline) or unstructured (live block editor). Areas can be split, merged, rearranged, and resized. Each carries responsive configuration per breakpoint.

### 1.6 Linking concepts: Reference/Backlink vs Relation

**Lightweight (schema-less):**
- **Reference** — Forward links: `addRef(source, target, label)`, `removeRef`, `getRefs`
- **Backlink** — Reverse index: `getBacklinks`, `reindex`. Wired by `bidirectional-links.sync`

**Typed (schema-aware):**
- **Relation** — Typed, labeled, bidirectional connections with cardinality: `defineRelation(schema)`, `link`, `unlink`, `getRelated`
- Bridge: `relation-reference-bridge.sync` mirrors Relation links as Reference entries

### 1.7 Content suite concepts (existing)

The Content suite currently has: Comment, DailyNote, SyncedContent, Template, Version. **Canvas does not yet exist** — it is being added by this implementation plan.

### 1.8 The schema.yaml deployment artifact

Each suite wanting ContentNode integration ships a `schema.yaml`. This file maps concept state fields to Schema fields on ContentNodes. The shared ContentNode pool provider reads it to route mapped fields to ContentNode Properties and unmapped fields to concept-local (operational) storage.

A concept with `schema.yaml` gets: instances as ContentNodes in the shared pool, tagged by Schema, with triple-zone pages, FormBuilder forms, Renderer displays, Query filters. Unmapped fields stay in concept-local storage.

A concept without `schema.yaml` still works — all state goes to concept-local storage, no ContentNode integration.

### 1.9 The coordination + provider pattern

Many Clef suites use a coordination concept with multiple optional provider plugins. Routing syncs dispatch to the correct provider via PluginRegistry. Examples: Runtime (Deploy) → Lambda/ECS/K8s providers. Target (Interface) → REST/GraphQL/CLI providers. Diff (Versioning) → Myers/Patience/Histogram providers.

### 1.10 Surface architecture (v0.4.0)

Clef Surface generates working interfaces from concept specs. Two-step semantic widget selection:

1. **Interactor** — abstract interaction taxonomy (~30 types: `text-input`, `single-choice`, `multi-choice`, `toggle`, `output`, `form-composite`, `overlay-indicator`, etc.). Classified from field metadata.
2. **Affordance** — widget capability declarations. Each `.widget` spec declares which interactor types it can serve, with what specificity and under what conditions.
3. **WidgetResolver** — context-aware matching engine. Given an interactor type + context, resolves to the best widget.

**Surface suites:** surface-core (DesignToken, Element, UISchema, Binding, Signal), surface-component (Widget, Machine, Slot, Interactor, Affordance, WidgetResolver), surface-render (FrameworkAdapter, Surface, Layout, Viewport), surface-theme (Theme, Palette, Typography, Motion, Elevation), surface-app (Navigator, Host, Transport, Shell, PlatformAdapter), surface-spec (WidgetParser, ThemeParser, WidgetGen, ThemeGen), surface-integration (syncs-only).

**Framework adapters:** React, Solid, Vue, Svelte, Ink, Vanilla, SwiftUI, AppKit, Compose, ReactNative, NativeScript, GTK, WinUI, WatchKit, WearCompose.

---

## Part 2: Research Synthesis

### 2.1 What the three research reports agree on

All three reports converge on:

**The property graph with typed first-class edges is the universal data model.** Every diagramming formalism — flowcharts, BPMN, concept maps, knowledge graphs, node-based programming, architecture diagrams — reduces to nodes with typed properties and directed labeled edges.

**Model-view separation is non-negotiable.** Diagrams are projections of semantic models, not standalone visual artifacts. Structurizr's model/view split, Kumu's data-driven views, and tldraw's reactive store all prove this.

**Layout algorithms decompose into pluggable units.** The Sugiyama pipeline (5 phases), force-directed simulation (Fruchterman-Reingold + Barnes-Hut), tree layout (Buchheim), and constraint-based layout (WebCOLA) are the key algorithms. All recommend a provider-based architecture.

**The tldraw pattern (reactive store + immutable records + bindings as first-class entities) is the strongest foundation.** ContentNode already provides this in Clef Base.

**Three connector modes are essential.** Local (visual-only), semantic (real References), and surfaced (discovered References). This maps perfectly to Clef's Reference/Backlink architecture.

### 2.2 Where the reports diverge

**Report 1** proposes ~40 standalone concepts (GraphStore, Node, Edge, Binding, Container, Port, Viewport, SpatialIndex, HitTest, ZOrder, etc.) — a "build tldraw from scratch" approach. Most fail the concept test.

**Report 2** proposes tight Clef Base integration — Canvas, Shape/Text/Frame, SpatialConnector, SpatialLayout, Drawing — with items as ContentNodes and connectors invoking the Linking suite.

**Report 3** proposes ContentNode-as-universal-element, SemanticEdge interactors, ClusterFrames, and dual-syntax editing with theoretical grounding (Cognitive Dimensions, Physics of Notations).

### 2.3 Resolution decisions

**Decision 1: Reject the standalone "diagram-engine" approach.** Report 1's concepts collapse:

| Report 1 Concept | Collapsed Into | Reason |
|---|---|---|
| GraphStore | Canvas operational state + ContentStorage | No independent purpose beyond what Canvas already stores |
| Node | ContentNode | Every canvas item IS a ContentNode |
| Edge / Binding | Canvas connectors + Reference/Relation | Three connector modes map to Canvas state + Linking suite |
| Container | Frame (Schema "Frame" on ContentNode) | Frames + nested canvases provide containment |
| Port | ConnectorPort (kept — passes concept test) | Independent state, meaningful actions, composes via syncs |
| Viewport / Camera | Surface Viewport concept (existing) | Already in surface-render suite |
| SpatialIndex | Canvas internal implementation | R-tree is an implementation detail, not a concept |
| HitTest | Canvas widget implementation | Per-shape geometry is rendering logic |
| ZOrder | Canvas operational state field | `z_index` per item |
| ViewportCuller / LODManager | Widget implementation | Rendering optimizations |
| Selection | Surface Element concept | Already tracks selection state |
| Tool | Surface Machine concept | State machines for interaction modes |
| History | Clef ActionLog + undo syncs | Framework already provides this |
| GestureHandler | Surface PlatformAdapter | Platform-specific input handling |
| Renderer (SVG/Canvas/WebGL) | Surface FrameworkAdapter | 15 framework adapters already exist |
| TypeSystem (diagram) | DiagramNotation (new) | Diagram-specific type rules separate from Clef's TypeSystem |
| DecorationRule | ComponentMapping + DisplayMode | Data-driven visual encoding already works this way |
| Collaboration | Existing Collaboration suite | CRDTs, per-user undo, presence all exist |
| Serializers / FormatDetector | DiagramExport (new coordination concept) | Format-specific providers on one concept |

**Decision 2: Canvas as a ContentNode-native concept.** Items are ContentNodes. Connectors use Reference/Relation. Frames are ContentNodes with Schema "Frame". The canvas IS a ContentNode with Schema "Canvas" applied. Every canvas item gets the full triple-zone treatment.

**Decision 3: SpatialConnector is NOT a separate concept.** Connector visual properties are Canvas operational state. The three modes (local/semantic/surfaced) are Canvas actions + syncs to Reference/Relation. No second store.

**Decision 4: Drawing is a Schema, not a concept.** SVG path data on a ContentNode with Schema "Drawing." No domain actions beyond CRUD.

---

## Part 3: Canvas Architecture

### 3.1 Design principles

**Any ContentNode can become a spatial surface.** Schema "Canvas" is a composable mixin. Apply it to a ContentNode with Schema "Article" and it's both an article and a diagram — "display as Article" shows article fields, "display as Canvas" shows the spatial surface. Apply it to Schema "TaxonomyTerm" and it's a taxonomy term that's also a visual map.

**To have an article WITH a diagram inside it** (rather than an article that IS a diagram), embed a Reference to a Canvas ContentNode in the article's unstructured zone, with display-as "Canvas." Two ContentNodes linked by a Reference. Or configure the article's page layout with two areas: one displaying as Article, one displaying as Canvas — same ContentNode, both perspectives visible simultaneously.

**Every item on a canvas is a ContentNode.** Canvas stores spatial data (x, y, width, height, rotation, z_index) in operational state keyed by `(canvas_id, item_contentnode_id)`. The items themselves are ContentNodes with their own Schemas, blocks, and related zones.

### 3.2 Items on the canvas

Items come in two kinds:

**Local items** — ContentNodes owned by the canvas through Outline (composition). They exist because the canvas exists. Deleting the canvas deletes them:
- **Text blocks.** ContentNode with children (blocks). Type prose, add formatting, embed `[[links]]`.
- **Shapes.** ContentNodes with Schema "Shape" — fields for `shape_type` (rectangle, circle, diamond, sticky_note, callout), `fill_color`, `stroke_color`, `stroke_width`, `text_content`. Sticky notes are shapes with `shape_type: sticky_note`.
- **Frames.** ContentNodes with Schema "Frame" — named regions that group items spatially. `name`, `background_color`. Serves as a navigable section (canvas sidebar lists frames).
- **Freeform drawings.** ContentNodes with Schema "Drawing" — SVG path data.

Since local items are ContentNodes, they get the full treatment. A sticky note is searchable (its text is indexed). A frame has a related zone. A text block can have Schemas applied — apply Schema "Task" to a text block on the canvas and it gains task fields. It's now both a canvas item and a task, queryable as either.

**Referenced items** — References from the canvas to existing ContentNodes elsewhere. The entity exists independently. Removing it from the canvas removes the Reference; the entity is untouched.

Referenced items use the **display-as picker**. Drop a ContentNode onto the canvas and choose:
- "Display as Article in card mode" → card with title, author, teaser
- "Display as View in results mode" → live query results on the board
- "Display as Canvas in thumbnail mode" → nested canvas preview (click to zoom in)
- "Display as TaxonomyTerm in badge mode" → small labeled badge
- "Display as Media in preview mode" → image/video preview
- "Display as [any Schema] in [any DisplayMode]" → the full combinatorial space

The same ContentNode can appear on multiple canvases, displayed differently on each.

### 3.3 Three kinds of connectors

Lines between items come in three kinds. This makes Canvas both a freeform diagramming tool AND a graph editor over the system's linking data.

**Local connectors** — visual-only lines. Stored in Canvas operational state. No Reference created. Drawing "Step 1 → Step 2" in a flowchart doesn't create a system-wide relationship. Default when user draws a line. Visual properties: line style (solid/dashed/dotted), arrow type (none/forward/backward/both), color, label text, bezier curve path.

**Semantic connectors** — real typed References between ContentNodes. Created when user promotes a local connector ("Make this a real link") or draws in semantic mode. `Canvas/promoteConnector` calls `Reference/addRef(source, target, label)`. The connector appears in both items' related zones, participates in graph analysis, is queryable. Canvas stores additional visual data in operational state, but the relationship exists independently.

**Surfaced connectors** — existing References between canvas items, discovered and visualized. If Item A and Item B are both on the canvas, and A has a Reference to B (from prose, a Relation field, another canvas, wherever), the canvas can show it. `Canvas/surfaceExistingReferences` queries for all References between items. The user sees connections they may not have known existed. Surfaced connectors render with distinct visual style (lighter/dashed, icon indicating "discovered").

**Connector operations:**
- `drawConnector(canvas, source, target, label)` → creates local connector
- `promoteConnector(canvas, connector_id)` → local → semantic. Creates Reference.
- `demoteConnector(canvas, connector_id)` → semantic → local. Removes Reference.
- `surfaceExistingReferences(canvas)` → discovers References between all items
- `hideConnector(canvas, reference_id)` → stops showing a surfaced connector without deleting Reference

### 3.4 Canvas as a visual graph editor

The combination of referenced items + surfaced connectors makes every canvas a potential **visual graph editor** over the system's Reference/Relation data.

**Workflow:** Drop ten ContentNodes onto a canvas. Call surfaceExistingReferences. See arrows representing References created anywhere (prose links, Relation fields, other canvases, automated syncs). Rearrange spatially. Apply a layout algorithm (force-directed, hierarchical, circular — via PluginRegistry providers). Draw new local connectors as annotations. Promote interesting ones to real links.

**Interesting compositions:**

**Schema "Canvas" + Schema "View":** A canvas whose items are auto-populated from a query. View results are placed on the canvas via layout algorithms. User rearranges spatially. Like a Miro board that auto-populates from a database query. New results appear as unpositioned items; removed results disappear.

**Schema "Canvas" + Schema "TaxonomyTerm":** A taxonomy term that IS a diagram. A vocabulary of "System Architectures" where each term is a canvas showing component relationships.

**Nested canvases:** A frame or referenced item on a canvas can be a Canvas ContentNode displayed in thumbnail mode. Clicking zooms into the nested canvas. Infinite spatial nesting.

**Canvas-driven Concept Graph:** The Score UI's concept graph navigator is a Canvas ContentNode with installed concepts as referenced items and sync connections as surfaced connectors. Force-directed layout. The canvas IS the architecture diagram — editable, explorable, backed by real sync graph data.

### 3.5 Canvas UI decomposition

The canvas UI is NOT a monolithic "CanvasEditor" widget. It's a layout with areas:

- **Main area:** The spatial surface — a ComponentMapping wrapping the Surface canvas viewport widget. Renders items at x,y with display-as modes, draws connectors, handles drag/move/resize.
- **Left sidebar (structured):** A View of the canvas's frames (ContentNodes with Schema "Frame" that are children of this canvas). Navigable list — clicking a frame pans to that region.
- **Right sidebar (structured):** The selected item's entity page — the same triple-zone layout in a panel. Edit a sticky note's text, view a referenced article's metadata, check a task's status — without leaving the canvas.
- **Bottom panel (structured):** A Control panel with canvas-level actions — layout algorithm selector, zoom slider, grid toggle, export button.

Each is a standard View, ComponentMapping, or Control. Admins can reconfigure the layout.

### 3.6 Canvas in the entity table

| Schema | Associated Concept | Concept Actions | Operational State |
|---|---|---|---|
| Canvas | Canvas | `addItem`, `moveItem`, `resizeItem`, `removeItem`, `drawConnector`, `promoteConnector`, `demoteConnector`, `surfaceExistingReferences`, `hideConnector`, `unhideConnector`, `styleConnector`, `frame`, `group`, `ungroup`, `applyLayout`, `setNotation`, + more | Item positions, connector paths, spatial index, groups, hidden surfaced set |
| Shape | None | — | — |
| Frame | None | — | — |
| Drawing | None | — | — |

---

## Part 4: All Concept Specifications

### 4.1 Canvas [C] — Content suite

```
@version(1)
concept Canvas [C] {

  purpose {
    Infinite 2D spatial surface where ContentNodes are positioned at
    coordinates, connected by visual and semantic lines, grouped into
    frames, and arranged by pluggable layout algorithms.
  }

  state {
    canvases: set C
    name: C -> String
    description: C -> option String
    background: C -> String                // blank | grid | dots | lined
    default_zoom: C -> Float

    items {
      item_set: C -> set ID                // ContentNode IDs on this canvas
      item_x: C -> ID -> Float
      item_y: C -> ID -> Float
      item_width: C -> ID -> Float
      item_height: C -> ID -> Float
      item_rotation: C -> ID -> Float
      item_z_index: C -> ID -> Int
      item_is_local: C -> ID -> Bool       // local (owned) vs referenced
      item_display_as: C -> ID -> option {
        schema: String,
        display_mode: String
      }
      item_type_key: C -> ID -> option String  // notation node type key
    }

    connectors {
      connector_set: C -> set ID
      connector_source: C -> ID -> ID
      connector_target: C -> ID -> ID
      connector_kind: C -> ID -> String    // local | semantic | surfaced
      connector_label: C -> ID -> option String
      connector_path: C -> ID -> list { x: Float, y: Float }
      connector_style: C -> ID -> {
        line_style: String,
        arrow_type: String,
        color: String,
        stroke_width: Float
      }
      connector_source_port: C -> ID -> option ID
      connector_target_port: C -> ID -> option ID
      connector_type_key: C -> ID -> option String
    }

    notation_id: C -> option ID
    snap_to_grid: C -> Bool
    grid_size: C -> Float
    show_minimap: C -> Bool
    hidden_surfaced: C -> set ID

    groups {
      group_set: C -> set ID
      group_members: C -> ID -> set ID
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    // --- Item management ---

    action addItem(canvas: C, content_node: ID, x: Float, y: Float,
                   width: Float, height: Float, is_local: Bool,
                   display_as: option { schema: String, display_mode: String }) {
      -> ok(canvas: C, item: ID) {
        Adds a ContentNode to the canvas at the specified position.
        If is_local, canvas owns this item via Outline (composition).
        If not, it is a referenced item (Reference link).
        z_index set to max+1. rotation set to 0.
        Inserts bounding box into internal R-tree spatial index.
      }
      -> error(message: String) {
        Canvas or ContentNode not found.
      }
    }

    action moveItem(canvas: C, item: ID, x: Float, y: Float) {
      -> ok(canvas: C, item: ID, x: Float, y: Float) {
        Updates the item's position. Updates R-tree entry.
      }
      -> notfound(message: String) { Item not on this canvas. }
    }

    action resizeItem(canvas: C, item: ID, width: Float, height: Float) {
      -> ok(canvas: C, item: ID, width: Float, height: Float) {
        Updates the item's dimensions. Updates R-tree entry.
      }
      -> notfound(message: String) { Item not on this canvas. }
    }

    action removeItem(canvas: C, item: ID) {
      -> ok(canvas: C, item: ID) {
        Removes item from canvas. If local, also deletes ContentNode
        (via sync to Outline/removeChild). If referenced, removes
        Reference only. Removes all connectors attached to this item.
        Removes from R-tree.
      }
      -> notfound(message: String) { Item not on this canvas. }
    }

    action batchMoveItems(canvas: C,
                          moves: list { item_id: ID, x: Float, y: Float }) {
      -> ok(canvas: C, moved: Int) {
        Atomic batch position update. Used by layout algorithms.
        Updates R-tree for all moved items.
      }
      -> error(message: String) { Canvas not found or item(s) missing. }
    }

    action setItemType(canvas: C, item: ID, node_type_key: String) {
      -> ok(canvas: C, item: ID, node_type_key: String) {
        Sets item's notation node type (from active DiagramNotation).
      }
      -> notfound(message: String) { Item not on this canvas. }
    }

    action duplicateItems(canvas: C, item_ids: list ID,
                          offset_x: Float, offset_y: Float) {
      -> ok(canvas: C, new_items: list { original: ID, copy: ID }) {
        Duplicates specified items with position offset. Duplicates
        internal connectors between items in the selection. New items
        are local ContentNode copies.
      }
      -> error(message: String) { Canvas not found or items missing. }
    }

    action reorderZ(canvas: C, item: ID, position: String) {
      -> ok(canvas: C, item: ID) {
        Moves z_index. position: "front"|"back"|"forward"|"backward".
      }
      -> notfound(message: String) { Item not on this canvas. }
    }

    // --- Connector management ---

    action drawConnector(canvas: C, source: ID, target: ID,
                         label: option String,
                         source_port: option ID, target_port: option ID) {
      -> ok(canvas: C, connector_id: ID) {
        Creates local (visual-only) connector. Default: solid, forward
        arrow, theme color. Attaches to ports if provided, else item edges.
        Default path: straight line (two waypoints).
      }
      -> error(message: String) { Source or target not on canvas. }
    }

    action promoteConnector(canvas: C, connector_id: ID) {
      -> ok(canvas: C, connector_id: ID, reference_id: ID) {
        Local → semantic. Via sync, creates Reference between source
        and target ContentNodes with connector's label. kind becomes
        "semantic".
      }
      -> error(message: String) { Not found or already semantic. }
    }

    action demoteConnector(canvas: C, connector_id: ID) {
      -> ok(canvas: C, connector_id: ID) {
        Semantic → local. Via sync, removes Reference. kind becomes
        "local".
      }
      -> error(message: String) { Not found or already local. }
    }

    action surfaceExistingReferences(canvas: C) {
      -> ok(canvas: C, surfaced: list {
        reference_id: ID, source: ID, target: ID, label: option String
      }) {
        Via sync, queries References between all items on canvas.
        Excludes references in hidden_surfaced set.
      }
    }

    action hideConnector(canvas: C, reference_id: ID) {
      -> ok(canvas: C, reference_id: ID) {
        Adds to hidden_surfaced. Stops displaying without deleting Reference.
      }
    }

    action unhideConnector(canvas: C, reference_id: ID) {
      -> ok(canvas: C, reference_id: ID) {
        Removes from hidden_surfaced. Connector becomes visible again.
      }
    }

    action styleConnector(canvas: C, connector_id: ID,
                          line_style: option String, arrow_type: option String,
                          color: option String, stroke_width: option Float) {
      -> ok(canvas: C, connector_id: ID) {
        Updates visual style of a connector.
      }
      -> notfound(message: String) { Connector not on canvas. }
    }

    action setConnectorType(canvas: C, connector_id: ID, edge_type_key: String) {
      -> ok(canvas: C, connector_id: ID, edge_type_key: String) {
        Sets connector's notation edge type. May auto-apply default style.
      }
      -> notfound(message: String) { Connector not on canvas. }
    }

    action rerouteConnector(canvas: C, connector_id: ID,
                            path: list { x: Float, y: Float }) {
      -> ok(canvas: C, connector_id: ID) {
        Updates waypoint path. Used after layout or manual adjustment.
      }
      -> notfound(message: String) { Connector not on canvas. }
    }

    // --- Framing and grouping ---

    action frame(canvas: C, item_ids: list ID, name: String,
                 background_color: option String) {
      -> ok(canvas: C, frame_id: ID) {
        Creates Frame ContentNode (Schema "Frame") containing specified
        items. Bounds computed from item positions with padding.
        Frame is a local item (owned by canvas via Outline).
      }
      -> error(message: String) { Items not on canvas. }
    }

    action group(canvas: C, item_ids: list ID) {
      -> ok(canvas: C, group_id: ID) {
        Logical group. Grouped items move/select/resize together.
        Groups are lightweight canvas-local — not ContentNodes.
      }
      -> error(message: String) { Fewer than 2 items. }
    }

    action ungroup(canvas: C, group_id: ID) {
      -> ok(canvas: C, group_id: ID) {
        Dissolves group. Items remain individually.
      }
      -> notfound(message: String) { Group not found. }
    }

    // --- Layout integration ---

    action applyLayout(canvas: C, algorithm: String, config: option {
      direction: option String, spacing_x: option Float,
      spacing_y: option Float, iterations: option Int
    }) {
      -> ok(canvas: C, items_moved: Int) {
        Calls SpatialLayout/arrange via sync, then applies positions
        via batchMoveItems. Single undo-able transaction.
      }
      -> error(message: String) { Algorithm not found or failed. }
    }

    action applyLayoutToSelection(canvas: C, item_ids: list ID,
                                  algorithm: String, config: option {
      direction: option String, spacing_x: option Float,
      spacing_y: option Float, iterations: option Int
    }) {
      -> ok(canvas: C, items_moved: Int) {
        Partial layout — selected items only. Others are fixed obstacles.
      }
      -> error(message: String) { Algorithm not found or items missing. }
    }

    // --- Notation ---

    action setNotation(canvas: C, notation_id: option ID) {
      -> ok(canvas: C, notation_id: option ID) {
        Associates DiagramNotation. Null = freeform mode.
      }
    }

    // --- Alignment helpers ---

    action alignItems(canvas: C, item_ids: list ID, axis: String,
                      anchor: String) {
      -> ok(canvas: C) {
        axis: "x"|"y". anchor: "min"|"center"|"max".
      }
      -> error(message: String) { Fewer than 2 items. }
    }

    action distributeItems(canvas: C, item_ids: list ID, axis: String) {
      -> ok(canvas: C) {
        Evenly distribute items along axis.
      }
      -> error(message: String) { Fewer than 3 items. }
    }

    // --- Queries ---

    action getItems(canvas: C) {
      -> ok(items: list {
        content_node: ID, x: Float, y: Float, width: Float,
        height: Float, rotation: Float, z_index: Int,
        is_local: Bool, type_key: option String
      }) {
        All items with spatial data.
      }
    }

    action getConnectors(canvas: C) {
      -> ok(connectors: list {
        connector_id: ID, source: ID, target: ID, kind: String,
        label: option String,
        path: list { x: Float, y: Float },
        style: { line_style: String, arrow_type: String,
                 color: String, stroke_width: Float },
        type_key: option String
      }) {
        All connectors (local + semantic + visible surfaced).
      }
    }

    action getItemsInRect(canvas: C, x: Float, y: Float,
                          width: Float, height: Float) {
      -> ok(items: list ID) {
        Spatial query via R-tree. O(log n).
      }
    }
  }

  invariant {
    after addItem(canvas: c, content_node: n, x: 100.0, y: 200.0,
                  width: 80.0, height: 40.0, is_local: true, display_as: _)
           -> ok(canvas: c, item: n)
    then  getItems(canvas: c) -> ok(items: is)
    and   is includes { content_node: n, x: 100.0, y: 200.0 }

    after drawConnector(canvas: c, source: a, target: b, label: "flow",
                        source_port: _, target_port: _)
           -> ok(canvas: c, connector_id: conn)
    and   promoteConnector(canvas: c, connector_id: conn)
           -> ok(canvas: c, connector_id: conn, reference_id: ref)
    then  getConnectors(canvas: c) -> ok(connectors: cs)
    and   cs includes { connector_id: conn, kind: "semantic" }

    after removeItem(canvas: c, item: n) -> ok(canvas: c, item: n)
    then  getItems(canvas: c) -> ok(items: is)
    and   is excludes { content_node: n }
  }
}
```

### 4.2 ConnectorPort [P] — Diagramming suite

```
@version(1)
concept ConnectorPort [P] {

  purpose {
    Typed connection points on canvas items that control where and how
    connectors attach, with direction and data-type validation.
  }

  state {
    ports: set P
    owner: P -> ID
    position: P -> { side: String, offset: Float }
    direction: P -> String            // in | out | bidirectional
    port_type: P -> option String
    label: P -> option String
    max_connections: P -> option Int
    connection_count: P -> Int
  }

  actions {
    action addPort(owner: ID, side: String, offset: Float,
                   direction: String, port_type: option String,
                   label: option String, max_connections: option Int) {
      -> ok(port: P) {
        Creates port. connection_count = 0. side: top|right|bottom|left|center.
        offset: 0.0-1.0 along the side.
      }
      -> error(message: String) { Invalid parameters. }
    }

    action removePort(port: P) {
      -> ok(port: P) { Removes port. Attached connectors become floating. }
      -> notfound(message: String) { Port not found. }
    }

    action movePort(port: P, side: String, offset: Float) {
      -> ok(port: P, side: String, offset: Float) { Repositions port. }
      -> notfound(message: String) { Port not found. }
    }

    action validateConnection(source_port: P, target_port: P) {
      -> ok(source_port: P, target_port: P) {
        Valid: source direction allows outgoing, target allows incoming,
        types compatible (both null or matching), neither exceeds max.
      }
      -> incompatible(source_port: P, target_port: P, reason: String) {
        Invalid: direction mismatch, type mismatch, or capacity exceeded.
      }
    }

    action incrementConnection(port: P) {
      -> ok(port: P, count: Int) { Increments count. }
      -> exceeded(port: P, max: Int) { At max_connections. }
    }

    action decrementConnection(port: P) {
      -> ok(port: P, count: Int) { Decrements count. Min 0. }
    }

    action getPortsForOwner(owner: ID) {
      -> ok(ports: list P) { All ports on the ContentNode. }
    }
  }

  invariant {
    after addPort(owner: o, side: "right", offset: 0.5, direction: "out",
                  port_type: "data", label: "Output", max_connections: 1)
           -> ok(port: p)
    then  validateConnection(source_port: p, target_port: p)
           -> incompatible(source_port: p, target_port: p, reason: _)
  }
}
```

### 4.3 SpatialLayout [L] — Diagramming suite

```
@version(1)
concept SpatialLayout [L] {

  purpose {
    Algorithmic arrangement of canvas items using pluggable layout
    algorithm providers, with constraint preservation and incremental updates.
  }

  state {
    layouts: set L
    canvas_id: L -> ID
    algorithm: L -> String
    config: L -> {
      direction: option String,
      spacing_x: option Float,
      spacing_y: option Float,
      iterations: option Int
    }
    status: L -> String               // idle | running | complete | error
    last_run: L -> option DateTime
  }

  actions {
    action arrange(canvas_id: ID, algorithm: String, config: option {
      direction: option String, spacing_x: option Float,
      spacing_y: option Float, iterations: option Int
    }) {
      -> ok(layout: L, positions: list { item_id: ID, x: Float, y: Float }) {
        Computes positions via algorithm provider. Returns proposed
        positions — does NOT apply them. Caller decides via batchMoveItems.
      }
      -> error(message: String) { Provider not found or computation failed. }
    }

    action arrangeSubset(canvas_id: ID, item_ids: list ID,
                         algorithm: String, config: option {
      direction: option String, spacing_x: option Float,
      spacing_y: option Float, iterations: option Int
    }) {
      -> ok(layout: L, positions: list { item_id: ID, x: Float, y: Float }) {
        Positions for subset only. Others are fixed obstacles.
      }
      -> error(message: String) { Provider not found or items missing. }
    }

    action routeEdge(canvas_id: ID, source_id: ID, target_id: ID,
                     algorithm: String) {
      -> ok(path: list { x: Float, y: Float }) {
        Computes connector path avoiding obstacles. Returns waypoints.
      }
      -> error(message: String) { Provider not found or items missing. }
    }
  }

  invariant {
    after arrange(canvas_id: c, algorithm: "force-directed", config: _)
           -> ok(layout: l, positions: ps)
    then  arrangeSubset(canvas_id: c, item_ids: _, algorithm: "force-directed", config: _)
           -> ok(layout: _, positions: _)
  }
}
```

**Layout providers (via PluginRegistry):**

| Provider | Algorithm | Best For | Complexity |
|---|---|---|---|
| `hierarchical` | Sugiyama 5-phase pipeline | Flowcharts, BPMN, dependency trees | O(V²) worst |
| `force-directed` | Fruchterman-Reingold + Barnes-Hut quadtree | Knowledge graphs, concept maps, social networks | O(V log V) per iteration |
| `tree` | Buchheim-Jünger-Leipert | Mind maps, org charts, file trees | O(V) |
| `circular` | Baur-Brandes crossing minimization | Ring topologies, protocol diagrams | O(V log V) |
| `grid` | Row-major placement | Kanban, tile layouts | O(V) |
| `radial` | BFS from root, concentric circles | Radial mind maps, network hops | O(V+E) |
| `constraint` | WebCOLA stress majorization + gradient projection | Multi-formalism canvases with user constraints | O(V² × iterations) |
| `orthogonal-route` | Visibility graph + A* with bend penalty | BPMN edges, UML connectors | O(E × V log V) |
| `bezier-route` | Control point computation with obstacle margin | Organic diagrams, concept maps | O(E × V) |
| `polyline-route` | Waypoint computation with angle snapping | General purpose routing | O(E × V) |

### 4.4 DiagramNotation [N] — Diagramming suite

```
@version(1)
concept DiagramNotation [N] {

  purpose {
    Define diagram type vocabularies — node types, edge types, connection
    rules, and visual encoding — as swappable notations applied to canvases.
  }

  state {
    notations: set N
    name: N -> String
    description: N -> option String
    node_types: N -> list {
      type_key: String, label: String, shape: String,
      default_fill: option String, default_stroke: option String,
      icon: option String, schema_id: option ID
    }
    edge_types: N -> list {
      type_key: String, label: String, line_style: String,
      arrow_type: String, default_color: option String, requires_label: Bool
    }
    connection_rules: N -> list {
      source_type: String, target_type: String,
      allowed_edge_types: list String,
      min_outgoing: option Int, max_outgoing: option Int,
      min_incoming: option Int, max_incoming: option Int
    }
    preferred_layout: N -> option String
  }

  actions {
    action create(name: String, description: option String) {
      -> ok(notation: N) { Creates empty notation. }
      -> error(message: String) { Name exists. }
    }

    action addNodeType(notation: N, type_key: String, label: String,
                       shape: String, default_fill: option String,
                       default_stroke: option String, icon: option String,
                       schema_id: option ID) {
      -> ok(notation: N, type_key: String) { Adds node type. }
      -> duplicate(message: String) { type_key exists. }
    }

    action addEdgeType(notation: N, type_key: String, label: String,
                       line_style: String, arrow_type: String,
                       default_color: option String, requires_label: Bool) {
      -> ok(notation: N, type_key: String) { Adds edge type. }
      -> duplicate(message: String) { type_key exists. }
    }

    action addConnectionRule(notation: N, source_type: String,
                             target_type: String,
                             allowed_edge_types: list String,
                             min_outgoing: option Int, max_outgoing: option Int,
                             min_incoming: option Int, max_incoming: option Int) {
      -> ok(notation: N) { Adds connection rule. }
      -> invalid(message: String) { Referenced type_keys don't exist. }
    }

    action validateDiagram(canvas_id: ID, notation: N) {
      -> ok(canvas_id: ID) { All valid. }
      -> violations(canvas_id: ID, errors: list {
        element_id: ID, rule: String, message: String, severity: String
      }) { Violations found. }
    }

    action getNodePalette(notation: N) {
      -> ok(types: list {
        type_key: String, label: String, shape: String,
        default_fill: option String, icon: option String
      }) { Node types for palette. }
    }

    action getEdgePalette(notation: N) {
      -> ok(types: list {
        type_key: String, label: String, line_style: String,
        arrow_type: String, default_color: option String
      }) { Edge types for palette. }
    }

    action applyToCanvas(canvas_id: ID, notation: N) {
      -> ok(canvas_id: ID, notation: N) { Associates notation with canvas. }
      -> notfound(message: String) { Canvas or notation not found. }
    }
  }

  invariant {
    after create(name: "Flowchart", description: _) -> ok(notation: n)
    and   addNodeType(notation: n, type_key: "decision", label: "Decision",
                      shape: "diamond", default_fill: _, default_stroke: _,
                      icon: _, schema_id: _) -> ok(notation: n, type_key: _)
    then  getNodePalette(notation: n) -> ok(types: ts)
    and   ts includes { type_key: "decision" }
  }
}
```

**Built-in notation packs:** flowchart, bpmn (~30 node types, 3 edge types), concept-map (requires labeled edges), mind-map (tree-only), uml-class, uml-sequence, statechart, c4-model, erd, network, causal-loop (±polarity), freeform (no constraints, default).

### 4.5 DiagramExport [X] — Diagramming suite

```
@version(1)
concept DiagramExport [X] {

  purpose {
    Export canvas diagrams to multiple formats via pluggable providers,
    with round-trip metadata embedding for re-import.
  }

  state {
    exports: set X
    canvas_id: X -> ID
    format: X -> String
    status: X -> String
    output: X -> option Bytes
    metadata: X -> option { width: Int, height: Int, embedded_data: Bool }
  }

  actions {
    action export(canvas_id: ID, format: String, options: option {
      width: option Int, height: option Int, background: option String,
      embed_data: option Bool, selection_only: option Bool
    }) {
      -> ok(export: X, data: Bytes, mime_type: String) {
        Renders to format. If embed_data, embeds full state for round-trip.
      }
      -> error(message: String) { Provider not found or render failed. }
    }

    action importDiagram(data: Bytes, format: String, target_canvas: option ID) {
      -> ok(canvas_id: ID, items_created: Int, connectors_created: Int) {
        Parses input, creates items/connectors on target canvas (or new).
      }
      -> error(message: String) { Format not recognized or data corrupt. }
    }

    action detectFormat(data: Bytes) {
      -> ok(format: String, confidence: Float) { Identifies format. }
      -> unknown(message: String) { Cannot determine. }
    }
  }

  invariant {
    after export(canvas_id: c, format: "json", options: { embed_data: true })
           -> ok(export: x, data: d, mime_type: _)
    then  importDiagram(data: d, format: "json", target_canvas: _)
           -> ok(canvas_id: _, items_created: _, connectors_created: _)
  }
}
```

**Export providers:** json (full round-trip), svg (embedded JSON comment), png (tEXt chunk), pdf, mermaid, d2, dot, bpmn-xml, drawio-xml.

### 4.6 ConstraintAnchor [A] — Diagramming suite

```
@version(1)
concept ConstraintAnchor [A] {

  purpose {
    User-placed spatial constraints that layout algorithms must respect,
    enabling hybrid manual+automatic layout preserving mental map.
  }

  state {
    anchors: set A
    canvas_id: A -> ID
    anchor_type: A -> String   // pin | align_h | align_v | separate | group_bounds | flow_direction
    target_items: A -> list ID
    parameters: A -> {
      x: option Float, y: option Float,
      gap: option Float, axis: option String,
      direction: option String
    }
  }

  actions {
    action pin(canvas_id: ID, item_id: ID, x: Float, y: Float) {
      -> ok(anchor: A) { Pins item. Layout treats as immovable. }
    }

    action align(canvas_id: ID, item_ids: list ID, axis: String) {
      -> ok(anchor: A) { Constrains items to share coordinate on axis. }
      -> error(message: String) { Fewer than 2 items or invalid axis. }
    }

    action separate(canvas_id: ID, item_a: ID, item_b: ID, gap: Float) {
      -> ok(anchor: A) { Maintains minimum gap. }
    }

    action setFlowDirection(canvas_id: ID, item_ids: list ID, direction: String) {
      -> ok(anchor: A) { Constrains directional flow during layout. }
    }

    action removeAnchor(anchor: A) {
      -> ok(anchor: A) { Removes constraint. }
      -> notfound(message: String) { Not found. }
    }

    action getAnchorsForCanvas(canvas_id: ID) {
      -> ok(anchors: list A) { All constraints for canvas. }
    }
  }

  invariant {
    after pin(canvas_id: c, item_id: i, x: 100.0, y: 200.0) -> ok(anchor: a)
    then  getAnchorsForCanvas(canvas_id: c) -> ok(anchors: as)
    and   as includes a
  }
}
```

---

## Part 5: Schemas

### 5.1 Thing schemas (associated with Canvas concept)

**Schema "Canvas":**
- `name`: String (required)
- `description`: RichText
- `background`: Enum (blank | grid | dots | lined), default: blank
- `default_zoom`: Float, default: 1.0

### 5.2 Thing schemas (no associated concept — pure data shapes)

**Schema "Shape":**
- `shape_type`: Enum (rectangle, circle, diamond, sticky_note, callout, hexagon, triangle, parallelogram, cylinder, document)
- `fill_color`: String, default: "#FFFFFF"
- `stroke_color`: String, default: "#000000"
- `stroke_width`: Float, default: 2.0
- `text_content`: String
- `font_size`: Float, default: 14.0
- `text_align`: Enum (left, center, right), default: center
- `corner_radius`: Float, default: 0.0
- `notation_type_key`: option String

**Schema "Frame":**
- `name`: String (required)
- `background_color`: option String
- `border_style`: Enum (solid, dashed, none), default: solid
- `collapsed`: Bool, default: false

**Schema "Drawing":**
- `path_data`: String (SVG path d attribute)
- `stroke_color`: String, default: "#000000"
- `stroke_width`: Float, default: 2.0
- `opacity`: Float, default: 1.0
- `tool`: Enum (pen, highlighter, eraser), default: pen

### 5.3 Mixin schemas

**Schema "ConnectorLabel":**
- `connector_id`: String
- `position_on_edge`: Float, default: 0.5

### 5.4 composition.yaml

```yaml
compositions:
  - when_schema: Canvas
    apply_mixin: HasTags
  - when_schema: Shape
    apply_mixin: Commentable
```

---

## Part 6: Suite Definitions

### 6.1 Canvas addition to Content suite

Canvas is added to the existing Content suite (`suites/content/`):

```yaml
# Addition to existing content/suite.yaml
concepts:
  Canvas:
    spec: ./canvas.concept
    params:
      C: { as: canvas-id, description: "Canvas identity" }
```

### 6.2 Diagramming suite (new)

```yaml
suite:
  name: diagramming
  version: 0.1.0
  description: "Composable diagramming with pluggable notations, layouts, ports, constraints, and export"

concepts:
  ConnectorPort:
    spec: ./connector-port.concept
    params:
      P: { as: port-id, description: "Port identity" }
  SpatialLayout:
    spec: ./spatial-layout.concept
    params:
      L: { as: layout-id, description: "Layout run identity" }
  DiagramNotation:
    spec: ./diagram-notation.concept
    params:
      N: { as: notation-id, description: "Notation identity" }
  DiagramExport:
    spec: ./diagram-export.concept
    params:
      X: { as: export-id, description: "Export run identity" }
  ConstraintAnchor:
    spec: ./constraint-anchor.concept
    params:
      A: { as: anchor-id, description: "Constraint anchor identity" }

  # Layout providers (all optional)
  HierarchicalLayoutProvider:
    spec: ./providers/hierarchical-layout.concept
    optional: true
  ForceDirectedLayoutProvider:
    spec: ./providers/force-directed-layout.concept
    optional: true
  TreeLayoutProvider:
    spec: ./providers/tree-layout.concept
    optional: true
  CircularLayoutProvider:
    spec: ./providers/circular-layout.concept
    optional: true
  GridLayoutProvider:
    spec: ./providers/grid-layout.concept
    optional: true
  RadialLayoutProvider:
    spec: ./providers/radial-layout.concept
    optional: true
  ConstraintLayoutProvider:
    spec: ./providers/constraint-layout.concept
    optional: true
  OrthogonalRouteProvider:
    spec: ./providers/orthogonal-route.concept
    optional: true
  BezierRouteProvider:
    spec: ./providers/bezier-route.concept
    optional: true
  PolylineRouteProvider:
    spec: ./providers/polyline-route.concept
    optional: true

  # Export providers (all optional)
  JsonExportProvider:
    spec: ./providers/json-export.concept
    optional: true
  SvgExportProvider:
    spec: ./providers/svg-export.concept
    optional: true
  PngExportProvider:
    spec: ./providers/png-export.concept
    optional: true
  PdfExportProvider:
    spec: ./providers/pdf-export.concept
    optional: true
  MermaidExportProvider:
    spec: ./providers/mermaid-export.concept
    optional: true
  D2ExportProvider:
    spec: ./providers/d2-export.concept
    optional: true
  DotExportProvider:
    spec: ./providers/dot-export.concept
    optional: true
  BpmnXmlExportProvider:
    spec: ./providers/bpmn-xml-export.concept
    optional: true
  DrawioXmlExportProvider:
    spec: ./providers/drawio-xml-export.concept
    optional: true

  # Notation providers (all optional)
  FlowchartNotationProvider:
    spec: ./providers/flowchart-notation.concept
    optional: true
  BpmnNotationProvider:
    spec: ./providers/bpmn-notation.concept
    optional: true
  ConceptMapNotationProvider:
    spec: ./providers/concept-map-notation.concept
    optional: true
  MindMapNotationProvider:
    spec: ./providers/mind-map-notation.concept
    optional: true
  UmlClassNotationProvider:
    spec: ./providers/uml-class-notation.concept
    optional: true
  StatechartNotationProvider:
    spec: ./providers/statechart-notation.concept
    optional: true
  C4NotationProvider:
    spec: ./providers/c4-notation.concept
    optional: true
  ErdNotationProvider:
    spec: ./providers/erd-notation.concept
    optional: true
  CausalLoopNotationProvider:
    spec: ./providers/causal-loop-notation.concept
    optional: true

syncs:
  required:
    - canvas-promote-creates-reference
    - canvas-demote-removes-reference
    - canvas-surface-queries-references
    - canvas-remove-local-deletes-contentnode
    - canvas-remove-referenced-deletes-reference
    - connector-port-validation
    - layout-applies-positions
    - layout-respects-constraints
    - notation-validates-on-connect
    - export-dispatches-to-provider
  recommended:
    - auto-surface-references-on-add
    - notation-auto-apply-schema
    - concept-map-requires-edge-labels
    - canvas-index-items-for-search
  integration:
    - layout-provider-registers
    - export-provider-registers
    - notation-provider-registers

uses:
  - suite: content
    concepts:
      - name: Canvas
  - suite: foundation
    concepts:
      - name: ContentNode
      - name: ContentStorage
      - name: Outline
  - suite: linking
    concepts:
      - name: Reference
      - name: Backlink
      - name: Relation
  - suite: infrastructure
    concepts:
      - name: PluginRegistry
      - name: Validator
  - suite: presentation
    concepts:
      - name: Renderer
      - name: DisplayMode
  - suite: data-organization
    concepts:
      - name: Graph
  - suite: query-retrieval
    concepts:
      - name: SearchIndex
  - suite: classification
    concepts:
      - name: Schema
```

---

## Part 7: All Sync Definitions

### 7.1 Required syncs — Canvas ↔ Linking

**canvas-promote-creates-reference.sync**
```
sync CanvasPromoteCreatesReference [eager]
when {
  Canvas/promoteConnector: [ canvas: ?canvas; connector_id: ?conn ]
    => [ ok; connector_id: ?conn; reference_id: ?ref ]
}
where {
  Canvas: { ?conn connector_source: ?src }
  Canvas: { ?conn connector_target: ?tgt }
  Canvas: { ?conn connector_label: ?label }
}
then {
  Reference/addRef: [ source: ?src; target: ?tgt; label: ?label ]
}
```

**canvas-demote-removes-reference.sync**
```
sync CanvasDemoteRemovesReference [eager]
when {
  Canvas/demoteConnector: [ canvas: ?canvas; connector_id: ?conn ]
    => [ ok ]
}
where {
  Canvas: { ?conn connector_kind: "semantic" }
  Canvas: { ?conn connector_source: ?src }
  Canvas: { ?conn connector_target: ?tgt }
}
then {
  Reference/removeRef: [ source: ?src; target: ?tgt ]
}
```

**canvas-surface-queries-references.sync**
```
sync CanvasSurfaceQueriesReferences [eager]
when {
  Canvas/surfaceExistingReferences: [ canvas: ?canvas ]
    => [ _ ]
}
where {
  Canvas: { ?canvas item_set: ?items }
}
then {
  Reference/getRefsBetween: [ entity_ids: ?items ]
}
```

**canvas-remove-local-deletes-contentnode.sync**
```
sync CanvasRemoveLocalDeletesContentNode [eager]
when {
  Canvas/removeItem: [ canvas: ?canvas; item: ?item ] => [ ok ]
}
where {
  Canvas: { ?canvas item_is_local: { ?item: true } }
}
then {
  Outline/removeChild: [ parent: ?canvas; child: ?item ]
}
```

**canvas-remove-referenced-deletes-reference.sync**
```
sync CanvasRemoveReferencedDeletesReference [eager]
when {
  Canvas/removeItem: [ canvas: ?canvas; item: ?item ] => [ ok ]
}
where {
  Canvas: { ?canvas item_is_local: { ?item: false } }
}
then {
  Reference/removeRef: [ source: ?canvas; target: ?item ]
}
```

### 7.2 Required syncs — Diagramming

**connector-port-validation.sync**
```
sync ConnectorPortValidation [eager]
when {
  Canvas/drawConnector: [ canvas: ?canvas; source: ?src; target: ?tgt;
                          source_port: ?srcPort; target_port: ?tgtPort ]
    => [ ok ]
}
where {
  filter(?srcPort != null)
  filter(?tgtPort != null)
}
then {
  ConnectorPort/validateConnection: [ source_port: ?srcPort; target_port: ?tgtPort ]
}
```

**layout-applies-positions.sync**
```
sync LayoutAppliesPositions [eager]
when {
  Canvas/applyLayout: [ canvas: ?canvas; algorithm: ?alg; config: ?cfg ] => [ _ ]
}
then {
  SpatialLayout/arrange: [ canvas_id: ?canvas; algorithm: ?alg; config: ?cfg ]
}
```

**layout-respects-constraints.sync**
```
sync LayoutRespectsConstraints [eager]
when {
  SpatialLayout/arrange: [ canvas_id: ?canvas ] => [ _ ]
}
where {
  ConstraintAnchor: { ?anchors canvas_id: ?canvas }
}
then {
  SpatialLayout/applyConstraints: [ canvas_id: ?canvas; anchors: ?anchors ]
}
```

**notation-validates-on-connect.sync**
```
sync NotationValidatesOnConnect [eager]
when {
  Canvas/drawConnector: [ canvas: ?canvas; source: ?src; target: ?tgt ] => [ ok ]
}
where {
  Canvas: { ?canvas notation_id: ?notation }
  filter(?notation != null)
}
then {
  DiagramNotation/validateDiagram: [ canvas_id: ?canvas; notation: ?notation ]
}
```

**export-dispatches-to-provider.sync**
```
sync ExportDispatchesToProvider [eager]
when {
  DiagramExport/export: [ canvas_id: ?canvas; format: ?fmt ] => [ _ ]
}
where {
  PluginRegistry: { ?provider type: "diagram_export"; key: ?fmt }
}
then {
  PluginRegistry/dispatch: [ plugin_type: "diagram_export"; key: ?fmt; input: { canvas_id: ?canvas } ]
}
```

### 7.3 Recommended syncs

**auto-surface-references-on-add.sync**
```
sync AutoSurfaceReferencesOnAdd [eventual]
when {
  Canvas/addItem: [ canvas: ?canvas; item: ?item ] => [ ok ]
}
then {
  Canvas/surfaceExistingReferences: [ canvas: ?canvas ]
}
```

**notation-auto-apply-schema.sync**
```
sync NotationAutoApplySchema [eager]
when {
  Canvas/setItemType: [ canvas: ?canvas; item: ?item; node_type_key: ?typeKey ] => [ ok ]
}
where {
  Canvas: { ?canvas notation_id: ?notation }
  DiagramNotation: { ?notation node_types: ?types }
  bind(findType(?types, ?typeKey) as ?typeSpec)
  filter(?typeSpec.schema_id != null)
}
then {
  Schema/applyTo: [ entity: ?item; schema: ?typeSpec.schema_id ]
}
```

**concept-map-requires-edge-labels.sync**
```
sync ConceptMapRequiresEdgeLabels [eager]
when {
  Canvas/drawConnector: [ canvas: ?canvas; source: ?src; target: ?tgt; label: ?label ] => [ ok ]
}
where {
  Canvas: { ?canvas notation_id: ?notation }
  DiagramNotation: { ?notation name: "Concept Map" }
  filter(?label == null or ?label == "")
}
then {
  Validator/reportError: [ entity: ?canvas; field: "connector_label"; message: "Concept maps require labeled edges" ]
}
```

**canvas-index-items-for-search.sync**
```
sync CanvasIndexItemsForSearch [eventual]
when {
  Canvas/addItem: [ canvas: ?canvas; item: ?item ] => [ ok ]
}
then {
  SearchIndex/index: [ entity: ?item ]
}
```

---

## Part 8: Derived Concepts

### 8.1 FlowchartEditor

```
derived FlowchartEditor [T] {
  purpose { Canvas pre-configured with flowchart notation, hierarchical layout, standard process tooling. }
  composes { Canvas [T]; DiagramNotation [T]; SpatialLayout [T]; DiagramExport [T] }
  syncs { required: [flowchart-setup, flowchart-layout-default] }
  surface {
    action create(name: String) { matches: Canvas/create + DiagramNotation/applyToCanvas(notation: "flowchart") }
    action autoLayout() { matches: Canvas/applyLayout(algorithm: "hierarchical") }
    action export(format: String) { matches: DiagramExport/export }
    query getItems() -> Canvas/getItems
  }
  principle { after create(name: "My Flow") then getItems() returns empty canvas with flowchart palette }
}
```

### 8.2 ConceptMapEditor

```
derived ConceptMapEditor [T] {
  purpose { Canvas with concept-map notation requiring labeled edges, force-directed layout. }
  composes { Canvas [T]; DiagramNotation [T]; SpatialLayout [T]; Reference [T] }
  syncs { required: [concept-map-setup, concept-map-force-layout, concept-map-requires-edge-labels] }
  surface {
    action create(name: String) { matches: Canvas/create + DiagramNotation/applyToCanvas(notation: "concept-map") }
    action autoLayout() { matches: Canvas/applyLayout(algorithm: "force-directed") }
    query getPropositions() -> Reference/getRefs filtered by canvas scope
  }
  principle { after drawing connector with label "causes" then getPropositions() includes proposition }
}
```

### 8.3 MindMapEditor

```
derived MindMapEditor [T] {
  purpose { Canvas with mind-map notation enforcing tree topology and tree layout. }
  composes { Canvas [T]; DiagramNotation [T]; SpatialLayout [T]; Outline [T] }
  syncs { required: [mindmap-setup, mindmap-tree-constraint, mindmap-layout] }
  surface {
    action create(name: String, central_topic: String) { matches: Canvas/create + Canvas/addItem + DiagramNotation/applyToCanvas(notation: "mind-map") }
    action addBranch(parent: ID, topic: String) { matches: Canvas/addItem + Outline/appendChild }
    action autoLayout() { matches: Canvas/applyLayout(algorithm: "tree") }
  }
  principle { after create then autoLayout() arranges in radial tree from center }
}
```

### 8.4 KnowledgeGraphExplorer

```
derived KnowledgeGraphExplorer [T] {
  purpose { Canvas auto-populated from query with surfaced connections and force-directed layout. }
  composes { Canvas [T]; View [T]; SpatialLayout [T]; Graph [T] }
  syncs { required: [kg-populate-from-query, kg-surface-all-refs, kg-auto-layout] }
  surface {
    action explore(query: String) { matches: View/query + Canvas/addItem per result + Canvas/surfaceExistingReferences }
    action expandNode(node: ID) { matches: Graph/getNeighbors + Canvas/addItem per neighbor + Canvas/surfaceExistingReferences }
    action autoLayout() { matches: Canvas/applyLayout(algorithm: "force-directed") }
  }
  principle { after explore() then canvas shows entities with References surfaced as connectors }
}
```

---

## Part 9: schema.yaml Files

### 9.1 Canvas schema.yaml (Content suite)

```yaml
schemas:
  - concept: Canvas
    schema_name: Canvas
    manifest: content
    fields:
      - from: name
        to: canvas_name
        type: String
        mutability: editable
        required: true
      - from: description
        to: canvas_description
        type: RichText
        mutability: editable
      - from: background
        to: canvas_background
        type: Enum
        values: [blank, grid, dots, lined]
        mutability: editable
      - from: default_zoom
        to: canvas_default_zoom
        type: Float
        mutability: editable
    hooks:
      on_apply: canvas-init-spatial-index
      on_delete: canvas-cleanup-local-items
```

### 9.2 Diagramming schema.yaml

```yaml
schemas:
  - concept: ConnectorPort
    schema_name: ConnectorPort
    manifest: config
    fields:
      - { from: owner, to: owner_ref, type: Reference, mutability: editable }
      - { from: position, to: port_position, type: JSON, mutability: editable }
      - { from: direction, to: port_direction, type: Enum, values: [in, out, bidirectional], mutability: editable }
      - { from: port_type, to: port_type_label, type: String, mutability: editable }
      - { from: label, to: port_label, type: String, mutability: editable }
      - { from: max_connections, to: port_max_connections, type: Integer, mutability: editable }

  - concept: DiagramNotation
    schema_name: DiagramNotation
    manifest: config
    fields:
      - { from: name, to: notation_name, type: String, mutability: editable, required: true }
      - { from: description, to: notation_description, type: RichText, mutability: editable }
      - { from: node_types, to: notation_node_types, type: JSON, mutability: editable }
      - { from: edge_types, to: notation_edge_types, type: JSON, mutability: editable }
      - { from: connection_rules, to: notation_rules, type: JSON, mutability: editable }
      - { from: preferred_layout, to: notation_preferred_layout, type: String, mutability: editable }

  - concept: ConstraintAnchor
    schema_name: ConstraintAnchor
    manifest: content
    fields:
      - { from: canvas_id, to: anchor_canvas, type: Reference, mutability: editable }
      - { from: anchor_type, to: anchor_type, type: Enum, values: [pin, align_h, align_v, separate, group_bounds, flow_direction], mutability: editable }
      - { from: target_items, to: anchor_targets, type: ReferenceList, mutability: editable }
      - { from: parameters, to: anchor_params, type: JSON, mutability: editable }
```

---

## Part 10: Surface — Interactors & Widgets

### 10.1 Widget framework targets

| Framework | Platform | Rendering Strategy |
|---|---|---|
| **Next.js** (functional React, `"use client"`) | Web (SSR + CSR) | Canvas2D/SVG for spatial surface; React components for panels |
| **React Native** | iOS + Android | react-native-skia for surface; native views for panels |
| **AppKit** | macOS | NSView + Core Graphics/Metal for surface; native views for panels |
| **WinUI** | Windows | Win2D CanvasControl + XAML for panels |
| **GTK** | Linux | GtkDrawingArea + Cairo for surface; GtkBox/GtkFixed for panels |

### 10.2 New interactor types (3)

| Interactor | Category | Properties |
|---|---|---|
| `spatial-canvas` | container | `{ zoom_range: [min, max], grid: bool, snap: bool, background: enum }` |
| `connector-draw` | input | `{ mode: "local"\|"semantic", show_ports: bool, route_style: enum }` |
| `node-palette` | input | `{ notation_id: ID, orientation: "horizontal"\|"vertical" }` |

### 10.3 Widgets (10)

#### 10.3.1 spatial-canvas-viewport.widget

**Serves:** `spatial-canvas` [specificity: 20]
**Anatomy:** viewport, grid-layer, item-layer, connector-layer, interaction-layer, minimap-slot

**Next.js:** Client component with `<canvas>` element. Camera `{ x, y, zoom }` in `useRef` (not state — avoids re-renders). Items as absolutely-positioned `<div>` elements inside CSS-transformed container (`transform: scale(${zoom}) translate(${x}px, ${y}px)`). Connectors via SVG overlay or Canvas2D. Grid via repeating CSS background-image (dots/grid) or Canvas2D. Events: `onWheel` → zoom-at-point (`newOffset = oldOffset - (mouseWorld × newScale - mouseWorld × oldScale)`), `onPointerDown/Move/Up` → drag/pan/marquee. Viewport culling via R-tree query against visible rect. `requestAnimationFrame` for smooth animation. Items resolve display via WidgetResolver (each item renders as whatever its Schema+DisplayMode resolves to). Performance tiers: DOM overlay <500 items, pure Canvas2D 500-5000, OffscreenCanvas+worker 5000+.

**React Native:** `react-native-skia` `Canvas` view. `GestureDetector` from `react-native-gesture-handler` for pinch-zoom (`Gesture.Pinch()`), two-finger pan (`Gesture.Pan()`). Items as Skia groups positioned by transform matrix. Connectors as Skia `Path`. `react-native-reanimated` shared values for 60fps. Text editing: overlay `TextInput` positioned at item's screen coordinates.

**AppKit:** Custom `NSView` subclass, layer-backed. `draw(_ dirtyRect:)` for grid/connectors via Core Graphics. Items as child `NSView` instances positioned via `frame`. `magnify(with:)` for zoom. `scrollWheel(with:)` for pan. Mouse events for drag/connect/marquee. 10k+ items: switch to `MTKView` (Metal) with instanced drawing. Accessibility: `NSAccessibilityGroup`.

**WinUI:** `Microsoft.Graphics.Canvas.UI.Xaml.CanvasControl` (Win2D). Grid/connectors in `Draw` handler via `CanvasDrawingSession`. Items as `ContentControl` XAML in `Canvas` panel overlay. `PointerWheelChanged` → zoom, `ManipulationDelta` → touch pan/zoom. Virtualization: control pool recycling. Ink via `InkCanvas` overlay.

**GTK:** `GtkDrawingArea` with Cairo for grid/connectors. `GtkFixed` overlay for items. `GtkGestureZoom` pinch, `GtkGestureDrag` pan, `GtkEventControllerScroll` wheel. Cairo transforms: `cairo_translate(cr, tx, ty); cairo_scale(cr, zoom, zoom)`. Dynamic widget creation/destruction for viewport visibility.

#### 10.3.2 canvas-connector.widget

**Serves:** `connector-draw` [specificity: 15]
**Anatomy:** path, arrow-start, arrow-end, label, midpoint-handle

Per-framework: Next.js SVG `<path>` / Canvas2D `bezierCurveTo`. React Native Skia `Path`. AppKit `NSBezierPath`. WinUI Win2D `CanvasPathBuilder`. GTK Cairo `cairo_curve_to`.

Three visual tiers: local (solid, theme color), semantic (solid + link icon), surfaced (dashed + "discovered" icon). Port snapping within 10px screen distance. Orthogonal routing via `SpatialLayout/routeEdge`.

#### 10.3.3 node-palette-panel.widget

**Serves:** `node-palette` [specificity: 15]
**Anatomy:** palette-header, type-grid, search-filter

Populated from `DiagramNotation/getNodePalette`. Drag creates ContentNode with Schema and type key. Next.js: `react-dnd` / HTML5 drag. React Native: `LongPressGestureHandler` + `PanGestureHandler`. AppKit: `NSDraggingSource`. WinUI: `UIElement.StartDragAsync`. GTK: `GtkDragSource`.

#### 10.3.4 canvas-minimap.widget

**Serves:** `spatial-canvas` [specificity: 5] when role: "minimap"
**Anatomy:** minimap-viewport, camera-rect (draggable), item-dots

#### 10.3.5 connector-port-indicator.widget

**Serves:** `connector-draw` [specificity: 10] when role: "port"
**Anatomy:** port-dot (colored: blue=in, orange=out, green=bidi), port-label, connection-count badge

#### 10.3.6 layout-control-panel.widget

**Serves:** `single-choice` [specificity: 10] when context: "canvas-layout"
**Anatomy:** algorithm-selector, direction-selector, spacing-slider, apply-button

#### 10.3.7 constraint-anchor-indicator.widget

**Serves:** `overlay-indicator` [specificity: 10] when semantic: "constraint"
**Anatomy:** pin-icon, alignment-line, separation-arrows

#### 10.3.8 diagram-export-dialog.widget

**Serves:** `action-trigger` [specificity: 10] when context: "diagram-export"
**Anatomy:** format-selector, size-options, background-toggle, embed-data-toggle, preview, export-button

#### 10.3.9 notation-badge.widget

**Serves:** `output` [specificity: 5] when context: "canvas-notation"
**Anatomy:** notation-icon, notation-name (in canvas toolbar)

#### 10.3.10 canvas-properties-panel.widget

**Serves:** `form-composite` [specificity: 10] when context: "canvas-properties"
**Anatomy:** item-properties, connector-properties, canvas-properties (right sidebar)

### 10.4 Surface impact summary

| Category | Count |
|---|---|
| New interactor types | 3 |
| New widget specs | 10 |
| New Surface concepts | 0 |
| Modified Surface concepts | 0 |
| Widget framework implementations | 10 × 5 = 50 |

---

## Part 11: Implementation Plan

### 11.1 Phase overview (36 weeks)

| Phase | Weeks | What |
|---|---|---|
| **1: Canvas concept** | 1–4 | Canvas spec, Schemas, 4-language handlers, core Canvas↔Linking syncs |
| **2: Diagramming concepts** | 5–10 | ConnectorPort, SpatialLayout, DiagramNotation, ConstraintAnchor, DiagramExport |
| **3: Layout providers** | 11–16 | 10 layout/routing algorithm providers × 4 languages |
| **4: Notation & export providers** | 17–20 | 12 notation packs + 9 export format providers |
| **5: Sync wiring & integration testing** | 21–23 | All syncs, full end-to-end sync chain tests |
| **6: Surface widgets** | 24–30 | 3 interactors, 10 widgets × 5 frameworks |
| **7: Derived concepts** | 31–33 | 4 derived concepts, their syncs, Bind endpoints |
| **8: Clef Base integration** | 34–36 | schema.yaml deploy, concept browser, admin UI |

### 11.2 Phase 1: Canvas (Weeks 1–4)

**Week 1: Spec & Schemas**
- Write `canvas.concept` per §4.1
- Define Schemas: Canvas, Shape, Frame, Drawing, ConnectorLabel
- Write Canvas `schema.yaml`
- Write `composition.yaml`

**Week 2–3: Four-language implementations**

*TypeScript:*
- State: `Map<string, CanvasState>` + `Map<string, Map<string, ItemSpatialData>>` + `Map<string, Map<string, ConnectorData>>` + `Map<string, Map<string, Set<string>>>` (groups) + `Map<string, Set<string>>` (hidden surfaced)
- Spatial index: `RBush` (npm) R-tree per canvas. Rebuilt incrementally on add/move/remove. Used by `getItemsInRect`.
- `addItem`: UUID, insert into maps + R-tree. If `is_local`, Outline relationship. If not, Reference link.
- `batchMoveItems`: Iterate, update x/y + R-tree. Single atomic state change.
- `promoteConnector`: Change kind, sync fires Reference/addRef.
- `surfaceExistingReferences`: Get item IDs, sync queries Reference/getRefsBetween, filter hidden.
- Storage: IndexedDB (browser) / SQLite (Node)

*Rust:*
- `HashMap`-based state. `rstar::RTree` for spatial index.
- Handler struct implementing generated `CanvasProtocol` trait.
- Storage: `sled` or `rusqlite`.

*Swift:*
- `[CanvasID: CanvasState]` dictionaries.
- `GKRTree` (GameplayKit) or custom R-tree.
- Protocol conformance. Codable + ObservableObject.
- Storage: SwiftData / Core Data.

*Solidity:*
- `mapping(bytes32 => CanvasState)`, `mapping(bytes32 => mapping(bytes32 => ItemSpatialData))`.
- No R-tree on-chain (gas). Spatial queries off-chain only.
- Events: `ItemAdded`, `ItemMoved`, `ConnectorDrawn`, `ConnectorPromoted`.

**Week 3: Tests** — 30+ unit tests per language covering all actions. Conformance tests from invariants.

**Week 4: Core syncs** — 5 required Canvas↔Linking syncs (§7.1). Integration tests in TypeScript sync engine.

### 11.3 Phase 2: Diagramming concepts (Weeks 5–10)

**Week 5–6: ConnectorPort** — Spec, 4-language implementations (Map/HashMap state, validateConnection logic), 15+ tests.

**Week 6–7: SpatialLayout** — Spec, thin coordination handlers dispatching to PluginRegistry. 4 languages.

**Week 7–8: DiagramNotation** — Spec, 4-language implementations. `validateDiagram` iterates canvas items/connectors against connection_rules.

**Week 8–9: ConstraintAnchor** — Spec, 4-language implementations. Straightforward CRUD.

**Week 9–10: DiagramExport** — Spec, coordination handlers dispatching to format providers.

### 11.4 Phase 3: Layout providers (Weeks 11–16)

**Week 11–12: Hierarchical (Sugiyama) + Tree (Buchheim)**

Sugiyama 5-phase pipeline in all 4 languages:
1. Cycle removal: DFS back-edge reversal. O(V+E).
2. Layer assignment: Longest-path from sources + dummy node insertion. O(V+E).
3. Crossing minimization: Barycenter heuristic, alternating sweeps ×4-8 iterations. O(iter × V × E).
4. Coordinate assignment: Brandes-Köpf. O(V+E).
5. Edge routing through dummy positions.

Buchheim tree layout: O(n) with thread pointers for contour computation. Variable node sizes.

**Week 13–14: Force-directed + Constraint**

Force-directed: Fruchterman-Reingold + Barnes-Hut quadtree. Forces: repel (k²/d), attract (d²/k), center gravity, collision. Simulated annealing. TS: `Float64Array`. Rust: SIMD-friendly, `nalgebra`.

Constraint (WebCOLA): Stress majorization + gradient projection. Reads ConstraintAnchor state.

**Week 15–16: Circular, Grid, Radial + 3 route providers**

### 11.5 Phase 4: Notation & export providers (Weeks 17–20)

**Week 17–18: 12 notation packs** — Each populates DiagramNotation with node types, edge types, connection rules. Key: flowchart (6 node types, 1 edge type), BPMN (~30 types, 3 edge types), concept-map (requires labeled edges), mind-map (tree-only constraint).

**Week 19–20: 9 export providers** — JSON (full round-trip), SVG (embedded JSON comment), PNG (tEXt chunk), PDF, Mermaid text, D2 text, DOT text, BPMN XML, draw.io XML.

### 11.6 Phase 5: Sync wiring (Weeks 21–23)

All remaining syncs from §7.2–7.3. End-to-end integration tests:
- Canvas + ConnectorPort: port validation before connect
- Canvas + SpatialLayout + ConstraintAnchor: constrained layout → batchMoveItems
- Canvas + DiagramNotation: notation rules enforcement
- Canvas + DiagramExport: export → import round-trip
- Canvas + Reference/Backlink: full promote/demote/surface lifecycle
- Performance: 1000-item canvas with force-directed layout

### 11.7 Phase 6: Surface widgets (Weeks 24–30)

**Week 24–26: spatial-canvas-viewport** — The heaviest widget. 5 framework implementations (Next.js, React Native, AppKit, WinUI, GTK) per §10.3.1.

**Week 27–28: canvas-connector + node-palette-panel + connector-port-indicator** — 5 frameworks each.

**Week 29–30: Remaining 6 widgets** — minimap, layout-control, constraint-indicator, export-dialog, notation-badge, properties-panel. Standard form/panel widgets, less complex per-framework.

### 11.8 Phase 7: Derived concepts (Weeks 31–33)

- FlowchartEditor, ConceptMapEditor, MindMapEditor, KnowledgeGraphExplorer
- Their setup syncs, layout defaults, constraint enforcement syncs
- Operational principle tests
- Bind endpoints (REST, GraphQL, CLI, MCP)

### 11.9 Phase 8: Clef Base integration (Weeks 34–36)

- Deploy `schema.yaml` files
- Register all providers with PluginRegistry at install time
- Build notation management admin UI (CRUD for DiagramNotation, powered by FormBuilder)
- Build Canvas decomposition layout (main area + left sidebar frames list + right sidebar properties + bottom toolbar) using existing Component concept
- Concept browser integration: diagramming kit as installable package
- End-to-end acceptance: install kit → create Canvas ContentNode → apply Schema "Canvas" → set flowchart notation → add items → draw connectors → apply layout → export Mermaid → re-import → verify

---

## Part 12: Complete Inventory

### 12.1 New concepts: 6

| # | Concept | Suite | Type |
|---|---|---|---|
| 1 | Canvas | Content | Domain |
| 2 | ConnectorPort | Diagramming | Domain |
| 3 | SpatialLayout | Diagramming | Coordination |
| 4 | DiagramNotation | Diagramming | Domain |
| 5 | DiagramExport | Diagramming | Coordination |
| 6 | ConstraintAnchor | Diagramming | Domain |

### 12.2 New providers: 28

| # | Provider | Concept | Category |
|---|---|---|---|
| 1-7 | Hierarchical, ForceDirected, Tree, Circular, Grid, Radial, Constraint | SpatialLayout | Layout |
| 8-10 | OrthogonalRoute, BezierRoute, PolylineRoute | SpatialLayout | Routing |
| 11-19 | Json, Svg, Png, Pdf, Mermaid, D2, Dot, BpmnXml, DrawioXml | DiagramExport | Export |
| 20-28 | Flowchart, Bpmn, ConceptMap, MindMap, UmlClass, Statechart, C4, Erd, CausalLoop | DiagramNotation | Notation |

### 12.3 New syncs: 17

| # | Sync | Tier |
|---|---|---|
| 1 | canvas-promote-creates-reference | Required |
| 2 | canvas-demote-removes-reference | Required |
| 3 | canvas-surface-queries-references | Required |
| 4 | canvas-remove-local-deletes-contentnode | Required |
| 5 | canvas-remove-referenced-deletes-reference | Required |
| 6 | connector-port-validation | Required |
| 7 | layout-applies-positions | Required |
| 8 | layout-respects-constraints | Required |
| 9 | notation-validates-on-connect | Required |
| 10 | export-dispatches-to-provider | Required |
| 11 | auto-surface-references-on-add | Recommended |
| 12 | notation-auto-apply-schema | Recommended |
| 13 | concept-map-requires-edge-labels | Recommended |
| 14 | canvas-index-items-for-search | Recommended |
| 15 | layout-provider-registers | Integration |
| 16 | export-provider-registers | Integration |
| 17 | notation-provider-registers | Integration |

### 12.4 Derived concepts: 4

FlowchartEditor, ConceptMapEditor, MindMapEditor, KnowledgeGraphExplorer

### 12.5 New Schemas: 5

Canvas (thing), Shape (thing), Frame (thing), Drawing (thing), ConnectorLabel (mixin)

### 12.6 New Surface elements: 13

3 interactor types + 10 widget specs

### 12.7 Implementation artifact counts

| Artifact | Count |
|---|---|
| Concept specs (.concept) | 6 |
| Provider concept specs | 28 |
| Sync files (.sync) | 17 |
| Derived concept specs (.derived) | 4 |
| Schema definitions | 5 |
| schema.yaml files | 2 |
| composition.yaml files | 1 |
| Suite manifests (suite.yaml) | 1 new + 1 modified |
| Interactor type definitions | 3 |
| Widget specs (.widget) | 10 |
| Concept handler implementations (6 concepts × 4 languages) | 24 |
| Provider handler implementations (28 providers × 4 languages) | 112 |
| Widget framework implementations (10 widgets × 5 frameworks) | 50 |
| **Total implementation artifacts** | **~263** |
| **Timeline** | **36 weeks** |
