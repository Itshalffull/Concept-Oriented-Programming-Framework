# Clef Base Usability Audit

**Date**: 2026-04-06
**Scope**: Can a user build an app *inside* Clef Base using its views, layouts, schemas, block editor, and controls — without writing concept code?

---

## Executive Summary

Clef Base is a **real, functional Next.js application** with ~17,000 lines of component code, 81+ registered concepts, 69 seed files, and 27 pre-configured views. It boots a real Clef kernel, serves a real API, and renders real UI. The "build an app inside Clef Base" story is **partially there but has significant gaps** between what's spec'd and what a user can actually do through the UI without touching code.

**Verdict**: A power user who understands Clef's mental model could build a basic content app (schemas, views, pages). But the UX has rough edges, missing feedback loops, dead-end flows, and critical missing features that would block a less technical user.

---

## What Works Well

### 1. Core Content Pipeline
- **ContentNode CRUD** works end-to-end: create via QuickCapture (Ctrl+N), view in lists, open detail pages
- **Schema system** lets you define typed fields and apply schemas to entities — multi-schema composition works
- **27 pre-configured views** cover content, schemas, workflows, automations, taxonomy, themes, display modes, process automation, multimedia, and versioning
- **5 themes** ship out of the box (light, dark, high-contrast, editorial, signal) with real CSS token application

### 2. View Rendering Pipeline
The full view rendering pipeline is wired and functional:
- DataSourceSpec -> FilterSpec -> SortSpec -> ProjectionSpec -> PresentationSpec -> DisplayMode -> ComponentMapping -> FieldPlacement
- **10+ display types work**: table, card-grid, board (kanban), calendar, timeline, graph, stat-cards, canvas, detail, block-editor

### 3. Block Editor
The block editor (~2,900 lines) is the most ambitious component:
- Tree structure with indent/outdent, collapse/expand
- 16+ block types (paragraph, headings, bullets, numbered, quote, divider, code, image, callout, view-embed, entity-embed, block-embed, snippet-embed, control)
- Slash menu (`/`) for block creation
- Rich text via contentEditable (Ctrl+B, Ctrl+I, Ctrl+`)
- Display mode switching per block
- Entity reference links via `[[entity-name]]` syntax

### 4. Layout System
- LayoutRenderer supports grid, split, sidebar, stack arrangements
- SplitLayoutRenderer has draggable dividers, tab groups, pane mounting
- Layout Builder view lets you visually compose split trees

### 5. Authentication & RBAC
- Real session management via kernel concepts
- 3 pre-configured roles (admin, editor, viewer) with 12 permissions
- Per-schema and per-node access control
- MFA requirement escalation for sensitive operations

---

## Critical Gaps

### GAP 1: No In-App Schema Creator UI
**Severity: CRITICAL**

Users can *see* schemas in a list view, but there's no UI to **create or edit a schema's field definitions** through the app. You'd need to either:
- Edit YAML seed files and reboot
- Invoke `Schema/defineSchema` through the API manually

**Impact**: This is the foundational step for "build an app" — without it, a user can't define their data model from within Clef Base.

**Recommendation**: Build a schema editor view with field type picker, validation rules, and live preview.

### GAP 2: No View Builder for End Users
**Severity: CRITICAL**

The ViewEditor component (1,104 lines) exists and is comprehensive, but it's an **admin/power-user tool** that requires understanding of DataSourceSpec, FilterSpec, ProjectionSpec, PresentationSpec, and InteractionSpec as separate concepts. There's no guided "create a new view" wizard that walks a user through:
1. Pick your data source (which schema?)
2. Choose columns/fields to show
3. Pick a display type (table, cards, board, calendar)
4. Add filters and sorts

**Impact**: Users can't build new views without understanding the underlying concept decomposition.

**Recommendation**: Add a "New View" wizard that composes the sub-specs behind a simpler UX.

### GAP 3: No Form Builder
**Severity: HIGH**

CreateForm generates forms from field configs, but there's **no UI for designing forms**. Users can't:
- Pick which fields appear on a create/edit form
- Set field order, grouping, or validation
- Create multi-step forms
- Add conditional visibility

Forms are entirely driven by InteractionSpec seeds.

**Recommendation**: Build a form designer that lets users configure InteractionSpec visually.

### GAP 4: Block Editor Missing Core Editing Features
**Severity: HIGH**

Compared to production block editors (Notion, Outline):
- **No formatting toolbar** — bold/italic/link only via keyboard shortcuts or slash menu
- **No markdown shortcuts** (e.g., `##` for heading, `- ` for bullet)
- **No inline menu on text selection** — must use slash commands
- **No table block type**
- **No @ mention / entity autocomplete** (only `[[` linking syntax)
- **No collaborative cursors or real-time sync**
- **No undo/redo visual feedback**
- Span click handlers are wired but **inert** (passed but never called)

### GAP 5: No Automation/Workflow Builder UI
**Severity: HIGH**

Workflow and AutomationRule schemas exist, and there are list views for them. But there's **no visual builder** for:
- Defining workflow state machines (states, transitions, guards)
- Creating automation rules (trigger -> condition -> action)
- Testing/simulating workflows

The existing AutomationRule seeds use placeholder `log` actions.

---

## UX Issues

### Issue 1: Silent Failures Everywhere
**Severity: HIGH**

Most components catch errors silently or show minimal feedback:
- ViewEmbedBlock and EntityEmbedBlock in BlockEditor show no loading skeleton or error state
- ConceptBrowser `install` and `remove` operations give no progress indicator
- ControlBlock's "Invoke" button has no loading/error feedback
- Schema apply/remove in EntityDetailView has no confirmation
- Dashboard health fetch fails silently — shows "unknown" status

**Recommendation**: Add consistent loading/error/success states to all kernel invocations.

### Issue 2: Dead-End Interactions
**Severity: HIGH**

Several UI elements are wired but don't complete their flow:
- **AppShell "Leave Space" button** — placeholder onClick, doesn't actually invoke VersionSpace/leave
- **Span highlights** — rendered but clicks are inert (onSpanClick never fires)
- **EntityEmbedBlock metadata changes** — accepts invalid entity IDs without validation
- **BoardDisplay** — no drag-and-drop (the core kanban interaction)
- **CalendarDisplay** — read-only, no event creation
- **DataTable** — expand/collapse chevron triggers both expand AND row click simultaneously

### Issue 3: No Responsive/Mobile Support
**Severity: MEDIUM**

- Board columns are fixed 220px min-width — overflows on narrow screens
- SplitLayout has no mobile fallback (stacked panes)
- Sidebar has no collapse/hamburger for mobile
- No touch gesture support for drag operations

### Issue 4: Keyboard Navigation Gaps
**Severity: MEDIUM**

- DataTable: no arrow key navigation between rows/cells
- BoardDisplay: no keyboard navigation between columns/cards
- CardGrid: no keyboard navigation between cards
- SplitLayout: no keyboard shortcuts for pane focus switching
- Tab groups: no arrow key navigation between tabs
- Collapse/expand buttons lack Enter/Space handling in BlockEditor

### Issue 5: Missing Empty States
**Severity: MEDIUM**

Several views return blank when empty instead of guiding the user:
- BlockEditor embeds show nothing during load
- CardGrid renders zero cards with no "nothing here" message
- Filter results that return 0 items show no "no results" guidance

---

## Accessibility Issues

### Strengths
- CalendarDisplay has excellent ARIA: proper grid roles, columnheader, gridcell, aria-live
- DataTable uses proper `<table>` semantics with aria-sort
- QuickCapture FAB has aria-label with keyboard shortcut hint
- SplitLayout divider has role="separator" and aria-orientation

### Gaps
- **No skip-to-main-content link** in AppShell
- **Sidebar lacks role="navigation"**
- **Modals don't trap focus** (QuickCapture, CreateForm, schema manager)
- **No aria-expanded** on collapsible sidebar groups
- **No aria-required / aria-invalid** on form fields
- **Error messages not linked** to inputs with aria-describedby
- **Clickable cards lack role="button"** in CardGrid and BoardDisplay
- **No prefers-color-scheme** media query support — themes are manual only
- **Slash menu items lack aria-labels** in BlockEditor
- **Color-only indicators** in several components (status badges, space indicator)

---

## Seed Data & Configuration Quality

### Strengths
- **69 seed files** with no broken cross-references detected
- All 27 ViewShell entries reference defined sub-specs (DataSource, Filter, Sort, Projection, Presentation, Interaction)
- All 31 ComponentMapping entries reference valid schemas and display modes
- Themes include accessibility constraints (contrast ratios, reduced motion)

### Gaps
- **No example user content** — all seeds are system/admin infrastructure
- **AutomationRule seeds use placeholder `log` actions** — not real automation
- **ProcessSpec entries are stubs** with JSON metadata, not executable
- Widget IDs in ComponentMapping assume implementations exist but aren't validated at seed time

---

## Out-of-Box Experience Assessment

### What a new user sees:
1. Login screen (admin/change-me-now)
2. Dashboard with stat cards (concept count, schema count, etc.)
3. Sidebar with 15+ navigation destinations grouped by category
4. Content list as default center view

### What they can do immediately:
- Browse system entities (concepts, schemas, syncs, themes)
- Create content nodes via QuickCapture (Ctrl+N)
- Apply existing schemas to content
- Switch between 5 themes
- View content in different display modes (table, cards, board, calendar)
- Navigate entity detail pages with block editor
- Browse and inspect registered concepts

### What they can't do without code/config:
- Define new schemas with custom fields
- Create new views with custom data sources
- Build forms for data entry
- Design workflows or automation rules visually
- Create custom display modes
- Add new navigation destinations
- Configure RBAC for their custom schemas

---

## Priority Recommendations

### P0 — Must Have for "Build an App" Story
1. **Schema Editor UI** — Create/edit schemas with field definitions, types, validation
2. **View Creation Wizard** — Guided flow: pick schema -> choose fields -> pick display -> add filters
3. **Fix dead-end interactions** — Leave Space button, span clicks, board drag-drop
4. **Loading/error states** — Consistent feedback for all kernel invocations

### P1 — High Impact
5. **Form Builder** — Design create/edit forms for schemas
6. **Block Editor polish** — Formatting toolbar, markdown shortcuts, table blocks, @ mentions
7. **Workflow/Automation Builder** — Visual state machine and rule editors
8. **Keyboard navigation** — Tables, cards, boards, tabs, panes

### P2 — Important
9. **Accessibility fixes** — Focus trapping, ARIA attributes, skip links, color independence
10. **Responsive design** — Mobile sidebar, stacked layouts, touch support
11. **Empty state guidance** — "Get started" prompts when views are empty
12. **Onboarding flow** — First-run wizard to create first schema + view

### P3 — Nice to Have
13. **Real-time collaboration** — Collaborative cursors in block editor
14. **Template gallery** — Pre-built app templates (CRM, project tracker, wiki)
15. **Import/export** — Bring in data from CSV, JSON, or other tools
16. **API explorer** — In-app tool to test concept invocations

---

## Detailed Component Findings

### ViewEditor (1,104 lines) — 70% Complete

**What works**: Split editor-preview layout, 11 display layout options, field configurator with 9 formatters, filter toggles, sort/group config, create button config, row click navigation, raw JSON view, live preview on save.

**Key bugs and gaps**:
- **Fake drag-and-drop**: Field configurator shows drag handle icons (⣿) but has NO drag functionality — only up/down arrow buttons. Advertised UX feature doesn't work.
- **No field autocomplete**: Users manually type field names with no dropdown of available fields from the data source. Typos silently fail to render.
- **Limited formatters**: Only 9 options (badge, boolean-badge, date, json-count, schema-badges, code, truncate, json). Missing: link, currency, percentage, duration, custom.
- **Minimal filter config**: Only `toggle-group` type. Can't configure operators, labels, default values, or contextual filters through UI.
- **Single-field grouping only**: Complex or nested grouping not possible.
- **No save validation**: Broken configs save without warning; error messages are raw backend responses.
- **Preview requires manual save**: No debounced auto-preview; slow iteration loop.
- **Create form field types**: Only text, textarea, select — no date, checkbox, number, email.

### ViewRenderer (1,048 lines) — 85% Complete

**What works**: Data rendered in selected layout with live toggle filtering, schema badges, row click navigation, row/bulk actions, grouping, empty states.

**Key bugs and gaps**:
- **Row/bulk actions fail silently**: No error feedback when actions fail. No try/catch around `invoke()` calls in bulk action handler.
- **Null safety issues**: `params[paramKey] = row[rowField]` has no null check — row actions crash if field value is missing.
- **No pagination**: All data loaded at once. 1000+ rows cause performance degradation.
- **No inline editing**: Views are read-only. Must navigate to detail view for edits.
- **No retry on fetch failure**: "Query failed" message with no retry button.
- **Display mode rendering N+1**: Each row invokes DisplayMode.resolve() separately — 100+ rows = 100+ kernel round-trips with no caching.
- **Filter toggle UX**: No "clear all" button, no search within filter values, wraps unpredictably on small screens.
- **Group collapse state lost**: Re-expands unexpectedly when filtering or sorting.

### SchemasView — 40% Complete

**What works**: List schemas (name, field count, extends, associations). Create schema with name + comma-separated fields.

**Key gaps**:
- **No schema editor**: Can't edit existing schemas, add/remove fields, or change inheritance after creation.
- **Create form too simplistic**: "Fields (comma-separated)" input with no field type, validation, or constraint config.
- **No field visualization**: Schema definition is opaque in list view — can't see field types or structure at a glance.

### ViewsView — 50% Complete

**Key gaps**:
- Create dialog only has 3 fields (ID, data source, layout) — must create then immediately edit.
- No view duplication, deletion, or search/filter.

### DisplayModesView — 60% Complete, Confusing UX

**Key gaps**:
- Three rendering strategy tabs (Component | Layout | Flat Fields) with no explanation of when to use which.
- No validation of component mapping or layout ID references — accepts non-existent values.
- No preview of what the display mode looks like.
- No delete support — "Clear" only clears internal config.

### MappingsView — ~20% Complete (Stub)

Only shows list and edit link. No actual mapping editor visible.

---

## Technical Health

| Metric | Value |
|--------|-------|
| Total component code | ~17,300 lines |
| Registered concepts | 81+ |
| Seed files | 69 |
| Pre-configured views | 27 |
| Display types | 10+ |
| Themes | 5 |
| Layout types | 4 (grid, split, sidebar, stack) |
| Block types | 16+ |
| Schema definitions | 24 |
| Roles/Permissions | 3 roles, 12 permissions |
| Test coverage | Not assessed (out of scope) |

**Overall**: The foundation is solid and genuinely functional. The gaps are in the **user-facing creation tools** — the system can render and manage almost anything, but users can't *create* new structures through the UI yet. The read/browse/display path works; the create/configure path requires code or config file editing.
