// @migrated dsl-constructs 2026-03-18
// ============================================================
// MultiValueResolution Handler
//
// Multi-value (keep-all) conflict resolution. Preserves both
// concurrent values rather than selecting one. Suitable for systems
// where all concurrent writes have equal validity, such as shopping
// cart contents or collaborative annotation lists.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, complete, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `multi-value-resolution-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const id = nextId();
    let p = createProgram();
    p = put(p, 'multi-value-resolution', id, {
      id,
      name: 'multi-value',
      category: 'conflict-resolution',
      priority: 30,
    });

    return complete(p, 'ok', { name: 'multi-value', category: 'conflict-resolution', priority: 30 }) as StorageProgram<Result>;
  },

  attemptResolve(input: Record<string, unknown>) {
    const base = input.base as string | undefined;
    const v1 = input.v1 as string;
    const v2 = input.v2 as string;

    const values = [v1, v2].sort();
    const result = JSON.stringify(values);

    const cacheId = nextId();
    let p = createProgram();
    p = put(p, 'multi-value-resolution', cacheId, {
      id: cacheId,
      base: base ?? null,
      v1,
      v2,
      result,
      resolvedAt: new Date().toISOString(),
    });

    return complete(p, 'resolved', { result }) as StorageProgram<Result>;
  },
};

export const multiValueResolutionHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetMultiValueResolutionCounter(): void {
  idCounter = 0;
}
