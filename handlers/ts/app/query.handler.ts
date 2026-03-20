// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Query Concept Implementation
// Execute structured retrieval over content with filtering, sorting, grouping, and aggregation.
// Supports live subscriptions for reactive updates.
import { randomBytes } from 'crypto';
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _queryHandler: FunctionalConceptHandler = {
  parse(input: Record<string, unknown>) {
    const query = input.query as string;
    const expression = input.expression as string;

    let p = createProgram();

    if (!expression || expression.trim().length === 0) {
      return complete(p, 'error', { message: 'The expression contains invalid syntax' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    p = put(p, 'query', query, {
      query,
      expression,
      filters: JSON.stringify([]),
      sorts: JSON.stringify([]),
      scope: '',
      isLive: false,
    });

    return complete(p, 'ok', { query }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  execute(input: Record<string, unknown>) {
    const query = input.query as string;

    let p = createProgram();
    p = spGet(p, 'query', query, 'record');
    p = branch(p, 'record',
      (b) => {
        const results = JSON.stringify({
          concept: 'unknown',
          action: 'query',
          params: {},
          filters: [],
          sorts: [],
          scope: '',
          executedAt: new Date().toISOString(),
        });
        return complete(b, 'ok', { results });
      },
      (b) => complete(b, 'notfound', { query }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  subscribe(input: Record<string, unknown>) {
    const query = input.query as string;

    let p = createProgram();
    p = spGet(p, 'query', query, 'record');
    p = branch(p, 'record',
      (b) => {
        const subscriptionId = randomBytes(16).toString('hex');
        let b2 = put(b, 'query', query, { isLive: true });
        return complete(b2, 'ok', { subscriptionId });
      },
      (b) => complete(b, 'notfound', { query }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  addFilter(input: Record<string, unknown>) {
    const query = input.query as string;
    const filter = input.filter as string;

    let p = createProgram();
    p = spGet(p, 'query', query, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'query', query, { filters: JSON.stringify([filter]) });
        return complete(b2, 'ok', { query });
      },
      (b) => complete(b, 'notfound', { query }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  addSort(input: Record<string, unknown>) {
    const query = input.query as string;
    const sort = input.sort as string;

    let p = createProgram();
    p = spGet(p, 'query', query, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'query', query, { sorts: JSON.stringify([sort]) });
        return complete(b2, 'ok', { query });
      },
      (b) => complete(b, 'notfound', { query }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setScope(input: Record<string, unknown>) {
    const query = input.query as string;
    const scope = input.scope as string;

    let p = createProgram();
    p = spGet(p, 'query', query, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = put(b, 'query', query, { scope });
        return complete(b2, 'ok', { query });
      },
      (b) => complete(b, 'notfound', { query }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const queryHandler = autoInterpret(_queryHandler);

