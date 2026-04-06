# clef-base — Application Architecture Reference

clef-base is a full-stack content management application built on the Clef framework. It runs as a Next.js 15 App Router application where **every feature is a concept** — content, schemas, views, layouts, themes, access control, navigation, and display modes are all kernel-managed concepts wired by syncs.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  ClefProvider (React Context)                           │ │
│  │  ┌──────────┐ ┌──────┐ ┌──────┐ ┌──────────────────┐  │ │
│  │  │Navigator │ │Shell │ │ Host │ │ Theme / Workspace │  │ │
│  │  └────┬─────┘ └──┬───┘ └──┬───┘ └──────────────────┘  │ │
│  │       │          │        │                             │ │
│  │  ┌────▼──────────▼────────▼──────────────────────────┐  │ │
│  │  │  AppShell                                         │  │ │
│  │  │  ┌──────────┐  ┌──────────────────────────────┐   │  │ │
│  │  │  │ Sidebar  │  │  LayoutRenderer               │   │  │ │
│  │  │  │ (dests)  │  │  ┌────────────────────────┐   │   │  │ │
│  │  │  │          │  │  │  ViewRenderer(s)       │   │   │  │ │
│  │  │  │          │  │  │  dataSource → kernel   │   │   │  │ │
│  │  │  │          │  │  │  → filter → display    │   │   │  │ │
│  │  │  │          │  │  └────────────────────────┘   │   │  │ │
│  │  │  └──────────┘  └──────────────────────────────┘   │  │ │
│  │  └───────────────────────────────────────────────────┘  │ │
│  └──────────────────────────┬──────────────────────────────┘ │
│                             │ POST /api/invoke/{concept}/{action}
└─────────────────────────────┼───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│  Server (Next.js API Routes + Server Actions)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Kernel (singleton)                                   │   │
│  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐  │   │
│  │  │ 31 Concepts │ │ Sync Engine  │ │ Seed Pipeline│  │   │
│  │  │ (19 domain  │ │ (compiled    │ │ (YAML →      │  │   │
│  │  │  12 infra)  │ │  .sync rules)│ │  concept ops)│  │   │
│  │  └──────┬──────┘ └──────────────┘ └──────────────┘  │   │
│  │         │                                             │   │
│  │  ┌──────▼──────────────────────────────────────────┐  │   │
│  │  │  Storage (Upstash KV or in-memory)              │  │   │
│  │  │  + 6 Identity Storage Buckets                   │  │   │
│  │  └─────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Kernel — The Runtime Core

**File: `lib/kernel.ts`**

The kernel is a server-side singleton. It boots once and serves all requests.

### Boot sequence

1. **Register concepts** — loads `REGISTRY_ENTRIES` (generated), each binding a concept URI (`urn:clef/{Name}`) to its handler and storage instance
2. **Compile syncs** — loads `.sync` files from the monorepo root and compiles routing rules
3. **Seed data** — runs the full seed pipeline:
   - Populates RuntimeRegistry with all registered concepts & syncs
   - Runs FileCatalog discovery (scans `/specs`, `/syncs`, `/surface`, `/repertoire/concepts`, `/suites`)
   - Applies declarative seeds from 65 YAML files (Schema, View, ContentNode, DisplayMode, etc.)
   - Reflects entities (auto-creates ContentNode entries for discovered concepts/syncs/widgets)
4. **`ensureSeeded()`** — async gate that blocks queries until seeding completes (uses `_seedPromise` singleton pattern)

### Storage

- **Kernel storage**: Upstash KV (`createStorageFromEnv`) with in-memory fallback
- **Identity storage**: 6 separate buckets for `access-catalog`, `authentication`, `authorization`, `access-control`, `resource-grant-policy`, `session`

### Registered concepts (~31 total)

**Domain concepts (19):** ContentNode, Schema, View, Layout, DisplayMode, ComponentMapping, Workflow, AutomationRule, Taxonomy, Relation, Metric, QualityProfile, QualityGate, DataSourceSpec, FilterSpec, SortSpec, GroupSpec, PresentationSpec, ProjectionSpec

**Infrastructure concepts (12):** Navigator, Shell, Host, Transport, PlatformAdapter, DestinationCatalog, RuntimeRegistry, FileCatalog, Theme, Workspace, Session, AccessCatalog + Authentication + Authorization + ResourceGrantPolicy + AccessControl

---

## 2. API Layer

### Main RPC endpoint

**`POST /api/invoke/[concept]/[action]`**

Every client interaction goes through this single endpoint:

```
POST /api/invoke/ContentNode/list
Body: { "params": { "schemaId": "article" } }
→ { "variant": "ok", "data": { "nodes": [...] } }
```

Flow:
1. Validate session cookie (`clef_base_session`)
2. Check permissions via `canInvokeAdminConcept(concept, action, session)`
3. Resolve `urn:clef/{concept}` and invoke action on kernel
4. Return variant-tagged response

### Health endpoint

**`GET /api/health`** — returns service status, registered concept count, auth mode. Triggers seeding if needed.

### Server Actions (`app/admin/actions.ts`)

Protected async functions for identity management:
- `loginAdminAction()` / `logoutAdminAction()`
- `readAccessSnapshotAction()` — loads users, roles, permissions, policies
- `createAccessUserAction()`, `createAccessRoleAction()`
- `assignAccessRoleAction()`, `revokeAccessRoleAction()`
- `grantAccessPermissionAction()`, `revokeAccessPermissionAction()`
- `updateSchemaAccessAction()`, `updateNodeAccessAction()`

---

## 3. Authentication & Access Control

**Files: `lib/auth.ts`, `lib/identity.ts`**

### Session management

- Cookie: `clef_base_session` (httpOnly, sameSite=lax, secure in production)
- `getCurrentAdminSession()` — loads from cookie, validates via Session concept
- `loginAsAdmin()` — authenticates against Authentication concept, creates session
- `logoutCurrentSession()` — destroys session, clears cookie

### Identity bootstrap

On first boot, `bootstrapIdentity()` seeds a default admin user:
- `CLEF_BASE_ADMIN_USERNAME` (default: `admin`)
- `CLEF_BASE_ADMIN_PASSWORD` (default: `change-me-now`)
- `CLEF_BASE_AUTH_PROVIDER` (default: `local`)

### Access control model

- **Role-based**: admin, editor, viewer
- **Permission-based**: granular per-action grants
- **Schema-level policies**: view, create, edit, delete, define-schema
- **Node-level overrides**: per-entity access can override schema defaults
- Public setup mode shows setup guide to unauthenticated users

---

## 4. ClefProvider — Client-Side Context Bridge

**File: `lib/clef-provider.tsx`**

React context that bridges the kernel to the App Router. Manages all UI infrastructure concepts client-side.

### State managed

| Concern | Concept | What it tracks |
|---------|---------|---------------|
| Navigation | Navigator | Current destination, history stack, forward stack |
| Layout | Shell | Zones (main, sidebar, overlay), assignments |
| Mounting | Host | Which concept view is mounted, lifecycle |
| Theming | Theme | Active theme, CSS variables, mode/density/motif |
| Workspaces | Workspace | Split layout, snapshot state |
| Destinations | DestinationCatalog | All registered navigation targets |

### Hooks exposed

```typescript
useClef()          // Full context
useNavigator()     // Navigation + history (go, back, forward)
useShell()         // Shell zones and overlays
useHost()          // Host mounting/unmounting
useDestinations()  // Available navigation targets
useActiveTheme()   // Current theme state
useWorkspace()     // Workspace/split-layout state
useKernelInvoke()  // Direct kernel invocation wrapper
useConceptQuery()  // Kernel invocation with loading/error state
```

### Navigation flow

```
User clicks Sidebar link
  → navigate(name)
  → router.push(href)
  → useEffect detects pathname change
  → syncPathToUiApp() invokes:
      Navigator/go       (update nav state)
      Host/mount         (mount new concept view)
      Shell/assignToZone (assign host to zone)
      Host/unmount       (unmount previous)
  → React re-renders
  → Host renders View → Layout → ViewRenderer chain
```

---

## 5. AppShell — Root UI Composition

**File: `app/components/AppShell.tsx`**

The top-level UI container. Reads from Navigator, Shell, and DestinationCatalog.

```
┌──────────────────────────────────────────────────────┐
│ Header  [page title]                    [user/logout] │
├──────────┬───────────────────────────────────────────┤
│          │                                           │
│ Sidebar  │  Main Content Area                        │
│          │  (LayoutRenderer or ViewRenderer)          │
│ - Home   │                                           │
│ - Content│                                           │
│ - Schemas│                                           │
│ - ...    │                                           │
│          │                                           │
│ (grouped │                                           │
│  dests)  │                                           │
│          │                                           │
├──────────┴───────────────────────────────────────────┤
│ QuickCapture widget (global actions)                  │
│ Space indicator bar (version space context)           │
└──────────────────────────────────────────────────────┘
```

Sidebar groups are derived from DestinationCatalog — not hardcoded.

---

## 6. View System — Data-Driven UI

The entire UI is driven by three kernel concepts: **View**, **Layout**, and **DisplayMode**.

### LayoutRenderer

**File: `app/components/LayoutRenderer.tsx`**

Loads a Layout config entity and renders child Views in spatial arrangements:
- `stack` — vertical
- `grid` — CSS grid
- `split` — resizable panes
- `sidebar` — sidebar + main

Recursive: layouts can nest layouts.

### ViewRenderer

**File: `app/components/ViewRenderer.tsx`**

The workhorse component. Each View is a kernel entity with a `dataSource` config.

Flow:
1. Load View config entity from kernel
2. Parse `dataSource` → concept/action/params (or query expression)
3. Invoke kernel to fetch data
4. Enrich ContentNode results with Schema memberships
5. Apply filters (toggle-group type with color-coded buttons and counts)
6. Apply sorts
7. Render through display type

### Display types

| Type | Component | Description |
|------|-----------|-------------|
| `table` | TableDisplay / DataTable | Configurable columns, bulk actions, row actions |
| `card-grid` | CardGridDisplay | Card layout with badges |
| `graph` | GraphDisplay | Force-directed SVG graph |
| `stat-cards` | StatCardsDisplay | Stat card grid |
| `board` | BoardDisplay | Kanban-style columns |
| `calendar` | CalendarDisplay | Calendar view |
| `canvas` | CanvasDisplay | Spatial canvas |
| `detail` | DetailDisplay | Single entity detail |

### DisplayMode resolution

Each ViewRenderer can specify a `defaultDisplayMode`. The DisplayMode concept resolves which widget component renders each item. DisplayModes are kernel entities — adding a new display type is a seed, not code.

---

## 7. Entity Detail — The Triple-Zone Layout

**File: `app/views/EntityDetailView.tsx`**

When viewing a single entity (e.g., `/admin/content/{id}`), the triple-zone layout renders:

```
┌──────────────────────────────────────────────────────┐
│ Zone 1: Header                                        │
│ Entity title, Schema badges, lifecycle status          │
├──────────────────────────────┬───────────────────────┤
│ Zone 2: Body                 │ Zone 3: Sidebar       │
│                              │                       │
│ ContentBodyDisplay           │ Relations             │
│ (blocks, rich text)          │ Workflow state         │
│                              │ Taxonomy tags          │
│ InlineEdit fields            │ Version pins           │
│                              │ Quality gates          │
│ BlockEditor                  │ Origin / provenance    │
│ (structured content)         │ TextSpan annotations   │
│                              │                       │
└──────────────────────────────┴───────────────────────┘
```

### Entity operations

- **Schema management**: Apply/remove Schemas to entities
- **FormMode**: Full form editing mode (respects field mutability)
- **InlineEdit**: Click-to-edit individual fields
- **CreateForm**: Dynamic form generated from Schema field definitions

---

## 8. Content Model

All domain data flows through two core concepts working together:

### ContentNode

The universal entity. Every piece of data in the system is a ContentNode with:
- `type` — a base content-type string (e.g., "page", "document"). This is a low-level classification, **not** the primary typing mechanism.
- `content` — structured body (blocks, rich text)
- `metadata` — arbitrary JSON
- `createdBy`, `createdAt`, `updatedAt` — provenance and timestamps

ContentNode is deliberately untyped on its own. It becomes meaningful through Schema membership.

### Schema — The Multi-Membership Type System

Schemas are **type mixins** that can be applied to any ContentNode. A single entity can have **many schemas applied simultaneously**, and a schema can be applied to many entities. This is the core typing mechanism:

- `Schema/applyTo(entity_id, schema)` — applies a schema as a type mixin
- `Schema/removeFrom(entity_id, schema)` — removes the schema
- `Schema/getAssociations(schema)` — lists all entities with this schema
- `ContentNode/listBySchema(schema)` — server-side join returning nodes with a given schema and their full schema list

A ContentNode with schemas `["Article", "Commentable", "Versionable"]` has all three sets of fields and behaviors. Schemas define:
- **Fields** (name, type, required, default, validation)
- **Inheritance** via `extendSchema(schema, parent)` — a schema inherits fields from its parent
- Access policies (view, create, edit, delete)
- Display preferences

This means adding a new "type" to the system is just defining a new Schema and applying it — no code changes, no migrations. An entity's type is the **set of schemas applied to it**, not a single fixed string.

102 seed ContentNodes are loaded at boot. All pages display data dynamically through ViewRenderer — no hardcoded content.

---

## 9. Rich Content Editing

### Block system

**Files: `lib/block-tree-utils.ts`, `lib/block-serialization.ts`**

Content bodies are structured as block trees (paragraphs, headings, lists, embeds). Immutable tree operations:
- flatten, find, update, insert, remove
- indent/outdent (nesting)
- Block ↔ JSON serialization

### Block embeds

**Files: `app/components/widgets/BlockEditor.tsx`, `BlockEmbed.tsx`, `SnippetEmbed.tsx`**

Rich text supports embedded content:
- `BlockEmbed` — embedded entities (other ContentNodes)
- `SnippetEmbed` — code blocks, quotes, references

### Text span addressing

**Files: `lib/use-entity-spans.ts`, `lib/span-highlight.ts`, `lib/span-deep-links.ts`**

Text spans allow annotations on specific ranges within content:
- Offset-based addressing within blocks
- HTML span highlighting
- Deep linking to specific text selections
- `useEntitySpans()` hook loads spans for an entity
- `SpanToolbar` / `SpanGutter` for annotation UI

---

## 10. Version Awareness

### Version pins

**File: `lib/use-version-pins.ts`**

Entities can be pinned to specific versions. The hook provides:
- Pin freshness (current, stale, outdated)
- Policy (auto-advance, manual, locked)
- Versions behind count

### Version spaces

**File: `lib/use-active-space.ts`**

Branching model for content. The space indicator bar in AppShell shows the active version space. Supports:
- Creating version spaces (branches)
- Navigating between spaces
- Merge resolution (with dedicated layout panel)
- Version comparison (side-by-side diff)

### Multiverse view

**File: `app/views/MultiverseView.tsx`**

Visual navigation of version spaces — the branching history of content.

---

## 11. Specialized Views

| View | File | Purpose |
|------|------|---------|
| DashboardView | `app/views/DashboardView.tsx` | Stat cards, key metrics |
| ContentView | `app/views/ContentView.tsx` | Content list with schema filters |
| SchemasView | `app/views/SchemasView.tsx` | Schema management |
| WorkflowsView | `app/views/WorkflowsView.tsx` | Workflow state machines |
| AutomationsView | `app/views/AutomationsView.tsx` | Automation rules |
| TaxonomyView | `app/views/TaxonomyView.tsx` | Classification hierarchies |
| ThemesView | `app/views/ThemesView.tsx` | Theme management |
| DisplayModesView | `app/views/DisplayModesView.tsx` | Display mode editor |
| ConceptBrowserView | `app/views/ConceptBrowserView.tsx` | Concept/handler metadata |
| ProcessRunView | `app/views/ProcessRunView.tsx` | Workflow execution visualization |
| StepChecksView | `app/views/StepChecksView.tsx` | Quality gate checks |
| MultiverseView | `app/views/MultiverseView.tsx` | Version space navigation |
| LayoutBuilderView | `app/views/LayoutBuilderView.tsx` | Layout designer |
| WorkspaceManagerView | `app/views/WorkspaceManagerView.tsx` | Workspace editor |
| ScoreView | `app/views/ScoreView.tsx` | Code analysis queries |
| ViewsView | `app/views/ViewsView.tsx` | View configuration |
| SyncsView | `app/views/SyncsView.tsx` | Sync rule browser |
| MappingsView | `app/views/MappingsView.tsx` | Component mappings |
| AccessAdmin | `app/components/AccessAdmin.tsx` | RBAC management |

---

## 12. Theming

**Files: `lib/theme-selection.ts`, `themes/`**

Themes are kernel-managed concept entities with:

| Token | Values |
|-------|--------|
| mode | light, dark |
| density | compact, normal, spacious |
| motif | topbar, sidebar |
| styleProfile | minimal, default, rich |
| cssVariables | palette, typography, spacing, elevation, radius, motion |

Resolution:
1. `pickActiveTheme()` selects active theme by priority + activation status
2. `resolveThemeDocumentState()` extracts CSS variables
3. Variables applied to `<html>` element as `data-*` attributes and inline styles
4. Themes can extend/override each other

---

## 13. Seed Pipeline

**Directory: `seeds/` (65 YAML files)**

All initial data is declarative YAML, loaded by the kernel boot sequence.

| Category | Examples |
|----------|---------|
| Infrastructure | RuntimeRegistry, FileCatalog, Transport, PlatformAdapter |
| Navigation | DestinationCatalog (14 destinations), Shell, Navigator |
| Content model | Schema definitions, ContentNode seeds (102 nodes) |
| UI config | View, Layout, DisplayMode, ComponentMapping, Affordance |
| Domain | Workflow, AutomationRule, Taxonomy, Relation |
| Quality | Metric, QualityProfile, QualityGate |
| Data pipeline | DataSourceSpec, FilterSpec, SortSpec, GroupSpec |
| Display | PresentationSpec, ProjectionSpec, InteractionSpec |

The seed pipeline is idempotent — `ensureSeeded()` runs once per process.

---

## 14. Destinations (Navigation Registry)

**File: `lib/destinations.ts`**

14 registered pages, grouped for the sidebar:

| Group | Destinations |
|-------|-------------|
| Overview | Home (dashboard) |
| Content | Content, Schemas, Display Modes |
| Structure | Workflows, Automations, Taxonomies |
| Design | Themes, Layouts, Workspaces |
| System | Concepts, Views, Syncs, Mappings |
| Advanced | Score, Multiverse, Access |

Each destination is a DestinationCatalog entry mapping a name to a URL path, group, icon, and description.

---

## 15. Suite Composition

**File: `suites/app-shell/suite.yaml`**

clef-base composes these suites:

| Suite | What it provides |
|-------|-----------------|
| `ui-app` | Navigator, Shell, Host, Transport, PlatformAdapter |
| `surface-integration` | Widget rendering, layout |
| `identity-integration` | Access control (roles, permissions, policies) |
| `entity-lifecycle` | Content versioning, syncs |
| `version-space-integration` | Version pins, aliases, branches |
| `hono-routing` | HTTP routing |
| `offline-first` | Replica sync |

---

## 16. Key Architectural Patterns

### Everything is a concept

Views, layouts, display modes, themes, destinations, schemas, workflows — all are concept entities managed by the kernel. Adding a new page is a seed file, not a code change.

### Single RPC endpoint

All client-server communication goes through `POST /api/invoke/{concept}/{action}`. No custom REST endpoints per feature.

### View = dataSource + filters + displayType

Every page is a View entity that declares what data to fetch, how to filter it, and how to render it. The ViewRenderer is generic — it doesn't know about specific domain types.

### Schema-driven content

ContentNodes are untyped until Schemas are applied. A single entity can have multiple Schemas (like interfaces). Field definitions, validation, and access policies come from Schema, not code.

### Declarative seeding over imperative setup

65 YAML seed files define the initial state. No migration scripts, no imperative setup code. The kernel applies seeds idempotently on boot.

---

## 17. Configuration

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `CLEF_BASE_ADMIN_USERNAME` | `admin` | Default admin user |
| `CLEF_BASE_ADMIN_PASSWORD` | `change-me-now` | Default admin password |
| `CLEF_BASE_AUTH_PROVIDER` | `local` | Auth backend |
| `CLEF_BASE_PUBLIC_TITLE` | — | Setup page title |
| `CLEF_BASE_PUBLIC_BODY` | — | Setup page content |
| `KV_REST_API_URL` | — | Upstash KV URL |
| `KV_REST_API_TOKEN` | — | Upstash KV token |

### Dependencies

- Next.js 15, React 19, TypeScript
- Upstash KV (or in-memory fallback)
- Port 4006 (dev & prod)

### Build

```bash
cd clef-base
npm run dev     # Development server on :4006
npm run build   # Production build
npm run start   # Production server
```
