// Transport Concept Implementation [P]
// Data transport layer with multi-protocol support, caching, retry policies, and offline queue.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const VALID_KINDS = ['rest', 'graphql', 'websocket'];

export const transportHandler: ConceptHandler = {
  async configure(input, storage) {
    const transport = input.transport as string;
    const kind = input.kind as string;
    const baseUrl = input.baseUrl as string;
    const auth = input.auth as string;
    const retryPolicy = input.retryPolicy as string;

    if (!VALID_KINDS.includes(kind)) {
      return { variant: 'invalid', message: `Invalid transport kind "${kind}". Valid kinds: ${VALID_KINDS.join(', ')}` };
    }

    if (!baseUrl) {
      return { variant: 'invalid', message: 'Base URL is required' };
    }

    const id = transport || nextId('P');

    await storage.put('transport', id, {
      kind,
      baseUrl,
      auth: auth || '',
      status: 'configured',
      retryPolicy: retryPolicy || JSON.stringify({ maxRetries: 3, backoff: 'exponential' }),
      cacheTTL: 300,
      pendingQueue: JSON.stringify([]),
    });

    return { variant: 'ok', transport: id };
  },

  async fetch(input, storage) {
    const transport = input.transport as string;
    const query = input.query as string;

    const existing = await storage.get('transport', transport);
    if (!existing) {
      return { variant: 'error', status: 404, message: `Transport "${transport}" not found` };
    }

    const status = existing.status as string;
    if (status !== 'configured' && status !== 'connected') {
      return { variant: 'error', status: 503, message: `Transport is in "${status}" state` };
    }

    // Check cache
    const cacheKey = `cache:${transport}:${query}`;
    const cached = await storage.get('transportCache', cacheKey);
    if (cached) {
      const age = Date.now() - (cached.timestamp as number);
      const ttl = (existing.cacheTTL as number) * 1000;
      if (age < ttl) {
        return {
          variant: 'cached',
          data: cached.data as string,
          age: Math.floor(age / 1000),
        };
      }
    }

    // Simulate fetch
    const kind = existing.kind as string;
    const baseUrl = existing.baseUrl as string;
    const data = JSON.stringify({
      source: `${kind}://${baseUrl}`,
      query,
      timestamp: new Date().toISOString(),
    });

    // Store in cache
    await storage.put('transportCache', cacheKey, {
      data,
      timestamp: Date.now(),
    });

    return { variant: 'ok', data };
  },

  async mutate(input, storage) {
    const transport = input.transport as string;
    const action = input.action as string;
    const mutationInput = input.input as string;

    const existing = await storage.get('transport', transport);
    if (!existing) {
      return { variant: 'error', status: 404, message: `Transport "${transport}" not found` };
    }

    const status = existing.status as string;
    if (status === 'offline') {
      // Queue the mutation for later
      const queue: Array<Record<string, string>> = JSON.parse((existing.pendingQueue as string) || '[]');
      queue.push({ action, input: mutationInput, queuedAt: new Date().toISOString() });

      await storage.put('transport', transport, {
        ...existing,
        pendingQueue: JSON.stringify(queue),
      });

      return { variant: 'queued', queuePosition: queue.length };
    }

    // Simulate mutation
    const result = JSON.stringify({
      action,
      input: mutationInput,
      result: 'success',
      timestamp: new Date().toISOString(),
    });

    return { variant: 'ok', result };
  },

  async flushQueue(input, storage) {
    const transport = input.transport as string;

    const existing = await storage.get('transport', transport);
    if (!existing) {
      return { variant: 'error', status: 404, message: `Transport "${transport}" not found` };
    }

    const queue: Array<Record<string, string>> = JSON.parse((existing.pendingQueue as string) || '[]');
    if (queue.length === 0) {
      return { variant: 'ok', flushed: 0 };
    }

    const status = existing.status as string;
    let sent = 0;
    let failed = 0;

    if (status === 'offline') {
      // Cannot flush while offline
      failed = queue.length;
      return { variant: 'partial', sent, failed };
    }

    // Process all queued mutations
    sent = queue.length;

    await storage.put('transport', transport, {
      ...existing,
      pendingQueue: JSON.stringify([]),
    });

    return { variant: 'ok', flushed: sent };
  },
};
