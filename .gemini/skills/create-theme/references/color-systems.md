# Color Systems for Clef Themes

## oklch: The Preferred Color Space

All Clef themes should use oklch as the primary color notation. oklch stands for "OK Lightness Chroma Hue" and is defined in the CSS Color Level 4 specification.

### Why oklch Over hsl or hex

| Property | oklch | hsl | hex |
|----------|-------|-----|-----|
| Perceptual uniformity | Yes -- equal L values look equally light | No -- 50% lightness varies wildly by hue | No |
| Predictable lightness | L=0.5 is medium for ALL hues | L=50% is medium only for some hues | Not intuitive |
| Gamut flexibility | Supports P3 and wider gamuts | Limited to sRGB | Limited to sRGB |
| Theme derivation | Shift L systematically for dark/light variants | Requires per-hue adjustments | Manual |

### oklch Syntax

```
oklch(lightness chroma hue)
oklch(lightness chroma hue / alpha)
```

- **Lightness (L)**: 0.0 (black) to 1.0 (white). This is perceptually uniform.
- **Chroma (C)**: 0.0 (gray) to ~0.4 (maximum saturation). Typical UI colors use 0.05-0.25.
- **Hue (H)**: 0-360 degrees. Same hue wheel as hsl.
- **Alpha**: 0.0 (transparent) to 1.0 (opaque). Uses `/` separator.

### oklch Hue Reference

| Hue Range | Color |
|-----------|-------|
| 0-30 | Red |
| 30-60 | Orange |
| 60-90 | Yellow |
| 90-145 | Green |
| 145-200 | Cyan/Teal |
| 200-265 | Blue |
| 265-310 | Purple/Violet |
| 310-360 | Magenta/Pink |

### oklch Chroma Guidelines

| Chroma Range | Use Case |
|-------------|----------|
| 0.00-0.02 | Neutral grays (surfaces, backgrounds) |
| 0.02-0.08 | Muted, subtle tints |
| 0.08-0.16 | Secondary/tertiary brand colors |
| 0.16-0.24 | Primary brand, status colors |
| 0.24-0.37 | High-impact accent (use sparingly) |

### Light Theme vs Dark Theme Lightness

For light themes:
- Foreground text: L = 0.10-0.25 (dark)
- Background surfaces: L = 0.94-1.0 (light)
- Primary brand: L = 0.45-0.60
- Container fills: L = 0.90-0.95

For dark themes (invert the pattern):
- Foreground text: L = 0.85-0.95 (light)
- Background surfaces: L = 0.12-0.20 (dark)
- Primary brand: L = 0.70-0.82
- Container fills: L = 0.28-0.38

## WCAG Contrast Requirements

### Compliance Levels

| Level | Ratio | Applies To |
|-------|-------|------------|
| AA (minimum) | 4.5:1 | Normal text (< 18pt or < 14pt bold) |
| AA (large text) | 3:1 | Large text (>= 18pt or >= 14pt bold) |
| AA (UI components) | 3:1 | Icons, borders, focus indicators |
| AAA (enhanced) | 7:1 | Normal text (highest accessibility) |
| AAA (large text) | 4.5:1 | Large text (highest accessibility) |

### oklch Lightness Delta as Contrast Proxy

While true contrast ratio requires luminance calculation, oklch lightness difference is a useful approximation during design:

| L difference | Approximate contrast | Meets |
|-------------|---------------------|-------|
| 0.30 | ~3:1 | AA large text, UI components |
| 0.45 | ~4.5:1 | AA normal text |
| 0.55 | ~7:1 | AAA normal text |
| 0.70+ | ~10:1+ | Exceeds AAA |

**Warning**: This is a rough proxy. Always verify critical pairs with a proper contrast checker, especially for saturated colors where chroma affects perceived contrast.

### Key Contrast Pairs to Verify

Every theme must ensure these pairs meet AA (4.5:1) minimum:

1. `on-primary` against `primary`
2. `on-secondary` against `secondary`
3. `on-tertiary` against `tertiary`
4. `on-surface` against `surface`
5. `on-surface` against `surface-dim`
6. `on-surface` against `surface-bright`
7. `on-surface-variant` against `surface-variant`
8. `on-background` against `background`
9. `on-error` against `error`
10. `on-warning` against `warning`
11. `on-success` against `success`
12. `on-info` against `info`
13. `on-*-container` against `*-container` (for all status/brand containers)
14. `inverse-on-surface` against `inverse-surface`

### Accessible State Layers

Interactive state layers use alpha transparency over the base surface. The alpha values must be chosen so that the state change is perceivable but doesn't break contrast:

| State | Typical Alpha | Rationale |
|-------|--------------|-----------|
| Hover | 0.08 | Subtle, clearly perceivable |
| Press/Focus | 0.12 | Stronger feedback |
| Drag | 0.16 | Clear displacement signal |
| Disabled content | 0.38 | Visually muted, still legible for context |
| Disabled container | 0.12 | Subtle but present |

## hsl and hex: Acceptable Fallbacks

While oklch is preferred, hsl and hex are supported by the parser:

### hsl Syntax

```
hsl(hue saturation% lightness%)
```

Example: `hsl(265 80% 55%)`

### hex Syntax

```
#RRGGBB
#RGB (shorthand)
```

Example: `#4A90D9`

### When to Use Fallbacks

- When matching an existing brand guideline that specifies hex values
- When interfacing with a legacy design system
- When tooling only outputs hsl

Even in these cases, consider converting to oklch for the theme file and documenting the original value in a comment.

## Deriving Theme Variants

### Light to Dark Conversion

To create a dark variant from a light theme:

1. **Surfaces**: Invert lightness. L=0.99 becomes L=0.17. L=0.94 becomes L=0.22.
2. **Foreground text**: Invert lightness. L=0.20 becomes L=0.92.
3. **Brand colors**: Shift lightness up by ~0.20-0.25 to maintain visibility on dark backgrounds. Reduce chroma slightly.
4. **Containers**: Shift to low lightness (L=0.28-0.38) instead of high (L=0.90-0.95).
5. **Shadows**: Increase alpha (light: 0.12, dark: 0.32+) since shadows are less visible on dark backgrounds.
6. **State layers**: Use light base color instead of dark.

### High-Contrast Conversion

To create a high-contrast variant:

1. **Foreground text**: Push to extremes (L=0.10 on white, L=0.95 on black)
2. **Brand colors**: Increase chroma, decrease lightness for better contrast
3. **Font weights**: Increase by one step (400->450, 600->700)
4. **Minimum sizes**: Raise body-sm and label-sm minimums
5. **Motion**: Reduce durations (users who need high contrast often benefit from reduced motion)
6. **Borders**: Use stronger, more visible outlines
