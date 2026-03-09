# ClefOS Full Bootstrapping Implementation Plan

**Date:** 2026-03-06
**Dependencies:** COPF v0.18.0, Concept Library v0.4.0 (559 concepts, 47 derived, 1252 syncs), Clef Surface v0.4.0 (172 widgets, 3 themes)
**Output:** Complete implementation roadmap — every concept, sync, widget, and build step needed to go from the existing libraries to a running ClefOS instance.

---

## Part I: Inventory & Gap Analysis

### 1. Existing Assets Available

#### 1.1 Concepts Already in the Library (Usable As-Is)

These concepts exist in the concept library and are directly consumed by ClefOS. Grouped by the ClefOS subsystem they serve.

**Entity Foundation (13 concepts)**
- `ContentNode` (foundation) — base content representation
- `ContentParser` (foundation) — parsing dispatch
- `ContentStorage` (foundation) — raw storage backend
- `Property` (foundation) — dynamic key-value properties
- `TypeSystem` (foundation) — type definitions and validation
- `Schema` (classification) — structural schemas for metadata/mixins
- `Tag` (classification) — content categorization labels
- `Taxonomy` (classification) — hierarchical vocabularies
- `Namespace` (classification) — hierarchical namespace management
- `Validator` (infrastructure) — write-time constraint enforcement
- `PluginRegistry` (infrastructure) — provider registration/resolution
- `EventBus` (infrastructure) — application pub/sub
- `Cache` (infrastructure) — key-value caching with TTL

**Page/Record Engine (8 concepts)**
- `PageAsRecord` (foundation) — structured content pages
- `Outline` (foundation) — hierarchical document structure
- `Canvas` (content) — block-based rich content editing
- `DailyNote` (content) — date-keyed journal entries
- `Template` (content) — reusable content templates
- `Version` (content) — content version history
- `SyncedContent` (content) — real-time collaborative sync
- `Intent` (foundation) — user intent capture for action routing

**Presentation & Views (4 concepts)**
- `DisplayMode` (presentation) — display mode management
- `FormBuilder` (presentation) — dynamic form generation
- `Renderer` (presentation) — rendering pipeline
- `View` (presentation) — configurable content views

**Query & Search (3 concepts)**
- `Query` (query-retrieval) — query execution
- `ExposedFilter` (query-retrieval) — user-facing filters
- `SearchIndex` (query-retrieval) — search coordination

**Linking (4 concepts)**
- `Reference` (linking) — forward links
- `Backlink` (linking) — reverse index
- `Relation` (linking) — typed bidirectional relationships
- `Alias` (linking) — alternative names/URLs

**Layout & Computation (4 concepts)**
- `Component` (layout) — UI component composition
- `Formula` (computation) — formula definitions and computation
- `ExpressionLanguage` (computation) — expression parsing/evaluation
- `Token` (computation) — tokenization

**Automation & Workflow (7 concepts)**
- `AutomationRule` (automation) — user-configurable rules
- `Control` (automation) — UI controls for automation
- `Queue` (automation) — queued action processing
- `Workflow` (automation) — state machine orchestration
- `AutomationDispatch` (automation-providers) — dispatch coordination
- `AutomationScope` (automation-providers) — allowlist/denylist
- `ManifestAutomationProvider` (automation-providers) — build-time registries
- `SyncAutomationProvider` (automation-providers) — runtime user-defined syncs
- `AutomationTarget` (automation-providers) — automation manifests

**Identity & Access (4 concepts)**
- `Authentication` (identity) — identity verification
- `Authorization` (identity) — permission evaluation
- `AccessControl` (identity) — resource-level access policies
- `Session` (identity) — session lifecycle

**Media & Files (2 concepts)**
- `FileManagement` (media) — file upload/lifecycle
- `MediaAsset` (media) — media entity interface

**Data Organization (2 concepts)**
- `Collection` (data-organization) — ordered/filtered collections
- `Graph` (data-organization) — typed graph overlays

**Collaboration & Notification (3 concepts)**
- `Comment` (content) — threaded discussion
- `Flag` (collaboration) — content flagging
- `Group` (collaboration) — user group management
- `Notification` (notification) — multi-channel notifications

**Infrastructure & Config (2 concepts)**
- `ConfigSync` (infrastructure) — config synchronization
- `Pathauto` (infrastructure) — automatic URL/path generation

**Data Integration (10 concepts)**
- `DataSource`, `Connector`, `Capture`, `FieldMapping`, `Transform`, `Enricher`, `SyncPair`, `DataQuality`, `Provenance`, `ProgressiveSchema`

**Interface/Bind Suite (8+ concepts)**
- `Projection`, `Generator`, `ApiSurface`, `Middleware`, `Grouping`, `ActionGuide`, `Annotation`, `EnrichmentRenderer`
- Target providers: REST, GraphQL, gRPC, CLI, MCP, ClaudeSkills
- SDK providers: TypeScript, Python, Go, Rust, Java, Swift
- Spec providers: OpenAPI, AsyncAPI

**Deploy Suite (7+ concepts)**
- `DeployPlan`, `Rollout`, `Migration`, `Health`, `Env`, `Telemetry`, `Artifact`
- Coordination: Runtime, Secret, IaC, GitOps, Builder, Toolchain
- Runtime providers: Vercel, Lambda, K8s, CloudRun, DockerCompose, etc.

**Package Management (from library)**
- `KitManager` (framework) — suite lifecycle/dependency resolution
- `Registry` (package) — package registry
- `Manifest` (package) — package manifests
- `Auditor` (package) — security auditing
- `SelfUpdate` (package) — self-update mechanism

**Clef Surface (29 concepts across 7 suites)**
- surface-core: `DesignToken`, `Element`, `UISchema`, `Binding`, `Signal`
- surface-component: `Widget`, `Machine`, `Slot`, `Interactor`, `Affordance`, `WidgetResolver`
- surface-render: `FrameworkAdapter`, `Surface`, `Layout`, `Viewport` + 15 platform adapters
- surface-theme: `Theme`, `Palette`, `Typography`, `Motion`, `Elevation`
- surface-app: `Navigator`, `Host`, `Transport`, `Shell`, `PlatformAdapter` + 5 platform adapters
- surface-spec: `WidgetParser`, `ThemeParser`, `WidgetGen`, `ThemeGen`

#### 1.2 Widgets Already in the Library (172 total)

**Repertoire base widgets (125)** — the primitives ClefOS builds screens from:
- Layout: `accordion`, `card`, `card-grid`, `drawer`, `popover`, `tabs`, `separator`, `empty-state`, `skeleton`
- Navigation: `breadcrumb`, `context-menu`, `pagination`
- Input: `button`, `checkbox`, `checkbox-group`, `chip`, `color-picker`, `combobox`, `date-picker`, `file-upload`, `number-input`, `radio-group`, `range-slider`, `rating`, `segmented-control`, `select`, `switch`, `text-input`, `textarea`, `time-picker`, `token-input`, `tree-select`
- Display: `alert`, `avatar`, `badge`, `chart`, `code-block`, `data-list`, `data-table`, `gauge`, `hover-card`, `icon`, `image-gallery`, `label`, `markdown-preview`, `stat-card`, `toast`, `toast-manager`, `tooltip`, `visually-hidden`
- Rich editing: `block-editor`, `inline-edit`
- Canvas/Graph: `canvas`, `canvas-connector`, `canvas-node`, `minimap`
- Process: `workflow-editor`, `workflow-node`, `automation-builder`, `state-machine-diagram`
- Specialized: `backlink-panel`, `cache-dashboard`, `kanban-board`, `timeline`

**Domain-specific widgets (47)** — pre-built for specific concept families:
- formal-verification (8): `coverage-source-view`, `dag-viewer`, `formula-display`, `proof-session-tree`, `status-grid`, `trace-step-controls`, `trace-timeline-viewer`, `verification-status-badge`
- governance (9): `deliberation-thread`, `proposal-card`, `vote-result-bar`, `execution-pipeline`, `guard-status-panel`, `timelock-countdown`, `circle-org-chart`, `delegation-graph`, `weight-breakdown`
- llm (19): `agent-timeline`, `hitl-interrupt`, `memory-inspector`, `reasoning-block`, `task-plan-list`, `artifact-panel`, `chat-message`, `conversation-sidebar`, `inline-citation`, `message-branch-nav`, `prompt-input`, `stream-text`, `generation-indicator`, `prompt-template-editor`, `execution-metrics-panel`, `guardrail-config`, `tool-call-detail`, `message-actions`
- package (3): `audit-report`, `dependency-tree`, `registry-search`
- process (8): `expression-toggle-input`, `execution-overlay`, `run-list-table`, `variable-inspector`, `approval-stepper`, `sla-timer`, `eval-results-table`, `prompt-editor`
- repertoire extras: `approval-tracker`, `quorum-gauge`, `segmented-progress-bar`

#### 1.3 Existing Derived Concepts Relevant to ClefOS

From the concept library, these derived concepts already compose building blocks:
- `AppShell` (ui-app) — already composes Shell, Navigator, Transport, ThemeSystem
- `NewApp` — composes foundation concepts for new app scaffolding
- `ContentHistory` — composes Version with content concepts
- `WikiPage` — block-based wiki page pattern
- `PublishWorkflow` — composes Workflow for publishing
- `TagHierarchy` — composes Tag + Taxonomy
- `MediaLibrary` — composes FileManagement + MediaAsset + Tag
- `DataPipeline` — composes data integration concepts
- `AdaptiveLayout` — composes Surface + Layout + Viewport
- `ThemeSystem` — composes Theme + Palette + Typography + Motion + Elevation
- `SemanticWidgetSelection` — composes Interactor + Affordance + WidgetResolver

---

### 2. Gap Analysis: What Must Be Created

#### 2.1 New Concepts (3 required)

**EntityReflection** — The uniform entity interface. This is the single most critical new concept.
```
concept EntityReflection [E] {
  purpose {
    Provide a uniform reflective interface over all entity types,
    enabling generic load/save/delete/query/list-fields/get-display/get-form
    operations delegated to concept-specific actions via routing syncs.
  }
  state {
    types: set E
    typeName: E -> String
    domain: E -> String          // "content" | "config"
    bundles: E -> set String
    fieldAttachments: E -> list {
      fieldName: String,
      fieldType: String,
      cardinality: String,
      bundle: String
    }
    instances: set E
    instanceType: E -> String
    instanceBundle: E -> option String
  }
  actions {
    registerType(name: String, domain: String) -> ok(type: E) | alreadyExists
    registerBundle(type: E, bundle: String) -> ok | unknownType
    attachField(type: E, bundle: String, field: String, fieldType: String, cardinality: String)
      -> ok | unknownType | unknownBundle | fieldExists
    load(type: String, id: E) -> ok(entity: E, fields: String) | notFound | accessDenied
    save(type: String, id: E, fields: String) -> ok(entity: E) | validationError | accessDenied
    delete(type: String, id: E) -> ok | notFound | accessDenied
    query(type: String, filters: String, sort: String, limit: Int, offset: Int)
      -> ok(results: list E, total: Int) | invalidQuery
    listFields(type: String, bundle: String) -> ok(fields: String) | unknownType
    getDisplayMode(type: String, bundle: String, mode: String) -> ok(config: String) | notFound
    getFormMode(type: String, bundle: String, mode: String) -> ok(config: String) | notFound
  }
}
```

**ConceptBrowser** — Package discovery and installation UI.
```
concept ConceptBrowser [P] {
  purpose {
    Enable discovery, preview, installation, and management of Clef packages
    from registries, with dependency resolution and compatibility checking.
  }
  state {
    searches: set P
    searchQuery: P -> String
    searchResults: P -> list { name: String, version: String, description: String, compatibility: String }
    installed: set P
    installedVersion: P -> String
    installPlans: set P
    planResolution: P -> String  // serialized dependency graph
    planStatus: P -> String      // "pending" | "approved" | "installing" | "complete" | "failed"
    previews: set P
    previewData: P -> String     // what the package adds (concepts, widgets, syncs)
  }
  actions {
    search(query: String, filters: String) -> ok(results: list P) | registryUnavailable
    preview(packageName: String, version: String) -> ok(preview: P) | notFound
    planInstall(packageName: String, version: String) -> ok(plan: P) | dependencyConflict | incompatible
    confirmInstall(plan: P) -> ok | planExpired | dependencyConflict
    uninstall(packageName: String) -> ok | dependents | notInstalled
    checkUpdates() -> ok(updates: list P) | registryUnavailable
    applyUpdate(packageName: String, targetVersion: String) -> ok | dependencyConflict
  }
}
```

**AppShell** — Root derived concept. Note: an `AppShell` derived already exists in the library composing Shell + Navigator + Transport + ThemeSystem. The ClefOS AppShell extends this to compose the full application.
```
derived ClefOSApp [E] {
  purpose {
    Root application composing all ClefOS features into a single deployable
    application with content UI, admin UI, and concept browser.
  }
  composes {
    derived AppShell [E]        // existing: Shell + Navigator + Transport + ThemeSystem
    EntityReflection [E]        // NEW
    ConceptBrowser [E]          // NEW
    derived ContentHistory [E]  // existing
    derived PublishWorkflow [E] // existing
    derived MediaLibrary [E]    // existing
    derived TagHierarchy [E]    // existing
    derived WikiPage [E]        // existing
    // All wiring done via syncs below
  }
  syncs {
    required: [
      entity-reflection-routing,
      entity-reflection-storage-bridge,
      entity-reflection-access-bridge,
      entity-reflection-schema-bridge,
      entity-reflection-cache-bridge,
      entity-reflection-search-bridge,
      appshell-navigation-setup,
      appshell-route-entity-page,
      appshell-route-view,
      content-domain-defaults,
      config-domain-defaults,
      admin-navigation-setup,
      concept-browser-kit-manager-bridge,
    ]
  }
  surface action createContent(type: String, bundle: String) {
    matches: EntityReflection/save(type: ?type)
  }
  surface action browsePackages(query: String) {
    matches: ConceptBrowser/search(query: ?query)
  }
  surface query listEntities(type: String) -> EntityReflection/query(type: ?type)
  principle {
    after createContent(type: "article", bundle: "article")
    then listEntities(type: "article") includes created entity
  }
}
```

#### 2.2 New Syncs Required (67 syncs across 12 groups)

These syncs do not exist in the library and must be written to wire ClefOS together.

**Group 1: Entity Reflection Routing (8 syncs)**

```
sync entity-reflection-routing [eager]
  Purpose: Route EntityReflection generic operations to concept-specific actions

sync entity-save-triggers-validation [eager]
  when EntityReflection/save -> ok
  then Validator/validate

sync entity-save-triggers-cache-invalidation [eager]
  when EntityReflection/save -> ok
  then Cache/invalidate

sync entity-save-triggers-search-index [eventual]
  when EntityReflection/save -> ok
  then SearchIndex/index

sync entity-save-triggers-pathauto [eager]
  when EntityReflection/save -> ok
  then Pathauto/generate

sync entity-save-triggers-provenance [eventual]
  when EntityReflection/save -> ok
  then Provenance/record

sync entity-delete-triggers-cleanup [eager]
  when EntityReflection/delete -> ok
  then Reference/removeAll, Backlink/reindex, Comment/detach, SearchIndex/remove

sync entity-type-registration-triggers-schema [eager]
  when EntityReflection/registerType -> ok
  then Schema/create
```

**Group 2: Entity-Schema Bridge (6 syncs)**

```
sync schema-attaches-fields-to-entity [eager]
  when Schema/apply -> ok
  then EntityReflection/attachField for each schema field

sync bundle-creates-schema-config [eager]
  when EntityReflection/registerBundle -> ok
  then Schema/create for bundle's field config

sync field-type-maps-to-widget [eager]
  when EntityReflection/listFields -> ok
  then Interactor/classify for each field → WidgetResolver/resolve

sync field-type-maps-to-formatter [eager]
  when DisplayMode/resolve -> ok
  then Interactor/classify for each visible field → WidgetResolver/resolve (display context)

sync field-type-maps-to-form-widget [eager]
  when FormBuilder/resolve -> ok
  then Interactor/classify for each editable field → WidgetResolver/resolve (edit context)

sync schema-mixin-merges-fields [eager]
  when Schema/apply -> ok (as mixin)
  then EntityReflection/attachField for mixin fields without overwriting
```

**Group 3: Dual Domain Wiring (4 syncs)**

```
sync content-entity-storage-routing [eager]
  when EntityReflection/save -> ok
  where EntityReflection: { ?e domain: "content" }
  then ContentStorage/write (to primary storage backend)

sync config-entity-storage-routing [eager]
  when EntityReflection/save -> ok
  where EntityReflection: { ?e domain: "config" }
  then ConfigSync/write (to YAML serialization)

sync config-change-triggers-rebuild [eventual]
  when ConfigSync/write -> ok
  then Cache/invalidateAll(tag: "config")

sync content-domain-access-defaults [eager]
  when AccessControl/check -> ok
  where EntityReflection: { ?e domain: "content" }
  then Authorization/evaluate with content-domain role rules
```

**Group 4: Page/Record Engine Wiring (8 syncs)**

```
sync page-as-record-syncs-structured-zone [eager]
  when PageAsRecord/setProperty -> ok
  then EntityReflection/save (structured zone update)

sync page-as-record-syncs-body-zone [eager]
  when Canvas/updateBlock -> ok
  then PageAsRecord/markBodyDirty → Version/createRevision

sync block-reference-creates-backlink [eager]
  when Canvas/insertBlock -> ok (with block reference)
  then Reference/addRef → Backlink/reindex

sync block-transclusion-syncs-content [eager]
  when SyncedContent/update -> ok
  then Canvas/updateTranscludedBlock

sync daily-note-creates-page [eager]
  when DailyNote/open -> ok
  then PageAsRecord/ensureEntity (with date-based bundle)

sync template-populates-page [eager]
  when Template/apply -> ok
  then PageAsRecord/setProperty for each template field
  then Canvas/insertBlock for each template block

sync outline-restructure-updates-taxonomy [eventual]
  when Outline/move -> ok
  then Taxonomy/reclassify (if outline maps to taxonomy)

sync document-mode-cascades-to-children [eager]
  when DisplayMode/set -> ok (document mode)
  then DisplayMode/cascade to child blocks unless overridden
```

**Group 5: View/Query/Collection Wiring (7 syncs)**

```
sync view-config-routes-to-query [eager]
  when View/render -> ok
  then Query/execute with view's source/filters/sort configuration

sync view-config-routes-to-collection [eager]
  when View/render -> ok (collection source)
  then Collection/members → Query/execute

sync exposed-filter-updates-view [eager]
  when ExposedFilter/change -> ok
  then View/updateFilters → View/render

sync embedded-view-scopes-to-entity [eager]
  when View/render -> ok (embedded in entity page)
  where Relation: { ?entity related: ?targets }
  then Query/execute scoped to related entities

sync formula-field-recomputes-on-change [eager]
  when EntityReflection/save -> ok
  then Formula/evaluate for all formula fields on that entity type

sync view-formula-column-evaluates [eager]
  when View/render -> ok
  then Formula/evaluate for each formula column per row

sync collection-membership-change-triggers-view-refresh [eventual]
  when Collection/add -> ok OR Collection/remove -> ok
  then View/invalidate for views sourced from that collection
```

**Group 6: Field Triad Surface Pipeline (5 syncs)**

```
sync field-type-registers-interactor [eager]
  when EntityReflection/attachField -> ok
  then Interactor/classify (determines abstract interaction type from field metadata)

sync interactor-resolves-display-widget [eager]
  when Interactor/classify -> ok (display context)
  then WidgetResolver/resolve → select FieldFormatter widget

sync interactor-resolves-edit-widget [eager]
  when Interactor/classify -> ok (edit context)
  then WidgetResolver/resolve → select FieldWidget

sync selection-plugin-constrains-reference [eager]
  when WidgetResolver/resolve -> ok (for entity reference field)
  then Query/execute with selection plugin constraints

sync widget-inline-edit-swap [eager]
  when Control/activate -> ok (inline edit trigger)
  then Interactor/reclassify(display→edit) → WidgetResolver/resolve → swap widget
```

**Group 7: Taxonomy/Comment/Media Integration (6 syncs)**

```
sync taxonomy-field-provides-hierarchical-options [eager]
  when Interactor/classify -> ok (taxonomy field)
  then Taxonomy/getTree → WidgetResolver/resolve(hierarchical-picker)

sync comment-attaches-to-entity [eager]
  when Comment/create -> ok
  then EntityReflection/load(target) → Notification/send(to: mentioned users)

sync comment-threads-via-materialized-path [eager]
  when Comment/reply -> ok
  then Comment/updatePath (materialized path threading)

sync file-upload-creates-media-entity [eager]
  when FileManagement/upload -> ok
  then EntityReflection/save(type: "media", bundle: detected-type)
  then MediaAsset/create

sync media-reference-cleanup [eventual]
  when EntityReflection/delete -> ok (media entity)
  then FileManagement/checkReferences → FileManagement/garbageCollect

sync media-provides-per-platform-preview [eager]
  when DisplayMode/resolve -> ok (media field)
  then MediaAsset/getPreview(platform: current) → WidgetResolver/resolve
```

**Group 8: Automation & Workflow Wiring (6 syncs)**

```
sync automation-rule-evaluates-condition [eager]
  when EventBus/emit -> ok
  then AutomationRule/evaluate
  where AutomationRule: { ?rule enabled: true }
  then AutomationDispatch/execute

sync workflow-transition-checks-permission [eager]
  when Workflow/transition -> ok
  then AccessControl/check(permission: transition-specific)
  then EntityReflection/save(entity: workflow-entity, status: new-state)

sync workflow-transition-triggers-automation [eventual]
  when Workflow/transition -> ok
  then EventBus/emit(event: "workflow.transition")

sync content-moderation-default-workflow [eager]
  // Wires the default Draft→Review→Published→Archived workflow
  when EntityReflection/save -> ok (new content entity)
  then Workflow/initState(state: "draft")

sync automation-scope-enforces-safety [eager]
  when AutomationDispatch/execute -> ok
  then AutomationScope/check(scope: rule's scope config)

sync queue-processes-deferred-actions [eventual]
  when Queue/enqueue -> ok
  then Queue/process → AutomationDispatch/execute
```

**Group 9: Identity & Access Wiring (4 syncs)**

```
sync entity-access-check-on-load [eager]
  when EntityReflection/load -> ok
  then AccessControl/check(entity: loaded, operation: "view")

sync entity-access-check-on-save [eager]
  when EntityReflection/save -> ok
  then AccessControl/check(entity: target, operation: "edit")

sync field-level-access-filtering [eager]
  when EntityReflection/listFields -> ok
  then AccessControl/check per field → filter invisible fields

sync role-based-navigation-filtering [eager]
  when Navigator/getItems -> ok
  then AccessControl/check per nav item → filter inaccessible routes
```

**Group 10: AppShell & Navigation Wiring (6 syncs)**

```
sync appshell-registers-content-navigation [eager]
  when EntityReflection/registerType -> ok (domain: "content")
  then Navigator/addItem(section: "content", label: type name, target: default view)

sync appshell-registers-admin-navigation [eager]
  when EntityReflection/registerType -> ok (domain: "config")
  then Navigator/addItem(section: "admin", label: type name, target: config view)

sync appshell-registers-concept-browser [eager]
  when ConceptBrowser/search -> ok (first call)
  then Navigator/addItem(section: "admin", label: "Packages", target: browser view)

sync appshell-route-to-entity-page [eager]
  when Navigator/navigate -> ok (entity route)
  then EntityReflection/load → DisplayMode/resolve → render entity page

sync appshell-route-to-view [eager]
  when Navigator/navigate -> ok (view route)
  then View/render in main content area

sync appshell-global-search [eager]
  when SearchIndex/search -> ok
  then View/render(results, style: "compact-list") in command palette
```

**Group 11: ConceptBrowser ↔ KitManager Bridge (4 syncs)**

```
sync browser-search-queries-registry [eager]
  when ConceptBrowser/search -> ok
  then Registry/search → format results

sync browser-plan-delegates-to-kit-manager [eager]
  when ConceptBrowser/planInstall -> ok
  then KitManager/resolve(dependencies) → ConceptBrowser/setPlanResolution

sync browser-install-delegates-to-kit-manager [eager]
  when ConceptBrowser/confirmInstall -> ok
  then KitManager/install → EntityReflection/registerType for each new concept

sync browser-uninstall-checks-dependents [eager]
  when ConceptBrowser/uninstall -> ok
  then KitManager/checkDependents → proceed or reject
```

**Group 12: Bind Manifest & Deploy Wiring (3 syncs)**

```
sync dual-manifest-auto-generation [eventual]
  when EntityReflection/registerType -> ok
  then Projection/project → ApiSurface/compose (for appropriate manifest)

sync bind-manifest-config-is-entity [eager]
  // Bind manifests are themselves config entities
  when EntityReflection/save -> ok (type: "bind_manifest")
  then Generator/plan → Target/dispatch → Emitter/write

sync deploy-plan-is-entity [eager]
  // Deploy plans are config entities
  when EntityReflection/save -> ok (type: "deploy_plan")
  then DeployPlan/validate
```

#### 2.3 New Widgets Required (23 new widgets)

These widgets do not exist in the current 172-widget library and must be created as `.widget` specs.

**Entity Page Widgets (5)**

1. **`entity-page-layout`** — Four-region entity page compositor (property, body, view, layout regions). Arranges the sub-widgets for a single entity's full page view.
   - Anatomy: `root → propertyRegion → bodyRegion → viewRegion → layoutRegion`
   - Affordance: serves `entity-page`, specificity 10

2. **`property-panel`** — Notion-style property panel rendering entity fields through FieldFormatters/FieldWidgets. Supports compact (collapsed) and expanded modes.
   - Anatomy: `root → fieldList → fieldRow → fieldLabel → fieldValue → editTrigger`
   - Affordance: serves `entity-properties`, specificity 10

3. **`entity-toolbar`** — Action bar for entity pages showing available actions (Edit, Publish, Delete, More) filtered by current user permissions and workflow state.
   - Anatomy: `root → primaryActions → secondaryActions → moreMenu`
   - Affordance: serves `entity-actions`, specificity 10

4. **`entity-sidebar`** — Context sidebar showing backlinks, comments, version history, relations, metadata as collapsible sections.
   - Anatomy: `root → sectionList → section → sectionHeader → sectionContent`
   - Affordance: serves `entity-context`, specificity 10

5. **`quick-capture`** — Floating capture input for creating new entities with minimal fields (title + body block).
   - Anatomy: `root → bundleSelector → titleInput → bodyInput → submitButton`
   - Affordance: serves `entity-create-quick`, specificity 12

**View System Widgets (5)**

6. **`view-header`** — View title bar with display style switcher, exposed filters, new-entity button, and settings gear.
   - Anatomy: `root → title → styleSwitcher → filterBar → actions`
   - Affordance: serves `view-chrome`, specificity 10

7. **`view-builder`** — Form mode for View config entities. Source selector, style selector, field configurator, filter configurator, sort/group, live preview.
   - Anatomy: `root → sourceConfig → styleSelector → fieldList → filterConfig → sortConfig → preview`
   - Affordance: serves `entity-editor`, specificity 16, when { concept: View }

8. **`display-mode-editor`** — Admin editor for display mode configurations: field visibility, order, grouping, formatter selection per field.
   - Anatomy: `root → fieldList → fieldRow → visibilityToggle → orderHandle → formatterSelect → preview`
   - Affordance: serves `entity-editor`, specificity 16, when { concept: DisplayMode }

9. **`bundle-field-manager`** — Admin field management for bundles: add/remove/reorder fields, set field types, cardinality, validation.
   - Anatomy: `root → fieldList → addFieldButton → fieldRow → fieldName → fieldType → cardinality → dragHandle`
   - Affordance: serves `entity-editor`, specificity 16, when { concept: Schema }

10. **`calendar-view`** — Calendar display style for views, rendering entities as events on a month/week/day grid.
    - Anatomy: `root → header → navigation → viewSwitch → calendarGrid → eventSlot → dayCell`
    - Affordance: serves `view-display`, specificity 14, when { viewType: calendar }

**Admin UI Widgets (4)**

11. **`navigation-editor`** — Drag-and-drop tree editor for the app shell navigation structure.
    - Anatomy: `root → tree → treeItem → dragHandle → itemLabel → iconPicker → targetSelector`
    - Affordance: serves `entity-editor`, specificity 16, when { concept: Navigator }

12. **`workflow-state-editor`** — Form mode for Workflow config entities: state list, transition editor, permission matrix.
    - Anatomy: `root → stateGraph → stateNode → transitionEdge → permissionMatrix → preview`
    - Affordance: serves `entity-editor`, specificity 18, when { concept: Workflow }

13. **`bind-manifest-editor`** — The bind workbench: concept selector, grouping editor, per-concept settings, preview, generate button.
    - Anatomy: `root → conceptSelector → groupingTree → conceptSettings → previewPanel → generateButton`
    - Affordance: serves `entity-editor`, specificity 18, when { concept: Projection }

14. **`config-export-import`** — Config sync controls: export all config to YAML, import config, diff between environments.
    - Anatomy: `root → exportButton → importDropzone → diffViewer → environmentSelector`
    - Affordance: serves `entity-actions`, specificity 14, when { concept: ConfigSync }

**Concept Browser Widgets (3)**

15. **`package-browser`** — Full concept browser: search, filter, gallery of package cards, install flow.
    - Anatomy: `root → searchBar → filterPanel → packageGrid → packageCard → detailPanel → installButton`
    - Affordance: serves `entity-page`, specificity 16, when { concept: ConceptBrowser }

16. **`install-plan-viewer`** — Dependency resolution preview: what will be added/changed, dependency tree, confirm/cancel.
    - Anatomy: `root → summary → addedList → changedList → dependencyTree → confirmButton → cancelButton`
    - Affordance: serves `entity-detail`, specificity 18, when { concept: ConceptBrowser }

17. **`package-detail-card`** — Expanded card for a single package: description, what it adds, dependencies, compatibility, install control.
    - Anatomy: `root → header → description → conceptList → syncList → widgetList → compatibility → installAction`
    - Affordance: serves `entity-card`, specificity 16, when { concept: Registry }

**Score IDE Widgets (3)**

18. **`concept-graph-navigator`** — Visual graph of all concepts with sync connections, suite memberships, dependency relationships. Click-to-navigate.
    - Anatomy: `root → graphCanvas → conceptNode → syncEdge → suiteCluster → detailPanel → searchFilter`
    - Affordance: serves `entity-graph`, specificity 16, when { suite: semantic }

19. **`sync-chain-viewer`** — Trace any action through the sync chain as an interactive tree showing data flow.
    - Anatomy: `root → tree → syncNode → dataFlowBadge → expandButton → filterBar`
    - Affordance: serves `entity-detail`, specificity 18, when { concept: FlowTrace }

20. **`ast-explorer`** — Drill into parsed AST via SyntaxTree, navigate definitions, see symbol references.
    - Anatomy: `root → tree → astNode → symbolHighlight → scopeIndicator → sourcePreview`
    - Affordance: serves `entity-detail`, specificity 18, when { concept: SyntaxTree }

**Progressive Formalization Widgets (3)**

21. **`structure-detector-panel`** — Shows proposed promotions from freeform text to typed properties (kv_detector, llm_detector results).
    - Anatomy: `root → proposalList → proposal → detectedType → detectedValue → acceptButton → dismissButton`
    - Affordance: serves `entity-detail`, specificity 14

22. **`schema-applicator`** — Inline control for applying a schema/mixin to an entity, showing field preview before application.
    - Anatomy: `root → schemaSelector → fieldPreview → applyButton → cancelButton`
    - Affordance: serves `entity-actions`, specificity 14, when { concept: Schema }

23. **`formula-editor`** — Inline editor for formula fields with syntax highlighting, autocomplete, and live preview.
    - Anatomy: `root → editor → autocomplete → preview → errorDisplay`
    - Affordance: serves `entity-editor`, specificity 16, when { concept: Formula }

#### 2.4 New Themes Required

No new themes are strictly required — the existing `light`, `dark`, and `high-contrast` themes provide the token foundation. However, the following theme extensions should be created as config entities during Phase 2:

- **ClefOS Admin theme** — denser spacing, monospace accents for config entities
- **ClefOS Editorial theme** — optimized for long-form reading, serif body fonts
- **ClefOS Dashboard theme** — compact stat cards, chart-optimized colors

These are theme *config entities*, not new theme concepts.

---

## Part II: Bootstrapping Sequence

The build order matters. Each step depends on prior steps being complete. The key insight: ClefOS bootstraps itself — early phases create the config entities that later phases are managed through.

### Phase 0 — Project Scaffolding (Week 1)

**Goal:** Repository structure, toolchain, and development environment.

**Steps:**

0.1. Initialize Clef project:
```bash
clef init clefos --template empty
```

0.2. Create suite structure:
```
clefos/
├── suites/
│   ├── entity-reflection/     # NEW suite
│   │   ├── suite.yaml
│   │   ├── EntityReflection.concept
│   │   └── syncs/
│   ├── concept-browser/       # NEW suite
│   │   ├── suite.yaml
│   │   ├── ConceptBrowser.concept
│   │   └── syncs/
│   └── clefos-app/            # NEW suite (the root derived)
│       ├── suite.yaml
│       ├── ClefOSApp.derived
│       └── syncs/
├── widgets/                   # NEW .widget specs
├── themes/                    # Theme config entities
├── config/                    # Default config entities (bundles, views, nav, workflows)
├── implementations/
│   └── typescript/            # Handler implementations
└── deploy/
    └── vercel/                # Default deployment config
```

0.3. Configure `suite.yaml` files with dependencies on existing library suites.

0.4. Set up development server:
```bash
clef dev --target web --framework nextjs
```

0.5. Verify toolchain: `clef check`, `clef generate`, `clef test` all pass on empty project.

**Deliverable:** Empty ClefOS project with correct suite structure, all dependencies declared.

---

### Phase 1 — EntityReflection & Typed Data Tree (Weeks 2–5)

**Goal:** The generic entity interface exists and can register types, attach fields, and perform CRUD via routing syncs.

**Step 1.1: Write the EntityReflection concept spec**
- Create `EntityReflection.concept` with all actions defined in §2.1 above.
- Run `clef generate` to produce TypeScript handler skeletons.

**Step 1.2: Implement EntityReflection handlers**
- `registerType` — stores type metadata, assigns to content/config domain.
- `registerBundle` — creates bundle subdivision of a type.
- `attachField` — wires field definitions to type+bundle, delegates type validation to TypeSystem.
- `load/save/delete` — generic CRUD that delegates to ContentStorage via routing syncs.
- `query` — generic query that delegates to Query concept.
- `listFields/getDisplayMode/getFormMode` — reflective metadata access.

**Step 1.3: Write entity-reflection routing syncs (Group 1)**
Write and compile all 8 syncs from §2.2 Group 1. These wire EntityReflection to:
- `Validator/validate` on save
- `Cache/invalidate` on save
- `SearchIndex/index` on save (eventual)
- `Pathauto/generate` on save
- `Provenance/record` on save (eventual)
- `Reference/removeAll` + `Backlink/reindex` + `Comment/detach` + `SearchIndex/remove` on delete
- `Schema/create` on type registration

**Step 1.4: Write entity-schema bridge syncs (Group 2)**
Write 6 syncs connecting Schema to EntityReflection:
- Schema application attaches fields
- Bundle creation creates schema config
- Field types classify to interactors
- Display/form mode resolution triggers widget resolution

**Step 1.5: Write dual-domain wiring syncs (Group 3)**
Write 4 syncs routing content entities to ContentStorage and config entities to ConfigSync.

**Step 1.6: Implement typed data tree**
The reflection protocol: Entity → FieldItemList → FieldItem → Property → raw value. This is implemented as a TypeScript interface pattern that EntityReflection enforces — each field carries type info from TypeSystem, validation from Validator, and change propagation via EventBus.

**Step 1.7: Register default entity types**
Create config entities (in YAML) for the initial types:
- Content types: `article`, `page`, `media`, `comment`, `taxonomy_term`, `user_profile`
- Config types: `bundle`, `field_definition`, `display_mode`, `form_mode`, `view`, `workflow`, `automation_rule`, `navigation_item`, `bind_manifest`, `deploy_plan`, `theme`

**Step 1.8: Wire existing concepts for bundles & field triad**
- Bundle config entities use Schema to define field sets per entity type.
- FieldType = Property + TypeSystem (what data it stores).
- FieldWidget = Interactor/classify → WidgetResolver/resolve in edit context.
- FieldFormatter = Interactor/classify → WidgetResolver/resolve in display context.
- Write field triad surface pipeline syncs (Group 6, 5 syncs).

**Step 1.9: Wire Reference, Relation, and selection plugins**
- Existing `bidirectional-links.sync` already wires Reference → Backlink.
- Existing `relation-reference-bridge.sync` already mirrors Relation links as References.
- NEW: `selection-plugin-constrains-reference` sync (from Group 6) — constrains reference fields to specific entity sets.

**Step 1.10: Wire Taxonomy**
- Vocabulary = config entity (registered via EntityReflection).
- Term = content entity (registered via EntityReflection).
- Taxonomy hierarchical selection → Interactor classifies as "multi-select from hierarchical set" → WidgetResolver picks `tree-select` widget.
- Write `taxonomy-field-provides-hierarchical-options` sync (Group 7).

**Step 1.11: Wire Comments**
- Comment = content entity with polymorphic attachment.
- Write `comment-attaches-to-entity` and `comment-threads-via-materialized-path` syncs (Group 7).
- Default: content entities get prominent comments; config entities get tucked-away admin comments.

**Step 1.12: Wire FileManagement + MediaAsset**
- Write `file-upload-creates-media-entity`, `media-reference-cleanup`, `media-provides-per-platform-preview` syncs (Group 7).

**Step 1.13: Wire Identity suite defaults**
- Write all 4 identity/access syncs (Group 9).
- Built-in roles: anonymous, authenticated, editor, admin.
- Three-valued access algebra: allowed/neutral/forbidden.

**Step 1.14: Integration tests**
- Register a type, attach fields, create an entity, load it, query it, delete it.
- Verify all sync chains fire correctly.
- Verify access control blocks unauthorized operations.
- Verify cache invalidation, search indexing, provenance all fire on save.

**Deliverable:** A working entity system where you can register types, create/read/update/delete entities with typed fields, and all cross-cutting concerns (validation, caching, search, access control, pathauto, provenance) fire automatically via syncs.

---

### Phase 2 — Frontend Shell & Entity Pages (Weeks 6–10)

**Goal:** The app shell renders, entity pages display, inline editing works, and the admin UI is navigable.

**Step 2.1: Write AppShell navigation syncs (Group 10)**
Write 6 syncs wiring navigation:
- Content types auto-register in content navigation section.
- Config types auto-register in admin navigation section.
- Routes resolve to either View (list) or entity page (detail).
- Global search powered by SearchIndex.

**Step 2.2: Create the 5 entity page widgets**
Write `.widget` specs for:
- `entity-page-layout` — four-region compositor
- `property-panel` — Notion-style property panel
- `entity-toolbar` — action bar with permission-filtered actions
- `entity-sidebar` — backlinks, comments, versions, relations
- `quick-capture` — floating new-entity input

Run `clef generate` to produce React component skeletons via WidgetGen.

**Step 2.3: Implement React components for entity page widgets**
Using the existing Surface React adapter (`FrameworkAdapter` for React):
- `entity-page-layout`: Renders four regions using the display mode config to determine which fields go where.
- `property-panel`: Maps each field to its FieldFormatter/FieldWidget via the Surface pipeline. Clicking a field value swaps formatter for widget (inline edit).
- `entity-toolbar`: Queries available actions from EntityReflection + AccessControl, renders as buttons/dropdown.
- `entity-sidebar`: Renders collapsible sections, each containing a View (backlinks, comments, etc.).
- `quick-capture`: Bundle selector + minimal form, submits via EntityReflection/save.

**Step 2.4: Create the 5 view system widgets**
Write `.widget` specs and implement:
- `view-header` — title + style switcher + filters + actions
- `view-builder` — form mode for View config entities
- `display-mode-editor` — admin editor for display modes
- `bundle-field-manager` — admin field management
- `calendar-view` — calendar display style

**Step 2.5: Wire existing repertoire widgets to entity display**
Map existing widgets to entity presentation contexts via affordance declarations:
- `data-table` → serves table-style views (already affordance: `group-repeating`)
- `kanban-board` → serves board-style views
- `card-grid` → serves gallery-style views (already affordance: `group-repeating`)
- `timeline` → serves timeline-style views
- `chart` → serves chart formatters in dashboard views
- `block-editor` → serves body region editing
- `backlink-panel` → serves entity sidebar backlinks section
- `data-list` → serves list-style views
- `tabs` → serves tabbed entity page regions
- `accordion` → serves collapsible sections

No new widget code needed — the Interactor/WidgetResolver pipeline selects these automatically based on context.

**Step 2.6: Implement the Next.js app shell**
Using the existing Surface Browser platform adapter:
- Layout: sidebar (navigation tree) + top bar (search, quick-capture, user menu) + main content area.
- Routing: `/content/:type` → View of that type's entities. `/content/:type/:id` → Entity page. `/admin/:type` → Config entity View. `/admin/:type/:id` → Config entity page.
- Navigation sidebar populated from `Navigator` concept's items (auto-generated from registered types).
- Command palette (Cmd+K) backed by SearchIndex + entity reflection.
- Breadcrumbs via Pathauto.

**Step 2.7: Wire theme system**
- Default `light` theme applied via existing ThemeSystem derived concept.
- Theme switching via user preference (stored in Session).
- Create ClefOS Admin, Editorial, and Dashboard theme config entities.

**Step 2.8: Create the 4 admin UI widgets**
Write specs and implement:
- `navigation-editor` — drag-and-drop tree for nav structure
- `workflow-state-editor` — workflow config editor
- `bind-manifest-editor` — the bind workbench
- `config-export-import` — config sync controls

**Step 2.9: Integration tests**
- Navigate the app shell: sidebar shows content types and admin sections.
- Click a content type → see a View (table style) of entities.
- Click an entity → see entity page with property panel, body, sidebar.
- Click Edit → property panel swaps to form mode.
- Save → validation fires, cache invalidates, search updates.
- Admin section → navigate to bundle config, display mode config, view config.
- Inline editing works on entity pages.

**Deliverable:** A navigable web application with working list screens, entity detail pages, inline editing, and admin UI for managing types/fields/views/display modes.

---

### Phase 3 — Unified Page/Record Editor (Weeks 11–15)

**Goal:** Every entity has a dual-zone page with rich block editing, slash commands, and document modes.

**Step 3.1: Wire PageAsRecord syncs (Group 4)**
Write 8 syncs connecting the page/record engine:
- Structured zone ↔ EntityReflection bridge
- Body zone ↔ Canvas bridge with version creation
- Block reference → backlink creation
- Transclusion → SyncedContent bridge
- DailyNote → PageAsRecord bridge
- Template → page population
- Outline → taxonomy bridge
- Document mode cascading

**Step 3.2: Integrate block-editor widget**
The existing `block-editor` widget provides the Notion-like block editing experience. Wire it:
- Each block type (paragraph, heading, list, quote, code, table, image, embed, divider, callout, toggle) has a Schema defining its fields.
- Block types are registered via EntityReflection as content entities with composition ownership.
- Slash command menu queries available block types from EntityReflection.
- Block references (`((block-id))`) create Reference entries via syncs.
- Wiki links (`[[entity-name]]`) create Reference entries and render as inline chips.

**Step 3.3: Implement slash command embedding**
Extend the block editor's slash menu to include:
- Embedded View (inserts a View widget inline in the body)
- Button/Control (inserts an interactive control)
- File/Media (inserts a media reference)
- Block Reference (transclusion)
- Layout Section (switches to layout-first mode for a subtree)

Each slash command creates a block whose type maps to the appropriate Surface widget.

**Step 3.4: Implement display modes, form modes, and document modes**
All three are config entities managed via EntityReflection:
- Display modes: full, card, table-row, chip, watch-summary
- Form modes: quick, full, admin, bulk
- Document modes: prose, bullets, numbered, task-list, kanban

Document mode cascading: setting "bullets" on a parent block cascades to children unless overridden.

**Step 3.5: Implement DailyNote integration**
- DailyNote/open creates a PageAsRecord entity with date-keyed bundle.
- Navigation sidebar has a "Today" quick-access entry.
- DailyNote page uses document-first mode with easy capture.

**Step 3.6: Implement Template system**
- Template config entities define field defaults and block content.
- Applying a template populates both structured zone (field values) and body zone (blocks).
- Templates are installable as package artifacts.

**Step 3.7: Create progressive formalization widgets**
Write specs and implement:
- `structure-detector-panel` — shows kv_detector/llm_detector proposals
- `schema-applicator` — inline schema/mixin application with preview
- `formula-editor` — inline formula editing with autocomplete

**Step 3.8: Integration tests**
- Create an entity → see property panel + empty body.
- Type in body → block editor creates paragraph blocks.
- Use slash commands → insert embedded views, code blocks, images.
- Apply a schema → new fields appear in property panel.
- Block references and wiki links create backlinks.
- DailyNote opens today's journal.
- Template application populates fields and body.

**Deliverable:** Full dual-zone entity editing with rich blocks, slash commands, document modes, templates, and progressive formalization.

---

### Phase 4 — View/Query/Collection Fusion (Weeks 16–20)

**Goal:** Views, queries, formulas, and collections work seamlessly.

**Step 4.1: Wire view/query/collection syncs (Group 5)**
Write 7 syncs connecting views to queries, collections, exposed filters, formulas.

**Step 4.2: Implement all view display styles**
Using existing widgets + new calendar widget:
- **Table**: existing `data-table` widget. Columns from view config.
- **List**: existing `data-list` widget.
- **Gallery/Card**: existing `card-grid` widget.
- **Board/Kanban**: existing `kanban-board` widget. Group by selected field.
- **Calendar**: new `calendar-view` widget. Map date field to event slots.
- **Timeline**: existing `timeline` widget.
- **Graph**: existing `canvas` widget with auto-layout for entity graph.
- **Tree/Outline**: tree view using nested data-list.
- **Dashboard**: entity page in layout-first mode with embedded views.

View style switching = changing one property on the View config entity.

**Step 4.3: Implement the view builder widget**
The `view-builder` widget (created in Phase 2) is the form mode of a View config entity:
- Source selector: collection, query, or relation traversal.
- Style selector: tabs for each display style.
- Field configurator: sortable list with visible/hidden toggle, formatter selector, column width.
- Filter configurator: add filters, choose exposed vs. fixed.
- Group/sort configurator: pick grouping field, sort fields.
- Live preview: bottom half shows the view rendered with current settings.

**Step 4.4: Implement Collection concept for concrete and virtual membership**
- Concrete collections: explicit member lists (like databases/folders).
- Virtual collections: live queries (like smart folders).
- Views project over either type.

**Step 4.5: Implement embedded query blocks**
Queries embedded in body content via slash commands:
- `/query tasks where status = "open" and project = this` → renders as inline table/list.
- Live-updating: changes to matching entities refresh the embedded view.
- Dual-mode compilation: simple syntax → Datalog/SQL.

**Step 4.6: Implement formula system (all 5 scopes)**
- **Field formulas**: computed properties on entities (e.g., `total = price * quantity`).
- **View formulas**: computed columns in views (e.g., sum, average, count).
- **Inline formulas**: document-embedded computed values (e.g., `= count(tasks where done)`).
- **Graph formulas**: traversal-based computations over relations.
- **Semantic extraction formulas**: AI-driven metadata extraction from body content.

Wire ExpressionLanguage + Formula + syncs to entity/view contexts.

**Step 4.7: Implement ExposedFilter as page-embeddable controls**
Exposed filters render in the view header as interactive controls. Users adjust filters without editing the view definition. Filters are themselves FieldWidgets resolved through the Surface pipeline.

**Step 4.8: Implement progressive formalization pipeline**
Structure-detector plugins:
- `kv_detector`: regex-based detection of key-value pairs, dates, tags in freeform text.
- `llm_detector`: LLM-powered detection of structured content in prose.
Both propose promotions via the `structure-detector-panel` widget. User accepts → Schema/apply fires.

**Step 4.9: Integration tests**
- Create views with all display styles → verify data renders correctly.
- Switch styles → same data, different widget.
- Use view builder → configure source, filters, columns, sort → live preview updates.
- Embed a query in an entity body → see live results inline.
- Create a formula field → value computes on entity save.
- Create a view formula column → aggregation shows in view.
- Exposed filters → toggle filter values → view refreshes.

**Deliverable:** Full view system with all display styles, view builder, formulas, embedded queries, and progressive formalization.

---

### Phase 5 — Automation, Workflow & Process (Weeks 21–24)

**Goal:** Three-tier automation dispatch is wired, content moderation workflow works, and process suite integrates.

**Step 5.1: Wire automation & workflow syncs (Group 8)**
Write 6 syncs for automation rule evaluation, workflow transitions, and content moderation.

**Step 5.2: Implement default Content Moderation workflow**
Config entity defining: Draft → Review → Published → Archived.
- Transitions require permissions (editor can submit for review, reviewer can publish).
- Publishing triggers cache invalidation and search indexing via existing syncs.
- Workflow state renders as a FieldFormatter (state badge) and FieldWidget (transition buttons).

**Step 5.3: Wire AutomationRule UI**
- AutomationRule config entities are editable via the existing `automation-builder` widget.
- Users create event-condition-action rules: "when [event] if [condition] then [action]".
- AutomationScope provides allowlist/denylist safety.
- Existing `workflow-editor` widget handles visual workflow definition.

**Step 5.4: Integrate Process Kit (optional install)**
If installed via ConceptBrowser, the Process Kit's 20 concepts across 6 sub-suites integrate:
- ProcessSpec, ProcessRun, StepRun, FlowToken, ProcessVariable, WorkItem
- Timer, Escalation (SLA tracking)
- LLMCall, ToolRegistry, EvaluationRun (LLM-assisted processing)
- ProcessEvent (audit ledger)
- Existing widgets: `execution-overlay`, `run-list-table`, `variable-inspector`, `approval-stepper`, `sla-timer`, `eval-results-table`, `prompt-editor`

**Step 5.5: Wire Notification concept**
- Workflow transitions, automation rule actions, comment mentions → Notification/send.
- Notification center is a View of notification entities (unread first, grouped by source).
- On mobile: native push. On web: dropdown. On watch: wrist alert.

**Step 5.6: Integration tests**
- Create a content entity → starts in Draft state.
- Attempt unauthorized publish → access denied.
- Submit for review → state transitions to Review.
- Publish → state transitions to Published, cache invalidates, search indexes.
- Create an automation rule → fires on matching event.
- AutomationScope blocks out-of-scope actions.
- If process kit installed: create a process spec, run it, observe steps executing.

**Deliverable:** Working automation, workflow, and (optionally) process orchestration.

---

### Phase 6 — Package Browser & Bind Workbench (Weeks 25–30)

**Goal:** Apps are extensible via a browser and generate their own interfaces.

**Step 6.1: Write ConceptBrowser concept spec and handlers**
Create `ConceptBrowser.concept` with all actions defined in §2.1. Implement handlers for search, preview, planInstall, confirmInstall, uninstall, checkUpdates, applyUpdate.

**Step 6.2: Wire ConceptBrowser ↔ KitManager syncs (Group 11)**
Write 4 syncs bridging browser UI to KitManager dependency resolution.

**Step 6.3: Create concept browser widgets**
Write specs and implement:
- `package-browser` — full browser UI with search, filter, gallery
- `install-plan-viewer` — dependency resolution preview
- `package-detail-card` — expanded package info

Wire to existing widgets:
- `registry-search` (already exists) → package search
- `dependency-tree` (already exists) → install plan dependencies
- `audit-report` (already exists) → package security audit

**Step 6.4: Implement dual-manifest Bind architecture**
Write `dual-manifest-auto-generation` and `bind-manifest-config-is-entity` syncs (Group 12).
- **Config manifest**: auto-generated covering all config entity types → produces admin CLI, config REST API, config MCP server, config GraphQL, admin SDK, `.claude` directory.
- **Content manifest**: auto-generated covering all content entity types → produces content CLI, content REST API, content MCP server, content GraphQL, user SDK.

**Step 6.5: Implement bind workbench UI**
The `bind-manifest-editor` widget (created in Phase 2) is the form mode for Bind manifests:
- Concept selector: View of available concepts with checkboxes.
- Grouping editor: drag-and-drop tree for API resource organization.
- Per-concept settings: auth, rate limits, pagination, field visibility.
- Preview panel: live-updating generated output snippets.
- Generate button: triggers Projection → ApiSurface → Generator → Target → Emitter.

**Step 6.6: Generate default outputs**
For every ClefOS app, auto-generate:
- CLI with subcommand groups mirroring entity hierarchy
- REST API with OpenAPI spec
- MCP server for AI-assisted administration
- GraphQL schema
- SDKs (TypeScript at minimum)
- `.claude` directory with CLAUDE.md
- Claude Skills for common workflows

**Step 6.7: Implement starter app publishing**
A resolved set of concepts + views + widgets + themes + bind manifests + deploy defaults = a starter app. Publish to registry. Install "issue tracker", "CRM", "knowledge base" as starting points.

**Step 6.8: Integration tests**
- Open concept browser → search packages → see results.
- Preview a package → see what it adds.
- Plan install → see dependency resolution.
- Confirm install → package installs, new types register, navigation updates.
- Open bind workbench → select concepts → configure grouping → preview generated API.
- Generate → CLI, REST, MCP, GraphQL, SDK all produced.
- Uninstall package → clean removal.

**Deliverable:** Working package browser, bind workbench, and dual-manifest interface generation.

---

### Phase 7 — Score IDE Integration (Weeks 31–34)

**Goal:** Full inspection across software structure and runtime content.

**Step 7.1: Create Score IDE widgets**
Write specs and implement:
- `concept-graph-navigator` — visual concept graph with click-to-navigate
- `sync-chain-viewer` — action trace through sync chains
- `ast-explorer` — AST drill-down with symbol navigation

These consume existing Score concepts (ConceptEntity, ActionEntity, SyncEntity, SyntaxTree, DefinitionUnit, Symbol, ScopeGraph, FlowTrace) from the code representation and semantic suites.

**Step 7.2: Implement dual navigation mode**
Every entity reachable via:
- Frontend UI route (entity page in the admin/content interface)
- File representation (`.concept` spec, `.sync` file, generated code)
- Instant switching between the two modes via a toggle Control.

**Step 7.3: Wire hierarchical tracing**
derivedContext tags from the derived concept hierarchy provide feature-scoped debug grouping. FlowTrace renders as an interactive tree (using `sync-chain-viewer` widget) with clean boundaries per feature.

**Step 7.4: Integration tests**
- Open concept graph → see all registered concepts with sync connections.
- Click a concept node → navigate to its entity page or spec file.
- Trigger an action → see sync chain trace in viewer.
- Open AST explorer → navigate parsed file structure.

**Deliverable:** Score IDE tools embedded in the ClefOS admin interface.

---

### Phase 8 — Multi-Platform Surfaces & Deployment (Weeks 35–40)

**Goal:** Same app definition deploys to web, phone, desktop, watch.

**Step 8.1: Web target (Next.js on Vercel)**
- Per-page rendering strategy as config entity property: SPA, SSG, SSR, RSC, pure in-browser.
- Default: admin pages = SPA, content pages = SSR, static pages = SSG.
- Write `deploy-plan-is-entity` sync (Group 12).
- Default deployment pipeline: `clef dev` → `clef test` → staging on Vercel → production with progressive rollout.

**Step 8.2: Implement render pipeline**
- Declarative render tree.
- Cache lookup before subtree render (Cache concept).
- Cacheability metadata bubbling upward.
- Placeholdering for dynamic subtrees.
- Progressive streaming for dynamic regions.

**Step 8.3: Mobile targets (Android/iOS)**
- Jetpack Compose (Android) and SwiftUI (iOS) via existing Surface adapters.
- Offline-first: ContentStorage stores locally via Replica, syncs via SyncPair, resolves conflicts via ConflictResolution.
- Views default to card/list style (tables scroll horizontally).
- Entity pages use stacked vertical layout.
- Quick capture via home screen widget.

**Step 8.4: Desktop targets**
- GTK (Linux), WinUI (Windows), AppKit/SwiftUI (macOS) via existing Surface adapters.
- Multi-window support.
- Local-first with background sync.

**Step 8.5: Watch targets**
- WearCompose (Android Wear), WatchKit (Apple Watch) via existing Surface adapters.
- Read-only glances: "watch" display mode shows title + 2-3 key fields.
- Quick capture via voice.
- Reduced Bind manifest (read + quick-action only).

**Step 8.6: Config sync & GitOps**
- ConfigSync serializes all config to YAML.
- Layered environment overrides (dev/staging/prod).
- Pluggable IaC providers and Runtime providers swappable in admin UI.

**Step 8.7: Integration tests**
- `clef dev` starts dev server.
- `clef test` runs all tests.
- Deploy to Vercel staging → app accessible at preview URL.
- Mobile build → installable APK/IPA with offline capability.
- Watch build → read-only glances work.

**Deliverable:** ClefOS deployable to web, mobile, desktop, and watch from a single definition.

---

### Phase 9 — Polish, Performance & Dogfooding (Weeks 41–44)

**Goal:** ClefOS is self-hosting, performant, and ready for real use.

**Step 9.1: Self-hosting verification**
- ClefOS manages its own config entities through its own admin UI.
- Display mode config entities have their own display modes.
- View config entities are browsable via Views.
- Theme config entities are styled by the current theme.

**Step 9.2: Performance optimization**
- Implement render pipeline caching (cache-before-render pattern).
- Optimize query compilation (simple queries → fast SQL path).
- Bundle splitting for web target (lazy-load admin UI, Score IDE).
- Service worker for offline web support.

**Step 9.3: Starter app creation**
Create and publish starter apps:
- **Knowledge Base** — WikiPage-focused, backlinks prominent, graph view default.
- **Project Management** — Kanban views, workflow states, timeline views.
- **CMS** — Article bundles, content moderation workflow, SEO fields.
- **CRM** — Contact/Deal/Company entity types, pipeline board view.
- **Internal Tools** — FormBuilder-focused, automation rules, dashboard layouts.

**Step 9.4: Documentation**
Auto-generate via Bind:
- `.claude/CLAUDE.md` with full API reference.
- OpenAPI spec for REST API.
- GraphQL schema documentation.
- CLI help text.
- SDK quickstart guides.

**Deliverable:** A polished, self-hosting application platform with starter apps and documentation.

---

## Part III: Dependency Graph Summary

```
Phase 0: Scaffolding
  ↓
Phase 1: EntityReflection + Typed Data + Field Triad + Identity
  ↓
Phase 2: App Shell + Entity Pages + Admin UI + Theme
  ↓
Phase 3: Page/Record Editor + Blocks + Slash Commands + Templates
  ↓
Phase 4: Views + Queries + Formulas + Collections + Progressive Formalization
  ↓
Phase 5: Automation + Workflow + Process + Notifications
  ↓
Phase 6: Package Browser + Bind Workbench + Interface Generation
  ↓
Phase 7: Score IDE + Dual Navigation + Tracing
  ↓
Phase 8: Multi-Platform + Deployment + Render Pipeline
  ↓
Phase 9: Polish + Starter Apps + Documentation
```

---

## Part IV: Summary Counts

| Category | Existing | New | Total |
|----------|----------|-----|-------|
| Concepts used from library | ~90 | 0 | ~90 |
| Concepts created for ClefOS | 0 | 2 (EntityReflection, ConceptBrowser) | 2 |
| Derived concepts used from library | ~12 | 0 | ~12 |
| Derived concepts created for ClefOS | 0 | 1 (ClefOSApp) | 1 |
| Syncs used from library | ~200+ | 0 | ~200+ |
| Syncs created for ClefOS | 0 | 67 (12 groups) | 67 |
| Widgets used from library | ~80 | 0 | ~80 |
| Widgets created for ClefOS | 0 | 23 | 23 |
| Themes used from library | 3 | 0 | 3 |
| Theme config entities created | 0 | 3 | 3 |
| Config entity types defined | 0 | ~11 | ~11 |
| Content entity types defined | 0 | ~6 | ~6 |
| Implementation timeline | — | — | 44 weeks |
| Starter apps | — | 5 | 5 |

The core architectural insight holds: **ClefOS introduces only 3 new concepts**. Everything else assembles from the existing 559-concept, 172-widget library via 67 new syncs that wire independent concepts into an integrated application platform. The syncs are the application.
