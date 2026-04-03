// @clef-handler style=functional
// TabGroup Concept Implementation
// Manages an ordered set of panes as tabs within a named group.
// Supports activation, reordering, pinning, and close semantics.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function parseTabs(rec: Record<string, unknown>): string[] {
  try { return JSON.parse(rec.tabs as string) || []; } catch { return []; }
}

function parsePinned(rec: Record<string, unknown>): string[] {
  try { return JSON.parse(rec.pinnedTabs as string) || []; } catch { return []; }
}

function parseHistory(rec: Record<string, unknown>): string[] {
  try { return JSON.parse(rec.history as string) || []; } catch { return []; }
}

const _tabGroupHandler: FunctionalConceptHandler = {

  create(input: Record<string, unknown>) {
    const group = input.group as string;
    const name = input.name as string;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'tabGroup', {}, '_allGroups');
    p = mapBindings(p, (b) => {
      const all = (b._allGroups as Array<Record<string, unknown>>) || [];
      return all.find((g) => g.name === name) || null;
    }, '_nameMatch');
    return branch(p,
      (b) => b._nameMatch != null,
      (b) => complete(b, 'duplicate', { message: `A tab group named "${name}" already exists` }),
      (b) => {
        const b2 = put(b, 'tabGroup', group, {
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
    p = spGet(p, 'tabGroup', group, '_rec');
    p = mapBindings(p, (b) => {
      const rec = b._rec as Record<string, unknown> | null;
      if (!rec) return null;
      return parseTabs(rec);
    }, '_tabs');
    p = mapBindings(p, (b) => {
      const tabs = b._tabs as string[] | null;
      if (!tabs) return false;
      return tabs.includes(paneId);
    }, '_tabExists');
    p = mapBindings(p, (b) => {
      const tabs = b._tabs as string[] | null;
      if (!tabs) return false;
      if (position == null) return false;
      return position < 0 || position > tabs.length;
    }, '_posInvalid');

    return branch(p,
      (b) => b._rec == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => branch(b,
        (b2) => !!(b2._tabExists),
        (b2) => complete(b2, 'duplicate', { message: `Tab ${paneId} already exists in group` }),
        (b2) => branch(b2,
          (b3) => !!(b3._posInvalid),
          (b3) => complete(b3, 'invalid', { message: `Position ${position} is out of range` }),
          (b3) => {
            // Write updated tabs and activeTab
            let b4 = putFrom(b3, 'tabGroup', group, (bindings) => {
              const rec = bindings._rec as Record<string, unknown>;
              const tabs = bindings._tabs as string[];
              const activeTab = (rec.activeTab as string | null) ?? null;
              let newTabs: string[];
              if (position != null) {
                newTabs = [...tabs.slice(0, position), paneId, ...tabs.slice(position)];
              } else {
                newTabs = [...tabs, paneId];
              }
              const newActive = activeTab ?? paneId;
              return {
                ...(rec as object),
                tabs: JSON.stringify(newTabs),
                activeTab: newActive,
              };
            });
            return completeFrom(b4, 'ok', (bindings) => {
              const rec = bindings._rec as Record<string, unknown>;
              const tabs = bindings._tabs as string[];
              const activeTab = (rec.activeTab as string | null) ?? null;
              let newTabs: string[];
              if (position != null) {
                newTabs = [...tabs.slice(0, position), paneId, ...tabs.slice(position)];
              } else {
                newTabs = [...tabs, paneId];
              }
              return { group, tabs: newTabs };
            });
          },
        ),
      ),
    ) as StorageProgram<Result>;
  },

  removeTab(input: Record<string, unknown>) {
    const group = input.group as string;
    const paneId = input.paneId as string;

    let p = createProgram();
    p = spGet(p, 'tabGroup', group, '_rec');
    p = mapBindings(p, (b) => {
      const rec = b._rec as Record<string, unknown> | null;
      if (!rec) return null;
      return parseTabs(rec);
    }, '_tabs');
    p = mapBindings(p, (b) => {
      const rec = b._rec as Record<string, unknown> | null;
      if (!rec) return null;
      return parsePinned(rec);
    }, '_pinned');

    return branch(p,
      (b) => b._rec == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => branch(b,
        (b2) => {
          const tabs = b2._tabs as string[] | null;
          return !tabs || !tabs.includes(paneId);
        },
        (b2) => complete(b2, 'notfound', { message: `Tab ${paneId} not found in group` }),
        (b2) => branch(b2,
          (b3) => {
            const pinned = b3._pinned as string[] | null;
            return !!(pinned && pinned.includes(paneId));
          },
          (b3) => complete(b3, 'invalid', { message: `Tab ${paneId} is pinned; use unpinTab first` }),
          (b3) => {
            let b4 = putFrom(b3, 'tabGroup', group, (bindings) => {
              const rec = bindings._rec as Record<string, unknown>;
              const tabs = bindings._tabs as string[];
              const pinned = bindings._pinned as string[];
              const activeTab = rec.activeTab as string | null;
              let history = parseHistory(rec);

              const newTabs = tabs.filter((id) => id !== paneId);
              const newPinned = pinned.filter((id) => id !== paneId);

              let nextActive: string | null;
              let newHistory: string[];

              if (activeTab === paneId) {
                const filtered = history.filter((id) => newTabs.includes(id));
                nextActive = filtered.length > 0 ? filtered[0] : (newTabs.length > 0 ? newTabs[0] : null);
                newHistory = history.filter((id) => id !== nextActive && newTabs.includes(id));
              } else {
                nextActive = activeTab;
                newHistory = history.filter((id) => newTabs.includes(id));
              }

              return {
                ...(rec as object),
                tabs: JSON.stringify(newTabs),
                pinnedTabs: JSON.stringify(newPinned),
                activeTab: nextActive,
                history: JSON.stringify(newHistory),
              };
            });
            return completeFrom(b4, 'ok', (bindings) => {
              const rec = bindings._rec as Record<string, unknown>;
              const tabs = bindings._tabs as string[];
              const pinned = bindings._pinned as string[];
              const activeTab = rec.activeTab as string | null;
              let history = parseHistory(rec);
              const newTabs = tabs.filter((id) => id !== paneId);
              let nextActive: string | null;
              if (activeTab === paneId) {
                const filtered = history.filter((id) => newTabs.includes(id));
                nextActive = filtered.length > 0 ? filtered[0] : (newTabs.length > 0 ? newTabs[0] : null);
              } else {
                nextActive = activeTab;
              }
              void pinned;
              return { group, tabs: newTabs, nextActive };
            });
          },
        ),
      ),
    ) as StorageProgram<Result>;
  },

  activateTab(input: Record<string, unknown>) {
    const group = input.group as string;
    const paneId = input.paneId as string;

    let p = createProgram();
    p = spGet(p, 'tabGroup', group, '_rec');
    p = mapBindings(p, (b) => {
      const rec = b._rec as Record<string, unknown> | null;
      if (!rec) return null;
      return parseTabs(rec);
    }, '_tabs');

    return branch(p,
      (b) => b._rec == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => branch(b,
        (b2) => {
          const tabs = b2._tabs as string[] | null;
          return !tabs || !tabs.includes(paneId);
        },
        (b2) => complete(b2, 'notfound', { message: `Tab ${paneId} not found in group` }),
        (b2) => {
          let b3 = putFrom(b2, 'tabGroup', group, (bindings) => {
            const rec = bindings._rec as Record<string, unknown>;
            const currentActive = rec.activeTab as string | null;
            let history = parseHistory(rec);
            // Always prepend the current active to history when switching tabs
            // (even when activating the same tab, to allow activatePrevious to work)
            const newHistory = currentActive
              ? [currentActive, ...history]
              : history;
            return {
              ...(rec as object),
              activeTab: paneId,
              history: JSON.stringify(newHistory),
            };
          });
          return complete(b3, 'ok', { group, activeTab: paneId });
        },
      ),
    ) as StorageProgram<Result>;
  },

  moveTab(input: Record<string, unknown>) {
    const group = input.group as string;
    const paneId = input.paneId as string;
    const newPosition = input.newPosition as number;

    let p = createProgram();
    p = spGet(p, 'tabGroup', group, '_rec');
    p = mapBindings(p, (b) => {
      const rec = b._rec as Record<string, unknown> | null;
      if (!rec) return null;
      return parseTabs(rec);
    }, '_tabs');
    p = mapBindings(p, (b) => {
      const rec = b._rec as Record<string, unknown> | null;
      if (!rec) return null;
      return parsePinned(rec);
    }, '_pinned');

    return branch(p,
      (b) => b._rec == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => branch(b,
        (b2) => {
          const tabs = b2._tabs as string[] | null;
          return !tabs || !tabs.includes(paneId);
        },
        (b2) => complete(b2, 'notfound', { message: `Tab ${paneId} not found in group` }),
        (b2) => branch(b2,
          (b3) => {
            const tabs = b3._tabs as string[] | null;
            return !tabs || newPosition < 0 || newPosition >= tabs.length;
          },
          (b3) => complete(b3, 'invalid', { message: `Position ${newPosition} is out of range` }),
          (b3) => branch(b3,
            (b4) => {
              const pinned = b4._pinned as string[] | null;
              const isPinned = !!(pinned && pinned.includes(paneId));
              const pinnedCount = pinned ? pinned.length : 0;
              if (isPinned && newPosition >= pinnedCount) return true;
              if (!isPinned && newPosition < pinnedCount) return true;
              return false;
            },
            (b4) => complete(b4, 'invalid', { message: `Tab cannot be moved across the pinned/unpinned boundary` }),
            (b4) => {
              let b5 = putFrom(b4, 'tabGroup', group, (bindings) => {
                const rec = bindings._rec as Record<string, unknown>;
                const tabs = bindings._tabs as string[];
                const withoutPane = tabs.filter((id) => id !== paneId);
                const newTabs = [...withoutPane.slice(0, newPosition), paneId, ...withoutPane.slice(newPosition)];
                return { ...(rec as object), tabs: JSON.stringify(newTabs) };
              });
              return completeFrom(b5, 'ok', (bindings) => {
                const tabs = bindings._tabs as string[];
                const withoutPane = tabs.filter((id) => id !== paneId);
                const newTabs = [...withoutPane.slice(0, newPosition), paneId, ...withoutPane.slice(newPosition)];
                return { group, tabs: newTabs };
              });
            },
          ),
        ),
      ),
    ) as StorageProgram<Result>;
  },

  pinTab(input: Record<string, unknown>) {
    const group = input.group as string;
    const paneId = input.paneId as string;

    let p = createProgram();
    p = spGet(p, 'tabGroup', group, '_rec');
    p = mapBindings(p, (b) => {
      const rec = b._rec as Record<string, unknown> | null;
      if (!rec) return null;
      return parseTabs(rec);
    }, '_tabs');
    p = mapBindings(p, (b) => {
      const rec = b._rec as Record<string, unknown> | null;
      if (!rec) return null;
      return parsePinned(rec);
    }, '_pinned');

    return branch(p,
      (b) => b._rec == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => branch(b,
        (b2) => {
          const tabs = b2._tabs as string[] | null;
          return !tabs || !tabs.includes(paneId);
        },
        (b2) => complete(b2, 'notfound', { message: `Tab ${paneId} not found in group` }),
        (b2) => branch(b2,
          (b3) => {
            const pinned = b3._pinned as string[] | null;
            return !!(pinned && pinned.includes(paneId));
          },
          (b3) => complete(b3, 'duplicate', { message: `Tab ${paneId} is already pinned` }),
          (b3) => {
            let b4 = putFrom(b3, 'tabGroup', group, (bindings) => {
              const rec = bindings._rec as Record<string, unknown>;
              const tabs = bindings._tabs as string[];
              const pinned = bindings._pinned as string[];
              const newPinned = [paneId, ...pinned];
              // Move paneId to front of tab list (front of pinned region)
              const withoutPane = tabs.filter((id) => id !== paneId);
              const newTabs = [paneId, ...withoutPane];
              return {
                ...(rec as object),
                tabs: JSON.stringify(newTabs),
                pinnedTabs: JSON.stringify(newPinned),
              };
            });
            return completeFrom(b4, 'ok', (bindings) => {
              const pinned = bindings._pinned as string[];
              const newPinned = [paneId, ...pinned];
              return { group, pinnedTabs: newPinned };
            });
          },
        ),
      ),
    ) as StorageProgram<Result>;
  },

  unpinTab(input: Record<string, unknown>) {
    const group = input.group as string;
    const paneId = input.paneId as string;

    let p = createProgram();
    p = spGet(p, 'tabGroup', group, '_rec');
    p = mapBindings(p, (b) => {
      const rec = b._rec as Record<string, unknown> | null;
      if (!rec) return null;
      return parsePinned(rec);
    }, '_pinned');

    return branch(p,
      (b) => b._rec == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => branch(b,
        (b2) => {
          const pinned = b2._pinned as string[] | null;
          return !pinned || !pinned.includes(paneId);
        },
        (b2) => complete(b2, 'notfound', { message: `Tab ${paneId} is not pinned` }),
        (b2) => {
          let b3 = putFrom(b2, 'tabGroup', group, (bindings) => {
            const rec = bindings._rec as Record<string, unknown>;
            const pinned = bindings._pinned as string[];
            const newPinned = pinned.filter((id) => id !== paneId);
            return { ...(rec as object), pinnedTabs: JSON.stringify(newPinned) };
          });
          return completeFrom(b3, 'ok', (bindings) => {
            const pinned = bindings._pinned as string[];
            const newPinned = pinned.filter((id) => id !== paneId);
            return { group, pinnedTabs: newPinned };
          });
        },
      ),
    ) as StorageProgram<Result>;
  },

  activatePrevious(input: Record<string, unknown>) {
    const group = input.group as string;

    let p = createProgram();
    p = spGet(p, 'tabGroup', group, '_rec');
    p = mapBindings(p, (b) => {
      const rec = b._rec as Record<string, unknown> | null;
      if (!rec) return null;
      return parseHistory(rec);
    }, '_history');

    return branch(p,
      (b) => b._rec == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => branch(b,
        (b2) => {
          const history = b2._history as string[] | null;
          return !history || history.length === 0;
        },
        (b2) => complete(b2, 'empty', { message: 'Activation history is empty' }),
        (b2) => {
          let b3 = putFrom(b2, 'tabGroup', group, (bindings) => {
            const rec = bindings._rec as Record<string, unknown>;
            const history = bindings._history as string[];
            const prevTab = history[0];
            const currentActive = rec.activeTab as string | null;
            const newHistory = history.slice(1);
            const updatedHistory = currentActive ? [currentActive, ...newHistory] : newHistory;
            return {
              ...(rec as object),
              activeTab: prevTab,
              history: JSON.stringify(updatedHistory),
            };
          });
          return completeFrom(b3, 'ok', (bindings) => {
            const history = bindings._history as string[];
            const prevTab = history[0];
            return { group, activeTab: prevTab };
          });
        },
      ),
    ) as StorageProgram<Result>;
  },

  closeOthers(input: Record<string, unknown>) {
    const group = input.group as string;
    const keepPaneId = input.keepPaneId as string;

    let p = createProgram();
    p = spGet(p, 'tabGroup', group, '_rec');
    p = mapBindings(p, (b) => {
      const rec = b._rec as Record<string, unknown> | null;
      if (!rec) return null;
      return parseTabs(rec);
    }, '_tabs');
    p = mapBindings(p, (b) => {
      const rec = b._rec as Record<string, unknown> | null;
      if (!rec) return null;
      return parsePinned(rec);
    }, '_pinned');

    return branch(p,
      (b) => b._rec == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => branch(b,
        (b2) => {
          const tabs = b2._tabs as string[] | null;
          return !tabs || !tabs.includes(keepPaneId);
        },
        (b2) => complete(b2, 'notfound', { message: `Tab ${keepPaneId} not found in group` }),
        (b2) => branch(b2,
          (b3) => {
            const pinned = b3._pinned as string[] | null;
            return !!(pinned && pinned.includes(keepPaneId));
          },
          (b3) => complete(b3, 'invalid', { message: `Tab ${keepPaneId} is pinned; closeOthers cannot keep a pinned tab` }),
          (b3) => {
            let b4 = putFrom(b3, 'tabGroup', group, (bindings) => {
              const rec = bindings._rec as Record<string, unknown>;
              const pinned = bindings._pinned as string[];
              const newTabs = [...pinned, keepPaneId];
              return {
                ...(rec as object),
                tabs: JSON.stringify(newTabs),
                activeTab: keepPaneId,
                history: JSON.stringify([]),
              };
            });
            return completeFrom(b4, 'ok', (bindings) => {
              const pinned = bindings._pinned as string[];
              const newTabs = [...pinned, keepPaneId];
              return { group, tabs: newTabs };
            });
          },
        ),
      ),
    ) as StorageProgram<Result>;
  },

  closeAll(input: Record<string, unknown>) {
    const group = input.group as string;

    let p = createProgram();
    p = spGet(p, 'tabGroup', group, '_rec');
    return branch(p,
      (b) => b._rec == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => {
        let b2 = putFrom(b, 'tabGroup', group, (bindings) => {
          const rec = bindings._rec as Record<string, unknown>;
          return {
            ...(rec as object),
            tabs: JSON.stringify([]),
            activeTab: null,
            pinnedTabs: JSON.stringify([]),
            history: JSON.stringify([]),
          };
        });
        return complete(b2, 'ok', { group });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const group = input.group as string;

    let p = createProgram();
    p = spGet(p, 'tabGroup', group, '_rec');
    return branch(p,
      (b) => b._rec == null,
      (b) => complete(b, 'notfound', { message: `Tab group not found: ${group}` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings._rec as Record<string, unknown>;
        return {
          group: rec.group as string,
          name: rec.name as string,
          tabs: parseTabs(rec),
          activeTab: (rec.activeTab as string | null) ?? null,
          pinnedTabs: parsePinned(rec),
          history: parseHistory(rec),
        };
      }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'tabGroup', {}, '_allGroups');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings._allGroups as Array<Record<string, unknown>>) || [];
      return { groups: all.map((g) => g.group as string) };
    }) as StorageProgram<Result>;
  },

};

export const tabGroupHandler = autoInterpret(_tabGroupHandler);
