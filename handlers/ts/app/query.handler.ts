// Query Concept Implementation
// Execute structured retrieval over content with filtering, sorting, grouping, and aggregation.
// Supports live subscriptions for reactive updates.
//
// Expression format: "Concept/action" optionally with params as JSON.
// Example: "Schema/list" or "ContentNode/list"
// Filters and sorts are applied client-side on the result set.
import { randomBytes } from 'crypto';
import type { ConceptHandler } from '@clef/runtime';

export const queryHandler: ConceptHandler = {
  async parse(input, storage) {
    const query = input.query as string;
    const expression = input.expression as string;

    if (!expression || expression.trim().length === 0) {
      return { variant: 'error', message: 'The expression contains invalid syntax' };
    }

    await storage.put('query', query, {
      query,
      expression,
      filters: JSON.stringify([]),
      sorts: JSON.stringify([]),
      scope: '',
      isLive: false,
    });

    return { variant: 'ok', query };
  },

  async execute(input, storage) {
    const query = input.query as string;

    const record = await storage.get('query', query);
    if (!record) {
      return { variant: 'notfound', query };
    }

    const expression = record.expression as string;
    const filters: string[] = JSON.parse((record.filters as string) || '[]');
    const sorts: string[] = JSON.parse((record.sorts as string) || '[]');

    // Parse expression: "Concept/action" or "Concept/action?param=value"
    const parts = expression.split('/');
    if (parts.length < 2) {
      return { variant: 'error', message: `Invalid expression format: "${expression}". Expected "Concept/action"` };
    }

    const concept = parts[0];
    const actionPart = parts[1];
    const [action, queryString] = actionPart.split('?');

    // Parse query string params if present
    const params: Record<string, unknown> = {};
    if (queryString) {
      for (const pair of queryString.split('&')) {
        const [key, value] = pair.split('=');
        if (key) params[decodeURIComponent(key)] = decodeURIComponent(value ?? '');
      }
    }

    // Return the parsed query info. The actual invocation happens at the
    // transport layer (the frontend calls invoke(concept, action, params)
    // with these values). This keeps Query stateless with respect to other
    // concepts — it doesn't reach into the kernel directly.
    const results = JSON.stringify({
      concept,
      action,
      params,
      filters,
      sorts,
      scope: record.scope as string,
      executedAt: new Date().toISOString(),
    });

    return { variant: 'ok', results };
  },

  async subscribe(input, storage) {
    const query = input.query as string;
    const record = await storage.get('query', query);
    if (!record) {
      return { variant: 'notfound', query };
    }

    const subscriptionId = randomBytes(16).toString('hex');
    await storage.put('query', query, { ...record, isLive: true });
    return { variant: 'ok', subscriptionId };
  },

  async addFilter(input, storage) {
    const query = input.query as string;
    const filter = input.filter as string;
    const record = await storage.get('query', query);
    if (!record) return { variant: 'notfound', query };

    const filters: string[] = JSON.parse((record.filters as string) || '[]');
    filters.push(filter);
    await storage.put('query', query, { ...record, filters: JSON.stringify(filters) });
    return { variant: 'ok', query };
  },

  async addSort(input, storage) {
    const query = input.query as string;
    const sort = input.sort as string;
    const record = await storage.get('query', query);
    if (!record) return { variant: 'notfound', query };

    const sorts: string[] = JSON.parse((record.sorts as string) || '[]');
    sorts.push(sort);
    await storage.put('query', query, { ...record, sorts: JSON.stringify(sorts) });
    return { variant: 'ok', query };
  },

  async setScope(input, storage) {
    const query = input.query as string;
    const scope = input.scope as string;
    const record = await storage.get('query', query);
    if (!record) return { variant: 'notfound', query };

    await storage.put('query', query, { ...record, scope });
    return { variant: 'ok', query };
  },
};
