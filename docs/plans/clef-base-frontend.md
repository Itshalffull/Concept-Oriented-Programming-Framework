# ClefOS Frontend Architecture

**Companion to:** ClefOS Implementation Plan
**Principle:** There is no backend that later gets a frontend. Every concept exists as presentation. The UI is not a layer on top — it IS the system.

---

## 1. The core insight

In ClefOS, there is no distinction between "the data model" and "the UI that shows it." Every concept declares its own interaction patterns. Every entity is always already a rendered thing — a page, a row in a list, a card in a board, a chip in a reference field, a node in a graph, a command in a CLI. The question is never "how do we build a UI for this concept?" but rather "which of this concept's existing presentation modes does the current context call for?"

This is what the Surface pipeline does. The two-step process — Interactor/classify (what kind of interaction is this?) → WidgetResolver/resolve (which concrete widget fits this platform/context?) — means every concept's actions and state already have classified interaction types. The platform adapter (React, Compose, SwiftUI, GTK, Ink, WearCompose) then renders the resolved widget. No concept ever needs a hand-built screen. Screens emerge from composition.

---

## 2. The three fundamental UI primitives

Everything visible in ClefOS reduces to three primitives, each backed by a concept:

### 2.1 The View

A View is a **lens over a set of entities**. It is the primary way users encounter multiple entities. A view has:

- A **source** — a collection (concrete or virtual), a query, a relation traversal, or a taxonomy branch.
- A **display style** — table, list, gallery/card, board/kanban, calendar, timeline, graph, tree/outline, map, dashboard. Each style is a Surface widget that consumes the same data source and renders it differently. Switching styles doesn't change the data — it changes the widget.
- **Columns/fields** — which fields from the entity's schema are visible, in what order, with what formatter. Each column maps to a FieldFormatter that picks a display widget via the Surface pipeline.
- **Sort, filter, group** — each is a config property on the view. ExposedFilters surface these as interactive controls in the view header, so users can adjust without editing the view definition.
- **Row-level display mode** — each row/card/cell uses a DisplayMode to determine how much of the entity to show. A "compact" mode shows title + status. A "full" mode shows all visible fields. A "chip" mode shows just the title as an inline token.

Views are config entities. Creating a view is creating a config entity. Editing a view's columns, filters, sorts, and display style is editing that config entity through its own form mode. The view builder UI is just the form mode of a View config entity — there is no separate "view builder tool."

Every screen that shows a list of things is a View. The "Articles" admin page is a view. The "Recent Tasks" sidebar is a view. A kanban board of tickets is a view. A calendar of events is a view. The concept browser's package listing is a view. The search results page is a view. The taxonomy term listing is a view.

### 2.2 The Entity Page

An entity page is a **single entity rendered through its display mode, form mode, and document mode**. It is the primary way users encounter one entity. The page composes the four regions described in the implementation plan — property, body, view, layout — but the key frontend insight is how these regions actually render:

**Property region.** Each field in the entity's schema renders through its FieldFormatter (read) or FieldWidget (edit). The property region is itself a view-like composition: which fields appear, in what order, with what grouping, is controlled by the bundle's display mode configuration. Notion-style: properties as a panel above the body. Tana-style: properties as indented child nodes in the body. Admin-style: properties as a full-width form. The property region layout is a config entity per bundle per display mode.

**Body region.** The block tree renders through document mode — prose, bullets, numbered, task list, etc. Each block is itself a mini entity page: it has a type (which may carry its own schema and display mode), children (rendered recursively), and potentially embedded views or controls. The body region is an outliner whose nodes can be anything.

**View region.** Embedded views inline within the page — a table of subtasks inside a project page, a board of deals inside an account page, a calendar of events inside a venue page. Each is a View (same as §2.1) configured to scope its source to the current entity's relations. These are inserted via slash commands or layout placement.

**Layout region.** When the page uses layout-first mode, the Component concept arranges zones — columns, sections, tabs, accordions, sidebars — into which blocks, views, controls, and property groups are placed. The layout is a config entity attached to the bundle's display mode.

### 2.3 The Control

A Control is an **interactive element that performs an action**. Buttons, toggles, sliders, dropdowns, form submissions, approval actions, workflow transitions, quick-capture inputs. Controls map directly to concept actions: a "Publish" button triggers the Workflow concept's transition action; an "Approve" button triggers WorkItem's completion action; a "Run Query" button triggers Query's execute action.

Controls appear everywhere — in property regions (workflow state transition buttons), in view toolbars (bulk action buttons), in block content (inline interactive elements via slash commands), in navigation (quick-capture buttons), in watch surfaces (glanceable action buttons). Every control is a Surface widget resolved through the Interactor/WidgetResolver pipeline, meaning it renders natively on every platform.

---

## 3. How screens compose

There are no hand-built screens in ClefOS. Every screen is a composition of views, entity pages, and controls, arranged by the AppShell's navigation structure and the current entity/view context. Here is what users actually see:

### 3.1 The app shell

The outermost container. Owns:

- **Navigation sidebar** — a tree of navigation items, each pointing to either a View (shows a list), an Entity Page (shows a single entity), or a Control (performs an action like "New Article"). The navigation tree is a config entity, editable in the admin UI. Default navigation groups: content types (one entry per bundle, each pointing to a default view of that bundle's entities), taxonomy (one entry per vocabulary), media library, user management, admin (config entity views).
- **Top bar** — global search (powered by SearchIndex), quick-capture (creates a new entity in a default bundle), user menu, notifications (Notification concept rendered as a view of unread notifications).
- **Breadcrumb** — derived from the entity's taxonomy, outline position, and navigation path. Auto-generated via Pathauto.
- **Main content area** — renders either a View or an Entity Page depending on the current route.
- **Context sidebar** — optional, shows related entities (backlinks, relations), comments, version history, or entity metadata. Contents are themselves views scoped to the current entity.

The app shell is the AppShell derived concept. Its layout is a config entity. Different themes can restyle the shell without changing its composition. Different platforms render the shell through their adapter — sidebar becomes a bottom tab bar on mobile, a hamburger menu on watch, a command palette on terminal.

### 3.2 List screens

Every list screen is a View rendered in the main content area. The typical anatomy:

```
┌─────────────────────────────────────────────┐
│ [View Title]                    [+ New] [⚙] │  ← title + controls
│ [Search...] [Status ▾] [Category ▾] [Date]  │  ← exposed filters
│─────────────────────────────────────────────│
│ ☐  Title          Author    Status    Date   │  ← column headers (table style)
│ ☐  Article One    Alice     Published Jan 3  │  ← entity row (compact display mode)
│ ☐  Article Two    Bob       Draft     Jan 5  │
│ ☐  Article Three  Carol     Review    Jan 7  │
│─────────────────────────────────────────────│
│ [◀ 1 2 3 ▶]                   Showing 1-25  │  ← pagination
└─────────────────────────────────────────────┘
```

Switch the view's display style to "board" and the same data renders as:

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Draft   │  │  Review  │  │ Published│
│──────────│  │──────────│  │──────────│
│ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │
│ │Art 2 │ │  │ │Art 3 │ │  │ │Art 1 │ │
│ │Bob   │ │  │ │Carol │ │  │ │Alice │ │
│ └──────┘ │  │ └──────┘ │  │ └──────┘ │
└──────────┘  └──────────┘  └──────────┘
```

Same source, same filters, same entities — different widget. The board widget groups by whatever field the user picks (here, workflow status). The card within the board renders the entity through a "card" display mode. Gallery, calendar, timeline, graph — each is another widget consuming the same View config.

Users toggle styles via the `[⚙]` icon. Under the hood, that changes one property on the View config entity. The view builder (the form mode of the View config entity) lets users configure everything: which fields are columns, which field groups cards, which field maps to calendar dates, etc.

### 3.3 Entity detail screens

When a user clicks into an entity from a list, the main content area renders an Entity Page. The typical anatomy:

```
┌───────────────────────────────────────────────────────────┐
│ [← Back to Articles]     [Edit] [Publish ▾] [⋮ More]     │  ← nav + controls
│═══════════════════════════════════════════════════════════│
│                                                           │
│  # Article One                                            │  ← title (from schema)
│                                                           │
│  Status: Published  Author: Alice  Category: Technology   │  ← property region
│  Tags: AI, Ethics   Created: Jan 3  Modified: Jan 12      │    (compact display mode)
│                                                           │
│───────────────────────────────────────────────────────────│
│                                                           │
│  The field of artificial intelligence has seen rapid...   │  ← body region
│                                                           │    (block tree in prose
│  > Key developments include transformer architectures,    │     document mode)
│  > reinforcement learning from human feedback, and...     │
│                                                           │
│  /query tasks where status = "open" and project = this    │  ← embedded view
│  ┌─────────────────────────────────────────────────┐      │    (View rendered inline
│  │ ☐ Review draft      Alice    Due: Jan 15        │      │     in the body)
│  │ ☐ Add references    Bob      Due: Jan 18        │      │
│  └─────────────────────────────────────────────────┘      │
│                                                           │
│  [[Related: Ethics Framework]] ← backlink reference       │  ← linking
│                                                           │
│───────────────────────────────────────────────────────────│
│  💬 Comments (3)                                          │  ← comment region
│  Alice: "Needs one more review pass"                      │    (Comment concept
│    └─ Bob: "Done, ready to publish"                       │     rendered as threaded
│                                                           │     view)
└───────────────────────────────────────────────────────────┘
```

Everything in this screen is a concept rendering through a display mode:

- The title comes from the entity's "title" property, rendered by its FieldFormatter.
- The property row is the bundle's "compact" display mode choosing which fields to show.
- The body is the block tree in "prose" document mode, each block rendered by its block type's display mode.
- The embedded query is a View widget placed in the body via slash command.
- The `[[backlink]]` is a Reference rendered as an inline chip (the Reference concept's "inline" display mode).
- The comments section is a View of Comment entities scoped to this entity, rendered in threaded list style.
- The "Publish" button is a Control wired to the Workflow concept's transition action.
- The "[⋮ More]" menu collects all available actions on this entity type into a dropdown of Controls.

### 3.4 Edit screens

Clicking "[Edit]" switches the entity page from display modes to form modes. The property region swaps FieldFormatters for FieldWidgets. The body region enters the unified editor (document-first or layout-first mode). The controls change to Save/Cancel/Preview.

```
┌───────────────────────────────────────────────────────────┐
│ [Cancel]              Editing: Article One         [Save] │
│═══════════════════════════════════════════════════════════│
│                                                           │
│  Title:    [Article One                              ]    │  ← FieldWidget: text input
│  Author:   [Alice ▾                                  ]    │  ← FieldWidget: entity ref
│  Category: [Technology ✕                             ]    │  ← FieldWidget: taxonomy
│  Tags:     [AI ✕] [Ethics ✕] [+ Add tag             ]    │  ← FieldWidget: multi-ref
│  Status:   Draft → Review → Published → Archived          │  ← FieldWidget: workflow
│                                                           │
│───────────────────────────────────────────────────────────│
│                                                           │
│  The field of artificial intelligence has seen rapid|      │  ← inline block editor
│                                                           │
│  / ← slash command menu:                                  │
│    ┌──────────────────────┐                               │
│    │ 📝 Text              │                               │
│    │ 📊 Embedded View     │                               │
│    │ 📋 Table             │                               │
│    │ 🔘 Button / Control  │                               │
│    │ 📎 File / Media      │                               │
│    │ 🔗 Block Reference   │                               │
│    │ 📐 Layout Section    │                               │
│    └──────────────────────┘                               │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

Each FieldWidget is resolved by the Surface pipeline. A taxonomy field's Interactor classifies it as "multi-select from constrained set" → WidgetResolver picks a tag-chip input on web, a bottom-sheet multi-picker on mobile, a checkbox list on terminal. The entity reference field classifies as "single-select from entity set" → WidgetResolver picks an autocomplete dropdown on web, a search-select screen on mobile. The platform adapter handles the rest.

The slash command menu is itself a View — a filtered list of available block types and embeddable components, scoped by what the current context allows (AutomationScope controls which controls are available; selection plugins control which entity types can be referenced).

### 3.5 The admin UI

The admin UI is not a separate application. It is the same system with navigation pointing to config entities instead of content entities. Every admin screen is either a View of config entities or an Entity Page for a config entity.

- "Content Types" admin page → View of Bundle config entities, table style.
- Click "Article" → Entity Page for the Article bundle config entity. Property region shows bundle settings. Body region is a page where admins can write documentation/notes about this content type. The "Manage Fields" tab is a View of FieldDefinition config entities scoped to this bundle.
- "Add Field" → Entity Page in form mode for a new FieldDefinition config entity. The form includes FieldType selection (dropdown of registered types), cardinality, validation rules, and default widget/formatter selection.
- "Display Modes" → View of DisplayMode config entities. Each display mode's entity page lets you drag-and-drop field order, set field visibility, and choose formatters per field.
- "Views" admin page → View of View config entities. The view builder is the form mode of a View config entity.
- "Workflows" → View of Workflow config entities. Each workflow's entity page renders the state machine as a graph widget (the Graph concept rendered through Surface).
- "Bind Manifests" → View of BindManifest config entities. Each manifest's entity page is the bind workbench UI (concept selection, grouping, preview).
- "Deploy" → View of DeployPlan config entities. Each plan's entity page shows the deployment DAG, environment config, and rollout status.
- "Packages" → The ConceptBrowser, which is a specialized View over the package registry with preview, install, and dependency resolution flows.

Admin screens get comments too (design discussion on config objects), version history (who changed this config and when), and their own display/form modes. Because config entities are entities, they get all entity capabilities for free.

### 3.6 Dashboards

A dashboard is an entity page whose body region is in layout-first mode, composed primarily of embedded Views and Controls arranged in a grid/column layout via the Component concept.

```
┌──────────────────────────────────────────────────────────┐
│  Dashboard: Project Overview                             │
│══════════════════════════════════════════════════════════│
│                                                          │
│  ┌─────────────────────────┐ ┌────────────────────────┐  │
│  │ Open Tasks         (12) │ │ Burndown Chart         │  │
│  │─────────────────────────│ │────────────────────────│  │
│  │ ☐ Fix login bug    High │ │  ╲                     │  │
│  │ ☐ Update docs     Med  │ │   ╲___                  │  │
│  │ ☐ Review PR       High │ │       ╲___              │  │
│  │ [View all →]            │ │           ╲             │  │
│  └─────────────────────────┘ └────────────────────────┘  │
│                                                          │
│  ┌─────────────────────────┐ ┌────────────────────────┐  │
│  │ Recent Activity         │ │ Team Status             │  │
│  │─────────────────────────│ │────────────────────────│  │
│  │ Alice published Art 1   │ │ Alice    ████░░  80%   │  │
│  │ Bob commented on Art 2  │ │ Bob      ██░░░░  40%   │  │
│  │ Carol created Task 5    │ │ Carol    █████░  90%   │  │
│  └─────────────────────────┘ └────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Each panel is a View (Open Tasks, Recent Activity, Team Status) or a View with a chart formatter (Burndown Chart). The grid arrangement is a layout config entity. Dashboards are not a special feature — they are entity pages with views in them.

---

## 4. The Surface pipeline in action

Every visible element passes through the same pipeline:

```
Concept action/state
    ↓
Interactor/classify
    "What kind of interaction is this?"
    → e.g., "single-select from constrained set"
    → e.g., "rich text editing"
    → e.g., "state-machine transition"
    → e.g., "entity collection display"
    ↓
WidgetResolver/resolve
    "Given this interactor type + platform + context, which widget?"
    → web: <SelectDropdown> / mobile: <BottomSheetPicker> / terminal: <ListPrompt>
    → web: <ProseMirrorEditor> / mobile: <NativeRichText> / watch: <ReadOnlyText>
    → web: <ButtonGroup> / mobile: <ActionSheet> / watch: <SingleButton>
    → web: <DataTable> / mobile: <CardList> / watch: <GlanceList>
    ↓
Platform Adapter
    Renders the resolved widget in the target framework
    → React component / Jetpack Compose composable / SwiftUI view / GTK widget
```

This means:

- A View config entity with display style "table" → Interactor classifies as "tabular entity collection" → WidgetResolver picks DataTable on web, CardList on mobile, GlanceList on watch.
- A taxonomy FieldWidget → Interactor classifies as "multi-select from hierarchical set" → WidgetResolver picks TagChipInput on web, HierarchicalPicker on mobile, not rendered on watch.
- A Workflow transition Control → Interactor classifies as "state-machine transition with authorization" → WidgetResolver picks ButtonGroup (showing valid transitions) on web, ActionSheet on mobile, single primary action on watch.
- A block of type "code" → Interactor classifies as "syntax-highlighted text display" → WidgetResolver picks CodeMirror on web, monospace text on mobile, not rendered on watch.

No concept ever says "render a `<div>` with these CSS classes." Concepts declare what they ARE; Surface figures out how they LOOK on each platform.

---

## 5. Display mode configurations

Display modes are where the abstract pipeline meets concrete layout decisions. Each bundle × display mode combination is a config entity that specifies:

**Which fields are visible.** An Article in "full" display mode shows all fields. In "card" mode, just title, image, and date. In "chip" mode, just title. In "table-row" mode, title, author, status, date.

**What order and grouping.** Fields can be grouped into sections ("Metadata," "Classification," "Relations"). Groups can be collapsed, tabbed, or inline.

**Which formatter per field.** The "author" field might render as a full user card in "full" mode, a linked name in "table-row" mode, and nothing in "chip" mode. The formatter is a FieldFormatter config per field per display mode.

**What layout.** "Full" mode uses a two-column layout (main + sidebar). "Card" mode uses a vertical stack. "Table-row" mode uses a horizontal flex. The layout is a Component config attached to the display mode.

**What the body looks like.** The document mode (prose, bullets, kanban, etc.) is set per display mode. A "full page" display mode uses prose. A "board item" display mode hides the body entirely. A "outline view" display mode uses bullets.

This is why there are no hand-built screens. Adding a new field to a bundle makes it appear in all display modes that include it. Adding a new display mode creates a new way to see the entity everywhere views reference it. The system is self-describing.

---

## 6. How specific features exist as presentation

### 6.1 The concept browser

The ConceptBrowser is a specialized entity page with:

- **Property region:** filters for package type (concept, suite, widget, theme, starter app), platform compatibility, installed/available status.
- **Body region:** a View of available packages from the registry, displayed as a gallery of cards. Each card shows the package name, description, icon, install status, compatibility indicators.
- **Detail panel:** clicking a package opens its entity page — a full description (body region), dependency list (embedded view of related packages), what it adds (embedded view of the concepts/widgets/syncs it introduces), preview of generated UI, and an Install control.
- **Install flow:** the Install control triggers the KitManager's resolution action, which produces an InstallPlan entity. The InstallPlan's entity page shows what will be added/changed, dependency tree, and a Confirm control.

All of this is views, entity pages, and controls. The concept browser is not a special UI — it is config entities with good display modes.

### 6.2 The bind workbench

A BindManifest config entity's form mode IS the bind workbench:

- **Concept selector:** a View of available concepts (filterable, searchable) with checkboxes for inclusion in the manifest.
- **Grouping editor:** drag-and-drop tree of how selected concepts organize into API resources / CLI command trees / MCP tool groups / GraphQL namespaces. This is a View of Grouping config entities in tree display style, with drag-and-drop enabled by the tree widget's edit mode.
- **Per-concept settings:** clicking a concept in the grouping tree opens its Projection config entity in form mode — auth requirements, rate limits, pagination, field visibility, action exposure.
- **Preview panel:** a live-updating read-only view of the generated output for each target (CLI help text, OpenAPI spec snippet, GraphQL schema snippet, MCP tool definition). These are FieldFormatters for the BindManifest's generated output fields.
- **Generate control:** a button that triggers the Bind pipeline (Projection → ApiSurface → Generator → Target → Emitter).

### 6.3 The Score IDE

Score's UI is a set of specialized Views and entity pages:

- **Concept graph:** a View of all concepts in graph display style. Nodes are concepts; edges are syncs. The Graph concept provides the data; Surface's graph/canvas widget renders it. Clicking a node navigates to the concept's entity page (either the .concept spec file view or the admin management UI — the dual navigation toggle is a Control).
- **Sync chain viewer:** when you trigger an action, FlowTrace produces a tree of sync invocations. This is a View of FlowTrace entries in tree display style, with each node expandable to show the data that flowed through it.
- **AST explorer:** a View of SyntaxTree/DefinitionUnit entities for a given file, in tree display style. Clicking a node highlights the source range and shows the Symbol's scope and references.

### 6.4 The view builder

The view builder is the form mode of a View config entity:

- **Source selector:** choose collection, query, or relation traversal. If query, a sub-form for building the query (field conditions, logical operators, sort, limit).
- **Style selector:** radio/tab group for table/list/gallery/board/calendar/timeline/graph.
- **Field configurator:** a sortable list of the entity's schema fields. Each field row has: visible toggle, column width (for table), formatter selector (dropdown of available FieldFormatters for this field type), label override.
- **Filter configurator:** add filters on fields, choose whether each is exposed (shows as a UI control in the view header) or fixed.
- **Group/sort configurator:** pick grouping field (for board: which field makes columns; for calendar: which date field), sort fields and directions.
- **Live preview:** the bottom half of the view builder shows the view rendered with current settings, updating as you change config.

### 6.5 The workflow editor

A Workflow config entity's form mode:

- **State list:** a View of states as draggable cards (or a graph in visual mode, with states as nodes and transitions as directed edges).
- **Transition editor:** clicking an edge/arrow opens the transition's config — source state, target state, required permissions, triggered actions (AutomationRule refs).
- **Preview:** a summary showing "users with role X can do transitions Y and Z from state A."

### 6.6 The deployment dashboard

A DeployPlan config entity's entity page:

- **Property region:** target environment, runtime provider, IaC provider, current status.
- **Body region:** documentation/notes about this deployment.
- **Embedded views:** build history (View of Artifact entities), health checks (View of Health entities), rollout progress (View of Rollout entities with a progress-bar formatter), telemetry (View of Telemetry entities with chart formatters).
- **Controls:** Deploy, Rollback, Promote to Production, Scale.

---

## 7. Cross-cutting presentation patterns

### 7.1 Inline editing

Any field rendered in a display mode can be made inline-editable. Clicking the field value swaps the FieldFormatter for the FieldWidget in place, saves on blur/enter. This is controlled by a per-field config on the display mode: "inline editable: yes/no." The Surface pipeline handles the swap — the Interactor reclassifies from "display" to "edit" for that field, and WidgetResolver picks the appropriate input widget.

### 7.2 Bulk operations

Any View in table or list style can enable bulk selection (checkboxes). The view toolbar shows available bulk actions — Controls scoped to the entity type. "Publish selected," "Delete selected," "Change category," "Assign to." Bulk actions are AutomationRule-compatible: the same conditions and scoping apply.

### 7.3 Contextual sidebars

Any entity page can show a context sidebar with:

- **Backlinks** — a View of entities that reference this one, filtered by relation type.
- **Comments** — the Comment view for this entity.
- **Version history** — a View of Version entities for this entity, with diff controls.
- **Relations** — a View of related entities grouped by relation type.
- **Metadata** — entity system info (created, modified, author, revision count).

Each sidebar section is a View or a display mode. Which sections appear is configurable per bundle per display mode.

### 7.4 Command palette

A global search/action interface (Cmd+K / Ctrl+K) that:

- **Searches entities** via SearchIndex — results rendered as a compact View.
- **Lists available actions** via the Bind manifest — filtered by current context and permissions.
- **Navigates** to any entity page or view.
- **Quick-creates** entities in any bundle.

The command palette is a Control backed by SearchIndex + BindManifest + EntityReflection. On terminal platforms, this IS the primary navigation. On watch, it's a voice command interface.

### 7.5 Notifications as views

The Notification concept produces notification entities. The notification center is a View of notifications — unread first, grouped by source entity, with "mark read" and "go to entity" Controls. On mobile, notifications are native push. On watch, they're wrist alerts. On web, they're a dropdown. Same concept, different platform widget.

### 7.6 Quick capture

A floating "+" button (web), a widget (mobile home screen), a voice command (watch), or a shortcut key (desktop) that creates a new entity in a default bundle with minimal input. The quick capture form is a form mode called "quick" — showing only title and one body block. The entity enters the progressive formalization pipeline: captured now, structured later.

---

## 8. Platform-specific presentation rules

The same concept graph renders differently per platform, not because of special-case code but because WidgetResolver picks different widgets and display modes activate different field subsets.

### 8.1 Web (Next.js/React)

Full experience. All views, all display modes, all form modes, all document modes. Rich text editing via ProseMirror-based block editor. Drag-and-drop in layouts, views, and outlines. Full admin UI, Score IDE, bind workbench, concept browser.

### 8.2 Mobile (Android/iOS)

Optimized navigation (bottom tabs replacing sidebar, swipe gestures, pull-to-refresh). Views default to card/list style instead of table (tables are available but scroll horizontally). Entity pages use a stacked layout (properties → body → views → comments, vertical scroll). Form modes use platform-native inputs (date pickers, photo capture, location services). Quick capture via home screen widget and share-sheet integration. Offline indicators and sync status visible in the app shell.

### 8.3 Desktop (Linux/Windows/macOS)

Similar to web but with platform-native widgets (native file pickers, native notifications, system tray, keyboard shortcuts). Multi-window support — open multiple entity pages side by side. Local-first with background sync indicator.

### 8.4 Watch

Read-only glances: entity pages render in a "watch" display mode showing only title + 2-3 key fields. Views render as scrollable short lists. Controls limited to primary actions (approve, dismiss, quick capture via voice). No editing, no admin, no body content.

### 8.5 Terminal (CLI via Ink)

Views render as formatted tables (ASCII borders, column alignment). Entity pages render as key-value pairs. Form modes use interactive prompts (text input, select, multi-select, confirm). The command palette IS the interface. Score IDE renders as a tree view with search.

---

## 9. Theme system

Themes control visual presentation without changing composition or interaction. A theme config entity specifies:

- **Color palette** — primary, secondary, accent, background, surface, text colors. Applied to Surface widgets via CSS custom properties (web), resource values (mobile), or platform equivalents.
- **Typography** — font families, sizes, weights, line heights per semantic role (heading, body, label, code, caption).
- **Spacing** — base unit and scale for padding, margins, gaps.
- **Component overrides** — per-widget visual tweaks (border radius, shadow, density).
- **Display mode defaults** — which display modes a theme prefers (a "dense" theme defaults to compact display modes; a "spacious" theme defaults to full display modes).
- **Dark/light variants** — per-palette, switchable by user preference.

Themes are installable packages. A "Material" theme renders everything in Material Design. A "Monospace" theme gives a terminal aesthetic. A "Editorial" theme optimizes for long-form reading. The same concept graph, the same views, the same entity pages — different visual language.

---

## 10. The recursive insight

The deepest frontend insight is that the admin UI for configuring how things display is itself displayed using the same system it configures.

The display mode config entity has its own display mode. The View config entity is browsable via a View. The FieldWidget config is edited via a FieldWidget. The theme config entity is styled by the current theme.

This means there is exactly one rendering system, exactly one composition model, exactly one editing experience. Learning how to use ClefOS as an end user and learning how to configure ClefOS as an admin are the same skill at different abstraction levels. And because Bind generates CLI/MCP/API interfaces for config entities just as it does for content entities, every configuration action available in the admin UI is also available programmatically — to scripts, to AI agents, to external tools.

There is no frontend and backend. There are concepts, and concepts are always already presentation.
