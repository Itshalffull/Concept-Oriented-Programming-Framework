# The missing concepts for truly expressive design theming

**Current design token systems capture barely half of what makes a visual design distinctive.** The W3C Design Tokens specification (stable since October 2025) defines 12 token types — color, dimension, font family, duration, cubic bézier, shadow, gradient, typography, border, transition, stroke style, and number — yet these represent only individual property values, not the design *concepts* that make a MySpace page feel different from an Apple product page. The gap is not in CSS capabilities but in the **conceptual vocabulary** theme formats use to describe design intent. After examining academic foundations, 12+ major design systems, CSS Zen Garden's radical transformations, turntrout.com's typographic obsessions, historical web eras, and emerging AI-driven tools, a clear picture emerges: an expressive theme system needs to formalize roughly **10 conceptual dimensions** that current tokens ignore entirely.

This matters for the Surface framework because CSS Zen Garden proved in 2003 that identical HTML can produce radically different designs through styling alone. The challenge is not whether such transformations are possible — it's whether a theme format can *describe* them declaratively rather than requiring bespoke CSS for each variation.

---

## Tokens describe points in design space, not the space itself

The fundamental limitation of current design token systems is architectural, not technical. Tokens formalize **individual property values** and their naming/aliasing relationships. They do not formalize the rules that generate those values, the constraints between them, the contexts in which they apply, or the aesthetic principles that make combinations work.

The W3C Design Tokens Community Group format (DTCG) released its first stable specification in October 2025, supporting a `$extends` mechanism for theming and modern CSS color spaces. But it has **no layout tokens**, no responsive/breakpoint tokens, no interaction state formalization, no animation sequences beyond single cubic-bézier curves, no conditional logic, no constraint relationships (like "contrast ratio ≥ 4.5:1"), and no mathematical operations. The specification explicitly leaves collections, modes, and themes as conventions rather than formal structures.

Style Dictionary, the dominant token transformation pipeline, processes tokens as flat key-value pairs. It can convert `color.primary` from hex to UIColor to CSS custom property, but it cannot generate a 10-step color scale from a base hue, enforce proportional spacing relationships, or validate that a token combination produces accessible contrast. **Tokens are points in a design space, but the space itself — its dimensions, boundaries, and generative rules — remains unformalized.**

Academic work on computational aesthetics offers theoretical foundations that token systems have not absorbed. Birkhoff's Aesthetic Measure (1933) formalized beauty as the ratio of order to complexity. Shape grammars (Stiny & Gips, 1972) provide rule-based production systems for generating visual compositions with parameters. Design Constraint Systems describe formal grammars that define a **design space** — the set of all valid designs within a style. None of this has reached practical design token tooling, where the industry remains focused on the far simpler problem of cross-platform value delivery.

André Torgal's influential 2025 critique "The Problem(s) with Design Tokens" crystallizes the gap: tokens lack design context (where/when/why a value applies), force context into naming (`...-on-primary` proliferation), cannot infer context, and are shaped by tool limitations (CSS variable ergonomics, Figma constraints) rather than design intent. As Torgal writes, "design tokens are only fit to represent design decisions in limited use cases, modeled around specific design tools."

---

## Ten axes that distinguish any visual design from any other

Analysis of CSS Zen Garden's 218+ radically different designs (all sharing identical HTML), combined with a systematic study of historical web design eras from Web 1.0 through modern 2025 refined aesthetics, reveals **10 fundamental conceptual axes** along which visual designs vary. Moving between eras, or between two Zen Garden themes like "Steel" (industrial, cold, geometric) and "Apothecary" (Victorian, warm, ornate), means shifting position on multiple axes simultaneously.

**Axis 1 — Surface treatment (depth simulation).** The spectrum runs from completely flat (iOS 7) through subtle elevation (Material Design), layered transparency (glassmorphism), soft extrusion (neumorphism), glossy reflections (Web 2.0), puffy 3D (claymorphism), to photorealistic material mimicry (skeuomorphism). Current tokens capture `box-shadow` values but not the *philosophy* of depth — whether surfaces are paper, glass, clay, or pure light.

**Axis 2 — Edge treatment.** Sharp and angular (brutalist), uniformly rounded (Material's 4dp corners), super-rounded pill shapes, organic blobs (CSS asymmetric border-radius like `30% 70% 70% 30% / 30% 30% 70% 70%`), or beveled edges. Material Design 3's "Expressive" update added **35 abstract shapes** to formalize this dimension, but most systems stop at a border-radius scale.

**Axis 3 — Color philosophy.** Not just palette values but the *approach*: monochromatic vs. rich, saturated vs. muted, warm vs. cool, algorithmic (Material You generates entire schemes from a single seed color extracted from the user's wallpaper) vs. hand-picked. Sub-dimensions include contrast philosophy, color count, and whether color serves structure (Flat Design) or emotion (Web 1.0's chaotic neon-on-black).

**Axis 4 — Spatial philosophy.** Dense vs. airy, strict mathematical grid vs. organic flowing layout, rigid boxes vs. borderless flow. Material Design formalizes density as a theme axis with a negative-number scale (-1, -2, -3 reducing component height by 4px per step). Gmail's compact/comfortable/default toggle proves this is a user-facing preference, not just a developer concern.

**Axis 5 — Physical metaphor.** No metaphor (Flat Design, true to digital medium), abstract material (Material Design's paper-and-ink), specific material (glassmorphism's frosted glass, neumorphism's soft clay), or literal object mimicry (skeuomorphism's leather-bound calendars). This axis determines whether a `box-shadow` represents elevation, surface curvature, ambient occlusion, or mere decoration.

**Axis 6 — Animation philosophy.** From none (brutalist) through functional-only transitions (Flat Design), purposeful physics-based motion (Material Design), scroll-driven storytelling (modern 2025), to animation-as-the-entire-experience (Flash era). IBM Carbon's productive/expressive motion distinction is the most sophisticated tokenized approach: productive curves are fast and minimal, expressive curves are dramatic and attention-grabbing.

**Axis 7 — Typographic philosophy.** System/monospace functional (brutalist), clean neutral hierarchy (Flat/Material), metaphor-matching (skeuomorphism's typewriter fonts on notepad UIs), or typography-as-primary-design-element (modern oversized custom type). turntrout.com demonstrates an extreme position where typography involves automated micro-transformations — smart quotes, context-dependent smallcaps, oldstyle numerals — that no token system addresses.

**Axis 8 — Ornament philosophy.** Anti-ornament (brutalist, where decoration equals dishonesty), near-zero (Flat Design), restrained (Material's motion-and-color-as-ornament), moderate (Web 2.0's gradients and reflections), rich decorative detail (skeuomorphism), or maximalist chaos (Web 1.0's animated GIFs and clip-art). This axis governs dividers, decorative elements, background patterns, and visual "extras."

**Axis 9 — Emotional register.** Cold/clinical, neutral/professional, warm/inviting, playful/whimsical, or raw/confrontational. This is the *mood* dimension — whether a design feels like a bank (neutral), a toy store (playful), or a punk zine (confrontational).

**Axis 10 — Relationship to convention.** Rule-following (Material's strict guidelines), rule-evolving (modern refined), rule-indifferent (Web 1.0, pre-convention), or rule-breaking (brutalist, anti-design). This meta-dimension determines whether the theme *subverts* the very patterns the component system provides.

---

## What the most expressive systems actually formalize

Material Design 3 comes closest to a comprehensive theme model, with a 4-tier token hierarchy (reference → system → component → dynamic), **141 system-level color tokens** with roles (primary, secondary, tertiary, error, surface, outline), a 7-step shape scale, physics-based spring motion tokens (tension, friction, mass), and the crown jewel: **dynamic color generation** from a single wallpaper-extracted seed. The recent M3 Expressive update pushed further, adding 35 abstract shapes, fluid/fixed heading classifications, and spring dynamics. Yet Material still lacks spacing tokens (under development), texture concepts, image treatment, or any notion of ornament.

Apple's Human Interface Guidelines formalize concepts no other system touches — **vibrancy** (translucent materials with real-time backdrop blending at multiple thickness levels), haptic feedback integration, and spatial computing depth for visionOS — but these are embedded in platform APIs rather than externalized as portable tokens. Apple's SF Pro font dynamically adjusts tracking based on size, an intelligence baked into the typeface rather than the token system.

Atlassian's design system contributes a uniquely sophisticated **elevation model**: four semantic levels (sunken, default, raised, overlay) with paired surface colors and shadows, plus hover/pressed states per elevation and a remarkable `utility.elevation.surface.current` token that tracks contextual surface identity. IBM Carbon adds **layering tokens** (`$layer-01`, `$layer-02`, `$layer-03`) that cycle through container colors as components nest, solving the "context leakage" problem Torgal identified.

Open Props provides the broadest raw token coverage — colors, sizes, shadows, **20+ named easing curves**, keyframe animations, gradients, masks, conditional media query properties (`--motionOK`, `--OSdark`), and fluid `clamp()` sizing — but with zero semantic layer. Figma's variable system contributes the crucial **mode** concept: a single token holding different values across unlimited contexts (light/dark, brand, density, locale), switchable at any hierarchy level with cascade inheritance.

WordPress's `theme.json` uniquely enables radical visual transformation by non-developers through Global Styles UI. Its `custom` property is an open escape hatch for arbitrary tokens, and its built-in **duotone filter** support for images demonstrates image-treatment-as-theme-concept. But it lacks motion, elevation, or interaction state tokens entirely.

The comparative picture is stark: **no existing system formalizes all ten axes.** Material covers depth/surface, shape, motion, and color philosophy. Apple covers materials and haptics. Open Props covers raw value breadth. Figma covers multi-mode context. Each captures fragments. The full design space remains unmapped.

---

## Typography as transformation pipeline, not property list

The turntrout.com case study reveals a design paradigm that current token systems cannot express at all. Alex Turner's personal site, described by Gwern as "the best new personal website I've seen in a while: ★★★★☆," treats typography not as a set of CSS properties but as a **build-time transformation pipeline** applied to content.

Turner's open-source `punctilio` library (1,100+ tests, 100% branch coverage) automatically converts ASCII text into typographically correct Unicode: straight quotes become curly quotes, `--` becomes em dashes, `-5` becomes `−5` (mathematical minus), `...` becomes `…`, `!=` becomes `≠`, `1/2` becomes `½`, and `->` becomes `→`. The library handles the notoriously difficult cross-DOM-boundary problem using "separation boundaries" with private-use Unicode characters, maintaining context across HTML element nodes. It scores **97% on 159 benchmark cases** versus 43% for the industry-standard `smartypants`.

Beyond punctuation, the site applies **context-dependent smallcaps**: regex detects 3+ consecutive capitals (excluding Roman numerals), lowercases them, and applies `font-variant-caps: small-caps` — so "NAFTA" renders with properly designed smallcap glyphs rather than full-size capitals "screaming" on the page. Letters following numbers (like "100GB") also receive smallcaps treatment. Clipboard events are intercepted so copying smallcapped text returns correct uppercase. Oldstyle numerals appear in body text while lining numerals appear in headers. Turner paid $121 for custom OpenType feature additions to EB Garamond to achieve slashed zeroes and italic oldstyle figures.

The site's two-layer dropcap system splits letters into character and embellishment layers via CSS `::before`, enabling bicolor illuminated capitals — with a **7% random chance** of accent-colored dropcaps per page navigation, a "delightful randomness" concept no deterministic token system can express.

This demonstrates a class of design concepts that are **algorithmic and contextual**: they depend on content analysis, not static property assignment. Non-breaking spaces prevent orphaned prepositions. Build-time color normalization converts all raw CSS colors in legacy content to the site's themed palette. Exponential font sizing (`1.2^n` for header levels) and single-base-margin spacing (all spacing as multiples of one variable) create mathematical harmony rather than arbitrary pixel values. These are **design rules and transformations**, not design tokens.

---

## Seven missing token categories no system covers

Synthesizing across all research streams, seven major categories of design concepts are absent from every major token system examined.

**Advanced typography tokens.** Beyond font-family/size/weight, truly expressive typography requires: OpenType feature sets per context (`liga`, `onum`, `smcp`, `ss01`–`ss20`, `swsh`), variable font axis values (weight, width, slant, optical size, grade — where grade adjusts perceived weight without layout shift, crucial for dark mode), modular scale ratios (golden 1.618, major third 1.25, perfect fourth 1.333), baseline grid units, hanging punctuation, drop cap sizing, text-rendering mode, antialiasing approach, underline offset/thickness, and hyphenation parameters. Material Design's 15-style type scale is sophisticated but ignores all of these micro-typographic dimensions.

**Motion and choreography tokens.** Current systems offer at most duration and a single easing curve. An expressive system needs: easing curve *philosophy* (productive vs. expressive, per Carbon's model), spring physics parameters (tension, friction, mass for React Spring/Framer Motion), stagger delay patterns for sequential element animation, entrance/exit choreography ordering, scroll-driven animation parameters (timeline type, animation range, view inset thresholds), parallax speed ratios per layer, and `prefers-reduced-motion` alternative specifications. CSS scroll-driven animations (Chrome 115+, Safari 26+) introduce new tokenizable parameters that no design system has yet formalized.

**Surface treatment and texture tokens.** Glassmorphism requires tokenizing backdrop blur radius, surface translucency, frosted-edge border opacity, and saturation boost. Neumorphism needs dual light/dark shadow definitions relative to the parent background. Noise/grain overlays need intensity (opacity 0.03–0.15), SVG `feTurbulence` frequency, noise type (turbulence vs. fractalNoise), and blend mode. Gradient tokens need type (linear/radial/conic/mesh), angle, stop arrays, and style (smooth vs. stepped). None of these have standardized token representations.

**Image treatment tokens.** CSS filter presets (grayscale, sepia, hue-rotate, contrast chains), duotone color pairs (shadow color + highlight color mapped via SVG `feColorMatrix`), blend mode specifications (`mix-blend-mode`, `background-blend-mode`), SVG filter chains (displacement maps, turbulence, convolution matrices), and mask/clip-path definitions. WordPress's `theme.json` includes duotone as a first-class concept — the only major system to do so.

**Icon theming tokens.** Phosphor Icons offers 6 style variants (thin, light, regular, bold, fill, duotone). Material Symbols exposes continuous variable font axes: fill (0–1), weight (100–700), grade (-50–200), optical size (20–48), and the new roundness axis (0–100). An expressive icon theme needs: style variant selection, stroke width, corner treatment, optical size adaptation, fill behavior on interaction states, and dual-color mapping for duotone rendering. No design system tokenizes these as theme-level choices.

**Illustration style tokens.** Perspective type (flat, isometric, 2.5D, full 3D), line weight and style (geometric vs. hand-drawn vs. sketchy), detail level (abstract to photorealistic), texture application (clean, grainy, halftone, watercolor), shadow approach within illustrations, and character style. These are inherently qualitative and resist numeric tokenization, but can be formalized as enumerated style parameters that guide both human illustrators and AI generation.

**Shadow philosophy tokens.** Josh Comeau's layered shadow approach (3–5 shadows per elevation with different offsets, blur radii, and opacities), colored shadows (matching surface hue rather than pure black), consistent light source angle across all components, inset/bevel tokens (Shopify Polaris formalizes elevation, inset, and bevel as separate shadow categories), and dark mode shadow adaptation (higher elevation = lighter surface tint in Material's model). The *philosophy* of shadows — whether they represent physical elevation, ambient occlusion, or mere visual separation — is a theme-level concept.

---

## Structural choices belong in themes, with caveats

The research reveals strong evidence that component layout patterns — navigation type, action placement, information density — can and should be parameterizable as theme concepts, but with clear boundaries.

CSS Zen Garden proved definitively in 2003 that layout restructuring through styling alone is possible. Material Design already treats density as a theme axis alongside color, typography, and shape. Theme-UI's `variant` prop explicitly supports layout variants within theme objects. SAP Fiori parameterizes "cozy" vs. "compact" modes. Salesforce Lightning's compact view achieves **30% density increase** through token-driven spacing changes.

Navigation pattern selection (sidebar, top bar, bottom tab, hamburger, command palette) reflects a design philosophy about information architecture and user workflow. Material Design describes these as context-dependent patterns. The *choice* between them could be encoded as a structural theme parameter — "this brand uses sidebar navigation for desktop and bottom tabs for mobile" — just as color roles encode "this brand uses blue for primary actions."

The critical boundary is between **parametric structural variation** (density modes, navigation placement, action prominence) and **arbitrary structural reconfiguration** (rearranging content order, adding/removing content sections). The former is theme territory. The latter crosses into content architecture and component composition, which are separate concerns. A theme can say "navigation goes in a sidebar" but should not say "move the search bar into the footer." The distinction maps to CSS Zen Garden's constraint: the HTML structure is fixed, but presentation — including layout — is fully flexible.

Decorative structural elements deserve special attention. Divi's section divider system (26 configurable shapes — waves, curves, arrows, triangles — with height, color, repeat, flip, and arrangement parameters) demonstrates that ornamental structural elements are theme-appropriate. Background patterns, divider styles, and decorative borders are presentation decisions, not content decisions.

---

## AI-driven theming inverts the authoring model

The convergence of design tokens and large language models creates a fundamentally new possibility: **bidirectional style-parameter mapping**. Rather than manually defining tokens that produce a visual style, AI can analyze a visual reference and decompose it into token values.

Yakura, Koyama, and Goto's "parametric transcription" (IJCAI 2021) demonstrated this formally: given a reference image and a set of available design tool parameters, black-box optimization finds parameter values minimizing perceptual style distance to the reference. This maps directly to theming — feed an AI a screenshot of a target aesthetic and receive a token set approximating it.

The practical landscape in 2025-2026 includes Vercel's v0 + shadcn/ui registry (where design tokens serve as a "visual baseline" models use when generating UI), Banani AI (which extracts visual style from screenshots and generates fresh designs matching that style), and Hardik Pandya's methodology for making design systems machine-readable by replacing raw values with named tokens that LLMs can reference without hallucinating names.

Style prompts from Midjourney or DALL-E function as informal theme metadata: "minimalist, soft gradients, rounded corners, warm palette" is a human-readable encoding of positions on the surface treatment, edge treatment, color philosophy, and mood axes. An expressive theme format could include such natural-language style descriptors as metadata alongside formal token values — serving both as documentation for humans and as generation prompts for AI asset creation (icons, illustrations, backgrounds, decorative elements).

**Illustration style tokens** become particularly tractable with AI: rather than requiring a human illustrator to maintain visual coherence across hundreds of assets, a theme could specify `illustration.style: "isometric, geometric linework, 2px stroke, grain texture, brand palette only"` and use AI generation tools to produce coherent illustration sets on demand.

---

## A proposed taxonomy of theme concepts for Surface

Based on all research, here is a taxonomy of theme concepts organized by concern, designed for the Surface framework's concept-oriented approach. The taxonomy has four tiers, from most commonly tokenized to most novel.

**Tier 1 — Value tokens (well-established, covered by DTCG spec):** Color primitives and semantic roles. Dimension/spacing scales. Font families, sizes, weights, line heights. Border radius and width. Box shadows. Opacity. Z-index. Duration and easing curves. These are the "solved" layer — the W3C spec, Style Dictionary, and Figma variables handle them adequately.

**Tier 2 — Composite style tokens (partially covered by leading systems):** Typography compositions (font + size + weight + line-height + letter-spacing + OpenType features). Shadow systems (layered multi-shadow elevation scales with light source angle and colored shadow hue). Gradient definitions (type + angle + stops + blend style). Border compositions (width + style + color + radius philosophy). Transition compositions (property + duration + easing + delay). Material Design 3 and Atlassian partially formalize these; the DTCG spec defines composite types for typography, shadow, border, and transition.

**Tier 3 — Design philosophy tokens (rarely formalized, the primary gap):**

- **Surface treatment philosophy**: `flat | elevated | translucent | textured | 3D` — governing whether components use shadows, backdrop blur, noise overlays, or gradient depth
- **Edge treatment philosophy**: `sharp | rounded | pill | organic | beveled` — with parameters for corner-shape (superellipse/squircle support)
- **Ornament philosophy**: `none | minimal | moderate | rich | maximal` — governing decorative elements, dividers, background patterns, flourishes
- **Animation philosophy**: `none | functional | expressive | immersive` — with sub-parameters for spring physics, stagger timing, scroll-driven ranges
- **Density mode**: `compact | comfortable | spacious` — affecting spacing, font sizing, component padding, touch target sizes
- **Typographic refinement level**: `basic | standard | refined | obsessive` — controlling whether OpenType features, hanging punctuation, smart quotes, smallcaps detection, and micro-typography transformations are applied
- **Icon style**: `outlined | filled | duotone | thin | bold` — with variable font axes for weight, grade, optical size, fill, roundness
- **Image treatment**: filter presets, duotone pairs, blend modes, mask/clip definitions
- **Shadow philosophy**: `flat | layered | ambient | colored` — governing whether shadows represent elevation, curvature, or mere separation
- **Navigation pattern**: `sidebar | topbar | bottomTab | hamburger | commandPalette` — the structural layout choice per breakpoint
- **Action pattern**: `fab | inline | contextual | toolbar` — how primary actions are presented

**Tier 4 — Generative and meta tokens (novel, research-frontier):**

- **Physical metaphor**: `none | paper | glass | clay | metal | fabric | custom("description")` — the conceptual material the UI simulates
- **Emotional register**: `clinical | neutral | warm | playful | confrontational` — governing color temperature, corner softness, animation bounciness, and ornament density in concert
- **Convention relationship**: `strict | conventional | distinctive | subversive` — whether the theme follows, evolves, ignores, or breaks UI conventions
- **Modular scale**: ratio + base + step count — generating rather than listing font sizes, spacing values
- **Constraint rules**: `contrastMinimum: 4.5`, `spacingProportional: true`, `colorHarmony: "triadic"` — inter-token relationships enforced at build or design time
- **Transformation pipeline**: ordered list of content transformations (smart quotes, smallcaps detection, non-breaking space insertion, color normalization) applied at build time
- **AI style prompt**: natural-language description serving as both documentation and generation input for AI-created assets
- **Illustration style parameters**: perspective, line weight, line style, detail level, texture, shadow approach, color palette adherence
- **Randomness/delight parameters**: probability of variant appearances (turntrout.com's 7% colored dropcap), easter egg conditions

---

## Conclusion: from value delivery to design space definition

The fundamental shift required is from **token systems that deliver values across platforms** to **theme systems that define design spaces**. Current tokens answer "what color is the primary button?" A truly expressive theme answers "what kind of world does this interface inhabit?"

Three insights emerge that are genuinely novel. First, **design themes are positions in a multi-dimensional conceptual space**, not collections of property overrides. The 10 axes identified — surface, edge, color philosophy, spatial philosophy, metaphor, animation, typography, ornament, mood, and convention relationship — provide a coordinate system for describing any visual design, from GeoCities maximalism to Apple's restrained translucency. Theme switching means moving to a different point in this space, and every axis must be independently addressable.

Second, **the most expressive design concepts are algorithmic, not static**. turntrout.com's typography pipeline, Material You's dynamic color generation, modular type scales, and constraint-based accessibility checking all demonstrate that the most powerful design decisions are *rules that generate values*, not values themselves. A theme format that can express "generate a 10-step color scale from this seed using OKLCH perceptual uniformity" or "apply smallcaps to detected acronyms" is categorically more expressive than one listing 10 static color values.

Third, **the boundary between theme and component is permeable and productive**. Navigation patterns, action placement, density modes, and decorative structural elements all have strong precedent as theme-level choices. The Surface framework's concept-oriented approach is uniquely positioned to formalize this: if components are defined in terms of concepts (rather than specific HTML structures), then a theme can remap concept-to-presentation bindings — mapping "primary navigation" to a sidebar in one theme and bottom tabs in another — without violating separation of concerns. This is exactly what CSS Zen Garden demonstrated was possible, and what the concept-oriented paradigm can make *declarative*.