# Surface Contract Theming Layer PRD

**Version:** 1.0.0
**Date:** 2026-04-12
**Status:** Research-ready
**Research inputs:** `clef-base` theme audit, wave-2 theme audit, discussion of cross-platform theming, existing affordance/widget resolution architecture
**Scope:** introduce a platform-neutral semantic surface styling layer between Theme semantics and platform-native rendering targets
**New concepts:** 3
**Modified concepts:** 4
**New widgets:** 0
**Modified widgets/components:** none required in the first framework card; later pilot integrations will target `clef-base`
**New views:** 0
**New syncs:** 0

---

## 0. Problem Statement

Clef already has advanced theme semantics, widget anatomy, affordances, and theme-aware widget resolution context, but there is still a major missing layer between abstract theme data and concrete UI realization.

Today the pipeline is effectively:

- theme semantics and tokens
- widget selection and rendering
- app-local styling glue such as `globals.css`

That works for the web, but it leaves several structural problems:

- semantic UI chrome is authored by hand in app CSS rather than as first-class Clef artifacts
- widget parts do not have a portable semantic styling contract
- theme behavior is harder to share across widgets, views, and apps
- non-web targets like WinUI, GTK/GNOME, and SwiftUI have no equivalent intermediate representation to compile from
- affordance-driven autochooser can be theme-aware at selection time, but there is no parallel semantic layer for shared presentation after selection

The result is that Clef theming remains partly “advanced in theory, local in practice.”

### 0.1 Core Gap

Clef needs a platform-neutral semantic styling IR that:

- defines reusable UI surface roles
- binds widget and view parts onto those roles
- lets themes influence those roles systematically
- compiles those roles into native platform styling artifacts

This PRD calls that layer **Surface Contract Theming**.

### 0.2 Product Goal

Introduce a new Surface layer so that:

- semantic chrome is declared in Clef, not hidden in handwritten CSS
- affordance-driven widget choice and theme-driven surface realization work together cleanly
- web CSS becomes one renderer target, not the source of truth
- non-web UI targets can realize the same theme semantics natively

---

## 1. Design Principles

### 1.1 Keep Behavior and Styling Separate

Affordances and widget resolution should continue deciding **which widget behavior is appropriate**.

Surface contracts should decide **which semantic styling role each part plays**.

Theme realizers should decide **how that role is rendered on a target platform**.

### 1.2 Make Semantic Surface Roles First-Class

Reusable UI roles like:

- `floating-panel`
- `field-control`
- `toolbar`
- `detail-row`
- `empty-state`
- `inline-editor`

should be explicit framework artifacts, not accidental CSS patterns.

### 1.3 Compile From Shared Intent, Not Web Implementation

The source model must be portable. CSS output is only one target.

The shared layer should express:

- semantic resource usage
- supported states
- density behavior
- emphasis/elevation
- shape/typography roles
- interaction requirements

It should not express browser-specific layout hacks.

### 1.4 Fit Into Existing Surface Architecture

This layer must extend:

- `Theme`
- `Widget`
- `Affordance`
- widget resolution
- render transforms

without replacing them.

### 1.5 Prefer Gradual Adoption

The first success condition is not “generate all UI styling.”

The first success condition is:

- prove the contract model
- map a small number of high-value shared surfaces
- generate correct web output
- show that the same model can target a second native UI stack

---

## 2. Scope

### 2.1 In Scope

- define a platform-neutral semantic surface contract model
- define a binding/lens model from widget and view parts to contracts
- define a theme realization model that compiles contracts into target-native styling artifacts
- integrate contract metadata into widget resolution context where useful
- pilot the system on a small set of shared surfaces in `clef-base`
- support CSS as the first required renderer target
- design for later WinUI, GTK/GNOME, and SwiftUI realizers

### 2.2 Out of Scope

- replacing the existing theme system outright
- removing affordances or widget resolution
- redesigning all Surface widgets at once
- building every platform renderer in the first iteration
- making all app layout logic generated

---

## 3. Proposed Model

### 3.1 New Core Artifacts

#### A. `SurfaceContract`

A platform-neutral description of a reusable semantic UI role.

Examples:

- `floating-panel`
- `floating-trigger`
- `menu-item`
- `field-control`
- `field-label`
- `page-shell`
- `page-section`
- `detail-grid`
- `alert-surface`

Each contract should describe:

- purpose / role
- supported states
- semantic resource requirements
- typography role
- density behavior
- shape/elevation/emphasis policy
- interaction expectations
- target capability hints

#### B. `SurfaceLens`

A binding layer from widget/view anatomy onto contracts.

Examples:

- `FieldsPopover.panel -> floating-panel`
- `FieldWidget.input -> field-control`
- `DetailDisplay.labelCell -> detail-label`
- `DashboardView.section -> page-section`

This should be composable and compatible with existing render-transform thinking.

#### C. `ThemeRealizer`

A target-specific compiler/provider that turns:

- theme semantics
- surface contracts
- surface lenses

into native platform styling output.

Examples:

- CSS realizer
- WinUI realizer
- GTK/GNOME realizer
- SwiftUI realizer

### 3.2 Existing Artifacts to Extend

#### A. `Theme`

Themes should continue owning:

- palette
- typography
- spacing
- motion
- density
- shape/radius
- motif
- style profile
- visualization slots

But they should also support semantic resource resolution for surface contracts.

#### B. `Widget`

Widgets continue to own:

- anatomy
- states
- accessibility
- behavior
- composition

Widgets do not become style artifacts. They expose parts that can be lens-bound to contracts.

#### C. `Affordance`

Affordances continue to own:

- behavioral suitability
- context and layout fit
- density/motif compatibility
- source/data suitability

They remain the primary input to autochooser.

### 3.3 Pipeline

The intended pipeline becomes:

1. `Affordance` + context choose the best widget
2. `SurfaceLens` binds chosen widget/view parts to semantic contracts
3. `ThemeRealizer` resolves contracts against the active theme and target platform
4. native styling output is emitted and consumed by the renderer

### 3.4 Relation to Autochooser

Surface contracts are a sibling layer to affordances, not a replacement.

Autochooser should continue answering:

- which widget or presentation mode is appropriate?

Surface contracts should answer:

- what semantic styling role does each chosen part play?

Later, contract compatibility may also feed into resolver scoring:

- compact editorial themes may prefer widgets whose contract profile is dense and restrained
- motif-rich themes may prefer widgets whose contract profile supports richer surface treatment

But that is secondary. The first version should keep chooser logic and contract realization clearly separated.

### 3.5 Exact Execution Model

The first implementation should work in this exact order at runtime/build time:

1. `ThemeSelection` resolves the active theme for the current app/runtime.
2. `WidgetResolver` chooses the widget using existing affordance scoring plus current theme context.
3. `SurfaceLensResolver` loads the applicable lenses for the chosen widget and surrounding view shell.
4. For each widget/view part, `SurfaceLensResolver` emits a bound contract id and optional contract variant metadata.
5. `ThemeRealizer` resolves each contract against:
   - active theme
   - target platform
   - density
   - style profile
   - motif
   - contract state set
6. The renderer consumes a generated styling payload:
   - on web: class names, data attributes, and CSS variable scopes
   - on native targets: target-specific style handles/resources

The important boundary is:

- widget resolution happens before contract realization
- contract realization never changes widget behavior in the first pass

### 3.6 What Gets Generated

The first version should generate two concrete outputs for web:

#### A. Contract Manifest

A machine-readable artifact describing:

- every contract
- resolved state variants
- semantic resource bindings
- the generated class/selector names for each contract/state combination

Example output path:

- `generated/surface/contracts.web.json`

#### B. Contract CSS

A generated stylesheet containing:

- theme-scoped semantic variables
- contract base rules
- contract state rules
- density/style-profile/motif variants where applicable

Example output path:

- `generated/surface/contracts.generated.css`

`clef-base` should then import generated contract CSS before its thin local override layer.

### 3.7 What Stays Handwritten in the First Pass

The first pass should not attempt to generate:

- full view layout composition
- bespoke canvas/graph positioning logic
- every one-off page wrapper
- native control templates with toolkit-specific structure

Handwritten code should remain responsible for:

- structure
- behavior
- data binding
- exceptional app-specific overrides

Generated contract output should own:

- shared chrome
- repeated semantic surfaces
- state styling
- theme-driven visual differentiation

### 3.8 Concrete Runtime Binding Shape

For React/web, the binding path should be intentionally simple:

- widgets and views expose stable part names they already have
- lens resolution maps those names to generated contract class names or data attributes
- the renderer attaches those classes/attributes during render

The first implementation should prefer emitted attributes like:

- `data-contract="field-control"`
- `data-contract-state="invalid focus"`
- `data-contract-variant="compact"`

or generated classes like:

- `sc-field-control`
- `sc-field-control--invalid`
- `sc-page-section--editorial`

The renderer should pick one convention and stay consistent. My recommendation is:

- attributes in the IR and render path
- generated CSS selectors targeting those attributes

That keeps the runtime generic and makes non-web targets easier to map from the same model.

### 3.9 Example End-to-End Flow

For `FieldsPopover` on web:

1. `WidgetResolver` chooses `FieldsPopover`.
2. Lens file binds:
   - `panel -> floating-panel`
   - `header -> toolbar`
   - `row -> menu-item`
   - `action -> quiet-action-button`
3. Runtime render output contains those contract bindings as attributes.
4. CSS realizer generates rules for:
   - `[data-contract="floating-panel"]`
   - `[data-contract="menu-item"][data-contract-state~="selected"]`
   - density/style variants for the active theme
5. Theme switch changes only the realized variables/rules, not widget code.

For WinUI later:

1. Same widget and lens selection logic applies.
2. Realizer maps `floating-panel` to a flyout/panel style resource.
3. Bound parts reference that style resource instead of web CSS selectors.

### 3.10 Render-Program Node Binding Model

`SurfaceLens` should support render-program-node binding in the first version, but only through stable semantic node metadata rather than brittle structural selectors.

Supported binding targets in v1:

- widget part
- view wrapper
- render-program node selector

Render-program nodes must expose stable semantic fields for lens matching:

- `widget`
- `part`
- `role`
- `kind`
- `state`
- `binding`
- `ancestry`
- explicit semantic tags

The initial selector model should allow expressions like:

```text
bind render-node where {
  widget = "FieldWidget"
  part = "input"
} -> FieldControl
```

```text
bind render-node where {
  role = "menu-item"
  ancestry contains "floating-menu"
} -> MenuItem
```

```text
bind render-node where {
  role = "input"
} -> FieldControl {
  state invalid when prop("aria-invalid") = true
  state disabled when prop("disabled") = true
}
```

What is explicitly out of scope in v1:

- numeric child-position selectors
- arbitrary DOM-like tree selectors
- matching based on unstable implementation structure

Precedence must be deterministic:

1. explicit widget-part binding
2. explicit view-wrapper binding
3. render-program node selector binding
4. fallback default mapping

This gives the system enough power to bind generated and transformed UI structures from day one without turning the lens model into a CSS selector engine.

---

## 4. Deliverables

### 4.1 Contract Model

- define `SurfaceContract` artifact and runtime model
- define the minimal contract vocabulary for shared surfaces
- define contract states and semantic resource requirements

### 4.2 Lens Model

- define `SurfaceLens` artifact and runtime binding model
- support mapping widget parts and view wrappers onto contracts
- support composition with existing render-program transforms where feasible

### 4.3 Theme Realization Model

- define `ThemeRealizer` abstraction
- implement CSS realizer first
- document target mapping strategy for WinUI, GTK/GNOME, and SwiftUI

### 4.4 Resolver Integration

- extend widget-resolution context with contract-profile awareness where appropriate
- keep affordance scoring primary
- add optional contract compatibility hooks for later use

### 4.5 `clef-base` Pilot

- prove the model on a small shared-surface set in `clef-base`
- replace a bounded portion of handwritten `globals.css` with generated semantic contracts
- demonstrate that generated CSS and current theme semantics can coexist

### 4.6 Parser, Compiler, and Runtime Threading

- parse new contract and lens artifacts
- compile them into a resolved contract graph
- expose runtime helpers for:
  - contract lookup
  - lens lookup
  - state resolution
  - platform realization lookup
- integrate those helpers into existing surface rendering without a parallel bespoke pipeline

---

## 5. Initial Contract Vocabulary

The first batch should stay small and high leverage.

### 5.1 Shared Surfaces

- `page-shell`
- `page-header`
- `page-section`
- `floating-panel`
- `floating-menu`
- `floating-trigger`
- `menu-item`
- `field-control`
- `field-label`
- `field-help`
- `inline-editor`
- `detail-grid`
- `detail-label`
- `detail-value`
- `toolbar`
- `empty-state`
- `alert-surface`

### 5.2 State Model

Contracts should support a shared state vocabulary where relevant:

- `idle`
- `hover`
- `focus`
- `selected`
- `active`
- `disabled`
- `invalid`
- `success`
- `warning`
- `destructive`

### 5.3 Semantic Resource Categories

Contracts should resolve against:

- background/surface roles
- text roles
- border/emphasis roles
- typography roles
- spacing/density roles
- radius/shape roles
- elevation roles
- motion roles
- visualization roles where applicable

### 5.4 First Contract Semantics Table

| Contract | Purpose | Typical States | Required Theme Inputs | First Pilot Targets |
|---|---|---|---|---|
| `floating-panel` | popover/dialog/panel chrome | `idle`, `focus` | surface, border, radius, elevation | `FieldsPopover`, `GroupPopover` |
| `floating-trigger` | compact anchored control trigger | `idle`, `hover`, `focus`, `disabled` | control bg, border, focus, density | `DisplayAsPicker`, `FieldPickerDropdown` |
| `menu-item` | selectable list row | `idle`, `hover`, `selected`, `disabled` | row bg, selected bg, text, spacing | pickers, popovers |
| `field-control` | input/select/textarea shell | `idle`, `focus`, `invalid`, `disabled` | control bg, border, focus, error, radius | `FieldWidget`, `CreateForm` |
| `field-label` | field heading and metadata | `idle` | typography role, muted text role | form widgets |
| `page-section` | page-level grouped content block | `idle` | section surface, border, spacing, title role | primary admin views |
| `detail-grid` | key/value inspection shell | `idle` | container border, row separator, label/value roles | `DetailDisplay` |
| `inline-editor` | inline edit shell | `idle`, `focus`, `invalid`, `saving` | control bg, focus, error, motion | `InlineEdit`, `InlineCellEditor` |

---

## 6. Platform Realization Strategy

### 6.1 Web / CSS

Output:

- semantic CSS custom properties
- generated contract selectors or classes
- theme-scoped resource blocks
- optional generated part-binding helpers

Mechanically, the CSS realizer should:

1. resolve each contract into a property graph of semantic roles
2. map those roles onto CSS variables and CSS declarations
3. emit:
   - global theme vars
   - contract base selectors
   - contract state selectors
   - optional density/style-profile/motif selectors

Example generated shape:

```css
[data-contract="field-control"] {
  background: var(--sc-field-control-background);
  color: var(--sc-field-control-foreground);
  border: 1px solid var(--sc-field-control-border);
  border-radius: var(--sc-field-control-radius);
}

[data-contract="field-control"][data-contract-state~="invalid"] {
  border-color: var(--sc-field-control-border-invalid);
}
```

### 6.2 WinUI

Output:

- XAML resource dictionaries
- style resources
- control-template bindings where needed
- state-trigger-compatible contract realization

Mechanically, the WinUI realizer should emit:

- resource keys per contract role
- optional style resources per contract/state
- bindings to native control properties where the target supports them directly

It should not attempt to force DOM-like part structure onto XAML.

### 6.3 GTK / GNOME

Output:

- GTK/libadwaita style-class mappings
- theme CSS where applicable
- semantic role metadata for widget factories

Mechanically, GTK realization should favor:

- style classes
- libadwaita-compatible role mapping
- GTK CSS for shared visual treatment
- per-widget class application rather than generated subtree assumptions

### 6.4 SwiftUI

Output:

- environment keys
- style wrappers / modifiers
- semantic shape/background/focus/elevation application helpers

Mechanically, SwiftUI realization should generate:

- strongly typed style wrappers for each contract family
- environment-backed theme resources
- state-driven modifier chains for supported states

### 6.5 Platform Escape Hatches

Some properties must remain target-specific:

- native focus affordance details
- material/blur support
- toolkit-specific control anatomy
- accessibility visuals required by the OS

The contract model should permit target-specific realization without polluting the shared IR.

---

## 7. Concept Changes

### 7.1 New Concepts

- `specs/surface/surface-contract.concept`
- `specs/surface/surface-lens.concept`
- `specs/surface/theme-realizer.concept`

### 7.2 Modified Concepts

- `specs/surface/theme.concept`
- `specs/surface/widget.concept`
- `specs/surface/affordance.concept`
- `specs/surface/render-transform.concept`

### 7.3 Concept-Level Goal

Make semantic presentation contracts a first-class Surface concern so platform-native realization becomes analyzable and generatable.

### 7.4 Proposed Artifact Responsibilities

#### `surface-contract.concept`

Must model:

- contract identity
- purpose
- state vocabulary
- semantic resource slots
- density/style-profile/motif compatibility
- target capability constraints

#### `surface-lens.concept`

Must model:

- source target:
  - widget part
  - view wrapper
  - render-program node
- destination contract
- optional contract variant
- optional state projection rules
- precedence when multiple lenses could apply
- semantic selector predicates for render-program-node matching

#### `theme-realizer.concept`

Must model:

- target platform id
- supported contract features
- mapping rules from semantic resources to target-native properties
- output artifact kinds
- fallback behavior for unsupported features

### 7.5 Pseudo-Schema Sketch

The first PRD revision should be concrete enough to imply a shape like:

```text
surface-contract FieldControl {
  states: idle, focus, invalid, disabled
  resources {
    background: surface.control
    foreground: text.default
    border: border.control
    focusRing: border.focus
    errorBorder: status.error
    radius: shape.control
    typography: type.body-md
  }
  density {
    compact: spacing.2
    comfortable: spacing.3
  }
}
```

```text
surface-lens ClefBaseFieldWidgetLens {
  bind widget FieldWidget {
    input -> FieldControl
    label -> FieldLabel
    help -> FieldHelp
  }
}
```

```text
surface-lens ClefBaseGeneratedFieldLens {
  bind render-node where {
    role = "input"
    ancestry contains "form"
  } -> FieldControl
}
```

```text
theme-realizer CssSurfaceRealizer {
  target: web-css
  emits: ContractManifest, ContractCss
}
```

---

## 8. Syncs

No new syncs are required in the first architecture PRD by default.

Possible later sync work:

- register lenses for widget/view implementations
- derive platform realization inputs from active theme + chosen widget + target platform

For the first pass, direct provider/compiler integration is preferred over adding orchestration syncs prematurely.

### 8.1 Compiler/Provider Hooks Needed

The first implementation should add explicit hooks in:

- contract parser
- lens parser
- realization compiler
- widget/view render path
- render-program semantic annotation

Not via syncs first.

The intended internal API shape should include:

- `resolveSurfaceLenses(widgetId, viewId, platform)`
- `bindContracts(parts, resolvedLenses, themeContext)`
- `realizeContracts(target, themeId, contractBindings)`
- `matchRenderNodeContracts(nodeMetadata, resolvedLenses, themeContext)`

---

## 9. Widgets

### 9.1 Immediate Widget Impact

No widget specs must change in the first architecture card set, but pilot widgets in `clef-base` should gain contract bindings.

Likely first pilot widgets:

- `FieldsPopover`
- `DisplayAsPicker`
- `FieldWidget`
- `DetailDisplay`

### 9.3 Exact Widget Pilot Binding

The pilot should prove:

- one floating family:
  - `FieldsPopover`
  - `DisplayAsPicker`
- one form family:
  - `FieldWidget`
- one display family:
  - `DetailDisplay`

That gives shared contract reuse across unrelated widgets without requiring whole-app migration.

### 9.2 Widget-Level Goal

Widgets expose anatomy and behavior; contracts provide shared semantic chrome across widgets and targets.

---

## 10. Views

### 10.1 Immediate View Impact

No new view specs are required.

Pilot integrations should use a small number of `clef-base` primary views to prove:

- page-level wrappers
- section surfaces
- summary/status surfaces

can be expressed through contracts rather than one-off classes.

### 10.2 View-Level Goal

Views should be able to bind repeated wrappers to semantic contracts without becoming style-specific implementations.

### 10.3 Exact View Pilot Binding

The first view pilot should only target:

- page shell wrapper
- page header block
- section block
- empty/summary/status wrapper

It should not try to encode route-specific layout logic or navigation rules as contracts.

---

## 11. Seeds

No seed changes are required in the architecture PRD by default.

Possible later seeds:

- reusable contract vocabularies
- target capability presets
- platform-default realization policies

These should only be added if static concept defaults are not sufficient.

---

## 12. `clef-base` Integration Checklist

- generated CSS can realize a bounded set of shared `clef-base` surfaces
- handwritten `globals.css` shrinks for the pilot area rather than growing
- existing themes still render correctly through the generated contract layer
- affordance-driven widget resolution still works unchanged in the first pass
- at least one contract family is used by multiple unrelated widgets
- contract output is visibly distinct under `light`, `dark`, `editorial`, and `signal`

---

## 13. Verification Strategy

- concept parser and compiler coverage for new artifacts
- renderer tests for CSS realization output
- focused widget/view pilot tests in `clef-base`
- golden/snapshot tests for generated contract output
- audit tests proving no fallback to raw hardcoded surface styles in pilot areas
- contract/lens resolution tests showing deterministic binding

### 13.1 Concrete Acceptance Tests

The first implementation should pass these exact checks:

1. Parsing
- sample `surface-contract`, `surface-lens`, and `theme-realizer` specs parse successfully

2. Resolution
- a known widget/view + platform + theme resolves to a deterministic contract binding set
- a known render-program node selector resolves to the same contract binding set across repeated runs

3. CSS generation
- generated CSS contains expected selectors and state variants for the pilot contracts

4. `clef-base` pilot
- pilot widgets/views render using generated contract attributes/selectors instead of handwritten one-off rules for the migrated areas
- at least one migrated surface is bound through a render-program-node selector rather than only direct widget-part binding

5. Theme differentiation
- contract output differs meaningfully under `light`, `dark`, `editorial`, and `signal`

6. Non-web feasibility
- one native-target realization can be produced for the pilot contracts, even if only as a spike artifact

---

## 14. Risks

### 14.1 IR Too Low-Level

If contracts become CSS-in-disguise, the system will not generalize to native targets.

### 14.2 IR Too Abstract

If contracts are too vague, realizers will guess differently and cross-platform consistency will collapse.

### 14.3 Overlap With Widgets and Affordances

If contract semantics blur into widget behavior or affordance selection, the architecture will become harder to reason about.

### 14.4 Premature Full Generation

Trying to replace all handwritten app styling immediately would create too much migration risk.

---

## 15. Implementation Plan

### 15.1 Card 1 — Surface Contract Core Model

Define the `SurfaceContract` concept, parser support, runtime model, and minimal contract vocabulary.

Includes:

- concept spec
- parser
- manifest/runtime types
- sample contract fixtures
- contract resolution tests

### 15.2 Card 2 — Surface Lens Binding Model

Define `SurfaceLens`, parser support, resolution logic, and part-to-contract mapping semantics.

Includes:

- precedence rules
- widget-part binding support
- view-wrapper binding support
- render-program-node selector support
- deterministic resolution tests

### 15.3 Card 3 — Theme Realizer Abstraction

Define `ThemeRealizer` plus CSS realizer MVP.

Includes:

- output manifest kind definitions
- generated CSS target
- generated contract manifest target
- tests over emitted artifacts

### 15.4 Card 4 — Resolver Integration

Thread contract profile awareness into widget-resolution context without destabilizing affordance scoring.

Includes:

- runtime contract binding hook after widget choice
- optional contract-profile metadata exposed to scoring, but disabled by default unless explicitly used
- no change to current chooser outcomes in the initial compatibility mode

### 15.5 Card 5 — `clef-base` Pilot

Apply contracts to a small set of shared surfaces and generate web output.

Includes:

- migrated floating family
- migrated form family
- migrated detail/page-section family
- reduced handwritten CSS in the pilot scope
- regression tests over migrated surfaces

### 15.6 Card 6 — Native Target Feasibility Spike

Prove one non-web target mapping strategy, preferably WinUI or SwiftUI.

Includes:

- one target-specific generated artifact family
- mapping notes for unsupported features
- comparison of where the shared IR was sufficient vs where target escapes were required

---

## 16. Kanban Card Table

| Card | Deliverable | Section | Depends On | Unblocks | Priority | Commit |
|---|---|---|---|---|---|---|
| MAG-658 | Surface contract core model | §15.1 | — | MAG-659, MAG-660, MAG-661, MAG-663 | high | `479c19a0` |
| MAG-659 | Surface lens binding model | §15.2 | MAG-658 | MAG-660, MAG-662 | high | `9ef45777` |
| MAG-660 | Theme realizer abstraction + CSS MVP | §15.3 | MAG-658, MAG-659 | MAG-662, MAG-663 | high | `8712e59b` |
| MAG-661 | Resolver integration for contract awareness | §15.4 | MAG-658 | — | medium | |
| MAG-662 | `clef-base` pilot integration | §15.5 | MAG-659, MAG-660 | — | high | |
| MAG-663 | Native target feasibility spike | §15.6 | MAG-658, MAG-660 | — | medium | |

---

## 17. Open Questions

- should `SurfaceContract` be a new spec artifact or a specialized Surface provider concept family?
- should contract realization happen at build time only, or support runtime theme switching through generated indirection?
- what is the minimal contract vocabulary that proves portability without overfitting to web UI?
- which second renderer target is the best architectural proving ground: WinUI, GTK, or SwiftUI?

---

## 18. Decisions

- `SurfaceContract` should be a new spec artifact, not only a provider-family concern.
- `SurfaceLens` should support widget-part binding, view-wrapper binding, and render-program-node binding from the first version.
- render-program-node binding must use semantic selector predicates over stable node metadata, not brittle structural selectors.
- contract realization should happen at build time, with runtime theme switching supported through generated indirection and scoped resource activation.
- the MVP contract vocabulary should stay small and center on shared reusable admin/product surfaces.
- the first non-web realization spike should target SwiftUI, with WinUI as the next native target.

### 18.1 VK Mapping

- epic: `MAG-657` — Surface Contract Theming Layer
- cards:
  - `MAG-658` — Surface contract core model
  - `MAG-659` — Surface lens binding model
  - `MAG-660` — Theme realizer abstraction and CSS MVP
  - `MAG-661` — Resolver integration for contract awareness
  - `MAG-662` — `clef-base` pilot integration for surface contracts
  - `MAG-663` — Native target feasibility spike
