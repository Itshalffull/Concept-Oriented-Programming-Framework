---
name: coif-theme-scaffold-gen
description: Use when creating a new COIF design system theme. Generates palette configuration, typography scale, motion definitions, elevation scale, and light/dark theme manifests with WCAG accessibility compliance.
argument-hint: --name <theme-name>
allowed-tools: Read, Write, Bash
---

# CoifThemeScaffoldGen

Scaffold a COIF design system theme **$ARGUMENTS** with palette tokens, typography scale, motion transitions, and elevation shadows.

> **When to use:** Use when creating a new COIF design system theme. Generates palette configuration, typography scale, motion definitions, elevation scale, and light/dark theme manifests with WCAG accessibility compliance.

## Design Principles

- **Token-Based Design:** Every visual value is a named design token — no hardcoded colors, sizes, or shadows anywhere in component code.
- **WCAG Compliance:** Every color pair must meet WCAG 2.1 AA contrast (4.5:1 normal text, 3:1 large text). The generator validates at generation time.
- **Reduced Motion Respect:** All motion durations collapse to 0ms when prefers-reduced-motion is active. This is built into the motion token system, not opt-in.
- **Theme Layering:** Themes are layered: base + variants. Multiple variants can be active simultaneously, resolved by priority then activation order.

## Step-by-Step Process

### Step 1: Register Generator

Self-register with PluginRegistry so the scaffolding kit's KindSystem can track ThemeConfig → CoifTheme transformations.

**Examples:**
*Register the theme scaffold generator*
```typescript
const result = await coifThemeScaffoldGenHandler.register({}, storage);

```

### Step 2: Generate COIF Theme

Generate a complete design system theme scaffold including palette configuration (OKLCH color scales with WCAG contrast), typography scale (modular ratio), motion definitions (with reduced-motion support), elevation scale (shadow layers), and light/dark theme manifests.

**Examples:**
*Generate a theme with defaults*
```bash
copf scaffold theme --name ocean
```
*Generate a custom theme*
```bash
copf scaffold theme --name brand --primary '#3b82f6' --font 'Inter, sans-serif' --base-size 18
```
*Generate light-only theme*
```bash
copf scaffold theme --name print --mode light
```

**Checklist:**
- [ ] Theme name is kebab-case?
- [ ] Primary color generates full 50-950 scale?
- [ ] Palette has semantic roles (primary, secondary, error, etc.)?
- [ ] WCAG contrast ratios meet AA standard (4.5:1 normal, 3:1 large)?
- [ ] Typography uses modular ratio scale?
- [ ] Motion respects prefers-reduced-motion?
- [ ] Elevation scale covers 0-5 levels?
- [ ] Light and dark themes are generated (if mode=both)?

## References

- [COIF design system and theme architecture](references/coif-theme-guide.md)

## Supporting Materials

- [COIF theme scaffolding walkthrough](examples/scaffold-coif-theme.md)

## Quick Reference

| Input | Type | Purpose |
|-------|------|---------|
| name | String | Theme name (kebab-case) |
| primaryColor | String | Primary color hue or hex value |
| secondaryColor | String | Secondary color hue or hex |
| fontFamily | String | Primary font stack |
| baseSize | Int | Base font size in pixels (default: 16) |
| scale | Float | Modular ratio (default: 1.25 major third) |
| borderRadius | String | Default border radius |
| mode | String | light, dark, or both (default: both) |

**Output Files:**
| File | Purpose |
|------|---------|
| `kit.yaml` | Theme kit manifest |
| `themes/{name}-light.json` | Light theme tokens |
| `themes/{name}-dark.json` | Dark theme tokens |
| `tokens/palette.json` | Color scale configuration |
| `tokens/typography.json` | Type scale and font stacks |
| `tokens/motion.json` | Animation timing and easing |
| `tokens/elevation.json` | Shadow scale |


## Anti-Patterns

### Hardcoded colors in components
Component uses raw hex values instead of design tokens.

**Bad:**
```
.button { background: #3b82f6; color: #ffffff; }
```

**Good:**
```
.button {
  background: var(--color-primary);
  color: var(--color-on-primary);
}
```

### Ignoring reduced motion
Animations play regardless of prefers-reduced-motion setting.

**Bad:**
```
.dialog { transition: transform 300ms ease; }
```

**Good:**
```
.dialog {
  transition: transform var(--motion-duration-slow) var(--motion-ease-default);
}
@media (prefers-reduced-motion: reduce) {
  .dialog { transition-duration: 0ms; }
}
```

## Validation

*Generate a COIF theme scaffold:*
```bash
npx tsx tools/copf-cli/src/index.ts scaffold theme --name ocean --primary 220 --font 'Inter, sans-serif'
```
*Run scaffold generator tests:*
```bash
npx vitest run tests/scaffold-generators.test.ts
```

## Related Skills

| Skill | When to Use |
| --- | --- |
| coif-component-scaffold | Generate components to use the theme tokens |
| kit-scaffold | Generate kit manifests for theme packages |

