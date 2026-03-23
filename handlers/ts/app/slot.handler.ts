// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Slot Concept Implementation
// Named insertion points within host components for composable content projection.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, find, put, putFrom, branch, complete, completeFrom, mapBindings, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let slotCounter = 0;

const _slotHandler: FunctionalConceptHandler = {
  define(input: Record<string, unknown>) {
    const name = input.name as string;
    const host = input.host as string;
    const position = input.position as string;
    const fallback = input.fallback as string;

    let p = createProgram();
    // Check for duplicate by (name, host) combo
    p = find(p, 'slot', {}, 'allSlots');

    return branch(p,
      (bindings) => {
        const all = bindings.allSlots as Array<Record<string, unknown>>;
        return all.some(s => s.name === name && s.host === host);
      },
      (b) => complete(b, 'duplicate', { message: `A slot named '${name}' already exists on host '${host}'` }),
      (b) => {
        slotCounter++;
        const slotId = `slot-${slotCounter}`;
        let b2 = put(b, 'slot', slotId, {
          slot: slotId,
          name: name || slotId,
          host,
          content: '',
          position: position || 'default',
          fallback: fallback || '',
          createdAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { slot: slotId });
      },
    ) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  fill(input: Record<string, unknown>) {
    const slotId = input.slot as string | undefined;
    const content = input.content as string;

    // Find all slots to locate by slot ID or pick first available
    let p = createProgram();
    p = find(p, 'slot', {}, 'allSlots');

    return branch(p,
      (bindings) => {
        const all = bindings.allSlots as Array<Record<string, unknown>>;
        if (all.length === 0) return false;
        if (slotId && slotId.trim() !== '') {
          return all.some(s => s.slot === slotId);
        }
        return true; // no slot specified, use first
      },
      (b) => {
        // When slot ID is provided, update the specific slot
        if (slotId && slotId.trim() !== '') {
          let b2 = putFrom(b, 'slot', slotId, (bindings) => {
            const all = bindings.allSlots as Array<Record<string, unknown>>;
            const rec = all.find(s => s.slot === slotId) || {};
            return { ...rec, content };
          });
          return complete(b2, 'ok', { slot: slotId });
        }
        // No slot ID — fill the first available slot
        return completeFrom(b, 'ok', (bindings) => {
          const all = bindings.allSlots as Array<Record<string, unknown>>;
          const rec = all[0];
          return { slot: rec?.slot as string ?? '' };
        });
      },
      (b) => complete(b, 'notfound', { message: slotId ? `Slot '${slotId}' not found` : 'No slots defined' }),
    ) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  clear(input: Record<string, unknown>) {
    const slotId = input.slot as string;

    let p = createProgram();
    p = find(p, 'slot', {}, 'allSlots');

    return branch(p,
      (bindings) => {
        const all = bindings.allSlots as Array<Record<string, unknown>>;
        if (!slotId || slotId.trim() === '') return false;
        return all.some(s => s.slot === slotId);
      },
      (b) => {
        let b2 = putFrom(b, 'slot', slotId, (bindings) => {
          const all = bindings.allSlots as Array<Record<string, unknown>>;
          const rec = all.find(s => s.slot === slotId) || {};
          return { ...rec, content: '' };
        });
        return complete(b2, 'ok', { slot: slotId });
      },
      (b) => complete(b, 'notfound', { message: `Slot '${slotId}' not found` }),
    ) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const slotHandler = autoInterpret(_slotHandler);
