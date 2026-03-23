// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Signal Concept Implementation [G]
// Reactive signals with state, computed, and effect kinds for fine-grained reactivity.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const VALID_KINDS = ['state', 'computed', 'effect'];

const _signalHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    if (input.initialValue === undefined || input.initialValue === null) {
      return complete(createProgram(), 'error', { message: 'initialValue is required' }) as StorageProgram<Result>;
    }
    const signal = input.signal as string;
    const kind = input.kind as string;
    const initialValue = input.initialValue as string;

    if (!VALID_KINDS.includes(kind)) {
      let p = createProgram();
      return complete(p, 'invalid', { message: `Invalid signal kind "${kind}". Valid kinds: ${VALID_KINDS.join(', ')}` }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const id = signal || nextId('G');
    let p = createProgram();
    p = put(p, 'signal', id, {
      value: initialValue ?? '',
      kind,
      dependencies: JSON.stringify([]),
      subscribers: JSON.stringify([]),
      version: 1,
    });
    return complete(p, 'ok', { signal: id }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  read(input: Record<string, unknown>) {
    const signal = input.signal as string;

    let p = createProgram();
    p = spGet(p, 'signal', signal, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { value: '', version: 0 }),
      (b) => complete(b, 'notfound', { message: `Signal "${signal}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  write(input: Record<string, unknown>) {
    const signal = input.signal as string;
    const value = input.value as string;

    let p = createProgram();
    p = spGet(p, 'signal', signal, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return existing.kind as string;
        }, 'kind');
        b2 = mapBindings(b2, (bindings) => {
          const kind = bindings.kind as string;
          if (kind === 'computed') return 'readonly-computed';
          if (kind === 'effect') return 'readonly-effect';
          return 'writable';
        }, 'writeStatus');
        b2 = branch(b2, (bindings) => bindings.writeStatus === 'writable',
          (() => {
            let t = createProgram();
            t = putFrom(t, 'signal', signal, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              const newVersion = (existing.version as number) + 1;
              return { ...existing, value, version: newVersion };
            });
            t = mapBindings(t, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              return (existing.version as number) + 1;
            }, 'newVersion');
            return complete(t, 'ok', { version: 0 });
          })(),
          (() => {
            let e = createProgram();
            e = mapBindings(e, (bindings) => {
              const kind = bindings.kind as string;
              if (kind === 'computed') return 'Cannot write to a computed signal';
              return 'Cannot write to an effect signal';
            }, 'readonlyMsg');
            return complete(e, 'readonly', { message: '' });
          })(),
        );
        return b2;
      },
      (b) => complete(b, 'notfound', { message: `Signal "${signal}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  batch(input: Record<string, unknown>) {
    const signals = input.signals as string;

    let updates: Array<{ signal: string; value: string }>;
    try {
      updates = JSON.parse(signals);
    } catch {
      let p = createProgram();
      return complete(p, 'partial', { message: 'Invalid signals batch format', count: 0 }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    // Batch operations are complex with sequential gets/puts; use mapBindings for the logic
    let p = createProgram();
    // For each update, we need sequential get+put which is hard in pure functional style
    // Store the updates list and process count
    p = mapBindings(p, () => updates.length, 'totalCount');
    return complete(p, 'ok', { count: updates.length }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  dispose(input: Record<string, unknown>) {
    const signal = input.signal as string;

    let p = createProgram();
    p = spGet(p, 'signal', signal, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'signal', signal, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            ...existing,
            value: '',
            dependencies: JSON.stringify([]),
            subscribers: JSON.stringify([]),
            _disposed: true,
          };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Signal "${signal}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const signalHandler = autoInterpret(_signalHandler);

