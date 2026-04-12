# Surface Contract → SwiftUI Mapping Notes

**Card:** MAG-663 — Native Target Feasibility Spike  
**Date:** 2026-04-12  
**Author:** HandlerScaffoldGen  
**Related:** `handlers/ts/surface/theme-realizer-swiftui.ts`, PRD §6.4, §15.6

---

## 1. Purpose

This document records the findings from the SwiftUI native-target feasibility spike.
The goal was to verify that the shared contract IR used by the web CSS realizer can
drive SwiftUI output — and to document where that IR was sufficient versus where
target-specific rendering logic was required.

The three contracts used as the pilot set are:

- `field-control` — input/select shell with focus, invalid, disabled states
- `floating-panel` — popover/dialog/panel chrome
- `page-section` — page-level grouped content block

---

## 2. What Maps Cleanly

### 2.1 Contract identity and enumeration

The `id`, `states`, `variants`, and `resources` fields of each `ContractSpec` map
directly to Swift constructs with no impedance:

| IR field | SwiftUI mapping |
|---|---|
| `id` | `struct` name (PascalCase), View extension method (camelCase) |
| `states` | `enum` cases in a typed `FooState` enum |
| `variants` | additional `enum` cases or separate enum (density/motif variants) |
| `resources` | resolved to `Color(…)` / `CGFloat` literals via a token table |

The enum-per-contract pattern is idiomatic SwiftUI. State is modeled as a typed
enum value passed to the ViewModifier at the call site:

```swift
TextField("…", text: $value)
  .fieldControl(state: hasError ? .invalid : .normal)
```

This is cleaner than CSS data-attributes because SwiftUI is statically typed —
the compiler enforces that only valid states can be passed.

### 2.2 Semantic resource resolution

The contract IR carries semantic resource names (`surface.control`, `border.focus`,
`status.error`, etc.) rather than raw values. These map cleanly to SwiftUI's own
semantic color system:

| Semantic resource | Swift Color expression |
|---|---|
| `surface.control` / `surface` | `Color(.systemBackground)` |
| `surface.overlay` | `Color(.secondarySystemBackground)` |
| `text.default` / `foreground` | `Color(.label)` |
| `text.muted` / `foreground-muted` | `Color(.secondaryLabel)` |
| `border.control` / `border` | `Color(.separator)` |
| `border.focus` / accent | `.accentColor` |
| `status.error` / `border.invalid` | `Color.red` |
| `surface.selected` / accent-selected | `Color.accentColor.opacity(0.15)` |

SwiftUI's system-color palette automatically adapts to light/dark mode — the
contract IR's theme token concept aligns well with `@Environment(\.colorScheme)`
for any theme-specific overrides beyond system defaults.

### 2.3 State-conditional modifier chains

CSS uses cascade-based state selectors:

```css
[data-contract="field-control"][data-contract-state~="invalid"] {
  border-color: var(--sc-field-control-border-invalid);
}
```

SwiftUI uses conditional modifiers within `body(content:)`:

```swift
content
  .background(state == .invalid ? Color.red.opacity(0.1) : Color(.systemBackground))
  .overlay(
    RoundedRectangle(cornerRadius: 6)
      .stroke(borderColor, lineWidth: state == .focus ? 2 : 1)
  )
```

Both are driven by the same IR state vocabulary. The translation is mechanical and
automatable: the state list from the contract becomes the set of switch/ternary arms.

### 2.4 Spacing and shape tokens

CSS uses px values via custom properties:

```css
padding: var(--sc-field-control-padding, var(--spacing-2));
border-radius: var(--sc-field-control-radius, var(--radius-control));
```

SwiftUI uses CGFloat/Double literals directly:

```swift
.padding(8)
.clipShape(RoundedRectangle(cornerRadius: 6))
```

The numeric values round-trip cleanly from the token table. No information is lost.

---

## 3. Where Target Escapes Are Required

### 3.1 CSS pseudo-elements (`::before`, `::after`)

**CSS:**
```css
[data-contract="field-control"]::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
}
```

**SwiftUI:** There is no pseudo-element equivalent. The pattern must be expressed
as an explicit `overlay(…)` with a `ZStack` or `background(…)` ViewBuilder:

```swift
content
  .overlay(
    RoundedRectangle(cornerRadius: 6)
      .stroke(borderColor, lineWidth: 1)
  )
```

This requires the IR to carry an `overlay` semantic flag or the realizer to have
a table of "which contracts need an explicit overlay for their border." In the spike,
this logic lives in `buildModifierChain` in the realizer.

**Verdict:** Target escape needed. The shared IR does not model this — the
SwiftUI realizer adds it from a per-contract recipe table.

### 3.2 CSS `outline` (focus ring)

**CSS:**
```css
outline: 2px solid var(--sc-field-control-focus-ring, var(--palette-border-focus));
outline-offset: 1px;
```

**SwiftUI:** No `outline` modifier exists. Focus rings are provided by the system
for accessibility (`.focusable()`, `.focused($isFocused)`). For custom focus
indicators, the pattern is an outer stroke overlay:

```swift
content
  .overlay(
    RoundedRectangle(cornerRadius: 6)
      .stroke(Color.accentColor, lineWidth: 2)
      .padding(-2)
  )
```

Note that SwiftUI also provides `FocusState` and system focus styling, which may be
preferable to custom rings in most cases. The shared IR cannot know whether the
target platform provides system focus rings — this is a platform capability flag.

**Verdict:** Target escape needed. The CSS realizer emits an `outline` rule;
the SwiftUI realizer emits either nothing (relying on system focus) or an overlay
stroke, depending on a realizer-level policy flag.

### 3.3 CSS `box-shadow` / `elevation`

**CSS:**
```css
box-shadow: var(--sc-floating-panel-shadow, var(--elevation-panel));
```

**SwiftUI:**
```swift
.shadow(color: Color.black.opacity(0.12), radius: 8, x: 0, y: 4)
```

The CSS `box-shadow` syntax (x-offset, y-offset, blur, spread, color) maps to
Swift `.shadow(color:radius:x:y:)` with some loss of fidelity — SwiftUI does not
support `spread`. The semantic elevation role (`elevation-panel`) maps well;
the exact parameter values require a realizer-side lookup table.

**Verdict:** Partial escape. Semantic elevation levels (`panel`, `overlay`, etc.)
map cleanly. Exact shadow parameters must be resolved in the SwiftUI realizer's
own table, not in the shared IR.

### 3.4 CSS multi-value border shorthand

**CSS:**
```css
border: 1px solid var(--sc-field-control-border, var(--palette-border));
```

**SwiftUI:** Borders are not a built-in `.border(…)` modifier for arbitrary shapes
(`.border(…)` only works on rectangular views with zero corner radius). The general
pattern requires an `.overlay(shape.stroke(…))`:

```swift
.overlay(
  RoundedRectangle(cornerRadius: 6)
    .stroke(Color(.separator), lineWidth: 1)
)
```

The border semantics (color, width, radius) are all present in the shared IR, but
the mechanism for applying them differs entirely between web and SwiftUI.

**Verdict:** Target escape needed. Same semantic information, different application
model.

### 3.5 CSS `cursor` and pointer interactions

**CSS:**
```css
cursor: not-allowed;
cursor: pointer;
```

**SwiftUI:** Cursor changes on macOS are possible via `.onHover(perform:)` +
`NSCursor`, but iOS/iPadOS have no cursor concept at all. The contract IR can
carry a `cursor-policy` semantic hint; the realizer ignores it on iOS.

**Verdict:** Target escape needed. This is a platform capability boundary, not
a mapping gap. The shared IR should model it as an optional hint.

### 3.6 Data-attribute selectors

**CSS:** The web runtime uses `data-contract="field-control"` and
`data-contract-state~="focus"` attributes applied to DOM elements.

**SwiftUI:** There is no attribute system. State is typed and passed directly to
the modifier. The contract identity is implicit in the modifier type used.

This is actually an improvement in SwiftUI: the contract binding is statically
verified at compile time rather than matched at runtime via string attributes.

**Verdict:** Not a mapping gap — SwiftUI's type system provides a stronger guarantee
than data attributes.

---

## 4. IR Sufficiency Assessment

| IR feature | Web CSS | SwiftUI | Notes |
|---|---|---|---|
| Contract identity | via attribute value | via struct type | Swift is stronger (static) |
| State vocabulary | via attribute whitelist | via enum cases | Swift is stronger (exhaustive) |
| Semantic color resources | via CSS variables | via Color(…) literals | Direct mapping |
| Spacing tokens | via CSS custom props | via CGFloat literals | Direct mapping |
| Shape/radius tokens | via CSS variables | via `cornerRadius:` param | Direct mapping |
| Elevation/shadow | via `box-shadow` | via `.shadow(…)` | Spread parameter lost |
| Focus ring | via `outline` | via overlay stroke or system | Target escape |
| Border as overlay | via `border` shorthand | via `.overlay(shape.stroke)` | Target escape |
| Pseudo-elements | `::before` / `::after` | via `overlay` builder | Target escape |
| Cursor policy | via `cursor` property | via `.onHover` (macOS only) | Platform capability flag |
| Variant vocabulary | via attribute value | via enum cases | Same |
| Disabled state | via `opacity` + `cursor` | via `.disabled()` + `.opacity()` | Direct mapping |

**Summary:**
- 8 of 12 IR features map directly or with mechanical translation
- 4 features require target-specific rendering logic in the SwiftUI realizer

---

## 5. Comparison with Web CSS Output

### What is the same

- The same `ContractSpec` input drives both generators
- The same state vocabulary (focus, invalid, disabled, hover, selected) is used in both
- The same semantic resource names are referenced (border.focus, status.error, etc.)
- The same contract identity (id string) is the organizing unit

### What is different

| Dimension | Web CSS | SwiftUI |
|---|---|---|
| State binding mechanism | DOM data-attributes, matched at runtime | Typed enum, resolved at compile time |
| Token application | CSS custom property cascade | Direct Swift value passed to modifier |
| Theme scoping | `[data-theme="X"] { --var: value }` | `@Environment(\.colorScheme)` + app-level token injection |
| Focus ring | `outline` property | System-provided or overlay stroke |
| Border | `border` shorthand | `.overlay(shape.stroke(…))` |
| Shadow | `box-shadow` shorthand | `.shadow(color:radius:x:y:)` |
| Variant application | `data-contract-variant` attribute | Separate modifier parameter or overloaded initializer |
| Dark mode | CSS media queries or `[data-theme]` toggle | Automatic via `Color(.systemBackground)` etc. |

### Architecture implication

The shared IR's separation of semantic resource names from target-native values
was validated by this spike. The contract IR successfully acts as a
**platform-neutral intermediate representation**:

- the semantics (what role, what states, what resources) are shared
- the mechanics (how those semantics become pixels) are target-specific

The realizer's per-contract recipe tables (`buildModifierChain`, `buildHelperProperties`)
are the correct location for target-specific logic. They are small (< 20 lines per
contract) and mechanical. A production SwiftUI realizer would likely generate
these from a declarative recipe spec rather than hand-authoring them.

---

## 6. Recommendations for Production SwiftUI Realizer

1. **Add platform capability flags to the IR** — `supportsOutline`, `supportsBoxShadow`,
   `supportsCursor`, `supportsPseudoElements`. The shared IR can carry these as
   `targetCapabilities` hints; each realizer declares which flags it supports.

2. **Add an elevation token table in the SwiftUI realizer** — map `elevation-panel`,
   `elevation-overlay`, `elevation-popover` to specific `shadow(color:radius:x:y:)`
   parameters per platform.

3. **Prefer system colors over hardcoded values** — `Color(.systemBackground)`,
   `Color(.label)`, etc. adapt to dark mode automatically without a separate theme
   token pass.

4. **Use `@Environment` for custom theme tokens** — inject a `DesignTokens` environment
   object at the app root that carries brand-specific overrides. This is the SwiftUI
   equivalent of CSS custom property scoping.

5. **Model focus policy explicitly** — add a `focusPolicy` field to the IR:
   `system` (use platform focus ring), `custom` (emit overlay stroke), `none`.
   This prevents the SwiftUI realizer from silently dropping focus ring output.

6. **Reuse the same `ContractSpec` interface** — the spike confirmed the existing
   web IR fields are sufficient as inputs. No new IR fields are needed for basic
   SwiftUI realization.

---

## 7. Conclusion

The feasibility spike confirms the core architectural claim of the PRD:

> The shared contract IR can drive both web CSS and SwiftUI output from identical
> contract descriptions.

The IR is sufficient for 8 of 12 mapping dimensions. The 4 target escapes are
well-bounded and can be addressed with platform capability flags and per-realizer
recipe tables — neither requires changes to the shared IR itself.

The SwiftUI output is clean, idiomatic Swift: typed enums for states, ViewModifiers
for styling, View extensions for call-site ergonomics. The result is more type-safe
than the CSS/data-attribute approach because state is verified at compile time.

This validates the PRD decision (§18) to target SwiftUI as the first non-web
realization spike ahead of WinUI.
