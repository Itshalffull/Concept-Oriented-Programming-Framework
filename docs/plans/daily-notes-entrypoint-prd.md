# Daily Notes as App Entrypoint

## Problem

`/admin` currently lands on a stats dashboard (Total Nodes: 93, Concepts: 26, Widgets: 14, ...). The stats are technically correct but not what a user arrives to do. Clef Base is a workspace for thinking, writing, and organizing — a daily-notes page is the natural entrypoint, not a system telemetry view.

We already have:

- `DailyNote` concept spec
- Syncs that relate date values on any content back to the matching daily note
- `ContentNode` storage for the daily notes themselves

What's missing is the frontend. The dashboard layout points at stat widgets instead of a daily-notes view.

## Design

Replace the dashboard landing page with a Roam-style daily notes experience:

### Layout

- **Today's note** is the primary editing surface, front and center. Opens or auto-creates a ContentNode with schema `DailyNote` and node id `daily-note:{YYYY-MM-DD}`.
- **Block editor** inside — same block editor used elsewhere. Title is the ISO date; body is free-form blocks.
- **Sidebar / Left rail** — chronological list of recent daily notes (past 14 days), with a "calendar jump" control for older dates.
- **Right rail** — "Referenced on this day": all ContentNodes whose date fields match today's date, grouped by schema.

### Routing

- `/admin` → `/admin/daily/:today` (default redirect to today's date)
- `/admin/daily/:date` renders the daily note for that date
- Navigation arrows (← prev day, next day →) move through the date sequence
- "Jump to today" button on any daily note

### Data Wiring

- `DailyNote/get({date})` either returns the existing node or auto-creates (get-or-create semantics via a sync on first access)
- "Referenced on this day" query: `ContentNode/listByDateRef({date})` — an action on ContentNode that finds every node with a date field equal to the target date, driven by the existing date-ref sync
- Recent days list: `ContentNode/listBySchema({schema: 'DailyNote'})` sorted by node id (which encodes the date)

### Stats Dashboard

Don't delete — relocate to `/admin/system` or `/admin/stats`. Still useful, just not the front door.

## Deliverables

| Deliverable | Agent | Blocked by |
|---|---|---|
| DN-1: Verify DailyNote concept/handler + date-ref syncs are present and working | Explore | — |
| DN-2: DailyNote/get-or-create action or sync | handler-scaffold-gen | DN-1 |
| DN-3: `ContentNode/listByDateRef` action (or Reference/forDate query) | handler-scaffold-gen | DN-1 |
| DN-4: daily-note-editor widget spec + React impl | surface-component-scaffold-gen | — |
| DN-5: daily-note-sidebar widget (recent days list) | surface-component-scaffold-gen | — |
| DN-6: referenced-on-this-day widget (right rail) | surface-component-scaffold-gen | DN-3 |
| DN-7: /admin route → /admin/daily/:today redirect | clef-base | — |
| DN-8: /admin/daily/:date page wiring + layout seed | clef-base | DN-2, DN-4, DN-5, DN-6, DN-7 |
| DN-9: /admin/system page for the old stats dashboard | clef-base | DN-8 |
| DN-10: Seed DailyNote schema with displayWidget=daily-note-editor, defaultTemplate | seed-data | DN-4 |

## Kanban Table

| Card | Subject | Status | Commit |
|------|---------|--------|--------|
| DN-1 | Verify DailyNote concept + date-ref syncs | pending | — |
| DN-2 | DailyNote get-or-create | pending | — |
| DN-3 | ContentNode/listByDateRef action | pending | — |
| DN-4 | daily-note-editor widget | pending | — |
| DN-5 | daily-note-sidebar widget | pending | — |
| DN-6 | referenced-on-this-day widget | done | 1f57e4c0 |
| DN-7 | /admin → /admin/daily/:today redirect | done | 8d34fbe1 |
| DN-8 | /admin/daily/:date page + layout | done | b221e2e9 |
| DN-9 | /admin/system dashboard relocation | done | d017319d |
| DN-10 | DailyNote schema properties + template | done | 5e649ec9 |
