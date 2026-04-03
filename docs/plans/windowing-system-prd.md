# PRD: Windowing System for Clef Base

## Problem

Clef Base has Shell (macro zones), Layout (spatial arrangement), and Host
(mounted view lifecycle), but nothing manages the **windowing behavior**
between them — which panes are open, how they're arranged in tabs and splits,
where they can dock, and how to save/restore the whole arrangement.

Users can't:
- Open multiple views as tabs and switch between them
- Split the screen to see two views side by side
- Drag a tab to dock it in a different position
- Save a layout arrangement and switch between workspaces
- Configure the admin shell layout from the frontend

### What exists today

| Component | File | What it does |
|-----------|------|-------------|
| Shell concept | `repertoire/concepts/ui-app/shell.concept` | Semantic zones (navigated, persistent, overlay) |
| Layout concept | `repertoire/concepts/ui-render/layout.concept` | Spatial kinds (stack, grid, split, sidebar) |
| Host concept | `repertoire/concepts/ui-app/host.concept` | Mounted view lifecycle (mount/ready/unmount) |
| Viewport concept | `repertoire/concepts/ui-render/viewport.concept` | Responsive breakpoints |
| Tabs widget | `repertoire/widgets/navigation/tabs.widget` | Tab switcher UI (headless) |
| Splitter widget | `repertoire/widgets/navigation/splitter.widget` | Resizable divider UI (headless) |
| Sidebar widget | `repertoire/widgets/navigation/sidebar.widget` | Collapsible side panel UI |
| LayoutRenderer | `clef-base/app/components/LayoutRenderer.tsx` | Renders Layout configs (grid/split/stack/sidebar) |

### The gap

No concept manages:
- Which panes are open and their lifecycle
- Tab ordering, activation, pinning, close semantics
- Recursive split trees with resizable dividers
- Dock targets and drag-to-dock rules
- Workspace snapshots (save/restore full arrangements)

---

## Concepts

### C1. Pane

**Purpose:** Lightweight content container with a title, lifecycle state,
and size constraints. The atomic unit that tabs, splits, and docks operate on.

**File:** `repertoire/concepts/ui-app/pane.concept`

**State:**
- panes: set P
- identity: title (String), icon (option String), hostRef (String)
- lifecycle: status ("open" | "minimized" | "maximized" | "closed")
- sizing: minWidth (option Int), minHeight (option Int), preferredWidth (option Int), preferredHeight (option Int)
- behavior: closable (Bool), pinned (Bool), transient (Bool)

**Actions:**
- `open(pane, title, hostRef, icon?)` → ok | invalid
- `close(pane)` → ok | notfound | invalid (pinned pane)
- `minimize(pane)` → ok | notfound
- `maximize(pane)` → ok | notfound
- `restore(pane)` → ok | notfound
- `pin(pane)` → ok | notfound
- `unpin(pane)` → ok | notfound
- `setConstraints(pane, minWidth?, minHeight?, preferredWidth?, preferredHeight?)` → ok | notfound
- `get(pane)` → ok | notfound
- `list()` → ok

**Syncs:**
- Pane/open → Host/mount (mount the view in the pane)
- Pane/close → Host/unmount (cleanup)
- Pane/maximize → Shell/pushOverlay (maximized pane overlays)

---

### C2. TabGroup

**Purpose:** Manage an ordered set of panes as tabs with activation,
reordering, pinning, and close semantics. A tab group is a container
that sits in a split layout leaf or a dock zone.

**File:** `repertoire/concepts/ui-app/tab-group.concept`

**State:**
- groups: set G
- identity: name (String)
- tabs: G -> list String (ordered pane IDs)
- activeTab: G -> option String (currently visible pane ID)
- pinnedTabs: G -> set String
- history: G -> list String (activation order for alt-tab)

**Actions:**
- `create(group, name)` → ok | duplicate
- `addTab(group, paneId, position?)` → ok | notfound
- `removeTab(group, paneId)` → ok | notfound
- `activateTab(group, paneId)` → ok | notfound
- `moveTab(group, paneId, newPosition)` → ok | notfound | invalid
- `pinTab(group, paneId)` → ok | notfound
- `unpinTab(group, paneId)` → ok | notfound
- `activatePrevious(group)` → ok | notfound (go to last active tab)
- `closeOthers(group, keepPaneId)` → ok | notfound
- `closeAll(group)` → ok | notfound
- `get(group)` → ok | notfound
- `list()` → ok

**Syncs:**
- TabGroup/removeTab → Pane/close (closing a tab closes its pane)
- TabGroup/activateTab → Host/ready (focus the mounted view)
- Navigator/go → TabGroup/addTab + activateTab (navigation opens a tab)

---

### C3. SplitLayout

**Purpose:** Manage a recursive tree of horizontal/vertical splits with
resizable dividers, size ratios, and collapse behavior. Each leaf of the
tree holds a TabGroup or a single Pane.

**File:** `repertoire/concepts/ui-app/split-layout.concept`

**State:**
- layouts: set S
- identity: name (String)
- tree: S -> String (JSON tree structure)
- Each node: { type: "split" | "leaf", direction?: "horizontal" | "vertical", ratio?: Float, children?: [node, node], contentRef?: String (tabGroup or pane ID), collapsed?: Bool }

**Actions:**
- `create(layout, name, tree)` → ok | invalid
- `split(layout, leafId, direction, ratio?)` → ok | notfound | invalid
  Split a leaf into two leaves with a divider
- `unsplit(layout, splitId, keepSide)` → ok | notfound
  Collapse a split back to one leaf (keep "first" or "second")
- `resize(layout, splitId, ratio)` → ok | notfound | invalid
  Change the ratio of a split (0.0 to 1.0)
- `collapse(layout, splitId, side)` → ok | notfound
  Collapse one side of a split (hide it, expand the other)
- `expand(layout, splitId)` → ok | notfound
  Restore a collapsed side
- `setContent(layout, leafId, contentRef)` → ok | notfound
  Assign a TabGroup or Pane to a leaf
- `get(layout)` → ok | notfound
- `getTree(layout)` → ok(tree) | notfound
  Return the full tree structure for rendering

**Syncs:**
- SplitLayout/split → TabGroup/create (new leaf gets a tab group)
- SplitLayout/unsplit → TabGroup/closeAll (removed tab group cleaned up)

---

### C4. DockZone

**Purpose:** Named drop target where panes can be docked, with rules
about what content types can dock where. Enables drag-to-dock interaction
where users rearrange their layout by dragging tabs between zones.

**File:** `repertoire/concepts/ui-app/dock-zone.concept`

**State:**
- zones: set D
- identity: name (String), label (option String)
- position: edge ("left" | "right" | "top" | "bottom" | "center")
- rules: allowedSchemas (option list String), maxTabs (option Int)
- behavior: autoHide (Bool), defaultCollapsed (Bool)
- contentRef: D -> option String (TabGroup currently docked here)

**Actions:**
- `register(zone, name, edge, label?)` → ok | duplicate
- `dock(zone, paneId)` → ok | notfound | invalid (violates rules)
- `undock(zone, paneId)` → ok | notfound
- `moveTo(fromZone, toZone, paneId)` → ok | notfound | invalid
- `setRules(zone, allowedSchemas?, maxTabs?)` → ok | notfound
- `toggleAutoHide(zone)` → ok | notfound
- `get(zone)` → ok | notfound
- `list()` → ok

**Syncs:**
- DockZone/dock → TabGroup/addTab (docking adds a tab to the zone's group)
- DockZone/undock → TabGroup/removeTab
- DockZone/moveTo → DockZone/undock + DockZone/dock (atomic move)

---

### C5. Workspace

**Purpose:** Named, serializable snapshot of the full pane/tab/split/dock
arrangement. Save, restore, and switch between workspace layouts. Each user
can have multiple workspaces (e.g., "Writing", "Admin", "Review").

**File:** `repertoire/concepts/ui-app/workspace.concept`

**State:**
- workspaces: set W
- identity: name (String), owner (String), description (option String)
- snapshot: W -> String (serialized JSON of the full layout tree + tab groups + panes + dock assignments)
- metadata: isDefault (Bool), createdAt (DateTime), updatedAt (DateTime)

**Actions:**
- `create(workspace, name, owner, description?)` → ok | duplicate
- `save(workspace, snapshot)` → ok | notfound
  Capture the current arrangement as a JSON snapshot
- `restore(workspace)` → ok(snapshot) | notfound
  Load a workspace snapshot for the shell to apply
- `setDefault(workspace)` → ok | notfound
  Mark this workspace as the user's default on login
- `delete(workspace)` → ok | notfound
- `duplicate(workspace, newName)` → ok | notfound | duplicate
- `list(owner)` → ok
- `get(workspace)` → ok | notfound

**Syncs:**
- Authentication/login → Workspace/restore (load default workspace)
- Workspace/restore → SplitLayout/create + TabGroup/create + Pane/open (rebuild from snapshot)
- Periodic auto-save → Workspace/save (capture current state)

---

## Widgets

### W1. pane-header

**File:** `clef-base/widgets/pane-header.widget`

Title bar for a Pane with close/pin/maximize/float buttons and drag handle
for tab reordering and dock dragging.

**Anatomy:** root, dragHandle, icon, title, pinButton, minimizeButton,
maximizeButton, closeButton, menuButton

**States:** idle, dragging, focused, maximized

### W2. dock-handle

**File:** `clef-base/widgets/dock-handle.widget`

Visual indicator showing valid dock drop targets during a pane drag
operation. Appears as directional arrows (top/bottom/left/right/center)
over each dock zone when a pane is being dragged.

**Anatomy:** root, topTarget, bottomTarget, leftTarget, rightTarget,
centerTarget, previewOverlay

**States:** hidden, visible, hovering (with target highlight)

### W3. workspace-switcher

**File:** `clef-base/widgets/workspace-switcher.widget`

Dropdown/modal for switching between saved workspaces. Shows workspace
name, description, and preview thumbnail. Supports create/rename/delete.

**Anatomy:** root, trigger, dropdown, workspaceItem, workspaceName,
workspacePreview, createButton, deleteButton, renameInput

**States:** closed, open, editing, confirming-delete

### W4. layout-builder

**File:** `clef-base/widgets/layout-builder.widget`

Admin UI for visually composing SplitLayout trees and configuring dock
zones. Drag-and-drop canvas where users can add splits, assign views to
leaves, configure tab groups, and set dock zone rules.

**Anatomy:** root, canvas, toolbar, splitButton, addPaneButton,
removePaneButton, directionToggle, ratioSlider, zoneConfig, treePreview,
propertyPanel, saveButton

**States:** idle, dragging-split, configuring-zone, saving

---

## Syncs

### SY1. Navigation opens tabs

**File:** `syncs/ui-app/navigation-opens-tabs.sync`

When Navigator/go fires, instead of replacing the Shell zone content,
open the destination as a new tab (or activate existing tab) in the
active TabGroup.

### SY2. Pane lifecycle wiring

**File:** `syncs/ui-app/pane-lifecycle.sync`

- Pane/open → Host/mount
- Pane/close → Host/unmount
- Pane/maximize → SplitLayout/collapse (collapse siblings)
- Pane/restore → SplitLayout/expand

### SY3. Dock zone initialization

**File:** `syncs/ui-app/dock-zone-init.sync`

On Shell/initialize, register default dock zones (left sidebar, right
sidebar, bottom panel, center) from the shell config.

### SY4. Workspace persistence

**File:** `syncs/ui-app/workspace-persistence.sync`

- Periodic: capture SplitLayout/getTree + TabGroup/list + Pane/list →
  Workspace/save
- Authentication/login → Workspace/restore → rebuild layout

### SY5. Tab group cleanup

**File:** `syncs/ui-app/tab-group-cleanup.sync`

When the last tab is removed from a TabGroup, collapse the containing
split layout leaf. When a TabGroup becomes empty in a dock zone,
auto-hide the zone if autoHide is enabled.

---

## Clef Base Integration

### CB1. Layout Builder page

**File:** `clef-base/app/views/LayoutBuilderView.tsx`

Admin page for building layouts visually:
- Canvas showing the split tree as nested resizable boxes
- Click a leaf to assign a View/Layout to it
- Drag dividers to set ratios
- Add/remove splits via toolbar
- Configure dock zones and their rules
- Save as a Workspace or as a named Layout entity

Registered as a DestinationCatalog entry at `/admin/layout-builder`.

### CB2. Workspace Manager page

**File:** `clef-base/app/views/WorkspaceManagerView.tsx`

Admin page for managing workspaces:
- List all workspaces for the current user
- Create/rename/duplicate/delete workspaces
- Set default workspace
- Preview workspace layout as a thumbnail
- Export/import workspace JSON

Registered at `/admin/workspaces`.

### CB3. Shell integration

**File:** `clef-base/lib/clef-provider.tsx` (modifications)

Update ClefProvider to:
- Load default workspace on mount
- Render SplitLayout tree instead of single-zone HostedPage
- Manage TabGroups within the shell
- Wire Navigator to open tabs instead of replace content
- Persist workspace state on change

### CB4. SplitLayoutRenderer component

**File:** `clef-base/app/components/SplitLayoutRenderer.tsx`

React component that recursively renders a SplitLayout tree:
- Split nodes → nested flex containers with Splitter widgets
- Leaf nodes → TabGroup (using Tabs widget) containing Pane content
- Each pane renders its Host's mounted view
- Handles resize events → SplitLayout/resize
- Handles drag events → DockZone/moveTo

### CB5. View seeds for windowing

**File:** `clef-base/seeds/Workspace.seeds.yaml`

Default workspace with:
- Center: single TabGroup with "content-list" as initial tab
- Left sidebar: TabGroup with "concepts", "schemas" tabs (collapsible)
- Bottom panel: TabGroup with "score", "syncs" tabs (collapsed by default)

**File:** `clef-base/seeds/DockZone.seeds.yaml`

Default dock zones: left, right, bottom, center.

**File:** `clef-base/seeds/DestinationCatalog.seeds.yaml` (additions)

Add layout-builder and workspaces destinations.

---

## Implementation Order

1. **Concept specs** — Pane, TabGroup, SplitLayout, DockZone, Workspace
2. **Conformance tests** — generate from specs
3. **Handlers** — build against conformance tests
4. **Syncs** — wire concepts together
5. **Widgets** — pane-header, dock-handle, workspace-switcher, layout-builder
6. **Clef Base components** — SplitLayoutRenderer, LayoutBuilderView, WorkspaceManagerView
7. **Shell integration** — update ClefProvider for workspace/tab behavior
8. **Seeds** — default workspace, dock zones, destinations

---

## Traceability Matrix

| PRD Section | File | Lines | Status |
|-------------|------|-------|--------|
| C1. Pane concept | `repertoire/concepts/ui-app/pane.concept` | | pending |
| C2. TabGroup concept | `repertoire/concepts/ui-app/tab-group.concept` | | pending |
| C3. SplitLayout concept | `repertoire/concepts/ui-app/split-layout.concept` | | pending |
| C4. DockZone concept | `repertoire/concepts/ui-app/dock-zone.concept` | | pending |
| C5. Workspace concept | `repertoire/concepts/ui-app/workspace.concept` | | pending |
| C1h. Pane handler | `handlers/ts/app/pane.handler.ts` | | pending |
| C2h. TabGroup handler | `handlers/ts/app/tab-group.handler.ts` | | pending |
| C3h. SplitLayout handler | `handlers/ts/app/split-layout.handler.ts` | | pending |
| C4h. DockZone handler | `handlers/ts/app/dock-zone.handler.ts` | | pending |
| C5h. Workspace handler | `handlers/ts/app/workspace.handler.ts` | | pending |
| W1. pane-header widget | `clef-base/widgets/pane-header.widget` | | pending |
| W2. dock-handle widget | `clef-base/widgets/dock-handle.widget` | | pending |
| W3. workspace-switcher widget | `clef-base/widgets/workspace-switcher.widget` | | pending |
| W4. layout-builder widget | `clef-base/widgets/layout-builder.widget` | | pending |
| SY1. Navigation opens tabs | `syncs/ui-app/navigation-opens-tabs.sync` | | pending |
| SY2. Pane lifecycle | `syncs/ui-app/pane-lifecycle.sync` | | pending |
| SY3. Dock zone init | `syncs/ui-app/dock-zone-init.sync` | | pending |
| SY4. Workspace persistence | `syncs/ui-app/workspace-persistence.sync` | | pending |
| SY5. Tab group cleanup | `syncs/ui-app/tab-group-cleanup.sync` | | pending |
| CB1. Layout Builder view | `clef-base/app/views/LayoutBuilderView.tsx` | | pending |
| CB2. Workspace Manager view | `clef-base/app/views/WorkspaceManagerView.tsx` | | pending |
| CB3. Shell integration | `clef-base/lib/clef-provider.tsx` | | pending |
| CB4. SplitLayoutRenderer | `clef-base/app/components/SplitLayoutRenderer.tsx` | | pending |
| CB5. Seeds | `clef-base/seeds/Workspace.seeds.yaml` | | pending |
| CB5. Seeds | `clef-base/seeds/DockZone.seeds.yaml` | | pending |
