// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ImmediateFinality Provider
// Confirms operations instantly with duplicate detection.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _immediateFinalityHandler: FunctionalConceptHandler = {
  confirm(input: Record<string, unknown>) {
    if (!input.operationRef || (typeof input.operationRef === 'string' && (input.operationRef as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'operationRef is required' }) as StorageProgram<Result>;
    }
    const opRef = input.operationRef as string;
    let p = createProgram();
    p = find(p, 'imm_final', { operationRef: opRef }, 'existing');

    p = branch(p,
      (bindings) => ((bindings.existing as unknown[]).length > 0),
      (b) => completeFrom(b, 'already_finalized', (bindings) => {
        const existing = bindings.existing as Array<Record<string, unknown>>;
        return { confirmation: existing[0].id as string };
      }),
      (b) => {
        const id = `imm-${Date.now()}`;
        let b2 = put(b, 'imm_final', id, {
          id,
          operationRef: opRef,
          confirmedAt: new Date().toISOString(),
        });
        b2 = put(b2, 'plugin-registry', `finality-provider:${id}`, {
          id: `finality-provider:${id}`,
          pluginKind: 'finality-provider',
          provider: 'ImmediateFinality',
          instanceId: id,
        });
        return complete(b2, 'ok', { confirmation: id });
      },
    );

    return p as StorageProgram<Result>;
  },
};

export const immediateFinalityHandler = autoInterpret(_immediateFinalityHandler);
