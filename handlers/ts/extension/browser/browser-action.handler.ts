// @clef-handler style=functional
// BrowserAction Concept Implementation
// Toolbar button management for browser extensions. Controls per-tab badge text
// and color, icon, popup binding, enable/disable state, and context menu entries.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `browser-action-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'BrowserAction' }) as StorageProgram<Result>;
  },

  configure(input: Record<string, unknown>) {
    const extensionId = input.extensionId as string;
    const icon = input.icon as string;
    const popupUrl = input.popupUrl as string | undefined;

    if (!extensionId || extensionId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'extensionId is required' }) as StorageProgram<Result>;
    }
    if (!icon || icon.trim() === '') {
      return complete(createProgram(), 'error', { message: 'icon is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'browserAction', { extensionId }, 'existing');
    p = mapBindings(p, (b) => ((b.existing as unknown[]) || []).length > 0 ? (b.existing as unknown[])[0] : null, '_found');
    return branch(p, '_found',
      (b) => complete(b, 'ok', { message: 'Action already configured for this extension.' }),
      (b) => {
        const id = nextId();
        let b2 = put(b, 'browserAction', id, {
          id, extensionId, icon,
          popupUrl: popupUrl ?? null,
          badgeText: null,
          badgeColor: null,
          enabled: true,
          contextMenuEntries: '[]',
        });
        return complete(b2, 'ok', { action: id });
      },
    ) as StorageProgram<Result>;
  },

  setBadge(input: Record<string, unknown>) {
    const action = input.action as string;
    const tabId = input.tabId as string | undefined;
    const text = input.text as string;
    const color = input.color as string;

    let p = createProgram();
    p = get(p, 'browserAction', action, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'browserAction', action, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, badgeText: text, badgeColor: color };
        });
        return complete(b2, 'ok', { action });
      },
      (b) => complete(b, 'notfound', { message: 'No browser action with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  setIcon(input: Record<string, unknown>) {
    const action = input.action as string;
    const tabId = input.tabId as string | undefined;
    const icon = input.icon as string;

    if (!icon || icon.trim() === '') {
      return complete(createProgram(), 'error', { message: 'icon is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'browserAction', action, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'browserAction', action, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, icon };
        });
        return complete(b2, 'ok', { action });
      },
      (b) => complete(b, 'notfound', { message: 'No browser action with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  setPopup(input: Record<string, unknown>) {
    const action = input.action as string;
    const popupUrl = input.popupUrl as string;

    if (!popupUrl || popupUrl.trim() === '') {
      return complete(createProgram(), 'error', { message: 'popupUrl is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'browserAction', action, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'browserAction', action, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, popupUrl };
        });
        return complete(b2, 'ok', { action });
      },
      (b) => complete(b, 'notfound', { message: 'No browser action with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  setEnabled(input: Record<string, unknown>) {
    const action = input.action as string;
    const tabId = input.tabId as string | undefined;
    const enabled = input.enabled as boolean;

    let p = createProgram();
    p = get(p, 'browserAction', action, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'browserAction', action, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, enabled };
        });
        return complete(b2, 'ok', { action });
      },
      (b) => complete(b, 'notfound', { message: 'No browser action with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  addContextMenu(input: Record<string, unknown>) {
    const action = input.action as string;
    const id = input.id as string;
    const title = input.title as string;
    const contexts = (input.contexts as string | undefined) ?? '["all"]';

    if (!action || action.trim() === '') {
      return complete(createProgram(), 'error', { message: 'action is required' }) as StorageProgram<Result>;
    }
    if (!id || id.trim() === '') {
      return complete(createProgram(), 'error', { message: 'context menu id is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'browserAction', action, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'browserAction', action, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          let entries: Array<{ id: string; title: string; contexts: string }> = [];
          try { entries = JSON.parse(record.contextMenuEntries as string || '[]'); } catch { entries = []; }
          if (entries.some((e) => e.id === id)) {
            // Already exists — return as-is but signal to caller
            return record;
          }
          entries.push({ id, title, contexts });
          return { ...record, contextMenuEntries: JSON.stringify(entries) };
        });
        return complete(b2, 'ok', { action });
      },
      (b) => complete(b, 'notfound', { message: 'No browser action with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  removeContextMenu(input: Record<string, unknown>) {
    const action = input.action as string;
    const id = input.id as string;

    if (!id || id.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'No browser action or context menu entry found.' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'browserAction', action, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'browserAction', action, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          let entries: Array<{ id: string }> = [];
          try { entries = JSON.parse(record.contextMenuEntries as string || '[]'); } catch { entries = []; }
          entries = entries.filter((e) => e.id !== id);
          return { ...record, contextMenuEntries: JSON.stringify(entries) };
        });
        return complete(b2, 'ok', { action });
      },
      (b) => complete(b, 'notfound', { message: 'No browser action or context menu entry found.' }),
    ) as StorageProgram<Result>;
  },

  onClicked(input: Record<string, unknown>) {
    const action = input.action as string;
    const tabId = input.tabId as string;

    if (!tabId || tabId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'tabId is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'browserAction', action, 'record');
    return branch(p, 'record',
      (b) => complete(b, 'ok', { action }),
      (b) => complete(b, 'notfound', { message: 'No browser action with the given identifier.' }),
    ) as StorageProgram<Result>;
  },
};

export const browserActionHandler = autoInterpret(_handler);
