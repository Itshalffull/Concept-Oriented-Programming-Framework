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

## Generation Pipeline

This scaffold generator participates in the COPF generation pipeline. The full flow is:

1. **Register** -- Generator self-registers with PluginRegistry and KindSystem (ThemeConfig → CoifTheme).
2. **Track Input** -- Scaffold configuration is recorded as a Resource for change detection.
3. **Check Cache** -- BuildCache determines if regeneration is needed based on input hash.
4. **Preview** -- Dry-run via Emitter content-addressing shows what files would change.
5. **Generate** -- The actual theme tokens, palettes, and manifests are produced.
6. **Emit & Record** -- Files are written through Emitter with provenance; the run is recorded in GenerationPlan.

## Step-by-Step Process

### Step 1: Register Generator

Self-register with PluginRegistry so the scaffolding kit's KindSystem can track ThemeConfig → CoifTheme transformations. Registers inputKind → outputKind transformation in KindSystem for pipeline validation.

**Examples:**
*Register the theme scaffold generator*
```typescript
const result = await coifThemeScaffoldGenHandler.register({}, storage);

```

### Step 2: Track Input via Resource

Register the scaffold configuration as a tracked resource using Resource/upsert. This enables change detection -- if the same configuration is provided again, Resource reports it as unchanged and downstream steps can be skipped.

**Pipeline:** `Resource/upsert(locator, kind: "ThemeConfig", digest)`

**Checklist:**
- [ ] Input configuration serialized deterministically?
- [ ] Resource locator uniquely identifies this scaffold request?

### Step 3: Check BuildCache

Query BuildCache/check to determine if this scaffold needs regeneration. If the input hash matches the last successful run and the transform is deterministic, the cached output can be reused without re-running the generator.

**Pipeline:** `BuildCache/check(stepKey: "CoifThemeScaffoldGen", inputHash, deterministic: true)`

**Checklist:**
- [ ] Cache hit returns previous output reference?
- [ ] Cache miss triggers full generation?

### Step 4: Preview Changes

Dry-run the generation using Emitter content-addressing to classify each output file as new, changed, or unchanged. No files are written -- this step shows what *would* happen.

**Pipeline:** `CoifThemeScaffoldGen/preview(...) → Emitter content-hash comparison`

**Examples:**
*Preview scaffold changes*
```bash
copf scaffold theme preview --name ocean
```

### Step 5: Generate COIF Theme

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

### Step 6: Emit via Emitter & Record in GenerationPlan

Write generated files through Emitter/writeBatch with source provenance tracking. Then record the step outcome in GenerationPlan/recordStep for run history and status reporting.

**Pipeline:** `Emitter/writeBatch(files, sources) → GenerationPlan/recordStep(stepKey, status: "done")`

**Checklist:**
- [ ] All files written through Emitter (not directly to disk)?
- [ ] Source provenance attached to each file?
- [ ] Generation step recorded in GenerationPlan?

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
| `/emitter` | Write scaffold files with content-addressing and source traceability |
| `/build-cache` | Skip unchanged scaffolds via incremental build cache |
| `/resource` | Track scaffold input configurations for change detection |
| `/generation-plan` | Monitor scaffold generation runs and status |
| `/kind-system` | Validate scaffold input/output kind transformations |

