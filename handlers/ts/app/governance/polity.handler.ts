// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Polity Concept Handler
// Establish and manage governance domains with foundational rules.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _polityHandler: FunctionalConceptHandler = {
  establish(input: Record<string, unknown>) {
    const id = `polity-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'polity', id, {
      id, name: input.name, purpose: input.purpose, scope: input.scope,
      values: input.values, amendmentThreshold: input.amendmentThreshold,
      status: 'Active', establishedAt: new Date().toISOString(),
    });
    return complete(p, 'ok', { polity: id }) as StorageProgram<Result>;
  },

  amend(input: Record<string, unknown>) {
    const { polity, field, newValue } = input;
    let p = createProgram();
    p = get(p, 'polity', polity as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'polity', polity as string, { [field as string]: newValue, lastAmendedAt: new Date().toISOString() });
        return complete(b2, 'ok', { polity });
      },
      (b) => complete(b, 'not_found', { polity }),
    );

    return p as StorageProgram<Result>;
  },

  dissolve(input: Record<string, unknown>) {
    const { polity, reason } = input;
    let p = createProgram();
    p = get(p, 'polity', polity as string, 'record');

    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'polity', polity as string, { status: 'Dissolved', dissolvedAt: new Date().toISOString(), reason });
        return complete(b2, 'ok', { polity });
      },
      (b) => complete(b, 'not_found', { polity }),
    );

    return p as StorageProgram<Result>;
  },
};

export const polityHandler = autoInterpret(_polityHandler);
