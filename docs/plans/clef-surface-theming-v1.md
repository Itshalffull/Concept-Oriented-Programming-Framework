# Clef Surface: Advanced Theming System
## Implementation Plan — `ui-theme` Kit v1.0

---

## 0. Synthesis and Justification

### 0.1 What the Research Converges On

Five research streams (state-of-art tokens, algorithmic theming, expressive interfaces,
missing-concepts taxonomy, design language evolution) converge on three architectural claims
that none quite states alone:

**Claim 1 — Themes are positions in a design space, not flat token maps.**
The 10-axis model from `missing-concepts` (surface treatment, edge treatment, color
philosophy, spatial philosophy, physical metaphor, animation philosophy, typographic
philosophy, ornament philosophy, emotional register, convention relationship) is the most
theoretically grounded framing. Current Surface covers maybe 3 axes (color, spacing,
shadow) at token-value depth. The rest are unaddressed.

**Claim 2 — Algorithmic derivation replaces manual specification.**
Material 3's HCT color system, Utopia's fluid type scales, Ant Design's composable
algorithms, and Adobe Leonardo's contrast-first derivation all demonstrate that the
primitive abstraction is *seeds + algorithms + constraints*, not hand-edited token values.
A theme should minimally specify a seed color and a design philosophy; the system derives
the rest.

**Claim 3 — Structural choices (navigation paradigm, action pattern, density mode)
belong in themes, bounded by a clear principle.**
CSS Zen Garden proved layout can be theme-driven. The boundary: a theme controls
*presentation of intent* ("navigation goes in a sidebar") not *content architecture*
("what items are in the navigation"). This maps cleanly to Clef — concepts declare
semantic intent; themes map intent to physical paradigm.

### 0.2 Collapses and Justifications

| Research Proposal | Disposition | Justification |
|---|---|---|
| `TokenPrimitive + TokenSemantic + TokenComponent` as separate concepts | **Collapsed into DesignToken tiers** | Same structure, no independent operational principle — tiers within one concept's state is correct Clef modeling |
| `SubAtomicToken` + `TypographicAxis` | **Merged into FontMetrics** | Both address per-font precision targeting with no independent state; one concept with richer actions is cleaner |
| `FluidType` as separate concept | **Merged into TypeScale** | Fluid interpolation IS TypeScale's computation mode — no separate state exists |
| `GenerativeStyleProfile` + `AssetFilterMatrix` | **Renamed: StyleProfile + ImageFilter** | Cleaner names; genuinely independent (ImageFilter applies to existing imagery regardless of generation) |
| `WidgetCategory` as concept | **Expressed as Density exemption rules** | Widget category is already captured by Affordance/Interactor; Density only needs an exempt-interactor-type list |
| `Derivation` as standalone concept | **Expressed as ColorSpace actions** | ColorSpace already owns the derivation algorithm; a separate Derivation concept duplicates its state |
| `MotionTiming` split from Motion | **Not split** | Duration and easing already exist in Motion; SpringPhysics is additive, not a replacement |

### 0.3 The Provider Pattern Applied Here

Several new concepts use the coordination + provider pattern, mirroring Deploy Suite and
Bind Suite exactly. Coordination concepts own state, routing logic, and the sync surface.
Provider concepts own rendering and platform-specific computation.

| Coordination Concept | Provider Family | Rationale |
|---|---|---|
| ColorSpace | OKLCH, HCT, P3, sRGB | Color algorithms are independent, swappable, platform-specific |
| MaterialSurface | CSS, SVG, WebGL | Flat shadows need CSS; noise/displacement need SVG; liquid glass needs WebGL |
| ImageFilter | CSS, SVG, AI, Shader, Canvas | Filter chains differ radically by rendering backend; AI path is one provider among equals |
| SpringPhysics | CSS, Framer, ReactSpring, Native | Spring config format is framework-specific |
| StructuralMotif | Sidebar, TopBar, BottomTab, Ribbon, CommandPalette, FAB | Each paradigm is a distinct structural implementation |
| StyleProfile | AI, RuleBased, Static, DesignTool | decode() and asset request dispatch varies by environment and capability |

### 0.4 Changes Required to Existing Surface Architecture

These are the only existing components that need modification. Everything else is additive.

| Existing Component | Change Required |
|---|---|
| `.theme` file format | 12 new optional blocks (fully backward-compatible; old parsers ignore unknown blocks) |
| ThemeParser | Parse 12 new blocks into ThemeAST extensions; add validation rules per block |
| ThemeGen | Gains generation passes for all new blocks across all existing output targets (CSS, Tailwind, React Native StyleSheet, terminal ANSI, DTCG JSON) |
| WidgetResolver | Accept `density` and `motif` as resolution context inputs alongside existing `platform`, `viewport`, `optionCount` |
| Affordance (widget spec block) | Add two optional fields: `density-exempt: bool`, `motif-optimized: ParadigmName` |
| Layout | Accept `StructuralMotif/resolve` output as configuration input via sync |
| CoifThemeScaffoldGen | Scaffold new blocks in generated `.theme` stubs |

### 0.5 Theme Interactions with Surface Presentation Concepts

**ThemeGen is the multi-platform story.** ThemeGen already produces CSS, Tailwind, React Native StyleSheet, terminal ANSI, and DTCG JSON from concept state. All new concept state introduced by this kit feeds into ThemeGen's existing output paths — no new platform adapter work is required. Where the new concepts produce abstract values (shadow config, spring params, fluid type sizes), ThemeGen translates those into whatever output format is active, exactly as it does for existing DesignToken values.

**DisplayMode** — the theme has a one-way relationship with DisplayMode. Density affects how dense the `view` and `edit` display modes render entity fields — a compact theme should produce compact field rows in both modes. This is handled by the existing `DensityAppliesMultiplier` sync, which writes density-aware spacing tokens that DisplayMode's rendered output picks up automatically. No new syncs needed. One gap: if a theme wants to suppress a display mode entirely (e.g. a kiosk theme that disables `edit` mode), there is currently no mechanism for that. This is out of scope for v1.0 but worth noting for a future DisplayMode concept update.

**View** — View rendering (table, board, calendar, gallery, list) picks up theme tokens naturally through existing token resolution. A board View's cards use `--elevation-*` tokens from MaterialSurface. A table View's row height uses `--density-multiplier` from Density. A gallery View's image treatment uses ImageFilter's CSS output. None of this requires new wiring — it flows through DesignToken the same way all other widget rendering does. The theme doesn't need to know about View; View doesn't need to know about the theme.

---

## 1. Concept Inventory

### Suite: `ui-theme-core`

Foundation of algorithmic derivation. These five concepts must be implemented first because
all visual philosophy concepts depend on color derivation and constraint satisfaction
being correct.

| Concept | Purpose | Key Actions |
|---|---|---|
| **ColorSpace** | Algorithmic color derivation engine. Generates perceptually uniform palettes from seed colors using pluggable algorithms (OKLCH, HCT). Distinct from Palette (which holds derived values) — ColorSpace is the derivation *engine* that guarantees contrast ratios mathematically through perceptual uniformity. | `register`, `deriveFromSeed`, `computeContrast`, `harmonize`, `routeToProvider` |
| **ColorScheme** | Maps abstract color roles to tonal palette values per display mode (light / dark / high-contrast / forced-colors). Owns the mode → token resolution layer. A single scheme holds all modes simultaneously and activates one on demand. | `register`, `activate`, `resolve`, `listModes` |
| **Constraint** | Accessibility requirements as first-class participants in token resolution. Constraints validate tokens *at registration time* and compute compliant override values when violations occur. This replaces post-hoc auditing. Covers contrast ratios, touch target sizes, reduced-motion mandates, focus visibility. | `define`, `validate`, `computeCompliantValue`, `listViolations` |
| **Preference** | Negotiates between four competing authorities in a defined priority order: (1) accessibility overrides, (2) user explicit preferences, (3) OS/system settings, (4) brand defaults. Emits a single resolved configuration that other concepts consume via syncs. | `update`, `resolve`, `negotiate`, `getPriority` |
| **Scope** | Theme scope boundaries. Manages global (`:root`), zone-based (named regions), and component-level token resolution. Implements IBM Carbon's contextual layering: the same token path returns different values at different nesting depths, enabling components to adapt their appearance per depth level without custom overrides. Generates CSS `@scope` blocks. | `define`, `enter`, `exit`, `resolve`, `getDepth` |

### Suite: `ui-theme-visual`

Visual philosophy tokens — the design space axes encoded as concepts.

| Concept | Purpose | Key Actions |
|---|---|---|
| **TypeScale** | Modular type scale generator. Eliminates hardcoded breakpoint sizes by defining scale ratios at minimum and maximum viewport widths and deriving all heading levels as fluid `clamp()` values via the Utopia interpolation model. Derives the spacing scale from the type base unit. | `configure`, `computeStep`, `generateFluidClamp`, `deriveSpacer` |
| **FontMetrics** | Per-font precision: OpenType feature sets per context (body prose → old-style numerals + ligatures; data → tabular numerals; code → slashed zero), variable font axis values, optical sizing, baseline alignment (Capsize-style), drop cap configuration, smallcaps detection rules (regex-based: 3+ consecutive caps triggers `font-variant-caps: small-caps`), pseudo-element targeting (`::first-letter`, `::first-line`). | `configure`, `resolveFeatures`, `getBaselineOffset`, `getDropCapConfig`, `resolveVariableAxes` |
| **Shape** | Edge and corner philosophy as a first-class theme dimension. Encodes the geometric character of the interface: sharp/angular (brutalist), uniformly rounded (Material 4dp), pill (contemporary flat), organic blob (asymmetric `border-radius`), squircle/superellipse (continuous curvature, Apple-style), or beveled. Resolves to concrete CSS values per element type. | `configure`, `resolve`, `computeRadius`, `computeClipPath` |
| **Iconography** | Icon style and variable font axes as theme-level choices. Style variant (outlined / filled / duotone / thin / bold), weight/grade/optical-size/fill/roundness axes, color inheritance mode, and automatic grade compensation for dark surfaces (grade −25 prevents visual bleed on dark backgrounds). Ensures icon weight harmonizes with the active typography weight. | `configure`, `resolveAxes`, `getGradeForSurface`, `getStyleVariant` |
| **Density** | Cross-cutting compact / comfortable / spacious transformation. Applies a calibrated multiplier to spacing and component padding. NOT applied uniformly: an exemption list of interactor types (date pickers, dialogs, data visualizations, overlays) is always held at comfortable. This reflects the empirical finding that density reduction in these categories degrades usability. | `set`, `get`, `getMultiplier`, `isExempt`, `listExemptions` |
| **MaterialSurface** | Surface depth philosophy and physics parameters. Encodes whether surfaces are flat, elevated paper, frosted glass (glassmorphism), soft clay (neumorphism), or liquid glass/3D. Procedurally computes CSS shadow, backdrop-filter, and gradient values from physics tokens rather than hardcoding hex shadow values. Provider-routed: CSS covers most cases; WebGL handles liquid glass; SVG handles noise overlays and displacement. | `configure`, `computeShadow`, `computeBackdrop`, `computeGradient`, `routeToProvider` |
| **StyleProfile** | High-level aesthetic philosophy encoding all 10 design-space axes simultaneously. Acts as a master dial that pre-configures MaterialSurface, Shape, Density, SpringPhysics, FontMetrics, and Iconography with internally consistent values. Carries an AI-readable style prompt as state. decode() and requestAsset() route to registered providers — AI, rule-based, static, or design tool — rather than calling any external service directly. | `configure`, `encode`, `decode`, `applyToTheme`, `requestAsset`, `routeToProvider` |

### Suite: `ui-theme-motion`

| Concept | Purpose | Key Actions |
|---|---|---|
| **SpringPhysics** | Spring-based animation parameters as named presets (tension / friction / mass). The state of the art has moved beyond duration+easing curves to physics parameters that produce more natural motion. Named presets compose: a "snappy" spring enter can combine with a "gentle" exit. `prefers-reduced-motion` collapses all springs to a simple opacity-only fade. Provider-routed to CSS `linear()` approximation, Framer Motion, React Spring, or native runtimes. | `register`, `resolve`, `computeValue`, `getReducedMotionFallback`, `routeToProvider` |
| **MotionChoreography** | Orchestration of motion sequences across multiple elements. Manages stagger delay patterns for list animations, entrance/exit ordering, scroll-driven animation parameter sets (timeline type, animation range, view inset thresholds), and parallax speed ratios per layer. Operates on named sequences rather than individual elements. | `register`, `resolve`, `computeDelay`, `getScrollParams`, `listSequences` |

### Suite: `ui-theme-structural`

| Concept | Purpose | Key Actions |
|---|---|---|
| **StructuralMotif** | Maps abstract semantic intent tokens to concrete layout paradigms per breakpoint and per scope. Multiple intents are independent and simultaneously active — a page can have a sidebar for navigation, a FAB for primary-action, and a ribbon for utility-bar all at once. Scope-aware: different zones carry independent motif configurations that inherit from their parent scope, exactly as color tokens do. Paradigm names are open strings — any value is valid as long as a provider is registered for it. | `registerProvider`, `configure`, `resolve`, `getParadigm`, `listIntents`, `listParadigms`, `routeToProvider` |

### Suite: `ui-theme-asset`

| Concept | Purpose | Key Actions |
|---|---|---|
| **ImageFilter** | Image treatment as a theme-level choice. Encodes CSS filter chains (grayscale, sepia, hue-rotate, contrast), duotone color pairs (SVG feColorMatrix), blend modes, SVG displacement map parameters, and AI generation prompt formulas as state. A theme with a neumorphic philosophy should not have unfiltered high-saturation photography — the filter system enforces visual coherence. apply() routes to the appropriate provider; the AI path is one provider among equals, not special-cased. | `register`, `apply`, `computeDuotone`, `routeToProvider` |

---

## 2. Provider Concepts (Optional — registered at deployment)

Providers handle cases where the *computation or dispatch* varies by platform, framework, or service. They are not needed for cases where ThemeGen already handles multi-platform output directly: ThemeGen already produces CSS, Tailwind, React Native StyleSheet, terminal ANSI, and DTCG JSON from concept state. For those outputs, ThemeGen reading concept state directly is simpler and correct — no provider layer needed.

Providers earn their keep where the algorithm itself is the variation (color space math, spring physics format, filter rendering backend) or where dispatch to an external service is required (AI generation, design tool APIs).

### ColorSpace Providers
- `ColorSpaceOKLCH` — OKLCH via culori (TypeScript) or equivalent per-platform library; preferred default
- `ColorSpaceHCT` — HCT (Material You); superior dark-mode palette generation via tone-axis guarantee
- `ColorSpaceP3` — Display P3 wide gamut for modern screens
- `ColorSpaceSRGB` — Legacy sRGB fallback

### MaterialSurface Providers
- `MaterialSurfaceSVG` — SVG filter chains: `feDisplacementMap`, `feColorMatrix`, `feTurbulence` for noise/texture; for cases ThemeGen's CSS output cannot handle
- `MaterialSurfaceWebGL` — WebGL shader programs for liquid glass and 3D surface effects

### ImageFilter Providers
- `ImageFilterSVG` — SVG `feColorMatrix` duotone + displacement maps
- `ImageFilterAI` — thin wrapper: assembles the prompt formula from preset state and fires `LLMCompletion/complete` or `ImageGeneration/request`; the LLM suite handles the actual call, retry logic, and token management
- `ImageFilterShader` — GLSL shader for filter effects; for game UIs or canvas-rendered surfaces
- `ImageFilterCanvas` — applies filter to an image via OffscreenCanvas at build time, returning a processed image URL

### StyleProfile Providers
- `StyleProfileRuleBasedProvider` — keyword matching for `decode`; no network call; deterministic; default in offline deployments
- `StyleProfileAIProvider` — thin wrapper: assembles a structured prompt, fires `LLMCompletion/complete`; return sync `StyleProfileAIDecodesFromCompletion` calls `StyleProfile/configure` with interpreted axes
- `StyleProfileStaticProvider` — returns a hardcoded axis set; useful for testing or locked-down deployments
- `StyleProfileDesignToolProvider` — imports axis values from Figma, Tokens Studio, etc.; decode becomes "read an existing design system as a StyleProfile"

### SpringPhysics Providers
- `SpringPhysicsFramerMotion` — Framer Motion spring config object; for apps using Framer as their animation layer
- `SpringPhysicsReactSpring` — React Spring `useSpring` config
- `SpringPhysicsNative` — iOS `UISpringTimingParameters` / Android `SpringAnimation`; for cases where ThemeGen's RN StyleSheet output is insufficient

### StructuralMotif Providers

All motif providers derive from `StructuralMotifProvider` (base concept defined in section 5). The base contract requires `render(intent, paradigm, params, scope) -> ok(layoutConfig, cssTokens)` and `listParadigms()`. ThemeGen handles the web CSS output (`--motif-*` custom properties) directly from concept state; motif providers handle cases that require component mounting or platform-specific navigation APIs beyond what CSS hints can express.

- `RepertoireMotifProvider` — translates built-in paradigm names to `Layout/configure` calls using Repertoire's Layout primitives. Covers: PersistentSidebar, CollapsibleSidebar, TopBar, BottomTabBar, FloatingActionButton, inline, PopoverMenu, DenseDataTable, ComfortableListView, CardGrid. Works across any platform Surface supports, since Layout is already platform-adapted. This is the default that makes all built-in paradigms work without additional installation.
- `RibbonProvider` — RibbonToolbar paradigm; requires specialized component mounting beyond what Layout/configure expresses natively
- `CommandPaletteProvider` — CommandPalette paradigm; overlay + keyboard capture outside the standard layout model
- Third-party providers register any new paradigm name and become available immediately to any theme that references that name

---

## 3. Derived Concepts

### `ExpressionTheme`

The root derivation that composes all new suites into a unified theme resolution pipeline.

```
derived ExpressionTheme {
  purpose {
    A fully expressive theme that encodes both visual token values and design
    philosophy. Composes all new theming concepts into a single resolution surface
    with a coherent operational principle: every visual decision is either derived
    algorithmically from seeds or declared as a philosophy axis, never hand-specified.
  }

  composes {
    ColorSpace
    ColorScheme
    Constraint
    Preference
    Scope
    TypeScale
    FontMetrics
    Shape
    Iconography
    Density
    MaterialSurface
    StyleProfile
    SpringPhysics
    MotionChoreography
    StructuralMotif
    ImageFilter
    // Existing concepts already in Surface:
    DesignToken
    Layout
    Motion
  }

  syncs {
    required: [
      SeedColorDerivesPalette,
      SchemeActivatesTokens,
      ConstraintValidatesToken,
      ConstraintOverridesOnViolation,
      PreferenceNegotiatesTheme,
      PreferenceSetsDensity,
      PreferenceSetsReducedMotion,
      DensityAppliesMultiplier,
      DensityContextUpdatesWidgetResolver,
      StructuralMotifResolvesLayout,
      MotifContextUpdatesWidgetResolver,
      TypeScaleGeneratesTypographyTokens,
      FontMetricsActivatesOpenType,
      ShapeResolvesRadius,
      IconographyConfiguresAxes,
      MaterialSurfaceComputesShadow,
      MaterialSurfaceComputesBackdrop,
      StyleProfileConfiguresAll,
      StyleProfileConfiguresDensity,
      StyleProfileConfiguresMotion,
      SpringPhysicsResolvesMotionToken,
      ChoreographyOrchestrates,
      ScopeResolvesTokenBoundary,
      ImageFilterAppliesStyle
    ]
  }

  surface action applyTheme(themeId: ThemeId) {
    matches: ColorScheme/activate(themeId: themeId)
  }

  surface action setDensity(mode: DensityMode) {
    matches: Density/set(mode: mode)
  }

  surface action setMotif(intent: String, paradigm: String) {
    matches: StructuralMotif/configure(intent: intent, paradigm: paradigm)
  }

  surface query resolveToken(path: String, scope: String)
    -> DesignToken/resolve(path: path, scope: scope)

  surface query getDesignSpace()
    -> StyleProfile/encode()

  principle {
    after applyTheme(themeId: t)
    then resolveToken(path: "color.primary", scope: "global")
      returns a value derived from the active scheme for t
    and all tokens have been validated by Constraint before registration completes
    and the active StructuralMotif mappings have been propagated to Layout
  }
}
```

### `ThemeKit` (Derived of Derived)

Connects ExpressionTheme to the Surface generation pipeline.

```
derived ThemeKit {
  purpose {
    Connects the expression theme system to the Surface generation pipeline.
    Handles parsing, validation, generation, and runtime switching.
    ThemeKit is what a Clef project installs; ExpressionTheme is the runtime core.
  }

  composes {
    derived ExpressionTheme
    ThemeParser
    ThemeGen
    WidgetResolver
  }

  syncs {
    required: [
      ParsedColorSpaceRegistered,
      ParsedColorSchemeRegistered,
      ParsedDensityRegistered,
      ParsedShapeRegistered,
      ParsedIconographyRegistered,
      ParsedMaterialSurfaceRegistered,
      ParsedTypeScaleRegistered,
      ParsedFontMetricsRegistered,
      ParsedSpringPhysicsRegistered,
      ParsedMotionChoreographyRegistered,
      ParsedStructuralMotifRegistered,
      ParsedStyleProfileRegistered,
      ParsedImageFilterRegistered,
      ParsedScopeRegistered,
      ParsedConstraintRegistered,
      ParsedPreferenceRegistered,
      DensityContextUpdatesWidgetResolver,
      MotifContextUpdatesWidgetResolver
    ]
  }
}
```

---

## 4. Complete Sync Inventory

### 4.1 Resolution Pipeline Syncs (runtime)

These 24 syncs wire the resolution pipeline at runtime.

**Color derivation and activation:**

| Sync | Trigger | Target |
|---|---|---|
| `SeedColorDerivesPalette` | `ColorSpace/deriveFromSeed` → ok | `DesignToken/register` with all derived color steps as primitive tokens |
| `SchemeActivatesTokens` | `ColorScheme/activate` → ok | `DesignToken/setMode` with the full role→value token map |
| `ConstraintValidatesToken` | `DesignToken/register` (semantic tier) → ok | `Constraint/validate` for each constraint rule whose path pattern matches |
| `ConstraintOverridesOnViolation` | `Constraint/validate` → violation | `DesignToken/override` with the computed compliant value |

**Preference negotiation:**

| Sync | Trigger | Target |
|---|---|---|
| `PreferenceNegotiatesTheme` | `Preference/update` → ok (resolved) | `ColorScheme/activate` with the negotiated theme and mode |
| `PreferenceSetsDensity` | `Preference/update` key="density" → ok | `Density/set` with the negotiated density mode |
| `PreferenceSetsReducedMotion` | `Preference/update` key="prefers-reduced-motion", value="reduce" → ok | `SpringPhysics/resolve` with the `__reduced-motion` preset |

**Visual philosophy propagation:**

| Sync | Trigger | Target |
|---|---|---|
| `DensityAppliesMultiplier` | `Density/set` → ok | `DesignToken/applyMultiplier` to all spacing.* and typography.*.size paths, skipping exempt interactor types |
| `DensityContextUpdatesWidgetResolver` | `Density/set` → ok | `WidgetResolver/updateContext` with the new density mode |
| `TypeScaleGeneratesTypographyTokens` | `TypeScale/configure` → ok | `DesignToken/register` all computed fluid `clamp()` steps as primitive type-scale tokens |
| `FontMetricsActivatesOpenType` | `FontMetrics/resolveFeatures` → ok | `DesignToken/register` font-features and font-variation tokens per context |
| `ShapeResolvesRadius` | `Shape/resolve` per element → ok | `DesignToken/register` the CSS border-radius or clip-path value as a component token |
| `IconographyConfiguresAxes` | `Iconography/resolveAxes` → ok | `DesignToken/register` the icon variable-font axes as semantic tokens |
| `MaterialSurfaceComputesShadow` | `MaterialSurface/computeShadow` per level → ok | `DesignToken/register` the computed shadow CSS as a semantic elevation token |
| `MaterialSurfaceComputesBackdrop` | `MaterialSurface/computeBackdrop` → ok | `DesignToken/register` the backdrop-filter value as a component token |

**Style profile cascade:**

| Sync | Trigger | Target |
|---|---|---|
| `StyleProfileConfiguresAll` | `StyleProfile/configure` → ok | `MaterialSurface/configure` with derived philosophy and physics params |
| `StyleProfileConfiguresDensity` | `StyleProfile/configure` → ok | `Density/set` with the derived density mode for this aesthetic |
| `StyleProfileConfiguresMotion` | `StyleProfile/configure` → ok | `SpringPhysics/register` default presets calibrated to the animation philosophy |

**Motion:**

| Sync | Trigger | Target |
|---|---|---|
| `SpringPhysicsResolvesMotionToken` | `SpringPhysics/resolve` → ok | `DesignToken/register` the CSS `linear()` value and duration as a semantic motion token |
| `ChoreographyOrchestrates` | `MotionChoreography/resolve` → ok | `DesignToken/register` the computed stagger delays as component motion tokens |

**Structure and scope:**

| Sync | Trigger | Target |
|---|---|---|
| `StructuralMotifResolvesLayout` | `StructuralMotif/resolve` → ok | `Layout/configure` with the resolved paradigm's layoutConfig for this zone/viewport/scope |
| `MotifContextUpdatesWidgetResolver` | `StructuralMotif/resolve` → ok | `WidgetResolver/updateContext` with the active paradigm name and current scope |
| `ScopeResolvesTokenBoundary` | `Scope/enter` → ok | `DesignToken/setScope` with the zone's token overrides and nesting depth |
| `ImageFilterAppliesStyle` | `StyleProfile/encode` → ok | `ImageFilter/apply` with the profile's filter preset and AI prompt |
| `StyleProfileAIDecodesFromCompletion` | `LLMCompletion/complete` → ok (tagged: style-profile-decode) | `StyleProfile/configure` with axis values parsed from the completion result |
| `ImageFilterAIGeneratesFromCompletion` | `LLMCompletion/complete` → ok (tagged: image-filter-generate) | `ImageFilter/register` updated preset with the generated asset reference |

### 4.2 Generation Pipeline Syncs (build-time)

These 16 syncs wire ThemeParser parse completions to concept registration actions.
One sync per new theme block.

| Sync | Trigger | Target |
|---|---|---|
| `ParsedColorSpaceRegistered` | `ThemeParser/parse` block="color-space" → ok | `ColorSpace/register` |
| `ParsedColorSchemeRegistered` | `ThemeParser/parse` block="color-scheme" → ok | `ColorScheme/register` |
| `ParsedDensityRegistered` | `ThemeParser/parse` block="density" → ok | `Density/set` |
| `ParsedShapeRegistered` | `ThemeParser/parse` block="shape" → ok | `Shape/configure` |
| `ParsedIconographyRegistered` | `ThemeParser/parse` block="iconography" → ok | `Iconography/configure` |
| `ParsedMaterialSurfaceRegistered` | `ThemeParser/parse` block="material" → ok | `MaterialSurface/configure` |
| `ParsedTypeScaleRegistered` | `ThemeParser/parse` block="type-scale" → ok | `TypeScale/configure` |
| `ParsedFontMetricsRegistered` | `ThemeParser/parse` block="font-metrics" → ok | `FontMetrics/configure` |
| `ParsedSpringPhysicsRegistered` | `ThemeParser/parse` block="spring-physics" → ok | `SpringPhysics/register` all presets |
| `ParsedMotionChoreographyRegistered` | `ThemeParser/parse` block="motion-choreography" → ok | `MotionChoreography/register` all sequences |
| `ParsedStructuralMotifRegistered` | `ThemeParser/parse` block="structural-motif" → ok | `StructuralMotif/configure` all intent mappings |
| `ParsedStyleProfileRegistered` | `ThemeParser/parse` block="style-profile" → ok | `StyleProfile/configure` |
| `ParsedImageFilterRegistered` | `ThemeParser/parse` block="image-filter" → ok | `ImageFilter/register` all presets |
| `ParsedScopeRegistered` | `ThemeParser/parse` block="scope" → ok | `Scope/define` all zones |
| `ParsedConstraintRegistered` | `ThemeParser/parse` block="constraint" → ok | `Constraint/define` all rules |
| `ParsedPreferenceRegistered` | `ThemeParser/parse` block="preference" → ok | `Preference/update` with priorities and defaults |

**Total syncs: 42** (26 runtime + 16 build-time)

---

## 5. Concept Specifications (`.concept` files)

---

### ColorSpace

```
@version(1)
concept ColorSpace {

  purpose {
    Algorithmic color derivation engine. Generates perceptually uniform color
    palettes from seed colors using pluggable color space algorithms (OKLCH, HCT, P3).
    Distinct from Palette (which holds derived values) — ColorSpace is the derivation
    engine. Guarantees WCAG contrast ratios mathematically: in OKLCH the L-channel maps
    directly to perceived luminance, so a tone difference of >= 40 guarantees 3:1 contrast
    and >= 50 guarantees 4.5:1. This makes contrast failures a derivation error, not an
    audit finding.
  }

  capabilities {
    requires persistent-storage
  }

  state {
    algorithms: set AlgorithmId
    algorithm_name:     AlgorithmId -> String
    algorithm_provider: AlgorithmId -> String
    algorithm_gamut:    AlgorithmId -> String   // "srgb" | "display-p3" | "rec2020"

    seeds: set SeedId
    seed_name:      SeedId -> String
    seed_value:     SeedId -> String           // raw color string (any CSS color)
    seed_algorithm: SeedId -> AlgorithmId

    derivations: set DerivationId
    derivation_seed:   DerivationId -> SeedId
    derivation_steps:  DerivationId -> Int
    derivation_result: DerivationId -> list String   // ordered tonal steps, dark->light

    harmonizations: set HarmonizationId
    harmonization_source: HarmonizationId -> String   // color to shift
    harmonization_target: HarmonizationId -> SeedId   // reference seed
    harmonization_result: HarmonizationId -> String
  }

  actions {
    action register(algorithm: String, gamut: String, provider: String) {
      -> ok(algorithmId: AlgorithmId) {
        Records the algorithm name, gamut, and provider concept name for routing.
      }
      -> error(message: String) {
        Algorithm name already registered, or gamut is unknown.
      }
    }

    action deriveFromSeed(name: String, color: String, algorithmId: AlgorithmId, steps: Int) {
      -> ok(seedId: SeedId, derivationId: DerivationId, palette: list String) {
        Converts the color into the target gamut, then generates `steps` tonal values
        with perceptually uniform spacing. The palette is ordered darkest to lightest.
        For OKLCH: L-channel steps from 0 to 1 with chroma peaking at midpoint.
        For HCT: tone steps from 0 to 100. Routes computation to the registered provider.
      }
      -> error(message: String) {
        Algorithm not found, color unparseable, or provider unavailable.
      }
    }

    action computeContrast(colorA: String, colorB: String, algorithmId: AlgorithmId) {
      -> ok(ratio: Float, wcagAA: Bool, wcagAAA: Bool) {
        Computes WCAG relative luminance contrast between two colors.
        Formula: (lighter + 0.05) / (darker + 0.05).
        wcagAA passes at >= 4.5 (normal text) or >= 3.0 (large text).
        wcagAAA passes at >= 7.0.
      }
      -> error(message: String) {
        Algorithm not found or colors unparseable.
      }
    }

    action harmonize(sourceColor: String, targetSeedId: SeedId, algorithmId: AlgorithmId) {
      -> ok(harmonizationId: HarmonizationId, result: String) {
        Subtly shifts sourceColor's hue 15% toward the target seed's hue while
        preserving chroma and tone. Used so semantic colors (error red, warning amber)
        blend with a dynamic brand palette without losing their meaning.
      }
      -> error(message: String) { Seed or algorithm not found. }
    }

    action routeToProvider(algorithmId: AlgorithmId, operation: String, payload: String) {
      -> ok(result: String) { Dispatches to the registered provider for this algorithm. }
      -> notfound(message: String) { No provider registered for algorithmId. }
    }
  }

  invariant {
    after deriveFromSeed(name: n, color: c, algorithmId: a, steps: 13) -> ok(palette: p)
    then p has 13 entries
    and computeContrast(p[0], p[6], a) -> ok(ratio: r) where r >= 4.5
  }
}
```

---

### ColorScheme

```
@version(1)
concept ColorScheme {

  purpose {
    Maps abstract color roles to tonal palette values per display mode.
    Owns the mode -> token resolution layer. A single scheme contains light,
    dark, high-contrast, and forced-colors mappings, each activated on demand.
    Responds to Preference/resolve signals for automatic mode switching.
    Color roles: primary, on-primary, primary-container, on-primary-container,
    secondary, tertiary, error, surface, surface-variant, on-surface,
    on-surface-variant, outline, shadow, scrim, inverse-surface.
  }

  capabilities {
    requires persistent-storage
  }

  state {
    schemes: set SchemeId
    scheme_name:  SchemeId -> String
    scheme_modes: SchemeId -> set String  // "light" | "dark" | "high-contrast" | "forced"

    active_scheme: option SchemeId
    active_mode:   option String

    role_values: SchemeId -> String -> String -> String
    // scheme -> mode -> role -> CSS color value

    overrides: SchemeId -> String -> String -> option String
    // scheme -> mode -> role -> override (none = use derived value)
  }

  actions {
    action register(name: String, modes: list String, roleMappings: String) {
      -> ok(schemeId: SchemeId) {
        Records the scheme. roleMappings is JSON: {mode: {role: cssColor}}.
        Each color value may be a literal CSS color or a reference to a
        ColorSpace derivation step (resolved by the caller before registration).
      }
      -> error(message: String) { Duplicate name or invalid mode. }
    }

    action activate(themeId: String, mode: String) {
      -> ok(tokenMap: String) {
        Sets the active scheme and mode. Returns JSON token map of all role->value
        pairs for the selected mode. Triggers SchemeActivatesTokens sync.
      }
      -> notfound(message: String) { Scheme or mode not found. }
    }

    action resolve(role: String, schemeId: option SchemeId, mode: option String) {
      -> ok(value: String) {
        Resolves a single role to its color value. Checks overrides first,
        then falls back to the derived role mapping.
      }
      -> notfound(message: String) { Role not defined in scheme. }
    }

    action listModes(schemeId: SchemeId) {
      -> ok(modes: list String) { All available modes for this scheme. }
      -> notfound(message: String) { Scheme not found. }
    }
  }

  invariant {
    after activate(themeId: t, mode: "dark") -> ok(_)
    then active_mode = "dark"
    and resolve(role: "surface", schemeId: none, mode: none) -> ok(_)
  }
}
```

---

### Constraint

```
@version(1)
concept Constraint {

  purpose {
    Accessibility requirements as first-class participants in token resolution.
    Rather than auditing a finished token set, Constraint participates in
    derivation: when a semantic color token is registered, Constraint validates
    it immediately and computes a compliant override if it fails. This makes
    accessibility failures structurally impossible at the theme level.
    Also validates touch target sizes, focus visibility, and motion safety.
  }

  capabilities {
    requires persistent-storage
  }

  state {
    rules: set RuleId
    rule_name:     RuleId -> String
    rule_type:     RuleId -> String       // "contrast" | "touch-target" | "motion" | "focus"
    rule_paths:    RuleId -> list String  // token path patterns this rule applies to
    rule_params:   RuleId -> String       // JSON: {minRatio: 4.5} or {minSize: 44}
    rule_severity: RuleId -> String       // "error" | "warning"

    violations: set ViolationId
    violation_token:     ViolationId -> String
    violation_rule:      ViolationId -> RuleId
    violation_actual:    ViolationId -> String
    violation_required:  ViolationId -> String
    violation_override:  ViolationId -> option String
  }

  actions {
    action define(name: String, type: String, paths: list String, params: String, severity: String) {
      -> ok(ruleId: RuleId) {
        Records a constraint rule. Params for contrast: {minRatio: 4.5, background: "surface"}.
        Paths use glob patterns: "color.on-*" matches all on-* color roles.
      }
      -> error(message: String) { Invalid type or params. }
    }

    action validate(tokenId: String, value: String, ruleId: RuleId) {
      -> ok(passes: Bool) { Token passes; no action needed. }
      -> violation(actual: String, required: String, compliantValue: String) {
        Token fails. compliantValue is the nearest passing value, computed by
        adjusting the L-channel in OKLCH until the contrast requirement is met.
        Records a violation entry.
      }
    }

    action computeCompliantValue(value: String, ruleId: RuleId, background: option String) {
      -> ok(compliantValue: String) {
        Computes the nearest color (or dimension) satisfying the constraint.
        For contrast: binary-searches the L-channel until (lighter+0.05)/(darker+0.05) >= minRatio.
        For touch-target: rounds up to minSize px.
      }
      -> error(message: String) { Cannot derive compliant value for this type. }
    }

    action listViolations() {
      -> ok(violations: list String) { All recorded violations as JSON. }
    }
  }
}
```

---

### Preference

```
@version(1)
concept Preference {

  purpose {
    Negotiates between four competing authorities in a defined priority order:
    (1) accessibility overrides (forced-colors, prefers-contrast: more),
    (2) user explicit preferences (in-app dark mode toggle),
    (3) OS/system settings (prefers-color-scheme, prefers-reduced-motion),
    (4) brand/default theme.
    Emits a single resolved configuration consumed by ColorScheme, Density,
    and SpringPhysics via syncs.
  }

  capabilities {
    requires persistent-storage
  }

  state {
    priorities: list String
    // ordered: ["accessibility-override", "user-explicit", "system-os", "brand-default"]

    values:   String -> String   // preference key -> raw value per source tier
    sources:  String -> String   // preference key -> which source tier set it
    resolved: String -> String   // preference key -> resolved value after negotiation
    // tracked keys: "color-scheme", "contrast", "reduced-motion",
    //               "forced-colors", "density", "font-size-multiplier"
  }

  actions {
    action update(key: String, value: String, source: String) {
      -> ok(resolved: String) {
        Records the preference from the given source tier. Re-runs full negotiation
        across all keys. Higher-priority sources override lower-priority ones.
        Returns the full resolved configuration as JSON.
      }
      -> error(message: String) { Unknown key or invalid source tier. }
    }

    action resolve(key: String) {
      -> ok(value: String, source: String) {
        Returns the currently resolved value and which source tier won.
      }
      -> notfound(message: String) { Key not tracked. }
    }

    action negotiate() {
      -> ok(resolved: String) {
        Re-evaluates all preferences across all source tiers. Called automatically
        on every update. Returns full resolved JSON configuration.
      }
    }

    action getPriority(key: String) {
      -> ok(winningSource: String, allSources: String) {
        Returns which source is winning for this key and all competing source
        values. Used by preference UI to show why a setting is locked.
      }
    }
  }

  invariant {
    after update(key: "color-scheme", value: "forced-colors", source: "accessibility-override") -> ok(_)
    then resolve(key: "color-scheme") -> ok(value: "forced-colors", source: "accessibility-override")
    // Accessibility overrides always win regardless of other sources.
  }
}
```

---

### Scope

```
@version(1)
concept Scope {

  purpose {
    Theme scope boundaries. Manages global (:root), zone-based (named regions),
    and component-level token resolution. Implements IBM Carbon's contextual layering:
    the same token path returns different values at different nesting depths,
    so a reusable component adapts its appearance based on where it is rendered.
    Generates CSS @scope blocks for native DOM-subtree scoping.
  }

  capabilities {
    requires persistent-storage
  }

  state {
    zones: set ZoneId
    zone_name:      ZoneId -> String
    zone_depth:     ZoneId -> Int
    zone_token_set: ZoneId -> String   // JSON: {tokenPath: cssValue}
    zone_selector:  ZoneId -> String   // CSS selector for @scope generation

    active_zones: list ZoneId         // current nesting stack (innermost last)

    layer_tokens: Int -> String -> String
    // depth -> token path -> value  (Carbon-style contextual layering)
  }

  actions {
    action define(name: String, tokenSet: String, selector: String) {
      -> ok(zoneId: ZoneId) { Registers a named scope zone. }
      -> error(message: String) { Duplicate name. }
    }

    action enter(zoneId: ZoneId) {
      -> ok(depth: Int, tokenSet: String) {
        Pushes zone onto nesting stack. Depth increments. Returns merged token set
        for this depth, deep-merged with all parent zones.
      }
      -> notfound(message: String) { Zone not found. }
    }

    action exit(zoneId: ZoneId) {
      -> ok(depth: Int) { Pops zone from nesting stack. }
    }

    action resolve(path: String, scope: option String) {
      -> ok(value: String, depth: Int, source: String) {
        Resolves a token path. If scope specified, looks up in that zone.
        Otherwise uses innermost active zone. Falls back to global if no
        zone defines the path.
      }
      -> notfound(message: String) { Token not found in any scope. }
    }

    action getDepth() {
      -> ok(depth: Int) { Current nesting depth. }
    }
  }
}
```

---

### TypeScale

```
@version(1)
concept TypeScale {

  purpose {
    Modular type scale generator. Eliminates hardcoded breakpoint sizes by defining
    two scale ratios at two viewport extremes and interpolating all type steps via
    CSS clamp(). Based on the Utopia fluid design model. The math: for each step N,
    minSize = base * minRatio^N at minViewport, maxSize = base * maxRatio^N at
    maxViewport, and clamp() linearly interpolates between them. Also derives the
    spacing scale from the type base unit using T-shirt multipliers.
  }

  capabilities {
    requires persistent-storage
  }

  state {
    scales: set ScaleId
    scale_name:         ScaleId -> String
    scale_min_viewport: ScaleId -> Int     // px, e.g. 320
    scale_max_viewport: ScaleId -> Int     // px, e.g. 1500
    scale_min_ratio:    ScaleId -> Float   // e.g. 1.2 (Minor Third)
    scale_max_ratio:    ScaleId -> Float   // e.g. 1.333 (Perfect Fourth)
    scale_base_size:    ScaleId -> Float   // rem, e.g. 1.0
    scale_steps:        ScaleId -> list Int  // named steps, e.g. [-2,-1,0,1,2,3,4,5,6]

    computed_steps: ScaleId -> Int -> String
    // scaleId -> step number -> CSS clamp() value

    derived_spacers: ScaleId -> String -> String
    // scaleId -> size name (xs/sm/md/lg/xl) -> CSS clamp() value
  }

  actions {
    action configure(name: String, minViewport: Int, maxViewport: Int, minRatio: Float, maxRatio: Float, base: Float, steps: list Int) {
      -> ok(scaleId: ScaleId, computedSteps: String) {
        Generates all steps as CSS clamp() values. Formula for each step N:
          slope = (maxSize - minSize) / (maxViewport - minViewport)
          intercept = minSize - slope * minViewport
          clamp(minSize rem, intercept rem + slope*100 vw, maxSize rem)
        Returns JSON map of step number -> clamp() string.
        Also derives spacers: xs=base*0.25, sm=base*0.5, md=base*1.0, etc.
      }
      -> error(message: String) { Invalid params. Ratios must be 1.0-2.0. }
    }

    action computeStep(scaleId: ScaleId, step: Int) {
      -> ok(clampValue: String, minPx: Float, maxPx: Float) {
        Returns the clamp() expression for a single step, with min/max pixel
        values for documentation and tooling display.
      }
      -> notfound(message: String) { Scale not found. }
    }

    action generateFluidClamp(minPx: Float, maxPx: Float, minViewport: Int, maxViewport: Int) {
      -> ok(clampValue: String) {
        Generic clamp generator for any two sizes independent of a named scale.
        Used by MaterialSurface and Density to produce fluid non-type values.
      }
    }

    action deriveSpacer(scaleId: ScaleId, multiplier: Float) {
      -> ok(clampValue: String) {
        Derives a spacing value from the type base using a multiplier.
        Ensures spacing and typography scale proportionally from the same unit.
      }
      -> notfound(message: String) { Scale not found. }
    }
  }

  invariant {
    after configure(name: n, minViewport: 320, maxViewport: 1500,
                    minRatio: 1.2, maxRatio: 1.333, base: 1.0, steps: [0]) -> ok(_)
    then computeStep(scaleId: s, step: 0) -> ok(minPx: 16.0, maxPx: 16.0, _)
    // Step 0 is the base size at all viewports regardless of ratios.
  }
}
```

---

### FontMetrics

```
@version(1)
concept FontMetrics {

  purpose {
    Per-font precision tokens. Manages OpenType feature sets by context
    (body prose: old-style numerals + discretionary ligatures; data tables:
    tabular numerals; code: slashed zero), variable font axis values per
    surface, baseline alignment metrics (Capsize-style whitespace trimming),
    drop cap configuration, automated smallcaps detection (regex on content:
    3+ consecutive caps -> font-variant-caps: small-caps), and pseudo-element
    targeting (::first-letter, ::first-line). Closes the gap between
    "font-family is set" and "the font is being used optimally."
  }

  capabilities {
    requires persistent-storage
  }

  state {
    fonts: set FontId
    font_family:        FontId -> String
    font_cap_height:    FontId -> Float   // fraction of em
    font_x_height:      FontId -> Float
    font_ascender:      FontId -> Float
    font_descender:     FontId -> Float
    font_is_variable:   FontId -> Bool
    font_variable_axes: FontId -> list String  // e.g. ["wght", "opsz", "GRAD"]

    feature_sets: set FeatureSetId
    feature_set_context:  FeatureSetId -> String
    // contexts: "prose" | "data" | "code" | "heading" | "caption" | "ui"
    feature_set_font:     FeatureSetId -> FontId
    feature_set_opentype: FeatureSetId -> list String
    // e.g. ["liga", "onum", "kern", "calt"] for prose
    feature_set_axes:     FeatureSetId -> String
    // JSON: {"wght": 400, "opsz": 16, "GRAD": 0}

    drop_cap_config: FontId -> option String
    // JSON: {lines: 3, accentProbability: 0.07}

    smallcaps_rule: FontId -> option String
    // JSON: {minConsecutiveCaps: 3, excludeRomanNumerals: true, followsNumber: true}

    pseudo_targets: set PseudoId
    pseudo_font:     PseudoId -> FontId
    pseudo_selector: PseudoId -> String  // "::first-letter" | "::first-line"
    pseudo_context:  PseudoId -> String
    pseudo_styles:   PseudoId -> String  // JSON CSS properties
  }

  actions {
    action configure(family: String, metrics: String, isVariable: Bool, axes: list String) {
      -> ok(fontId: FontId) {
        Registers a font with its metrics. Metrics JSON: {capHeight, xHeight, ascender,
        descender} as fractions of em. Used for baseline-grid alignment and whitespace
        trimming.
      }
      -> error(message: String) { Duplicate family or invalid metrics. }
    }

    action resolveFeatures(fontId: FontId, context: String) {
      -> ok(opentype: list String, axisValues: String, cssValue: String) {
        Returns the OpenType feature list and variable axis values for the context.
        cssValue is the ready-to-use font-feature-settings CSS string.
      }
      -> notfound(message: String) { Font or context not found. }
    }

    action getBaselineOffset(fontId: FontId, size: Float) {
      -> ok(trimTop: Float, trimBottom: Float) {
        Computes the margin trim needed to align visual cap-height to the baseline
        grid. Output in rem. Uses cap_height and ascender metrics.
      }
    }

    action getDropCapConfig(fontId: FontId) {
      -> ok(config: String) {
        Returns drop cap configuration JSON. Includes accentProbability for the
        "delightful randomness" pattern: each page navigation has a N% chance of
        rendering the drop cap in the accent color instead of the base color.
      }
      -> notfound(message: String) { No drop cap configured for this font. }
    }

    action resolveVariableAxes(fontId: FontId, context: String, surface: String) {
      -> ok(axes: String) {
        Computes variable font axes for the given context and surface type.
        Key rules:
          GRAD = -25 on dark surfaces (prevents stroke bleed).
          opsz = text size in points (optical sizing auto-adjusts glyph outlines).
          wght from feature set definition.
      }
    }
  }
}
```

---

### Shape

```
@version(1)
concept Shape {

  purpose {
    Edge and corner philosophy as a first-class theme dimension. Encodes the
    geometric character of the interface: sharp/angular (brutalist, Material
    zero-radius), uniformly rounded (Material 4dp), pill/stadium, organic blob
    (asymmetric CSS border-radius: "30% 70% 70% 30% / 30% 30% 70% 70%"),
    squircle/superellipse (continuous curvature via SVG clip-path, Apple-style),
    or beveled (trapezoid clip-path). Resolves to concrete CSS per element type.
    Material Design 3's Expressive update added 35 abstract shapes to formalize
    this dimension — this concept generalizes that approach.
  }

  capabilities {
    requires persistent-storage
  }

  state {
    configs: set ShapeConfigId
    config_philosophy: ShapeConfigId -> String
    // "sharp" | "rounded" | "pill" | "organic" | "squircle" | "beveled"
    config_params:     ShapeConfigId -> String
    // JSON: {scale: [0,2,4,8,16,24,9999], blobSeed: 42, squircleN: 4.0}

    active_config: option ShapeConfigId

    element_overrides: String -> option String
    // element type -> custom CSS override

    computed_values: ShapeConfigId -> String -> String
    // configId -> element type -> CSS border-radius or clip-path value
    // standard element types: button, card, input, dialog, chip,
    //                         badge, fab, toast, popover, avatar
  }

  actions {
    action configure(philosophy: String, params: String) {
      -> ok(configId: ShapeConfigId) {
        Records the philosophy and pre-computes CSS values for all standard
        element types. Sets as active config.
        For squircle: params.squircleN controls the superellipse exponent
        (4.0 ~= Apple's rounded rectangle, higher = more rectangular).
        For organic: params.blobSeed seeds the randomized asymmetric radius.
      }
      -> error(message: String) { Unknown philosophy. }
    }

    action resolve(element: String) {
      -> ok(radius: String, clipPath: option String) {
        Returns border-radius for the element type.
        For squircle: also returns clip-path SVG path.
        For organic: returns asymmetric border-radius values.
        Checks element_overrides first, falls back to computed philosophy value.
      }
      -> notfound(message: String) { Element type unrecognized. }
    }

    action computeRadius(element: String, context: String) {
      -> ok(value: String) {
        Context-aware radius. Context: "mobile" | "desktop" | "tablet".
        e.g. FAB uses pill on mobile, large-rounded on desktop.
      }
    }

    action computeClipPath(element: String, width: Float, height: Float) {
      -> ok(clipPath: String) {
        For squircle philosophy: computes SVG path for superellipse at the given
        element dimensions. Returns CSS clip-path value.
        Formula: x(t) = a*|cos(t)|^(2/n)*sign(cos(t)),
                 y(t) = b*|sin(t)|^(2/n)*sign(sin(t))
      }
    }
  }

  invariant {
    after configure(philosophy: "pill", params: _) -> ok(configId: s)
    then resolve(element: "button") -> ok(radius: "9999px", clipPath: none)
    and resolve(element: "fab") -> ok(radius: "9999px", _)
  }
}
```

---

### Iconography

```
@version(1)
concept Iconography {

  purpose {
    Icon style and variable font axes as theme-level choices. In Material Symbols,
    icons are a variable font with 5 axes: fill (0-1), weight (100-700), grade
    (-50 to 200), optical size (20-48), roundness (0-100). Theming must set defaults
    for all axes, specify how they shift on interaction states, and auto-compensate
    grade for dark surfaces (grade -25 prevents visual bleed that makes icons appear
    bolder than intended). Icon weight should harmonize with body text weight.
  }

  capabilities {
    requires persistent-storage
  }

  state {
    configs: set IconConfigId
    config_style:        IconConfigId -> String
    // "outlined" | "filled" | "duotone" | "thin" | "bold" | "sharp"
    config_weight:       IconConfigId -> Int   // 100-700
    config_grade:        IconConfigId -> Int   // -50 to 200
    config_optical_size: IconConfigId -> Int   // 20-48
    config_fill:         IconConfigId -> Float // 0-1
    config_roundness:    IconConfigId -> Int   // 0-100

    active_config: option IconConfigId

    surface_grade_map: String -> Int
    // surface type -> grade adjustment
    // "dark" -> -25, "light" -> 0, "vibrant" -> 50, "emphasis" -> 100
  }

  actions {
    action configure(style: String, weight: Int, grade: Int, opticalSize: Int, fill: Float, roundness: Int) {
      -> ok(configId: IconConfigId) {
        Records icon configuration. Sets as active config.
      }
      -> error(message: String) { Unknown style or axis out of range. }
    }

    action resolveAxes(surface: String, textWeight: option Int) {
      -> ok(axes: String, cssValue: String) {
        Returns variable font axes for the surface type.
        If textWeight provided, icon weight harmonizes with it (same value).
        Grade auto-adjusted for surface: dark surfaces get -25.
        cssValue is ready-to-use font-variation-settings CSS string.
      }
      -> notfound(message: String) { No active config. }
    }

    action getGradeForSurface(surface: String) {
      -> ok(grade: Int) {
        Returns the recommended grade for the surface type from surface_grade_map.
      }
    }

    action getStyleVariant(context: String) {
      -> ok(style: String) {
        Returns the icon style for a UI context.
        Contexts: "nav-selected" -> filled, "nav-unselected" -> outlined,
        "action" -> per config default, "status" -> per config default.
      }
    }
  }
}
```

---

### Density

```
@version(1)
concept Density {

  purpose {
    Cross-cutting compact / comfortable / spacious transformation. Applies a
    calibrated multiplier to spacing and component padding. Critically, it does
    NOT apply uniformly: an exemption list of interactor types is always held at
    comfortable. This matches the empirical finding in Material Design, Ant Design,
    and AWS Cloudscape that densifying date pickers, dialogs, data visualizations,
    and overlay components degrades usability. Density mediates between the theme
    default and the Preference/resolve output for the "density" key.
  }

  capabilities {
    requires persistent-storage
  }

  state {
    current_mode: String           // "compact" | "comfortable" | "spacious"

    mode_multipliers: String -> Float
    // "compact" -> 0.75, "comfortable" -> 1.0, "spacious" -> 1.25

    mode_height_delta: String -> Int
    // compact removes 4px of component height per step (Material convention)

    default_exemptions: set String
    // interactor types that are always comfortable:
    // "date-point", "color", "entity-page", "score-graph", "diff-view", "file-attach"

    custom_exemptions: set String
  }

  actions {
    action set(mode: String, exemptions: option list String) {
      -> ok(multiplier: Float, exemptions: list String) {
        Sets density mode. Merges custom exemptions with defaults.
        Returns the multiplier and full exemption list.
      }
      -> error(message: String) { Unknown mode. }
    }

    action get() {
      -> ok(mode: String, multiplier: Float) { Current mode and multiplier. }
    }

    action getMultiplier(interactorType: option String) {
      -> ok(multiplier: Float) {
        Returns 1.0 for exempted interactor types regardless of global mode.
        Otherwise returns the mode multiplier.
      }
    }

    action isExempt(interactorType: String) {
      -> ok(exempt: Bool) { Whether this type is exempt from density transformations. }
    }

    action listExemptions() {
      -> ok(interactorTypes: list String) { Default + custom exemptions. }
    }
  }

  invariant {
    after set(mode: "compact", exemptions: none) -> ok(_)
    then getMultiplier(interactorType: "date-point") -> ok(multiplier: 1.0)
    and getMultiplier(interactorType: none) -> ok(multiplier: 0.75)
  }
}
```

---

### MaterialSurface

```
@version(1)
concept MaterialSurface {

  purpose {
    Surface depth philosophy and physics parameters. Instead of hardcoded shadow
    hex values, encodes the physical metaphor (flat, elevated paper, frosted glass,
    soft clay, liquid glass) and procedurally computes CSS shadow, backdrop-filter,
    and gradient values from physics tokens. This makes shadow values stay consistent
    when the background color changes, which static hex shadows cannot do.
    Provider-routed: CSS handles most cases; WebGL handles liquid glass and 3D;
    SVG handles noise overlays and displacement maps.
  }

  capabilities {
    requires persistent-storage
  }

  state {
    configs: set ConfigId
    config_philosophy:     ConfigId -> String
    // "flat" | "elevated" | "translucent" | "neumorphic" | "liquid-glass" | "textured" | "3d"

    config_light_angle:     ConfigId -> Float  // degrees 0-360
    config_light_intensity: ConfigId -> Float  // 0-1
    config_surface_color:   ConfigId -> String // base background color
    config_shadow_hue:      ConfigId -> option Float
    config_extrusion_depth: ConfigId -> option Float
    config_reflectivity:    ConfigId -> option Float
    config_blur_radius:     ConfigId -> option Float
    config_surface_opacity: ConfigId -> option Float
    config_border_glare:    ConfigId -> option Float
    config_noise_intensity: ConfigId -> option Float
    config_noise_frequency: ConfigId -> option Float
    config_noise_type:      ConfigId -> option String  // "turbulence" | "fractalNoise"
    config_blend_mode:      ConfigId -> option String

    active_config: option ConfigId
  }

  actions {
    action configure(philosophy: String, params: String) {
      -> ok(configId: ConfigId) {
        Records surface philosophy and physics params. Sets as active.
        Params JSON varies by philosophy. For neumorphic: {extrusionDepth, reflectivity}.
        For glass: {blurRadius, surfaceOpacity, borderGlare}.
        For textured: {noiseIntensity, noiseFrequency, noiseType, blendMode}.
      }
      -> error(message: String) { Unknown philosophy or invalid params. }
    }

    action computeShadow(level: Int, philosophy: option String) {
      -> ok(shadow: String, cssValue: String) {
        For "elevated": generates Josh Comeau layered multi-shadow stack (3 shadows
        with different offsets, blur radii, and opacities derived from light angle).
        Optionally hue-tinted to brand color.
        For "neumorphic": generates dual inset+outset shadows from extrusion depth
        and surface color, computed procedurally so they adapt if the surface color changes.
        For "flat": returns "none".
        Routes complex cases (liquid glass, 3D) to registered WebGL provider.
      }
      -> error(message: String) { Invalid level. }
    }

    action computeBackdrop(component: String) {
      -> ok(backdrop: String, cssValue: String) {
        For "translucent"/"liquid-glass": generates backdrop-filter CSS with computed
        blur radius plus border overlay for the surface glare effect.
      }
      -> notfound(message: String) { Not applicable for active philosophy. }
    }

    action computeGradient(surface: String, params: option String) {
      -> ok(gradient: String) {
        Generates appropriate CSS gradient for active philosophy.
        "elevated": subtle tonal gradient for surface tinting.
        "3d": multi-stop gradient for depth simulation.
        "neumorphic": color-offset gradient suggesting material curvature.
      }
    }

    action routeToProvider(provider: String, operation: String, payload: String) {
      -> ok(result: String) { Dispatches to the registered provider. }
      -> notfound(message: String) { Provider not registered. }
    }
  }
}
```

---

### StyleProfile

```
@version(1)
concept StyleProfile {

  purpose {
    High-level aesthetic philosophy encoding all 10 design-space axes simultaneously.
    Acts as the "master dial" that pre-configures MaterialSurface, Shape, Density,
    SpringPhysics, FontMetrics, and Iconography with internally consistent values.
    Internal consistency is the key property: a StyleProfile should not produce a
    neumorphic material philosophy combined with brutalist sharp edges and no motion,
    since those axes conflict aesthetically. configure() derives all downstream configs
    with cross-axis coherence.
    Also carries an AI-readable style prompt for generative asset creation.
    decode() parses natural-language descriptions into axis values via an LLM provider.
  }

  capabilities {
    requires persistent-storage
  }

  state {
    profiles: set ProfileId
    profile_name: ProfileId -> String

    // The 10 axes
    profile_surface:            ProfileId -> String
    profile_edge:               ProfileId -> String
    profile_color_philosophy:   ProfileId -> String
    profile_spatial_philosophy: ProfileId -> String
    profile_metaphor:           ProfileId -> String
    profile_animation:          ProfileId -> String
    profile_typography:         ProfileId -> String
    profile_ornament:           ProfileId -> String
    profile_mood:               ProfileId -> String
    profile_convention:         ProfileId -> String

    profile_ai_prompt:          ProfileId -> String
    profile_illustration_style: ProfileId -> String
    profile_randomness:         ProfileId -> option String

    active_profile: option ProfileId
    derived_configs: ProfileId -> String  // cached JSON config for downstream concepts
  }

  actions {
    action configure(name: String, axes: String, aiPrompt: String, illustrationStyle: String) {
      -> ok(profileId: ProfileId, derivedConfig: String) {
        Records the profile. Axes is JSON {surface, edge, colorPhilosophy, ...}.
        Derives internally consistent configurations for all downstream concepts:
          surface   -> MaterialSurface.philosophy + physics params
          edge      -> Shape.philosophy + params
          spatial   -> Density.mode
          animation -> SpringPhysics preset defaults
          typography -> FontMetrics feature set defaults
          ornament  -> DesignToken decorative layer multipliers
        Returns derivedConfig JSON for downstream sync propagation.
      }
      -> error(message: String) { Invalid axis value. }
    }

    action encode() {
      -> ok(axes: String, aiPrompt: String, filterPreset: String) {
        Returns the active profile's serialized axes and AI generation prompts.
        filterPreset is the recommended ImageFilter preset for this aesthetic.
      }
      -> notfound(message: String) { No active profile. }
    }

    action decode(description: String) {
      -> ok(pending: Bool) {
        Records the pending decode request and routes to the registered provider via
        routeToProvider("decode", {description, currentAxes}).
        The provider assembles a prompt and fires LLMCompletion/complete or applies
        its own rule-based logic. The return sync StyleProfileAIDecodesFromCompletion
        catches the result and calls StyleProfile/configure with the interpreted axes.
        If no provider is registered: returns notfound cleanly with no side effects.
      }
      -> notfound(message: String) { No provider registered for decode. }
    }

    action applyToTheme(themeId: String) {
      -> ok(appliedCount: Int) {
        Applies active profile's derived configs to all downstream concepts.
        Returns count of concepts configured.
      }
    }

    action requestAsset(assetType: String) {
      -> ok(pending: Bool) {
        Routes an asset generation request to the registered provider via
        routeToProvider("request-asset", {assetType, aiPrompt, illustrationStyle}).
        The provider dispatches to whatever backend it wraps (LLM suite, image API, etc.).
        The ai_prompt and illustration_style state fields are the data the provider reads.
        Types: "icon" | "illustration" | "background" | "hero-image" | "avatar".
      }
      -> notfound(message: String) { No provider registered for asset requests. }
    }

    action routeToProvider(operation: String, payload: String) {
      -> ok(result: String) { Dispatches to the registered provider for this operation. }
      -> notfound(message: String) { No provider registered. }
    }
  }
}
```

---

### SpringPhysics

```
@version(1)
concept SpringPhysics {

  purpose {
    Spring-based animation parameters as named presets. The state of the art
    has moved beyond duration+easing curves to physics parameters (tension,
    friction, mass) that produce more natural-feeling motion. Presets compose:
    a "snappy" spring enter can be combined with a "gentle" exit.
    prefers-reduced-motion collapses all springs to an opacity-only fade <=200ms
    via the "__reduced-motion" preset.
    Provider-routed: CSS uses linear() approximation computed at build time;
    Framer Motion and React Spring use native spring engines at runtime.
  }

  capabilities {
    requires persistent-storage
  }

  state {
    presets: set PresetId
    preset_name:              PresetId -> String
    preset_tension:           PresetId -> Float
    preset_friction:          PresetId -> Float
    preset_mass:              PresetId -> Float
    preset_velocity:          PresetId -> Float
    preset_duration_override: PresetId -> option Int  // ms; bypasses spring math

    reduced_motion_preset: option PresetId

    provider_mappings: String -> String   // runtime name -> provider concept name
  }

  actions {
    action register(name: String, tension: Float, friction: Float, mass: Float, velocity: Float) {
      -> ok(presetId: PresetId) {
        Records a spring preset.
        Built-in presets initialized at startup:
          "snappy":  tension 400, friction 30, mass 1.0
          "gentle":  tension 120, friction 14, mass 1.0
          "bouncy":  tension 180, friction 12, mass 1.0
          "stiff":   tension 600, friction 40, mass 1.0
          "__reduced-motion": durationOverride 150ms, opacity-only
      }
      -> error(message: String) { Duplicate name. }
    }

    action resolve(preset: String, context: option String) {
      -> ok(params: String, cssValue: String, frameworkValue: String) {
        Returns spring params and ready-to-use values.
        If prefers-reduced-motion is active via Preference, overrides with
        the "__reduced-motion" preset regardless of what was requested.
        cssValue: CSS transition shorthand using precomputed linear() curve.
        frameworkValue: JSON-compatible config for Framer Motion / React Spring.
      }
      -> notfound(message: String) { Preset not found. }
    }

    action computeValue(presetId: PresetId, t: Float) {
      -> ok(position: Float, velocity: Float) {
        Evaluates the spring ODE at time t seconds.
        Used for tooling: preview the curve, generate CSS linear() approximation.
        Returns position (0=start, 1=end) and velocity at that moment.
      }
    }

    action getReducedMotionFallback() {
      -> ok(preset: String, cssValue: String) {
        Returns the __reduced-motion override: opacity-only fade, <=200ms.
        Always safe to call; does not require Preference to be active.
      }
    }

    action routeToProvider(runtime: String, presetId: PresetId) {
      -> ok(config: String) { Dispatches to provider for the runtime. }
      -> notfound(message: String) { No provider for runtime. }
    }
  }

  invariant {
    after register(name: "n", tension: t, friction: f, mass: m, velocity: v) -> ok(presetId: p)
    then resolve(preset: "n", context: none) -> ok(_, _, _)
    and computeValue(presetId: p, t: 0.0) -> ok(position: 0.0, _)
  }
}
```

---

### MotionChoreography

```
@version(1)
concept MotionChoreography {

  purpose {
    Orchestration of motion sequences across multiple elements. Operates on named
    sequences rather than individual elements, allowing themes to declare choreography
    style without knowing what will be animated. Manages stagger delays (capped so a
    list of 1000 items doesn't take forever), entrance/exit ordering (exit sequences
    reverse the stagger), scroll-driven animation parameter sets (CSS scroll-timeline
    and view-timeline, Chrome 115+, Safari 26+), and parallax speed ratios per layer.
  }

  capabilities {
    requires persistent-storage
  }

  state {
    sequences: set SeqId
    seq_name:         SeqId -> String
    seq_type:         SeqId -> String
    // "stagger-enter" | "stagger-exit" | "cascade" | "scroll-driven" | "parallax"
    seq_base_delay:   SeqId -> Int     // ms
    seq_stagger_step: SeqId -> Int     // ms per subsequent item
    seq_max_items:    SeqId -> Int     // delay cap
    seq_easing:       SeqId -> String  // SpringPhysics preset name or CSS easing

    scroll_params: SeqId -> option String
    // JSON: {timelineType: "scroll"|"view", range: "entry cover", inset: "0px 0px"}

    parallax_layers: SeqId -> option String
    // JSON: [{layer: "background", speed: 0.2}, {layer: "midground", speed: 0.5}]

    reduced_motion_mode: SeqId -> String
    // "disable" | "fade-only" | "collapse"
  }

  actions {
    action register(name: String, type: String, baseDelay: Int, staggerStep: Int, maxItems: Int, easing: String) {
      -> ok(seqId: SeqId) {
        Records a choreography sequence.
        Built-in sequences initialized at startup:
          "list-enter":  stagger-enter, base 0ms,  step 50ms,  max 12
          "list-exit":   stagger-exit,  base 0ms,  step 30ms,  max 8
          "page-enter":  stagger-enter, base 80ms, step 80ms,  max 5
          "hero-reveal": cascade,       base 0ms,  step 120ms, max 4
      }
      -> error(message: String) { Invalid type or duplicate name. }
    }

    action resolve(sequence: String, itemCount: Int) {
      -> ok(delays: list Int, cssValues: list String) {
        Computes delay for each item index 0..itemCount-1.
        Caps at max_items (remaining items get the max delay, preventing runaway).
        For exit sequences: delay = step * (total - 1 - index) for reverse order.
        Returns both raw ms values and CSS animation-delay strings.
      }
      -> notfound(message: String) { Sequence not found. }
    }

    action computeDelay(seqId: SeqId, index: Int, total: Int) {
      -> ok(delay: Int) { Single item delay computation. }
    }

    action getScrollParams(seqId: SeqId) {
      -> ok(params: String) {
        Returns scroll-driven animation parameters as CSS annotations.
        animation-timeline, animation-range, etc.
      }
      -> notfound(message: String) { Not a scroll-driven sequence. }
    }

    action listSequences() {
      -> ok(names: list String) { All registered sequence names. }
    }
  }
}
```

---

### StructuralMotifProvider (base concept)

```
@version(1)
concept StructuralMotifProvider {

  purpose {
    Base concept that all structural motif providers derive from. Defines the
    required operation contract. A provider that does not implement all required
    operations is rejected at registration time rather than failing silently at
    runtime. Third-party providers implement this contract to become valid
    paradigm providers without any other coupling to the kit.
  }

  actions {
    // Required: emit Layout/configure calls and CSS structural tokens for the paradigm
    action render(intent: String, paradigm: String, params: option String, scope: option String) {
      -> ok(layoutConfig: String, cssTokens: String) {
        layoutConfig: JSON consumed by Layout/configure for this zone.
        cssTokens: JSON of --motif-* CSS custom properties to register.
      }
      -> notfound(message: String) { Paradigm not supported by this provider. }
    }

    // Required: declare which paradigm names this provider handles
    action listParadigms() {
      -> ok(paradigms: list String)
    }
  }
}
```

---

### StructuralMotif

```
@version(1)
concept StructuralMotif {

  purpose {
    Maps abstract semantic intent tokens to concrete layout paradigms per breakpoint
    and per scope. The theme declares "primary-navigation -> PersistentSidebar on
    desktop, BottomTabBar on mobile" without knowing what widgets will fill those
    roles. Multiple intents can be active simultaneously in the same scope: a page
    can have a FAB for primary-action, a ribbon for utility-bar, and a sidebar for
    primary-navigation all at once. Different scopes (pages, panels, zones) carry
    independent motif configurations that inherit from their parent scope, exactly
    as color tokens do.
    The paradigm name is an open string — any value is valid as long as a provider
    is registered for it. Built-in paradigm names are a starting point, not a ceiling.
    The boundary: a theme declares WHERE an intent lives and WHAT FORM it takes,
    not WHAT IS IN IT (that is content, not presentation).
  }

  capabilities {
    requires persistent-storage
  }

  state {
    intents: set IntentId
    intent_name: IntentId -> String
    // standard intents — extensible, any string is valid:
    // navigation:  "primary-navigation", "secondary-navigation"
    // actions:     "primary-action", "secondary-action", "contextual-action", "destructive-action"
    // content:     "data-display", "content-area"
    // chrome:      "utility-bar", "overlay-hub", "status-bar"

    providers: set ProviderEntry
    provider_paradigm: ProviderEntry -> String   // paradigm name this provider handles
    provider_concept:  ProviderEntry -> String   // registered StructuralMotifProvider concept name

    mappings: set MappingId
    mapping_intent:    MappingId -> IntentId
    mapping_viewport:  MappingId -> String       // "mobile" | "tablet" | "desktop" | "any"
    mapping_paradigm:  MappingId -> String       // any registered paradigm name
    mapping_params:    MappingId -> option String // JSON: paradigm-specific configuration
    mapping_scope:     MappingId -> option String // none = global; scope name = applies only in that zone
  }

  actions {
    action registerProvider(paradigm: String, providerConcept: String) {
      -> ok(entry: ProviderEntry) {
        Registers a StructuralMotifProvider concept as the handler for a paradigm name.
        Validates that the concept implements the StructuralMotifProvider contract.
        Called at deployment time, not at theme parse time.
      }
      -> error(message: String) { Provider concept does not implement required contract. }
    }

    action configure(intent: String, paradigm: String, viewport: String, scope: option String, params: option String) {
      -> ok(mappingId: MappingId) {
        Records an intent -> paradigm mapping for a viewport and optional scope.
        scope: none = global default; scope name = override for that zone only.
        Multiple intents can be configured independently — primary-action and
        primary-navigation are separate mappings, both active simultaneously.
        Paradigm name is validated against registered providers, not a hardcoded list.
      }
      -> error(message: String) { No provider registered for this paradigm name. }
    }

    action resolve(intent: String, viewport: String, scope: option String) {
      -> ok(paradigm: String, params: option String, provider: String) {
        Resolves paradigm for an intent at a viewport within a scope.
        Resolution order:
          1. Exact match: intent + viewport + scope
          2. Viewport wildcard: intent + "any" + scope
          3. Scope inheritance: walk up parent scopes repeating 1-2
          4. Global fallback: intent + viewport + no scope
          5. Global wildcard: intent + "any" + no scope
        Returns notfound only if no mapping exists at any level.
      }
      -> notfound(message: String) { No mapping found after full resolution chain. }
    }

    action getParadigm(intent: String, scope: option String) {
      -> ok(paradigms: String) {
        All paradigm mappings for an intent across all viewports and the given scope,
        plus inherited global mappings. JSON.
      }
    }

    action listIntents() {
      -> ok(intents: list String) { All registered intent names including custom ones. }
    }

    action listParadigms() {
      -> ok(paradigms: list String) { All paradigm names with registered providers. }
    }

    action routeToProvider(paradigm: String, intent: String, viewport: String, scope: option String, params: option String) {
      -> ok(layoutConfig: String, cssTokens: String) {
        Dispatches to the registered provider for this paradigm.
        Provider returns Layout/configure JSON and CSS token map.
      }
      -> notfound(message: String) { No provider registered for paradigm. }
    }
  }

  invariant {
    after configure(intent: "primary-navigation", paradigm: "BottomTabBar", viewport: "mobile", scope: none, _) -> ok(_)
    then resolve(intent: "primary-navigation", viewport: "mobile", scope: none) -> ok(paradigm: "BottomTabBar", _, _)
    // Multiple intents are independent: configuring primary-action does not affect primary-navigation.
    // Scope override does not affect global: configuring within "admin" scope
    // does not change resolve(..., scope: none) for the same intent.
  }
}
```

---

### ImageFilter

```
@version(1)
concept ImageFilter {

  purpose {
    Image treatment as a theme-level choice. A theme is visually broken if its
    imagery contradicts its aesthetic — a neumorphic soft-clay theme should not
    have unfiltered high-saturation photography. ImageFilter encodes CSS filter
    chains (grayscale, sepia, hue-rotate, contrast), duotone color pairs via
    SVG feColorMatrix, blend modes, SVG displacement maps, and AI generation
    prompt formulas. Provider-routed: CSS handles web; SVG handles complex
    manipulations; AI handles generative asset creation.
  }

  capabilities {
    requires persistent-storage
  }

  state {
    presets: set PresetId
    preset_name: PresetId -> String
    preset_type: PresetId -> String
    // "css-filter" | "duotone" | "blend" | "svg-displacement" | "ai-generate"

    preset_css_filter:           PresetId -> option String
    preset_shadow_color:         PresetId -> option String
    preset_highlight_color:      PresetId -> option String
    preset_blend_mode:           PresetId -> option String
    preset_blend_color:          PresetId -> option String
    preset_displacement_scale:   PresetId -> option Float
    preset_turbulence_frequency: PresetId -> option Float
    preset_ai_prompt_formula:    PresetId -> option String

    active_preset: option PresetId
  }

  actions {
    action register(name: String, type: String, config: String) {
      -> ok(presetId: PresetId) {
        Records a filter preset. Config is JSON with type-specific params.
        Built-in presets initialized at startup:
          "none":     no filter
          "muted":    css-filter: grayscale(0.15) contrast(1.05)
          "warm":     css-filter: sepia(0.2) saturate(1.1) brightness(1.02)
          "noir":     css-filter: grayscale(1)
          "duotone-editorial": duotone with black shadow + brand highlight
      }
      -> error(message: String) { Unknown type or duplicate name. }
    }

    action apply(preset: String, imageContext: String) {
      -> ok(cssValue: String, svgFilter: option String) {
        Returns filter values ready for application and routes to provider.
        cssValue: CSS filter property string (CSS provider path).
        svgFilter: inline SVG <filter> element string (SVG provider path).
        For AI-type presets: routes to the registered AI provider via routeToProvider,
        which assembles the prompt from preset_ai_prompt_formula and dispatches
        generation through the LLM suite or image API. No aiPrompt return field —
        the provider owns the full round-trip for that path.
      }
      -> notfound(message: String) { Preset not found. }
    }

    action computeDuotone(shadowColor: String, highlightColor: String) {
      -> ok(svgMatrix: String) {
        Computes the SVG feColorMatrix values for a duotone effect.
        Maps luminance 0->shadow color, luminance 1->highlight color.
        Returns the complete <feColorMatrix> element as a string.
      }
    }

    action routeToProvider(provider: String, presetId: PresetId, payload: String) {
      -> ok(result: String) { Routes to CSS, SVG, or AI provider. }
      -> notfound(message: String) { Provider not registered. }
    }
  }
}
```

---

## 6. Extended `.theme` File Format

All new blocks are optional and backward-compatible. Old parsers ignore unknown blocks;
new parsers treat missing blocks as "use defaults."

```
@version(2)
theme <n> [extends <parent>] {

  // ── EXISTING BLOCKS (unchanged) ──────────────────────────────────────
  palette { … }
  typography { … }
  spacing { … }
  motion { … }
  elevation { … }
  radius { … }

  // ── NEW: Algorithmic color derivation engine ──────────────────────────
  color-space {
    algorithm: oklch         // oklch | hct | p3 | srgb
    gamut: srgb              // srgb | display-p3 | rec2020
    seeds {
      brand:   oklch(0.55 0.20 265)
      accent:  oklch(0.65 0.22 320)
      neutral: oklch(0.50 0.02 265)
    }
    steps: 13                // tonal steps per seed (Material 3 uses 13)
  }

  // ── NEW: Light/dark/high-contrast mode role mappings ─────────────────
  color-scheme {
    mode light {
      primary:              [brand, step: 40]
      on-primary:           [brand, step: 100]
      primary-container:    [brand, step: 90]
      on-primary-container: [brand, step: 10]
      surface:              [neutral, step: 99]
      on-surface:           [neutral, step: 10]
      error:                oklch(0.55 0.22 25)
    }
    mode dark {
      primary:              [brand, step: 80]
      on-primary:           [brand, step: 20]
      surface:              [neutral, step: 6]
      on-surface:           [neutral, step: 90]
    }
    mode high-contrast {
      primary:              [brand, step: 20]
      on-primary:           [brand, step: 100]
      surface:              oklch(1.0 0 0)
      on-surface:           oklch(0 0 0)
    }
  }

  // ── NEW: Density mode ─────────────────────────────────────────────────
  density {
    default: comfortable     // compact | comfortable | spacious
    exemptions: [date-point, color, entity-page, score-graph, diff-view]
    multipliers {
      compact:     0.75
      comfortable: 1.0
      spacious:    1.25
    }
  }

  // ── NEW: Corner/edge philosophy ───────────────────────────────────────
  shape {
    philosophy: rounded      // sharp | rounded | pill | organic | squircle | beveled
    scale: [0, 2, 4, 8, 12, 16, 24, 9999]
    overrides {
      fab:    pill
      chip:   pill
      dialog: 28px
    }
  }

  // ── NEW: Icon style and variable font axes ────────────────────────────
  iconography {
    style: outlined          // outlined | filled | duotone | thin | bold | sharp
    weight: 400
    grade: 0
    optical-size: 24
    fill: 0
    roundness: 0
    dark-surface-grade: -25
  }

  // ── NEW: Surface depth philosophy ─────────────────────────────────────
  material {
    philosophy: elevated     // flat | elevated | translucent | neumorphic | liquid-glass | textured | 3d
    light-angle: 135
    light-intensity: 0.8
    shadow-color-hue: 265
    // For neumorphic: extrusion-depth, reflectivity
    // For glassmorphism: blur-radius, surface-opacity, border-glare
    // For textured: noise-intensity, noise-frequency, noise-type, blend-mode
  }

  // ── NEW: Fluid type scale generator ──────────────────────────────────
  type-scale {
    min-viewport: 320
    max-viewport: 1500
    min-ratio: 1.2           // Minor Third at small screens
    max-ratio: 1.333         // Perfect Fourth at large screens
    base: 1.0                // rem
    steps: [-2, -1, 0, 1, 2, 3, 4, 5, 6]
  }

  // ── NEW: Per-font OpenType precision ──────────────────────────────────
  font-metrics {
    family: "Inter"
    cap-height: 0.727
    x-height: 0.544
    is-variable: true
    axes: [wght, opsz, slnt]
    feature-sets {
      prose:   { opentype: [liga, onum, kern, calt],  axes: {wght: 400, opsz: 16} }
      data:    { opentype: [tnum, zero, kern],         axes: {wght: 400, opsz: 14} }
      code:    { opentype: [zero],                     axes: {wght: 400, opsz: 14} }
      heading: { opentype: [ss01, kern],               axes: {wght: 700, opsz: 48} }
    }
    drop-cap {
      lines: 3
      accent-probability: 0.0
    }
    smallcaps-rule {
      min-consecutive-caps: 3
      exclude-roman-numerals: true
      follows-number: true
    }
  }

  // ── NEW: Spring physics presets ───────────────────────────────────────
  spring-physics {
    provider: css            // css | framer | react-spring | native
    presets {
      snappy: { tension: 400, friction: 30, mass: 1.0 }
      gentle: { tension: 120, friction: 14, mass: 1.0 }
      bouncy: { tension: 180, friction: 12, mass: 1.0 }
    }
    default: snappy
    reduced-motion-fallback: { duration: 150ms, easing: ease }
  }

  // ── NEW: Motion orchestration sequences ──────────────────────────────
  motion-choreography {
    sequences {
      list-enter:  { type: stagger-enter, base: 0ms,  step: 50ms,  max: 12, easing: snappy }
      list-exit:   { type: stagger-exit,  base: 0ms,  step: 30ms,  max: 8,  easing: gentle }
      page-enter:  { type: stagger-enter, base: 80ms, step: 80ms,  max: 5,  easing: gentle }
    }
    scroll-driven {
      reveal: { timeline: view, range: "entry 0% entry 100%", inset: "0px 0px" }
    }
  }

  // ── NEW: Structural layout paradigm mappings ──────────────────────────
  structural-motif {
    // Global defaults — apply everywhere unless a scope overrides
    mappings {
      primary-navigation {
        desktop: PersistentSidebar   { width: 240px, collapsible: true }
        tablet:  CollapsibleSidebar  { width: 64px, expanded-width: 240px }
        mobile:  BottomTabBar        { items: 5 }
      }
      primary-action {
        desktop: inline
        mobile:  FloatingActionButton { position: bottom-right }
      }
      secondary-action {
        any: inline
      }
      contextual-action {
        any: PopoverMenu
      }
      data-display {
        desktop: DenseDataTable      { density: compact }
        mobile:  ComfortableListView
      }
    }

    // Per-scope overrides — inherit global mappings for any intent not listed
    scopes {
      document-editor {
        primary-action {
          desktop: FloatingActionButton { position: bottom-right }
          mobile:  FloatingActionButton { position: bottom-right }
        }
        utility-bar {
          desktop: RibbonToolbar
          tablet:  RibbonToolbar       { compact: true }
        }
      }
      admin-panel {
        primary-navigation {
          desktop: RibbonToolbar
        }
        data-display {
          desktop: DenseDataTable      { density: compact, pagination: true }
          mobile:  DenseDataTable      { density: compact, columns: 3 }
        }
      }
    }
  }

  // ── NEW: High-level aesthetic philosophy ──────────────────────────────
  style-profile {
    surface:            elevated
    edge:               rounded
    color-philosophy:   analogous
    spatial:            balanced
    metaphor:           paper
    animation:          functional
    typography:         refined
    ornament:           minimal
    mood:               neutral
    convention:         conventional
    ai-prompt:          "clean professional photography, soft natural light, brand palette"
    illustration-style: "geometric flat, 2px stroke, limited palette, no gradients"
  }

  // ── NEW: Image filter presets ─────────────────────────────────────────
  image-filter {
    active: muted
    presets {
      muted:     { type: css-filter, filter: "grayscale(0.15) contrast(1.05)" }
      editorial: { type: duotone, shadow: oklch(0.15 0.02 265), highlight: oklch(0.95 0.01 265) }
      warm:      { type: css-filter, filter: "sepia(0.2) saturate(1.1)" }
    }
  }

  // ── NEW: Theme scope zones ────────────────────────────────────────────
  scope {
    zones {
      admin-panel {
        selector: "[data-zone='admin']"
        tokens {
          color.surface: [neutral, step: 12]
          color.primary: [brand, step: 70]
        }
      }
    }
  }

  // ── NEW: Accessibility constraints ────────────────────────────────────
  constraint {
    rules {
      text-contrast:  { type: contrast,     paths: ["color.on-*"],            min-ratio: 4.5, severity: error }
      large-contrast: { type: contrast,     paths: ["color.on-surface-variant"], min-ratio: 3.0, severity: error }
      touch-target:   { type: touch-target, paths: ["spacing.touch-*"],       min-size: 44,   severity: error }
    }
  }

  // ── NEW: User/system preference resolution ────────────────────────────
  preference {
    priority: [accessibility-override, user-explicit, system-os, brand-default]
    defaults {
      color-scheme:   light
      density:        comfortable
      reduced-motion: no-preference
      contrast:       no-preference
    }
  }
}
```

---

## 7. ThemeParser and ThemeGen Changes

### 7.1 ThemeParser — New Block Parsers

ThemeParser's `parse` action gains 16 new completion variants alongside the existing ones.
Each new variant triggers one of the generation pipeline syncs.

```
parse(source: String, block: String) ->
  ok_color_space(config: ColorSpaceConfig)
  ok_color_scheme(modes: SchemeModesConfig)
  ok_density(config: DensityConfig)
  ok_shape(config: ShapeConfig)
  ok_iconography(config: IconographyConfig)
  ok_material(config: MaterialConfig)
  ok_type_scale(config: TypeScaleConfig)
  ok_font_metrics(config: FontMetricsConfig)
  ok_spring_physics(presets: SpringPresetsConfig)
  ok_motion_choreography(sequences: ChoreographyConfig)
  ok_structural_motif(mappings: MotifMappingsConfig)
  ok_style_profile(profile: StyleProfileConfig)
  ok_image_filter(presets: ImageFilterConfig)
  ok_scope(zones: ScopeZonesConfig)
  ok_constraint(rules: ConstraintRulesConfig)
  ok_preference(config: PreferenceConfig)
```

Validation rules to add to ThemeParser:

- `color-space`: algorithm name must be in the known set; seed values must parse as valid CSS colors
- `type-scale`: ratios must be in range 1.0–2.0; viewport bounds must be positive integers
- `spring-physics`: tension must be > 0; friction must be > 0
- `structural-motif`: intent names validated against the registered standard set plus any custom intents declared in the theme; paradigm names validated against registered providers at parse time — unknown paradigm names produce a warning (not an error) to allow themes to be written before all providers are installed
- `constraint`: rule types must be in the known set; min-ratio must be ≥ 1.0 for contrast rules
- `font-metrics`: OpenType feature tags must be valid 4-character codes

### 7.2 ThemeGen — New Generation Passes

ThemeGen gains a generation pass for each new block, across all existing output targets (CSS, Tailwind, React Native StyleSheet, terminal ANSI, DTCG JSON). Web CSS specifics are noted below; React Native StyleSheet and other targets consume the same abstract values and translate them using their existing generation logic.

**ColorSpace + ColorScheme (web CSS):**
- `@property` declarations for each color role (typed, inheritable, animatable)
- `:root` rule for light mode values
- `:root[data-mode="dark"]` rule for dark mode values
- `@media (prefers-color-scheme: dark)` block for OS-level dark mode
- `@media (forced-colors: active)` block mapping roles to CSS System Colors

**TypeScale:**
- One CSS custom property per step (`--type-base`, `--type-lg`, etc.) using the clamp formula
- All derived spacing values (`--space-md`, `--space-lg`, etc.) as fluid clamps from the base

**FontMetrics:**
- `--font-features-{context}` custom properties as `font-feature-settings` strings
- `--font-variation-{context}` custom properties as `font-variation-settings` strings
- `--drop-cap-lines` and `--drop-cap-accent-probability` custom properties

**MaterialSurface:**
- `--elevation-{level}` custom properties with procedurally computed box-shadow values
- Neumorphic: dual-shadow values derived from the physics parameters, not hardcoded
- Glassmorphism: `--backdrop-{component}` values with blur and border-glare

**Shape:**
- `--radius-{name}` custom properties from the scale
- Element override properties: `--radius-button`, `--radius-card`, `--radius-dialog`, etc.
- For squircle: `clip-path` SVG data URIs at common element dimensions

**SpringPhysics:**
- `--spring-{name}` custom properties using the `linear()` function
- `--duration-spring-{name}` custom properties with computed settlement duration
- `@media (prefers-reduced-motion: reduce)` block overriding all spring properties to `ease` + 150ms

**Density:**
- `[data-density="compact"]` and `[data-density="spacious"]` rules for `--density-multiplier`
- Spacing token redeclarations using `calc(base * var(--density-multiplier))`

**Scope:**
- One `@scope (selector)` block per named zone
- `:scope` rule inside each block with the zone's token overrides

**Constraint:**
- `@layer` declaration ensuring constraint-overrides is always topmost

**StructuralMotif:**
- `--motif-{intent}` custom properties with the active paradigm name string
- `@media` blocks for viewport-specific paradigm values

### 7.3 DTCG JSON Extension

ThemeGen also emits a DTCG-format JSON file extended with new token types:

- Type `spring`: `{$type: "spring", $value: {tension, friction, mass}}`
- Type `fluid-size`: `{$type: "fluid-size", $value: {clamp, min, max}}`
- Type `structural-motif`: `{$type: "structural-motif", $value: {mobile, desktop, tablet}}`
- Type `image-filter`: `{$type: "image-filter", $value: {type, ...params}}`

---

## 8. WidgetResolver Updates

WidgetResolver's `resolve` action gains two new context inputs:

**New context fields:**
- `density: String` — "compact" | "comfortable" | "spacious"
- `motif: option String` — active paradigm name for the current zone

**Scoring additions:**
- For density-exempt interactor types: the `density` context is overridden to "comfortable" during candidate scoring
- Widgets can declare `motif-optimized: RibbonToolbar` in their affordance block; this adds specificity points when that motif is active

**Affordance block additions:**
```
affordance {
  serves: single-choice;
  specificity: 10;
  when: optionCount <= 8;
  density-exempt: false;         // NEW: if true, always renders at comfortable density
  motif-optimized: null;         // NEW: if set, scores higher when this motif is active
}
```

---

## 9. Suite Structure and File Organization

```
suites/
  ui-theme/
    suite.yaml
    core/
      ColorSpace.concept
      ColorScheme.concept
      Constraint.concept
      Preference.concept
      Scope.concept
    visual/
      TypeScale.concept
      FontMetrics.concept
      Shape.concept
      Iconography.concept
      Density.concept
      MaterialSurface.concept
      StyleProfile.concept
    motion/
      SpringPhysics.concept
      MotionChoreography.concept
    structural/
      StructuralMotifProvider.concept  // base contract
      StructuralMotif.concept
    asset/
      ImageFilter.concept
    providers/
      color-space/
        OKLCHProvider.concept
        HCTProvider.concept
        P3Provider.concept
        SRGBProvider.concept
      material/
        SVGMaterialProvider.concept
        WebGLMaterialProvider.concept
      spring/
        FramerSpringProvider.concept
        ReactSpringProvider.concept
        NativeSpringProvider.concept
      motif/
        RepertoireMotifProvider.concept
        RibbonProvider.concept
        CommandPaletteProvider.concept
      image-filter/
        SVGFilterProvider.concept
        AIFilterProvider.concept
        ShaderFilterProvider.concept
        CanvasFilterProvider.concept
      style-profile/
        StyleProfileRuleBasedProvider.concept
        StyleProfileAIProvider.concept
        StyleProfileStaticProvider.concept
        StyleProfileDesignToolProvider.concept
    derived/
      ExpressionTheme.derived
      ThemeKit.derived
    syncs/
      // 24 runtime syncs
      SeedColorDerivesPalette.sync
      SchemeActivatesTokens.sync
      ConstraintValidatesToken.sync
      ConstraintOverridesOnViolation.sync
      PreferenceNegotiatesTheme.sync
      PreferenceSetsDensity.sync
      PreferenceSetsReducedMotion.sync
      DensityAppliesMultiplier.sync
      DensityContextUpdatesWidgetResolver.sync
      StructuralMotifResolvesLayout.sync
      MotifContextUpdatesWidgetResolver.sync
      TypeScaleGeneratesTypographyTokens.sync
      FontMetricsActivatesOpenType.sync
      ShapeResolvesRadius.sync
      IconographyConfiguresAxes.sync
      MaterialSurfaceComputesShadow.sync
      MaterialSurfaceComputesBackdrop.sync
      StyleProfileConfiguresAll.sync
      StyleProfileConfiguresDensity.sync
      StyleProfileConfiguresMotion.sync
      SpringPhysicsResolvesMotionToken.sync
      ChoreographyOrchestrates.sync
      ScopeResolvesTokenBoundary.sync
      ImageFilterAppliesStyle.sync
      StyleProfileAIDecodesFromCompletion.sync
      ImageFilterAIGeneratesFromCompletion.sync
      // 16 build-time syncs
      ParsedColorSpaceRegistered.sync
      ParsedColorSchemeRegistered.sync
      ParsedDensityRegistered.sync
      ParsedShapeRegistered.sync
      ParsedIconographyRegistered.sync
      ParsedMaterialSurfaceRegistered.sync
      ParsedTypeScaleRegistered.sync
      ParsedFontMetricsRegistered.sync
      ParsedSpringPhysicsRegistered.sync
      ParsedMotionChoreographyRegistered.sync
      ParsedStructuralMotifRegistered.sync
      ParsedStyleProfileRegistered.sync
      ParsedImageFilterRegistered.sync
      ParsedScopeRegistered.sync
      ParsedConstraintRegistered.sync
      ParsedPreferenceRegistered.sync
    implementations/
      typescript/
        src/concepts/...   // 16 concept handlers
        src/providers/...  // provider handlers
        // ThemeGen generation passes are TypeScript handlers wired via the
        // Clef generation suite — not standalone scripts. ThemeParser and
        // ThemeGen concept handlers live here, invoked by the sync engine
        // like any other concept handler.
      nextjs/
        src/concepts/...   // fp-ts functional TypeScript handlers
        // Reuses TypeScript concept handlers with fp-ts discipline
        // (no mutation, Either/TaskEither for all IO). Server-side
        // ThemeGen pass runs at build time via Next.js build pipeline.
      rust/
        src/concepts/...   // Rust handlers for compute-intensive passes
        // ColorSpace OKLCH arithmetic, SpringPhysics ODE stepping, and
        // Constraint validation. Compiles to WASM for browser-side use.
```

**suite.yaml:**
```yaml
name: ui-theme
version: 1.0.0
description: >
  Advanced expressive theming for Clef Surface. Replaces flat token maps with a
  10-axis design space, algorithmic color derivation, constraint-first accessibility,
  physics-based motion, and structural topology as theme concerns.
concepts:
  core:       [ColorSpace, ColorScheme, Constraint, Preference, Scope]
  visual:     [TypeScale, FontMetrics, Shape, Iconography, Density, MaterialSurface, StyleProfile]
  motion:     [SpringPhysics, MotionChoreography]
  structural: [StructuralMotifProvider, StructuralMotif]
  asset:      [ImageFilter]
providers:
  color-space:   [OKLCHProvider, HCTProvider, P3Provider, SRGBProvider]
  material:      [SVGMaterialProvider, WebGLMaterialProvider]
  spring:        [FramerSpringProvider, ReactSpringProvider, NativeSpringProvider]
  motif:         [RepertoireMotifProvider, RibbonProvider, CommandPaletteProvider]
  image-filter:  [SVGFilterProvider, AIFilterProvider, ShaderFilterProvider, CanvasFilterProvider]
  style-profile: [StyleProfileRuleBasedProvider, StyleProfileAIProvider, StyleProfileStaticProvider, StyleProfileDesignToolProvider]
derived: [ExpressionTheme, ThemeKit]
syncs: 42
implementations: [typescript, nextjs, rust]
uses: [ui-core, ui-component, ui-render]
```

---

## 10. Implementation Notes per Language

Generation in this kit flows through Clef's own generation suite — ThemeParser and ThemeGen are Clef concepts whose handlers live in the implementation targets below. There is no external build script or standalone pipeline. The sync engine invokes ThemeParser/ThemeGen handlers exactly as it does any other concept handler. Each new ThemeGen generation pass (one per new theme block) is an additional handler method in the TypeScript or Rust implementation, not a new file type.

Solidity has no applicable surface in this kit — theming is UI-layer work with no blockchain state.

### TypeScript (primary web handler target)

- All 16 concept handlers and all provider handlers have TypeScript implementations
- Primary color math dependency: `culori` (MIT, tree-shakeable) for OKLCH palette derivation; HCT uses `@material/material-color-utilities`
- ThemeGen TypeScript handlers implement all new generation passes: one method per new `.theme` block, extending the existing ThemeGen handler class
- ThemeParser TypeScript handler adds 12 new block parsers to the existing parser, following the existing `ParsedXRegistered` sync pattern
- SpringPhysics ODE stepping (`spring_to_css_linear`) is pure arithmetic — no DOM, no canvas access needed at build time
- MaterialSurface shadow computation is pure arithmetic; no rendering primitives required
- StructuralMotif providers are lazy-loaded via the Clef provider registration pattern; the coordination concept emits `--motif-*` CSS hints that FrameworkAdapter reads to mount the correct component

### Next.js / fp-ts (functional TypeScript target)

- Reuses all TypeScript concept handlers with fp-ts discipline: no mutation, all IO wrapped in `TaskEither`, errors surfaced as typed `Either` values rather than thrown exceptions
- ThemeGen's Next.js handler runs at build time within Next.js's build pipeline via `getStaticProps` or a custom webpack plugin — the same concept handler, invoked at the right build moment
- Server-side rendering concerns: CSS custom property output must be inlined into `<style>` tags in `_document.tsx` to avoid FOUC; the ThemeGen handler exposes a `getInlineCSS()` action for this purpose
- Color scheme preference negotiation (`Preference/negotiate`) uses `prefers-color-scheme` media query server-side detection via request headers where available

### Rust (compute-intensive handler target)

- Implements the three computationally heavy concept handlers: ColorSpace (OKLCH/HCT arithmetic), SpringPhysics (ODE stepping at 10ms intervals using semi-implicit Euler integration), Constraint (batch WCAG contrast validation across full palette)
- Compiles to WASM via `wasm-pack` for browser-side use (live theme preview in ConceptBrowser); the same Rust handler binary serves both native CLI and WASM targets via conditional compilation
- ColorSpace: pure arithmetic structs (`OklchColor`, `HctColor`) with no external color library dependency — the conversion math is self-contained and auditable
- SpringPhysics: `spring_to_css_linear()` steps the ODE until settlement (amplitude < 0.001), returns a `String` CSS `linear()` value; deterministic given the same tension/friction/mass inputs
- Constraint validation: parallel batch evaluation across all palette combinations using `rayon`; halts ThemeGen with a structured error report if severity=`"error"` violations exist
- MaterialSurface SVG filter matrix computation (duotone feColorMatrix from two OKLCH colors) also lives in Rust for precision

---

## 11. Rollout Phases

| Phase | Duration | Deliverable | Concepts |
|---|---|---|---|
| **1 — Core derivation** | Weeks 1–4 | Color system is algorithmically sound; constraints enforce accessibility at registration time | ColorSpace + OKLCHProvider, ColorScheme, Constraint, Preference, Scope |
| **2 — Visual philosophy** | Weeks 5–9 | Full 10-axis design space addressable; StyleProfile cascades to all downstream concepts | TypeScale, FontMetrics, Shape, Iconography, Density, MaterialSurface, StyleProfile |
| **3 — Motion + structure** | Weeks 10–13 | Physics-based motion and structural topology as theme choices; scope-aware motif resolution; open paradigm plugin story | SpringPhysics (all providers), MotionChoreography, StructuralMotifProvider base concept, StructuralMotif, RepertoireMotifProvider (all built-in paradigms), RibbonProvider, CommandPaletteProvider || **4 — Assets + remaining providers** | Weeks 14–16 | All provider families complete; AI asset generation pipeline wired | ImageFilter (3 providers), HCTProvider, P3Provider, WebGL + SVG MaterialSurface providers |
| **5 — Parser/Gen/Integration** | Weeks 17–20 | Full pipeline from `.theme` file to CSS output; WidgetResolver updated; syncs wired | ThemeParser 16 new variants, ThemeGen CSS generation, WidgetResolver changes, all 40 syncs |

**Validation themes** — five `.theme` files as end-to-end integration tests:

| Theme | Key axes | Primary test |
|---|---|---|
| `minimal.theme` | flat, sharp, monochromatic, dense, no motion, strict | Verifies sparse block parsing produces correct defaults |
| `editorial.theme` | elevated, squircle, drop caps, expressive motion, refined typography | Verifies FontMetrics OpenType cascade and SpringPhysics choreography |
| `brutalist.theme` | flat, sharp, chaotic color, no ornament, no motion, subversive | Verifies StyleProfile axis conflicts are resolved coherently |
| `neumorphic.theme` | neumorphic material, rounded, muted warm, gentle motion | Verifies MaterialSurface procedural shadow math |
| `retro-web.theme` | flat, serif fonts, blink-polyfill motion, maximal ornament, subversive | Verifies MotionChoreography blink sequence and FontMetrics smallcaps rules |

Each validation theme must produce: distinct CSS custom property output, distinct WidgetResolver context state, and distinct StyleProfile AI prompts — demonstrating the system spans the full expressive design space.
