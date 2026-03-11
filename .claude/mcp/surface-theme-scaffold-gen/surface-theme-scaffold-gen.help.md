# surface_theme_scaffold_gen — MCP Tool Guide

Scaffold a Clef Surface design system theme **{input}** with oklch palette, typography scale, spacing tokens, motion definitions, elevation shadows, and radius tokens in .theme format.


> **When to use:** Use when creating a new Clef Surface design system theme. Generates a .theme spec file with @version annotation, palette (oklch color scales), typography (modular ratio, fonts, weights, line-heights, tracking), spacing (base multiplier), motion (durations, easing, reduced-motion), elevation (shadow layers), radius tokens, and extends support for theme variants. Follows WCAG accessibility guidelines for contrast.


## Design Principles

- **Token-Based Design:** Every visual value is a named design token — no hardcoded colors, sizes, or shadows anywhere in component code.
- **WCAG Compliance:** Every color pair must meet WCAG 2.1 AA contrast (4.5:1 normal text, 3:1 large text). The generator validates at generation time.
- **Reduced Motion Respect:** All motion durations collapse to 0ms when prefers-reduced-motion is active. This is built into the motion token system, not opt-in.
- **Theme Layering:** Themes are layered: base + variants. Multiple variants can be active simultaneously, resolved by priority then activation order.
**generate:**
- [ ] Theme name is kebab-case?
- [ ] Primary color generates full 50-950 scale?
- [ ] Palette has semantic roles (primary, secondary, error, etc.)?
- [ ] WCAG contrast ratios meet AA standard (4.5:1 normal, 3:1 large)?
- [ ] Typography uses modular ratio scale?
- [ ] Motion respects prefers-reduced-motion?
- [ ] Elevation scale covers 0-5 levels?
- [ ] Light and dark themes are generated (if mode=both)?
- [ ] Palette uses oklch() for perceptual uniformity?
- [ ] Spacing follows a consistent base multiplier?
- [ ] Radius tokens defined?
- [ ] All files written through Emitter (not directly to disk)?
- [ ] Source provenance attached to each file?
- [ ] Generation step recorded in GenerationPlan?
## References

- [Clef Surface design system and theme architecture](references/surface-theme-guide.md)
- [Theme specification grammar](references/theme-grammar.md)
## Supporting Materials

- [Clef Surface theme scaffolding walkthrough](examples/scaffold-surface-theme.md)
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
| `suite.yaml` | Theme suite manifest |
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

*Generate a Clef Surface theme scaffold:*
```bash
npx tsx cli/src/index.ts scaffold theme --name ocean --primary 220 --font 'Inter, sans-serif'
```
*Run scaffold generator tests:*
```bash
npx vitest run tests/scaffold-generators.test.ts
```
**Related tools:** [object Object], [object Object]

