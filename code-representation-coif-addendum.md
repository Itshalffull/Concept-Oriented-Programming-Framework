# Clef Code Representation — Clef Surface Addendum

## Addendum to: Code Representation & Semantic Query System v0.1.0

**Purpose:** Extend the representation system to cover all Clef Surface frontend artifacts — `.widget` specs, `.theme` specs, generated framework components, the runtime selection pipeline, and cross-system traversal from concept state fields to rendered widgets.

---

## 1. The Problem

The base design doc treats Clef's backend artifacts (`.concept`, `.sync`, configs, generated handlers) but ignores the other half of the system. A Clef Surface application adds:

- `.widget` spec files with anatomy, state machines, props, accessibility contracts, connect mappings, affordance declarations, composition, and invariants
- `.theme` spec files with palettes, typography scales, motion curves, elevation, and radius systems
- Generated frontend code per framework (React, Solid, Vue, Svelte, Ink, SwiftUI) and per platform (CSS, React Native styles, terminal, W3C DTCG tokens)
- A runtime selection pipeline: concept spec → UISchema → Element → Interactor → WidgetResolver → Widget → Machine → FrameworkAdapter → Surface → pixels

Without representing these, you can't answer questions like:

| Query | Why it matters |
|-------|---------------|
| "What widget renders Article's `tags` field?" | Tracing from concept state through the selection pipeline |
| "If I change this concept's state schema, which widgets are affected?" | Cross-system impact analysis |
| "What accessibility contracts does the dialog widget declare?" | Querying widget semantic structure |
| "Which theme token resolves to this CSS variable?" | Token provenance through generation |
| "What affordances match `single-choice` with 4 options on mobile?" | Selection pipeline debugging |
| "Show me all widgets that compose other widgets" | Structural composition queries |
| "What state machine transitions does this widget support?" | Behavioral querying |
| "Which framework adapters have been generated from this widget spec?" | Generation provenance |
| "What ARIA roles are declared across all widgets?" | Accessibility auditing |
| "If I change this theme's primary color, what components are affected?" | Token dependency tracing |

---

## 2. Parse Layer Additions

### 2.1 New LanguageGrammar Providers

Two new Tree-sitter grammars for Clef Surface's spec formats, plus grammars for generated frontend code:

| Provider | Extensions | Notes |
|----------|-----------|-------|
| TreeSitterWidgetSpec | `.widget` | Custom grammar — sections: purpose, anatomy, slots, states, accessibility, props, connect, affordance, compose, invariant |
| TreeSitterThemeSpec | `.theme` | Custom grammar — sections: purpose, palette, typography, spacing, motion, elevation, radius; `extends` clause |
| TreeSitterJsx | `.jsx` | For generated React components (extends TreeSitterTypeScript) |
| TreeSitterVue | `.vue` | Single-file components with template/script/style |
| TreeSitterSvelte | `.svelte` | Single-file components |
| TreeSitterCss | `.css` | Already listed in base doc — used for generated theme output |
| TreeSitterSwiftUI | `.swift` | Already covered by TreeSitterSwift — SwiftUI is a subset |

The `.widget` grammar is structurally similar to `.concept` — both are section-based specs with typed declarations. Key differences: `.widget` has `anatomy {}`, `states {}` (finite state machine, not data state), `accessibility {}`, `connect {}` (prop wiring), and `affordance {}` sections.

### 2.2 FileArtifact Role Extensions

New role values for Clef Surface files:

| Role | Files |
|------|-------|
| `spec:widget` | `.widget` files |
| `spec:theme` | `.theme` files |
| `generated:component` | Generated React/Solid/Vue/Svelte components |
| `generated:styles` | Generated CSS, RN styles, terminal styles |
| `generated:tokens` | Generated W3C DTCG JSON, CSS custom properties |
| `generated:types` | Generated TypeScript types for widget props |

These integrate with the existing FileArtifact concept — no new concept needed, just new role vocabulary registered via Tag.

### 2.3 DefinitionUnit Kinds for Clef Surface

New `kind` values for DefinitionUnit extraction from `.widget` and `.theme` files:

| Kind | Extracted from | Granularity |
|------|---------------|-------------|
| `widget-spec` | `.widget` file top level | One per file |
| `anatomy-part` | `anatomy {}` section entries | One per part declaration |
| `widget-state` | `states {}` section entries | One per state in the FSM |
| `widget-transition` | Transition declarations in states | One per `on EVENT -> state` |
| `widget-prop` | `props {}` section entries | One per prop declaration |
| `connect-mapping` | `connect {}` section entries | One per anatomy-part → props mapping |
| `affordance-decl` | `affordance {}` section | One per affordance block |
| `slot-def` | `slots {}` section entries | One per slot |
| `compose-ref` | `compose {}` section entries | One per widget composition reference |
| `theme-spec` | `.theme` file top level | One per file |
| `palette-def` | `palette {}` section | One per theme |
| `color-role` | `roles {}` within palette | One per semantic color role |
| `type-style` | `styles {}` within typography | One per named text style |
| `motion-curve` | `curves {}` within motion | One per easing curve |
| `elevation-level` | `levels {}` within elevation | One per shadow level |

This enables queries like "find all anatomy parts across all widgets that have role `dialog`" or "find all theme color roles that reference `primary`."

---

## 3. Symbol Layer Additions

### 3.1 New Symbol Extractors

| Provider | Handles | Symbols extracted |
|----------|---------|-------------------|
| WidgetSpecSymbolExtractor | `.widget` | Widget name, anatomy part names, state names, transition events, prop names, slot names, composed widget references, affordance interactor bindings |
| ThemeSpecSymbolExtractor | `.theme` | Theme name, palette color names, color role names, typography style names, motion curve names, elevation level names, spacing scale entries |
| ReactComponentSymbolExtractor | `.jsx`/`.tsx` generated components | Component name, hook names, prop type names — linked back to source widget via Provenance |
| CssTokenSymbolExtractor | `.css` generated tokens | CSS custom property names — linked back to source theme tokens |

### 3.2 Clef Surface Symbol Namespace Scheme

Extending the Symbol namespace scheme from the base doc:

```
clef/concept/Article                    # Clef concept
clef/action/Article/create              # Clef action
clef/variant/Article/create/ok          # Clef variant
clef/state-field/Article/tags           # Clef state field
clef/sync/article-crud                  # Clef sync

surface/widget/dialog                      # Clef Surface widget
surface/anatomy/dialog/root                # Anatomy part
surface/anatomy/dialog/closeTrigger        # Anatomy part
surface/state/dialog/open                  # FSM state
surface/state/dialog/closed                # FSM state
surface/transition/dialog/open/CLOSE       # Transition
surface/prop/dialog/closeOnEscape          # Widget prop
surface/slot/dialog/header                 # Slot
surface/slot/dialog/body                   # Slot
surface/affordance/dialog/overlay          # Affordance declaration
surface/compose/article-card/avatar        # Composition reference

surface/theme/light                        # Theme
surface/palette/light/primary              # Palette color
surface/color-role/light/on-primary        # Semantic color role
surface/typography/light/heading1          # Typography style
surface/motion/light/ease-out              # Motion curve
surface/elevation/light/md                 # Elevation level

surface/interactor/single-choice           # Interactor type
surface/interactor/text-short              # Interactor type
```

### 3.3 Cross-System SymbolRelationship Types

New relationship kinds connecting Clef and Clef Surface symbols:

| Kind | Source | Target | Meaning |
|------|--------|--------|---------|
| `renders` | surface/widget/* | clef/concept/* | This widget can render this concept |
| `binds-to` | surface/prop/* | clef/state-field/* | This widget prop is bound to this state field |
| `presents` | surface/anatomy/* | clef/state-field/* | This anatomy part displays this field's value |
| `triggers` | surface/anatomy/* | clef/action/* | This anatomy part triggers this action (via connect → Machine/send → Binding/invoke) |
| `classifies-as` | clef/state-field/* | surface/interactor/* | This field classifies as this interactor type |
| `resolves-to` | surface/interactor/* | surface/widget/* | This interactor resolves to this widget (via affordance matching) |
| `styles` | surface/theme/* | surface/widget/* | This theme provides tokens consumed by this widget |
| `extends-theme` | surface/theme/* | surface/theme/* | Theme inheritance (e.g., dark extends light) |
| `composes` | surface/widget/* | surface/widget/* | This widget composes that widget (via compose section) |
| `satisfies` | surface/widget/* | surface/affordance/* | This widget satisfies this affordance declaration |
| `generates-component` | surface/widget/* | ts/component/* | WidgetGen produced this framework component from this spec |
| `generates-token` | surface/palette/* | css/custom-property/* | ThemeGen produced this CSS variable from this token |

---

## 4. Semantic Layer Additions

### 4.1 New Semantic Entities

The Clef semantic layer has ConceptEntity, ActionEntity, VariantEntity, StateField, SyncEntity. The Clef Surface semantic layer needs parallel entities for its domain-specific structures.

#### WidgetEntity [W]

```
purpose: Queryable representation of a parsed widget spec — the Clef Surface counterpart to ConceptEntity.

state:
  widgets: set W
  name: W -> String
  symbol: W -> Symbol-ref
  source_file: W -> FileArtifact-ref
  purpose_text: W -> String
  version: W -> Int
  category: W -> String
  anatomy_parts: W -> list AnatomyPartEntity-ref
  states: W -> list WidgetStateEntity-ref
  props: W -> list WidgetPropEntity-ref
  slots: W -> list String           // slot names
  composed_widgets: W -> list W     // widgets referenced in compose section
  affordances: W -> list String     // affordance interactor bindings
  accessibility_role: W -> option String
  has_focus_trap: W -> Bool
  keyboard_bindings: W -> list { key: String, action: String }

actions:
  register(name: String, source: FileArtifact-ref, ast: Bytes)
    -> ok(entity: W)
    -> already_registered(existing: W)

  get(name: String)
    -> ok(entity: W)
    -> notfound()

  find_by_affordance(interactor: String)
    -> ok(widgets: list W)         // widgets that declare affordance for this interactor

  find_composing(widget: W)
    -> ok(parents: list W)         // widgets that compose this widget

  find_composed_by(widget: W)
    -> ok(children: list W)        // widgets this widget composes

  generated_components(widget: W)
    -> ok(components: list { framework: String, file: FileArtifact-ref })

  accessibility_audit(widget: W)
    -> ok(report: { role: option String, keyboard: list String, aria: list String, focus: String })
    -> incomplete(missing: list String)

  trace_to_concept(widget: W)
    -> ok(concepts: list { concept: ConceptEntity-ref, via: String })
    -> no_concept_binding()
```

#### AnatomyPartEntity [A]

```
purpose: Named part within a widget's anatomy — each carries a semantic role and connects to props via the connect section.

state:
  parts: set A
  widget: A -> WidgetEntity-ref
  name: A -> String
  symbol: A -> Symbol-ref
  semantic_role: A -> String       // "container", "action", "text", "overlay", "widget"
  required: A -> Bool
  description: A -> option String
  connect_props: A -> option String  // the connect {} mapping for this part
  aria_attrs: A -> list { attr: String, value: String }
  bound_field: A -> option Symbol-ref  // Clef state field this part presents (via connect)
  bound_action: A -> option Symbol-ref // Clef action this part triggers (via connect → send)

actions:
  register(widget: WidgetEntity-ref, name: String, role: String, required: Bool)
    -> ok(part: A)

  find_by_role(role: String)
    -> ok(parts: list A)           // all anatomy parts with this semantic role across all widgets

  find_bound_to_field(field: Symbol-ref)
    -> ok(parts: list A)           // anatomy parts that present this field

  find_bound_to_action(action: Symbol-ref)
    -> ok(parts: list A)           // anatomy parts that trigger this action
```

#### WidgetStateEntity [S]

```
purpose: A state in a widget's finite state machine, with transitions, entry/exit actions, and guards.

state:
  states_set: set S
  widget: S -> WidgetEntity-ref
  name: S -> String
  symbol: S -> Symbol-ref
  initial: S -> Bool
  transitions: S -> list { event: String, target: String, guard: option String }
  entry_actions: S -> list String
  exit_actions: S -> list String

actions:
  register(widget: WidgetEntity-ref, name: String, initial: Bool)
    -> ok(state: S)

  find_by_widget(widget: WidgetEntity-ref)
    -> ok(states: list S)

  reachable_from(state: S)
    -> ok(reachable: list S, via: list { event: String, from: String, to: String })

  unreachable_states(widget: WidgetEntity-ref)
    -> ok(unreachable: list S)     // states no transition leads to (dead states)

  trace_event(widget: WidgetEntity-ref, event: String)
    -> ok(paths: list { from: String, to: String, guard: option String })
    -> unhandled(in_states: list String)  // states where this event has no transition
```

#### WidgetPropEntity [P]

```
purpose: A declared prop on a widget — typed, with default value, connected to anatomy parts and ultimately to concept state fields.

state:
  props: set P
  widget: P -> WidgetEntity-ref
  name: P -> String
  symbol: P -> Symbol-ref
  type_expr: P -> String           // "Bool", "String", '"dialog" | "alertdialog"', etc.
  default_value: P -> option String
  connected_parts: P -> list AnatomyPartEntity-ref  // anatomy parts that read this prop

actions:
  register(widget: WidgetEntity-ref, name: String, type_expr: String, default_value: option String)
    -> ok(prop: P)

  find_by_widget(widget: WidgetEntity-ref)
    -> ok(props: list P)

  trace_to_field(prop: P)
    -> ok(field: Symbol-ref, concept: ConceptEntity-ref, via_binding: String)
    -> no_binding()                // prop not bound to any concept field
```

#### ThemeEntity [T]

```
purpose: Queryable representation of a parsed theme spec — token hierarchy, palette, typography, motion, elevation as a traversable structure.

state:
  themes: set T
  name: T -> String
  symbol: T -> Symbol-ref
  source_file: T -> FileArtifact-ref
  purpose_text: T -> String
  extends: T -> option T
  palette_colors: T -> list { name: String, value: String }
  color_roles: T -> list { name: String, references: String, contrast_ratio: option Float }
  typography_styles: T -> list { name: String, stack: String, weight: Int, tracking: String }
  motion_curves: T -> list { name: String, value: String }
  elevation_levels: T -> list { name: String, y: String, blur: String, spread: String, opacity: Float }
  spacing_unit: T -> String
  radius_values: T -> list { name: String, value: String }

actions:
  register(name: String, source: FileArtifact-ref, ast: Bytes)
    -> ok(entity: T)
    -> already_registered(existing: T)

  get(name: String)
    -> ok(entity: T)
    -> notfound()

  resolve_token(theme: T, token_path: String)
    -> ok(resolved_value: String, resolution_chain: list String)
    -> notfound(token_path: String)
    -> broken_chain(broken_at: String)

  contrast_audit(theme: T)
    -> ok(all_passing: Bool, results: list { role_pair: String, ratio: Float, passes: String })

  diff_themes(a: T, b: T)
    -> ok(differences: list { token: String, a_value: String, b_value: String })
    -> same()

  affected_widgets(theme: T, changed_token: String)
    -> ok(widgets: list WidgetEntity-ref)  // widgets whose connect sections reference this token

  generated_outputs(theme: T)
    -> ok(outputs: list { platform: String, file: FileArtifact-ref })
```

#### InteractorEntity [I]

```
purpose: Queryable representation of a registered interactor type — the abstract interaction taxonomy as a traversable node.

state:
  interactors: set I
  name: I -> String
  symbol: I -> Symbol-ref
  category: I -> String
  properties: I -> String          // JSON: { dataType, cardinality, optionCount, etc. }
  classification_rules: I -> list { field_type: String, constraints: String, confidence: Float }

actions:
  register(name: String, category: String, properties: String)
    -> ok(entity: I)

  find_by_category(category: String)
    -> ok(interactors: list I)

  matching_widgets(interactor: I, context: option String)
    -> ok(widgets: list { widget: WidgetEntity-ref, affordance_specificity: Int, conditions_met: list String })

  classified_fields(interactor: I)
    -> ok(fields: list { concept: ConceptEntity-ref, field: StateField-ref, confidence: Float })

  coverage_report()
    -> ok(report: list { interactor: String, widget_count: Int, uncovered_contexts: list String })
```

### 4.2 Relationship to Existing Clef Surface Concepts

The new semantic entities don't replace the existing Clef Surface runtime concepts — they exist alongside them for different purposes:

| Runtime concept (Clef Surface) | Semantic entity (new) | Distinction |
|------------------------|----------------------|-------------|
| Widget (stores parsed ASTs for instantiation) | WidgetEntity (queryable metadata for analysis) | Widget is the runtime catalog; WidgetEntity is the design-time knowledge graph node |
| Machine (FSM runtime execution) | WidgetStateEntity (static state machine structure) | Machine runs a live instance; WidgetStateEntity answers "what states exist?" without running |
| Interactor (runtime classification) | InteractorEntity (queryable taxonomy node) | Interactor classifies at runtime; InteractorEntity enables "what fields classify as this?" |
| Affordance (runtime matching) | Stored on WidgetEntity.affordances | Affordance matches at runtime; WidgetEntity.find_by_affordance queries offline |
| Theme (runtime activation) | ThemeEntity (queryable token structure) | Theme activates tokens; ThemeEntity traces token resolution chains |
| Slot (runtime content injection) | Stored on WidgetEntity.slots | No separate entity needed — slot names are metadata on WidgetEntity |

The semantic entities are populated **from** the runtime concepts' data via Transform + Enricher syncs (same pattern as Clef semantic entities).

---

## 5. Cross-System Traversal

The most valuable capability is end-to-end traversal from concept state fields to rendered widgets and back. Here are the key traversal paths:

### 5.1 Forward: Concept Field → Pixels

```
StateField (clef/state-field/Article/tags)
    ↓ classifies-as (via Interactor/classify rules)
InteractorEntity (surface/interactor/multi-choice, optionCount: 3)
    ↓ resolves-to (via WidgetResolver/resolve + Affordance matching)
WidgetEntity (surface/widget/checkbox-group)
    ↓ anatomy
AnatomyPartEntity (surface/anatomy/checkbox-group/option)
    ↓ connect mapping
WidgetPropEntity (surface/prop/checkbox-group/options)
    ↓ generates-component (via WidgetGen)
FileArtifact (generated/react/CheckboxGroup.tsx)
    ↓ renders via
FrameworkAdapter → Surface → pixels
```

This traversal answers: "How does `Article.tags` get rendered?" The answer traces through the entire selection pipeline with every intermediate decision point queryable.

### 5.2 Backward: CSS Variable → Theme Token → Source

```
Symbol (css/custom-property/--color-primary)
    ↓ generates-token (reverse of ThemeGen output)
ThemeEntity/palette_colors (surface/palette/light/primary)
    ↓ source_file
FileArtifact (themes/light.theme, line 5)
```

### 5.3 Impact: Concept Schema Change → Affected Widgets

```
StateField changed (Article.tags: set String → list String)
    ↓ classifies-as (re-classify with new type)
InteractorEntity (now: group-repeating instead of multi-choice)
    ↓ resolves-to (different widget)
WidgetEntity (now: repeating-list instead of checkbox-group)
    ↓ all anatomy parts, props, generated components change
FileArtifact (different generated output)
```

This traversal powers `clef impact Article/tags` for frontend changes.

### 5.4 Impact: Theme Token Change → Affected Components

```
ThemeEntity/palette_colors changed (primary: oklch(0.55 0.15 250) → oklch(0.45 0.20 260))
    ↓ color_roles referencing primary recalculate
    ↓ affected_widgets() query
WidgetEntity list (all widgets whose connect sections reference primary tokens)
    ↓ generated_components
FileArtifact list (all generated CSS/component files to regenerate)
```

---

## 6. New Syncs

### 6.1 Widget Semantic Extraction

```
sync WidgetSemanticSync [required]
when {
  WidgetParser/parse: [ ] => [ widget: ?w; ast: ?ast ]
}
then {
  WidgetEntity/register: [ name: ?w; source: ?file; ast: ?ast ]
  // For each anatomy part in AST:
  AnatomyPartEntity/register: [ widget: ?entity; name: ?part; role: ?role; required: ?req ]
  // For each state in AST:
  WidgetStateEntity/register: [ widget: ?entity; name: ?state; initial: ?init ]
  // For each prop in AST:
  WidgetPropEntity/register: [ widget: ?entity; name: ?prop; type_expr: ?type; default_value: ?default ]
}
```

### 6.2 Theme Semantic Extraction

```
sync ThemeSemanticSync [required]
when {
  ThemeParser/parse: [ ] => [ theme: ?h; ast: ?ast ]
}
then {
  ThemeEntity/register: [ name: ?h; source: ?file; ast: ?ast ]
}
```

### 6.3 Cross-System Binding Tracking

```
sync FieldToInteractorSync [recommended]
when {
  Interactor/classify: [ fieldType: ?type; constraints: ?constraints ]
    => [ interactor: ?interactorType; confidence: ?conf ]
}
where {
  StateField: { ?field type_expr: ?type }
}
then {
  SymbolRelationship/add: [ source: ?field_symbol; target: ?interactor_symbol; kind: "classifies-as" ]
}
```

```
sync InteractorToWidgetSync [recommended]
when {
  WidgetResolver/resolve: [ element: ?element ]
    => [ widget: ?widgetName; score: ?score; reason: ?reason ]
}
then {
  SymbolRelationship/add: [ source: ?interactor_symbol; target: ?widget_symbol; kind: "resolves-to" ]
}
```

```
sync WidgetGenProvenanceSync [required]
when {
  WidgetGen/generate: [ target: ?framework; widgetAst: ?ast ]
    => [ output: ?output ]
}
then {
  FileArtifact/set_provenance: [ artifact: ?output_file; spec: ?widget_file; generator: "WidgetGen/" + ?framework ]
  Provenance/record: [ source: ?widget_file; derived: ?output_file; method: "WidgetGen/" + ?framework ]
  SymbolRelationship/add: [ source: ?widget_symbol; target: ?component_symbol; kind: "generates-component" ]
}
```

```
sync ThemeGenProvenanceSync [required]
when {
  ThemeGen/generate: [ target: ?platform; themeAst: ?ast ]
    => [ output: ?output ]
}
then {
  FileArtifact/set_provenance: [ artifact: ?output_file; spec: ?theme_file; generator: "ThemeGen/" + ?platform ]
  Provenance/record: [ source: ?theme_file; derived: ?output_file; method: "ThemeGen/" + ?platform ]
}
```

### 6.4 Connect Section Analysis

The `connect {}` section in `.widget` files is where Clef Surface widgets bind to props. When combined with Binding (which maps concept fields to widget props), the connect section creates the traceable link from concept state to rendered UI:

```
sync ConnectMappingAnalysisSync [recommended]
when {
  WidgetEntity/register: [ ] => [ entity: ?widget ]
}
where {
  // For each connect mapping that references a prop bound to a concept field
  AnatomyPartEntity: { ?part widget: ?widget; connect_props: ?connect }
  WidgetPropEntity: { ?prop widget: ?widget }
}
then {
  // Establish renders/presents/triggers relationships
  SymbolRelationship/add: [ source: ?part_symbol; target: ?field_symbol; kind: "presents" ]
  // or
  SymbolRelationship/add: [ source: ?part_symbol; target: ?action_symbol; kind: "triggers" ]
}
```

---

## 7. Analysis Layer Extensions

### 7.1 DependenceGraph Provider for Clef Surface

New providers for the DependenceGraph coordination concept:

| Provider | Scope | Dependencies computed |
|----------|-------|----------------------|
| WidgetDependenceProvider | `.widget` files | compose → composed widget, connect → prop → anatomy part, affordance → interactor |
| ThemeDependenceProvider | `.theme` files | extends → parent theme, role → palette color, token reference chains |
| SelectionPipelineDependenceProvider | cross-system | field → interactor → affordance → widget (the full selection chain) |
| BindingDependenceProvider | runtime bindings | concept field → signal → widget prop (the full data binding chain) |

### 7.2 New AnalysisRule Built-ins for Clef Surface

| Rule | Category | What it checks |
|------|----------|---------------|
| `dead-widget-states` | dead-code | FSM states unreachable from initial via any transition |
| `unhandled-events` | completeness | Events declared in transitions but not connected to any anatomy part's onClick/onKeyDown |
| `missing-a11y-role` | accessibility | Widgets with no `accessibility { role: }` declaration |
| `missing-keyboard-binding` | accessibility | Interactive widgets (affordance.interactor is edit or control) with no keyboard section |
| `missing-focus-management` | accessibility | Dialog/overlay widgets without focus trap declaration |
| `orphan-anatomy-parts` | dead-code | Anatomy parts not referenced in any connect mapping |
| `unbound-props` | completeness | Props declared but never referenced in connect section |
| `affordance-gaps` | coverage | Interactor types with no matching affordance for certain contexts (e.g., "watch" viewport) |
| `contrast-violations` | accessibility | Theme color role pairings below WCAG AA ratios |
| `missing-reduced-motion` | accessibility | Motion curves without reducedMotion fallback |
| `circular-composition` | architecture | Widget A composes B which composes A |
| `token-orphans` | dead-code | Theme tokens defined but never referenced by any widget or role |

### 7.3 Clef Surface-Specific ProgramSlice Capabilities

Forward slicing from a theme token:
```
clef analyze slice surface/palette/light/primary --direction forward
```
Returns: all color roles referencing primary → all widgets using those roles → all generated CSS files containing those custom properties.

Backward slicing from a generated component:
```
clef analyze slice generated/react/CheckboxGroup.tsx --direction backward
```
Returns: CheckboxGroup.tsx ← WidgetGen ← checkbox-group.widget ← affordance match ← multi-choice interactor ← Article.tags state field ← Article.concept.

---

## 8. CLI Additions

### 8.1 New Inspect Commands

```
clef inspect widget <name>
  # Full semantic breakdown: anatomy, states, props, a11y, affordances, composition
  # Shows which concept fields resolve to this widget and via what affordance

clef inspect theme <name>
  # Full token hierarchy, palette with contrast ratios, typography scale
  # Shows which widgets reference which tokens

clef inspect selection <concept/field>
  # Traces the full selection pipeline:
  # field type → interactor classification → affordance matching → resolved widget
  # Shows context-dependent variations (desktop vs mobile vs watch)
```

### 8.2 New Query Commands

```
clef query widget-for-field <concept/field> [--context <json>]
  # "What widget renders Article/tags on mobile?"
  # Runs the selection pipeline with given context

clef query fields-for-widget <widget-name>
  # "What concept fields does checkbox-group render?"
  # Reverse traversal from widget to bound fields

clef query theme-impact <theme/token>
  # "If I change primary color, what's affected?"
  # Forward slice through token resolution → widgets → generated files

clef query a11y-audit [--widget <name>] [--all]
  # Accessibility completeness audit across all widgets
  # Checks roles, keyboard, focus, ARIA, contrast
```

### 8.3 New Check Patterns

```
clef check
  --pattern dead-widget-states
  --pattern missing-a11y-role
  --pattern missing-keyboard-binding
  --pattern affordance-gaps
  --pattern contrast-violations
  --pattern missing-reduced-motion
  --pattern circular-composition
  --pattern orphan-anatomy-parts
  --pattern unbound-props
  --pattern token-orphans
```

---

## 9. Clef Bind Updates

### 9.1 MCP Tools Additions

```
tools:
  - clef_inspect_widget: Full widget semantic breakdown
  - clef_inspect_theme: Theme token hierarchy with contrast
  - clef_inspect_selection: Selection pipeline trace for a field
  - clef_query_widget_for_field: What widget renders this field
  - clef_query_fields_for_widget: What fields does this widget render
  - clef_query_theme_impact: Token change impact analysis
  - clef_query_a11y_audit: Accessibility audit
```

### 9.2 Claude Skills Additions

```
skills:
  - clef-widget-designer:
      description: "Design and validate Clef Surface widget specs"
      tools: [inspect_widget, query_a11y_audit, check_dead_widget_states, check_missing_a11y]

  - clef-theme-designer:
      description: "Design and validate Clef Surface theme specs with accessibility"
      tools: [inspect_theme, query_theme_impact, check_contrast_violations, check_missing_reduced_motion]

  - clef-selection-debugger:
      description: "Debug and tune the widget selection pipeline"
      tools: [inspect_selection, query_widget_for_field, query_fields_for_widget, check_affordance_gaps]

  - clef-full-stack-impact:
      description: "Trace impact of changes across backend and frontend"
      tools: [query_impact, query_widget_for_field, query_theme_impact, analyze_slice]
```

---

## 10. Updated Concept Inventory

### 10.1 New Semantic Entities (this addendum)

| Concept | Kit | Notes |
|---------|-----|-------|
| WidgetEntity | Semantic | Queryable widget spec — parallel to ConceptEntity |
| AnatomyPartEntity | Semantic | Named widget part with semantic role and bindings |
| WidgetStateEntity | Semantic | FSM state with transitions — static analysis of behavior |
| WidgetPropEntity | Semantic | Typed prop declaration with binding trace |
| ThemeEntity | Semantic | Queryable theme structure with token resolution |
| InteractorEntity | Semantic | Queryable interaction taxonomy node |

### 10.2 New Providers (this addendum)

| Provider | Kit | Coordination concept |
|----------|-----|---------------------|
| TreeSitterWidgetSpec | Parse | LanguageGrammar |
| TreeSitterThemeSpec | Parse | LanguageGrammar |
| WidgetSpecSymbolExtractor | Symbol | Symbol (extraction) |
| ThemeSpecSymbolExtractor | Symbol | Symbol (extraction) |
| ReactComponentSymbolExtractor | Symbol | Symbol (extraction) |
| CssTokenSymbolExtractor | Symbol | Symbol (extraction) |
| WidgetScopeProvider | Symbol | ScopeGraph |
| WidgetDependenceProvider | Analysis | DependenceGraph |
| ThemeDependenceProvider | Analysis | DependenceGraph |
| SelectionPipelineDependenceProvider | Analysis | DependenceGraph |
| BindingDependenceProvider | Analysis | DependenceGraph |

### 10.3 Revised Totals

From base design doc:
- 20 coordination concepts + ~35 providers + 5 suites

This addendum adds:
- 6 semantic entities (WidgetEntity, AnatomyPartEntity, WidgetStateEntity, WidgetPropEntity, ThemeEntity, InteractorEntity)
- ~11 providers
- 0 new suites (entities go in Semantic Kit; providers go in existing Parse/Symbol/Analysis suites)
- ~7 new syncs
- 12 new AnalysisRule built-ins

**Updated totals:**
- Base Clef library: 54 concepts, 15 suites
- Code Representation system: 26 coordination concepts + ~46 providers, 5 new suites
- Clef Surface: 29 concepts, 7 suites

Combined: **~109 coordination concepts + ~46 providers across 27 suites**

Concept library version: **v0.5.0** (encompasses both base doc and this addendum)

---

## 11. Implementation Phase Updates

The Clef Surface additions integrate into the existing phase plan from the base doc:

### Phase 1 (Parse Foundation) — add:
- TreeSitterWidgetSpec and TreeSitterThemeSpec grammar providers
- FileArtifact roles for Clef Surface files

### Phase 2 (Symbol Identity) — add:
- WidgetSpecSymbolExtractor and ThemeSpecSymbolExtractor providers
- Clef Surface namespace scheme registration

### Phase 3 (Semantic Entities) — add:
- WidgetEntity, AnatomyPartEntity, WidgetStateEntity, WidgetPropEntity, ThemeEntity, InteractorEntity
- WidgetSemanticSync, ThemeSemanticSync
- Cross-system SymbolRelationship types

### Phase 5 (Analysis Overlays) — add:
- WidgetDependenceProvider, ThemeDependenceProvider, SelectionPipelineDependenceProvider
- All Clef Surface AnalysisRule built-ins
- Cross-system traversal queries

### Phase 6 (Search & Discovery) — add:
- Clef Surface-specific MCP tools and Claude Skills

### Phase 7 (Interface Exposure & DevServer) — add:
- DevServer hot-reload for `.widget` and `.theme` files → reparse → update semantic entities → re-run analysis
- Full-stack impact: edit `.concept` → trace through selection pipeline → identify affected `.widget` → identify affected generated components
