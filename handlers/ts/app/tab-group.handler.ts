// @clef-handler style=functional
// TabGroup Concept Implementation
// Manages an ordered set of panes as tabs within a named group.
// Supports activation, reordering, pinning, and close semantics.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _tabGroupHandler: FunctionalConceptHandler = {

  create(input: Record<string, unknown>) {
    const group = input.group as string;
    const name = input.name as string;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }

    // Check uniqueness by name
    let p = createProgram();
    p = find(p, 'tabGroup', {}, 'allGroups');
    p = mapBindings(p, (b) => {
      const all = (b.allGroups as Array<Record<string, unknown>>) || [];
      return all.find((g) => g.name === name) || null;
    }, '_nameMatch');
    return branch(p,
      (b) => b._nameMatch != null,
      (b) => complete(b, 'duplicate', { message: `A tab group named "${name}" already exists` }),
      (b) => {
        let b2 = put(b, 'tabGroup', group, {
          group,
          name,
          tabs: JSON.stringify([]),
          activeTab: null,
          pinnedTabs: JSON.stringify([]),
          history: JSON.stringify([]),
        });
        return complete(b2, 'ok', { group });
      },
    ) as StorageProgram<Result>;
  },

  addTab(input: Record<string, unknown>) {
    const group = input.group as string;
    const paneId = input.paneId as string;
    const position = input.position != null ? (input.position as number) : null;

    if (!paneId || paneId.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'paneId is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'tabGroup', group, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => {
        return branch(b,
          (b2) => {
            const rec = b2.existing as Record<string, unknown>;
            let tabs: string[] = [];
            try { tabs = JSON.parse(rec.tabs as string) || []; } catch { /* empty */ }
            return tabs.includes(paneId);
          },
          (dupB) => complete(dupB, 'duplicate', { message: `Tab ${paneId} already exists in group` }),
          (addB) => {
            const rec = addB.existing as Record<string, unknown>;
            let tabs: string[] = [];
            try { tabs = JSON.parse(rec.tabs as string) || []; } catch { /* empty */ }
            let activeTab = rec.activeTab as string | null;

            // Validate position range
            if (position != null && (position < 0 || position > tabs.length)) {
              return complete(addB, 'invalid', { message: `Position ${position} is out of range` });
            }

            // Insert at position or append
            let newTabs: string[];
            if (position != null) {
              newTabs = [...tabs.slice(0, position), paneId, ...tabs.slice(position)];
            } else {
              newTabs = [...tabs, paneId];
            }

            // Activate if no active tab
            if (!activeTab) {
              activeTab = paneId;
            }

            let b2 = put(addB, 'tabGroup', group, {
              ...(rec as object),
              tabs: JSON.stringify(newTabs),
              activeTab,
            });
            return complete(b2, 'ok', { group, tabs: newTabs });
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  removeTab(input: Record<string, unknown>) {
    const group = input.group as string;
    const paneId = input.paneId as string;

    let p = createProgram();
    p = spGet(p, 'tabGroup', group, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => {
        const rec = b.existing as Record<string, unknown>;
        let tabs: string[] = [];
        let pinnedTabs: string[] = [];
        try { tabs = JSON.parse(rec.tabs as string) || []; } catch { /* empty */ }
        try { pinnedTabs = JSON.parse(rec.pinnedTabs as string) || []; } catch { /* empty */ }

        // Check pane exists in the group
        return branch(b,
          (b2) => {
            const r = b2.existing as Record<string, unknown>;
            let t: string[] = [];
            try { t = JSON.parse(r.tabs as string) || []; } catch { /* empty */ }
            return !t.includes(paneId);
          },
          (nb) => complete(nb, 'notfound', { message: `Tab ${paneId} not found in group` }),
          (okB) => {
            const r = okB.existing as Record<string, unknown>;
            let t: string[] = [];
            let pt: string[] = [];
            try { t = JSON.parse(r.tabs as string) || []; } catch { /* empty */ }
            try { pt = JSON.parse(r.pinnedTabs as string) || []; } catch { /* empty */ }

            // Pinned tab cannot be removed
            if (pt.includes(paneId)) {
              return complete(okB, 'invalid', { message: `Tab ${paneId} is pinned; use unpinTab first` });
            }

            const newTabs = t.filter((id) => id !== paneId);
            const newPinned = pt.filter((id) => id !== paneId);
            const activeTab = r.activeTab as string | null;
            let history: string[] = [];
            try { history = JSON.parse(r.history as string) || []; } catch { /* empty */ }

            // Determine next active tab
            let nextActive: string | null = activeTab;
            if (activeTab === paneId) {
              // Pop most recent from history that still exists
              const filtered = history.filter((id) => newTabs.includes(id));
              nextActive = filtered.length > 0 ? filtered[0] : (newTabs.length > 0 ? newTabs[0] : null);
              // Remove the nextActive from history to avoid double-entry
              const newHistory = history.filter((id) => id !== nextActive && newTabs.includes(id));
              let b2 = put(okB, 'tabGroup', group, {
                ...(r as object),
                tabs: JSON.stringify(newTabs),
                pinnedTabs: JSON.stringify(newPinned),
                activeTab: nextActive,
                history: JSON.stringify(newHistory),
              });
              return complete(b2, 'ok', { group, tabs: newTabs, nextActive });
            } else {
              // Active tab unchanged; just clean up history
              const newHistory = history.filter((id) => newTabs.includes(id));
              let b2 = put(okB, 'tabGroup', group, {
                ...(r as object),
                tabs: JSON.stringify(newTabs),
                pinnedTabs: JSON.stringify(newPinned),
                activeTab,
                history: JSON.stringify(newHistory),
              });
              return complete(b2, 'ok', { group, tabs: newTabs, nextActive: activeTab });
            }
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  activateTab(input: Record<string, unknown>) {
    const group = input.group as string;
    const paneId = input.paneId as string;

    let p = createProgram();
    p = spGet(p, 'tabGroup', group, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => {
        const rec = b.existing as Record<string, unknown>;
        let tabs: string[] = [];
        try { tabs = JSON.parse(rec.tabs as string) || []; } catch { /* empty */ }

        if (!tabs.includes(paneId)) {
          return complete(b, 'notfound', { message: `Tab ${paneId} not found in group` });
        }

        const currentActive = rec.activeTab as string | null;
        let history: string[] = [];
        try { history = JSON.parse(rec.history as string) || []; } catch { /* empty */ }

        // Prepend current active to history
        const newHistory = currentActive && currentActive !== paneId
          ? [currentActive, ...history]
          : history;

        let b2 = put(b, 'tabGroup', group, {
          ...(rec as object),
          activeTab: paneId,
          history: JSON.stringify(newHistory),
        });
        return complete(b2, 'ok', { group, activeTab: paneId });
      },
    ) as StorageProgram<Result>;
  },

  moveTab(input: Record<string, unknown>) {
    const group = input.group as string;
    const paneId = input.paneId as string;
    const newPosition = input.newPosition as number;

    let p = createProgram();
    p = spGet(p, 'tabGroup', group, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => {
        const rec = b.existing as Record<string, unknown>;
        let tabs: string[] = [];
        let pinnedTabs: string[] = [];
        try { tabs = JSON.parse(rec.tabs as string) || []; } catch { /* empty */ }
        try { pinnedTabs = JSON.parse(rec.pinnedTabs as string) || []; } catch { /* empty */ }

        if (!tabs.includes(paneId)) {
          return complete(b, 'notfound', { message: `Tab ${paneId} not found in group` });
        }

        // Validate new position range
        if (newPosition < 0 || newPosition >= tabs.length) {
          return complete(b, 'invalid', { message: `Position ${newPosition} is out of range` });
        }

        // Pinned tab constraint: pinned tabs can only move within pinned region
        const isPinned = pinnedTabs.includes(paneId);
        const pinnedCount = pinnedTabs.length;
        if (isPinned && newPosition >= pinnedCount) {
          return complete(b, 'invalid', { message: `Pinned tab cannot be moved outside the pinned region` });
        }
        if (!isPinned && newPosition < pinnedCount) {
          return complete(b, 'invalid', { message: `Unpinned tab cannot be moved into the pinned region` });
        }

        // Reorder tabs
        const withoutPane = tabs.filter((id) => id !== paneId);
        const newTabs = [...withoutPane.slice(0, newPosition), paneId, ...withoutPane.slice(newPosition)];

        let b2 = put(b, 'tabGroup', group, {
          ...(rec as object),
          tabs: JSON.stringify(newTabs),
        });
        return complete(b2, 'ok', { group, tabs: newTabs });
      },
    ) as StorageProgram<Result>;
  },

  pinTab(input: Record<string, unknown>) {
    const group = input.group as string;
    const paneId = input.paneId as string;

    let p = createProgram();
    p = spGet(p, 'tabGroup', group, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => {
        const rec = b.existing as Record<string, unknown>;
        let tabs: string[] = [];
        let pinnedTabs: string[] = [];
        try { tabs = JSON.parse(rec.tabs as string) || []; } catch { /* empty */ }
        try { pinnedTabs = JSON.parse(rec.pinnedTabs as string) || []; } catch { /* empty */ }

        if (!tabs.includes(paneId)) {
          return complete(b, 'notfound', { message: `Tab ${paneId} not found in group` });
        }

        if (pinnedTabs.includes(paneId)) {
          return complete(b, 'duplicate', { message: `Tab ${paneId} is already pinned` });
        }

        // Move to front of pinned region
        const newPinned = [paneId, ...pinnedTabs];
        const withoutPane = tabs.filter((id) => id !== paneId);
        // Insert at position 0 (front of pinned region)
        const newTabs = [paneId, ...withoutPane];

        let b2 = put(b, 'tabGroup', group, {
          ...(rec as object),
          tabs: JSON.stringify(newTabs),
          pinnedTabs: JSON.stringify(newPinned),
        });
        return complete(b2, 'ok', { group, pinnedTabs: newPinned });
      },
    ) as StorageProgram<Result>;
  },

  unpinTab(input: Record<string, unknown>) {
    const group = input.group as string;
    const paneId = input.paneId as string;

    let p = createProgram();
    p = spGet(p, 'tabGroup', group, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => {
        const rec = b.existing as Record<string, unknown>;
        let pinnedTabs: string[] = [];
        try { pinnedTabs = JSON.parse(rec.pinnedTabs as string) || []; } catch { /* empty */ }

        if (!pinnedTabs.includes(paneId)) {
          return complete(b, 'notfound', { message: `Tab ${paneId} is not pinned` });
        }

        const newPinned = pinnedTabs.filter((id) => id !== paneId);

        let b2 = put(b, 'tabGroup', group, {
          ...(rec as object),
          pinnedTabs: JSON.stringify(newPinned),
        });
        return complete(b2, 'ok', { group, pinnedTabs: newPinned });
      },
    ) as StorageProgram<Result>;
  },

  activatePrevious(input: Record<string, unknown>) {
    const group = input.group as string;

    let p = createProgram();
    p = spGet(p, 'tabGroup', group, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => {
        const rec = b.existing as Record<string, unknown>;
        let history: string[] = [];
        try { history = JSON.parse(rec.history as string) || []; } catch { /* empty */ }
        const currentActive = rec.activeTab as string | null;

        if (history.length === 0) {
          // Empty history — return empty variant (spec says -> ok for this too but fixture says -> empty)
          return complete(b, 'empty', { message: 'Activation history is empty' });
        }

        const prevTab = history[0];
        const newHistory = history.slice(1);

        // Push current active onto history
        const updatedHistory = currentActive ? [currentActive, ...newHistory] : newHistory;

        let b2 = put(b, 'tabGroup', group, {
          ...(rec as object),
          activeTab: prevTab,
          history: JSON.stringify(updatedHistory),
        });
        return complete(b2, 'ok', { group, activeTab: prevTab });
      },
    ) as StorageProgram<Result>;
  },

  closeOthers(input: Record<string, unknown>) {
    const group = input.group as string;
    const keepPaneId = input.keepPaneId as string;

    let p = createProgram();
    p = spGet(p, 'tabGroup', group, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => {
        const rec = b.existing as Record<string, unknown>;
        let tabs: string[] = [];
        let pinnedTabs: string[] = [];
        try { tabs = JSON.parse(rec.tabs as string) || []; } catch { /* empty */ }
        try { pinnedTabs = JSON.parse(rec.pinnedTabs as string) || []; } catch { /* empty */ }

        if (!tabs.includes(keepPaneId)) {
          return complete(b, 'notfound', { message: `Tab ${keepPaneId} not found in group` });
        }

        // keepPaneId must not be a pinned tab
        if (pinnedTabs.includes(keepPaneId)) {
          return complete(b, 'invalid', { message: `Tab ${keepPaneId} is pinned; closeOthers cannot keep a pinned tab` });
        }

        // Keep pinned tabs + the kept pane
        const newTabs = [...pinnedTabs, keepPaneId];

        let b2 = put(b, 'tabGroup', group, {
          ...(rec as object),
          tabs: JSON.stringify(newTabs),
          activeTab: keepPaneId,
          history: JSON.stringify([]),
        });
        return complete(b2, 'ok', { group, tabs: newTabs });
      },
    ) as StorageProgram<Result>;
  },

  closeAll(input: Record<string, unknown>) {
    const group = input.group as string;

    let p = createProgram();
    p = spGet(p, 'tabGroup', group, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => {
        const rec = b.existing as Record<string, unknown>;
        let b2 = put(b, 'tabGroup', group, {
          ...(rec as object),
          tabs: JSON.stringify([]),
          activeTab: null,
          pinnedTabs: JSON.stringify([]),
          history: JSON.stringify([]),
        });
        return complete(b2, 'ok', { group });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const group = input.group as string;

    let p = createProgram();
    p = spGet(p, 'tabGroup', group, 'record');
    return branch(p,
      (b) => b.record == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          let tabs: string[] = [];
          let pinnedTabs: string[] = [];
          let history: string[] = [];
          try { tabs = JSON.parse(rec.tabs as string) || []; } catch { /* empty */ }
          try { pinnedTabs = JSON.parse(rec.pinnedTabs as string) || []; } catch { /* empty */ }
          try { history = JSON.parse(rec.history as string) || []; } catch { /* empty */ }
          return {
            group: rec.group as string,
            name: rec.name as string,
            tabs,
            activeTab: rec.activeTab as string | null,
            pinnedTabs,
            history,
          };
        });
      },
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'tabGroup', {}, 'allGroups');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allGroups as Array<Record<string, unknown>>) || [];
      return { groups: all.map((g) => g.group as string) };
    }) as StorageProgram<Result>;
  },

};

export const tabGroupHandler = autoInterpret(_tabGroupHandler);
