# Example: Complete Light Theme

This example walks through a complete standalone light theme with design rationale for each section. This is the same structure used in `repertoire/themes/light.theme`.

## Design Decisions

- **Color space**: oklch throughout for perceptual uniformity
- **Brand hue**: 265 (blue-violet) -- professional, trustworthy
- **Surface warmth**: Slight warm tint (hue 250) on neutrals to avoid cold/clinical feel
- **Type scale ratio**: Minor third (1.2) for balanced hierarchy
- **Spacing base**: 4px for fine-grained control
- **Motion**: Standard Material-style curves with reduced-motion support

## Complete Theme File

```
@version(1)

# Default Light Theme
# Warm neutrals with WCAG AA contrast ratios throughout.
# All color tokens use oklch for perceptual uniformity.

theme light {

  purpose {
    A warm, approachable light theme for general-purpose web applications.
    Designed with WCAG AA compliance as a baseline. Uses blue-violet brand
    hues with warm neutral surfaces.
  }

  palette {
    # --- Brand ---
    # Primary at L=0.55 gives 4.5:1+ contrast against white on-primary.
    # Hover darkens by 0.05, active by 0.10. Container is a light tint.
    primary:              oklch(0.55 0.24 265)
    primary-hover:        oklch(0.50 0.24 265)
    primary-active:       oklch(0.45 0.24 265)
    primary-container:    oklch(0.92 0.06 265)
    on-primary:           oklch(1.0 0 0)
    on-primary-container: oklch(0.25 0.10 265)

    # Secondary uses lower chroma for visual hierarchy.
    secondary:              oklch(0.55 0.12 290)
    secondary-hover:        oklch(0.50 0.12 290)
    secondary-active:       oklch(0.45 0.12 290)
    secondary-container:    oklch(0.93 0.04 290)
    on-secondary:           oklch(1.0 0 0)
    on-secondary-container: oklch(0.25 0.06 290)

    # Tertiary at a complementary hue for accent variety.
    tertiary:              oklch(0.55 0.14 180)
    tertiary-hover:        oklch(0.50 0.14 180)
    tertiary-active:       oklch(0.45 0.14 180)
    tertiary-container:    oklch(0.93 0.04 180)
    on-tertiary:           oklch(1.0 0 0)
    on-tertiary-container: oklch(0.25 0.06 180)

    # --- Surfaces ---
    # Near-white with a whisper of warm tint (chroma 0.002, hue 250).
    # on-surface at L=0.20 gives ~12:1 contrast against background.
    background:       oklch(0.995 0.002 250)
    on-background:    oklch(0.20 0.015 260)
    surface:          oklch(0.99 0.002 250)
    surface-dim:      oklch(0.94 0.004 250)
    surface-bright:   oklch(0.995 0.002 250)
    surface-variant:  oklch(0.96 0.004 250)
    on-surface:       oklch(0.20 0.015 260)
    on-surface-variant: oklch(0.45 0.01 260)
    inverse-surface:    oklch(0.24 0.015 260)
    inverse-on-surface: oklch(0.94 0.004 260)
    inverse-primary:    oklch(0.78 0.14 265)

    # --- Outlines ---
    outline:          oklch(0.60 0.01 260)
    outline-variant:  oklch(0.82 0.008 260)
    outline-focus:    oklch(0.55 0.24 265)

    # --- Status ---
    # Each status color follows the same pattern:
    # base (L=0.55), hover (-0.05), container (L=0.93+),
    # on-color (white), on-container (dark tinted).
    error:             oklch(0.55 0.22 27)
    error-hover:       oklch(0.50 0.22 27)
    error-container:   oklch(0.93 0.06 27)
    on-error:          oklch(1.0 0 0)
    on-error-container: oklch(0.30 0.12 27)

    warning:             oklch(0.62 0.16 75)
    warning-hover:       oklch(0.57 0.16 75)
    warning-container:   oklch(0.95 0.05 75)
    on-warning:          oklch(1.0 0 0)
    on-warning-container: oklch(0.30 0.08 75)

    success:             oklch(0.52 0.18 145)
    success-hover:       oklch(0.47 0.18 145)
    success-container:   oklch(0.93 0.05 145)
    on-success:          oklch(1.0 0 0)
    on-success-container: oklch(0.25 0.08 145)

    info:             oklch(0.55 0.16 250)
    info-hover:       oklch(0.50 0.16 250)
    info-container:   oklch(0.93 0.04 250)
    on-info:          oklch(1.0 0 0)
    on-info-container: oklch(0.25 0.08 250)

    # --- Utility ---
    # Shadow uses pure black with low alpha for natural depth.
    shadow:           oklch(0.0 0 0 / 0.12)
    scrim:            oklch(0.0 0 0 / 0.32)
    overlay-backdrop: oklch(0.0 0 0 / 0.5)

    # --- Interactive states ---
    # Dark base color (matching on-surface) with varying alpha.
    hover-state-layer:   oklch(0.20 0.015 260 / 0.08)
    press-state-layer:   oklch(0.20 0.015 260 / 0.12)
    focus-state-layer:   oklch(0.20 0.015 260 / 0.12)
    drag-state-layer:    oklch(0.20 0.015 260 / 0.16)
    disabled-content:    oklch(0.20 0.015 260 / 0.38)
    disabled-container:  oklch(0.20 0.015 260 / 0.12)
  }

  typography {
    # Font stacks with robust fallbacks.
    font-family-sans: "Inter", system-ui, -apple-system, sans-serif
    font-family-mono: "JetBrains Mono", ui-monospace, monospace
    font-family-serif: "Lora", Georgia, "Times New Roman", serif

    # Display: Large hero text. Tight tracking, heavy weight.
    display-lg: { size: 3.5rem;    lineHeight: 1.12; weight: 700; tracking: -0.025em; family: font-family-sans }
    display-md: { size: 2.75rem;   lineHeight: 1.15; weight: 700; tracking: -0.02em;  family: font-family-sans }
    display-sm: { size: 2.25rem;   lineHeight: 1.18; weight: 700; tracking: -0.015em; family: font-family-sans }

    # Headings: Section headers. Semibold, moderate tracking.
    heading-lg: { size: 2rem;      lineHeight: 1.25; weight: 600; tracking: -0.015em; family: font-family-sans }
    heading-md: { size: 1.5rem;    lineHeight: 1.33; weight: 600; tracking: -0.01em;  family: font-family-sans }
    heading-sm: { size: 1.25rem;   lineHeight: 1.4;  weight: 600; tracking: 0;        family: font-family-sans }

    # Body: Running text. Regular weight, generous line height.
    body-lg:    { size: 1.125rem;  lineHeight: 1.56; weight: 400; tracking: 0;        family: font-family-sans }
    body-md:    { size: 1rem;      lineHeight: 1.5;  weight: 400; tracking: 0;        family: font-family-sans }
    body-sm:    { size: 0.875rem;  lineHeight: 1.43; weight: 400; tracking: 0.01em;   family: font-family-sans }

    # Labels: UI chrome text. Medium weight, wider tracking at small sizes.
    label-lg:   { size: 0.875rem;  lineHeight: 1.43; weight: 500; tracking: 0.01em;   family: font-family-sans }
    label-md:   { size: 0.8125rem; lineHeight: 1.38; weight: 500; tracking: 0.015em;  family: font-family-sans }
    label-sm:   { size: 0.75rem;   lineHeight: 1.33; weight: 500; tracking: 0.02em;   family: font-family-sans }

    # Utility styles.
    caption:    { size: 0.6875rem; lineHeight: 1.27; weight: 400; tracking: 0.025em;  family: font-family-sans }
    overline:   { size: 0.6875rem; lineHeight: 1.27; weight: 600; tracking: 0.08em;   family: font-family-sans; transform: uppercase }

    # Code: Monospace for code blocks and inline code.
    code:       { size: 0.875rem;  lineHeight: 1.57; weight: 400; family: font-family-mono }
    code-sm:    { size: 0.8125rem; lineHeight: 1.54; weight: 400; family: font-family-mono }
  }

  spacing {
    # 4px base unit. Scale uses clean multiples.
    base: 4px
    xs:   4px
    sm:   8px
    md:   16px
    lg:   24px
    xl:   32px
    2xl:  48px
    3xl:  64px
    4xl:  96px
    5xl:  128px

    # Semantic aliases for common layout patterns.
    gutter:       16px
    section:      64px
    page-inline:  24px
    page-block:   32px
    stack-sm:     8px
    stack-md:     16px
    stack-lg:     32px
    inline-sm:    4px
    inline-md:    8px
    inline-lg:    16px
  }

  motion {
    # Duration scale: instant -> slower.
    duration-instant: 100ms
    duration-fast:    150ms
    duration-normal:  250ms
    duration-slow:    400ms
    duration-slower:  600ms

    # Easing curves for different animation intents.
    easing-default:    cubic-bezier(0.2, 0, 0, 1)
    easing-emphasize:  cubic-bezier(0.05, 0.7, 0.1, 1)
    easing-decelerate: cubic-bezier(0, 0, 0, 1)
    easing-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15)
    easing-spring:     cubic-bezier(0.175, 0.885, 0.32, 1.275)
    easing-linear:     linear

    # Compound transitions combining duration + easing + property.
    transition-fade:     { duration: duration-fast;   easing: easing-default;   property: opacity }
    transition-scale:    { duration: duration-normal;  easing: easing-emphasize; property: transform }
    transition-slide:    { duration: duration-normal;  easing: easing-decelerate; property: transform }
    transition-expand:   { duration: duration-slow;    easing: easing-emphasize; property: "height, width" }
    transition-color:    { duration: duration-fast;    easing: easing-default;   property: "background-color, border-color, color" }

    # Accessibility: respect user motion preferences.
    reduce-motion: prefers-reduced-motion
  }

  elevation {
    # 5-level shadow scale. Each level increases blur and offset.
    # Uses the palette's shadow token as the color base.
    level-0: none
    level-1: 0 1px 2px 0 shadow
    level-2: 0 2px 4px -1px shadow, 0 1px 2px -1px shadow
    level-3: 0 4px 8px -2px shadow, 0 2px 4px -2px shadow
    level-4: 0 8px 16px -4px shadow, 0 4px 6px -4px shadow
    level-5: 0 16px 32px -8px shadow, 0 8px 16px -8px shadow

    # Semantic aliases map component types to elevation levels.
    elevation-card:     level-1
    elevation-dropdown: level-2
    elevation-sticky:   level-3
    elevation-dialog:   level-4
    elevation-toast:    level-5
  }

  radius {
    # Scale from sharp to pill.
    none: 0
    sm:   4px
    md:   8px
    lg:   12px
    xl:   16px
    2xl:  24px
    full: 9999px

    # Semantic aliases for component shapes.
    radius-button:  md
    radius-input:   md
    radius-card:    lg
    radius-dialog:  xl
    radius-chip:    full
    radius-avatar:  full
    radius-badge:   full
  }
}
```

## Design Rationale

### Palette Strategy

The palette follows a **role-based naming** convention inspired by Material Design 3:

- **`primary` / `on-primary`**: The main brand color and its legible foreground. `on-primary` is white (L=1.0) because `primary` at L=0.55 provides 4.5:1+ contrast.
- **`*-container` / `on-*-container`**: Lighter tinted surfaces for cards, chips, and badges. The container is high-lightness (L=0.92+), and its foreground is dark-tinted (L=0.25-0.30).
- **State layers**: Use the `on-surface` base color at varying alpha. This ensures state feedback is visible on any surface without breaking contrast.

### Typography Strategy

The type scale uses a **minor third ratio (1.2)** stepping down from display-lg:

- 3.5rem -> 2.75rem -> 2.25rem -> 2rem -> 1.5rem -> 1.25rem -> 1.125rem -> 1rem -> 0.875rem -> ...

Tracking shifts from **negative** (tight) at large sizes to **positive** (loose) at small sizes. This compensates for how letter spacing perception changes with size.

Line heights are **inversely proportional** to font size: display text uses 1.12 (tight), body text uses 1.5 (generous), small labels use 1.33 (moderate).

### Spacing Strategy

The **4px base** allows fine-grained spacing (4, 8, 12, 16...) while semantic aliases provide consistent vocabulary across components. The `stack-*` and `inline-*` aliases correspond to vertical and horizontal spacing respectively, making layout intent explicit.

### Motion Strategy

Duration values increase in rough **1.5-2x steps**: 100 -> 150 -> 250 -> 400 -> 600ms. Faster durations are for micro-interactions (hover, focus), slower for complex state changes (expand, page transition).

The easing curves follow a **deceleration-first** philosophy: most animations start fast and slow down, which feels natural and responsive. The `spring` curve adds slight overshoot for playful interactions.

### Elevation Strategy

Shadow specs use **negative spread** on inner shadows to keep them tight. Each level roughly doubles the blur radius of the previous level. The `shadow` reference resolves to the palette's shadow token, keeping shadow color consistent with the theme.
