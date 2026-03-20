# Theme Grammar Reference

Complete grammar for Clef Surface `.theme` files, as implemented by the parser at `handlers/ts/framework/theme-spec-parser.ts`.

## File Structure

```
[@version(N)]

[# file-level comments]

theme <name> [extends <base-name>] {
  [purpose { <prose> }]
  [palette { <token-block> }]
  [typography { <token-block> }]
  [spacing { <token-block> }]
  [motion { <token-block> }]
  [elevation { <token-block> }]
  [radius { <token-block> }]
}
```

## Annotations

Annotations appear before the `theme` keyword and use `@` prefix syntax:

```
@version(1)
```

The parser skips all annotations. Currently only `@version` is conventionally used.

## Theme Declaration

```
theme <identifier> [extends <identifier>] {
  ...sections...
}
```

- `<identifier>` is a lowercase, hyphenated name (e.g., `light`, `dark`, `ocean-dark`, `brand-vivid`)
- `extends` is optional. When present, the child theme inherits all tokens from the named base theme.
- Sections can appear in any order, but the convention is: purpose, palette, typography, spacing, motion, elevation, radius.

## Comments

Two comment styles are supported:

```
# Hash-style comment (to end of line)
// Slash-style comment (to end of line)
```

Comments can appear anywhere whitespace is allowed.

## Token Blocks

Most sections use a uniform token-block syntax:

```
section-keyword {
  key: value
  key: value
  nested-key: { sub-key: sub-value; sub-key: sub-value }
}
```

### Simple Tokens

```
key: <value-expression>
```

Value expressions can be:

| Type | Examples |
|------|---------|
| Color literal (oklch) | `oklch(0.55 0.24 265)`, `oklch(0.0 0 0 / 0.12)` |
| Color literal (hsl) | `hsl(265 80% 55%)` |
| Color literal (rgb) | `rgb(100 50 200)` |
| Color literal (hwb) | `hwb(265 10% 20%)` |
| Color literal (hex) | `#4A90D9`, `#FFF` |
| Number with unit | `4px`, `1.5rem`, `250ms`, `0.01em` |
| Plain number | `1.5`, `600`, `0` |
| String literal | `"Inter"`, `'JetBrains Mono'` |
| Identifier | `sans-serif`, `linear`, `none` |
| Reference | `font-family-sans`, `duration-fast`, `level-1` |
| Multi-value | `0 1px 2px 0 shadow` (space-separated tokens) |
| Comma list | `"Inter", system-ui, sans-serif` |

Values are terminated by:
- A semicolon (`;`) -- explicit terminator
- The next key-colon pair -- implicit terminator
- A closing brace (`}`) -- end of block

Semicolons are optional in most cases. The parser looks ahead for the next `identifier:` pattern to detect value boundaries.

### Nested Tokens (Compound Values)

```
key: { sub-key: sub-value; sub-key: sub-value }
```

Nested blocks are flattened with dot notation in the parsed output:
- `body-md: { size: 1rem; weight: 400 }` produces `body-md.size: "1rem"` and `body-md.weight: "400"`

Semicolons are recommended inside nested blocks for clarity but follow the same optional rules as top-level values.

### Dotted Keys

Keys can use dot notation directly:

```
nested.key: 16px
```

This is equivalent to nesting: `nested: { key: 16px }`.

## Section-Specific Rules

### purpose

The purpose block contains free-form prose, not key-value pairs:

```
purpose {
  A warm, approachable light theme for general-purpose web applications.
  Uses oklch colors for perceptual uniformity and maintains WCAG AA
  contrast ratios across all foreground/background pairings.
}
```

The parser collects all tokens between braces and joins them with spaces.

### palette

Standard key-value token block. All values should be color literals:

```
palette {
  primary:   oklch(0.55 0.24 265)
  on-primary: oklch(1.0 0 0)
  shadow:    oklch(0.0 0 0 / 0.12)
}
```

### typography

Supports both simple tokens (font families) and nested compound tokens (type styles):

```
typography {
  font-family-sans: "Inter", system-ui, sans-serif

  body-md: { size: 1rem; lineHeight: 1.5; weight: 400; tracking: 0; family: font-family-sans }
}
```

Recognized sub-keys in compound typography tokens:
- `size` -- Font size (rem or px)
- `lineHeight` -- Unitless line height multiplier
- `weight` -- Numeric font weight
- `tracking` -- Letter spacing (em)
- `family` -- Reference to a font-family token
- `transform` -- Text transform (e.g., `uppercase`)

### spacing

Uses `base` (or `unit`) as a special key for the base unit:

```
spacing {
  base: 4px
  sm: 8px
  md: 16px
}
```

The parser extracts `base` or `unit` into `spacing.unit` and puts the rest into `spacing.scale`.

### motion

Supports simple tokens (durations, easings) and nested compound transitions:

```
motion {
  duration-fast: 150ms
  easing-default: cubic-bezier(0.2, 0, 0, 1)
  transition-fade: { duration: duration-fast, easing: easing-default, property: opacity }
  reduce-motion: prefers-reduced-motion
}
```

Note: `cubic-bezier(...)` is parsed as an identifier sequence, not a color function.

### elevation

Shadow specs are multi-value tokens. Comma-separated for multiple shadows:

```
elevation {
  level-0: none
  level-1: 0 1px 2px 0 shadow
  level-2: 0 2px 4px -1px shadow, 0 1px 2px -1px shadow
  elevation-card: level-1
}
```

### radius

Standard key-value token block:

```
radius {
  none: 0
  sm:   4px
  md:   8px
  full: 9999px
  radius-button: md
}
```

## Lexical Rules

### Identifiers

Identifiers match `[a-zA-Z_][\w-]*` -- start with a letter or underscore, then any word character or hyphen. Examples: `primary`, `on-surface-variant`, `font-family-sans`, `2xl`.

Note: Identifiers starting with a digit (like `2xl`) are tokenized as numbers with a unit suffix. The parser handles this in key position.

### Keywords

The following identifiers are treated as keywords: `theme`, `extends`, `palette`, `typography`, `spacing`, `motion`, `elevation`, `radius`, `purpose`, `base`, `unit`, `scale`.

Keywords can still appear as token keys within blocks.

### Color Functions

The tokenizer recognizes these color function prefixes: `oklch`, `hsl`, `rgb`, `hwb`. Everything from the function name through the closing `)` is captured as a single `COLOR_LIT` token.

Alpha channel uses the `/` separator inside the function: `oklch(0.0 0 0 / 0.12)`.

### Strings

Both single and double quotes are supported. Backslash escapes work inside strings.

```
"Inter"
'JetBrains Mono'
"background-color, border-color, color"
```

## Parsed Output: ThemeManifest

The parser produces a `ThemeManifest` object (defined in `runtime/types.ts`):

```typescript
interface ThemeManifest {
  name: string;
  purpose: string;
  extends?: string;
  palette: Record<string, string>;
  colorRoles: Record<string, string>;
  typography: Record<string, unknown>;
  spacing: { unit?: string; scale: Record<string, string> };
  motion: Record<string, unknown>;
  elevation: Record<string, unknown>;
  radius: Record<string, string>;
}
```

All token values are stored as strings. Nested blocks are flattened with dot notation (e.g., `body-md.size`, `body-md.weight`).
