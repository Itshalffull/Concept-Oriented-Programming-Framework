// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Pathauto Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const _pathautoHandler: FunctionalConceptHandler = {
  generateAlias(input: Record<string, unknown>) {
    if (!input.entity || (typeof input.entity === 'string' && (input.entity as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'entity is required' }) as StorageProgram<Result>;
    }
    const pattern = input.pattern as string;
    const entity = input.entity as string;

    let p = createProgram();
    p = spGet(p, 'pattern', pattern, 'patternEntry');

    // Simplified: generate alias from entity directly
    const alias = slugify(entity);

    p = put(p, 'alias', `${pattern}:${entity}`, {
      pattern,
      entity,
      alias,
    });

    return complete(p, 'ok', { alias }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  bulkGenerate(input: Record<string, unknown>) {
    const pattern = input.pattern as string;
    const entities = input.entities as string;

    let p = createProgram();
    p = spGet(p, 'pattern', pattern, 'patternEntry');
    p = branch(p, 'patternEntry',
      (b) => {
        const entityList = JSON.parse(entities) as string[];
        const aliases: Record<string, string> = {};

        for (const entity of entityList) {
          const alias = slugify(entity);
          b = put(b, 'alias', `${pattern}:${entity}`, {
            pattern,
            entity,
            alias,
          });
          aliases[entity] = alias;
        }

        return complete(b, 'ok', { aliases: JSON.stringify(aliases) });
      },
      (b) => complete(b, 'notfound', {}),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  cleanString(input: Record<string, unknown>) {
    if (!input.input || (typeof input.input === 'string' && (input.input as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'input is required' }) as StorageProgram<Result>;
    }
    const rawInput = input.input as string;
    const cleaned = slugify(rawInput);

    let p = createProgram();
    return complete(p, 'ok', { cleaned }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const pathautoHandler = autoInterpret(_pathautoHandler);

