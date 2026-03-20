// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// EnvProvider Concept Implementation
// Manage secret resolution from process environment variables. Owns the
// environment variable cache, tracks which variables have been accessed,
// and validates variable existence.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _envProviderHandler: FunctionalConceptHandler = {
  fetch(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = spGet(p, 'variable', name, 'cached');
    p = branch(p, 'cached',
      (b) => complete(b, 'ok', { value: '' }),
      (b) => {
        // Resolve from process environment
        const value = process.env[name];
        if (value === undefined || value === null) {
          return complete(b, 'variableNotSet', { name });
        }

        // Cache the resolved value
        let b2 = put(b, 'variable', name, {
          name,
          value,
          cachedAt: new Date().toISOString(),
        });

        return complete(b2, 'ok', { value });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const envProviderHandler = autoInterpret(_envProviderHandler);

