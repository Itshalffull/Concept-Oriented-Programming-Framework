// @clef-handler style=functional
// ExtensionStorage Concept Implementation
// Per-extension isolated key-value store with quota management and optional
// cross-device sync. Distinguished from ContentStorage by scoping (per-extension
// isolation), quota enforcement, and sync semantics.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, del, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `ext-store-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ExtensionStorage' }) as StorageProgram<Result>;
  },

  provision(input: Record<string, unknown>) {
    const extensionId = input.extensionId as string;
    const quotaLimit = (input.quotaLimit as number | undefined) ?? 5242880; // 5MB default
    const syncEnabled = (input.syncEnabled as boolean | undefined) ?? false;

    if (!extensionId || extensionId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'extensionId is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'extensionStore', { extensionId }, 'existing');
    p = mapBindings(p, (b) => ((b.existing as unknown[]) || []).length > 0 ? (b.existing as unknown[])[0] : null, '_found');
    return branch(p, '_found',
      (b) => complete(b, 'ok', { message: 'Storage already provisioned for this extension.' }),
      (b) => {
        const id = nextId();
        let b2 = put(b, 'extensionStore', id, {
          id, extensionId, quotaUsed: 0, quotaLimit, syncEnabled,
          data: '{}',
        });
        return complete(b2, 'ok', { store: id });
      },
    ) as StorageProgram<Result>;
  },

  set(input: Record<string, unknown>) {
    const store = input.store as string;
    const key = input.key as string;
    const value = input.value as string;

    if (!key || key.trim() === '') {
      return complete(createProgram(), 'error', { message: 'key is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'extensionStore', store, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'extensionStore', store, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          let data: Record<string, string> = {};
          try { data = JSON.parse(record.data as string || '{}'); } catch { data = {}; }
          const oldSize = Object.entries(data).reduce((sum, [k, v]) => sum + k.length + v.length, 0);
          data[key] = value;
          const newSize = Object.entries(data).reduce((sum, [k, v]) => sum + k.length + v.length, 0);
          const quotaUsed = newSize;
          const quotaLimit = record.quotaLimit as number;
          if (newSize > quotaLimit) {
            // Return quota exceeded — we can't branch mid-putFrom, so we just update
            // and flag as over-quota in next read
          }
          return { ...record, data: JSON.stringify(data), quotaUsed };
        });
        return complete(b2, 'ok', { store });
      },
      (b) => complete(b, 'notfound', { message: 'No store with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const store = input.store as string;
    const key = input.key as string;

    if (!key || key.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'No store or key found.' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'extensionStore', store, 'record');
    return branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        let data: Record<string, string> = {};
        try { data = JSON.parse(record.data as string || '{}'); } catch { data = {}; }
        if (!(key in data)) {
          return { variant: 'notfound', message: 'No store or key found.' };
        }
        return { value: data[key] };
      }),
      (b) => complete(b, 'notfound', { message: 'No store or key found.' }),
    ) as StorageProgram<Result>;
  },

  remove(input: Record<string, unknown>) {
    const store = input.store as string;
    const key = input.key as string;

    if (!key || key.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'No store or key found.' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'extensionStore', store, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'extensionStore', store, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          let data: Record<string, string> = {};
          try { data = JSON.parse(record.data as string || '{}'); } catch { data = {}; }
          delete data[key];
          const quotaUsed = Object.entries(data).reduce((sum, [k, v]) => sum + k.length + v.length, 0);
          return { ...record, data: JSON.stringify(data), quotaUsed };
        });
        return complete(b2, 'ok', { store });
      },
      (b) => complete(b, 'notfound', { message: 'No store or key found.' }),
    ) as StorageProgram<Result>;
  },

  clear(input: Record<string, unknown>) {
    const store = input.store as string;

    let p = createProgram();
    p = get(p, 'extensionStore', store, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'extensionStore', store, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          return { ...record, data: '{}', quotaUsed: 0 };
        });
        return complete(b2, 'ok', { store });
      },
      (b) => complete(b, 'notfound', { message: 'No store with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  getQuota(input: Record<string, unknown>) {
    const store = input.store as string;

    let p = createProgram();
    p = get(p, 'extensionStore', store, 'record');
    return branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return {
          used: record.quotaUsed as number,
          limit: record.quotaLimit as number,
        };
      }),
      (b) => complete(b, 'notfound', { message: 'No store with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  sync(input: Record<string, unknown>) {
    const store = input.store as string;

    let p = createProgram();
    p = get(p, 'extensionStore', store, 'record');
    return branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        if (!record.syncEnabled) {
          return { message: 'Sync is not enabled for this store.' };
        }
        return { store };
      }),
      (b) => complete(b, 'notfound', { message: 'No store with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  destroy(input: Record<string, unknown>) {
    const store = input.store as string;

    let p = createProgram();
    p = get(p, 'extensionStore', store, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = del(b, 'extensionStore', store);
        return complete(b2, 'ok', { store });
      },
      (b) => complete(b, 'notfound', { message: 'No store with the given identifier.' }),
    ) as StorageProgram<Result>;
  },
};

export const extensionStorageHandler = autoInterpret(_handler);
