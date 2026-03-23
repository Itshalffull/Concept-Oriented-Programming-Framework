// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Alias Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, completeFrom,
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
        // existing found — check if name already present
        return completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          let aliases: string[] = [];
          try { aliases = JSON.parse(existing.aliases as string) || []; } catch { /* skip */ }
          if (aliases.includes(name)) {
            return { variant: 'exists', entity, name };
          }
          aliases.push(name);
          return { entity, name };
        });
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
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allAliases as Array<Record<string, unknown>>) || [];
      for (const rec of all) {
        let aliases: string[] = [];
        try { aliases = JSON.parse(rec.aliases as string) || []; } catch { /* skip */ }
        if (aliases.includes(name)) {
          return { variant: 'ok', entity: rec.entity as string };
        }
      }
      return { variant: 'notfound', message: `No alias found for name "${name}"` };
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const aliasHandler = autoInterpret(_aliasHandler);

