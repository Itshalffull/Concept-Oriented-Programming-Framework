# Clef Surface

## Architecture & Implementation Specification

**Version:** 0.4.0
**Date:** 2026-02-25
**Companion to:** Clef v0.18.0
**Concept Library:** v0.4.0 (54 concepts, 15 suites)

### Changelog

| Version | Date | Summary |
|---------|------|---------|
| 0.1.0 | 2026-02-19 | Initial specification. 18 concepts across 4 suites. |
| 0.2.0 | 2026-02-19 | Concept Library integration. 4 renames. 16 cross-system syncs. |
| 0.3.0 | 2026-02-19 | Infrastructure audit + cross-platform rework. New surface-app suite (5 concepts). 23 concepts across 5 suites. |
| 0.4.0 | 2026-02-25 | Three-pass architectural revision: (1) **Idiom alignment** — all concept specs corrected to follow Clef independence rule; action bodies describe own state only, sync chains live in syncs; JSON blob state replaced with typed relations. (2) **Spec-first pipeline** — new `.widget` and `.theme` file formats with grammar, parser, and generator concepts in new surface-spec suite; Anatomy absorbed into `.widget` files; Widget stores validated ASTs not JSON blobs; uses Clef generation suite (Resource, KindSystem, BuildCache, Emitter). (3) **Semantic widget selection** — new Interactor (abstract interaction taxonomy), Affordance (widget capability declarations), WidgetResolver (context-aware matching engine) replace flat type-mapping table with two-step classify→resolve pipeline informed by research into CAMELEON/MARIA, TRIDENT, XForms, Zag.js, Material Design 3. 29 concepts across 7 suites. |

---

## 1. Overview

Clef Surface is the interface companion to Clef. Where Clef defines **what software does** — concepts with state, actions, and declarative synchronizations — Clef Surface defines **how users interact with it**. Clef Surface is built *on* Clef: every abstraction is a concept, every coordination is a sync, every bundle is a suite. But Clef Surface can also function standalone with any backend that exposes typed operations.

Clef Surface generates working interfaces from concept specs the way Django admin generates UIs from models — zero config gets you a functional interface, progressive customization gets you a beautiful one.

### 1.1 Design Principles

1. **Spec-derived.** Every Clef concept spec contains enough information to generate a default interface — field types map to interaction types, interaction types map to widgets through affordance matching, actions map to controls, state maps to displays.

2. **Headless core.** All component behavior — state machines, accessibility, keyboard navigation, ARIA patterns — lives in `.widget` spec files that compile to framework-agnostic code. Rendering is a thin adapter layer. A Clef Surface component works in React, Vue, Solid, Svelte, or a terminal without changing its behavioral core.

3. **Signals-native.** Each concept is an independent reactive unit using signals (aligned with TC39 proposal). When one concept's state changes, only UI bound to that concept re-renders. No global store, no cascading updates across unrelated concepts.

4. **Progressive customization.** Five levels, each additive: (0) zero-config auto-generated CRUD, (1) field-level configuration via UI schema, (2) view-level layout customization, (3) component-level replacement via slots, (4) full custom rendering with headless hooks. Most apps never pass level 2.

5. **Beautiful by default.** Design tokens encoded in `.theme` spec files produce polished interfaces without custom CSS. The token system follows the W3C Design Tokens Community Group spec with a three-tier hierarchy (primitive → semantic → component).

6. **Concept-composed.** Interfaces compose via synchronizations, not rigid hierarchies. An auth concept's login form and a profile concept's avatar compose through syncs — the same mechanism Clef uses for backend coordination.

7. **Deploy-anywhere.** The same concept interfaces work as a CDN-loaded script tag, a bundled npm package, a React Native component, a terminal UI via Ink, or an edge-rendered page. The deployment target is a configuration choice, not an architectural constraint.

8. **Spec-first pipeline.** Following Clef's own architecture: `.widget` and `.theme` files are semantic specs with grammars, parsed into typed ASTs, compiled to framework-specific output by generator concepts. JSON blobs are never stored in concept state. The same generation suite infrastructure (Resource, KindSystem, BuildCache, Emitter) powers both Clef and Clef Surface pipelines.

9. **Context-aware selection.** Widget selection is not a flat lookup table. Abstract interaction types (Interactor) are classified from field metadata, then matched against widget capability declarations (Affordance) parameterized by runtime context (viewport, platform, density, accessibility). The same `set String` field renders as checkboxes (3 options, desktop), a multi-select (30 options, desktop), or a scrolling list (any count, watch).

### 1.2 System Anatomy

```
                                    SPEC-TIME (build)
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  .widget files ──→ WidgetParser ──→ WidgetAST ──→ WidgetGen    │
│                        │                             │          │
│                        │ extracts affordances         │ per-framework  │
│                        ↓                             ↓          │
│               Affordance/declare              generated/react/  │
│                                               generated/solid/  │
│  .theme files ──→ ThemeParser ──→ ThemeAST ──→ ThemeGen         │
│                                                  │              │
│                                     per-platform ↓              │
│                                        generated/css/           │
│                                        generated/rn/            │
│                                                                 │
│  (uses: Resource, KindSystem, BuildCache, Emitter)              │
└─────────────────────────────────────────────────────────────────┘

                                    RUN-TIME
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  .concept spec                                                  │
│       ↓ UISchema/inspect                                        │
│  Element tree (abstract interaction units)                      │
│       ↓ Interactor/classify                                     │
│  Enriched elements (interactorType: "single-choice", n=4)       │
│       ↓ WidgetResolver/resolve (queries Affordance + context)   │
│  Resolved elements (widget: "radio-group", reason: "...")       │
│       ↓ Widget/get → Machine/spawn → Machine/connect            │
│  Framework-neutral props                                        │
│       ↓ FrameworkAdapter/render → Surface/mount                  │
│  Pixels                                                         │
│                                                                 │
│  Shell ←→ Navigator ←→ Host ←→ Binding ←→ Transport             │
│  (app orchestration via syncs, not imperative calls)            │
│                                                                 │
│  PlatformAdapter maps: browser / mobile / watch / terminal      │
└─────────────────────────────────────────────────────────────────┘
```

**Full runtime path:** `Shell/initialize` → `Navigator/go` → `Host/mount` → `Binding/bind` → `Transport/fetch` → `UISchema/inspect` → `Interactor/classify` → `WidgetResolver/resolve` → `Widget/get` → `Machine/spawn` → `Machine/connect` → `FrameworkAdapter/render` → `Surface/mount` → pixels.

### 1.3 Key Distinctions from Clef

| Aspect | Clef | Clef Surface |
|--------|------|------|
| Primary unit | Concept (state + actions) | Widget (behavior + presentation) |
| Spec format | `.concept` files | `.widget`, `.theme` files |
| Parser | SpecParser → ConceptAST | WidgetParser → WidgetAST, ThemeParser → ThemeAST |
| Generators | TypeScriptGen, RustGen, etc. | WidgetGen (per-framework), ThemeGen (per-platform) |
| Coordination | Syncs (when/where/then) | Syncs (same mechanism) |
| Independence | Concepts never reference each other | Widgets never reference each other's internals |
| Composition | Via syncs only | Via syncs + slots (named insertion points) |
| Storage | Sovereign per-concept | Signals (reactive state per-concept) |
| Wire protocol | Action messages (JSON) | Props API (connect() output) |
| Build infra | Resource, KindSystem, BuildCache, Emitter | Same — reused from generation suite |

### 1.4 Standalone vs. Coupled Mode

**Standalone mode:** Clef Surface manages its own state using signals. Transport handles REST/GraphQL communication to any backend. No Clef engine required.

**Coupled mode:** Clef Surface binds directly to Clef concepts via Binding in `"coupled"` mode. Concept state feeds signals automatically. Transport is bypassed — Binding communicates directly with the Clef engine.

The switch is a single Binding mode flag. Widget code, Navigator destinations, Shell zones, and PlatformAdapter mappings don't change.

---

## 2. The Specification Language Extensions

Clef Surface extends Clef's `.concept` grammar with an optional `interface` section that declares how a concept's state and actions surface to users. This section is ignored by the Clef backend compiler — it's metadata consumed only by Clef Surface's UISchema concept.

```
InterfaceSection = "interface" "{" InterfaceEntry* "}"
InterfaceEntry  = FieldMapping | ActionMapping | ViewMapping
FieldMapping    = "field" IDENT "{" FieldProp* "}"
ActionMapping   = "action" IDENT "{" ActionProp* "}"
ViewMapping     = "view" IDENT "{" ViewProp* "}"
```

### 2.1 Example: Annotated Concept

```
@version(1)
concept Article [A, U] {

  purpose {
    A publishable piece of content with title, body,
    author attribution, and timestamps.
  }

  state {
    title: A -> String
    body: A -> String
    author: A -> U
    tags: A -> set String
    createdAt: A -> DateTime
    published: A -> Bool
  }

  actions {
    action create(article: A, title: String, body: String, author: U) {
      -> ok(article: A) { Create with timestamps. }
      -> invalid(message: String) { Validation failed. }
    }
    action publish(article: A) {
      -> ok(article: A) { Set published flag. }
      -> notfound(message: String) { Article doesn't exist. }
    }
  }

  interface {
    field body {
      widget: "rich-text"
      placeholder: "Write your article..."
    }
    field tags {
      widget: "chip-input"
      autocomplete: "taxonomy:topic"
    }
    action publish {
      variant: "primary"
      confirm: true
      label: "Publish Article"
    }
    view list {
      columns: [title, author, published, createdAt]
      defaultSort: createdAt
      defaultSortDir: desc
    }
    view detail {
      layout: "two-column"
      primary: [title, body]
      sidebar: [author, tags, published, createdAt]
    }
  }
}
```

Fields not mentioned in the `interface` section get auto-generated defaults based on interactor classification and affordance matching (see §8).

---

## 3. File Formats

Clef Surface introduces two new spec file formats parallel to Clef's `.concept` files. Like `.concept` files, these are semantic specifications with grammars, parsed into typed ASTs, compiled to multiple targets.

### 3.1 `.widget` — Widget Specification

```
@version(1)
widget dialog {

  purpose {
    Accessible modal overlay. Traps focus within content,
    prevents background scroll, returns focus on close.
  }

  anatomy {
    root: container          { required }
    trigger: action          { opens the dialog }
    backdrop: overlay        { click-to-close surface }
    positioner: container    { centers content }
    content: container       { focus trap boundary }
    title: text              { aria-labelledby target }
    description: text        { aria-describedby target }
    closeTrigger: action     { closes the dialog }
  }

  slots {
    header: before title     { optional header region }
    body: after description  { main content area }
    footer: end of content   { action buttons area }
  }

  states {
    closed [initial] {
      on OPEN -> open
    }
    open {
      on CLOSE -> closed
      entry [ trapFocus, preventScroll, setAriaHidden ]
      exit  [ releaseFocus, restoreScroll, clearAriaHidden ]
    }
  }

  accessibility {
    role: dialog
    modal: true
    keyboard {
      Escape -> CLOSE
      Tab -> trapWithinContent
    }
    focus {
      trap: true
      initial: content
      returnOnClose: true
    }
    aria {
      labelledby: title
      describedby: description
    }
  }

  props {
    open: Bool = false
    closeOnOutsideClick: Bool = true
    closeOnEscape: Bool = true
    preventScroll: Bool = true
    trapFocus: Bool = true
    role: "dialog" | "alertdialog" = "dialog"
  }

  connect {
    root -> {
      role: ?role
      aria-modal: true
      aria-labelledby: title.id
      aria-describedby: description.id
      data-state: if open then "open" else "closed"
    }
    trigger -> {
      aria-haspopup: "dialog"
      aria-expanded: ?open
      onClick: send(OPEN)
    }
    backdrop -> {
      data-state: if open then "open" else "closed"
      onClick: if ?closeOnOutsideClick then send(CLOSE)
    }
    closeTrigger -> {
      aria-label: "Close"
      onClick: send(CLOSE)
    }
  }

  affordance {
    serves: overlay
    specificity: 10
    when { modal: true }
  }

  invariant {
    after send(OPEN) -> state is open
    then  send(CLOSE) -> state is closed
    and   focus is returned to trigger
  }
}
```

**What this carries that JSON blobs don't:** purpose (WHY), anatomy with semantic roles (not name strings), states with entry/exit actions, accessibility contracts, typed props with defaults, declarative `connect {}` (compiles to any framework), `affordance {}` (declares what interaction situations this widget serves), and invariants (behavioral guarantees).

### 3.2 `.widget` — Composite Widget

Widgets compose via the `compose` section:

```
@version(1)
widget article-card {

  purpose {
    Article summary with author, tags, and favorite action.
  }

  anatomy {
    root:     container  { card surface }
    avatar:   widget     { delegates to avatar widget }
    author:   text       { author name }
    title:    text       { article title, clickable }
    preview:  text       { body excerpt }
    tags:     widget     { delegates to tag-list widget }
    favorite: widget     { delegates to favorite-button widget }
  }

  compose {
    avatar:   widget("avatar",   { size: "sm" })
    tags:     widget("tag-list", { variant: "compact" })
    favorite: widget("favorite-button")
  }

  states {
    idle [initial] { on HOVER -> hovered }
    hovered { on LEAVE -> idle }
  }

  props {
    article: {
      title: String
      body: String
      author: { name: String, image: String }
      tags: list String
      favorited: Bool
      createdAt: DateTime
    }
  }

  connect {
    root -> { data-state: currentState, role: "article" }
    title -> { text: ?article.title, onClick: send(NAVIGATE) }
    preview -> { text: truncate(?article.body, 200) }
    avatar -> { props: { src: ?article.author.image } }
    tags -> { props: { tags: ?article.tags } }
    favorite -> { props: { active: ?article.favorited } }
  }
}
```

### 3.3 `.theme` — Theme Specification

```
@version(1)
theme light {

  purpose {
    Default light theme. Warm neutral foundation with
    accessible color pairings. All foreground/background
    combinations meet WCAG AA.
  }

  palette {
    primary: oklch(0.55 0.15 250)
    secondary: oklch(0.50 0.12 300)
    surface: oklch(0.98 0.005 250)
    error: oklch(0.55 0.20 25)
    warning: oklch(0.70 0.15 85)
    success: oklch(0.55 0.15 155)

    shades: 11 per hue
    contrast {
      text: 7.0
      largeText: 4.5
      ui: 3.0
    }

    roles {
      on-primary: contrast(primary, text)
      on-surface: contrast(surface, text)
      primary-container: lighten(primary, 0.85)
    }
  }

  typography {
    scale: 1.25
    base: 16px
    stacks {
      body: "Inter", "system-ui", sans-serif
      heading: "Inter", "system-ui", sans-serif
      mono: "JetBrains Mono", "Fira Code", monospace
    }
    styles {
      body     { stack: body,    weight: 400, tracking: 0 }
      label    { stack: body,    weight: 500, tracking: 0.02em }
      heading1 { stack: heading, weight: 600, tracking: -0.02em }
      heading2 { stack: heading, weight: 600, tracking: -0.01em }
      caption  { stack: body,    weight: 400, tracking: 0.03em }
      code     { stack: mono,    weight: 400, tracking: 0 }
    }
  }

  spacing {
    unit: 8px
    half: 4px
    scale: [ 0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32 ]
  }

  motion {
    curves {
      ease-out: cubic-bezier(0.0, 0.0, 0.2, 1.0)
      ease-in:  cubic-bezier(0.4, 0.0, 1.0, 1.0)
      standard: cubic-bezier(0.4, 0.0, 0.2, 1.0)
    }
    durations {
      instant: 0ms
      fast: 100ms
      normal: 200ms
      slow: 300ms
      enter: 200ms
      exit: 150ms
    }
    reducedMotion {
      respectPreference: true
      fallback: instant
    }
  }

  elevation {
    levels {
      none: { y: 0, blur: 0, spread: 0, opacity: 0 }
      sm:   { y: 1px, blur: 3px, spread: 0, opacity: 0.10 }
      md:   { y: 4px, blur: 6px, spread: -1px, opacity: 0.10 }
      lg:   { y: 10px, blur: 15px, spread: -3px, opacity: 0.10 }
      xl:   { y: 20px, blur: 25px, spread: -5px, opacity: 0.10 }
    }
    color: oklch(0.0 0.0 0 / var(opacity))
  }

  radius {
    none: 0
    sm: 4px
    md: 8px
    lg: 12px
    xl: 16px
    full: 9999px
  }
}
```

Themes extend declaratively — override what changes, computed values recalculate:

```
@version(1)
theme dark extends light {
  purpose { Dark variant. Inverts surface/on-surface relationship. }

  palette {
    surface: oklch(0.15 0.01 250)
    # All 'on-surface' roles auto-recalculate from new surface
  }

  elevation {
    color: oklch(0.0 0.0 0 / calc(var(opacity) * 1.5))
  }
}
```

### 3.4 The Parallel Pipelines

Clef and Clef Surface share the same architectural pattern:

| Layer | Clef | Clef Surface |
|---|---|---|
| **Spec format** | `.concept` | `.widget`, `.theme` |
| **Semantic content** | purpose, typed state, actions, invariants | purpose, anatomy, states, a11y, props, connect, affordance, invariants |
| **Parser** | SpecParser → ConceptAST | WidgetParser → WidgetAST, ThemeParser → ThemeAST |
| **IR** | SchemaGen → ConceptManifest | WidgetAST/ThemeAST serve as IR directly |
| **Generators** | TypeScriptGen, RustGen, SwiftGen, SolidityGen | WidgetGen (React, Solid, Vue, Ink), ThemeGen (CSS, RN, terminal, W3C DTCG) |
| **Infrastructure** | Resource, KindSystem, BuildCache, Emitter | Same — reused from generation suite |
| **Runtime catalog** | Registry | Widget (parsed ASTs), Theme (activation) |
| **Runtime execution** | SyncEngine | Machine (state machines), Signal (reactivity) |

---

## 4. Core Concepts

Clef Surface is implemented as 29 concepts organized into 7 suites. Every concept follows Clef's spec format — sovereign storage, typed actions with return variants, no inter-concept references. All concept specs have been corrected per the Clef independence rule: action bodies describe own state only, sync chains live in `.sync` files, no concept references another by name.

### Concept Overview

**surface-core suite** (foundation — always loaded):

| Concept | Purpose |
|---------|---------|
| DesignToken | Store design decisions as structured, platform-agnostic data |
| Element | Abstract, modality-independent interaction units |
| UISchema | Inspect concept specs → generate UI schemas |
| Binding | Map backend state/actions to frontend signals |
| Signal | Reactive state container (TC39-aligned) |

**surface-component suite** (headless behaviors):

| Concept | Purpose |
|---------|---------|
| Widget | Catalog of parsed widget ASTs available for instantiation |
| Machine | Finite state machine runtime for component behavior |
| Slot | Named insertion points for composition |
| Interactor | Abstract interaction type taxonomy (WHAT the user does) |
| Affordance | Widget capability declarations (WHEN a widget is suitable) |
| WidgetResolver | Context-aware matching engine (WHICH widget for this context) |

**surface-render suite** (framework adapters):

| Concept | Purpose |
|---------|---------|
| FrameworkAdapter | Framework adapter registry, lifecycle, and rendering |
| Surface | Deployment target with mount/unmount lifecycle |
| Layout | Spatial arrangement of components on a surface |
| Viewport | Responsive breakpoint and adaptation logic |

**surface-theme suite** (visual design):

| Concept | Purpose |
|---------|---------|
| Theme | Compose tokens into a complete visual language |
| Palette | Color system with semantic roles and accessibility |
| Typography | Type scale, font stacks, and text styles |
| Motion | Animation timing, easing, and transition definitions |
| Elevation | Shadow and depth system |

**surface-app suite** (application orchestration):

| Concept | Purpose |
|---------|---------|
| Navigator | Abstract navigation between destinations |
| Host | View instance lifecycle state |
| Transport | Network communication for data synchronization |
| Shell | Root app composition with semantic zone roles |
| PlatformAdapter | Thin platform-specific mapping |

**surface-spec suite** (build-time parsing and generation):

| Concept | Purpose |
|---------|---------|
| WidgetParser | Parse `.widget` → WidgetAST |
| ThemeParser | Parse `.theme` → ThemeAST |
| WidgetGen | WidgetAST → framework-specific components |
| ThemeGen | ThemeAST → platform-specific styles |

### 4.1 DesignToken

```
@version(1)
concept DesignToken [T] {

  purpose {
    Store design decisions as structured, platform-agnostic data.
    Tokens are the atomic unit of visual design — a color value,
    a spacing size, a font family. They form a three-tier
    hierarchy: primitive (raw values), semantic (meaning/purpose),
    and component (bound to specific UI elements). Follows the
    W3C Design Tokens Community Group specification.
  }

  state {
    name: T -> String
    value: T -> String
    type: T -> String
    tier: T -> String
    description: T -> option String
    reference: T -> option T
    group: T -> option String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action define(token: T, name: String, value: String,
                  type: String, tier: String) {
      -> ok(token: T) {
        Register a new token. Type: color, dimension,
        fontFamily, fontWeight, duration, cubicBezier,
        shadow, border, typography, gradient.
        Tier: primitive, semantic, component.
      }
      -> duplicate(message: String) { Name exists in group. }
    }

    action alias(token: T, name: String, reference: T, tier: String) {
      -> ok(token: T) {
        Create a token referencing another's value.
        Resolves at consumption time, enabling theming.
      }
      -> notfound(message: String) { Referenced token missing. }
      -> cycle(message: String) { Circular reference. }
    }

    action resolve(token: T) {
      -> ok(token: T, resolvedValue: String) {
        Walk reference chain, return final value.
      }
      -> notfound(message: String) { Token missing. }
      -> broken(message: String, brokenAt: T) { Chain broken. }
    }

    action update(token: T, value: option String) {
      -> ok(token: T) { Update value or reference target. }
      -> notfound(message: String) { Token missing. }
    }

    action remove(token: T) {
      -> ok(token: T) { Delete. Aliases pointing here break. }
      -> notfound(message: String) { Token missing. }
    }

    action export(format: String) {
      -> ok(output: String) {
        Export all tokens. Formats: "dtcg" (W3C JSON),
        "css" (Custom Properties), "swift", "kotlin", "json".
      }
      -> unsupported(message: String) { Format unknown. }
    }
  }

  invariant {
    after define(token: t, name: "blue-500", value: "#3b82f6",
                 type: "color", tier: "primitive") -> ok(token: t)
    then resolve(token: t) -> ok(token: t, resolvedValue: "#3b82f6")
  }
}
```

### 4.2 Element

```
@version(1)
concept Element [E] {

  purpose {
    Abstract, modality-independent interaction units. An Element
    describes WHAT a user can do — select, input, trigger, navigate,
    display — without specifying HOW it renders. The same Element
    renders as a dropdown in GUI, a prompt in CLI, an enum in API,
    or a picker in mobile.
  }

  state {
    kind: E -> String
    label: E -> String
    description: E -> option String
    dataType: E -> String
    required: E -> Bool
    constraints: E -> option String
    children: E -> list E
    parent: E -> option E
    interactorType: E -> option String
    interactorProps: E -> option String
    resolvedWidget: E -> option String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action create(element: E, kind: String, label: String,
                  dataType: String) {
      -> ok(element: E) {
        Create an abstract element. Kind is one of:
        input-text, input-number, input-date, input-bool,
        selection-single, selection-multi, trigger, navigation,
        output-text, output-number, output-date, output-bool,
        group, container, rich-text, file-upload, media-display.
      }
      -> invalid(message: String) { Kind not recognized. }
    }

    action nest(parent: E, child: E) {
      -> ok(parent: E) { Add child to group or container. }
      -> invalid(message: String) { Parent cannot contain children. }
    }

    action setConstraints(element: E, constraints: String) {
      -> ok(element: E) {
        Apply constraints: min, max, minLength, maxLength,
        pattern, options (for selections).
      }
      -> notfound(message: String) { Element missing. }
    }

    action enrich(element: E, interactorType: String,
                  interactorProps: String) {
      -> ok(element: E) {
        Set the semantic interaction type and properties
        determined by classification.
      }
      -> notfound(message: String) { Element missing. }
    }

    action assignWidget(element: E, widget: String) {
      -> ok(element: E) {
        Set the resolved widget name determined by
        affordance matching.
      }
      -> notfound(message: String) { Element missing. }
    }

    action remove(element: E) {
      -> ok(element: E) { Remove element and detach children. }
      -> notfound(message: String) { Element missing. }
    }
  }

  invariant {
    after create(element: e, kind: "input-text", label: "Title",
                 dataType: "String") -> ok(element: e)
    then enrich(element: e, interactorType: "text-short",
                interactorProps: "{}") -> ok(element: e)
  }
}
```

### 4.3 UISchema

```
@version(1)
concept UISchema [S, C] {

  purpose {
    Inspect a concept spec and generate a UI schema — the
    complete description of how that concept should be presented.
    Implements the dual-schema pattern: data schema (from spec)
    is the source, UI schema (generated here) is the presentation
    layer. Inspection pipeline: inspect → classify interaction
    types → apply defaults → apply overrides → produce element tree.
  }

  state {
    concept: S -> C
    elements: S -> list String
    uiSchema: S -> String
    overrides: S -> option String
    generatedAt: S -> DateTime
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action inspect(schema: S, conceptSpec: String) {
      -> ok(schema: S) {
        Parse concept spec. Extract state fields, actions,
        and return variants. Generate default views: list,
        detail, create, edit. If spec contains an interface
        section, apply overrides on top of defaults.
      }
      -> parseError(message: String) { Spec could not be parsed. }
    }

    action override(schema: S, overrides: String) {
      -> ok(schema: S) {
        Apply partial UI schema on top of generated one.
        Merges at field/action/view level.
      }
      -> notfound(message: String) { No schema for this concept. }
      -> invalid(message: String) { Override malformed. }
    }

    action getSchema(schema: S) {
      -> ok(schema: S, uiSchema: String) { Return current schema. }
      -> notfound(message: String) { No schema exists. }
    }

    action getElements(schema: S) {
      -> ok(elements: String) {
        Return abstract element tree — intermediate
        representation consumed by downstream classification
        and widget resolution.
      }
      -> notfound(message: String) { No schema exists. }
    }
  }

  invariant {
    after inspect(schema: s, conceptSpec: "concept Test [T] { state { name: T -> String } }")
      -> ok(schema: s)
    then getElements(schema: s) -> ok(elements: _)
  }
}
```

### 4.4 Binding

```
@version(1)
concept Binding [B, C] {

  purpose {
    Bridge between backend state and frontend signals.
    In coupled mode, subscribes to state changes and pushes
    updates to signals. Routes user-triggered actions back
    as invocations. In standalone mode, wraps a data source
    and presents it through the same signal interface.
  }

  state {
    concept: B -> C
    mode: B -> String
    endpoint: B -> option String
    lastSync: B -> option DateTime
    status: B -> String
    signalMap: B -> String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action bind(binding: B, concept: C, mode: String) {
      -> ok(binding: B) {
        Create binding. Mode: "coupled" (direct engine),
        "rest", "graphql", "static". Generate signal map:
        one signal per state field, one command per action.
      }
      -> invalid(message: String) { Mode unknown or concept unreachable. }
    }

    action sync(binding: B) {
      -> ok(binding: B) { Pull latest state and update signals. }
      -> error(message: String) { Backend unreachable. }
    }

    action invoke(binding: B, action: String, input: String) {
      -> ok(binding: B, result: String) {
        Invoke action on bound concept. Route to backend
        based on mode. Return completion.
      }
      -> error(message: String) { Invocation failed. }
    }

    action unbind(binding: B) {
      -> ok(binding: B) { Remove binding, unsubscribe, dispose signals. }
      -> notfound(message: String) { Binding missing. }
    }
  }

  invariant {
    after bind(binding: b, concept: c, mode: "static") -> ok(binding: b)
    then unbind(binding: b) -> ok(binding: b)
  }
}
```

### 4.5 Signal

```
@version(1)
concept Signal [G] {

  purpose {
    Reactive state container aligned with TC39 Signals proposal.
    A getter/setter pair with automatic dependency tracking.
    When a signal's value changes, all computed signals and
    effects that read from it re-execute. Each concept binding
    produces one signal per state field. Signals are runtime-only.
  }

  state {
    value: G -> String
    kind: G -> String
    dependencies: G -> set G
    subscribers: G -> set G
    version: G -> Int
  }

  actions {
    action create(signal: G, kind: String, initialValue: String) {
      -> ok(signal: G) {
        Create signal. Kind: "state" (writable), "computed"
        (read-only derived), "effect" (side-effect on change).
      }
      -> invalid(message: String) { Kind unrecognized. }
    }

    action read(signal: G) {
      -> ok(signal: G, value: String, version: Int) {
        Read current value and register caller as dependency.
      }
      -> notfound(message: String) { Signal missing. }
    }

    action write(signal: G, value: String) {
      -> ok(signal: G, version: Int) {
        Update value, increment version, notify subscribers.
        Notifications batched within a microtask.
      }
      -> readonly(message: String) { Cannot write computed signal. }
      -> notfound(message: String) { Signal missing. }
    }

    action batch(signals: String) {
      -> ok(count: Int) {
        Update multiple signals atomically. Subscribers
        notified once after all updates.
      }
      -> partial(message: String, succeeded: Int, failed: Int) {
        Some updates failed.
      }
    }

    action dispose(signal: G) {
      -> ok(signal: G) { Remove signal, unsubscribe. }
      -> notfound(message: String) { Signal missing. }
    }
  }

  invariant {
    after create(signal: g, kind: "state", initialValue: "hello")
      -> ok(signal: g)
    then read(signal: g) -> ok(signal: g, value: "hello", version: _)
  }
}
```

### 4.6 Widget (revised — stores ASTs, not JSON)

```
@version(1)
concept Widget [P] {

  purpose {
    Catalog of parsed widget specifications available for
    instantiation. Each entry is a validated WidgetAST
    produced by WidgetParser. The catalog bridges spec-time
    parsing and run-time instantiation.
  }

  state {
    name: P -> String
    category: P -> String
    ast: P -> String
    version: P -> Int
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action register(widget: P, name: String, ast: String,
                    category: String) {
      -> ok(widget: P) {
        Register a parsed widget AST. Only accepts output
        from a parser — raw JSON or source strings rejected.
      }
      -> duplicate(message: String) { Name already registered. }
      -> invalid(message: String) { AST failed validation. }
    }

    action get(widget: P) {
      -> ok(widget: P, ast: String, name: String) {
        Retrieve widget AST for instantiation.
      }
      -> notfound(message: String) { Not registered. }
    }

    action list(category: option String) {
      -> ok(widgets: String) {
        List registered widgets, optionally filtered.
      }
    }

    action unregister(widget: P) {
      -> ok(widget: P) { Remove from catalog. }
      -> notfound(message: String) { Not registered. }
    }
  }

  invariant {
    after register(widget: p, name: "dialog", ast: _,
                   category: "overlay") -> ok(widget: p)
    then get(widget: p) -> ok(widget: p, ast: _, name: "dialog")
  }
}
```

### 4.7 Machine

```
@version(1)
concept Machine [M] {

  purpose {
    Finite state machine runtime. Each instance executes a
    behavioral specification (from a WidgetAST): states,
    transitions, guards, entry/exit actions. Produces a
    framework-neutral props API via the connect action —
    anatomy parts mapped to attributes and handlers.
  }

  state {
    currentState: M -> String
    context: M -> String
    component: M -> String
    status: M -> String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action spawn(machine: M, widget: String, context: String) {
      -> ok(machine: M) {
        Create machine instance from registered widget name.
        Initialize to the widget's initial state. Store
        provided context.
      }
      -> notfound(message: String) { Widget not registered. }
      -> invalid(message: String) { Context malformed. }
    }

    action send(machine: M, event: String) {
      -> ok(machine: M, state: String) {
        Process event. Execute transition if current state
        handles it. Run exit actions on departing state,
        entry actions on entering state. Return new state.
      }
      -> invalid(message: String) { Event not handled in current state. }
      -> guarded(machine: M, guard: String) { Guard blocked transition. }
    }

    action connect(machine: M) {
      -> ok(machine: M, props: String) {
        Produce framework-neutral props from current state
        and context. Props map anatomy parts to attributes:
        ARIA roles, event handlers, data-state attributes,
        conditional visibility. Generated from the .widget
        connect section.
      }
      -> notfound(message: String) { Machine missing. }
    }

    action destroy(machine: M) {
      -> ok(machine: M) {
        Run exit actions on current state, dispose machine.
      }
      -> notfound(message: String) { Machine missing. }
    }
  }

  invariant {
    after spawn(machine: m, widget: "dialog", context: "{}")
      -> ok(machine: m)
    then send(machine: m, event: "{ \"type\": \"OPEN\" }")
      -> ok(machine: m, state: "open")
  }
}
```

### 4.8 Slot

```
@version(1)
concept Slot [L] {

  purpose {
    Named insertion points for component composition.
    A slot defines a location within a widget's anatomy
    where external content can be injected without modifying
    the host widget's behavior or structure.
  }

  state {
    name: L -> String
    host: L -> String
    content: L -> option String
    position: L -> String
    fallback: L -> option String
  }

  actions {
    action define(slot: L, name: String, host: String,
                  position: String, fallback: option String) {
      -> ok(slot: L) { Define an insertion point. }
      -> duplicate(message: String) { Name taken on this host. }
    }

    action fill(slot: L, content: String) {
      -> ok(slot: L) { Inject content into slot. }
      -> notfound(message: String) { Slot missing. }
    }

    action clear(slot: L) {
      -> ok(slot: L) { Remove content, revert to fallback. }
      -> notfound(message: String) { Slot missing. }
    }
  }

  invariant {
    after define(slot: l, name: "header", host: "dialog",
                 position: "before-title", fallback: _)
      -> ok(slot: l)
    then fill(slot: l, content: "Custom Header") -> ok(slot: l)
  }
}
```

### 4.9 Interactor — Abstract Interaction Type Taxonomy

```
@version(1)
concept Interactor [I] {

  purpose {
    Abstract interaction type taxonomy. Classifies user
    interactions by semantic purpose independent of any
    concrete widget. A single-choice interactor means
    "user selects one from a set" — whether that renders
    as radio buttons, a dropdown, or a voice prompt is
    determined downstream by affordance matching.
  }

  state {
    types: set I
    name: I -> String
    category: I -> String
    properties {
      dataType: I -> String
      cardinality: I -> String
      optionCount: I -> option Int
      optionSource: I -> option String
      domain: I -> option String
      comparison: I -> Bool
      mutable: I -> Bool
      multiLine: I -> Bool
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action define(interactor: I, name: String, category: String,
                  properties: String) {
      -> ok(interactor: I) {
        Define an interaction type. Categories:
        selection, edit, control, output, navigation,
        composition. Properties describe semantic
        constraints on the type.
      }
      -> duplicate(message: String) { Name already defined. }
    }

    action classify(interactor: I, fieldType: String,
                    constraints: option String,
                    intent: option String) {
      -> ok(interactor: I, confidence: Float) {
        Classify a concept field into an interaction type.
        Uses field type, constraints (min/max, enum, cardinality),
        and optional intent annotation for best match.
        Confidence: 1.0 = exact, 0.5 = heuristic.
      }
      -> ambiguous(interactor: I, candidates: String) {
        Multiple types match equally. Returns ranked list.
      }
    }

    action get(interactor: I) {
      -> ok(interactor: I, name: String, category: String,
           properties: String) { Retrieve full definition. }
      -> notfound(message: String) { Type not defined. }
    }

    action list(category: option String) {
      -> ok(interactors: String) {
        List types, optionally filtered by category.
      }
    }
  }

  invariant {
    after define(interactor: i, name: "single-choice",
      category: "selection",
      properties: "{ \"cardinality\": \"one\", \"comparison\": true }")
      -> ok(interactor: i)
    then classify(interactor: _, fieldType: "T -> T",
      constraints: "{ \"enum\": [\"A\",\"B\",\"C\"] }",
      intent: _)
      -> ok(interactor: _, confidence: _)
  }
}
```

### 4.10 Affordance — Widget Capability Declaration

```
@version(1)
concept Affordance [F] {

  purpose {
    Declare what semantic interaction situations a widget
    can serve. Each affordance binds a widget name to an
    interactor type with conditional constraints. A widget
    may have multiple affordances at different specificity
    levels. The most specific matching affordance wins.
    Affordances are declared in .widget file affordance
    sections and registered by WidgetParser.
  }

  state {
    affordances: set F
    widget: F -> String
    interactor: F -> String
    specificity: F -> Int
    conditions {
      minOptions: F -> option Int
      maxOptions: F -> option Int
      platform: F -> option String
      viewport: F -> option String
      density: F -> option String
      mutable: F -> option Bool
    }
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action declare(affordance: F, widget: String,
                   interactor: String, specificity: Int,
                   conditions: option String) {
      -> ok(affordance: F) {
        Declare that widget can serve the named interactor
        type when conditions are met. Higher specificity wins.
      }
      -> duplicate(message: String) { Exact affordance exists. }
    }

    action match(affordance: F, interactor: String,
                 context: String) {
      -> ok(matches: String) {
        Find all affordances matching the interactor type
        whose conditions are satisfied by context. Returns
        ranked list by specificity then score.
        Context: { optionCount, platform, viewport, density }.
      }
      -> none(message: String) { No affordances match. }
    }

    action explain(affordance: F) {
      -> ok(affordance: F, reason: String) {
        Human-readable explanation of selection/rejection.
      }
      -> notfound(message: String) { Affordance missing. }
    }

    action remove(affordance: F) {
      -> ok(affordance: F) { Remove declaration. }
      -> notfound(message: String) { Affordance missing. }
    }
  }

  invariant {
    after declare(affordance: f1, widget: "radio-group",
      interactor: "single-choice", specificity: 10,
      conditions: "{ \"maxOptions\": 8 }") -> ok(affordance: f1)
    and declare(affordance: f2, widget: "select",
      interactor: "single-choice", specificity: 5,
      conditions: _) -> ok(affordance: f2)
    then match(affordance: _, interactor: "single-choice",
      context: "{ \"optionCount\": 4 }") -> ok(matches: _)
  }
}
```

### 4.11 WidgetResolver — Context-Aware Matching Engine

```
@version(1)
concept WidgetResolver [R] {

  purpose {
    Context-aware selection of the best widget for a given
    abstract element. Gathers semantic properties from the
    element's interactor type, combines with runtime context,
    queries affordance declarations, and returns a ranked
    selection. Replaces flat type-mapping tables with a
    parameterized, extensible decision engine.
  }

  state {
    overrides: R -> option String
    defaultContext: R -> String
    scoringWeights: R -> String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action resolve(resolver: R, element: String,
                   context: String) {
      -> ok(resolver: R, widget: String, score: Float,
           reason: String) {
        Select best widget for element in context.
        1. Read element's interactor type and properties
        2. Merge runtime context with defaults
        3. Check for explicit overrides
        4. Query affordance matches for candidates
        5. Score candidates by specificity + condition fit
        6. Return highest-scoring widget with explanation
      }
      -> ambiguous(resolver: R, candidates: String) {
        Multiple widgets scored equally.
      }
      -> none(resolver: R, element: String) {
        No widget matches. Needs manual binding.
      }
    }

    action resolveAll(resolver: R, elements: String,
                      context: String) {
      -> ok(resolver: R, resolutions: String) {
        Batch-resolve all elements in a tree.
      }
      -> partial(resolver: R, resolved: String,
                 unresolved: String) { Some unresolved. }
    }

    action override(resolver: R, element: String,
                    widget: String) {
      -> ok(resolver: R) {
        Force widget for element, bypassing affordance
        matching. Used by progressive customization Level 1+
        and UISchema overrides.
      }
      -> invalid(message: String) { Widget not registered. }
    }

    action setWeights(resolver: R, weights: String) {
      -> ok(resolver: R) {
        Adjust scoring weights (accessibility vs compactness,
        mobile-native vs cross-platform).
      }
      -> invalid(message: String) { Weight spec malformed. }
    }

    action explain(resolver: R, element: String,
                   context: String) {
      -> ok(resolver: R, explanation: String) {
        Full resolution trace: interactor type, affordances
        considered, why winner won.
      }
      -> notfound(message: String) { Element not found. }
    }
  }

  invariant {
    after resolve(resolver: r,
      element: "{ \"interactorType\": \"single-choice\", \"optionCount\": 4 }",
      context: "{ \"platform\": \"browser\", \"viewport\": \"desktop\" }")
      -> ok(resolver: r, widget: "radio-group", score: _, reason: _)

    after override(resolver: r, element: "{ \"kind\": \"selection-single\" }",
      widget: "custom-picker") -> ok(resolver: r)
    then resolve(resolver: r,
      element: "{ \"kind\": \"selection-single\" }", context: _)
      -> ok(resolver: r, widget: "custom-picker", score: _, reason: _)
  }
}
```

### 4.12–4.15 Render Kit (FrameworkAdapter, Surface, Layout, Viewport)

These concepts are unchanged from v0.3.0. FrameworkAdapter registers framework-specific renderers (~200 LOC each). Surface manages mount points. Layout arranges components spatially. Viewport tracks responsive breakpoints and feeds context to WidgetResolver via syncs.

### 4.16–4.20 Theme Kit (Theme, Palette, Typography, Motion, Elevation)

These concepts are structurally unchanged but their INPUTS now come from ThemeParser output, not from imperative calls with JSON blobs. DesignToken/define is called by syncs when ThemeParser produces output. Palette/generate, Typography scale computation, and Motion reduced-motion handling move to ThemeParser as parse-time resolution. The runtime concepts remain: Palette stores resolved color maps, Typography stores resolved sizes.

### 4.21 Navigator (corrected)

```
@version(1)
concept Navigator [N] {

  purpose {
    Manage transitions between abstract destinations and
    maintain navigation history. Each destination associates
    a name with a target concept and view configuration.
    Navigation state is a stack of previously visited
    destinations supporting back/forward traversal.
  }

  state {
    destinations: set N
    name: N -> String
    targetConcept: N -> String
    targetView: N -> String
    paramsSchema: N -> option String
    meta: N -> option String
    current: N -> option N
    history: N -> list N
    forwardStack: N -> list N
    guards: N -> list String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action register(nav: N, name: String, targetConcept: String,
                    targetView: String, paramsSchema: option String,
                    meta: option String) {
      -> ok(nav: N) { Register a navigable destination. }
      -> duplicate(message: String) { Name already registered. }
    }

    action go(nav: N, params: option String) {
      -> ok(nav: N, previous: option N) {
        Evaluate guards, push previous to history, clear
        forward stack. Return previous for teardown.
      }
      -> blocked(nav: N, reason: String) { Guard prevented transition. }
      -> notfound(message: String) { Destination not registered. }
    }

    action back(nav: N) {
      -> ok(nav: N, previous: N) {
        Pop from history, push current to forward.
      }
      -> empty(message: String) { History empty. }
    }

    action forward(nav: N) {
      -> ok(nav: N, previous: N) {
        Pop from forward, push current to history.
      }
      -> empty(message: String) { Forward stack empty. }
    }

    action replace(nav: N, params: option String) {
      -> ok(nav: N, previous: option N) {
        Replace current without modifying history.
      }
      -> notfound(message: String) { Destination not registered. }
    }

    action addGuard(nav: N, guard: String) {
      -> ok(nav: N) { Register guard evaluated before departure. }
      -> invalid(message: String) { Guard expression invalid. }
    }

    action removeGuard(nav: N, guard: String) {
      -> ok(nav: N) { Remove guard. }
      -> notfound(message: String) { Guard not registered. }
    }
  }

  invariant {
    after register(nav: n, name: "detail", targetConcept: "Article",
      targetView: "detail", paramsSchema: _, meta: _) -> ok(nav: n)
    then go(nav: n, params: _) -> ok(nav: n, previous: _)

    after go(nav: a, params: _) -> ok(nav: a, previous: _)
    then back(nav: b) -> ok(nav: b, previous: _)
  }
}
```

### 4.22 Host (corrected)

```
@version(1)
concept Host [W] {

  purpose {
    Lifecycle state of a mounted view instance. Tracks which
    concept is being presented, the current lifecycle phase,
    the set of subordinate resources created during mounting,
    and error state. Provides a single handle for mount/unmount
    that downstream syncs trigger on.
  }

  state {
    concept: W -> String
    view: W -> String
    level: W -> Int
    zone: W -> option String
    status: W -> String
    binding: W -> option String
    machines: W -> set String
    errorInfo: W -> option String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action mount(host: W, concept: String, view: String,
                 level: Int, zone: option String) {
      -> ok(host: W) {
        Create host instance. Store concept URN, view name,
        customization level, target zone. Set status "loading".
      }
      -> invalid(message: String) { Concept URN or view unrecognized. }
    }

    action ready(host: W) {
      -> ok(host: W) {
        Transition status from "loading" to "interactive".
        All subordinate resources have been created.
      }
      -> invalid(message: String) { Not in "loading" status. }
    }

    action trackResource(host: W, kind: String, ref: String) {
      -> ok(host: W) {
        Associate subordinate resource (binding, machine)
        with this host. Stored for cleanup on unmount.
      }
      -> notfound(message: String) { Host missing. }
    }

    action unmount(host: W) {
      -> ok(host: W, machines: set String, binding: option String) {
        Set status "unmounted". Return all tracked resources
        so downstream syncs can destroy them.
      }
      -> notfound(message: String) { Host missing. }
    }

    action refresh(host: W) {
      -> ok(host: W) {
        Signal data re-fetch. Status remains "interactive".
      }
      -> notfound(message: String) { Host missing. }
      -> invalid(message: String) { Host not interactive. }
    }

    action setError(host: W, errorInfo: String) {
      -> ok(host: W) { Set status "error" with diagnostics. }
      -> notfound(message: String) { Host missing. }
    }
  }

  invariant {
    after mount(host: w, concept: "urn:app/Article", view: "list",
      level: 0, zone: "primary") -> ok(host: w)
    then unmount(host: w) -> ok(host: w, machines: _, binding: _)
  }
}
```

### 4.23 Transport (corrected)

```
@version(1)
concept Transport [P] {

  purpose {
    Execute data read and write requests against external
    sources. Manages connection configuration, authentication,
    retry policies, response caching, and an offline queue.
  }

  state {
    kind: P -> String
    baseUrl: P -> option String
    auth: P -> option String
    status: P -> String
    retryPolicy {
      maxAttempts: P -> Int
      backoff: P -> String
    }
    cacheTTL: P -> option Int
    pendingQueue: P -> list String
  }

  capabilities {
    requires persistent-storage
    requires network
  }

  actions {
    action configure(transport: P, kind: String,
                     baseUrl: option String,
                     auth: option String,
                     retryPolicy: option String) {
      -> ok(transport: P) {
        Initialize with connection parameters.
        Kind: "rest", "graphql", "websocket".
      }
      -> invalid(message: String) { Kind unknown. }
    }

    action fetch(transport: P, query: String) {
      -> ok(transport: P, data: String) { Execute read. Return data. }
      -> cached(transport: P, data: String, age: Int) { Returned from cache. }
      -> error(transport: P, status: Int, message: String) { Request failed. }
    }

    action mutate(transport: P, action: String, input: String) {
      -> ok(transport: P, result: String) { Execute write. Return result. }
      -> queued(transport: P, queuePosition: Int) { Queued for offline. }
      -> error(transport: P, status: Int, message: String) { Write failed. }
    }

    action flushQueue(transport: P) {
      -> ok(transport: P, flushed: Int) { Send all queued mutations. }
      -> partial(transport: P, sent: Int, failed: Int) { Some failed. }
    }
  }

  invariant {
    after configure(transport: p, kind: "rest",
      baseUrl: "https://api.example.com", auth: _, retryPolicy: _)
      -> ok(transport: p)
    then fetch(transport: p, query: "{ \"path\": \"/articles\" }")
      -> ok(transport: p, data: _)
  }
}
```

### 4.24 Shell (corrected)

```
@version(1)
concept Shell [S] {

  purpose {
    Root composition frame. Defines semantic zones —
    named regions with layout roles — that Host instances
    mount into. Zone roles (navigated, persistent, transient,
    overlay) describe behavior without prescribing appearance.
  }

  state {
    zones: S -> set String
    zoneRole {
      name: S -> String
      role: S -> String
    }
    activeOverlays: S -> list String
    status: S -> String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action initialize(shell: S, zones: String) {
      -> ok(shell: S) {
        Create shell with zone definitions. Each zone has
        a name and role. Status becomes "ready".
      }
      -> invalid(message: String) { Zone config malformed. }
    }

    action assignToZone(shell: S, zone: String, ref: String) {
      -> ok(shell: S) { Place a host reference in a zone. }
      -> notfound(message: String) { Zone not defined. }
    }

    action clearZone(shell: S, zone: String) {
      -> ok(shell: S, previous: option String) {
        Remove content from zone. Return previous ref.
      }
      -> notfound(message: String) { Zone not defined. }
    }

    action pushOverlay(shell: S, ref: String) {
      -> ok(shell: S) { Add overlay to stack. }
      -> invalid(message: String) { Shell not ready. }
    }

    action popOverlay(shell: S) {
      -> ok(shell: S, overlay: String) { Remove top overlay. }
      -> empty(message: String) { No overlays. }
    }
  }

  invariant {
    after initialize(shell: s, zones: "{ \"zones\": [{ \"name\": \"primary\", \"role\": \"navigated\" }] }")
      -> ok(shell: s)
    then assignToZone(shell: s, zone: "primary", ref: "host-1")
      -> ok(shell: s)
  }
}
```

### 4.25 PlatformAdapter (corrected)

```
@version(1)
concept PlatformAdapter [D] {

  purpose {
    Translate abstract interface operations into platform-
    specific implementations. Maps navigation transitions
    to platform conventions, shell zones to platform layouts,
    and platform-native events back to abstract operations.
    Each platform adapter is ~100-200 LOC.
  }

  state {
    platform: D -> String
    config: D -> String
    status: D -> String
  }

  capabilities {
    requires persistent-storage
  }

  actions {
    action register(adapter: D, platform: String,
                    config: String) {
      -> ok(adapter: D) {
        Register platform adapter. Platform: "browser",
        "mobile", "watch", "desktop", "terminal".
      }
      -> duplicate(message: String) { Platform already registered. }
    }

    action mapNavigation(adapter: D, transition: String) {
      -> ok(adapter: D, platformAction: String) {
        Translate abstract navigation to platform action.
        Returns platform-specific instruction.
      }
      -> unsupported(message: String) { Transition type unsupported. }
    }

    action mapZone(adapter: D, role: String) {
      -> ok(adapter: D, platformConfig: String) {
        Translate zone role to platform layout.
      }
      -> unmapped(message: String) { Role has no platform equivalent. }
    }

    action handlePlatformEvent(adapter: D, event: String) {
      -> ok(adapter: D, action: String) {
        Translate platform-native event to abstract action.
      }
      -> ignored(message: String) { Event not relevant. }
    }
  }

  invariant {
    after register(adapter: d, platform: "browser", config: "{}")
      -> ok(adapter: d)
    then mapNavigation(adapter: d,
      transition: "{ \"type\": \"push\" }") -> ok(adapter: d, platformAction: _)
  }
}
```

### 4.26–4.29 Spec Kit (WidgetParser, ThemeParser, WidgetGen, ThemeGen)

```
@version(1)
concept WidgetParser [W] {

  purpose {
    Parse .widget specification files into typed ASTs.
    Validates grammar, resolves anatomy references,
    type-checks props and connect mappings, extracts
    affordance declarations for downstream registration.
  }

  state {
    source: W -> String
    ast: W -> option String
    errors: W -> list String
    version: W -> Int
  }

  actions {
    action parse(widget: W, source: String) {
      -> ok(widget: W, ast: String) {
        Parse .widget source into WidgetAST. Validates
        state machine, anatomy, props, a11y, invariants.
      }
      -> error(widget: W, errors: list String) {
        Parse or validation errors with locations.
      }
    }

    action validate(widget: W) {
      -> ok(widget: W) { Deep validation: connect completeness, a11y coverage. }
      -> incomplete(widget: W, warnings: list String) { Valid but has gaps. }
    }
  }

  invariant {
    after parse(widget: w, source: "widget button { ... }")
      -> ok(widget: w, ast: _)
    then validate(widget: w) -> ok(widget: w)
  }
}
```

```
@version(1)
concept ThemeParser [H] {

  purpose {
    Parse .theme specification files into typed ASTs.
    Resolves palette functions (contrast, lighten, darken),
    computes typography scale, validates WCAG contrast.
  }

  state {
    source: H -> String
    ast: H -> option String
    errors: H -> list String
    warnings: H -> list String
  }

  actions {
    action parse(theme: H, source: String) {
      -> ok(theme: H, ast: String) {
        Parse .theme source into ThemeAST. Resolves palette
        functions, typography scale, extension inheritance.
      }
      -> error(theme: H, errors: list String) { Parse errors. }
    }

    action checkContrast(theme: H) {
      -> ok(theme: H) { All role pairings meet WCAG ratios. }
      -> violations(theme: H, failures: list String) { Failures. }
    }
  }

  invariant {
    after parse(theme: h, source: "theme light { ... }")
      -> ok(theme: h, ast: _)
    then checkContrast(theme: h) -> ok(theme: h)
  }
}
```

```
@version(1)
concept WidgetGen [G] {

  purpose {
    Generate framework-specific widget implementations from
    WidgetAST. Each target produces a complete component:
    state machine runtime, connect function, accessibility,
    keyboard handlers, and framework bindings. Follows the
    M+N compiler pattern: one IR, multiple output targets.
  }

  state {
    target: G -> String
    input: G -> String
    output: G -> option String
    status: G -> String
  }

  actions {
    action generate(gen: G, target: String, widgetAst: String) {
      -> ok(gen: G, output: String) {
        Target: "react", "solid", "vue", "svelte", "ink",
        "react-native", "swiftui".
      }
      -> error(gen: G, message: String) { Unsupported feature. }
    }
  }

  invariant {
    after generate(gen: g, target: "react", widgetAst: _)
      -> ok(gen: g, output: _)
  }
}
```

```
@version(1)
concept ThemeGen [G] {

  purpose {
    Generate platform-specific style implementations from
    ThemeAST. Resolves all computed values and emits
    platform-native style formats.
  }

  state {
    target: G -> String
    input: G -> String
    output: G -> option String
  }

  actions {
    action generate(gen: G, target: String, themeAst: String) {
      -> ok(gen: G, output: String) {
        Targets: "css-variables", "tailwind", "react-native",
        "terminal", "w3c-dtcg".
      }
      -> error(gen: G, message: String) { Generation failed. }
    }
  }

  invariant {
    after generate(gen: g, target: "css-variables", themeAst: _)
      -> ok(gen: g, output: _)
  }
}
```

---

## 5. Core Synchronizations

All syncs use Clef's when/where/then mechanism. Concepts never orchestrate each other — syncs declare all inter-concept coordination.

### 5.1 Spec Pipeline Syncs (surface-spec)

```
sync WidgetSpecParsed [eager]
  purpose: "When a .widget file is loaded, parse it"
when {
  Resource/track: [ resource: ?res; kind: "widget" ]
    => [ resource: ?res; content: ?source ]
}
then {
  WidgetParser/parse: [ widget: ?res; source: ?source ]
}

sync ParsedWidgetRegistered [eager]
  purpose: "Register parsed widgets in catalog"
when {
  WidgetParser/parse: [ widget: ?w ]
    => [ widget: ?w; ast: ?ast ]
}
then {
  Widget/register: [ widget: ?w; name: ?w; ast: ?ast; category: "auto" ]
}

sync ParsedAffordanceRegistered [eager]
  purpose: "Register affordances extracted from widget specs"
when {
  WidgetParser/parse: [ widget: ?w ]
    => [ widget: ?w; ast: ?ast ]
}
then {
  Affordance/declare: [ affordance: ?w;
    widget: ?w; interactor: ?ast; specificity: ?ast;
    conditions: ?ast ]
}

sync WidgetGenerated [eager]
  purpose: "Generate framework-specific code from parsed widget"
when {
  WidgetParser/parse: [ widget: ?w ]
    => [ widget: ?w; ast: ?ast ]
}
where {
  FrameworkAdapter: { ?adapter framework: ?framework; status: "active" }
}
then {
  WidgetGen/generate: [ gen: ?w; target: ?framework; widgetAst: ?ast ]
}

sync ThemeSpecParsed [eager]
  purpose: "When a .theme file is loaded, parse it"
when {
  Resource/track: [ resource: ?res; kind: "theme" ]
    => [ resource: ?res; content: ?source ]
}
then {
  ThemeParser/parse: [ theme: ?res; source: ?source ]
}

sync ParsedThemeTokensRegistered [eager]
  purpose: "Register resolved tokens from parsed theme"
when {
  ThemeParser/parse: [ theme: ?h ]
    => [ theme: ?h; ast: ?ast ]
}
then {
  DesignToken/define: [ token: ?h; name: ?h;
    value: ?ast; type: "theme"; tier: "semantic" ]
}

sync ThemeGenerated [eager]
  purpose: "Generate platform-specific styles"
when {
  ThemeParser/parse: [ theme: ?h ]
    => [ theme: ?h; ast: ?ast ]
}
where {
  Surface: { ?surface kind: ?kind }
}
then {
  ThemeGen/generate: [ gen: ?h; target: ?kind; themeAst: ?ast ]
}
```

### 5.2 Core Runtime Syncs (surface-core)

```
sync InspectAndGenerate [eager]
when {
  Binding/bind: [ concept: ?concept ]
    => [ binding: ?binding ]
}
then {
  UISchema/inspect: [ schema: ?binding; conceptSpec: ?concept ]
}

sync UISchemaToElements [eager]
when {
  UISchema/inspect: [ schema: ?schema ]
    => [ schema: ?schema ]
}
then {
  UISchema/getElements: [ schema: ?schema ]
}

sync BindingStateSync [eager]
when {
  Signal/write: [ signal: ?signal; value: ?value ]
    => [ signal: ?signal; version: ?version ]
}
where {
  Binding: { ?binding signalMap: ?map }
  filter(contains(?map, ?signal))
}
then {
  Binding/sync: [ binding: ?binding ]
}

sync ConceptStateToSignal [eager]
when {
  Binding/sync: [ binding: ?binding ]
    => [ binding: ?binding ]
}
where {
  Binding: { ?binding signalMap: ?map }
}
then {
  Signal/batch: [ signals: ?map ]
}
```

### 5.3 Semantic Selection Syncs (surface-component — replaces ElementToMachine)

```
sync ElementsClassified [eager]
  purpose: "Classify each element's abstract interaction type"
when {
  UISchema/getElements: [ schema: ?schema ]
    => [ elements: ?elements ]
}
then {
  Interactor/classify: [ interactor: ?elements;
    fieldType: ?elements; constraints: ?elements;
    intent: ?elements ]
}

sync ClassifiedElementsResolved [eager]
  purpose: "Resolve classified elements to concrete widgets"
when {
  Interactor/classify: [ interactor: ?element ]
    => [ interactor: ?interactorType; confidence: ?_ ]
}
where {
  Viewport: { ?viewport breakpoint: ?bp }
  PlatformAdapter: { ?adapter platform: ?platform }
}
then {
  WidgetResolver/resolve: [ resolver: ?element;
    element: ?interactorType;
    context: "{ \"platform\": ?platform, \"viewport\": ?bp }" ]
}

sync ResolvedWidgetSpawned [eager]
  purpose: "Spawn machine for resolved widget"
when {
  WidgetResolver/resolve: [ resolver: ?element ]
    => [ resolver: ?element; widget: ?widgetName;
         score: ?_; reason: ?_ ]
}
then {
  Widget/get: [ widget: ?widgetName ]
}

sync SpawnMachineForElement [eager]
when {
  Widget/get: [ widget: ?comp ]
    => [ widget: ?comp; ast: ?ast; name: ?name ]
}
then {
  Machine/spawn: [ machine: ?comp; widget: ?name;
                   context: "{ \"autoGenerated\": true }" ]
}

sync AmbiguousResolutionUsesDefault [eager]
when {
  WidgetResolver/resolve: [ resolver: ?element ]
    => ambiguous(resolver: ?element; candidates: ?candidates)
}
then {
  Widget/get: [ widget: ?candidates ]
}

sync UnresolvedElementSignalsError [eager]
when {
  WidgetResolver/resolve: [ resolver: ?element ]
    => none(resolver: ?element; element: ?desc)
}
where {
  Host: { ?host status: "loading" }
}
then {
  Host/setError: [ host: ?host; errorInfo: "{ \"unresolved\": ?desc }" ]
}
```

### 5.4 Machine→Render Syncs

```
sync MachineToFrameworkAdapter [eager]
when {
  Machine/connect: [ machine: ?machine ]
    => [ machine: ?machine; props: ?props ]
}
where {
  FrameworkAdapter: { ?adapter status: "active" }
}
then {
  FrameworkAdapter/render: [ adapter: ?adapter; props: ?props ]
}

sync DestroyMachineOnUnbind [eager]
when {
  Binding/unbind: [ binding: ?binding ]
    => [ binding: ?binding ]
}
where {
  Machine: { ?machine component: ?binding }
}
then {
  Machine/destroy: [ machine: ?machine ]
}
```

### 5.5 App Orchestration Syncs (surface-app)

```
sync NavigatorGoMountsHost [eager]
when {
  Navigator/go: [ nav: ?nav; params: ?params ]
    => [ nav: ?nav; previous: ?prev ]
}
where {
  Navigator: { ?nav targetConcept: ?concept; targetView: ?view }
}
then {
  Host/mount: [ host: ?nav; concept: ?concept; view: ?view;
                level: 0; zone: "primary" ]
}

sync NavigatorGoUnmountsPrevious [eager]
when {
  Navigator/go: [ nav: ?nav ]
    => [ nav: ?nav; previous: ?prev ]
}
where {
  filter(?prev != null)
}
then {
  Host/unmount: [ host: ?prev ]
}

sync HostMountCreatesBinding [eager]
when {
  Host/mount: [ host: ?host; concept: ?concept ]
    => [ host: ?host ]
}
then {
  Binding/bind: [ binding: ?host; concept: ?concept; mode: "coupled" ]
}

sync BindingCreatedTrackedByHost [eager]
when {
  Binding/bind: [ binding: ?binding ]
    => [ binding: ?binding ]
}
where {
  Host: { ?host status: "loading" }
  filter(?binding == ?host)
}
then {
  Host/trackResource: [ host: ?host; kind: "binding"; ref: ?binding ]
}

sync MachineSpawnedTrackedByHost [eager]
when {
  Machine/spawn: [ machine: ?machine ]
    => [ machine: ?machine ]
}
where {
  Host: { ?host status: "loading" }
}
then {
  Host/trackResource: [ host: ?host; kind: "machine"; ref: ?machine ]
}

sync CascadeCompleteHostReady [eager]
when {
  FrameworkAdapter/render: [ adapter: ?adapter ]
    => [ adapter: ?adapter ]
}
where {
  Host: { ?host status: "loading" }
}
then {
  Host/ready: [ host: ?host ]
}

sync HostUnmountDestroysMachines [eager]
when {
  Host/unmount: [ host: ?host ]
    => [ host: ?host; machines: ?machines; binding: ?binding ]
}
then {
  Machine/destroy: [ machine: ?machines ]
  Binding/unbind: [ binding: ?binding ]
}

sync HostRefreshSyncsBinding [eager]
when {
  Host/refresh: [ host: ?host ]
    => [ host: ?host ]
}
where {
  Host: { ?host binding: ?binding }
}
then {
  Binding/sync: [ binding: ?binding ]
}

sync BindingSyncViaTransport [eager]
when {
  Binding/sync: [ binding: ?binding ]
    => [ binding: ?binding ]
}
where {
  Binding: { ?binding mode: ?mode; endpoint: ?endpoint }
  filter(?mode != "coupled" && ?mode != "static")
}
then {
  Transport/fetch: [ transport: ?binding; query: ?endpoint ]
}

sync TransportResponseToSignals [eager]
when {
  Transport/fetch: [ transport: ?t ]
    => [ transport: ?t; data: ?data ]
}
then {
  Signal/batch: [ signals: ?data ]
}

sync NavigatorToPlatform [eager]
when {
  Navigator/go: [ nav: ?nav ]
    => [ nav: ?nav; previous: ?_ ]
}
where {
  PlatformAdapter: { ?adapter status: "active" }
}
then {
  PlatformAdapter/mapNavigation: [ adapter: ?adapter;
    transition: "{ \"type\": \"push\", \"destination\": ?nav }" ]
}

sync PlatformEventToNavigator [eager]
when {
  PlatformAdapter/handlePlatformEvent: [ adapter: ?adapter; event: ?event ]
    => [ adapter: ?adapter; action: "back" ]
}
then {
  Navigator/back: [ nav: ?adapter ]
}

sync ShellInitCreatesRootSurface [eager]
when {
  Shell/initialize: [ shell: ?shell ]
    => [ shell: ?shell ]
}
then {
  Surface/create: [ surface: ?shell; kind: "browser-dom" ]
  Layout/create: [ layout: ?shell; kind: "shell" ]
}
```

### 5.6 Intent Integration Syncs (surface-integration)

```
sync IntentImprovesClassification [eager]
  purpose: "Use Intent semantic data to improve interactor classification"
when {
  Intent/define: [ targetId: ?target; purpose: ?purpose ]
    => [ intent: ?intentId ]
}
where {
  UISchema: { ?schema concept: ?target }
}
then {
  Interactor/classify: [ interactor: ?target;
    fieldType: ?target; constraints: ?target;
    intent: ?purpose ]
}

sync CustomizationOverridesResolver [eager]
  purpose: "Level 1+ customization bypasses affordance matching"
when {
  UISchema/override: [ schema: ?schema; overrides: ?overrides ]
    => [ schema: ?schema ]
}
then {
  WidgetResolver/override: [ resolver: ?schema;
    element: ?overrides; widget: ?overrides ]
}

sync SchemaDefDrivesUI [eager]
when {
  Schema/defineSchema: [ name: ?name; fields: ?fields ]
    => [ schema: ?schemaId ]
}
then {
  UISchema/inspect: [ schema: ?schemaId; conceptSpec: ?fields ]
}

sync ViewDrivesLayout [eager]
when {
  View/create: [ dataSource: ?ds; layout: ?layoutType ]
    => [ view: ?viewId ]
}
then {
  Layout/create: [ layout: ?viewId; kind: ?layoutType ]
  UISchema/inspect: [ schema: ?viewId; conceptSpec: ?ds ]
}

sync FormValidatesViaValidator [eager]
when {
  Machine/send: [ machine: ?form; event: "{ \"type\": \"SUBMIT\" }" ]
    => [ machine: ?form; state: "validating" ]
}
where {
  Binding: { ?binding signalMap: ?map }
  filter(contains(?map, ?form))
}
then {
  Validator/validate: [ nodeId: ?form; formData: ?map ]
}

sync WorkflowStateToSignal [eager]
when {
  Workflow/transition: [ entityId: ?entity; targetState: ?state ]
    => [ entityId: ?entity ]
}
then {
  Signal/write: [ signal: ?entity; value: ?state ]
}
```

---

## 6. Interactor Classification Rules

The flat type-mapping table from v0.3.0 is replaced by a two-step process: classify (field type → semantic interactor) then resolve (interactor + context → widget via affordance matching).

### 6.1 Standard Interactor Types (registered on bootstrap)

**Selection:** single-choice (one, comparison: true), single-pick (one, comparison: false), multi-choice (many, comparison: true), multi-pick (many, comparison: false), toggle (one, optionCount: 2), range-select (one, continuous).

**Edit:** text-short, text-long, text-rich, number-exact, number-approx, date-point, date-range, color, file-attach.

**Control:** action-primary (high emphasis), action-secondary (medium), action-tertiary (low), action-danger (destructive), submit, cancel, navigate.

**Output:** display-text, display-number, display-date, display-badge, display-status, display-media, display-progress.

**Composition:** group-fields, group-section, group-repeating, group-conditional.

### 6.2 Classification Rules (Interactor/classify)

| Field type | Constraints | → Interactor type |
|---|---|---|
| String | (default) | text-short |
| String | maxLength > 500 | text-long |
| String | format: "rich" | text-rich |
| String | format: "color" | color |
| Int | (default) | number-exact |
| Int | min + max (small range) | number-exact { domain: "1-10" } |
| Float | | number-approx |
| Bool | | toggle |
| DateTime | | date-point |
| Bytes | | file-attach |
| set T | enum (≤ 8) | multi-choice { optionCount: n } |
| set T | enum (> 8) | multi-pick { optionCount: n } |
| set T | open | multi-pick { optionSource: "open" } |
| T → T relation | enum | single-choice { optionCount: n } |
| T → T relation | open | single-pick { optionSource: "open" } |
| { fields } | | group-fields |
| list T | | group-repeating |

### 6.3 Standard Affordance Declarations

| Widget | Interactor | Specificity | Conditions |
|---|---|---|---|
| radio-group | single-choice | 10 | maxOptions: 8 |
| radio-card | single-choice | 12 | maxOptions: 4, comparison: true |
| select | single-choice | 5 | (fallback) |
| combobox | single-choice | 8 | minOptions: 20 |
| segmented | single-choice | 11 | maxOptions: 5, platform: "desktop" |
| checkbox-group | multi-choice | 10 | maxOptions: 8 |
| multi-select | multi-choice | 5 | (fallback) |
| combobox-multi | multi-choice | 8 | minOptions: 20 |
| chip-input | multi-pick | 10 | optionSource: "open" |
| toggle | toggle | 10 | |
| checkbox | toggle | 8 | density: "compact" |
| switch | toggle | 9 | platform: "mobile" |
| text-input | text-short | 5 | (fallback) |
| textarea | text-long | 10 | |
| rich-text | text-rich | 10 | |
| number-input | number-exact | 5 | (fallback) |
| stepper | number-exact | 10 | domain: "1-10" |
| slider | number-approx | 10 | |
| date-picker | date-point | 10 | |
| date-range | date-range | 10 | |
| button-filled | action-primary | 10 | |
| button-outline | action-secondary | 10 | |
| button-text | action-tertiary | 10 | |
| button-danger | action-danger | 10 | |
| text-display | display-text | 5 | (fallback) |
| badge | display-badge | 10 | |
| progress-bar | display-progress | 10 | |

Apps extend these freely:

```
Affordance/declare(
  widget: "star-rating",
  interactor: "single-choice",
  specificity: 15,
  conditions: { domain: "1-5", context: "rating" }
)
```

---

## 7. Kit Declarations

### 7.1 surface-spec suite

```yaml
kit:
  name: surface-spec
  version: 0.1.0
  description: >
    Spec file parsing and generation for Clef Surface. Defines .widget
    and .theme file formats with parsers and generators.
  dependencies:
    - "@clef/generation": ">=0.1.0"

concepts:
  WidgetParser:
    spec: ./widget-parser.concept
  ThemeParser:
    spec: ./theme-parser.concept
  WidgetGen:
    spec: ./widget-gen.concept
  ThemeGen:
    spec: ./theme-gen.concept

syncs:
  required:
    - path: ./syncs/widget-spec-parsed.sync
    - path: ./syncs/parsed-widget-registered.sync
    - path: ./syncs/parsed-affordance-registered.sync
    - path: ./syncs/theme-spec-parsed.sync
    - path: ./syncs/parsed-theme-tokens-registered.sync
  recommended:
    - path: ./syncs/widget-generated.sync
    - path: ./syncs/theme-generated.sync

uses:
  - kit: "@clef/generation"
    concepts: [ Resource, KindSystem, BuildCache, Emitter ]
  - kit: surface-core
    concepts: [ DesignToken, Widget ]
  - kit: surface-render
    concepts: [ FrameworkAdapter, Surface ]
```

Generation kit integration: Resource tracks `.widget`/`.theme` files with content hashing. KindSystem defines `widget-ast` and `theme-ast` as IR kinds. BuildCache caches parsed ASTs — only regenerates on source change. GenerationPlan orchestrates: parse all → generate per framework → emit. Emitter writes content-addressed output.

---

## 8. Implementation Plan

Building from the current Clef implementation (v0.18.0 with TypeScript framework, sync engine, parser, generators). Clef Surface requires a working Clef engine (Stage 3+) as a prerequisite. Each stage deploys concepts and syncs to the Clef engine.

### Stage 0: Foundation (surface-core)

Deploy 5 concepts: DesignToken, Element, UISchema, Binding, Signal. Deploy 4 syncs: InspectAndGenerate, UISchemaToElements, BindingStateSync, ConceptStateToSignal.

**Acceptance:** Binding/bind → UISchema/inspect → element tree extracted. Signal write → Binding sync → backend update. Token alias chains resolve.

### Stage 1: Spec Pipeline (surface-spec)

Deploy 4 concepts: WidgetParser, ThemeParser, WidgetGen, ThemeGen. Deploy 7 syncs (spec pipeline). Register `.widget` and `.theme` as Resource kinds in KindSystem. Build the `.widget` grammar parser (recursive descent, mirrors SpecParser pattern). Build the `.theme` grammar parser.

**Acceptance:** `.widget` file tracked → parsed → WidgetAST produced → Widget/register. `.theme` file tracked → parsed → tokens registered. WidgetGen produces React component from WidgetAST.

### Stage 2: Widget Kit (surface-component)

Deploy 6 concepts: Widget (revised), Machine, Slot, Interactor, Affordance, WidgetResolver. Deploy semantic selection syncs (ElementsClassified, ClassifiedElementsResolved, ResolvedWidgetSpawned, etc.). Register standard interactor types. Register standard affordance declarations. Build initial 10 `.widget` specs (button, input, textarea, select, checkbox, toggle, dialog, tabs, form, toast).

**Acceptance:** Full pipeline: Binding/bind → UISchema → Element → Interactor/classify → WidgetResolver/resolve → Widget/get → Machine/spawn → Machine/connect → props. `set String` with 3 enum values → checkbox-group (not multi-select). Same field on mobile → different widget. WidgetResolver/explain returns full trace.

### Stage 3: Render Kit + React Adapter

Deploy 4 concepts: FrameworkAdapter, Surface, Layout, Viewport. Deploy render syncs. Build React adapter (~200 LOC). Build hooks API (useBinding, useMachine, useSignal). Viewport feeds context to WidgetResolver.

**Acceptance:** `surface.auto('urn:app/Article')` produces working CRUD. Viewport change → WidgetResolver re-resolves → different widgets on mobile breakpoint.

### Stage 4: App Suite

Deploy 5 concepts: Navigator, Host, Transport, Shell, PlatformAdapter. Deploy ~15 app orchestration syncs. Build browser PlatformAdapter (~150 LOC).

**Acceptance:** Full app: Shell/initialize → Navigator/go → Host/mount → full cascade → pixels. Navigator guard blocks transition. Host/unmount → all resources cleaned up. Transport fetch/mutate with offline queue.

### Stage 5: Theme Kit

Deploy 5 concepts: Theme, Palette, Typography, Motion, Elevation. Create default `.theme` specs (light.theme, dark.theme, high-contrast.theme). ThemeParser resolves palette functions and type scales.

**Acceptance:** Theme/activate → tokens cascade → UI re-renders. Palette contrast checking passes WCAG AA. prefers-reduced-motion → durations resolve to 0ms.

### Stage 6: Additional Adapters

Build additional FrameworkAdapters: Solid, Vue, Svelte, Ink (~200 LOC each). Build additional PlatformAdapters: mobile, desktop, terminal, watch (~100-200 LOC each). Additional WidgetGen targets for each framework.

**Acceptance:** Same `.widget` specs + same syncs → working interfaces across all frameworks. Same Navigator/Shell → mobile tab bar, watch single screen, terminal box layout.

---

## 9. Project Structure

```
my-app/
├── concepts/              # Clef .concept specs (backend)
│   ├── article.concept
│   ├── user.concept
│   └── comment.concept
├── widgets/               # Clef Surface .widget specs (frontend behavior)
│   ├── dialog.widget
│   ├── form.widget
│   ├── article-card.widget
│   └── comment-thread.widget
├── themes/                # Clef Surface .theme specs (visual design)
│   ├── light.theme
│   ├── dark.theme
│   └── high-contrast.theme
├── syncs/                 # Coordination
│   ├── article-crud.sync
│   ├── auth-flow.sync
│   └── article-card-binds-article.sync
├── generated/             # Output (gitignored)
│   ├── react/
│   ├── css/
│   └── types/
└── app.deploy.yaml
```

---

## 10. Resolved Design Questions

| Question | Resolution |
|----------|-----------|
| Where do widget specs live? | `.widget` files parsed by WidgetParser, not JSON blobs in Widget/register. |
| Where do theme specs live? | `.theme` files parsed by ThemeParser, not imperative Theme/create calls. |
| How does widget selection work? | Two-step: Interactor/classify (type → semantic) + WidgetResolver/resolve (semantic + context → widget via Affordance). |
| What replaces the flat type-mapping table? | Interactor classification rules + standard affordance declarations. Both extensible. |
| Can apps add custom widget-selection rules? | Yes — Affordance/declare with higher specificity wins over defaults. |
| How do concepts compose in UI? | Via syncs (same as Clef) + slots (named insertion points) + `.widget` compose sections. |
| Does Host orchestrate the cascade? | No. Host tracks lifecycle state. Syncs declare the cascade. Same result, declarative wiring. |
| Do concept specs reference each other? | Never. All inter-concept coordination is in syncs. Action bodies describe own state only. |
| Where does Clef's PluginRegistry fit? | FrameworkAdapter and PlatformAdapter use the provider pattern — register implementations, syncs dispatch to active one. WidgetGen/ThemeGen targets could be providers if extended via PluginRegistry. |
| How does the generation suite integrate? | Clef Surface's parsers and generators are new "kinds" in KindSystem. Resource tracks `.widget`/`.theme` files. BuildCache handles incremental builds. Emitter writes output. No new infrastructure concepts needed. |
| Spec-time vs runtime? | Clean separation. surface-spec concepts (parsers, generators) run at build time. surface-core/component/render/theme/app concepts run at runtime. Same split as Clef's SpecParser vs SyncEngine. |

---

## 11. Concept Count Summary

| Kit | Concepts | New in v0.4.0 |
|-----|----------|---------------|
| surface-core | 5 | Element enriched (interactorType, resolvedWidget) |
| surface-component | 6 | +Interactor, +Affordance, +WidgetResolver; Anatomy absorbed into .widget |
| surface-render | 4 | — |
| surface-theme | 5 | Inputs from ThemeParser, not imperative JSON |
| surface-app | 5 | All specs corrected per independence rule |
| surface-spec | 4 | NEW: WidgetParser, ThemeParser, WidgetGen, ThemeGen |
| surface-integration | (syncs only) | +IntentImprovesClassification, +CustomizationOverridesResolver |
| **Total** | **29** | +6 new, -1 absorbed (Anatomy) |

Combined with Clef concept library: 54 library + 29 Clef Surface = 83 concepts across 22 suites.