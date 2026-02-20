// Transport Concept Implementation
// Network communication for concept data synchronization.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'transport';

const VALID_TYPES = ['rest', 'graphql', 'websocket', 'local'] as const;

export const transportHandler: ConceptHandler = {
  /**
   * configure(transport, config)
   *   -> ok(transport) | invalid(message)
   */
  async configure(input, storage) {
    const transport = input.transport as string;
    const config = input.config as string;

    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(config) as Record<string, unknown>;
    } catch {
      return { variant: 'invalid', message: 'Config is not valid JSON' };
    }

    const type = parsedConfig.type as string;
    if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
      return {
        variant: 'invalid',
        message: `Invalid transport type "${type}". Valid types: ${VALID_TYPES.join(', ')}`,
      };
    }

    const baseUrl = (parsedConfig.baseUrl as string) ?? null;
    const defaultHeaders = parsedConfig.defaultHeaders
      ? JSON.stringify(parsedConfig.defaultHeaders)
      : '{}';
    const retryPolicy = parsedConfig.retryPolicy
      ? JSON.stringify(parsedConfig.retryPolicy)
      : '{"maxRetries": 3, "backoff": "exponential"}';
    const cacheTTL = (parsedConfig.cacheTTL as number) ?? 0;

    await storage.put(RELATION, transport, {
      transport,
      transports: config,
      baseUrl,
      headers: defaultHeaders,
      status: 'idle',
      retryPolicy,
      cache: JSON.stringify({ ttl: cacheTTL, entries: {} }),
      pendingQueue: '[]',
    });

    return { variant: 'ok', transport };
  },

  /**
   * fetch(transport, request)
   *   -> ok(transport, response) | error(transport, status, message) | offline(transport)
   */
  async fetch(input, storage) {
    const transport = input.transport as string;
    const request = input.request as string;

    const record = await storage.get(RELATION, transport);
    if (!record) {
      return {
        variant: 'error',
        transport,
        status: 0,
        message: `Transport "${transport}" not configured`,
      };
    }

    let parsedRequest: Record<string, unknown>;
    try {
      parsedRequest = JSON.parse(request) as Record<string, unknown>;
    } catch {
      return {
        variant: 'error',
        transport,
        status: 400,
        message: 'Request is not valid JSON',
      };
    }

    // In a real runtime, this would make an actual network request.
    // For the concept implementation, simulate a successful response.
    const method = (parsedRequest.method as string) ?? 'GET';
    const path = (parsedRequest.path as string) ?? '/';

    const response = JSON.stringify({
      status: 200,
      method,
      path,
      data: {},
      pagination: { page: 1, total: 0 },
    });

    await storage.put(RELATION, transport, {
      ...record,
      status: 'idle',
    });

    return { variant: 'ok', transport, response };
  },

  /**
   * mutate(transport, request)
   *   -> ok(transport, response) | error(transport, status, message)
   *   | conflict(transport, serverState) | offline(transport)
   */
  async mutate(input, storage) {
    const transport = input.transport as string;
    const request = input.request as string;

    const record = await storage.get(RELATION, transport);
    if (!record) {
      return {
        variant: 'error',
        transport,
        status: 0,
        message: `Transport "${transport}" not configured`,
      };
    }

    let parsedRequest: Record<string, unknown>;
    try {
      parsedRequest = JSON.parse(request) as Record<string, unknown>;
    } catch {
      return {
        variant: 'error',
        transport,
        status: 400,
        message: 'Request is not valid JSON',
      };
    }

    const method = (parsedRequest.method as string) ?? 'POST';
    const path = (parsedRequest.path as string) ?? '/';

    const response = JSON.stringify({
      status: 200,
      method,
      path,
      data: parsedRequest.body ?? {},
    });

    return { variant: 'ok', transport, response };
  },

  /**
   * subscribe(transport, channel)
   *   -> ok(transport, subscription) | unsupported(message) | error(message)
   */
  async subscribe(input, storage) {
    const transport = input.transport as string;
    const channel = input.channel as string;

    const record = await storage.get(RELATION, transport);
    if (!record) {
      return { variant: 'error', message: `Transport "${transport}" not configured` };
    }

    let config: Record<string, unknown>;
    try {
      config = JSON.parse(record.transports as string) as Record<string, unknown>;
    } catch {
      config = {};
    }

    const type = config.type as string;
    if (type !== 'websocket' && type !== 'graphql') {
      return {
        variant: 'unsupported',
        message: `Transport type "${type}" does not support subscriptions`,
      };
    }

    const subscription = `sub_${channel}_${Date.now()}`;

    return { variant: 'ok', transport, subscription };
  },

  /**
   * unsubscribe(transport, subscription)
   *   -> ok(transport) | notfound(message)
   */
  async unsubscribe(input, storage) {
    const transport = input.transport as string;

    const record = await storage.get(RELATION, transport);
    if (!record) {
      return { variant: 'notfound', message: `Transport "${transport}" not configured` };
    }

    return { variant: 'ok', transport };
  },

  /**
   * setAuth(transport, auth)
   *   -> ok(transport) | invalid(message)
   */
  async setAuth(input, storage) {
    const transport = input.transport as string;
    const auth = input.auth as string;

    const record = await storage.get(RELATION, transport);
    if (!record) {
      return { variant: 'invalid', message: `Transport "${transport}" not configured` };
    }

    let parsedAuth: Record<string, unknown>;
    try {
      parsedAuth = JSON.parse(auth) as Record<string, unknown>;
    } catch {
      return { variant: 'invalid', message: 'Auth config is not valid JSON' };
    }

    // Merge auth into headers
    let headers: Record<string, string>;
    try {
      headers = JSON.parse(record.headers as string) as Record<string, string>;
    } catch {
      headers = {};
    }

    if (parsedAuth.bearer) {
      headers['Authorization'] = `Bearer ${parsedAuth.bearer}`;
    } else if (parsedAuth.apiKey) {
      headers['X-API-Key'] = parsedAuth.apiKey as string;
    }

    await storage.put(RELATION, transport, {
      ...record,
      headers: JSON.stringify(headers),
    });

    return { variant: 'ok', transport };
  },

  /**
   * flushQueue(transport)
   *   -> ok(transport, results) | error(message)
   */
  async flushQueue(input, storage) {
    const transport = input.transport as string;

    const record = await storage.get(RELATION, transport);
    if (!record) {
      return { variant: 'error', message: `Transport "${transport}" not configured` };
    }

    let queue: string[];
    try {
      queue = JSON.parse(record.pendingQueue as string) as string[];
    } catch {
      queue = [];
    }

    // Clear the queue
    await storage.put(RELATION, transport, {
      ...record,
      pendingQueue: '[]',
    });

    const results = JSON.stringify(
      queue.map((req, i) => ({ index: i, status: 200, result: 'replayed' })),
    );

    return { variant: 'ok', transport, results };
  },
};
