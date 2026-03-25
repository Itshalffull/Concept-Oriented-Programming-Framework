// @clef-handler style=functional
// ============================================================
// VersionContext Handler
//
// Per-user version space stack tracking. All storage operations
// resolve through the correct overlay chain based on the user's
// active version context.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';
import type { ConceptHandler, ConceptStorage } from '../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `vctx-${++idCounter}`;
}

// push and pop need read-modify-write with dynamic keys (ctx.id from find results)
// and push also needs nextId() for new records — use imperative overrides for both.

const _handler: FunctionalConceptHandler = {
  push(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', {}) as StorageProgram<Result>;
  },

  pop(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', {}) as StorageProgram<Result>;
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

const _base = autoInterpret(_handler);

const _imperativePush: ConceptHandler['push'] = async (
  input: Record<string, unknown>,
  storage: ConceptStorage,
) => {
  const user = input.user as string;
  const space_id = input.space_id as string;

  const existing = await storage.find('contexts', { context_user: user });

  if (existing.length > 0) {
    const ctx = existing[0];
    const stack = [...((ctx.context_stack as string[]) || []), space_id];
    await storage.put('contexts', ctx.id as string, {
      ...ctx,
      context_stack: stack,
      context_updated_at: new Date().toISOString(),
    });
    return { variant: 'ok', context: ctx.id as string, output: { context: ctx.id as string } };
  }

  const id = nextId();
  const now = new Date().toISOString();
  await storage.put('contexts', id, {
    id,
    context_user: user,
    context_stack: [space_id],
    context_updated_at: now,
  });
  return { variant: 'ok', context: id, output: { context: id } };
};

const _imperativePop: ConceptHandler['pop'] = async (
  input: Record<string, unknown>,
  storage: ConceptStorage,
) => {
  const user = input.user as string;
  const space_id = input.space_id as string;

  const existing = await storage.find('contexts', { context_user: user });

  if (existing.length === 0) {
    const id = nextId();
    return { variant: 'ok', context: id, output: { context: id } };
  }

  const ctx = existing[0];
  const stack = (ctx.context_stack as string[]) || [];

  const idx = stack.indexOf(space_id);
  if (idx === -1) {
    return { variant: 'ok', context: ctx.id as string, output: { context: ctx.id as string } };
  }

  const newStack = stack.slice(0, idx);

  await storage.put('contexts', ctx.id as string, {
    ...ctx,
    context_stack: newStack,
    context_updated_at: new Date().toISOString(),
  });

  return { variant: 'ok', context: ctx.id as string, output: { context: ctx.id as string } };
};

export const versionContextHandler: FunctionalConceptHandler & ConceptHandler = {
  ..._base,
  push: _imperativePush,
  pop: _imperativePop,
} as FunctionalConceptHandler & ConceptHandler;

export default versionContextHandler;
