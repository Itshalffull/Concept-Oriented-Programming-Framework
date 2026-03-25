// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-25
// ============================================================
// VersionContext Handler
//
// Per-user version space stack tracking. All storage operations
// resolve through the correct overlay chain based on the user's
// active version context.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, put, branch, complete, completeFrom,
  delFrom, putFrom, mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `vctx-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  push(input: Record<string, unknown>) {
    const user = input.user as string;
    const space_id = input.space_id as string;

    let p = createProgram();
    p = find(p, 'contexts', { context_user: user }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length > 0,
      (b) => {
        // Existing context found — delete old, create new with appended stack
        // Delete old entry by its dynamic key
        let b2 = delFrom(b, 'contexts', (bindings) => {
          const ctx = (bindings.existing as Record<string, unknown>[])[0];
          return ctx.id as string;
        });

        // Create replacement with new static id, dynamic value
        const newId = nextId();
        b2 = putFrom(b2, 'contexts', newId, (bindings) => {
          const ctx = (bindings.existing as Record<string, unknown>[])[0];
          const stack = [...((ctx.context_stack as string[]) || []), space_id];
          return {
            id: newId,
            context_user: user,
            context_stack: stack,
            context_updated_at: new Date().toISOString(),
          };
        });

        return complete(b2, 'ok', { context: newId, output: { context: newId } }) as StorageProgram<Result>;
      },
      (b) => {
        // No existing context — create new one
        const id = nextId();
        let b2 = put(b, 'contexts', id, {
          id,
          context_user: user,
          context_stack: [space_id],
          context_updated_at: new Date().toISOString(),
        });
        return complete(b2, 'ok', { context: id, output: { context: id } }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  pop(input: Record<string, unknown>) {
    const user = input.user as string;
    const space_id = input.space_id as string;

    let p = createProgram();
    p = find(p, 'contexts', { context_user: user }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length === 0,
      (b) => {
        const id = nextId();
        return complete(b, 'ok', { context: id, output: { context: id } }) as StorageProgram<Result>;
      },
      (b) => {
        // Check if space_id is in the stack
        return branch(b,
          (bindings) => {
            const ctx = (bindings.existing as Record<string, unknown>[])[0];
            const stack = (ctx.context_stack as string[]) || [];
            return stack.indexOf(space_id) === -1;
          },
          // space_id not found — return current context id unchanged
          (b3) => completeFrom(b3, 'ok', (bindings) => {
            const ctx = (bindings.existing as Record<string, unknown>[])[0];
            return { context: ctx.id as string, output: { context: ctx.id as string } };
          }) as StorageProgram<Result>,
          // space_id found — check if resulting stack would be empty
          (b3) => {
            return branch(b3,
              (bindings) => {
                const ctx = (bindings.existing as Record<string, unknown>[])[0];
                const stack = (ctx.context_stack as string[]) || [];
                const idx = stack.indexOf(space_id);
                return idx === 0; // If popping first element, stack becomes empty
              },
              // Stack becomes empty — just delete the context entirely
              (b4) => {
                let b5 = delFrom(b4, 'contexts', (bindings) => {
                  const ctx = (bindings.existing as Record<string, unknown>[])[0];
                  return ctx.id as string;
                });
                return completeFrom(b5, 'ok', (bindings) => {
                  const ctx = (bindings.existing as Record<string, unknown>[])[0];
                  return { context: ctx.id as string, output: { context: ctx.id as string } };
                }) as StorageProgram<Result>;
              },
              // Stack has remaining items — delete old, create new with truncated stack
              (b4) => {
                let b5 = delFrom(b4, 'contexts', (bindings) => {
                  const ctx = (bindings.existing as Record<string, unknown>[])[0];
                  return ctx.id as string;
                });

                const newId = nextId();
                b5 = putFrom(b5, 'contexts', newId, (bindings) => {
                  const ctx = (bindings.existing as Record<string, unknown>[])[0];
                  const stack = (ctx.context_stack as string[]) || [];
                  const idx = stack.indexOf(space_id);
                  const newStack = stack.slice(0, idx);
                  return {
                    id: newId,
                    context_user: user,
                    context_stack: newStack,
                    context_updated_at: new Date().toISOString(),
                  };
                });

                return completeFrom(b5, 'ok', (bindings) => {
                  const ctx = (bindings.existing as Record<string, unknown>[])[0];
                  return { context: ctx.id as string, output: { context: ctx.id as string } };
                }) as StorageProgram<Result>;
              },
            ) as StorageProgram<Result>;
          },
        ) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const user = input.user as string;

    let p = createProgram();
    p = find(p, 'contexts', { context_user: user }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length === 0,
      (b) => complete(b, 'no_context', { user }) as StorageProgram<Result>,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const ctx = (bindings.existing as Record<string, unknown>[])[0];
        return { stack: ctx.context_stack as string[] };
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  resolve_for(input: Record<string, unknown>) {
    const user = input.user as string;

    let p = createProgram();
    p = find(p, 'contexts', { context_user: user }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length === 0,
      (b) => complete(b, 'ok', { fields: '{}', source_space: 'base' }) as StorageProgram<Result>,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const ctx = (bindings.existing as Record<string, unknown>[])[0];
        const stack = (ctx.context_stack as string[]) || [];
        if (stack.length === 0) {
          return { fields: '{}', source_space: 'base' };
        }
        return { fields: '{}', source_space: stack[stack.length - 1] };
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },
};

export const versionContextHandler = autoInterpret(_handler);

export default versionContextHandler;
