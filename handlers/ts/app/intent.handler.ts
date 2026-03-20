// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _intentHandler: FunctionalConceptHandler = {
  define(input: Record<string, unknown>) {
    const intent = input.intent as string;
    const target = input.target as string;
    const purpose = input.purpose as string;
    const operationalPrinciple = input.operationalPrinciple as string;

    let p = createProgram();
    p = spGet(p, 'intent', intent, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'already exists' }),
      (b) => {
        const now = new Date().toISOString();
        let b2 = put(b, 'intent', intent, {
          intent, target, purpose, operationalPrinciple,
          assertions: JSON.stringify([]),
          createdAt: now, updatedAt: now,
        });
        return complete(b2, 'ok', { intent });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  update(input: Record<string, unknown>) {
    const intent = input.intent as string;
    const purpose = input.purpose as string;
    const operationalPrinciple = input.operationalPrinciple as string;

    let p = createProgram();
    p = spGet(p, 'intent', intent, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'intent', intent, { purpose, operationalPrinciple, updatedAt: new Date().toISOString() });
        return complete(b2, 'ok', { intent });
      },
      (b) => complete(b, 'notfound', { message: 'Intent not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  verify(input: Record<string, unknown>) {
    const intent = input.intent as string;

    let p = createProgram();
    p = spGet(p, 'intent', intent, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { valid: true, failures: JSON.stringify([]) }),
      (b) => complete(b, 'notfound', { message: 'Intent not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  discover(input: Record<string, unknown>) {
    const query = input.query as string;

    let p = createProgram();
    p = find(p, 'intent', query, 'results');
    return complete(p, 'ok', { matches: JSON.stringify([]) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  suggestFromDescription(input: Record<string, unknown>) {
    const description = input.description as string;
    const words = description.split(/\s+/);
    const suggested = {
      name: words.slice(0, 3).join(''),
      purpose: description,
      actions: ['create', 'get', 'update', 'delete'],
      state: words.filter((w) => w.length > 4).slice(0, 5).map((w) => w.toLowerCase()),
    };
    const p = createProgram();
    return complete(p, 'ok', { suggested: JSON.stringify(suggested) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const intentHandler = autoInterpret(_intentHandler);

