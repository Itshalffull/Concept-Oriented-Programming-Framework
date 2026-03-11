# The state of the art in theming and design language systems

**The most significant shift in theming architecture over the past three years is the move from static token dictionaries to algorithmic derivation systems** — where minimal seed values generate entire theme surfaces through composable algorithms, perceptually uniform color spaces, and constraint-solving that bakes accessibility in at the mathematical level. This changes the fundamental abstraction: a theme is no longer a flat map of key-value pairs but a derivation graph with algebraic relationships between concepts. For a concept-oriented programming framework, this means the existing Theme, Palette, Typography, Elevation, Motion, and DesignToken concepts need at least six additional independent concepts (Spacing, Shape, Density, Iconography, ColorSpace, and Scope), and several existing concepts need decomposition into sub-concepts that capture algorithmic relationships rather than just stored values.

---

## How major systems decompose theming into orthogonal concepts

The most architecturally sophisticated systems — Material Design 3, Ant Design 5, and Fluent 2 — converge on a shared insight: **theming is not one concept but a composition of 7–10 independent concern axes**. Material Design 3 decomposes into Color (via HCT color space), Typography (15 styles across 5 roles × 3 sizes), Shape (corner radius scale), Motion (physics-based spring system), Elevation (tonal surface model), and Density (4-step scale from 0 to -3). Ant Design 5 adds a crucial architectural innovation: **composable algorithm functions** that transform seed tokens into derived tokens. Its `darkAlgorithm` and `compactAlgorithm` can be composed — `algorithm: [darkAlgorithm, compactAlgorithm]` — producing a dark-compact theme from orthogonal transformations. Fluent 2 contributes a **three-tier token architecture** (Global → Alias → Control) with 16-shade brand ramps that algorithmically derive neutral colors, interaction states, and surface tones from a single brand color.

CMS platforms reveal a different axis of decomposition. WordPress's `theme.json` (now at version 3) implements a **four-layer cascade**: core defaults → block defaults → theme values → user customizations, each layer overriding the previous through deep JSON merging. This cascade generates CSS custom properties automatically (`--wp--preset--<TYPE>--<SLUG>`), creating a bridge between declarative configuration and runtime styling. Drupal's render array system takes a different approach — theming is decomposed into an addressable, alterable data structure (render arrays with `#`-prefixed properties) processed through a multi-phase preprocessing pipeline where modules and themes inject transformations at different stages. Django deliberately keeps theming minimal, relying on template inheritance (`{% extends %}` / `{% block %}`) as its sole structural abstraction — a reminder that the simplest decomposition may sometimes be the most appropriate.

Apple's Human Interface Guidelines stand apart by decomposing theming into **materials, vibrancy, and semantic colors** — concepts that don't map cleanly to token-based systems. Materials are visual effects creating depth between foreground and background (ranging from ultra-thin to ultra-thick). Vibrancy dynamically blends foreground content with what's behind a material surface — this is not opacity but a computed effect. The introduction of **Liquid Glass** in iOS 26 (2025) further demonstrates that some theming concepts are inherently procedural rather than declarative.

---

## The three-tier semantic token architecture is now industry standard

Every major design system has converged on a **primitive → semantic → component** token hierarchy, though implementations vary significantly. The first tier contains raw, context-free values (`blue-500: #3b82f6`). The second tier encodes intent (`color-primary: {blue-500}`). The third tier binds intent to specific component parts (`button-bg: {color-primary}`). Adobe Spectrum adds a fourth tier — **system tokens** — that bridge between components and themes, enabling Spectrum to support multiple visual languages (Spectrum 1, Express, Spectrum 2) with the same component code. The file structure per component splits into `index-base.css` (theme-independent structure) and `index-theme.css` (theme mapping layer).

The W3C Design Tokens Community Group released its **first stable specification (v2025.10)** on October 28, 2025 — a major milestone. The DTCG format uses JSON with `$value`, `$type`, and `$description` properties, supports 13 token types (including composite types like `typography`, `shadow`, `border`, `gradient`, `transition`), and introduces `$extends` for theming and multi-brand support. Aliasing uses `{token.path}` curly brace syntax. The specification explicitly targets cross-platform generation — one token file producing CSS custom properties, SCSS variables, Android XML resources, iOS Swift constants, and Dart ThemeData. **Style Dictionary v4** (Amazon) is the dominant transformation tool, now DTCG-native with an ES Modules architecture, preprocessors, transitive transforms, and a pipeline of Parse → Transform → Resolve → Format → Write.

Salesforce's evolution is instructive: SLDS 2 (2025) replaces design tokens with **"global styling hooks"** — CSS custom properties that separate structure from visual design. Adobe Spectrum's team discovered that developers routinely bypass semantic naming — finding a token that equals "2 pixels" and using it regardless of intent — leading them to explore ESLint-style linting rules and a future concept of **"anonymous tokens"** where structural semantic information moves into metadata rather than names.

---

## Algorithmic derivation replaces static token maps

The most important paradigm shift is **algorithmic theming** — computing theme values from minimal seeds through mathematical relationships rather than hand-specifying every token.

**Material Design 3's HCT color system** is the most sophisticated implementation. From a single seed color, the system generates 5 tonal palettes × 13 tonal steps = **65 color attributes**. The HCT (Hue, Chroma, Tone) color space was purpose-built: Tone maps directly to perceived luminance, meaning a tone difference of ≥40 mathematically guarantees WCAG 3:1 contrast, and ≥50 guarantees 4.5:1. Light and dark schemes are generated by swapping tone assignments (primary in light = tone 40, in dark = tone 80). The system supports multiple scheme variants — TonalSpot (pastel), Fidelity (matches seed), Expressive (shifted hues), Monochrome, Neutral, Vibrant — and configurable contrast levels from -1.0 to 1.0. Color harmonization subtly shifts the hue of fixed semantic colors (like error red) to blend with the dynamic scheme while retaining their meaning.

**OKLCH** has emerged as the preferred color space for CSS-native theming. Unlike HSL, where same-lightness values appear wildly different in perceived brightness across hues, OKLCH is perceptually uniform — equal numerical changes produce equal visual changes. A single `--brand-hue` CSS custom property can generate an entire color system by varying only the L (lightness) channel while keeping C (chroma) and H (hue) constant. Dark mode becomes a simple L-value swap. Browser support reached ~93% by early 2026. Shadcn/ui migrated its entire color system from HSL to OKLCH. New CSS features amplify this: **`color-mix()`** blends colors in any color space natively, **relative color syntax** (`oklch(from var(--primary) calc(l + 0.2) c h)`) derives lighter/darker/shifted variants without JavaScript, and **`light-dark()`** eliminates media query blocks for every color declaration.

**Adobe Leonardo** takes a constraint-first approach: colors are generated starting from target contrast ratios (e.g., 4.5:1 for AA compliance) rather than picking hex values and auditing afterward. It uses CIE CAM02 for perceptually correct lightness ordering and can generate adaptive themes where the entire palette dynamically regenerates when users adjust brightness or contrast controls.

**Utopia.fyi** pioneered algorithmic fluid responsive design for typography and spacing. It defines a modular scale ratio at a minimum viewport (e.g., 1.2× at 320px) and a different ratio at maximum (e.g., 1.333× at 1500px), generating CSS `clamp()` custom properties that interpolate between them — no breakpoints needed. Space pairs (e.g., S→L) provide dramatic responsive adaptation where spacing is small on mobile and large on desktop in a single fluid value. The key insight: **typography scale can derive spacing scale**, using the type scale's base unit (Step 0) with T-shirt-size multipliers.

---

## Specialized domain concepts that deserve independent decomposition

### Spacing as an independent concept

Spacing is conspicuously absent from the user's existing concept set and is universally treated as a first-class theming concern. The **8pt grid** is the foundation of most modern systems — all values are multiples of 8px with 4px half-steps for fine adjustments. Spacing progressions can be linear (4, 8, 12, 16...), geometric (matching type scale ratios), or Fibonacci-approximate. Utopia's fluid spacing uses `clamp()` with `rem + vw` mixing, and space pairs allow a single token to express "small on mobile, large on desktop." Container-query variants use `cqi` units instead of `vw` for component-level fluid spacing.

### Shape/Radius as an independent concept

Material Design 3 treats shape as a separate concept axis with corner radius tokens from "None" to "Full." Radix Themes exposes a global `radius` configuration (none, small, medium, large, full). Mantine has `defaultRadius` as a theme-level setting. Shape deserves independence because it intersects with but is distinct from elevation, spacing, and component identity — a card's rounded corners serve a different semantic purpose than a button's.

### Density as a cross-cutting concern

**Density modes** (compact/comfortable/spacious) are a cross-cutting transformation that affects spacing, typography, iconography, and touch targets simultaneously. Material Design implements density as a scale from 0 to -3, where each step removes 4dp of component height but explicitly does NOT reduce horizontal spacing. Critical: **density exemptions exist per widget category** — date pickers, dialogs, and snackbars are excluded from densification. Ant Design implements density as a composable algorithm (`compactAlgorithm`) that can be combined with other algorithms. AWS Cloudscape excludes informational components, dropdowns, and data visualizations from compact mode. This suggests Density is a transformation concept that applies selectively to other concepts based on widget category.

### Iconography as an independent concept

Material Symbols implements icons as a **variable font with 4 adjustable axes**: Fill (0→1 for outline/filled state transitions), Weight (100–700 matching body text weight), Grade (-50 to 200 for emphasis without size change), and Optical Size (20–48dp with automatic stroke adjustment). The Grade axis is particularly important for theming: **-25 is recommended for light-on-dark backgrounds** to prevent visual bleed, while positive grades indicate emphasis. Icon weight should harmonize with text weight, and icons inherit `color` from parent elements via `currentColor`. This represents a rich independent concept with multiple axes that intersect with Typography (weight matching), Palette (color inheritance), and Elevation (grade compensation for dark surfaces).

### Layout and responsiveness

Container queries have fundamentally changed layout theming by making components responsive to their container rather than the viewport. **CSS style queries** (`@container style(--theme: dark)`) enable token-driven component theming without extra CSS classes. CSS subgrid allows children to inherit parent grid tracks, eliminating nested grid synchronization. Reading-width optimization uses `ch`-based max-widths (`max-width: 65ch`) tied to the current font's character width. Material Design's canonical layouts (List-Detail, Feed, Supporting Pane) define how layout adapts at window-size-class boundaries.

### Motion as physics-based parameters

The user already has a Motion concept, but the state of the art has moved beyond duration/easing to **spring physics parameters**. Framer Motion uses `stiffness`, `damping`, and `mass`; React Spring uses `tension`, `friction`, and `mass`. Material Design 3 Expressive introduced spatial tokens (position/scale) versus effects tokens (color/opacity), each with fast/default/slow speeds. Motion tokens should compose as named presets: `{ "snappy": { tension: 400, friction: 30 }, "gentle": { tension: 120, friction: 14 } }`. The `prefers-reduced-motion` media query should map to a constraint that collapses all motion to essential opacity/fade transitions while removing parallax, springs, and complex choreography. Ant Design v5.23+ added per-component `prefers-reduced-motion` support and a global `motion: false` token.

---

## Context-awareness, constraints, and adaptive theming

### User preference negotiation

Modern theming must resolve conflicts between **four competing authorities**: user preferences (`prefers-color-scheme`, `prefers-reduced-motion`, `prefers-contrast`), system settings (OS dark mode), content requirements (WCAG contrast ratios), and brand guidelines. The practical resolution strategy uses layered override precedence: Brand tokens → Theme tokens → User preference tokens → Accessibility override tokens. CSS `@media (prefers-contrast: more)` should trigger higher contrast ratios (≥7:1). The `forced-colors: active` mode requires using CSS System Colors (ButtonFace, ButtonText) in pairs. A notable design issue: the CSS spec links `prefers-contrast` to `forced-colors`, breaking the "prefers-*" convention and making the `custom` value ambiguous.

### Constraint-based derivation

Leonardo's contrast-first approach points toward a powerful concept: **themes defined by constraints rather than values**. Instead of specifying `--text-color: #333`, you specify `--text-contrast: 4.5` relative to a background, and the system computes a compliant color. HCT's tone axis makes this trivially calculable. Readability constraints can similarly drive typography: optimal line length (45–75 characters, 66 ideal), line height ratios (body: 1.4–1.6×, headings: 1.1–1.3×), and minimum type sizes for different contexts.

### Theme scope and boundaries

Three scoping models coexist: global (CSS custom properties on `:root`), component-level (CSS Modules, Shadow DOM, StyleX atomic classes), and **zone-based** (nested React Context providers, CSS `@scope`). IBM Carbon's **contextual layering tokens** are a sophisticated zone-based approach: the same token automatically resolves to different values based on nesting depth, enabling reusable components that adapt their appearance per depth level without custom overrides. CSS `@scope` (shipping in Chrome, Firefox, and Safari) provides native DOM-subtree scoping with "donut scope" — applying styles within a range but excluding nested regions. This is a game-changer for micro-frontends with independent theming.

---

## Architecture patterns for composition, compilation, and multi-brand theming

### Theme composition and layering

The most powerful architectural pattern is **orthogonal theme composition** — combining independent theme fragments (color theme + typography theme + density mode + motion preferences) into a composite theme. Tokens Studio implements this as stackable token sets: `core` + `brand-A` + `dark-mode` + `compact-density`, with Style Dictionary performing deep merging. Ant Design's composable algorithms demonstrate the same principle functionally. CSS Cascade Layers (`@layer`) provide explicit cascade ordering independent of selector specificity: `@layer reset, tokens, base, components, utilities, overrides`. Miriam Suzanne (CSS WG) proposes a "SBRDFLT" pattern: spec → browser → reset → default → features → layout → theme.

### Multi-brand and white-label theming

Enterprise systems like Condé Nast's Verso (serving Vogue, The New Yorker, Wired), Volkswagen GroupUI (15+ brands), and Harry's Inc. (The Forge) use a token directory structure where **token names are universal but values change per brand**: `tokens/core/` (shared structural tokens) + `tokens/brand-a/` (brand overrides). Brad Frost documents a three-tier approach: `core` → `brand-theme` → `sub-brand`, each appendable/overridable. The DTCG spec's `$extends` property formalizes this pattern.

### Runtime versus build-time tradeoffs

The industry is converging on a **hybrid approach**: build tools (Sass, Style Dictionary, static extraction) handle immutable values (spacing calculations, typography composites) while CSS custom properties handle runtime-switchable values (colors, theme modes). Zero-runtime CSS-in-JS libraries — StyleX (Meta, used on Facebook/Instagram), Vanilla Extract, Panda CSS, and the upcoming Pigment CSS (MUI v6) — compile to atomic CSS at build time with CSS custom properties for dynamic values. Benchmarks show **6× performance improvement** over runtime CSS-in-JS for theme switching. This decoupling is critical: styling systems should separate the static structural layer from the dynamic theming layer.

### Theme versioning

Semantic versioning applied to tokens: Major (renamed/removed tokens), Minor (new tokens added), Patch (value adjustments). A critical best practice from Thoughtworks: **keep primitive tokens private** (not published to consumers). This makes palette changes non-breaking — only semantic and component tokens form the public API. IBM Carbon and Twilio Paste are cited as exemplary systems for migration management with three-phase breaking change handling: deprecation → migration (codemods) → removal.

---

## Emerging approaches reshaping theming architecture

**AI-assisted theming** is nascent but accelerating. Vercel's v0 generates production-ready components styled with shadcn/ui design tokens from natural language prompts. Its **Registry concept** passes component/token context to AI models via Model Context Protocol (MCP), keeping generations grounded in an existing design system. Pantone's AI palette generator (November 2025, built on Azure OpenAI with RAG) draws from color science research to answer prompts like "What colors evoke optimism in Gen Z?" Tools like Khroma, Huemint, and ColorMagic generate palettes from neural networks and text prompts.

**Figma Variables** (maturing since 2023) serve as native design tokens supporting color, number, string, and boolean types organized in collections with modes (light/dark, device sizes, brands). The ecosystem of Figma-to-code tools is rich: **Tokens Studio** (full-featured with Git sync), **Styleframe** (TypeScript-first with bidirectional sync), and multiple DTCG exporters. The trend is toward **code-first workflows** where tokens are defined in TypeScript/JSON and imported into Figma, not the reverse.

New CSS features are eliminating the need for JavaScript in theming: `light-dark()` provides per-color-scheme values in a single declaration; `@property` enables typed, inheritable, animatable custom properties; `@scope` creates component-level theming boundaries; and the **View Transitions API** (with scoped transitions shipping in Chrome 140) enables cinematic theme-switching animations — circular reveals, cross-fades between light and dark — with pure CSS and minimal JavaScript. The `@starting-style` rule ensures smooth entry animations during theme transitions.

---

## What's missing from the existing concept set and what to add

Based on this comprehensive survey, the existing ThemeSystem (Theme, Palette, Typography, Elevation, Motion, DesignToken) has several gaps and opportunities for deeper decomposition:

**New independent concepts needed:**

- **Spacing** — 8pt grid, fluid spatial scales, space pairs, the relationship between typography base size and spacing scale. This is universally treated as a primary theming axis but missing from the current set.
- **Shape** — Corner radius scales, border styles, and potentially clip paths. Material Design, Radix, and Mantine all treat this independently.
- **Density** — A cross-cutting transformation (compact/comfortable/spacious) that selectively modifies spacing, typography, iconography, and touch targets based on widget category. Not a simple scale but a category-aware algorithm.
- **Iconography** — Variable font axes (fill, weight, grade, optical size), sizing relative to type scale, color inheritance patterns, and dark-mode grade compensation.
- **ColorSpace** — The algorithmic infrastructure (OKLCH, HCT) for perceptually uniform color manipulation, palette generation from seeds, contrast guarantees, and gamut mapping. Distinct from Palette (which holds the derived values) — this is the *derivation engine*.
- **Scope** — Theme boundaries, nesting/layering, zone-based theming, and contextual token resolution (like Carbon's contextual layering). Captures where themes apply.

**Concepts that should be decomposed further:**

- **Palette → Palette + ColorSpace + ColorScheme**: Separate the raw palette values from the algorithmic derivation engine (ColorSpace) and the light/dark/high-contrast scheme mapping (ColorScheme). Material Design 3's architecture shows these are three distinct concerns.
- **Typography → TypeScale + FontMetrics + FluidType**: Decompose into the modular scale ratios (TypeScale), the font-specific metrics for baseline alignment and whitespace trimming (FontMetrics, per Capsize), and the fluid interpolation model (FluidType, per Utopia).
- **Motion → MotionTiming + SpringPhysics + MotionChoreography**: Separate duration/easing tokens (MotionTiming) from spring parameters (SpringPhysics: tension, friction, mass) and orchestration patterns (MotionChoreography: stagger, sequence, FLIP).
- **DesignToken → TokenPrimitive + TokenSemantic + TokenComponent**: The three-tier architecture should be reflected in the concept model. Each tier has different composition, override, and versioning rules.

**Advanced paradigmatic concepts to consider:**

- **Derivation** — An explicit concept for algorithmic token derivation from seeds, capturing the `(SeedToken) → MapToken` transformation pattern from Ant Design. Derivation functions are composable and category-aware.
- **Constraint** — Accessibility requirements (contrast ratios, touch targets, reduced motion) modeled as first-class constraints that participate in token resolution rather than being post-hoc audits. Leonardo's approach shows this is implementable.
- **Preference** — User and system preferences (`prefers-color-scheme`, `prefers-reduced-motion`, `prefers-contrast`, `forced-colors`) as a negotiation concept that interacts with theme resolution through a defined priority order.
- **Surface** — Apple's materials/vibrancy and Carbon's layering model suggest that surface treatment (transparency, blur, tonal elevation, translucency) is a concept independent from both color and elevation.
- **WidgetCategory** — The observation that density, motion, and certain theming rules apply differentially across widget categories (navigation, data display, feedback, input, overlay) suggests widget categorization as a concept that mediates between the theme system and component consumption.

The overarching insight is that the most advanced theming systems are moving from **declarative token maps** toward **generative derivation graphs** — where a minimal set of seed values and composable algorithms produce the full theme surface, with accessibility constraints participating in the derivation rather than being checked after the fact. A concept-oriented framework is uniquely positioned to model this: each concept (ColorSpace, Derivation, Constraint, Scope) has clear independent semantics, and their composition produces the emergent behavior of a complete, accessible, adaptive design system.