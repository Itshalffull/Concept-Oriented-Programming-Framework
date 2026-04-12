# Clef Base Theme Audit — Wave 2 PRD

**Version:** 1.0.0
**Date:** 2026-04-12
**Status:** Implementation-ready
**Research inputs:** post-implementation audit of `clef-base` components and views after `MAG-642`
**Scope:** remaining `clef-base` theme-awareness gaps in primary admin flows and inherited repertoire-style widgets
**New concepts:** 0
**Modified concepts:** 0
**New widgets:** 0
**Modified widgets/components:** popovers, pickers, form widgets, data displays, graph/canvas displays, workspace/editor chrome
**New views:** 0
**New syncs:** 0

---

## 0. Problem Statement

The first `clef-base` theme-system pass fixed the theme pipeline, improved shell chrome, added theme-aware widget selection, refined the seed theme pack, and upgraded the themes page into a useful QA surface.

That work materially improved the product, but it did not fully close the audit. A second pass is still needed across the components and views that `clef-base` actively uses in primary admin flows, including many repertoire-derived widgets that have been adapted into the app.

The remaining issue is not that these components ignore theme tokens entirely. Many of them already reference palette, spacing, and typography tokens. The problem is that too many still:

- rely on large inline style objects instead of shared semantic classes
- encode component chrome locally rather than through reusable themed surface patterns
- mix semantic tokens with literal fallback values or fixed shadow treatments
- use raw semantic-color maps for graph/canvas visualization instead of theme-driven visualization tokens

So the product is now partially theme-aware, but not yet comprehensively theme-system driven.

### 0.1 Current Audit Status

| Area | Status | Remaining Gap |
|---|---|---|
| Theme generation | repaired | mostly complete |
| Shell chrome | improved | some secondary shell/view wrappers still inline-heavy |
| Theme-aware widget selection | implemented | could be extended with richer affordance curation later |
| Theme preview / QA surface | implemented | now exposes remaining component debt more clearly |
| Shared popovers and pickers | partially themed | still largely inline-authored |
| Form and field widgets | partially themed | large surface area still locally styled |
| Data display widgets | mixed | some displays still use one-off per-widget chrome |
| Graph / canvas visualization | not fully theme-aware | hardcoded semantic color maps remain |
| Primary admin views | token-colored | many still not componentized into semantic themed surfaces |

### 0.2 Product Goal

Finish the `clef-base` theme audit at the level users actually experience:

- primary admin flows should feel coherently themed
- repertoire-derived widgets used by `clef-base` should respect the app’s theme system, not just borrow token strings
- graph and visualization surfaces should stop relying on raw hardcoded semantic colors
- shared interaction patterns like popovers, pickers, and form controls should read as one design system

---

## 1. Design Principles

### 1.1 Audit What `clef-base` Actually Uses

This pass should prioritize `clef-base` surfaces that are visible in daily admin work, not abstract repo-wide purity.

### 1.2 Prefer Shared Themed Surfaces Over Inline Styling

If multiple widgets need the same panel, picker, field, toolbar, or alert treatment, move that treatment into a reusable semantic class instead of duplicating tokenized inline objects.

### 1.3 Distinguish Token Usage From Real Theme Awareness

A component is not “done” just because it uses `var(--palette-...)`. It is theme-aware when:

- semantic tokens drive the main visual treatment
- component chrome is not hardcoded locally
- density/motif/profile changes do not immediately expose local styling mismatches

### 1.4 Preserve `clef-base` Ownership of Inherited Widgets

Many widgets originate in repertoire patterns, but once they are used in `clef-base`, the app still needs to supply the themed visual contract for them.

### 1.5 Keep This Pass Bounded

This PRD should finish the audit, not reopen the theme-system architecture. No new theme concepts are required.

---

## 2. Scope

### 2.1 In Scope

- shared picker and popover surfaces used in `clef-base`
- form and field widgets used in create/edit/admin flows
- table/card/detail-style data display widgets used in primary routes
- graph/canvas semantic color treatment
- workspace/editor chrome where theme mismatches are visible
- primary admin views that still carry repeated inline styled wrappers

### 2.2 Out of Scope

- rewriting every rare or experimental widget in the repo
- inventing new theming concepts or new core Surface schema
- replacing the current theme seed pack again
- broad view architecture redesigns unrelated to theming

---

## 3. Deliverables

### 3.1 Shared Popover and Picker Theming

- consistent popover chrome across field/group/display pickers
- shared menu/list row treatment
- consistent hover, focus, elevation, and border treatment

### 3.2 Form and Field Surface Cleanup

- field widgets use shared semantic input, helper, and validation treatment
- admin configuration panels stop relying on ad hoc inline panel styling
- create/edit flows read as part of one design system

### 3.3 Data Display Surface Cleanup

- table/card/detail displays use consistent metadata, inline action, and empty/error chrome
- display widgets remain distinct by function but not by accidental styling drift

### 3.4 Visualization Tokenization

- graph/canvas displays stop using hardcoded semantic hex color maps
- visualization color meaning is represented through theme-driven semantic tokens

### 3.5 Primary View Wrapper Cleanup

- repeated inline wrappers in primary admin views are reduced
- the remaining views compose shared themed surfaces instead of building local mini-design-systems

---

## 4. Implementation Plan

## 4.1 Shared Picker and Popover Surfaces

### Objective

Unify the shared floating interaction surfaces that appear throughout `clef-base`.

### Primary Targets

- `clef-base/app/components/widgets/FieldsPopover.tsx`
- `clef-base/app/components/widgets/GroupPopover.tsx`
- `clef-base/app/components/widgets/DisplayAsPicker.tsx`
- `clef-base/app/components/widgets/FieldPickerDropdown.tsx`

### Work

- replace repeated inline panel styles with shared themed classes
- normalize menu row spacing, hover, selected, and muted states
- normalize close buttons, bulk action buttons, and search fields
- use semantic elevation/border/surface tokens consistently

### Success Criteria

- popovers and pickers feel like one system
- no raw shadow literals remain in these shared floating surfaces
- theme changes affect these surfaces coherently

## 4.2 Form and Field Widgets

### Objective

Finish the audit for `clef-base`’s most-used input and editing surfaces.

### Primary Targets

- `clef-base/app/components/widgets/FieldWidget.tsx`
- `clef-base/app/components/widgets/CreateForm.tsx`
- `clef-base/app/components/widgets/FormMode.tsx`
- `clef-base/app/components/widgets/FieldPlacementPanel.tsx`

### Work

- extract shared semantic treatments for:
  - text inputs
  - selects
  - helper text
  - validation messaging
  - toggle controls
  - chip-like selected values
- reduce fallback literals and repeated inline control chrome
- align panel and form wrapper styling with the rest of the app

### Success Criteria

- create/edit/admin field flows feel visually related
- form controls respond cleanly under all seeded themes
- validation and status states are semantically themed

## 4.3 Data Display Widgets

### Objective

Close the audit across the displays that most visibly represent `clef-base` content and admin records.

### Primary Targets

- `clef-base/app/components/widgets/DataTable.tsx`
- `clef-base/app/components/widgets/TableDisplay.tsx`
- `clef-base/app/components/widgets/CardGridDisplay.tsx`
- `clef-base/app/components/widgets/DetailDisplay.tsx`

### Work

- normalize row expansion chrome, metadata labels, and inline action slots
- remove remaining local status-color fallbacks where possible
- ensure shared card/table/detail semantics stay aligned with shell and preview surfaces

### Success Criteria

- data displays look like one app under each theme
- table and card variants differ by information density, not styling drift
- state surfaces remain legible and consistent

## 4.4 Visualization Semantic Colors

### Objective

Make graph/canvas visualization truly theme-aware instead of token-adjacent.

### Primary Targets

- `clef-base/app/components/ViewRenderer.tsx`
- `clef-base/app/components/widgets/GraphDisplay.tsx`
- `clef-base/app/components/widgets/CanvasDisplay.tsx`

### Work

- replace hardcoded schema/entity color maps with semantic visualization tokens or theme-driven mappings
- define a stable visualization-color contract inside `clef-base`
- preserve meaningful differentiation between entity kinds without using raw literals

### Success Criteria

- no raw hex semantic color map remains in primary visualization flows
- visualization surfaces still communicate type/category meaning under all themes
- dark/light/editorial/signal themes visibly affect visualizations without harming readability

## 4.5 Workspace and Editor Chrome

### Objective

Audit state-heavy admin/editor surfaces where styling mismatches are especially noticeable.

### Primary Targets

- `clef-base/app/components/widgets/WorkspaceSwitcher.tsx`
- `clef-base/app/components/widgets/PaneHeader.tsx`
- `clef-base/app/components/widgets/InlineEdit.tsx`
- `clef-base/app/components/widgets/InlineCellEditor.tsx`

### Work

- normalize destructive banners, confirmation surfaces, and editor chrome
- reduce repeated inline action-state styling
- ensure editor states feel compatible with the main design language

### Success Criteria

- editor and workspace flows feel like part of the same themed product
- destructive and warning states stay coherent under all themes

## 4.6 Primary View Wrapper Cleanup

### Objective

Remove the last obvious one-off themed wrappers from primary `clef-base` admin routes.

### Primary Targets

- `DashboardView`
- `ContentView`
- `ConceptBrowserView`
- `ScoreView`
- `TaxonomyView`
- `DisplayModesView`

### Work

- replace repeated inline wrappers and repeated tokenized stacks with shared classes
- consolidate page-level status, loading, summary, and section header patterns
- leave route logic alone and focus only on theme-system consistency

### Success Criteria

- primary admin views compose shared themed surfaces
- design changes propagate more predictably across routes

---

## 5. Concept Changes

No new concepts are required.

No schema changes are expected for this pass.

If visualization tokenization reveals a missing persistent model for semantic visualization palettes, capture that as a later PRD instead of extending this scope silently.

---

## 6. Syncs

No new sync files are required.

This PRD is intentionally component- and view-facing.

---

## 7. Widgets

### 7.1 Modified Widgets and Components

- `FieldsPopover`
- `GroupPopover`
- `DisplayAsPicker`
- `FieldPickerDropdown`
- `FieldWidget`
- `CreateForm`
- `FormMode`
- `FieldPlacementPanel`
- `DataTable`
- `TableDisplay`
- `CardGridDisplay`
- `DetailDisplay`
- `GraphDisplay`
- `CanvasDisplay`
- `WorkspaceSwitcher`
- `PaneHeader`
- `InlineEdit`
- `InlineCellEditor`

### 7.2 Widget-Level Goal

Bring repertoire-derived and locally-authored `clef-base` widgets into the same semantic theme contract.

---

## 8. Views

### 8.1 Modified Views

- `DashboardView`
- `ContentView`
- `ConceptBrowserView`
- `ScoreView`
- `TaxonomyView`
- `DisplayModesView`

### 8.2 View-Level Goal

Primary routes should use shared themed wrappers instead of local inline mini-systems.

---

## 9. Seeds

No new seed records are required by default.

Potential exception:
- if visualization semantic colors must be represented via seed-driven mappings rather than pure CSS/token logic, capture that inside the visualization card only if it is clearly necessary

---

## 10. Clef Base Integration Checklist

- shared popovers and pickers use consistent semantic chrome
- create/edit/admin field flows use shared themed controls
- primary data displays share coherent state treatment
- graph/canvas views no longer depend on raw hardcoded semantic hex colors
- primary admin views use shared themed wrappers for loading, summary, and section surfaces
- `ThemesView` still exposes these changes clearly for QA

---

## 11. Verification Strategy

- focused component tests for any new helper logic
- route-level visual sanity checks through the `ThemesView` QA surface
- targeted grep/audit checks for:
  - raw hex semantic colors
  - repeated inline popover chrome
  - repeated inline field chrome
- broad focused test suite over theme generation, selection, preview metadata, and widget resolution remains green

---

## 12. Kanban Card Table

| Card | Deliverable | Section | Depends On | Unblocks | Priority | Commit |
|---|---|---|---|---|---|---|
| MAG-650 | Shared picker and popover surfaces | §4.1 | — | MAG-655 | high | `de9004ef` |
| MAG-651 | Form and field widgets | §4.2 | — | MAG-655 | high | |
| MAG-652 | Data display widgets | §4.3 | — | MAG-655 | high | |
| MAG-653 | Visualization semantic colors | §4.4 | — | MAG-656 | high | |
| MAG-654 | Workspace and editor chrome | §4.5 | — | MAG-656 | medium | |
| MAG-655 | Primary view wrapper cleanup | §4.6 | MAG-650, MAG-651, MAG-652 | MAG-656 | medium | |
| MAG-656 | Final regression and rollout verification | §10, §11 | MAG-653, MAG-654, MAG-655 | — | medium | |

### Notes

- card IDs now reference the live Vibe Kanban epic `MAG-649`
- execution should prioritize the shared surfaces first because they influence many downstream routes

---

## 13. Execution Order

### Critical Path

1. shared picker and popover surfaces
2. form and field widgets
3. data display widgets
4. primary view wrapper cleanup
5. final regression and rollout verification

### Parallelizable Work

- visualization semantic colors can run in parallel with form/data cleanup
- workspace/editor chrome can run in parallel with visualization work

### Suggested Agent Mapping

| Card | Suggested agent type |
|---|---|
| Shared picker and popover surfaces | `general-purpose` |
| Form and field widgets | `general-purpose` |
| Data display widgets | `general-purpose` |
| Visualization semantic colors | `general-purpose` |
| Workspace and editor chrome | `general-purpose` |
| Primary view wrapper cleanup | `general-purpose` |
| Final regression and rollout verification | `general-purpose` |
