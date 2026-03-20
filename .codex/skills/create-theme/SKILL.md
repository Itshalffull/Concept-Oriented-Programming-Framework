---
name: create-theme
description: Design and create a new Clef Surface theme specification (.theme file). Defines palette, typography, spacing, motion, elevation, and radius tokens using the theme DSL.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
argument-hint: "<theme-name> [--extends base-theme]"
---

# Create a Clef Surface Theme

Design and implement a new theme specification named **$ARGUMENTS** for the Clef Surface system.

## When to Use This Skill

Use this skill when you need to:

- Define a new visual theme for a Clef Surface application
- Create a dark mode, high-contrast, or brand-specific variant
- Extend an existing base theme with overrides
- Establish design tokens (colors, type, spacing, motion) in a declarative spec

Do NOT use this skill for:

- Component styling (use Surface component specs instead)
- Layout definitions (use Surface layout specs)
- One-off CSS overrides (themes are systematic, not ad-hoc)

## Core Design Principles

1. **Perceptual Uniformity** -- Use oklch for all color tokens. oklch guarantees that equal lightness values look equally light to human eyes, unlike hsl or hex.
2. **Accessibility First** -- Every foreground/background pair must meet WCAG AA contrast (4.5:1 for normal text, 3:1 for large text). Aim for AAA (7:1) when possible.
3. **Systematic Scales** -- Spacing, typography, and radius use deliberate scales, not arbitrary values. Prefer a base unit with multipliers.
4. **Token Semantics** -- Name tokens by role (e.g., `on-primary`, `surface-variant`) not by appearance (e.g., `blue-500`, `light-gray`). Semantic names survive theme switching.
5. **Minimal Overrides** -- When extending a base theme, override only what changes. Inherited sections need no redeclaration.

## Step-by-Step Design Process

### Step 1: Define the Theme Identity

Decide:
- **Name**: A short, lowercase, hyphenated identifier (e.g., `light`, `dark`, `ocean-dark`, `brand-vivid`)
- **Purpose**: A prose description of what this theme is for and when it should be used
- **Base theme**: If this theme extends another, identify which one. Most themes extend `light` or `dark`.

### Step 2: Design the Palette

Read [references/color-systems.md](references/color-systems.md) for oklch guidance and WCAG contrast requirements.

Design the palette in layers:

1. **Brand colors** -- primary, secondary, tertiary with hover/active/container variants
2. **Surface colors** -- background, surface, surface-dim, surface-bright, surface-variant
3. **On-colors** -- foreground colors for each surface (on-primary, on-surface, etc.)
4. **Outline colors** -- outline, outline-variant, outline-focus
5. **Status colors** -- error, warning, success, info with container and on-variants
6. **Utility colors** -- shadow, scrim, overlay-backdrop
7. **Interactive state layers** -- hover, press, focus, drag, disabled (with alpha)

**Palette checklist:**
- [ ] All colors use oklch (preferred) or hsl/hex (acceptable fallback)
- [ ] Every foreground/background pair meets WCAG AA (4.5:1 minimum)
- [ ] Brand colors have hover, active, and container variants
- [ ] Status colors have container and on-container variants
- [ ] Interactive state layers use alpha transparency
- [ ] Disabled states use reduced alpha (0.38 for content, 0.12 for containers)

### Step 3: Design the Typography Scale

Use a modular scale for consistent size progression. Common ratios:

| Ratio | Name | Use Case |
|-------|------|----------|
| 1.125 | Major second | Compact UIs, data-dense |
| 1.200 | Minor third | General purpose (recommended) |
| 1.250 | Major third | Marketing, editorial |
| 1.333 | Perfect fourth | Large displays, presentations |

Define these token categories:

1. **Font families** -- sans, mono, serif with full fallback stacks
2. **Display styles** -- display-lg, display-md, display-sm (hero text)
3. **Heading styles** -- heading-lg, heading-md, heading-sm
4. **Body styles** -- body-lg, body-md, body-sm
5. **Label styles** -- label-lg, label-md, label-sm (UI chrome)
6. **Utility styles** -- caption, overline, code, code-sm

Each compound style is a nested block: `{ size, lineHeight, weight, tracking, family }`.

**Typography checklist:**
- [ ] Minimum body text size is 1rem (16px)
- [ ] Line heights are between 1.2 (headings) and 1.6 (body)
- [ ] Tracking (letter-spacing) is negative for large sizes, positive for small
- [ ] Font families include system fallbacks
- [ ] Weights are standard values (400, 500, 600, 700, 800)

### Step 4: Design the Spacing Scale

Choose a base unit (typically 4px) and build a scale from multiples:

```
base: 4px
xs:   4px    (1x)
sm:   8px    (2x)
md:   16px   (4x)
lg:   24px   (6x)
xl:   32px   (8x)
2xl:  48px   (12x)
3xl:  64px   (16x)
```

Add semantic aliases for common use cases (gutter, section, page-inline, stack-sm, etc.).

### Step 5: Design the Motion Tokens

Define durations, easings, and compound transitions:

**Duration scale:**
- instant: 50-100ms (micro-interactions)
- fast: 100-200ms (hover, focus)
- normal: 200-300ms (general transitions)
- slow: 300-500ms (complex animations)
- slower: 500-700ms (page transitions)

**Easing curves:**
- default: Standard deceleration curve
- emphasize: Dramatic entry
- decelerate: Slow to stop (entering elements)
- accelerate: Quick start (exiting elements)
- spring: Overshoot bounce
- linear: Constant rate

**Compound transitions** combine duration + easing + property:
```
transition-fade: { duration: duration-fast, easing: easing-default, property: opacity }
```

Always include `reduce-motion: prefers-reduced-motion` to respect user preferences.

### Step 6: Design Elevation and Radius

**Elevation** uses 5 levels (level-0 through level-5) with increasing shadow blur and offset. Add semantic aliases (elevation-card, elevation-dialog, etc.).

**Radius** uses a scale from none to full (9999px for pill shapes). Add semantic aliases (radius-button, radius-card, etc.).

### Step 7: Write the .theme File

Place the file at: `repertoire/themes/<name>.theme`

See [references/theme-grammar.md](references/theme-grammar.md) for the complete grammar reference.

Section order is always:
1. `@version(1)` annotation
2. File-level comment describing the theme
3. `theme <name> [extends <base>] { ... }`
4. `purpose { ... }` (optional prose block)
5. `palette { ... }`
6. `typography { ... }`
7. `spacing { ... }`
8. `motion { ... }`
9. `elevation { ... }`
10. `radius { ... }`

### Step 8: Validate by Parsing

Run the parser to verify the theme is syntactically valid:

```bash
npx tsx -e "
import { readFileSync } from 'fs';
import { parseThemeFile } from './handlers/ts/framework/theme-spec-parser.js';

const source = readFileSync('repertoire/themes/<name>.theme', 'utf-8');
const manifest = parseThemeFile(source);
console.log('Theme:', manifest.name);
console.log('Extends:', manifest.extends || '(none)');
console.log('Palette tokens:', Object.keys(manifest.palette).length);
console.log('Typography tokens:', Object.keys(manifest.typography).length);
console.log('Spacing tokens:', Object.keys(manifest.spacing.scale).length);
console.log('Motion tokens:', Object.keys(manifest.motion).length);
console.log('Elevation tokens:', Object.keys(manifest.elevation).length);
console.log('Radius tokens:', Object.keys(manifest.radius).length);
"
```

### Step 9: Check Contrast Ratios

For every foreground/background pair in the palette, verify WCAG AA compliance. Key pairs to check:

- `on-primary` against `primary`
- `on-surface` against `surface`, `surface-dim`, `surface-bright`
- `on-error` against `error`
- `on-primary-container` against `primary-container`
- All status `on-*-container` against their containers

Use the oklch lightness difference as a rough proxy: a lightness difference of 0.45+ between foreground and background generally meets AA for normal text.

### Step 10: Review Against Anti-Patterns

- [ ] **Not aesthetic-first** -- Every token serves a functional role, not just "it looks nice"
- [ ] **Not over-specified** -- If extending a base, only override what differs
- [ ] **Not arbitrary values** -- All spacing/size values follow a scale
- [ ] **Not missing states** -- Hover, active, focus, disabled all have tokens
- [ ] **Not inaccessible** -- All text/background pairs meet WCAG AA
- [ ] **Not fragile** -- Semantic token names, not raw color values in components

## Quick Reference: Theme Structure

```
@version(1)

# Comment describing the theme

theme theme-name [extends base-theme] {

  purpose {
    Prose description of what this theme is for and when to use it.
  }

  palette {
    # Brand
    primary:           oklch(L C H)
    primary-hover:     oklch(L C H)
    primary-active:    oklch(L C H)
    primary-container: oklch(L C H)
    on-primary:        oklch(L C H)

    # Surfaces
    background:     oklch(L C H)
    surface:        oklch(L C H)
    on-surface:     oklch(L C H)

    # Status
    error:          oklch(L C H)
    on-error:       oklch(L C H)

    # Utility
    shadow:         oklch(L C H / alpha)

    # State layers
    hover-state-layer: oklch(L C H / alpha)
  }

  typography {
    font-family-sans: "Inter", system-ui, sans-serif
    body-md: { size: 1rem; weight: 400; lineHeight: 1.5; tracking: 0; family: font-family-sans }
  }

  spacing {
    base: 4px
    sm:   8px
    md:   16px
    lg:   24px
  }

  motion {
    duration-normal:  250ms
    easing-default:   cubic-bezier(0.2, 0, 0, 1)
    transition-fade:  { duration: duration-fast, easing: easing-default, property: opacity }
    reduce-motion:    prefers-reduced-motion
  }

  elevation {
    level-0: none
    level-1: 0 1px 2px 0 shadow
    elevation-card: level-1
  }

  radius {
    sm:   4px
    md:   8px
    full: 9999px
    radius-button: md
  }
}
```

## Theme Extension Pattern

When a theme `extends` a base theme, it inherits all tokens from the base. Only sections and tokens that differ need to be declared. For example, a dark theme extending light typically overrides:

- **palette** -- Inverted lightness values (dark backgrounds, light foregrounds)
- **elevation** -- Stronger shadows to be visible on dark surfaces
- Possibly **motion** -- Adjusted for context (e.g., high-contrast themes reduce durations)

Sections not declared in the child theme are inherited wholesale from the parent. Comments like `# typography -- inherited from light, no overrides needed` are encouraged for clarity.

```
theme dark extends light {
  palette {
    # Only override what changes
    background: oklch(0.14 0.005 260)
    on-background: oklch(0.92 0.008 260)
    # ... other inverted tokens
  }

  elevation {
    # Shadows need more opacity on dark backgrounds
    level-1: 0 1px 3px 0 oklch(0.0 0 0 / 0.40)
  }

  # typography -- inherited from light
  # spacing -- inherited from light
  # radius -- inherited from light
}
```

## Example Walkthroughs

For complete worked examples:
- [examples/light-theme.md](examples/light-theme.md) -- A full standalone light theme with design rationale

## Existing Themes in This Codebase

Reference these existing themes for conventions and patterns:
- `repertoire/themes/light.theme` -- Default light theme (standalone, comprehensive)
- `repertoire/themes/dark.theme` -- Dark variant extending light
- `repertoire/themes/high-contrast.theme` -- WCAG AAA variant extending light

## Related Skills

| Skill | When to Use |
|-------|------------|
| `/create-concept` | Design a new concept (themes are not concepts) |
| `/create-suite` | Bundle themes with concepts into a suite |
| `/create-implementation` | Write handler code that consumes theme tokens |
| `/decompose-feature` | Break a feature into concepts, themes, and components |
