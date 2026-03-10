# Clef Surface — Reference

Surface is Clef's presentation layer. It defines **what** gets shown to a user
and **how** it adapts to different platforms, but never dictates a specific
framework or runtime. Surface operates in two distinct modes depending on
whether the host application uses Clef concepts or not.

---

## Two Modes of Operation

### Standalone Mode (no Clef concepts)

In standalone mode Surface is a **headless widget and theme specification
format**. You write `.widget` and `.theme` files, run the generation pipeline,
and get framework-specific component code (React, Vue, Svelte, etc.) plus
CSS/design-token output. There is no kernel, no sync engine, no concept
storage. The generated components are ordinary framework components that
accept props and emit events.

The pipeline is:

```
.widget / .theme file
  → WidgetParser / ThemeParser  (parse into AST)
  → WidgetGen / ThemeGen        (route to framework provider)
  → Generated component code    (React, Vue, Svelte, …)
```

In this mode the `connect` block in a widget spec maps props to
data-attributes on anatomy parts. The `affordance` block declares semantic
intent but is not resolved at runtime — it is metadata consumed by tooling.

### Connected Mode (with Clef concepts)

In connected mode Surface participates in the full Clef concept/sync network.
Widgets are resolved dynamically at runtime through affordance matching,
display modes, views, and component mappings. The sync engine connects concept
state changes to widget rendering and back.

Key additions in connected mode:

- **WidgetResolver** selects the best widget for a given interaction situation
  by scoring affordance declarations against runtime context (platform,
  viewport, option count, density).
- **DisplayMode** controls per-field rendering across presentation contexts
  (view, edit, teaser, embed).
- **View** provides multiple visual representations (table, board, calendar,
  gallery, list) of the same dataset with independent filter/sort/group.
- **ComponentMapping** lets admins override automatic resolution and manually
  bind entity data to widget slots and props.
- **SlotSource** dispatches data retrieval to pluggable providers that fetch
  entity fields, view results, embedded widgets, formulas, menus, and more.
- Syncs propagate concept state changes (version context, display mode
  resolution, entity saves) into Surface widget updates.

---

## Concept Inventory

Surface spans six repertoire suites, one generation suite, and one
integration suite. Clef Base adds its own presentation concepts on top.

### Repertoire: ui-core

Foundation primitives shared by all Surface layers.

| Concept | Purpose |
|---------|---------|
| **DesignToken** | W3C DTCG token hierarchy (primitive → semantic → component). Resolution chains, tier enforcement, exports. |
| **Binding** | Data binding between concept fields and UI elements. |
| **Element** | Lightweight render-tree node. |
| **Signal** | Reactive state-change notification. |
| **UISchema** | Declarative layout description consumed by Surface. |

### Repertoire: ui-component

Headless component model — what a widget IS, independent of rendering.

| Concept | Purpose |
|---------|---------|
| **Widget** | Catalog of registered WidgetASTs. Registration, retrieval, search. |
| **Affordance** | Declares what semantic interaction situations a widget can serve. Binds widget → interactor type with conditions and specificity ranking. |
| **Interactor** | Abstract interaction taxonomy. Classifies interactions by semantic purpose independent of any widget: `single-choice`, `text-input`, `range-select`, `date-point`, `color`, `file-attach`, `entity-page`, `context-stack`, `score-graph`, `score-trace`, `diff-view`, etc. |
| **WidgetResolver** | Context-aware selection of the best widget for a given interactor type. Merges runtime context, checks overrides, queries affordances, scores candidates, returns winner with explanation. |
| **Machine** | Finite state machine definition used by widget `states` blocks. |
| **Slot** | Named composition point in a widget's anatomy. |

### Repertoire: ui-render

Runtime rendering — adapting widgets to platforms and frameworks.

| Concept | Purpose |
|---------|---------|
| **Surface** | Deployment target declaration: `browser-dom`, `terminal`, `react-native`, `webview`, `ssr`, `static-html`. |
| **Layout** | Spatial arrangement primitives: stack, grid, split, overlay, flow, sidebar, center. |
| **Viewport** | Size detection and responsive breakpoints. |
| **FrameworkAdapter** | Plugin interface for rendering. One adapter per framework. |

Framework adapters (each is a separate concept): React, Vue, Svelte, Solid,
Vanilla, Ink (terminal), Next.js, React Native, AppKit, SwiftUI, Compose
(Android), GTK, NativeScript, WatchKit, Wear Compose, WinUI.

### Repertoire: presentation

Runtime presentation orchestration — how entities become rendered output.

| Concept | Purpose |
|---------|---------|
| **DisplayMode** | Named presentation profiles controlling per-field rendering in different contexts (view, edit, teaser). Admins define modes; `renderInMode` produces output. |
| **View** | Multiple visual representations (table, board, calendar, gallery, list) of the same dataset with independent filter/sort/group configuration. Views are embeddable and duplicable. |
| **Renderer** | Cache-aware rendering pipeline with placeholder support and streaming. Composes nested content into final output. |
| **FormBuilder** | Generates form structure from schema definitions. Delegates validation, widget selection, and field display to other concepts via syncs. |

### Surface Suite: surface-spec

Generation pipeline — parsing `.widget`/`.theme` files and producing code.

| Concept | Purpose |
|---------|---------|
| **WidgetParser** | Parses `.widget` source → WidgetAST. Validates grammar. |
| **ThemeParser** | Parses `.theme` source → ThemeAST. Validates contrast. |
| **WidgetGen** | Coordinator concept that dispatches generation to framework-specific providers via routing syncs. |
| **ThemeGen** | Generates CSS, Tailwind, React Native StyleSheet, terminal ANSI, W3C DTCG JSON from theme ASTs. |
| **WidgetGen{Framework}** | 16 optional provider concepts — one per framework target (React, Vue, Svelte, Solid, Ink, React Native, SwiftUI, AppKit, Compose, GTK, NativeScript, Next.js, Vanilla, WatchKit, Wear, WinUI). |

Generation syncs:
- `WidgetSpecParsed` — Resource loaded → WidgetParser/parse
- `ParsedWidgetRegistered` — Parse ok → Widget/register
- `ParsedAffordanceRegistered` — Parse ok → Affordance/declare
- `ThemeSpecParsed` — Resource loaded → ThemeParser/parse
- `ParsedThemeTokensRegistered` — Parse ok → DesignToken/register
- `RouteToWidgetGenProvider` — WidgetGen/generate → matching provider
- `WidgetGenerated` — WidgetAST → per-adapter code generation
- `ThemeGenerated` — ThemeAST → per-surface style generation

### Surface Suite: surface-integration

Syncs-only (no new concepts). Bridges domain concepts to Surface UI:
schema → UI, validation → form errors, notification → toast, workflow
transitions → widget state changes, event bus → live updates.

---

## Widget Specification Format (`.widget`)

A widget spec is a framework-agnostic, headless component declaration. It
defines structure, behavior, accessibility, and data binding without any
rendering code.

### Blocks

```
@version(1)
widget <name> {
  purpose { … }
  anatomy { … }
  states { … }
  affordance { … }
  accessibility { … }
  props { … }
  connect { … }
  compose { … }
  invariant { … }
}
```

#### purpose

1–3 sentences explaining the widget's semantic role.

#### anatomy

Named parts with semantic roles. Each part is typed:

| Role | Meaning |
|------|---------|
| `container` | Structural wrapper (div, section) |
| `text` | Text content (span, label, heading) |
| `action` | Interactive trigger (button, link) |
| `overlay` | Layered content (popover, dialog, tooltip) |
| `widget` | Embedded child widget |

```
anatomy {
  root:        container  { Top-level wrapper }
  label:       text       { Field name }
  trigger:     action     { Button that opens the picker }
  popover:     overlay    { Floating panel with options }
}
```

#### states

Finite state machine(s). An `[initial]` state is required. States declare
transitions on named events. Entry/exit actions can send signals.

```
states {
  closed [initial] {
    on OPEN -> open;
  }
  open {
    entry [positionContent];
    on CLOSE -> closed;
    on SELECT -> closed;
  }
}
```

Parallel state machines use `[parallel]`:
```
states [parallel] {
  popover { closed [initial] { … } open { … } }
  channel { rgb [initial] { … } hsl { … } oklch { … } }
}
```

#### affordance

Declares what semantic interaction situation this widget serves.

```
affordance {
  serves: single-choice;
  specificity: 10;
  when: optionCount <= 8;
}
```

- `serves` — the interactor type name
- `specificity` — higher wins when multiple widgets match
- `when` — optional conditions: `platform`, `viewport`, `optionCount`, `density`, `mutable`

#### accessibility

WCAG compliance. ARIA roles, keyboard shortcuts, focus management.

```
accessibility {
  role: listbox;
  modal: false;
  keyboard {
    ArrowDown  -> NEXT_OPTION;
    ArrowUp    -> PREV_OPTION;
    Enter      -> SELECT;
    Escape     -> CLOSE;
  }
  focus {
    trap: false;
    initial: trigger;
    roving: true;
  }
  aria {
    root -> {
      role: "listbox";
      aria-label: "Color picker";
    };
    trigger -> {
      aria-expanded: if state.popover == "open" then "true" else "false";
      aria-haspopup: "listbox";
    };
  }
}
```

#### props

Typed prop interface with defaults. Types: `String`, `Int`, `Float`, `Bool`,
`DateTime`, `list <Type>`, `option <Type>`, `Function`, union literals
(`"hex" | "rgb" | "hsl"`).

```
props {
  value: String = ""
  format: "hex" | "rgb" | "hsl" = "hex"
  disabled: Bool = false
  options: list OptionEntry = []
  onChange: option Function
}
```

#### connect

Data-attribute and event bindings per anatomy part. This is how the headless
spec connects to actual DOM/native elements.

```
connect {
  root -> {
    data-state: if state.popover == "open" then "open" else "closed";
    data-part: "root";
  }
  trigger -> {
    onClick: send(OPEN);
    aria-label: "Select color";
    data-part: "trigger";
  }
  swatch -> {
    style-background-color: ?value;
    data-part: "swatch";
  }
}
```

Binding types:
- `?propName` — bind to a prop value
- `self.propName` — bind to a local prop
- `send(EVENT)` — dispatch a state machine event
- `if <condition> then <a> else <b>` — conditional binding
- `concat(…)` — string concatenation
- String/number literals

#### compose

Embeds child widgets with configuration.

```
compose {
  trigger: widget("button", { variant: "outline", size: "sm" });
  _popover: widget("popover", { placement: "bottom-start" });
}
```

#### invariant

Natural-language constraints or formal pre/post conditions.

```
invariant {
  "Thumbs must not cross each other during drag";
  "Min value must always be less than max value";
}
```

---

## Theme Specification Format (`.theme`)

A theme spec defines a complete design system as structured tokens.

### Structure

```
@version(1)
theme <name> [extends <parent>] {
  palette { … }
  typography { … }
  spacing { … }
  motion { … }
  elevation { … }
  radius { … }
}
```

#### Inheritance

Themes support `extends` for variants. A dark theme typically overrides only
`palette` and `elevation`, inheriting `typography`, `spacing`, `motion`, and
`radius` from the light base:

```
theme dark extends light {
  palette { … }
  elevation { … }
}
```

#### palette

OKLCH color definitions organized by role. OKLCH provides perceptual
uniformity — equal numeric steps produce equal visual steps.

```
palette {
  primary: oklch(0.55 0.20 265)
  primary-hover: oklch(0.50 0.22 265)
  surface: oklch(0.99 0.005 265)
  on-surface: oklch(0.15 0.02 265)
  error: oklch(0.55 0.22 25)
  hover-state-layer: oklch(0.55 0.20 265 / 0.08)
}
```

#### typography

Modular scale with font families, sizes, weights, tracking.

```
typography {
  font-family-sans: "Inter, system-ui, sans-serif"
  display-lg: { size: 3.5rem, lineHeight: 1.12, weight: 700, tracking: -0.025em }
  body-md: { size: 1rem, lineHeight: 1.5, weight: 400, tracking: 0em }
  code-sm: { size: 0.875rem, lineHeight: 1.57, weight: 400, family: font-family-mono }
}
```

#### spacing

Scale tokens plus semantic aliases.

```
spacing {
  xs: 0.25rem
  sm: 0.5rem
  md: 1rem
  gutter: 1.5rem
  page-inline: 2rem
}
```

#### motion

Durations, easing curves, compound transitions, reduced-motion support.

```
motion {
  duration-fast: 150ms
  ease-default: cubic-bezier(0.2, 0, 0, 1)
  transition-fade: { property: opacity, duration: duration-fast, easing: ease-default }
  reduce-motion: prefers-reduced-motion
}
```

#### elevation

Shadow definitions by depth level plus semantic aliases.

```
elevation {
  level-1: 0 1px 3px 0 oklch(0.0 0 0 / 0.12)
  level-3: 0 6px 10px 0 oklch(0.0 0 0 / 0.14)
  elevation-card: level-1
  elevation-dialog: level-3
}
```

#### radius

Border-radius tokens plus semantic aliases.

```
radius {
  sm: 0.25rem
  md: 0.5rem
  full: 9999px
  radius-button: sm
  radius-card: md
}
```

---

## Widget Resolution Pipeline (Connected Mode)

When Clef concepts are present, widget selection is dynamic. The pipeline:

```
1. Interactor/classify
   A concept field (e.g. "status: T -> {active|archived}") is classified
   into an interactor type ("single-choice", cardinality: one, optionCount: 2).

2. WidgetResolver/resolve
   Takes the interactor type + runtime context (platform, viewport, density).
   Queries Affordance/match for all widgets that serve "single-choice".
   Scores by specificity and condition fit.
   Returns: widget="radio-group", score=0.9, reason="…"

3. Override path
   WidgetResolver/override forces a specific widget, bypassing affordance
   matching. Used by admin configuration (ComponentMapping) or UISchema.

4. WidgetResolver/explain
   Returns full trace: which affordances were considered, why winner won,
   what conditions matched/failed.
```

### Affordance Matching

Each widget declares what it can serve via its `affordance` block:

```
// radio-group.widget
affordance {
  serves: single-choice;
  specificity: 10;
  when: optionCount <= 8;
}

// select.widget
affordance {
  serves: single-choice;
  specificity: 5;
}
```

When WidgetResolver needs a widget for `single-choice` with `optionCount: 4`:
- Both `radio-group` (specificity 10, condition met) and `select`
  (specificity 5, no condition) match.
- `radio-group` wins with higher specificity.

When `optionCount: 50`:
- Only `select` matches (radio-group's condition fails).

---

## Display Modes

DisplayMode controls how each field renders in different presentation contexts.
A single entity can appear differently depending on the mode:

| Mode | Use Case | Example |
|------|----------|---------|
| `view` | Full read-only display | All fields visible, rich formatting |
| `edit` | Form editing | Fields as input widgets |
| `teaser` | Summary card | Title + thumbnail only |
| `embed` | Inline reference | Compact one-line display |
| `entity-page` | Full page with zones | Triple-zone layout |

Each mode has field-level configuration:
```
DisplayMode/configureFieldDisplay(mode: "teaser", field: "title", config: "truncated")
DisplayMode/configureFieldDisplay(mode: "teaser", field: "body", config: "hidden")
```

The `EntityPageUsesTripleZone` sync connects display mode resolution to
widget rendering:

```
sync EntityPageUsesTripleZone [eager]
when {
  DisplayMode/resolve: [ entity_id: ?entity_id; mode: "entity-page" ]
    => [ ok: ?display_config ]
}
where {
  ContentStorage: { ?entity_id schema: ?schema; fields: ?fields }
}
then {
  WidgetResolver/resolve: [
    interactor: "entity-page";
    props: [ entityId: ?entity_id; schema: ?schema; fields: ?fields ]
  ]
}
```

---

## Views

View provides multiple visual representations of the same data source.
Each view has its own filter, sort, group, and visible-field configuration.

Layout types: `table`, `board`, `calendar`, `gallery`, `list`.

Views are first-class entities — they can be duplicated, embedded (via
`ViewEmbedSource`), and shared. Changing the layout preserves all
filter/sort/group configuration.

---

## Component Mapping and Slot Sources (Clef Base)

Clef Base adds a manual binding layer on top of automatic resolution.

### ComponentMapping

Admin-configured bindings between entity data and widget slots/props.
Provides the manual override path when automatic `WidgetResolver` resolution
is insufficient.

A mapping binds a **Schema + DisplayMode** pair to a specific widget:

```
ComponentMapping/create(
  name: "Article Card",
  widget_id: "card",
  schema: "Article",
  display_mode: "teaser"
)
```

Then binds data sources to the widget's slots and props:

```
ComponentMapping/bindSlot(mapping: m, slot_name: "image",
  sources: ["entity_field:Article.featured_image"])
ComponentMapping/bindProp(mapping: m, prop_name: "title",
  source: "entity_field:Article.title")
```

At render time, all sources are resolved against entity context and a render
tree is produced for Surface consumption.

### SlotSource

Coordination concept with **pluggable providers** for retrieving data into
widget slots. Each provider handles a different data retrieval strategy.
Providers register via PluginRegistry and are dispatched via sync:

```
sync SlotSourceDispatchesToProvider [eager]
when {
  SlotSource/resolve: [ slot: ?slot; context: ?context ]
    => [ ok: ?source_config ]
}
where {
  PluginRegistry: { category: "slot_source_provider";
                    provider_id: ?slot.provider_id; handler: ?handler }
}
then {
  ?handler/resolve: [ slot: ?slot; context: ?context; config: ?source_config ]
}
```

### Slot Source Providers

| Provider | Purpose |
|----------|---------|
| **EntityFieldSource** | Reads a field value from an entity (e.g., `Task.title`). |
| **StaticValueSource** | Returns a fixed value (e.g., "Loading…"). |
| **WidgetEmbedSource** | Embeds another widget's output into a slot. |
| **ViewEmbedSource** | Executes a View query and renders the result set in a slot. |
| **BlockEmbedSource** | Embeds canvas/block content. |
| **MenuSource** | Produces dynamic menu items. |
| **FormulaSource** | Computes values from expressions. |
| **EntityReferenceDisplaySource** | Displays a referenced entity's summary. |

### Data Flow: Entity to Rendered Widget

```
1. User navigates to /article/art-123

2. DisplayMode/resolve fires with entity_id="art-123", mode="entity-page"

3. SYNC: EntityPageUsesTripleZone
   Queries ContentStorage for the entity's schema and fields.
   Fires WidgetResolver/resolve with interactor="entity-page".

4. SYNC: ResolverUsesComponentMapping
   WidgetResolver looks up ComponentMapping for schema="Article".
   If an admin mapping exists, it wins. Otherwise, affordance matching
   selects triple-zone-layout (serves: entity-page, specificity: 10).

5. ComponentMapping/render resolves all slot bindings:
   - Zone 1 slots: EntityFieldSource reads title, author, date from entity
   - Zone 2 slot: BlockEmbedSource fetches the entity's canvas content
   - Zone 3 slot: ViewEmbedSource runs a "related articles" View query

6. Render tree produced → framework adapter renders React/Vue/etc. component
```

---

## Layouts (`.uischema`)

Layout schemas describe zone composition for complex pages. They map zones
to widgets with positional hints, weight, and data source configuration.

```yaml
uischema: triple-zone-layout
version: 1

zones:
  - name: fieldset
    widget: fieldset-widget
    position: top
    weight: 1
    props:
      entity_id: $entity_id
      schema: $schema

  - name: canvas
    widget: canvas-embed
    position: center
    weight: 2
    props:
      entity_id: $entity_id
      canvas_id: $canvas_id

  - name: related
    widget: entity-list
    position: bottom
    weight: 1
    sources:
      - provider: SemanticEmbedding
        query: $entity_id
        limit: 10
      - provider: Backlink
        query: $entity_id
```

Clef Base defines 5 layouts: `triple-zone-layout`, `score-trace-panel`,
`score-impact-panel`, `merge-resolution-panel`, `version-comparison-panel`.

---

## ConceptBrowser (Runtime Package Management)

ConceptBrowser enables runtime extensibility. Users discover, preview,
install, update, and remove packages (suites, concepts, themes, widgets)
from registries. Installation creates schemas, registers providers,
activates syncs, and generates Surface widgets. Removal is the reverse.

This is how new widgets and themes enter a running Clef Base instance
without redeployment.

---

## Generation Pipeline

### Widget Generation

The surface-spec suite uses the standard Clef provider pattern:

1. **WidgetGen** is the coordinator concept.
2. 16 optional **WidgetGen{Framework}** provider concepts generate
   framework-specific code.
3. The `RouteToWidgetGenProvider` sync dispatches to the correct provider
   based on which FrameworkAdapters are active.

Generated widget implementations live in `surface/widgets/{framework}/`:

```
surface/widgets/
├── react/          # React components
├── vue/            # Vue SFCs
├── svelte/         # Svelte components
├── solid/          # SolidJS components
├── vanilla/        # Web Components
├── ink/            # Terminal UI (Ink/React)
├── nextjs/         # Next.js Server Components
├── react-native/   # React Native
├── appkit/         # macOS AppKit
├── swiftui/        # SwiftUI
├── compose/        # Jetpack Compose
├── gtk/            # GTK
├── nativescript/   # NativeScript
├── watchkit/       # Apple WatchKit
├── wear-compose/   # Wear OS
└── winui/          # WinUI 3
```

### Theme Generation

ThemeGen produces platform-specific output:
- **CSS** — Custom properties (`--color-primary: oklch(…)`)
- **Tailwind** — `tailwind.config` theme extension
- **React Native** — StyleSheet token objects
- **Terminal** — ANSI color codes
- **W3C DTCG** — Standard JSON token format

---

## Surface Integration Syncs (Clef Base)

These syncs bridge domain concept state to Surface widget rendering:

| Sync | Trigger | Effect |
|------|---------|--------|
| `EntityPageUsesTripleZone` | DisplayMode/resolve with mode "entity-page" | Resolve triple-zone-layout widget |
| `ResolverUsesComponentMapping` | WidgetResolver/resolve fires | Look up ComponentMapping for entity schema |
| `SlotSourceDispatchesToProvider` | SlotSource/resolve fires | Dispatch to registered provider |
| `RelatedZonePopulatesViaEmbedding` | WidgetResolver fires for entity-page | Run SemanticEmbedding query for zone 3 |
| `BlockZoneRendersViaCanvas` | WidgetResolver fires for entity-page | Fetch canvas content for zone 2 |
| `VersionContextPopulatesShellChrome` | VersionContext/push completes | Update context-bar widget in shell chrome |
| `OverrideIndicatorDecoratesEntityFields` | Override detected on entity field | Show override-dot widget |
| `ScoreGraphRendersViaGraphWidget` | Score graph requested | Render score-impact-panel widget |

---

## Clef Base Widgets

Clef Base defines 10 application-specific widgets:

| Widget | Interactor Type | Purpose |
|--------|----------------|---------|
| `triple-zone-layout` | entity-page | Three-zone entity page (fields / blocks / related) |
| `context-bar` | context-stack | Desktop navigation bar showing version space stack |
| `context-badge` | context-stack | Mobile/watch floating badge for version context |
| `context-breadcrumb` | context-stack | Breadcrumb trail for version space navigation |
| `score-trace-panel` | score-trace | Interactive tree of action/sync/completion flow |
| `score-impact-panel` | score-graph | Dependency graph of concepts/syncs/handlers |
| `diff-inline` | diff-view | Inline diff rendering |
| `diff-side-by-side` | diff-view | Side-by-side diff rendering |
| `diff-unified` | diff-view | Unified diff rendering |
| `override-dot` | override-indicator | Visual indicator for overridden fields |

These widgets are resolved via affordance matching. For example,
`context-badge` declares `serves: context-stack` with `when: platform "mobile" | "watch"`,
while `context-bar` serves the same interactor type for desktop. The
WidgetResolver picks the right one based on runtime context.

---

## Directory Map

```
surface/
├── suites/
│   ├── surface-spec/         # Parser + generation concepts and syncs
│   ├── surface-render/       # Runtime rendering concepts (adapters, layout, viewport)
│   ├── surface-integration/  # Domain→UI bridge syncs (17 sync files)
│   ├── surface-theme/        # Theme-specific suite
│   ├── surface-component/    # Component-level suite
│   ├── surface-core/         # Core surface suite
│   └── surface-app/          # App-level surface suite
├── widgets/
│   ├── react/                # Generated React components
│   ├── vue/                  # Generated Vue SFCs
│   ├── svelte/               # Generated Svelte components
│   ├── … (16 framework targets)
│   ├── shared/               # Shared utilities
│   └── index.ts              # Widget export registry
└── surface-generation.derived  # Unified generation pipeline

repertoire/concepts/
├── ui-core/                  # DesignToken, Binding, Element, Signal, UISchema
├── ui-component/             # Widget, Affordance, Interactor, WidgetResolver, Machine, Slot
├── ui-render/                # Surface, Layout, Viewport, FrameworkAdapter + 16 adapters
├── ui-theme/                 # Theme suite
├── ui-app/                   # App-level UI suite
├── ui-provider/              # UI provider suite
└── presentation/             # DisplayMode, View, Renderer, FormBuilder

clef-base/
├── widgets/                  # 10 app-specific .widget files
├── layouts/                  # 5 .uischema layout files
├── concepts/                 # ComponentMapping, SlotSource, ConceptBrowser, + 8 providers
└── suites/
    ├── component-mapping/    # Syncs wiring SlotSource dispatch and provider registration
    └── surface-integration/  # Syncs bridging domain state to Surface widgets
```
