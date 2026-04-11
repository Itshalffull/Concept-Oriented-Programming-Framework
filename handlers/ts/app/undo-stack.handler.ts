// @clef-handler style=functional concept=UndoStack export=undoStackHandler
// UndoStack handler — functional StorageProgram style
// Maintains an ordered history of reversible user-initiated actions for
// Cmd+Z and Cmd+Shift+Z undo/redo. Entries are stored as a JSON-encoded
// ordered list. Position tracks the current undo/redo cursor. Pushing
// after an undo truncates the redo branch.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

interface StackEntry {
  action: string;
  params: string;
  result: string;
  trace: string;
  reversalAction: string;
}

const _handler: FunctionalConceptHandler = {

  // Framework registration — returns concept name for PluginRegistry discovery.
  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { name: 'UndoStack' });
  },

  // Domain action: create a new undo stack.
  create(input: Record<string, unknown>) {
    const stack = String(input.stack ?? '');
    const maxSizeRaw = input.maxSize;
    const maxSize = Number(maxSizeRaw);

    if (!stack || stack.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'stack identifier is required' });
    }
    if (!Number.isInteger(maxSize) || maxSize <= 0) {
      return complete(createProgram(), 'invalid', { message: 'maxSize must be a positive integer' });
    }

    let p = createProgram();
    p = get(p, 'stacks', stack, 'existing');
    return branch(p,
      (b) => b.existing != null,
      (b) => complete(b, 'duplicate', { message: `stack '${stack}' already exists` }),
      (b) => {
        const newStack = put(b, 'stacks', stack, {
          entries: [],
          position: 0,
          maxSize,
        });
        return complete(newStack, 'ok', { stack });
      },
    );
  },

  push(input: Record<string, unknown>) {
    const stack = String(input.stack ?? '');
    const action = String(input.action ?? '');
    const params = String(input.params ?? '');
    const result = String(input.result ?? '');
    const trace = String(input.trace ?? '');
    const reversalAction = String(input.reversalAction ?? '');

    if (!stack || stack.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'stack identifier is required' });
    }
    if (!action || action.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'action is required' });
    }

    let p = createProgram();
    p = get(p, 'stacks', stack, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `stack '${stack}' not found` }),
      (b) => {
        const newEntry: StackEntry = { action, params, result, trace, reversalAction };
        const entryJson = JSON.stringify(newEntry);

        let p2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const entries = (rec.entries as StackEntry[]) || [];
          const position = (rec.position as number) || 0;
          const maxSz = (rec.maxSize as number) || 50;
          // Truncate redo branch: discard entries beyond current position
          const truncated = entries.slice(0, position);
          truncated.push(newEntry);
          let dropped: StackEntry | null = null;
          if (truncated.length > maxSz) {
            dropped = truncated.shift()!;
          }
          return {
            finalEntries: truncated,
            newPosition: truncated.length,
            dropped: dropped ? JSON.stringify(dropped) : null,
          };
        }, '_computed');

        p2 = putFrom(p2, 'stacks', stack, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const computed = bindings._computed as Record<string, unknown>;
          return {
            entries: computed.finalEntries,
            position: computed.newPosition,
            maxSize: existing.maxSize,
          };
        });

        // Branch on whether an entry was dropped to determine ok vs full
        return branch(p2,
          (bindings) => {
            const computed = bindings._computed as Record<string, unknown>;
            return computed.dropped != null;
          },
          (bp) => completeFrom(bp, 'full', (bindings) => {
            const computed = bindings._computed as Record<string, unknown>;
            return { dropped: computed.dropped as string };
          }),
          (bp) => complete(bp, 'ok', { entry: entryJson }),
        );
      },
    );
  },

  undo(input: Record<string, unknown>) {
    const stack = String(input.stack ?? '');

    if (!stack || stack.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'stack identifier is required' });
    }

    let p = createProgram();
    p = get(p, 'stacks', stack, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `stack '${stack}' not found` }),
      (b) => {
        let p2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const entries = (rec.entries as StackEntry[]) || [];
          const position = (rec.position as number) ?? 0;
          return { entries, position };
        }, '_state');

        return branch(p2,
          (bindings) => {
            const state = bindings._state as Record<string, unknown>;
            return (state.position as number) <= 0;
          },
          (b2) => complete(b2, 'empty', { message: 'nothing to undo' }),
          (b2) => {
            let p3 = mapBindings(b2, (bindings) => {
              const state = bindings._state as Record<string, unknown>;
              const entries = state.entries as StackEntry[];
              const position = state.position as number;
              const newPosition = position - 1;
              const entry = entries[newPosition];
              return { newPosition, entry };
            }, '_undo');

            p3 = putFrom(p3, 'stacks', stack, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              const undoData = bindings._undo as Record<string, unknown>;
              return {
                entries: existing.entries,
                position: undoData.newPosition,
                maxSize: existing.maxSize,
              };
            });

            return completeFrom(p3, 'ok', (bindings) => {
              const undoData = bindings._undo as Record<string, unknown>;
              const entry = undoData.entry as StackEntry;
              return {
                reversalAction: entry.reversalAction,
                params: entry.params,
              };
            });
          },
        );
      },
    );
  },

  redo(input: Record<string, unknown>) {
    const stack = String(input.stack ?? '');

    if (!stack || stack.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'stack identifier is required' });
    }

    let p = createProgram();
    p = get(p, 'stacks', stack, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `stack '${stack}' not found` }),
      (b) => {
        let p2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const entries = (rec.entries as StackEntry[]) || [];
          const position = (rec.position as number) ?? 0;
          return { entries, position };
        }, '_state');

        return branch(p2,
          (bindings) => {
            const state = bindings._state as Record<string, unknown>;
            const entries = state.entries as StackEntry[];
            const position = state.position as number;
            return position >= entries.length;
          },
          (b2) => complete(b2, 'empty', { message: 'nothing to redo' }),
          (b2) => {
            let p3 = mapBindings(b2, (bindings) => {
              const state = bindings._state as Record<string, unknown>;
              const entries = state.entries as StackEntry[];
              const position = state.position as number;
              const entry = entries[position];
              const newPosition = position + 1;
              return { newPosition, entry };
            }, '_redo');

            p3 = putFrom(p3, 'stacks', stack, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              const redoData = bindings._redo as Record<string, unknown>;
              return {
                entries: existing.entries,
                position: redoData.newPosition,
                maxSize: existing.maxSize,
              };
            });

            return completeFrom(p3, 'ok', (bindings) => {
              const redoData = bindings._redo as Record<string, unknown>;
              const entry = redoData.entry as StackEntry;
              return {
                action: entry.action,
                params: entry.params,
              };
            });
          },
        );
      },
    );
  },

  clear(input: Record<string, unknown>) {
    const stack = String(input.stack ?? '');

    if (!stack || stack.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'stack identifier is required' });
    }

    let p = createProgram();
    p = get(p, 'stacks', stack, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `stack '${stack}' not found` }),
      (b) => {
        const p2 = putFrom(b, 'stacks', stack, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            entries: [],
            position: 0,
            maxSize: existing.maxSize,
          };
        });
        return complete(p2, 'ok', {});
      },
    );
  },

  get(input: Record<string, unknown>) {
    const stack = String(input.stack ?? '');

    if (!stack || stack.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'stack identifier is required' });
    }

    let p = createProgram();
    p = get(p, 'stacks', stack, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `stack '${stack}' not found` }),
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const entries = (rec.entries as StackEntry[]) || [];
          const position = (rec.position as number) ?? 0;
          return {
            entries: JSON.stringify(entries),
            position,
          };
        });
      },
    );
  },
};

export const undoStackHandler = autoInterpret(_handler);
