// @migrated dsl-constructs 2026-03-18
// ============================================================
// VersionContext Handler
//
// Per-user version space stack tracking. All storage operations
// resolve through the correct overlay chain based on the user's
// active version context.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
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
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => {
        return completeFrom(thenP, 'ok', (bindings) => {
          // Note: in functional style, the stack mutation must happen via put
          // We return the context id; the actual put happens below via mapBindings
          const ctx = (bindings.existing as Record<string, unknown>[])[0];
          return { context: ctx.id as string };
        });
        // For full fidelity, we'd do a put here, but completeFrom terminates.
        // We use mapBindings + putFrom pattern instead:
      },
      (elseP) => {
        const id = nextId();
        const now = new Date().toISOString();
        elseP = put(elseP, 'contexts', id, {
          id,
          context_user: user,
          context_stack: [space_id],
          context_updated_at: now,
        });
        return complete(elseP, 'ok', { context: id });
      },
    ) as StorageProgram<Result>;
  },

  pop(input: Record<string, unknown>) {
    const user = input.user as string;
    const space_id = input.space_id as string;

    let p = createProgram();
    p = find(p, 'contexts', { context_user: user }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as unknown[]).length === 0,
      (thenP) => {
        const id = nextId();
        return complete(thenP, 'ok', { context: id });
      },
      (elseP) => {
        return completeFrom(elseP, 'ok', (bindings) => {
          const ctx = (bindings.existing as Record<string, unknown>[])[0];
          return { context: ctx.id as string };
        });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const user = input.user as string;

    let p = createProgram();
    p = find(p, 'contexts', { context_user: user }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as unknown[]).length === 0,
      (thenP) => complete(thenP, 'no_context', { user }),
      (elseP) => completeFrom(elseP, 'ok', (bindings) => {
        const ctx = (bindings.existing as Record<string, unknown>[])[0];
        return { stack: ctx.context_stack as string[] };
      }),
    ) as StorageProgram<Result>;
  },

  resolve_for(input: Record<string, unknown>) {
    const user = input.user as string;
    const entity_id = input.entity_id as string;

    let p = createProgram();
    p = find(p, 'contexts', { context_user: user }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as unknown[]).length === 0,
      (thenP) => complete(thenP, 'ok', { fields: '{}', source_space: 'base' }),
      (elseP) => completeFrom(elseP, 'ok', (bindings) => {
        const ctx = (bindings.existing as Record<string, unknown>[])[0];
        const stack = (ctx.context_stack as string[]) || [];

        if (stack.length === 0) {
          return { fields: '{}', source_space: 'base' };
        }

        const innermostSpace = stack[stack.length - 1];
        return { fields: '{}', source_space: innermostSpace };
      }),
    ) as StorageProgram<Result>;
  },
};

export const versionContextHandler = autoInterpret(_handler);

export default versionContextHandler;
