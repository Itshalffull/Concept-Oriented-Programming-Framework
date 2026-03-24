// @clef-handler style=functional
// ============================================================
// SyncAutomationProvider Handler
//
// Runtime-dynamic automation provider allowing users to define
// custom syncs that invoke concept actions. User-authored syncs
// go through a validation and scope-check lifecycle before
// activation.
// See Architecture doc Sections 16.11, 16.12.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `sa-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, 'sync-automation-provider', '__registered', 'existing');
    return branch(p, 'existing',
      (b) => complete(b, 'ok', { provider_name: 'sync' }) as StorageProgram<Result>,
      (b) => {
        let b2 = put(b, 'sync-automation-provider', '__registered', { value: true });
        return complete(b2, 'ok', { provider_name: 'sync' }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  define(input: Record<string, unknown>) {
    const name = (input.name as string) || '';
    const sourceText = (input.source_text as string) || '';
    const author = (input.author as string) || '';

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!sourceText || sourceText.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'source_text is required' }) as StorageProgram<Result>;
    }

    // Check for duplicate name
    let p = createProgram();
    p = get(p, 'user-sync', name, 'existing');

    return branch(p, 'existing',
      (b) => complete(b, 'duplicate', { name }) as StorageProgram<Result>,
      (b) => {
        const id = nextId();
        let b2 = put(b, 'user-sync', name, {
          id,
          name,
          source_text: sourceText,
          compiled: null,
          status: 'Draft',
          author,
          created_at: new Date().toISOString(),
        });
        return complete(b2, 'ok', { sync_def: name }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  validate(input: Record<string, unknown>) {
    const syncDef = (input.sync_def as string) || '';

    if (!syncDef || syncDef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'sync_def is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'user-sync', syncDef, 'existing');

    return branch(p, 'existing',
      (b) => {
        // Use putFrom to update status based on source_text validation
        let b2 = putFrom(b, 'user-sync', syncDef, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const sourceText = rec.source_text as string;
          if (!sourceText || !sourceText.trim().startsWith('sync')) {
            return { ...rec, status: 'Failed' };
          }
          const compiled = JSON.stringify({ source: sourceText, compiled_at: new Date().toISOString() });
          return { ...rec, compiled, status: 'Validated' };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const sourceText = rec.source_text as string;
          if (!sourceText || !sourceText.trim().startsWith('sync')) {
            return { _variant: 'failed_compilation', sync_def: syncDef, message: 'source_text must be a valid sync definition beginning with "sync"' };
          }
          return { sync_def: syncDef };
        }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', { sync_def: syncDef }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  activate(input: Record<string, unknown>) {
    const syncDef = (input.sync_def as string) || '';

    if (!syncDef || syncDef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'sync_def is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'user-sync', syncDef, 'existing');

    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'user-sync', syncDef, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return { ...rec, status: 'Active' };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          if (rec.status !== 'Validated') {
            return { _variant: 'not_validated', sync_def: syncDef };
          }
          return { sync_def: syncDef };
        }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', { sync_def: syncDef }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  suspend(input: Record<string, unknown>) {
    const syncDef = (input.sync_def as string) || '';

    if (!syncDef || syncDef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'sync_def is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'user-sync', syncDef, 'existing');

    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'user-sync', syncDef, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return { ...rec, status: 'Suspended' };
        });
        return complete(b2, 'ok', { sync_def: syncDef }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', { sync_def: syncDef }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const actionRef = (input.action_ref as string) || '';
    const inputPayload = (input.input as string) || '{}';

    if (!actionRef || actionRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'action_ref is required' }) as StorageProgram<Result>;
    }

    // Validate input JSON
    try {
      JSON.parse(inputPayload);
    } catch {
      return complete(createProgram(), 'error', { message: 'input must be valid JSON' }) as StorageProgram<Result>;
    }

    // Look up active user sync for this action_ref
    let p = createProgram();
    p = get(p, 'user-sync-action-index', actionRef, 'syncRef');

    return branch(p, 'syncRef',
      (b) => {
        const result = JSON.stringify({
          action_ref: actionRef,
          input: inputPayload,
          executed_at: new Date().toISOString(),
          status: 'ok',
        });
        return complete(b, 'ok', { result }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', { action_ref: actionRef }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },
};

export const syncAutomationProviderHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetSyncAutomationProvider(): void {
  idCounter = 0;
}
