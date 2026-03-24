// @clef-handler style=functional
// ContentScript Concept Implementation
// Content script management for browser extensions. Handles URL pattern matching,
// injection timing, world isolation, CSS injection, and bidirectional messaging.
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
  return `content-script-${++idCounter}`;
}

const VALID_RUN_AT = ['document_idle', 'document_start', 'document_end'];
const VALID_WORLDS = ['MAIN', 'ISOLATED'];

function isValidUrlPattern(pattern: string): boolean {
  // Basic URL pattern validation: must be a match pattern
  if (!pattern) return false;
  if (pattern === '<all_urls>') return true;
  // Must have scheme, host, path
  return /^(\*|https?|ftp):\/\//.test(pattern);
}

const _handler: FunctionalConceptHandler = {
  // register() with extensionId/urlPatterns args = spec register action
  // register() with no args = concept name registration
  register(input: Record<string, unknown>) {
    if (!input.extensionId && !input.urlPatterns) {
      return complete(createProgram(), 'ok', { name: 'ContentScript' }) as StorageProgram<Result>;
    }

    const extensionId = input.extensionId as string;
    const urlPatterns = input.urlPatterns as string;
    const runAt = (input.runAt as string | undefined) ?? 'document_idle';
    const world = (input.world as string | undefined) ?? 'ISOLATED';
    const jsFiles = input.jsFiles as string;
    const cssFiles = input.cssFiles as string | undefined;

    if (!extensionId || extensionId.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'extensionId is required' }) as StorageProgram<Result>;
    }
    if (!urlPatterns || urlPatterns.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'urlPatterns is required' }) as StorageProgram<Result>;
    }
    if (!jsFiles || jsFiles.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'jsFiles is required' }) as StorageProgram<Result>;
    }

    // Validate runAt
    if (!VALID_RUN_AT.includes(runAt)) {
      return complete(createProgram(), 'invalid', {
        message: `runAt must be one of: ${VALID_RUN_AT.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    // Validate world
    if (!VALID_WORLDS.includes(world)) {
      return complete(createProgram(), 'invalid', {
        message: `world must be one of: ${VALID_WORLDS.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    // Validate URL patterns
    let patterns: string[] = [];
    try {
      patterns = JSON.parse(urlPatterns);
      if (!Array.isArray(patterns)) patterns = [urlPatterns];
    } catch {
      patterns = [urlPatterns];
    }
    for (const pattern of patterns) {
      if (!isValidUrlPattern(pattern)) {
        return complete(createProgram(), 'invalid', {
          message: `URL pattern is malformed: '${pattern}'`,
        }) as StorageProgram<Result>;
      }
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'contentScript', id, {
      id, extensionId, urlPatterns, runAt, world,
      jsFiles, cssFiles: cssFiles ?? null,
      injectedTabs: '[]',
    });
    return complete(p, 'ok', { script: id }) as StorageProgram<Result>;
  },

  inject(input: Record<string, unknown>) {
    const script = input.script as string;
    const tabId = input.tabId as string;

    if (!tabId || tabId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'No content script with the given identifier.' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'contentScript', script, 'record');
    return branch(p, 'record',
      (b) => {
        // Check if URL matches (simplified — in real impl, would check tab URL against patterns)
        let b2 = putFrom(b, 'contentScript', script, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          let injectedTabs: string[] = [];
          try { injectedTabs = JSON.parse(record.injectedTabs as string || '[]'); } catch { injectedTabs = []; }
          if (!injectedTabs.includes(tabId)) {
            injectedTabs.push(tabId);
          }
          return { ...record, injectedTabs: JSON.stringify(injectedTabs) };
        });
        return complete(b2, 'ok', { script });
      },
      (b) => complete(b, 'notfound', { message: 'No content script with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  remove(input: Record<string, unknown>) {
    const script = input.script as string;
    const tabId = input.tabId as string;

    if (!tabId || tabId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'No content script or tab found.' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'contentScript', script, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'contentScript', script, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          let injectedTabs: string[] = [];
          try { injectedTabs = JSON.parse(record.injectedTabs as string || '[]'); } catch { injectedTabs = []; }
          injectedTabs = injectedTabs.filter((t) => t !== tabId);
          return { ...record, injectedTabs: JSON.stringify(injectedTabs) };
        });
        return complete(b2, 'ok', { script });
      },
      (b) => complete(b, 'notfound', { message: 'No content script or tab found.' }),
    ) as StorageProgram<Result>;
  },

  sendMessage(input: Record<string, unknown>) {
    const script = input.script as string;
    const tabId = input.tabId as string;
    const message = (input.message as string | undefined) ?? '{}';

    if (!tabId || tabId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'No content script injected in the specified tab.' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'contentScript', script, 'record');
    return branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        let injectedTabs: string[] = [];
        try { injectedTabs = JSON.parse(record.injectedTabs as string || '[]'); } catch { injectedTabs = []; }
        if (!injectedTabs.includes(tabId)) {
          return { variant: 'notfound', message: 'No content script injected in the specified tab.' };
        }
        // Return a mock response (in real impl, this would communicate with the content script)
        return { response: '{}' };
      }),
      (b) => complete(b, 'notfound', { message: 'No content script injected in the specified tab.' }),
    ) as StorageProgram<Result>;
  },

  listInjected(input: Record<string, unknown>) {
    const extensionId = input.extensionId as string;

    if (!extensionId || extensionId.trim() === '') {
      return complete(createProgram(), 'ok', { scripts: '[]' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'contentScript', { extensionId }, 'all');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all as unknown[]) || [];
      return { scripts: JSON.stringify(all) };
    }) as StorageProgram<Result>;
  },
};

export const contentScriptHandler = autoInterpret(_handler);
