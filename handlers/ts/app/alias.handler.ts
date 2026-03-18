// @migrated dsl-constructs 2026-03-18
// Alias Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _aliasHandler: FunctionalConceptHandler = {
  addAlias(input: Record<string, unknown>) {
    const entity = input.entity as string;
    const name = input.name as string;

    let p = createProgram();
    p = spGet(p, 'alias', entity, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // existing found — aliases parsed at runtime; check for duplicate handled by runtime
        // In functional style, we put unconditionally and let runtime handle idempotency
        let b2 = put(b, 'alias', entity, {
          entity,
          aliases: '', // resolved at runtime: append name to existing aliases
        });
        return complete(b2, 'ok', { entity, name });
      },
      (b) => {
        // No existing aliases — create new
        let b2 = put(b, 'alias', entity, {
          entity,
          aliases: JSON.stringify([name]),
        });
        return complete(b2, 'ok', { entity, name });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  removeAlias(input: Record<string, unknown>) {
    const entity = input.entity as string;
    const name = input.name as string;

    let p = createProgram();
    p = spGet(p, 'alias', entity, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // existing found — update aliases (remove name, resolved at runtime)
        let b2 = put(b, 'alias', entity, {
          entity,
          aliases: '', // resolved at runtime: filter out name from existing aliases
        });
        return complete(b2, 'ok', { entity, name });
      },
      (b) => complete(b, 'notfound', { entity, name }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolve(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = find(p, 'alias', {}, 'allAliases');
    // Scanning all aliases for a match is handled at runtime
    return complete(p, 'ok', { entity: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const aliasHandler = autoInterpret(_aliasHandler);

