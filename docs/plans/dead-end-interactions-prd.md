# PRD: Fix Dead-End Interactions in Clef Base

## Status: Draft
## Authors: 2026-04-12
## Depends on: Clef Base Usability Audit (clef-base/docs/usability-audit.md, Issue 2)

---

## 1. Problem Statement

The usability audit identified six dead-end interactions — UI elements that are wired but don't complete their flow. The ActionBinding PRD addressed two of them (ControlBlock Invoke silent failure, Leave Space placeholder). Five remain, each a distinct kind of bug:

| Dead-end | Bug type | User impact |
|---|---|---|
| Span click handlers inert | Missing wiring | Rendered span highlights appear interactive but do nothing on click |
| BoardDisplay no drag-and-drop | Missing functionality | The core kanban interaction (dragging cards between columns) doesn't exist |
| CalendarDisplay read-only | Missing creation UI | Can view events but can't create them from the calendar |
| DataTable expand+row-click conflict | Event propagation bug | Clicking the expand chevron also triggers row click, causing unintended navigation |
| EntityEmbedBlock invalid IDs | Missing input validation | Accepts entity IDs that don't exist without warning; shows "not found" later |

These are each small, self-contained fixes — unlike the ActionBinding work, they don't require new concepts or pipelines. Each is a targeted patch to an existing component.

---

## 2. Proposed Fixes

### 2.1 Span click handlers — wire up onSpanClick

**File:** `clef-base/app/components/widgets/SpanGutter.tsx` and the span rendering within `BlockEditor.tsx`.

**Bug:** `onSpanClick` is accepted as a prop but never invoked by the rendering logic. Users click a span highlight and nothing happens.

**Fix:** Locate the element that renders each span (the gutter indicator or the inline span highlight) and add `onClick={() => onSpanClick?.(span.id)}` to it. Verify that the event doesn't bubble to trigger other handlers.

**Acceptance:** Clicking a span highlight in the block editor fires the `onSpanClick` callback with the span ID. The span becomes visually selected or navigates to the span's detail view (depending on context).

### 2.2 BoardDisplay drag-and-drop

**File:** `clef-base/app/components/widgets/BoardDisplay.tsx`

**Bug:** The board displays cards grouped by a field value but has no way to change that field by dragging. The core kanban affordance is missing.

**Fix:** Use the HTML5 drag-and-drop API (or React DnD if the project uses it — check package.json). Make each card draggable. Each column becomes a drop target. On drop, invoke an update action via the row action mechanism to change the grouping field value.

The drop action should go through ActionBinding (a new `board-card-move` ActionBinding seed that targets the row's update action with the new column value as a param). If no binding is configured for the view's grouping field, drag-and-drop is disabled with a visible indicator.

**Acceptance:** User drags a card from one column to another. An update action fires changing the row's grouping field to the target column's value. The card visibly moves. Failure rolls back. Disabled state shown when no move action is configured.

### 2.3 CalendarDisplay event creation

**File:** `clef-base/app/components/widgets/CalendarDisplay.tsx`

**Bug:** Calendar is purely read-only. No way to create an event by clicking a day or dragging a time range.

**Fix:** Add click handling on empty calendar cells. When clicked, invoke the view's `createForm` ActionBinding (from InteractionSpec) with the clicked date pre-filled as a parameter. Reuse the existing CreateForm modal pattern.

For day-view time ranges, support click-and-drag to select a range, then open the create form with start/end pre-filled.

**Acceptance:** Clicking an empty day cell opens the create form with the date prefilled. Saving creates an event visible on the calendar. Drag-selecting a time range prefills both start and end.

### 2.4 DataTable expand+row-click conflict

**File:** `clef-base/app/components/widgets/DataTable.tsx`

**Bug:** The expand/collapse chevron is rendered inside the row. Both handlers fire because the chevron click propagates up to the row.

**Fix:** Add `event.stopPropagation()` in the chevron's onClick handler. The chevron click now only toggles expansion; the row click (navigation) fires only when clicking anywhere else in the row.

**Acceptance:** Clicking the chevron expands/collapses without navigating. Clicking the row body (not the chevron) navigates. No double-action.

### 2.5 EntityEmbedBlock invalid ID validation

**File:** `clef-base/app/components/widgets/EntityEmbedBlock.tsx` (or wherever entity embeds are configured)

**Bug:** The entity ID input accepts any string, including IDs that don't resolve to real entities. The user sees "not found" only after navigating to the embed.

**Fix:** On input blur or with 300ms debounce, call `invoke('ContentNode', 'get', { node: inputValue })`. If the variant is `notfound`, show an inline error ("Entity not found") and disable save. If `ok`, show the resolved entity's title as confirmation.

Alternatively, replace the free text input with an entity picker dropdown that only lists existing entities.

**Acceptance:** Typing a nonexistent ID shows an inline error before save. Valid IDs show the resolved entity name. Save is disabled when the ID is invalid.

---

## 3. Implementation Notes

All fixes are localized to specific component files. No new concepts, no new syncs, no new widgets. The changes compose with the ActionBinding work already done:
- 2.2 (board DnD) uses ActionBinding for the drop action
- 2.3 (calendar create) uses ActionBinding for the createForm invocation
- 2.5 (entity validation) uses raw `invoke('ContentNode', 'get')` since this is a read, not an action trigger

---

## 4. Implementation Plan

Five independent cards, each roughly 1-3 hours of work. Can run in parallel.

| Card | File | Estimated complexity |
|---|---|---|
| Wire onSpanClick | SpanGutter.tsx, BlockEditor.tsx | Low |
| Board drag-and-drop | BoardDisplay.tsx | Medium (most complex) |
| Calendar event creation | CalendarDisplay.tsx | Medium |
| DataTable event propagation | DataTable.tsx | Trivial |
| Entity ID validation | EntityEmbedBlock.tsx | Low |

---

## 5. Success Criteria

1. All 5 dead-end interactions complete their intended flow
2. No regression in existing functionality
3. Each fix shipped as a separate commit with the card ID in the commit message
