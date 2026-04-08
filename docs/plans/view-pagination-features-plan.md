# View Pagination & Selective Composition — Implementation Plan

**Version:** 1.0.0  
**Date:** 2026-04-07  
**Status:** Implementation-ready  
**New concepts:** 1 (PaginationSpec)  
**Modified concepts:** 3 (ViewShell, QueryProgram, QueryExecution)  
**Modified DSL:** 1 (.view file grammar — `features` block)  
**Modified syncs:** 4 (view-resolve, compile-query, compile-split-query, execute-query)

### Kanban Cards (Vibe Kanban)

| Card | PRD Sections | Blocked By | Blocks | Commit |
|---|---|---|---|---|
| **MAG-539** PaginationSpec Concept + Handler | §1, §2 | — | MAG-541, MAG-543 | |
| **MAG-540** ViewShell Selective Features | §3 | — | MAG-541, MAG-543 | |
| **MAG-541** Sync + QueryProgram Offset Updates | §4, §5, §6 | MAG-539, MAG-540 | MAG-542, MAG-543 | |
| **MAG-542** .view File Features Block + Widget | §7, §9.3 | MAG-541 | MAG-543 | |
| **MAG-543** Integration Tests | §8, §9.2 | MAG-539–542 | — | |

---

## 1. Problem Statement

### 1.1 No Pagination

The view system has `QueryProgram/limit` to cap result size, but no `offset`, `cursor`, or page-based navigation. Views that return hundreds of records (source library, evidence tables, content lists) have no way to paginate. The kernel-query-provider pushes `limit` to the backend, but without offset the client must fetch all records and slice locally.

### 1.2 ViewShell Is All-or-Nothing

ViewShell always stores 7 child spec references: `dataSource`, `filter`, `sort`, `group`, `projection`, `presentation`, `interaction`. Every view must provide all 7, even when most are empty strings. Syncs wire all 7 unconditionally — `view-resolve` fetches all child specs in parallel, `compile-query` builds instructions for all of them.

This means:
- A simple card-grid that only needs sorting still carries empty filter, group, projection, interaction refs
- The `resolveHydrated()` handler dispatches 7 parallel gets even when 4 return empty
- No way for a `.view` file to declare "this view only uses sort and presentation"
- ViewAnalysis invariants can't enforce "this view must NOT have filters" (it always has the slot, just empty)

---

## 2. PaginationSpec Concept

### 2.1 Purpose

Manage named pagination configurations that control how result sets are divided into pages. Each spec captures a pagination mode (offset, cursor, or keyset), page size, and current position.

### 2.2 State

```
PaginationSpec [P] {
  state {
    name:       P -> String          // unique spec name
    mode:       P -> String          // "offset" | "cursor" | "keyset"
    pageSize:   P -> Int             // records per page (default: 25)
    maxSize:    P -> Int             // maximum allowed page size (default: 100)
    position:   P -> String          // current position: page number, cursor token, or keyset value (JSON)
    totalCount: P -> Int             // total records (set after first query, -1 if unknown)
    hasMore:    P -> Boolean         // whether more pages exist after current position
  }
}
```

### 2.3 Actions

| Action | Input | Variants | Description |
|---|---|---|---|
| `create` | name, mode, pageSize, maxSize? | ok, duplicate | Create a named pagination spec |
| `get` | name | ok, not_found | Retrieve spec by name |
| `advance` | name, nextPosition | ok, not_found, exhausted | Move to next page position |
| `retreat` | name, prevPosition | ok, not_found, at_start | Move to previous page position |
| `reset` | name | ok, not_found | Reset to first page |
| `resize` | name, pageSize | ok, not_found, exceeds_max | Change page size (resets to first page) |
| `updateCount` | name, totalCount, hasMore | ok, not_found | Update total count after query execution |
| `remove` | name | ok, not_found | Delete spec |
| `list` | — | ok | List all specs |
| `evaluate` | name, offset?, cursor? | ok, not_found | Return computed { limit, offset } or { limit, cursor } for query injection |

### 2.4 Invariants

```
always "page size within bounds": pageSize > 0 and pageSize <= maxSize
always "mode is valid": mode in {"offset", "cursor", "keyset"}
always "exhausted means no more": not hasMore implies advance returns exhausted
```

### 2.5 Fixtures

```
fixture default { name: "page-1", mode: "offset", pageSize: 25 } -> ok
fixture cursor { name: "cursor-1", mode: "cursor", pageSize: 50 } -> ok
fixture duplicate { name: "page-1", mode: "offset", pageSize: 25 } -> duplicate
fixture oversized { name: "big", mode: "offset", pageSize: 200, maxSize: 100 } -> exceeds_max
```

---

## 3. ViewShell Selective Features

### 3.1 New State Field

Add `features` to ViewShell:

```
features: V -> set String   // e.g., {"filter", "sort", "pagination"}
```

Valid feature names: `"filter"`, `"sort"`, `"group"`, `"projection"`, `"interaction"`, `"pagination"`.

Two features are **always-on** (not listed in `features`):
- `dataSource` — every view needs a data source
- `presentation` — every view needs a display mode

### 3.2 Behavior Change

- `ViewShell/create` and `ViewShell/update` accept an optional `features` set. If omitted, defaults to all 6 features (backward-compatible).
- Child spec refs for disabled features are stored as empty strings and **not fetched** during `resolveHydrated()`.
- `ViewShell/create` validates: if a child spec ref is non-empty but its feature is disabled, return `feature_disabled` variant.

### 3.3 New ViewShell State

```
state {
  // ... existing fields ...
  features:   V -> String     // JSON array of enabled feature names
  pagination: V -> String     // PaginationSpec ref (new child spec slot)
}
```

### 3.4 ViewShell Actions Updated

| Action | Change |
|---|---|
| `create` | Add `features` (optional, default all) and `pagination` (optional) params |
| `update` | Add `features` and `pagination` params |
| `resolveHydrated` | Only fetch child specs whose feature is enabled; add PaginationSpec fetch if "pagination" enabled |

### 3.5 New Variant

`feature_disabled` — returned when a non-empty child spec ref is provided for a feature not in the `features` set.

---

## 4. QueryProgram Offset Instruction

### 4.1 New Action

Add `offset` instruction to QueryProgram:

```
action offset [Q] {
  purpose { Skip the first N records in the instruction sequence. }
  input { program: Q, count: Int, output: String }
  pre { count >= 0, program not sealed }
  post { program has offset instruction appended }
  variant ok {}
  variant sealed { message: String }
}
```

### 4.2 Instruction Shape

```typescript
{ type: 'offset', count: number, bindAs: string }
```

### 4.3 Kernel Capability

Add `'offset'` to `KERNEL_CAPABILITIES` in `kernel-query-provider.ts` so it gets pushed down to the backend alongside `limit`.

### 4.4 In-Memory Execution

In `execute()`, `offset` slices the row array: `rows.slice(count)`.

---

## 5. Sync Updates

### 5.1 view-resolve.sync

**Current:** Unconditionally fetches all 7 child specs.

**New:** Guard each child spec fetch on feature membership:

```
// Only fetch FilterSpec if "filter" is in features
where {
  guard(?features contains "filter")
}
then {
  FilterSpec/get: [ name: ?filter ]
}
```

Add new conditional fetch for PaginationSpec:

```
where {
  guard(?features contains "pagination")
}
then {
  PaginationSpec/get: [ name: ?pagination ]
}
```

DataSourceSpec and PresentationSpec are always fetched (always-on features).

### 5.2 compile-query.sync

**Current:** Always builds scan → filter → sort → project → pure.

**New:** Only inject instructions for enabled features:

```
// Only add filter instruction if "filter" feature is enabled
guard(?features contains "filter")
QueryProgram/filter: [ ... ]

// Only add sort if "sort" enabled
guard(?features contains "sort")
QueryProgram/sort: [ ... ]

// Only add group if "group" enabled
guard(?features contains "group")
QueryProgram/group: [ ... ]

// Inject pagination (offset + limit) if "pagination" enabled
guard(?features contains "pagination")
PaginationSpec/evaluate: [ name: ?pagination ]
QueryProgram/offset: [ program: ?qp, count: ?paginationOffset ]
QueryProgram/limit: [ program: ?qp, count: ?paginationLimit ]
```

### 5.3 compile-split-query.sync

Same conditional guards applied to the split-execution variants.

### 5.4 execute-query syncs

After query execution, if pagination is enabled, update the pagination spec with total count:

```
when QueryExecution/dispatch completes ok {
  where {
    guard(?features contains "pagination")
  }
  then {
    PaginationSpec/updateCount: [ name: ?pagination, totalCount: ?totalCount, hasMore: ?hasMore ]
  }
}
```

---

## 6. QueryExecution Provider Updates

### 6.1 Kernel Provider

Add `'offset'` to `KERNEL_CAPABILITIES`. The `execute` function handles offset by injecting `OFFSET ?` into SQL or equivalent backend query.

### 6.2 In-Memory Provider

Handle `offset` instruction type in `executeInMemory`:

```typescript
case 'offset':
  rows = rows.slice(instruction.count);
  break;
```

### 6.3 Remote Provider

Add `'offset'` to potential `pushdownOps`. Map to query parameter (e.g., `?offset=N` or `?page=N` depending on provider config).

---

## 7. .view File Features Block

### 7.1 Grammar Extension

Add `features` block to the `.view` file DSL:

```
view "source-library" {
  shell: "source-library"

  features {
    filter
    sort
    pagination
    projection
  }

  purpose {
    Filterable, sortable, paginated table of all captured sources.
  }

  invariants {
    always "purity is read-only": {
      purity = "read-only"
    }
  }
}
```

### 7.2 Semantics

- If `features {}` is present, only the listed features are enabled. The ViewShell `features` field is set accordingly.
- If `features {}` is omitted, all features are enabled (backward-compatible with existing `.view` files).
- The parser validates that listed feature names are from the valid set.

### 7.3 ViewAnalysis Integration

ViewAnalysis uses the features set to:
- Skip analysis for disabled features (e.g., don't extract filterFields if filter is disabled)
- Enable new invariant targets: `enabledFeatures`, `disabledFeatures`
- Invariants can assert: `always "no grouping": { disabledFeatures contains "group" }`

### 7.4 Test Generation

`generate-view-tests.ts` reads the features block and:
- Only generates feature-specific test assertions for enabled features
- Generates "feature disabled" assertions for disabled features (e.g., "filter field set is empty when filter is disabled")

### 7.5 Updated Example Files

Update the 3 existing `.view` files:

```
// content-list.view — read-only, no interaction
view "content-list" {
  shell: "content-list"
  features { filter, sort, projection }
  ...
}

// content-list-actions.view — read-write with interaction
view "content-list-actions" {
  shell: "content-list"
  features { filter, sort, projection, interaction }
  ...
}

// simple-list.view — minimal, just presentation
view "simple-list" {
  shell: "simple-list"
  features { sort }
  ...
}
```

---

## 8. Testing

### 8.1 PaginationSpec Conformance Tests

Generated by TestGen from concept spec — covers all actions, fixtures, invariants.

### 8.2 PaginationSpec Handler Tests

- Offset mode: create → advance (page 2) → advance (page 3) → retreat → reset
- Cursor mode: create → advance (cursor token) → advance (next token) → exhausted
- Resize: change page size resets to first page
- Bounds: pageSize > maxSize returns exceeds_max

### 8.3 ViewShell Features Tests

- Create with features subset → only listed specs stored
- resolveHydrated with features subset → only fetches enabled specs
- Non-empty ref for disabled feature → feature_disabled variant
- Omit features → backward-compatible (all enabled)

### 8.4 QueryProgram Offset Tests

- Build program with offset → instruction in sequence
- In-memory execute with offset → correct slice
- Offset + limit → correct window (offset 20, limit 10 → records 20-29)
- Offset beyond total → empty result

### 8.5 Sync Integration Tests

- View with `features: ["sort"]` → compile-query only builds scan + sort + pure (no filter/group/project)
- View with `features: ["filter", "sort", "pagination"]` → compile-query builds scan + filter + sort + offset + limit + pure
- Pagination updateCount fires after execution when pagination enabled
- Pagination does NOT fire when pagination disabled

### 8.6 .view File Parser Tests

- Parse features block → correct feature set
- Missing features block → all features enabled
- Invalid feature name → parse error
- Features flow through to ViewShell creation

### 8.7 ViewAnalysis Tests

- Analysis with disabled features → skips disabled field extraction
- Invariant `disabledFeatures contains "group"` passes when group not in features

---

## 9. Migration

### 9.1 Backward Compatibility

- Existing ViewShell records without `features` field default to all features enabled
- Existing `.view` files without `features {}` block remain valid (all features)
- Existing syncs work unchanged — the guards only activate when `features` is present
- `view-resolve.sync` falls through to fetching all specs when features is absent

### 9.2 Seed Data Migration

Update research view seeds to declare features:

| View | Features |
|---|---|
| research-projects | filter, sort, pagination, projection |
| source-library | filter, sort, pagination, projection |
| evidence-graph | — (graph display, no table features) |
| report-builder | interaction |
| memory-notebook | filter, sort, pagination |
| research-plan | interaction |
| source-detail | interaction |

### 9.3 Widget

Add a `pagination-control.widget` to the Surface widget library:
- Parts: root, prevButton, nextButton, pageIndicator, pageSizeSelector, totalCount
- States: idle, loading, disabled (first page / last page)
- Props: pagination_spec_name, pageSize, currentPage, totalPages, hasMore
- Connect to PaginationSpec/advance, PaginationSpec/retreat, PaginationSpec/resize

---

## 10. Impact Analysis

### 10.1 Files Modified

| File | Change |
|---|---|
| `specs/view/view-shell.concept` | Add `features`, `pagination` state fields; update create/update actions |
| `specs/view/query-program.concept` | Add `offset` action |
| `specs/view/suite.yaml` | Add PaginationSpec to suite; add `pagination-control` widget |
| `handlers/ts/view/view-shell.handler.ts` | Conditional fetching in resolveHydrated |
| `handlers/ts/view/query-program.handler.ts` | Implement offset instruction |
| `handlers/ts/view/providers/kernel-query-provider.ts` | Add 'offset' to KERNEL_CAPABILITIES |
| `handlers/ts/view/providers/in-memory-provider.ts` | Handle offset in executeInMemory |
| `handlers/ts/framework/view-spec-parser.ts` | Parse features block |
| `handlers/ts/framework/view-analysis.ts` | Feature-aware analysis |
| `scripts/generate-view-tests.ts` | Feature-aware test generation |
| `syncs/view/view-resolve.sync` | Feature guards on child spec fetches |
| `syncs/view/compile-query.sync` | Feature guards on instruction building |
| `syncs/view/compile-split-query.sync` | Feature guards on split variants |

### 10.2 Files Created

| File | Description |
|---|---|
| `specs/view/pagination-spec.concept` | PaginationSpec concept |
| `handlers/ts/view/pagination-spec.handler.ts` | PaginationSpec handler |
| `surface/pagination-control.widget` | Pagination widget |
| `syncs/view/paginate-on-execute.sync` | Update pagination after query execution |
| `specs/view/views/source-library.view` | Example paginated view |
