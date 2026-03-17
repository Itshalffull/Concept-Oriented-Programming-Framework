# Surface Render Programs Suite

## Overview

Apply the monadic/functional pattern to the Surface rendering pipeline.
Widget and theme codegen handlers return inspectable `RenderProgram` data
instead of directly producing code strings — enabling dry-run generation,
caching, cross-target analysis, and a11y auditing before any code is emitted.

## Reused Concepts (from monadic-handlers suite)

These concepts are generic enough to work unmodified:

| Concept | Reuse Rationale |
|---------|----------------|
| **ProgramAnalysis** | Dispatches named analysis to registered providers. Takes `program: String` — works for render programs. |
| **ProgramCache** | Keyed by `programHash + stateHash`. Cache render output keyed by `widgetHash + themeHash + target`. |
| **FunctionalHandler** | Registers handlers by concept/action with purity tracking. Widget/theme generators register here. |

## New Concepts

### 1. RenderProgram [R]

**Purpose:** Build sequences of UI rendering instructions as inspectable,
composable data. A RenderProgram describes what a widget or theme should
produce without emitting framework-specific code.

**Instructions:**
- `element(part, role)` — emit an anatomy part
- `text(part, content)` — emit text content within a part
- `prop(name, type, defaultValue)` — declare a component prop
- `bind(part, attr, expr)` — wire a data attribute to an expression
- `stateDef(name, initial)` — declare an FSM state
- `transition(from, event, to)` — add an FSM transition
- `aria(part, attr, value)` — attach an accessibility attribute
- `keyboard(key, event)` — map a key to a state event
- `focus(strategy, initial)` — configure focus management
- `compose(widget, slot)` — nest another widget
- `token(path, fallback)` — reference a theme design token
- `pure(output)` — terminate with the final output data

**State:** programs, instructions, parts, tokens, terminated

### 2. RenderInterpreter [I]

**Purpose:** Execute a RenderProgram against a target framework, producing
framework-specific code (React JSX, Svelte template, SwiftUI View, CSS
custom properties, etc.) with execution tracing for debugging.

**Targets:**
- react, nextjs, svelte, vue, solid
- swiftui, appkit, watchkit, compose (Jetpack)
- react-native, winui, ink
- css-variables, tailwind, react-native-styles, w3c-dtcg, terminal

**Actions:** register, execute, dryRun, listTargets

### 3. A11yAuditProvider [A]

**Purpose:** Analyze a RenderProgram for accessibility completeness —
missing ARIA attributes, keyboard navigation gaps, focus management
issues, and color contrast violations.

**Checks:**
- Every interactive part has an ARIA role
- Every element with visible text has aria-label or aria-labelledby
- Keyboard mappings cover Enter, Escape, Tab at minimum
- Focus trap configured for modal/dialog widgets
- Color tokens pass WCAG AA contrast ratio

### 4. DeadPartProvider [D]

**Purpose:** Detect anatomy parts declared in a RenderProgram that are
never connected to data attributes or rendered in any branch.

**Detection:**
- Parts with no `bind()` or `text()` referencing them
- Parts not reachable from root through `compose()` chains
- States with no inbound transitions (unreachable states)

### 5. ThemeComplianceProvider [T]

**Purpose:** Verify that every theme token reference in a RenderProgram
resolves to a valid key in the active ThemeManifest.

**Checks:**
- All `token(path)` instructions resolve to a theme key
- No deprecated token paths used
- Token type matches usage context (color token for color props, spacing for gaps)
- Dark/light mode coverage (tokens exist in all theme variants)

## Syncs

### Required

| Sync | When | Then |
|------|------|------|
| BuildAndRender | FunctionalHandler/build (widget/theme handler) | RenderInterpreter/execute |
| AnalyzeOnBuild | FunctionalHandler/build (widget/theme handler) | A11yAuditProvider/audit |
| DispatchA11yAudit | ProgramAnalysis/run (provider: "a11y-audit") | A11yAuditProvider/audit |
| RegisterA11yAuditProvider | A11yAuditProvider/audit | ProgramAnalysis/registerProvider |
| InterpretRenderPrograms | RenderProgram actions complete | RenderInterpreter/execute |

### Recommended

| Sync | When | Then |
|------|------|------|
| CacheLookupBeforeRender | FunctionalHandler/build → before execute | ProgramCache/lookup |
| CacheStoreAfterRender | RenderInterpreter/execute completes | ProgramCache/store |
| InvalidateCacheOnSpecChange | Widget/theme spec modified | ProgramCache/invalidateByProgram |
| DispatchDeadParts | ProgramAnalysis/run (provider: "dead-parts") | DeadPartProvider/analyze |
| RegisterDeadPartProvider | DeadPartProvider/analyze | ProgramAnalysis/registerProvider |
| DispatchThemeCompliance | ProgramAnalysis/run (provider: "theme-compliance") | ThemeComplianceProvider/verify |
| RegisterThemeComplianceProvider | ThemeComplianceProvider/verify | ProgramAnalysis/registerProvider |

## Derived Concept

```
derived SurfaceRenderPrograms [T] {
  composes {
    RenderProgram [T]
    RenderInterpreter [T]
    A11yAuditProvider [T]
    DeadPartProvider [T]
    ThemeComplianceProvider [T]
  }
  uses {
    ProgramAnalysis [T]    // from monadic-handlers
    ProgramCache [T]       // from monadic-handlers
    FunctionalHandler [T]  // from monadic-handlers
  }
}
```

## Handler Architecture

### Bootstrap (imperative)
- RenderProgram handler — manages render program state
- RenderInterpreter handler — executes programs per target

### Functional (return StorageProgram via monadic DSL)
- A11yAuditProvider — pure analysis, stores results
- DeadPartProvider — pure analysis, stores results
- ThemeComplianceProvider — pure analysis, stores results

## Migration Path

1. Existing widget-gen-react.generate() logic → pure function inside RenderInterpreter
2. Existing theme-gen.generate() logic → pure function inside RenderInterpreter
3. Existing widget-gen.generate() dispatcher → replaced by FunctionalHandler/build + syncs
4. Plugin registry pattern → replaced by ProgramAnalysis provider registration
