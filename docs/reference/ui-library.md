# UI patterns and auto-generation blueprints across 25 software domains

**A UI framework that auto-generates interfaces needs a canonical mapping from data schema to widgets, views, and interactions for every major software domain.** This report catalogs the standard widgets, layout patterns, interaction models, accessibility requirements, and best reference implementations across 25 domains grouped into five categories — from block editors to ARIA widget specifications. The synthesis provides a unified schema-to-widget pipeline drawing from CAMELEON, Metawidget, JSON Forms, and headless UI primitives. The final section maps these research foundations to Clef Surface's concrete implementation — the two-step classify/resolve pipeline, `.widget` and `.theme` spec formats, and the 29-concept architecture that turns concept specs into accessible, framework-agnostic interfaces.

---

## GROUP 1: Content and structure

### Block editors treat every element as a discrete, draggable node

Modern block editors (Notion, TipTap/ProseMirror, Slate, BlockNote) decompose documents into typed blocks — paragraph, heading (H1–H6), bulleted list, numbered list, checklist, quote, code block, table, image, embed, divider, callout, and toggle. Each block has an `id`, `type`, `props` (color, alignment), `content` (inline text with marks), and `children` (nested blocks).

**Standard interaction patterns** have converged across all major editors. The **slash command** (`/`) opens a filterable palette of block types. A **drag handle** (`⋮⋮`) appears on hover to the left of each block, enabling reorder via drag-and-drop and opening a context menu (Turn Into, Duplicate, Delete, Color). **Floating/bubble toolbars** appear on text selection for inline formatting (bold, italic, code, link). Markdown shortcuts (`**bold**`, `*italic*`) provide keyboard-first input. **Block selection** via Cmd+A (current block, then all) or margin-drag enables batch operations.

Accessibility requires the editor area to use `role="textbox"` with `aria-multiline="true"` and `contenteditable`. Toolbars follow the **WAI-ARIA toolbar pattern**: one Tab stop with arrow-key roving tabindex, `aria-pressed` on toggle buttons. Icon-only buttons need `aria-label`. Focus must be programmatically movable between text area and toolbar.

**Auto-generatable components**: block palette/slash menu from registered block types, formatting toolbar from registered marks, block context menu with standard actions, block type dropdown for conversion. Reference implementations: **BlockNote** (MIT, React/ProseMirror), **TipTap** (MIT, framework-agnostic), **Novel** (TipTap + AI completions), **Plate** (Slate-based plugin system).

### Outliners reduce everything to indented, zoomable bullets

Workflowy, Roam, Logseq, and Dynalist use a single paradigm: every piece of content is a bullet in an infinitely nestable tree. The core widgets are **bullet items** (contenteditable text with unique IDs), **collapse/expand toggles** (triangle chevrons on items with children), **breadcrumb trails** (clickable path showing zoom hierarchy), and **zoom-in views** (clicking a bullet makes it the root, showing only its subtree).

The keyboard interaction model is deeply standardized: **Tab/Shift+Tab** for indent/outdent, **Enter** creates a sibling, **Backspace** at line start merges with previous bullet, **Alt+Shift+↑/↓** moves bullets among siblings, **Ctrl+Space** toggles fold/unfold. Workflowy's zoom model makes each bullet a navigable URL fragment — clicking any bullet's dot "zooms in," and browser-style **Alt+←/→** navigates zoom history. Search scopes to the current zoom level.

The ARIA pattern for outliners is `role="tree"` with `role="treeitem"` on each bullet, `aria-expanded` for collapse state, and keyboard navigation via Arrow keys (Up/Down to move, Left to collapse/go to parent, Right to expand/enter children).

**Auto-generatable components**: hierarchical list with indent/outdent, recursive collapse/expand, zoom navigation with breadcrumbs, drag-and-drop reorder, multi-select mode. Key references: **Workflowy** (canonical), **Roam** (outliner + bidirectional links), **Obsidian Outliner Plugin** (open-source).

### Property panels map schema types to click-to-edit widgets

Notion's property system is the richest reference. Properties appear in four contexts: **database table columns**, **page property rows** below the title, a **collapsible sidebar panel** (Cmd+Shift+\\), and **pinned properties** (up to 4 shown horizontally under the title). Each property type maps to a specific widget:

- **Text** → inline text input; **Number** → numeric input with format selector (integer, currency, percent); **Select/Multi-select** → popover with type-ahead search, colored pills, inline creation; **Date** → calendar popover with range, time, reminder options; **Person** → user search with avatars; **Relation** → page search targeting another database; **Rollup** → read-only aggregate; **Checkbox** → toggle; **URL/Email/Phone** → formatted text input; **Formula** → expression editor; **Status** → grouped select (To-do/In Progress/Done); **Created/Edited time/by** → auto-generated read-only; **Unique ID** → auto-incremented with optional prefix.

The universal interaction pattern is **click-to-edit inline**: values display as static text until clicked, at which point a type-appropriate editor appears (text input, popover picker, calendar). Properties are reorderable via drag handle and configurable for visibility (always show, hide when empty, panel-only).

Tana's approach differs: fields are child nodes prefixed with `>`, defined in **supertag templates** (analogous to schemas). Supertags support **inheritance** — `#Author extends #Person` inherits all parent fields. Field types include **Options from Supertag**, which turns instances of another supertag into dropdown options, creating typed relations.

**Auto-generatable**: property row renderer per type, collapsible section containers, sidebar toggle panel, empty-state "Add a property" button, type-appropriate validators.

### Schema builders let users define field types and validation

The schema/type builder pattern appears in Airtable's field configurator, Notion's database property manager, Tana's supertag editor, and Django admin. The core widgets are a **field type selector dropdown** (20+ types with icons), **field name input** (inline-editable), **type-specific configuration panels** (number format, select option editor with color swatches, relation target selector), and **validation toggles** (required, unique, default values).

Airtable's interaction flow is representative: click column header → "Customize field type" → type selector reveals type-specific options inline → "Save" commits (with data-loss warning on type changes). Notion groups properties by category in its type selector. Tana's supertag editor adds **field characteristics** (Template fields always shown, Optional hidden by default, Ad-hoc manually added per instance) and **schema-level field definitions** reusable across supertags.

Django admin auto-generates forms from model metadata, demonstrating the server-side pattern: `ModelAdmin.fieldsets` groups fields into collapsible sections, `TabularInline`/`StackedInline` handle related models, and `list_display`/`list_filter`/`search_fields` configure list views.

**Auto-generatable**: schema editor with field list (add/remove/reorder by drag), type selector dropdown, per-type config panels that adapt based on selected type, relation target autocomplete, field visibility toggles, grouped collapsible fieldsets.

### Embedded references use trigger characters and bidirectional links

Wikilinks, @mentions, and block references share a common interaction model: **typing a trigger character** (`[[`, `@`, `((`, `#`, `:`) opens a **floating autocomplete popup** with fuzzy-filtered suggestions, arrow-key navigation, and Enter/Tab to select. The result is an **inline reference** rendered as a styled chip, link, or token.

Obsidian's `[[wikilinks]]` support heading links (`[[Note#Heading]]`), block links (`[[Note#^block-id]]`), display aliases (`[[Note|Display]]`), and transclusion (`![[Note]]` embeds content inline). Roam adds **block references** (`((block-uid))`) that transclude individual blocks. Notion's `@mentions` group suggestions by type: dates (with reminders), people (triggering notifications), and page links (auto-updating on rename).

**Backlink panels** are the bidirectional counterpart. Obsidian shows incoming references in a right sidebar with surrounding context. Roam shows **Linked References** (explicit `[[links]]` with parent breadcrumbs for context) and **Unlinked References** (text matches not yet linked, with one-click conversion). Hover preview cards (Ctrl/Cmd+hover) show note content in a floating popup.

The ARIA pattern follows combobox: `role="combobox"` on the input, `aria-expanded`, `aria-autocomplete="list"`, `aria-activedescendant` tracking the highlighted suggestion. Results use `role="listbox"` with `role="option"`.

**Auto-generatable**: mention input with configurable triggers and data sources, grouped suggestion dropdown, inline reference rendering (chip with icon), backlink panel, hover preview cards, unlinked mention scanner.

### Canvas interfaces operate on an infinite 2D spatial plane

Miro, FigJam, Obsidian Canvas, and tldraw provide **infinite canvas** environments with core widgets: sticky notes, geometric shapes (rectangle, ellipse, diamond, arrow), connectors/edges with routing, text nodes, frames/sections as grouping containers, and embedded content (images, iframes, linked documents).

Toolbars typically sit at the bottom or left side with tool selection: **Select** (V), **Hand/Pan** (H/Space+drag), **Draw** (D), **Eraser** (E), **Text** (T), **Sticky Note** (S/N), **Shape** (R/O), **Arrow/Connector** (A/C), **Frame** (F). Interaction patterns include click-drag to create shapes, click-drag between shapes to connect, Shift+click for multi-select, marquee selection on empty space, scroll-wheel zoom, minimap navigation, and grid snapping with alignment guides.

**tldraw** is the leading open-source reference (**~44K GitHub stars**). Its architecture separates `@tldraw/editor` (headless canvas engine) from the default UI package. Shapes are React components with typed schemas. Tools are state machines extending `StateNode`. Version 4.0 achieved **WCAG 2.2 AA compliance** with screen reader support, keyboard navigation, and motion controls — a significant milestone given the inherent spatial/visual nature of canvas UIs.

**Auto-generatable**: canvas with configurable node types, connector system with anchor points, bottom toolbar with tool selection, zoom/pan controls with minimap, property inspector sidebar for selected elements, grid snapping and alignment guides, selection system (single/multi/marquee), group/frame containers, export (PNG, SVG, JSON).

---

## GROUP 2: Query, views, and data

### Query builders compose filter rows with type-adaptive inputs

Visual query builders (Notion, Drupal Views, Retool, jQuery QueryBuilder) share a stacked architecture: each **filter row** contains a **field selector** (dropdown of schema fields), **operator dropdown** (context-sensitive per field type — text gets contains/equals, numbers get >/</between, dates get before/after/relative), a **value input** (adapts to field type: text, date picker, multi-select), and a **remove button** (×). Rows are connected by clickable **AND/OR toggles** and can be nested into **filter group containers** for complex logic like `(A AND B) OR (C AND D)`.

Notion supports **3 levels of nesting** in its filter popover. Drupal Views acts as a full visual SQL builder with sections for Fields (SELECT), Filter Criteria (WHERE), Sort Criteria (ORDER BY), and Relationships (JOIN), and uniquely supports **"exposed" filters** that render as end-user form inputs. jQuery QueryBuilder is the best open-source reference, supporting unlimited nesting, custom widgets, rule/group cloning, drag-reorder, and output to JSON/SQL/MongoDB.

Interaction follows a predictable flow: add filter → field dropdown auto-opens → select field → operator auto-selected → value input focused → results update live. All filter controls must be keyboard-navigable with ARIA labels on each row and `aria-live` announcements when filters change.

**Auto-generatable from schema**: filter rows with type-adaptive value inputs, AND/OR group containers with nesting, sort builder with drag reorder, group-by selector with aggregate options, JSON/SQL serialization, exposed filter form rendering.

### Search interfaces combine free text with faceted refinement

Search UIs have two major patterns. **Faceted search** (Algolia InstantSearch, Kibana) uses a two-column layout: a left facet sidebar with refinement widgets and a right results area. Facet types map to data types: **enums → checkbox refinement lists** with count badges, **numbers → range sliders**, **dates → date range pickers**, **hierarchies → nested menu trees**. Algolia's `dynamicWidgets` automatically mounts relevant facets based on results.

**Command palettes** (VS Code Cmd+Shift+P, Raycast, cmdk) use a modal overlay with search input → categorized scrollable results → keyboard-first navigation. VS Code's `>` prefix toggles command mode vs. file search. Key patterns include fuzzy/substring matching, recent items at top, keyboard shortcut hints per item, and context-aware suggestions. **cmdk** (React) is the leading open-source implementation.

The search input uses `role="searchbox"`. Facets render as fieldsets with legends. Active filters display as a horizontal row of removable chips. Result lists use `aria-live` for dynamic updates. Command palettes follow `role="dialog"` with `aria-modal`, using the listbox pattern with `aria-activedescendant` for keyboard selection.

**Auto-generatable from schema**: search input with debounce, facet panels from field metadata (enum → checkbox list, number → range slider, date → date picker), result list/grid with highlighted matches, active refinement bar, pagination, command palette with registered actions.

### View switchers present the same data through different lenses

Notion and Airtable define the standard view types: **Table** (sortable columns, resizable, inline editing, footer aggregations), **Board/Kanban** (columns grouped by status/select field, draggable cards), **Calendar** (monthly/weekly grid, date-property-driven placement), **Timeline/Gantt** (horizontal bars on time axis with dependency arrows), **Gallery** (card grid with cover images), **List** (minimal text rows), and **Chart** (bar/line/pie from data).

The view switcher UI uses **tabs** at the top of the database, each representing a named view with independent configuration (type, filters, sorts, grouping, visible fields). A **"+" button** adds new views. All views share the same underlying data store — a view is a **configuration object** containing layout type, visible fields, filter/sort/group rules, and type-specific settings (e.g., "Calendar by" date field, Kanban grouping field, timeline scale).

View switcher tabs use `role="tablist"` with `role="tab"` per view. Kanban boards need keyboard alternatives for drag-and-drop (arrow keys to move cards between columns). Tables require proper `<table>` semantics with `aria-sort` on sortable headers.

**Auto-generatable from schema**: view type selector with tab bar, auto-detection of applicable views (Status field → Board, Date field → Calendar/Timeline, Attachment field → Gallery), per-view configuration panels, shared data layer, type-specific renderers.

### Graph visualizations use force-directed layouts with interactive filtering

Graph views (Obsidian, Neo4j Bloom, D3) render **nodes** as colored circles (sized by connection count, colored by type) connected by **edges** (optional arrows, labels, variable thickness). Supporting widgets include a **filter panel** (search input, type toggles, color group definitions), **display controls** (sliders for node size, link thickness, text fade threshold), **force controls** (center force, repel force, link distance), and optionally a **minimap** and **detail panel** for selected nodes.

Obsidian's graph view offers two modes: **Global** (entire vault) and **Local** (connected to active note, with a **depth slider** controlling hop count). Nodes can be filtered by tag, type, or search query, and **color groups** can be defined by search criteria. The **animate feature** shows nodes appearing chronologically. Neo4j Bloom adds **near-natural-language queries** ("Person who KNOWS Person" → Cypher) and supports hierarchical, geographic, and force-directed layouts.

Graph visualizations are inherently challenging for accessibility. Alternative representations (tree views, connection lists) should be provided for screen readers. Zoom controls must be keyboard-accessible (+/- keys). High contrast mode and colorblind-safe palettes are essential.

**Auto-generatable**: force-directed layout from node/edge data, filter panel with search and type toggles, display controls, color grouping configuration, detail panel for selected nodes, local vs. global modes with depth slider.

### Formula editors need syntax highlighting, autocomplete, and live preview

Formula editors (Notion, Excel, Coda) share four core components: a **formula input** with syntax highlighting and bracket matching, an **autocomplete dropdown** (triggered on typing, showing properties, functions, operators), a **function browser** (categorized panel: Math, Date, Text, Logic, List), and a **live preview** showing the result for the current record or an error message.

Notion's Formula Editor 2.0 renders property references as **styled tokens** (grey pills) rather than raw `prop()` calls, uses dot notation for chaining, and offers AI-generated formulas from natural language descriptions. Excel's formula bar provides **colored cell reference highlighting** — each referenced range gets a distinct color in both formula and grid. Coda uses column-level formulas with `@` mention syntax for variables.

The autocomplete follows the ARIA combobox pattern (`role="listbox"`, `aria-activedescendant`). Error messages link to the editor via `aria-describedby`. Property tokens must be screen-reader-readable (announcing name and type). Live preview uses `aria-live` for dynamic result announcements.

**Auto-generatable**: formula input with syntax highlighting from schema-defined grammar, autocomplete from schema fields + function library, function reference panel, property token rendering, live preview bound to current record, type-checking and error display.

---

## GROUP 3: Automation and workflow

### Workflow editors visualize states, transitions, and execution

Workflow UIs span three paradigms. **Node-graph editors** (n8n, Node-RED, Make.com) use a free-form canvas with typed nodes connected by edges — input ports on the left, output ports on the right. n8n flows left-to-right with a side panel for node configuration. **DAG visualizations** (GitHub Actions) render jobs as status-colored boxes with dependency lines. **Kanban boards** (Linear, Trello, Jira) are simplified state machines where columns represent states and cards move between them via drag-and-drop.

Drupal's Workflows module provides the cleanest state machine model: named states (Draft, Published, Archived) with explicit transitions ("Publish": Draft→Published, "Archive": Published→Archived). Each transition gets its own permission, enabling **role-based access per state change**. The content edit form renders a dropdown showing only valid transitions for the current state and user role.

Key interaction patterns: **drag-to-connect** output→input ports, **click node to configure** in side panel, **add node** via "+" button with searchable catalog, **execute/test individual nodes** with real data (n8n). The canvas requires keyboard navigation (Tab through nodes, Enter to select, arrow keys to navigate) and should not rely on color alone for execution status.

**Auto-generatable**: state list/table (name, flags, order), transition list (from→to, label, conditions, permissions), visual DAG from state/transition definitions, canvas editor based on React Flow, state create/edit forms.

### Automation rule builders chain triggers, conditions, and actions

Zapier, n8n, and Make.com represent three layout archetypes. **Zapier** uses a **linear step sequence** (vertical top-to-bottom), with each step as a card: trigger → actions. The "Paths" feature enables conditional branching. **n8n** uses a **node-graph canvas** with 400+ integrations, where nodes connect freely and can loop or merge. **Make.com** uses **circular module icons** on a canvas connected by route lines with filter conditions.

Core widgets include: **trigger selector** (app + event type with icon), **action configurator** (app + action type with field mapping), **condition builder** (field + operator + value rows with AND/OR), **branching logic** (if/then/else paths), and **field mapper** (dynamic insertion of output fields from previous steps into current step inputs). The test/preview panel shows "Data In" and "Data Out" per step.

**Auto-generation targets**: trigger config forms from API schemas, field mapping UI from input/output schemas, condition builder with type-appropriate operators, test data from sample responses, error handling configuration, template library from common patterns.

### Notification centers pair event feeds with preference matrices

Notification center anatomy: **bell icon with unread badge** → **dropdown panel** (200–400px wide) containing notification items (icon/avatar, title, description, relative timestamp, action buttons, unread dot) organized by date groups ("Today," "Yesterday"). GitHub adds **filter tabs** (Inbox, Saved, Done) and repository grouping. Full-page views at `/notifications` add advanced filtering and pagination.

**Notification preference matrices** are grids where **rows = event types** (grouped by category: Activity, Updates, Security) and **columns = delivery channels** (Email, Push, In-App, SMS, Slack). Each cell is a checkbox/toggle. Section headers include "Select all" for bulk operations. Critical notifications (security alerts) use **locked checkboxes** that can't be disabled. Frequency options (Instant, Daily digest, Weekly) may appear per category.

Accessibility requires ARIA live regions for new notifications, proper focus management (focus moves to panel on open, returns to bell on close), and WCAG 2.2.3 compliance: users must be able to manage non-critical notifications to reduce cognitive load.

**Auto-generatable**: notification list with date grouping, notification item template (configurable icon/title/body/timestamp/actions), preference matrix from event types × channels config, toast manager with queue, badge component.

### Queue monitors display throughput, failures, and job details

Sidekiq, Bull Board, Celery Flower, and Laravel Horizon share a dashboard layout: **stat cards** at top (Processed, Failed, Busy, Enqueued, Scheduled, Retries, Default Latency), **time-series charts** in the middle (throughput, queue depth, failure rate), and a **filterable job table** below (ID, name, queue, status badge, arguments, timestamps, runtime, retry/delete actions).

Tab-based navigation separates concerns: Sidekiq uses Dashboard / Busy / Queues / Retries / Scheduled / Dead tabs. Job detail views show full payload JSON, execution timeline, error backtrace, and retry history. Key metrics include **throughput** (jobs/sec), **latency** (enqueue-to-start time), **queue depth**, **failure rate**, and **p95/p99 runtime**.

Status badges must include text labels alongside colors. Charts should offer data-table alternatives for screen readers. Real-time updates use `aria-live` for status changes.

**Auto-generatable**: stat card row from queue metrics, configurable chart panel, sortable/filterable job table from job model, job detail view from payload schema, queue list table, worker list table, failed job view with retry/delete actions, dispatch job form.

---

## GROUP 4: Infrastructure and admin

### Permission editors use matrices, trees, and policy simulators

RBAC UIs center on the **permission matrix**: a grid with **roles as columns** and **resources/actions as rows**, checkboxes at intersections. AWS IAM provides the most sophisticated implementation with a dual-mode **Visual Editor** (point-and-click service → action checkboxes grouped by access level: List/Read/Write/Permissions) and **JSON Policy Editor** with syntax validation. The **IAM Policy Simulator** lets admins test "Can user X perform action Y?" before deployment.

Simpler implementations (GitHub, Django admin) use role hierarchies (Read/Triage/Write/Maintain/Admin) with a straightforward checkbox grid per model (add/change/delete/view). Tree-based permission hierarchies handle nested resources (Organization → Project → Resource) with indentation and checkboxes at each level, including **indeterminate state** when some children are checked.

The grid uses WAI-ARIA `role="grid"` with arrow-key navigation between cells, `role="gridcell"`, and `aria-checked` including "mixed" for inherited permissions. Tree views follow the ARIA tree pattern.

**Auto-generatable**: permission matrix grid (roles × resources × actions), role CRUD forms with permission selector, user-role assignment table with search, policy editor (visual + JSON), effective permissions summary view, role comparison (side-by-side).

### Plugin marketplaces follow a card-grid discovery pattern

Plugin browsers (WordPress, VS Code Extensions, Figma Community) use a **card grid** as the primary browse/discover view. Each card contains: icon/thumbnail, name, author, short description, star rating, install count, and install button. The **search/filter bar** combines text search with category dropdown and sort options (Popular/Trending/New/Top Rated).

The **detail page** follows a consistent template: hero section (icon + name + stats + install button) → tabbed content (Description, Screenshots, Reviews, Changelog, Support). The **installed plugins view** is a table with status (Active/Inactive), version, update indicator, and actions (Activate/Deactivate/Delete/Settings). Install buttons cycle through states: Install → Installing... → Installed/Enable → Enabled.

Rating displays need `aria-label="4.5 out of 5 stars based on 230 ratings"`. Install state changes use `aria-live`. Image carousels need accessible controls with alt text.

**Auto-generatable**: plugin card component, card grid/list toggle with sort/filter, plugin detail page template, search with category facets, installed plugins table, plugin settings form generator.

### Cache dashboards and config diff viewers serve operational needs

Cache dashboards (RedisInsight, Grafana Redis, Datadog) display: **hit/miss rate gauges** (target >95%), **time-series charts** (hits vs. misses over time), **cache key browsers** (searchable tree view with key name, type, TTL, size), **memory usage bars**, and **flush/clear buttons** with confirmation dialogs. RedisInsight adds a slow-log inspector and CLI interface.

Config sync diff viewers (GitHub PR diffs, Drupal Configuration Sync, diff2html) offer two modes: **side-by-side diff** (old left, new right, synchronized scrolling) and **unified diff** (single column with `-`/`+` lines). Both support **character-level inline highlighting**, **hunk separators** with expand controls, and a **file list panel** with status badges and +/- counts. Drupal's Config Sync lists all configuration items differing between sync directory and active config, with per-item "View differences" links.

**Auto-generatable**: cache metric KPI cards + time-series charts, key browser with search + TTL display, cache flush controls, side-by-side and unified diff viewer components, config change summary table, import/export panel.

### File browsers combine drag-and-drop upload with multi-view browsing

File/media browsers (WordPress Media Library, Google Drive, Dropbox) provide a **drag-and-drop upload zone** (dashed border, "Drag files here or click to upload," states: default/hover/uploading/error/success), **thumbnail grid** (responsive cards with preview, filename, type icon), **list view** (sortable table with columns), a **file detail sidebar** (large preview, editable metadata, alt text for images, actions), and **breadcrumb navigation** for folder hierarchy.

Google Drive's interaction model is canonical: click to select (highlight), Shift+click for range select, Ctrl/Cmd+click for multi-select, double-click to open/preview, right-click for context menu, drag to folders for organization. The **multi-select action bar** appears on selection showing "3 items selected — Move | Delete | Download."

Keyboard accessibility is critical: Tab between files, arrow keys for grid navigation (WAI-ARIA grid pattern), Enter to open, Delete to remove. A keyboard-accessible file input button must always accompany drag-and-drop since drag-and-drop is not keyboard-operable. Upload progress uses `aria-live="polite"` for announcements.

**Auto-generatable**: upload dropzone component, thumbnail grid with view mode toggle, sortable file table, file detail sidebar, breadcrumb folder navigation, multi-select action toolbar, upload progress panel, full-page media library layout.

### Tag inputs and taxonomy trees handle flat and hierarchical classification

**Flat tag inputs** (GitHub labels, Notion multi-select) use a text input with autocomplete dropdown, rendering selections as colored chips with × remove buttons. Typing filters existing tags; "Create 'x'" appears when no match is found. Backspace on empty input removes the last tag. **Taxonomy tree selectors** (WordPress categories) use a hierarchical checkbox tree with expand/collapse, indentation, and indeterminate parent checkboxes when some children are selected.

The key UI difference: flat tags use `role="listbox"` with `role="option"` and the combobox ARIA pattern, while trees use `role="tree"` with `role="treeitem"`, `aria-expanded`, and keyboard navigation (Up/Down to move, Left to collapse/parent, Right to expand/child, Space to toggle checkbox). Flat tags scale well to ~100 items with search; trees handle deep hierarchies but become visually unwieldy when very wide.

**Auto-generatable**: tag input with autocomplete + chip display, multi-select dropdown with search, taxonomy tree with checkboxes, creatable select (search + create inline), color-coded label picker, tag management CRUD table, hierarchical category selector.

---

## GROUP 5: Research, HCI, and accessibility foundations

### CAMELEON defines four abstraction levels from tasks to final UI

The **CAMELEON reference framework** (Calvary, Coutaz, Thevenin, 2003) structures UI development into four levels connected by reification (downward) and abstraction (upward) transformations:

1. **Task & Concepts Model** — what users do and what objects they manipulate
2. **Abstract UI (AUI)** — interaction spaces grouping subtasks, with **Abstract Interaction Objects (AIOs)** independent of any platform or modality
3. **Concrete UI (CUI)** — platform-specific **Concrete Interaction Objects (CIOs)**, defining actual widgets and layout
4. **Final UI** — source code in any language

AIOs classify into five types: **Input** (→ text fields, number inputs), **Output** (→ labels, charts), **Selection** (→ radio buttons, dropdowns, listboxes), **Navigation** (→ links, tabs, menus), and **Trigger** (→ buttons, submit controls). The critical design rule: **an AIO "selection from enumeration" maps to radio buttons for <5 options, a dropdown for ≥5 options**, or a listbox for multi-select. Context of use — the triple of (User, Platform, Environment) — drives these mapping decisions.

Clef Surface maps CAMELEON's four levels to concrete concepts: (1) Task & Concepts → `.concept` specs with `interface {}` sections, (2) Abstract UI → Element concept + Interactor classification, (3) Concrete UI → Affordance matching + WidgetResolver selection + `.widget` specs, (4) Final UI → WidgetGen/ThemeGen output per framework. CAMELEON's AIO types correspond to Interactor categories (selection, edit, control, output, navigation, composition), and the context-of-use triple maps to WidgetResolver's runtime context (platform, viewport, density, accessibility).

### Metawidget and MBUID provide the auto-generation pipeline

**Model-Based UI Development** uses high-level models (task, domain, user, presentation, dialog) to generate concrete UIs. **Metawidget** is the most practical implementation, using an **Object/User Interface Mapping (OIM)** pipeline:

1. **Inspectors** examine domain objects via reflection, annotations, JSON Schema
2. **InspectionResultProcessors** merge/transform inspection results
3. **WidgetBuilders** map properties to native widgets based on type
4. **WidgetProcessors** add behaviors (binding, validation, CSS)
5. **Layouts** arrange widgets (grid, table, div-based)

The canonical type-to-widget mapping table that every auto-generation system should implement:

| Data Type | Default Widget | Condition Variants |
|---|---|---|
| `string` | Text input | `@UiLarge` → textarea |
| `boolean` | Checkbox | Switch for settings |
| `int/long/number` | Number input | With min/max → slider |
| `Date` | Date picker | — |
| `enum` (≤5 options) | Radio group | ≥5 → Select dropdown |
| `enum` (multi) | Checkbox group | Multi-select |
| `Object` (nested) | Nested form group | Recursive generation |
| `Collection` | Table/list view | — |
| Read-only property | Label/span | — |
| `relation/ref` | Lookup/autocomplete | ComboBox |

Metawidget's key principle: **"Don't take over the GUI"** — generate only the data-bound portion, letting developers compose it with manual UI and override via named child widgets.

Clef Surface replaces Metawidget's flat type-to-widget table with a two-step pipeline: **Interactor/classify** (field type + constraints → semantic interaction type) then **WidgetResolver/resolve** (interaction type + runtime context → concrete widget via Affordance matching). This separation means the same `set String` field classified as `multi-choice` can resolve to checkbox-group (3 options, desktop), multi-select (30 options, desktop), or scrolling-list (any count, watch) — context-aware decisions that a flat table cannot express. Metawidget's five pipeline stages map to: Inspectors → UISchema/inspect, InspectionResultProcessors → Interactor/classify, WidgetBuilders → WidgetResolver/resolve + Affordance/match, WidgetProcessors → Machine/connect, Layouts → Layout concept. See §Clef Surface Implementation below for the full classification and affordance tables.

### JSON Forms and RJSF generate forms from JSON Schema

**JSON Forms** (jsonforms.io) uses a two-schema approach: **JSON Schema** (data structure) + **UI Schema** (layout/presentation). UI Schema elements include `Control` (bound to a property via JSON Pointer), `VerticalLayout`, `HorizontalLayout`, `Group` (with label/border), and `Categorization` (rendered as tabs or stepper). Conditional rules use `SHOW/HIDE/ENABLE/DISABLE` effects with conditions. Custom renderers register with priority-based testers.

**React JSON Schema Form (RJSF)** takes a simpler single-schema approach with optional `uiSchema` overrides. It maps `string` → `<input type="text">`, `string+enum` → `<select>`, `number` → `<input type="number">`, `boolean` → checkbox, `string+format:date` → date picker, `array+enum+uniqueItems` → multi-select checkboxes. Theme packages (@rjsf/mui, @rjsf/antd, @rjsf/chakra-ui) provide styled renderers.

Both handle complex schemas: **nested objects** via recursive rendering, **arrays** via list renderers with add/remove, **`oneOf`/`anyOf`** via discriminated union selectors, and **conditional fields** via `if/then/else`. JSON Forms supports a "List with Detail" pattern for array items — a master list on the left, selected item's form on the right.

### Headless UI libraries separate behavior from presentation

**Headless (unstyled) UI components** provide behavior, accessibility, and state management without visual styling. The four major libraries differ in approach:

- **Radix Primitives** (~32 components, React): Compositional sub-component API (`Dialog.Root`/`Dialog.Trigger`/`Dialog.Content`), `asChild` prop for DOM composition
- **React Aria** (Adobe, ~50+ components): Three-layer architecture — `react-stately` (state), `react-aria` (DOM behavior hooks), `react-aria-components` (pre-composed). **30+ language i18n** built in. Finest granularity via hooks
- **Zag.js** (~47+ components, framework-agnostic): **Each component is an explicit finite state machine** with states, transitions, context, and effects. Adapters for React, Vue, Solid, Svelte
- **Headless UI** (Tailwind Labs, ~10 components): Smallest set, optimized for Tailwind CSS

All encode critical interaction patterns: **focus trapping** in modals, **roving tabindex** in composite widgets, **click-outside** dismissal, **typeahead** in listboxes, **scroll locking** in modals, and **portal rendering** for popovers.

A UI framework should use headless primitives as its rendering layer — they solve the hard problems (accessibility, keyboard navigation, focus management) while letting the framework control layout and theming. Zag.js's state machine approach is particularly valuable for generating framework-agnostic, testable widget behavior.

Clef Surface's `.widget` specification format directly encodes this pattern. Each `.widget` file declares **anatomy** (named parts with semantic roles, like Radix's sub-component API), **states** (explicit finite state machine with transitions, entry/exit actions — like Zag.js), **accessibility** (ARIA roles, keyboard bindings, focus trapping), **props** (typed with defaults), and **connect** (declarative mapping from anatomy parts to attributes and handlers — compiles to any framework). The `.widget` file is the headless primitive spec; WidgetGen compiles it to React, Solid, Vue, Svelte, or Ink. The `affordance {}` section within each `.widget` file declares what interaction situations the widget can serve, feeding the WidgetResolver's selection engine.

### The W3C ARIA Authoring Practices define 30 widget patterns

The WAI-ARIA APG specifies required roles, states, and keyboard interactions for **30 standard widget patterns**. The most important for auto-generation:

- **Combobox**: `role="combobox"`, `aria-expanded`, `aria-autocomplete`, `aria-activedescendant`. Arrow keys navigate popup, Enter selects, Escape closes. Used by: search, select, tag input, mention autocomplete
- **Dialog**: `role="dialog"`, `aria-modal="true"`, focus trapped, Escape closes. Used by: modals, confirmation dialogs, detail panels
- **Grid**: `role="grid"` with `row`, `gridcell`. Arrow keys navigate cells. Used by: data tables, permission matrices, calendars
- **Tree**: `role="tree"` with `treeitem`, `aria-expanded`. Left/Right collapse/expand, Up/Down navigate. Used by: outliners, taxonomy selectors, file browsers
- **Tabs**: `role="tablist"` with `tab`, `tabpanel`. Left/Right navigate tabs. Used by: view switchers, categorized forms, detail pages
- **Toolbar**: `role="toolbar"`, roving tabindex. Arrow keys between controls. Used by: formatting toolbars, action bars
- **Listbox**: `role="listbox"` with `option`. Arrow keys navigate, typeahead. Used by: select dropdowns, facet lists

Eight **landmark roles** structure page layout: `banner` (header), `navigation`, `main`, `complementary` (sidebar), `contentinfo` (footer), `search`, `form`, `region`. Every auto-generated view should use landmarks appropriately.

**Non-negotiable accessibility requirements** for any auto-generated UI: all interactive elements keyboard-operable (Tab/Arrow/Enter/Space/Escape), correct ARIA roles assigned automatically, accessible names from schema labels, state communicated via `aria-expanded`/`aria-checked`/`aria-selected`/`aria-invalid`, focus indicators visible, `aria-live` regions for dynamic updates, color contrast ≥ 4.5:1, and touch targets ≥ 44×44px.

---

## The unified auto-generation pipeline

Synthesizing across all 25 domains, a UI framework that auto-generates interfaces should implement a **layered pipeline** following CAMELEON's abstraction levels, Metawidget's processing architecture, JSON Forms' renderer registry, and headless UI primitives for the rendering layer:

```
Schema Property → AIO Classification → CIO Selection → Headless Primitive → Accessible Widget
```

**Standard views every domain needs**: List/Table view (from collections), Detail/Form view (from objects), Master-Detail view (list + selected item form), Dashboard view (aggregate cards + charts), and Settings view (grouped toggles and inputs). More specialized domains add Canvas views (workflows, whiteboards), Matrix views (permissions, notification preferences), Diff views (config sync), and Graph views (knowledge bases, relationship data).

The most impactful patterns to auto-generate first, based on frequency across domains: **type-adaptive form fields** (appears in 20+ domains), **sortable/filterable tables** (15+ domains), **autocomplete/combobox inputs** (12+ domains), **drag-and-drop reorder** (10+ domains), **tree views with expand/collapse** (8+ domains), **tab-based navigation** (8+ domains), and **popover/panel configuration UIs** (every domain).

Every generated component should include ARIA roles from the WAI-ARIA APG, keyboard handlers matching the specification, focus management for composite widgets, and `aria-live` announcements for dynamic content — these are not optional enhancements but baseline requirements that headless UI libraries like React Aria and Zag.js provide by default.

---

## Clef Surface implementation

Clef Surface is the concrete realization of the patterns cataloged above. It implements the unified pipeline as 29 concepts across 7 suites, with two new spec file formats (`.widget`, `.theme`), a two-step semantic selection engine, and sync-driven orchestration. Full specification: `docs/architecture/surface-spec.md`.

### The two-step selection pipeline replaces flat type-mapping tables

The core insight from CAMELEON, Metawidget, and TRIDENT research is that widget selection requires two distinct decisions: *what kind of interaction is this?* (abstract, context-free) and *which widget best serves it here?* (concrete, context-dependent). Clef Surface separates these into three concepts:

1. **Interactor** — abstract interaction type taxonomy. Classifies user interactions by semantic purpose independent of any widget. Categories: selection, edit, control, output, navigation, composition.
2. **Affordance** — widget capability declarations. Each `.widget` file declares what interaction situations it can serve, with specificity scores and conditional constraints (option count, platform, viewport, density).
3. **WidgetResolver** — context-aware matching engine. Gathers properties from the Interactor classification, merges runtime context from Viewport and PlatformAdapter, queries Affordance declarations, scores candidates, returns the best match with an explanation trace.

The runtime pipeline:

```
.concept spec → UISchema/inspect → Element tree → Interactor/classify → WidgetResolver/resolve → Widget/get → Machine/spawn → Machine/connect → FrameworkAdapter/render → pixels
```

### Interactor classification rules

Interactor/classify maps field types and constraints to semantic interaction types. This extends Metawidget's type-to-widget table with richer semantics — the interaction type carries properties (cardinality, optionCount, optionSource, domain, mutable, multiLine) that downstream Affordance matching uses for context-sensitive selection.

**Standard interactor types (registered on bootstrap):**

- **Selection:** single-choice, single-pick, multi-choice, multi-pick, toggle, range-select
- **Edit:** text-short, text-long, text-rich, number-exact, number-approx, date-point, date-range, color, file-attach
- **Control:** action-primary, action-secondary, action-tertiary, action-danger, submit, cancel, navigate
- **Output:** display-text, display-number, display-date, display-badge, display-status, display-media, display-progress
- **Overlay:** overlay (modal/non-modal layered surfaces — dialogs, popovers, drawers)
- **Composition:** group-fields, group-section, group-repeating, group-conditional

**Classification rules:**

| Field type | Constraints | Interactor type |
|---|---|---|
| `String` | (default) | text-short |
| `String` | maxLength > 500 | text-long |
| `String` | format: "rich" | text-rich |
| `String` | format: "color" | color |
| `Int` | (default) | number-exact |
| `Int` | min + max (small range) | number-exact { domain: "1-10" } |
| `Float` | — | number-approx |
| `Bool` | — | toggle |
| `DateTime` | — | date-point |
| `Bytes` | — | file-attach |
| `set T` | enum (≤ 8) | multi-choice { optionCount: n } |
| `set T` | enum (> 8) | multi-pick { optionCount: n } |
| `set T` | open | multi-pick { optionSource: "open" } |
| `T → T` relation | enum | single-choice { optionCount: n } |
| `T → T` relation | open | single-pick { optionSource: "open" } |
| `{ fields }` | — | group-fields |
| `list T` | — | group-repeating |

### Standard affordance declarations

Affordances are the parametric selection rules. Each declares that a widget can serve a given interactor type under specific conditions. Higher specificity wins. Apps extend freely by declaring additional affordances with higher specificity.

| Widget | Interactor | Specificity | Conditions |
|---|---|---|---|
| radio-group | single-choice | 10 | maxOptions: 8 |
| radio-card | single-choice | 12 | maxOptions: 4, comparison: true |
| select | single-choice | 5 | (fallback) |
| combobox | single-choice | 8 | minOptions: 20 |
| segmented-control | single-choice | 11 | maxOptions: 5, platform: "desktop" |
| checkbox-group | multi-choice | 10 | maxOptions: 8 |
| multi-select | multi-choice | 5 | (fallback) |
| combobox-multi | multi-choice | 8 | minOptions: 20 |
| chip-input | multi-pick | 10 | optionSource: "open" |
| toggle-switch | toggle | 10 | — |
| checkbox | toggle | 8 | density: "compact" |
| toggle-switch | toggle | 9 | platform: "mobile" |
| text-input | text-short | 5 | (fallback) |
| textarea | text-long | 10 | — |
| rich-text-editor | text-rich | 10 | — |
| number-input | number-exact | 5 | (fallback) |
| stepper | number-exact | 10 | domain: "1-10" |
| slider | number-approx | 10 | — |
| date-picker | date-point | 10 | — |
| date-range-picker | date-range | 10 | — |
| button | action-primary | 10 | variant: "filled" |
| button | action-secondary | 10 | variant: "outline" |
| button | action-tertiary | 10 | variant: "text" |
| button | action-danger | 10 | variant: "danger" |
| label | display-text | 5 | (fallback) |
| badge | display-badge | 10 | — |
| progress-bar | display-progress | 10 | — |

Custom affordances override defaults:

```
Affordance/declare(
  widget: "star-rating",
  interactor: "single-choice",
  specificity: 15,
  conditions: { domain: "1-5", context: "rating" }
)
```

### `.widget` specification format

Each `.widget` file is a semantic spec parsed by WidgetParser into a typed AST, then compiled by WidgetGen to framework-specific components. The format carries everything JSON blobs cannot: purpose, anatomy with semantic part roles, finite state machine with entry/exit actions, accessibility contracts (ARIA roles, keyboard bindings, focus management), typed props with defaults, declarative `connect {}` mappings (compile to any framework), `affordance {}` declarations, and behavioral invariants.

**Anatomy** defines named parts with semantic roles (`container`, `action`, `overlay`, `text`), each marked `required` or optional. Parts are the contract between behavior and rendering — like Radix sub-components or Ark UI parts.

**States** define an explicit finite state machine. Each state lists transitions (`on EVENT -> target`), entry actions (run on entering), and exit actions (run on leaving). One state is marked `[initial]`.

**Accessibility** declares ARIA role, modal behavior, keyboard bindings (key → event), focus management (trapping, initial target, return-on-close), and `aria-labelledby`/`aria-describedby` targets.

**Connect** maps anatomy parts to framework-neutral attributes: ARIA properties, event handlers (`onClick: send(EVENT)`), data attributes (`data-state: if open then "open" else "closed"`), conditional visibility. This section compiles to the `Machine/connect` output.

**Compose** enables widget composition — a part can delegate to another widget with props, without the host widget knowing internals. Composition via slots (named insertion points with position and fallback).

**Affordance** declares what interaction situations the widget serves, with specificity and conditions, feeding the WidgetResolver pipeline.

### `.theme` specification format

Each `.theme` file is parsed by ThemeParser into a ThemeAST, then compiled by ThemeGen to platform-specific styles (CSS custom properties, Tailwind config, React Native StyleSheet, terminal ANSI, W3C DTCG JSON).

Themes define six systems:

- **Palette** — colors in `oklch()` with automatic shade generation, semantic role computation via `contrast()` and `lighten()` functions, and WCAG contrast ratio validation (text: 7.0, largeText: 4.5, ui: 3.0)
- **Typography** — modular type scale with base size and ratio, named font stacks (body, heading, mono), and named styles with weight/tracking
- **Spacing** — unit-based scale with configurable base (e.g., 8px)
- **Motion** — named easing curves and durations, with `reducedMotion` configuration that respects `prefers-reduced-motion` and falls back to `instant`
- **Elevation** — shadow levels (none through xl) with y-offset, blur, spread, opacity
- **Radius** — border radius scale (none through full)

Themes extend declaratively — `theme dark extends light {}` overrides only what changes, and computed values (contrast roles, shade scales) recalculate automatically.

### Suite and concept architecture

29 concepts organized into 7 suites:

| Suite | Concepts | Role |
|---|---|---|
| **surface-core** | DesignToken, Element, UISchema, Binding, Signal | Foundation — always loaded |
| **surface-component** | Widget, Machine, Slot, Interactor, Affordance, WidgetResolver | Headless behaviors and selection |
| **surface-render** | FrameworkAdapter, Surface, Layout, Viewport | Framework adapters and mount points |
| **surface-theme** | Theme, Palette, Typography, Motion, Elevation | Visual design system |
| **surface-app** | Navigator, Host, Transport, Shell, PlatformAdapter | Application orchestration |
| **surface-spec** | WidgetParser, ThemeParser, WidgetGen, ThemeGen | Build-time parsing and generation |
| **surface-integration** | (syncs only) | Cross-system coordination |

All concepts follow the Clef independence rule: sovereign storage, typed actions with return variants, no inter-concept references. All coordination is declared in syncs.

### Sync-driven orchestration

Every inter-concept flow is a sync — no concept calls another. Key chains:

**Spec pipeline (build-time):** Resource/track `.widget` file → WidgetParser/parse → Widget/register (catalog) + Affordance/declare (selection rules) + WidgetGen/generate (per-framework code). Same pattern for `.theme` files through ThemeParser → DesignToken/define + ThemeGen/generate.

**Runtime cascade:** Shell/initialize → Navigator/go → Host/mount → Binding/bind → UISchema/inspect → Element tree → Interactor/classify → WidgetResolver/resolve → Widget/get → Machine/spawn → Machine/connect → FrameworkAdapter/render → Surface/mount → pixels.

**Resource cleanup:** Host/unmount → Machine/destroy + Binding/unbind. Navigator guards block transitions before teardown. Host tracks all subordinate resources (bindings, machines) for guaranteed cleanup.

### Progressive customization levels

Five additive levels, following the "don't take over the GUI" principle from Metawidget:

| Level | Mechanism | What changes |
|---|---|---|
| 0 | Zero-config | UISchema/inspect auto-generates CRUD from concept spec |
| 1 | `interface {}` section in `.concept` | Field-level widget overrides, action labels, view column selection |
| 2 | UI Schema overrides | View-level layout customization (two-column, sidebar, tabs) |
| 3 | Slot filling | Replace specific anatomy parts with custom content |
| 4 | Headless hooks | Full custom rendering using Machine/connect output as props API |

WidgetResolver/override implements levels 1+ by bypassing affordance matching for explicitly specified widgets. Most apps never pass level 2.

### Standalone vs. coupled mode

**Coupled mode:** Binding connects directly to Clef concepts via the sync engine. Concept state feeds signals automatically. No network layer required.

**Standalone mode:** Binding wraps a REST/GraphQL/WebSocket endpoint via Transport. Same signal interface, same widget pipeline, different data source.

The switch is a single `mode` flag on Binding/bind ("coupled", "rest", "graphql", "static"). Widget code, Navigator destinations, Shell zones, and PlatformAdapter mappings don't change.

### Mapping the 25 domain patterns to Clef Surface concepts

The domain patterns cataloged in Groups 1–4 map to Clef Surface primitives:

| Domain pattern | Clef Surface concept(s) |
|---|---|
| Block editors | `.widget` specs for block types + Machine state machines + Slot composition |
| Property panels | UISchema/inspect → Element tree → type-adaptive form fields via Interactor/classify |
| Schema builders | Schema concept → UISchema/inspect sync → auto-generated editor |
| Embedded references | `.widget` spec with combobox ARIA pattern + Affordance for mention triggers |
| Canvas interfaces | Machine (tool state machines) + custom `.widget` specs per shape/connector type |
| Query builders | Interactor `group-repeating` + `single-choice` operator rows + AND/OR toggle composition |
| View switchers | Navigator destinations per view type + Layout concept per layout kind |
| Workflow editors | Machine concept (state machines natively) + Widget composition via syncs |
| Notification centers | Shell overlay zones + PlatformAdapter for platform-native toasts |
| Permission matrices | Interactor `multi-choice` per resource + Layout grid arrangement |
| Plugin marketplaces | Element `group-section` + `display-media` + `action-primary` install button |
| File browsers | Machine (upload states) + `.widget` dropzone + Layout grid/list toggle |
| Tag inputs | Affordance `chip-input` for `multi-pick { optionSource: "open" }` |
| Diff viewers | Custom `.widget` spec + Machine (expand/collapse hunk state) |
| Formula editors | `.widget` spec with custom grammar + Interactor `text-rich` variant |