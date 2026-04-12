# Clef Base Theme System — Remediation and Expressive Upgrade PRD

**Version:** 1.0.0
**Date:** 2026-04-11
**Status:** Implementation-ready
**Research inputs:** local audit of `clef-base` theme usage, `docs/plans/clef-surface-theming-v1.md`
**Scope:** `clef-base` runtime theming, theme generation, theme-aware widget selection, expressive theme authoring
**New concepts:** 0
**Modified concepts:** 0
**New widgets:** 1
**Modified widgets/components:** AppShell, Sidebar, Card, Badge, theme preview surfaces, theme-aware display widgets
**New views:** 1
**New syncs:** 0

---

## 0. Problem Statement

Clef has a much richer theming architecture than `clef-base` currently demonstrates, but the app uses only a narrow slice of it and some of that slice appears broken in practice.

Today `clef-base` does support:
- whole-theme switching
- palette swaps
- typography swaps
- density toggles
- shell motif toggles such as sidebar vs topbar

That is enough to prove the plumbing exists, but not enough to make the product feel intentionally designed. The current result still reads as a generic admin shell with recolored tokens. More seriously, some generated theme CSS appears malformed, which means parts of the advanced theming system may not be rendering correctly at all.

### 0.1 What Exists Today

| Area | Current State | Gap |
|---|---|---|
| Theme inventory | `light`, `dark`, `high-contrast`, `editorial`, `signal` | Only two themes have a distinct authored personality |
| Theme activation | Active theme is resolved at boot and applied to document state | Good foundation |
| Token output | `themes.generated.css` emits palette, type, spacing, motion, elevation, radius tokens | Some emitted values appear invalid or unresolved |
| Shell adaptation | Density and motif change shell layout behavior | Only shallow structural adaptation |
| Widget adaptation | Theme context is passed to resolver | Resolver mostly ignores context when picking widgets |
| Component styling | Many components use theme vars | Some still hardcode inline colors, radii, and fallback styles |
| Expressive theme model | Parser recognizes expressive blocks | `clef-base` barely turns that capability into UI behavior |

### 0.2 User-Facing Symptoms

- Themes feel like skins, not design systems
- Visual language is inconsistent across screens
- Editorial and Signal themes do not reshape enough of the UI to feel truly different
- Parts of the interface still look neutral or ugly under every theme because they bypass the token system
- Theme switching does not drive enough widget-level or layout-level variation to justify the architectural complexity

### 0.3 Root Causes

1. Theme generation quality is not yet reliable enough for advanced tokens to be trusted.
2. Theme semantics such as `styleProfile`, `motif`, and `density` are not deeply consumed by widget selection or component rendering.
3. Too much `clef-base` UI is authored as one-off admin styling instead of semantic themed surfaces.
4. Theme authoring is broader in the framework than in the app; `clef-base` lacks a curated set of beautiful, opinionated themes that exercise the system.

### 0.4 Product Goal

Make `clef-base` prove that Clef theming is both technically robust and aesthetically compelling:

- theme output must be valid and dependable
- the app must read as intentionally designed under each active theme
- expressive theme metadata must have observable UI consequences
- at least three themes must feel genuinely distinct in structure and mood, not just hue

---

## 1. Design Principles

### 1.1 Fix Correctness Before Expanding Surface Area

The first job is to make theme code generation and token consumption correct. New themes added on top of malformed token output will only multiply inconsistency.

### 1.2 Themes Should Change More Than Color

A theme in `clef-base` should be able to influence:
- shell motif
- density
- typography voice
- shape language
- surface treatment
- widget choice where appropriate
- tone of supporting affordances such as badges, cards, tables, and empty states

### 1.3 Use Semantic Tokens, Not Component-Specific Hardcoding

Components should consume semantic design tokens rather than invent local colors, radii, and shadows inline. This keeps visual change centralized and makes new themes cheap to author.

### 1.4 Make Expressive Themes Visible in `clef-base`

The framework already models expressive inputs like `styleProfile`, `structuralMotif`, and `density`. `clef-base` should become the reference app that demonstrates those capabilities clearly.

### 1.5 Ship a Small Number of Strong Themes

Five mediocre themes do less for the product than three strong ones. The goal is not theme count. The goal is obvious design differentiation.

---

## 2. Scope

### 2.1 In Scope

- repair malformed theme token generation used by `clef-base`
- normalize token alias resolution for typography, motion, elevation, and radius
- remove or reduce hardcoded visual styling in core `clef-base` surfaces
- make theme context materially affect widget and layout resolution
- improve the built-in theme showcase and previews
- author or refine a curated set of beautiful themes for `clef-base`
- add tests that catch malformed token output and invalid alias emission

### 2.2 Out of Scope

- introducing entirely new theming concepts into Surface
- redesigning every admin screen from scratch in a single pass
- building a full end-user theme editor
- adding external image-generation or design-tool integrations

---

## 3. Deliverables

### 3.1 Theme Pipeline Correctness

- Theme generation emits valid CSS values for typography, motion, elevation, and radius tokens
- Theme alias tokens resolve to concrete usable values or valid custom-property references
- A verification path catches malformed output before it lands in `clef-base`

### 3.2 Theme Consumption Cleanup

- Core shell and shared widgets consume semantic theme tokens consistently
- Hardcoded inline visual values are removed or reduced in the most visible surfaces
- Theme variables cover shell chrome, cards, badges, form chrome, status surfaces, and empty states coherently

### 3.3 Theme-Aware Surface Behavior

- Widget selection actually uses theme context in meaningful ways
- Motif and density influence chosen display widgets where there are valid alternatives
- Shell and display surfaces feel different under editorial vs signal vs default themes

### 3.4 Curated Theme Pack

- Refined `editorial`
- Refined `signal`
- One new high-quality theme with a clearly different visual voice
- Improved light/dark/high-contrast baselines so fallback themes do not look neglected

### 3.5 Theme Showcase in `clef-base`

- A better themes admin page with stronger previews
- Side-by-side token and component previews that help evaluate design quality
- Clear display of what a theme changes: palette, typography, density, motif, surface treatment

---

## 4. Implementation Plan

## 4.1 Theme Output Repair

### Objective

Ensure `clef-base` can trust the generated theme CSS.

### Work

- audit `handlers/ts/app/theme-gen.handler.ts` and any post-processing path producing `clef-base/app/styles/themes.generated.css`
- correct serialization of:
  - typography scalar values
  - cubic-bezier and related motion values
  - elevation references
  - radius aliases
- decide a consistent alias strategy:
  - either emit concrete values for `--elevation-card`, `--radius-card`, etc.
  - or emit valid `var(--token)` references, not symbolic names like `level-1` or `lg`
- add tests over generated CSS for the token categories currently failing or suspicious

### Success Criteria

- no malformed token values such as trailing `,;`
- no unresolved symbolic alias values where concrete CSS is required
- global styles that reference theme tokens render correctly without silent fallback

### Deliverables

- fixed theme generator logic
- regression tests for emitted CSS token syntax
- documented token alias conventions

## 4.2 Shared Surface Tokenization

### Objective

Make the most visible `clef-base` surfaces visually coherent under theme control.

### Work

- audit core shared surfaces:
  - `AppShell`
  - `Sidebar`
  - `Card`
  - `Badge`
  - theme list / theme preview surfaces
  - major admin wrappers and empty states
- replace hardcoded inline colors, radii, and neutral fallbacks with semantic tokens
- define missing semantic tokens only if they can be represented within current theme output
- consolidate repeated shell styling into CSS classes where practical

### Success Criteria

- shell chrome looks intentionally themed
- no obvious unthemed neutral bars or fallback colors remain in primary navigation surfaces
- editorial and signal themes affect the whole shell, not just headings and accent colors

### Deliverables

- updated shared components
- reduced inline visual styling debt
- theme-consumption audit checklist for future components

## 4.3 Theme-Aware Widget Resolution

### Objective

Turn theme metadata into observable UI adaptation.

### Work

- extend `WidgetResolver` scoring so context is not ignored
- consume:
  - `density`
  - `motif`
  - `styleProfile`
  - `sourceType`
- honor affordance metadata such as `motifOptimized` and density-sensitive behavior
- support alternate widget selection only where there is a real UX benefit, not theme gimmicks

### Success Criteria

- compact/topbar themes bias toward denser or more scan-friendly displays
- sidebar/editorial themes can bias toward richer card/detail treatments
- theme-aware resolution is deterministic and testable

### Deliverables

- updated resolver behavior
- tests for themed resolution paths
- refined affordance seeds where necessary

## 4.4 Curated Expressive Themes

### Objective

Make `clef-base` visibly beautiful under a small set of well-authored themes.

### Theme Targets

| Theme | Direction | Target Feel |
|---|---|---|
| `editorial` | warm serif, generous spacing, quieter chrome | magazine / publishing desk |
| `signal` | compact, crisp, high-contrast dark shell | terminal-informed operations console |
| `atelier` (working name) | light, precise, design-tool-like | studio / craft workspace |

### Work

- refine existing theme token sets
- strengthen differences in:
  - typography
  - spacing density
  - radii / shape
  - surface treatment
  - shell motif
- ensure themes remain accessible and readable
- keep high-contrast functional rather than decorative

### Success Criteria

- users can instantly tell themes apart from screenshots
- at least three themes feel like different product personalities
- none of the themes degrade usability or legibility

### Deliverables

- revised seeded themes
- one new seeded theme
- component previews proving distinct personalities

## 4.5 Theme Showcase and Evaluation Surface

### Objective

Give `clef-base` a practical way to inspect theme quality.

### Work

- upgrade the Themes admin view
- add previews for:
  - shell chrome
  - cards
  - badges / status surfaces
  - buttons / inputs
  - typography scale
  - table row density
- show active motif, density, style profile, and source type in a more legible way
- add a dedicated theme preview widget for compact visual comparison

### Success Criteria

- theme decisions can be evaluated without manually browsing many pages
- token changes are reflected in meaningful component previews
- themes page becomes a usable design QA surface

### Deliverables

- upgraded `ThemesView`
- new theme preview widget/component
- stronger theme diagnostics in UI

---

## 5. Concept Changes

No new Clef concepts are required for this PRD.

No concept schema changes are required for the first pass.

This work intentionally treats the problem as:
- theme generation correctness
- better theme consumption
- better use of existing theme metadata

If implementation reveals missing semantic storage in `Theme` or `Affordance`, that should be captured as a follow-up PRD rather than folded silently into this one.

---

## 6. Syncs

No new sync files are required in the first pass.

Expected sync impact:
- existing theme activation flow remains in place
- existing widget resolution flow remains in place
- existing seed/bootstrap behavior remains in place

Potential follow-up, if needed:
- a sync that indexes theme preview metadata for richer design QA
- a sync that validates generated theme implementation artifacts against spec expectations during build or startup

---

## 7. Widgets

### 7.1 New Widget

**Theme Preview Panel**  
Purpose: compact but expressive preview of a theme across core UI primitives.

Responsibilities:
- render sample shell chrome
- render sample cards, badges, and inputs
- render a short type hierarchy sample
- show density and motif effects

### 7.2 Existing Widgets / Components to Update

- `Card`
- `Badge`
- `Sidebar`
- `AppShell`
- theme cards and preview surfaces in `ThemesView`
- display widgets most visibly affected by density and motif selection

---

## 8. Views

### 8.1 New / Updated Views

**Themes Admin View**
- upgrade existing themes page into a design QA surface
- include preview panel, token summary, and expressive metadata summary

### 8.2 No Broader Navigation Expansion Required

This work should not create a new top-level destination unless the upgraded themes page materially outgrows the current route structure.

---

## 9. Seeds

### 9.1 Theme Seeds to Update

- `light`
- `dark`
- `high-contrast`
- `editorial`
- `signal`

### 9.2 Theme Seeds to Add

- one new premium-quality reference theme, working name `atelier`

### 9.3 Affordance Seeds to Review

- review `Affordance` entries for motif and density metadata
- tighten conditions only where widget choice truly changes by theme context

### 9.4 Possible Supporting Seeds

- theme preview examples if the preview panel needs seed-backed fixtures or demo content

---

## 10. Clef Base Integration Checklist

- [ ] Theme generation emits valid CSS token output for all seeded themes
- [ ] Shared shell surfaces consume semantic theme tokens consistently
- [ ] No obvious hardcoded neutral/fallback styling remains in primary shell chrome
- [ ] WidgetResolver uses theme context for real scoring decisions
- [ ] Affordance metadata is honored where applicable
- [ ] Themes admin page provides meaningful previews
- [ ] `editorial` feels materially different from `light`
- [ ] `signal` feels materially different from `dark`
- [ ] one new curated theme is added and seeded
- [ ] high-contrast remains accessibility-first
- [ ] regression tests exist for malformed token emission
- [ ] regression tests exist for theme-aware widget resolution behavior

---

## 11. Testing Strategy

### 11.1 Generator Tests

- assert emitted CSS values are syntactically valid for representative typography, motion, elevation, and radius tokens
- assert alias tokens resolve in a way consumers can actually use

### 11.2 Component / UI Tests

- verify shell renders under multiple themes without unthemed fallback chrome
- verify preview panel reflects theme differences

### 11.3 Resolver Tests

- verify resolver output changes when motif and density context should matter
- verify resolver stays stable when theme context should not matter

### 11.4 Manual Design QA

- evaluate screenshots of the same page across all seeded themes
- compare shell, forms, list views, card views, and empty states

---

## 12. Risks and Open Questions

### Risks

- fixing generator correctness may reveal more broken downstream assumptions than expected
- deep tokenization of shared components may touch many files
- theme-aware widget resolution can become arbitrary if not bounded tightly
- adding a new theme without enough component cleanup could make the app feel more inconsistent, not less

### Open Questions

1. Should elevation and radius aliases resolve to concrete CSS values or to second-order custom properties?
2. Do we want one new theme or two, if the second is small but useful as a contrast case?
3. Should theme QA live only on the themes page, or also on a hidden internal preview route?
4. Is `styleProfile` purely descriptive in this pass, or should it directly influence more components beyond widget selection?

---

## 13. Kanban Card Table

| Card | Deliverable | Section | Depends On | Unblocks | Priority | Commit |
|---|---|---|---|---|---|---|
| MAG-643 | Theme generator correctness and token alias repair | §4.1 | — | MAG-644, MAG-645, MAG-646 | high | `aa179183` |
| MAG-644 | Shared shell tokenization cleanup | §4.2 | MAG-643 | MAG-646, MAG-647, MAG-648 | high | `5b454276` |
| MAG-645 | Theme-aware widget resolution and affordance scoring | §4.3 | MAG-643 | MAG-647, MAG-648 | medium | `cef37255` |
| MAG-646 | Curated theme token refinement for existing themes | §4.4 | MAG-643 | MAG-647, MAG-648 | medium | `0fdf758b` |
| MAG-647 | Themes admin preview surface and theme QA widget | §4.5 | MAG-644, MAG-645, MAG-646 | MAG-648 | medium | `3000bd23` |
| MAG-648 | Final theme polish, regression coverage, and rollout verification | §10, §11 | MAG-644, MAG-645, MAG-646, MAG-647 | — | medium | |

### Notes

- Card IDs now reference the live Vibe Kanban epic `MAG-642`.
- Execution should begin with generator correctness, because downstream styling work depends on trusted token output.

---

## 14. Card Breakdown

This section decomposes the PRD into execution-sized cards with clear write scopes and acceptance criteria. These are now represented as VK cards under epic `MAG-642`.

## 14.1 MAG-643 — Theme Generator Correctness and Token Alias Repair

**Owner type:** `general-purpose`  
**Primary write scope:**
- `handlers/ts/app/theme-gen.handler.ts`
- theme generation tests
- any generation path that emits `clef-base/app/styles/themes.generated.css`

**Goal**

Repair malformed theme CSS emission so downstream theme work is operating on valid token output.

**Tasks**

- identify where malformed values such as trailing `,;` are introduced
- fix serialization for typography scalar tokens
- fix serialization for motion/easing tokens
- fix elevation alias emission
- fix radius alias emission
- define and document alias output conventions
- add regression tests for representative emitted token values

**Acceptance criteria**

- emitted typography values are valid CSS scalars
- emitted motion tokens are valid CSS values
- elevation and radius aliases resolve in a form consumers can use
- tests fail if malformed output reappears

**Risks**

- may expose additional assumptions in consuming CSS

## 14.2 MAG-644 — Shared Shell Tokenization Cleanup

**Owner type:** `general-purpose`  
**Primary write scope:**
- `clef-base/app/components/AppShell.tsx`
- `clef-base/app/styles/globals.css`
- shared shell-facing components such as Sidebar, Card, Badge

**Goal**

Eliminate the most visible hardcoded visual values from shared shell surfaces and move them onto theme tokens.

**Tasks**

- audit shell chrome for hardcoded inline styling
- replace fallback neutral colors with semantic tokens
- replace hardcoded radii and shadows where possible
- move repeated shell styling into CSS classes when practical
- ensure token usage is consistent across shell, navigation, and shared cards

**Acceptance criteria**

- no obvious unthemed bars or hardcoded neutral shell elements remain
- shell looks coherent under `light`, `dark`, `editorial`, and `signal`
- shared card and badge surfaces visually belong to the active theme

**Risks**

- may require coordinated changes across multiple components

## 14.3 MAG-645 — Theme-Aware Widget Resolution and Affordance Scoring

**Owner type:** `general-purpose`  
**Primary write scope:**
- `handlers/ts/app/widget-resolver.handler.ts`
- `handlers/ts/app/affordance.handler.ts` if needed
- `clef-base/seeds/Affordance.seeds.yaml`
- resolver tests

**Goal**

Make theme context materially influence display-widget selection where there is a real UX benefit.

**Tasks**

- update resolver scoring to evaluate supplied context instead of ignoring it
- incorporate `density`, `motif`, `styleProfile`, and `sourceType` where appropriate
- honor affordance metadata such as `motifOptimized`
- refine affordance seeds if current values are too vague or misleading
- add tests for deterministic theme-aware resolution

**Acceptance criteria**

- compact/topbar themes can bias toward denser displays when appropriate
- sidebar/editorial themes can bias toward richer displays when appropriate
- resolver behavior is deterministic and covered by tests

**Risks**

- over-theming widget selection could feel arbitrary if not bounded carefully

## 14.4 MAG-646 — Curated Theme Token Refinement for Existing Themes

**Owner type:** `general-purpose`  
**Primary write scope:**
- `clef-base/seeds/Theme.seeds.yaml`
- theme source inputs or generated theme assets used by `clef-base`
- supporting theme CSS or generation fixtures

**Goal**

Turn the current theme set into a smaller set of stronger, more clearly differentiated visual systems.

**Tasks**

- refine `editorial`
- refine `signal`
- improve baseline `light` and `dark`
- keep `high-contrast` accessibility-first
- ensure differences show up in typography, spacing, shell chrome, and surfaces

**Acceptance criteria**

- at least three themes are visually distinct at a glance
- default themes no longer feel neglected relative to expressive themes
- the existing theme pack remains fully seeded and usable in `clef-base`

**Risks**

- theme refinement may be partially blocked until shared surface tokenization lands

## 14.5 MAG-647 — Themes Admin Preview Surface and Theme QA Widget

**Owner type:** `general-purpose`  
**Primary write scope:**
- `clef-base/app/views/ThemesView.tsx`
- new preview widget/component files under `clef-base/app/components/widgets/`
- supporting styles

**Goal**

Turn the themes page into a practical design QA surface rather than a list of theme records.

**Tasks**

- add a reusable theme preview widget/panel
- show shell, cards, badges, inputs, and typography previews
- show active density, motif, style profile, and source type clearly
- improve theme card layout and comparison affordances

**Acceptance criteria**

- themes can be evaluated visually from the admin page
- previews expose meaningful differences between themes
- the page supports quick QA without visiting many destinations

**Risks**

- preview fidelity depends on shared token cleanup and theme refinement landing first

## 14.6 MAG-648 — Final Theme Polish, Regression Coverage, and Rollout Verification

**Owner type:** `general-purpose`  
**Primary write scope:**
- tests
- small cross-cutting fixes discovered during QA
- PRD update with final commit hashes once execution happens

**Goal**

Close the loop with regression coverage and final quality verification across the full themed experience.

**Tasks**

- add or finalize generator regression tests
- add or finalize resolver behavior tests
- perform manual cross-theme QA on core surfaces
- fix remaining polish issues found during QA
- verify integration checklist items in §10

**Acceptance criteria**

- generator, resolver, and core preview surfaces are covered by tests
- the integration checklist is materially satisfied
- there are no obvious theme regressions on primary `clef-base` routes

**Risks**

- this card may collect too much spillover if earlier cards are underspecified; keep it focused on verification and small polish

---

## 15. Execution Order

### Critical Path

1. `MAG-643` — fix generator correctness first
2. `MAG-644` — clean up shared token consumption
3. `MAG-646` — refine themes once the shared surfaces are trustworthy
4. `MAG-647` — build preview/QA surface on top of improved theming
5. `MAG-648` — regression coverage and final polish

### Parallelizable Work

- `MAG-645` can start after `MAG-643` and run in parallel with `MAG-644`
- `MAG-646` can overlap with late `MAG-644` work if the shared token model is stable

### Suggested Agent Mapping

| Card | Suggested agent type |
|---|---|
| MAG-643 | `general-purpose` |
| MAG-644 | `general-purpose` |
| MAG-645 | `general-purpose` |
| MAG-646 | `general-purpose` |
| MAG-647 | `general-purpose` |
| MAG-648 | `general-purpose` |

---

## 16. Commit-Sized Execution Slices

This section refines each card into commit-sized units with explicit file ownership. The goal is to make "commit per card" achievable without hidden scope creep.

## 16.1 MAG-TBD-1 — Theme Generator Correctness and Token Alias Repair

### Slice 1A — Typography and Motion Serialization

**Commit scope**
- `handlers/ts/app/theme-gen.handler.ts`
- tests covering typography and motion token emission

**Owned files**
- [theme-gen.handler.ts](/home/trinley/Documents/Github/Concept-Oriented-Programming-Framework/handlers/ts/app/theme-gen.handler.ts:1)

**Out of scope for this slice**
- elevation alias repair
- radius alias repair
- `clef-base` component styling

**Done when**
- no malformed typography scalar output remains
- no malformed motion/easing output remains
- tests cover representative typography and motion token cases

### Slice 1B — Elevation and Radius Alias Resolution

**Commit scope**
- `handlers/ts/app/theme-gen.handler.ts`
- tests covering elevation and radius alias emission

**Owned files**
- [theme-gen.handler.ts](/home/trinley/Documents/Github/Concept-Oriented-Programming-Framework/handlers/ts/app/theme-gen.handler.ts:1)

**Out of scope for this slice**
- shell CSS consumers
- theme seed refinement

**Done when**
- elevation aliases resolve to usable CSS output
- radius aliases resolve to usable CSS output
- tests fail on symbolic unresolved output where concrete CSS is required

### Slice 1C — Consumer Compatibility Verification

**Commit scope**
- tests and small compatibility fixes only

**Owned files**
- generator test files
- any tiny consumer adjustments required by the repaired alias format

**Out of scope for this slice**
- visual redesign
- resolver behavior

**Done when**
- the repaired output format is consumed correctly by existing global styles
- there is a clear token alias convention for later cards to follow

## 16.2 MAG-TBD-2 — Shared Shell Tokenization Cleanup

### Slice 2A — AppShell Chrome Cleanup

**Commit scope**
- `clef-base/app/components/AppShell.tsx`
- supporting shell CSS in `globals.css`

**Owned files**
- [AppShell.tsx](/home/trinley/Documents/Github/Concept-Oriented-Programming-Framework/clef-base/app/components/AppShell.tsx:1)
- [globals.css](/home/trinley/Documents/Github/Concept-Oriented-Programming-Framework/clef-base/app/styles/globals.css:1)

**Out of scope for this slice**
- Sidebar internals
- Card / Badge styling
- theme preview page

**Done when**
- space indicator bar and header chrome stop using obvious hardcoded neutral styling
- shell-level visual values come from semantic tokens or stable CSS classes

### Slice 2B — Sidebar and Navigation Surface Cleanup

**Commit scope**
- sidebar-related components and shell navigation CSS

**Owned files**
- Sidebar component files
- [globals.css](/home/trinley/Documents/Github/Concept-Oriented-Programming-Framework/clef-base/app/styles/globals.css:1)

**Out of scope for this slice**
- theme cards
- non-navigation widgets

**Done when**
- sidebar navigation looks coherent under all primary themes
- there are no obvious fallback neutral states in primary navigation affordances

### Slice 2C — Shared Card and Badge Surface Cleanup

**Commit scope**
- shared card and badge components
- supporting CSS tokens/classes

**Owned files**
- Card component files
- Badge component files
- [globals.css](/home/trinley/Documents/Github/Concept-Oriented-Programming-Framework/clef-base/app/styles/globals.css:1)

**Out of scope for this slice**
- themes page redesign
- widget resolution behavior

**Done when**
- cards and badges visually belong to each active theme
- shared surface styling no longer depends on ad hoc per-view fixes

## 16.3 MAG-TBD-3 — Theme-Aware Widget Resolution and Affordance Scoring

### Slice 3A — Resolver Context Scoring

**Commit scope**
- `WidgetResolver` only
- resolver tests

**Owned files**
- [widget-resolver.handler.ts](/home/trinley/Documents/Github/Concept-Oriented-Programming-Framework/handlers/ts/app/widget-resolver.handler.ts:1)

**Out of scope for this slice**
- seed changes
- UI previews

**Done when**
- resolver uses supplied context rather than ignoring it
- scoring remains deterministic and covered by tests

### Slice 3B — Affordance Metadata Integration

**Commit scope**
- affordance interpretation
- affordance seed cleanup

**Owned files**
- affordance handler files if needed
- [Affordance.seeds.yaml](/home/trinley/Documents/Github/Concept-Oriented-Programming-Framework/clef-base/seeds/Affordance.seeds.yaml:1)

**Out of scope for this slice**
- theme page UI
- shell tokenization

**Done when**
- `motifOptimized` and related metadata materially influence eligible matches
- affordance seeds express the intended distinctions clearly

## 16.4 MAG-TBD-4 — Curated Theme Token Refinement for Existing Themes

### Slice 4A — Baseline Theme Repair

**Commit scope**
- `light`, `dark`, `high-contrast` refinement

**Owned files**
- [Theme.seeds.yaml](/home/trinley/Documents/Github/Concept-Oriented-Programming-Framework/clef-base/seeds/Theme.seeds.yaml:1)
- theme source inputs or generated theme assets tied to those themes

**Out of scope for this slice**
- `editorial`
- `signal`
- new theme creation

**Done when**
- baseline themes stop feeling like neglected defaults
- high-contrast remains accessibility-first

### Slice 4B — Editorial and Signal Refinement

**Commit scope**
- refine `editorial`
- refine `signal`

**Owned files**
- [Theme.seeds.yaml](/home/trinley/Documents/Github/Concept-Oriented-Programming-Framework/clef-base/seeds/Theme.seeds.yaml:1)
- theme source inputs or generated assets for those themes

**Out of scope for this slice**
- new theme introduction

**Done when**
- editorial and signal are visibly differentiated from baseline themes
- differences are noticeable in typography, spacing, shell chrome, and surfaces

### Slice 4C — New Theme Introduction

**Commit scope**
- add `atelier` or final chosen new theme
- seed and integrate it into the theme list

**Owned files**
- [Theme.seeds.yaml](/home/trinley/Documents/Github/Concept-Oriented-Programming-Framework/clef-base/seeds/Theme.seeds.yaml:1)
- any theme source inputs or generated outputs associated with the new theme

**Out of scope for this slice**
- preview widget implementation

**Done when**
- one new high-quality theme is added, seeded, and selectable
- it has a clearly different visual voice

## 16.5 MAG-TBD-5 — Themes Admin Preview Surface and Theme QA Widget

### Slice 5A — Theme Preview Widget

**Commit scope**
- new preview widget/component
- local supporting styles

**Owned files**
- new files under `clef-base/app/components/widgets/`

**Out of scope for this slice**
- full themes page layout redesign
- resolver changes

**Done when**
- a reusable preview panel exists for shell chrome, cards, badges, inputs, and type

### Slice 5B — Themes Page Integration

**Commit scope**
- `ThemesView`
- integration of the preview widget into the page

**Owned files**
- [ThemesView.tsx](/home/trinley/Documents/Github/Concept-Oriented-Programming-Framework/clef-base/app/views/ThemesView.tsx:1)
- any directly supporting page-local files

**Out of scope for this slice**
- new theme generation logic

**Done when**
- the themes page becomes a useful visual QA surface
- theme metadata is displayed in a legible, design-relevant way

## 16.6 MAG-TBD-6 — Final Theme Polish, Regression Coverage, and Rollout Verification

### Slice 6A — Regression Coverage Completion

**Commit scope**
- generator tests
- resolver tests
- preview surface tests where practical

**Owned files**
- test files only, plus minimal wiring required to support them

**Out of scope for this slice**
- broad redesign changes

**Done when**
- core regressions are covered by automated tests

### Slice 6B — Visual QA Polish Pass

**Commit scope**
- small polish fixes discovered during manual QA

**Owned files**
- only files with narrow polish adjustments

**Out of scope for this slice**
- new features
- large structural rewrites

**Done when**
- the integration checklist in §10 is materially satisfied
- no obvious cross-theme polish issues remain on primary routes

---

## 17. File Ownership Summary

Use this table to avoid overlap when multiple agents or contributors are working in parallel.

| Slice | Primary ownership |
|---|---|
| 1A | `handlers/ts/app/theme-gen.handler.ts` + generator tests |
| 1B | `handlers/ts/app/theme-gen.handler.ts` + alias tests |
| 1C | tests + tiny consumer compatibility fixes |
| 2A | `clef-base/app/components/AppShell.tsx`, `clef-base/app/styles/globals.css` |
| 2B | sidebar component files, `clef-base/app/styles/globals.css` |
| 2C | shared card/badge component files, `clef-base/app/styles/globals.css` |
| 3A | `handlers/ts/app/widget-resolver.handler.ts` + resolver tests |
| 3B | affordance handler files if needed, `clef-base/seeds/Affordance.seeds.yaml` |
| 4A | `clef-base/seeds/Theme.seeds.yaml` + baseline theme assets |
| 4B | `clef-base/seeds/Theme.seeds.yaml` + editorial/signal theme assets |
| 4C | `clef-base/seeds/Theme.seeds.yaml` + new theme assets |
| 5A | new theme preview widget/component files |
| 5B | `clef-base/app/views/ThemesView.tsx` + page-local support |
| 6A | test files |
| 6B | narrow polish fixes only |

### Coordination Rules

- `globals.css` is a shared hotspot; do not assign slices `2A`, `2B`, and `2C` concurrently without explicit coordination.
- `Theme.seeds.yaml` is a shared hotspot; do not assign `4A`, `4B`, and `4C` concurrently unless one contributor owns all theme seed edits.
- `theme-gen.handler.ts` is a shared hotspot; keep `1A` and `1B` sequential.
- `3A` can run in parallel with `2A` or `2B`.
- `5A` can start once the preview requirements are stable, even if `5B` waits for refined themes.
