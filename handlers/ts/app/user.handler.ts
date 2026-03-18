// @migrated dsl-constructs 2026-03-18
// User Concept Implementation — Functional (StorageProgram) style
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
import { autoInterpret } from '../../../runtime/functional-compat.ts';
  createProgram, find, put, complete, completeFrom, mapBindings, branch,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

const _userHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const user = input.user as string;
    const name = input.name as string;
    const email = input.email as string;

    let p = createProgram();

    // Check for duplicate name
    p = find(p, 'user', { name }, 'existingByName');
    p = mapBindings(p, (bindings) => {
      const results = (bindings.existingByName as Array<Record<string, unknown>>) || [];
      return results.length;
    }, 'nameCount');
    p = branch(p, 'nameCount',
      (b) => complete(b, 'error', { message: 'name already taken' }),
      (b) => {
        // Check for duplicate email
        let b2 = find(b, 'user', { email }, 'existingByEmail');
        b2 = mapBindings(b2, (bindings) => {
          const results = (bindings.existingByEmail as Array<Record<string, unknown>>) || [];
          return results.length;
        }, 'emailCount');
        b2 = branch(b2, 'emailCount',
          (b3) => complete(b3, 'error', { message: 'email already taken' }),
          (b3) => {
            let b4 = put(b3, 'user', user, { user, name, email });
            return complete(b4, 'ok', { user });
          },
        );
        return b2;
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const userHandler = autoInterpret(_userHandler);

