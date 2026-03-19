// @migrated dsl-constructs 2026-03-18
// ============================================================
// VersionContext Handler
//
// Per-user version space stack tracking. All storage operations
// resolve through the correct overlay chain based on the user's
// active version context.
//
// Uses imperative style because push/pop need to read-modify-write
// the context stack with dynamic storage keys.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `vctx-${++idCounter}`;
}

const _handler: ConceptHandler = {
  async push(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
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
      return { variant: 'ok', context: ctx.id as string };
    }

    const id = nextId();
    const now = new Date().toISOString();
    await storage.put('contexts', id, {
      id,
      context_user: user,
      context_stack: [space_id],
      context_updated_at: now,
    });
    return { variant: 'ok', context: id };
  },

  async pop(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const user = input.user as string;
    const space_id = input.space_id as string;

    const existing = await storage.find('contexts', { context_user: user });

    if (existing.length === 0) {
      const id = nextId();
      return { variant: 'ok', context: id };
    }

    const ctx = existing[0];
    const stack = (ctx.context_stack as string[]) || [];

    // Find the index of the space_id to pop
    const idx = stack.indexOf(space_id);
    if (idx === -1) {
      return { variant: 'ok', context: ctx.id as string };
    }

    // Remove the space and all children (everything from idx onward)
    const newStack = stack.slice(0, idx);

    if (newStack.length === 0) {
      // Delete the context entirely
      await storage.del('contexts', ctx.id as string);
    } else {
      await storage.put('contexts', ctx.id as string, {
        ...ctx,
        context_stack: newStack,
        context_updated_at: new Date().toISOString(),
      });
    }

    return { variant: 'ok', context: ctx.id as string };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const user = input.user as string;

    const existing = await storage.find('contexts', { context_user: user });

    if (existing.length === 0) {
      return { variant: 'no_context', user };
    }

    const ctx = existing[0];
    return { variant: 'ok', stack: ctx.context_stack as string[] };
  },

  async resolve_for(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const user = input.user as string;

    const existing = await storage.find('contexts', { context_user: user });

    if (existing.length === 0) {
      return { variant: 'ok', fields: '{}', source_space: 'base' };
    }

    const ctx = existing[0];
    const stack = (ctx.context_stack as string[]) || [];

    if (stack.length === 0) {
      return { variant: 'ok', fields: '{}', source_space: 'base' };
    }

    const innermostSpace = stack[stack.length - 1];
    return { variant: 'ok', fields: '{}', source_space: innermostSpace };
  },
};

export const versionContextHandler = _handler;

export default versionContextHandler;
