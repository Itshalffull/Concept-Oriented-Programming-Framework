// @migrated dsl-constructs 2026-03-18
// ============================================================
// MenuSource Handler
//
// SlotSource provider that resolves a navigation menu tree.
// Registers with PluginRegistry under slot_source_provider.
// See Architecture doc Section 16.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `ms-${++idCounter}`;
}

let registered = false;

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    if (registered) {
      const p = createProgram();
      return complete(p, 'already_registered', {}) as StorageProgram<Result>;
    }

    registered = true;
    let p = createProgram();
    p = put(p, 'menu-source', '__registered', { value: true });

    return complete(p, 'ok', { provider_name: 'menu' }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const menuId = input.menu_id as string;
    const maxDepth = input.max_depth as number | undefined;
    const activePath = input.active_path as string | undefined;
    const context = input.context as string;

    if (!menuId) {
      const p = createProgram();
      return complete(p, 'error', { message: 'menu_id is required' }) as StorageProgram<Result>;
    }

    try {
      JSON.parse(context || '{}');
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: `Invalid context JSON: ${context}` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'menu', menuId, 'menu');

    return branch(p,
      (bindings) => !bindings.menu,
      (bp) => complete(bp, 'menu_not_found', { menu_id: menuId }),
      (bp) => {
        const bp2 = find(bp, 'menu_item', { menu_id: menuId }, 'items');
        return completeFrom(bp2, 'ok', (bindings) => {
          const items = bindings.items as Record<string, unknown>[];
          const depth = maxDepth ?? 3;

          const annotatedItems = items.map((item) => ({
            ...item,
            active: activePath ? String(item.path || '') === activePath : false,
          }));

          const prunedItems = annotatedItems.filter(
            (item) => (Number(item.depth) || 0) <= depth,
          );

          const id = nextId();
          const data = JSON.stringify({
            menu_id: menuId,
            max_depth: depth,
            active_path: activePath || null,
            items: prunedItems,
          });

          return { data };
        });
      },
    ) as StorageProgram<Result>;
  },
};

export const menuSourceHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetMenuSource(): void {
  idCounter = 0;
  registered = false;
}
