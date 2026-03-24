// @clef-handler style=functional
// BrowserExtensionHost Concept Implementation
// Browser-specific provider for ExtensionHost. Manages service worker lifecycle,
// content script injection scheduling, tab URL matching, and browser event handling.
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
  return `browser-ext-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'BrowserExtensionHost' }) as StorageProgram<Result>;
  },

  activate(input: Record<string, unknown>) {
    const extension = input.extension as string;

    if (!extension || extension.trim() === '') {
      return complete(createProgram(), 'error', { message: 'extension is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'browserExtension', extension, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'browserExtension', extension, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, status: 'active', serviceWorkerState: 'running' };
        });
        return complete(b2, 'ok', { extension });
      },
      (b) => {
        // No existing record — create one
        let b2 = put(b, 'browserExtension', extension, {
          id: extension,
          status: 'active',
          serviceWorkerState: 'running',
          contentScripts: '[]',
          tabMatches: '{}',
        });
        return complete(b2, 'ok', { extension });
      },
    ) as StorageProgram<Result>;
  },

  deactivate(input: Record<string, unknown>) {
    const extension = input.extension as string;

    let p = createProgram();
    p = get(p, 'browserExtension', extension, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'browserExtension', extension, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, status: 'inactive', serviceWorkerState: 'stopped' };
        });
        return complete(b2, 'ok', { extension });
      },
      (b) => complete(b, 'notfound', { message: 'No browser extension with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  injectContentScript(input: Record<string, unknown>) {
    const extension = input.extension as string;
    const tabId = input.tabId as string;
    const scriptId = input.scriptId as string;

    if (!tabId || tabId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'No browser extension or tab found.' }) as StorageProgram<Result>;
    }
    if (!scriptId || scriptId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'No browser extension or tab found.' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'browserExtension', extension, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'browserExtension', extension, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          let contentScripts: Array<{ tabId: string; scriptId: string }> = [];
          try { contentScripts = JSON.parse(record.contentScripts as string || '[]'); } catch { contentScripts = []; }
          contentScripts.push({ tabId, scriptId });
          return { ...record, contentScripts: JSON.stringify(contentScripts) };
        });
        return complete(b2, 'ok', { extension });
      },
      (b) => complete(b, 'notfound', { message: 'No browser extension or tab found.' }),
    ) as StorageProgram<Result>;
  },

  onTabUpdate(input: Record<string, unknown>) {
    const tabId = input.tabId as string;
    const url = input.url as string;
    const status = (input.status as string | undefined) ?? 'complete';

    let p = createProgram();
    p = find(p, 'browserExtension', { status: 'active' }, 'activeExtensions');
    return completeFrom(p, 'ok', (bindings) => {
      const activeExtensions = (bindings.activeExtensions as unknown[]) || [];
      // Return extensions that would match the URL (simplified pattern matching)
      const matchedExtensions = JSON.stringify(activeExtensions.map((e) => (e as Record<string, unknown>).id));
      return { matchedExtensions };
    }) as StorageProgram<Result>;
  },

  onBrowserEvent(input: Record<string, unknown>) {
    const eventType = input.eventType as string;
    const data = (input.data as string | undefined) ?? '{}';

    let p = createProgram();
    // Browser events are handled by routing — record the event and return handled
    return complete(p, 'ok', { handled: true }) as StorageProgram<Result>;
  },

  getStatus(input: Record<string, unknown>) {
    const extension = input.extension as string;

    let p = createProgram();
    p = get(p, 'browserExtension', extension, 'record');
    return branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          status: record.status as string,
          serviceWorkerState: record.serviceWorkerState as string,
        };
      }),
      (b) => complete(b, 'notfound', { message: 'No browser extension with the given identifier.' }),
    ) as StorageProgram<Result>;
  },
};

export const browserExtensionHostHandler = autoInterpret(_handler);
