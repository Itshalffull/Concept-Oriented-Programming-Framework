// @migrated dsl-constructs 2026-03-18
// Slot Concept Implementation
// Named insertion points within host components for composable content projection.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, get as spGet, put, branch, complete, type StorageProgram } from '../../../runtime/storage-program.ts';

let slotCounter = 0;

export const slotHandler: FunctionalConceptHandler = {
  define(input: Record<string, unknown>) {
    const slot = input.slot as string;
    const name = input.name as string;
    const host = input.host as string;
    const position = input.position as string;
    const fallback = input.fallback as string;

    let p = createProgram();
    p = spGet(p, 'slot', slot, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'duplicate', { message: 'A slot with this identity already exists' }),
      (b) => {
        slotCounter++;
        let b2 = put(b, 'slot', slot, {
          slot,
          name: name || `slot-${slotCounter}`,
          host,
          content: '',
          position: position || 'default',
          fallback: fallback || '',
          createdAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  fill(input: Record<string, unknown>) {
    const slot = input.slot as string;
    const content = input.content as string;

    let p = createProgram();
    p = spGet(p, 'slot', slot, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const existing = (b as any).__bindings?.existing;
        let b2 = put(b, 'slot', slot, {
          ...existing,
          content,
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Slot not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  clear(input: Record<string, unknown>) {
    const slot = input.slot as string;

    let p = createProgram();
    p = spGet(p, 'slot', slot, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const existing = (b as any).__bindings?.existing;
        let b2 = put(b, 'slot', slot, {
          ...existing,
          content: '',
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Slot not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
