// Query Concept Implementation
// Execute structured retrieval over content with filtering, sorting, grouping, and aggregation.
// Supports live subscriptions for reactive updates.
import { randomBytes } from 'crypto';
import type { ConceptHandler } from '@clef/kernel';

export const queryHandler: ConceptHandler = {
  async parse(input, storage) {
    const query = input.query as string;
    const expression = input.expression as string;

    // Validate expression syntax: must be non-empty
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

    // Build the effective expression from base + filters + sorts
    let effectiveExpression = record.expression as string;
    const filters: string[] = JSON.parse(record.filters as string);
    const sorts: string[] = JSON.parse(record.sorts as string);

    if (filters.length > 0) {
      effectiveExpression += ' AND ' + filters.join(' AND ');
    }
    if (sorts.length > 0) {
      effectiveExpression += ' ORDER BY ' + sorts.join(', ');
    }

    // Return the constructed query as the result set representation
    const results = JSON.stringify({
      expression: effectiveExpression,
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

    // Activate live subscription
    const subscriptionId = randomBytes(16).toString('hex');

    await storage.put('query', query, {
      ...record,
      isLive: true,
    });

    return { variant: 'ok', subscriptionId };
  },

  async addFilter(input, storage) {
    const query = input.query as string;
    const filter = input.filter as string;

    const record = await storage.get('query', query);
    if (!record) {
      return { variant: 'notfound', query };
    }

    const filters: string[] = JSON.parse(record.filters as string);
    filters.push(filter);

    await storage.put('query', query, {
      ...record,
      filters: JSON.stringify(filters),
    });

    return { variant: 'ok', query };
  },

  async addSort(input, storage) {
    const query = input.query as string;
    const sort = input.sort as string;

    const record = await storage.get('query', query);
    if (!record) {
      return { variant: 'notfound', query };
    }

    const sorts: string[] = JSON.parse(record.sorts as string);
    sorts.push(sort);

    await storage.put('query', query, {
      ...record,
      sorts: JSON.stringify(sorts),
    });

    return { variant: 'ok', query };
  },

  async setScope(input, storage) {
    const query = input.query as string;
    const scope = input.scope as string;

    const record = await storage.get('query', query);
    if (!record) {
      return { variant: 'notfound', query };
    }

    await storage.put('query', query, {
      ...record,
      scope,
    });

    return { variant: 'ok', query };
  },
};
