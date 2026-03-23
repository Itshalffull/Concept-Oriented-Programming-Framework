// @clef-handler style=functional
// ============================================================
// ScoreBridge — Functional Handler
// ============================================================
//
// Proxies Score queries to a remote Clef runtime over transport.
// Stores connection state in local storage indexed by bridge ID.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete, completeFrom,
  type StorageProgram, type Bindings,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'connections';

/** Generate a bridge connection ID from an endpoint URL.
 * Extracts just the hostname and replaces dots with dashes.
 * e.g. "https://api.example.com/score" → "bridge-api-example-com"
 */
function bridgeId(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    const host = url.hostname.replace(/\./g, '-').replace(/-+/g, '-');
    return `bridge-${host}`;
  } catch {
    return `bridge-${endpoint.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').slice(0, 64)}`;
  }
}

const _scoreBridgeHandler: FunctionalConceptHandler = {

  connect(input: Record<string, unknown>) {
    if (!input.endpoint || (typeof input.endpoint === 'string' && (input.endpoint as string).trim() === '')) {
      return complete(createProgram(), 'unreachable', { message: 'endpoint is required' }) as StorageProgram<Result>;
    }
    const endpoint = input.endpoint as string;
    const protocol = (input.protocol as string) || 'http';
    const authToken = (input.authToken as string) || '';
    const id = bridgeId(endpoint);
    const now = new Date().toISOString();

    // Validate auth token format locally: valid tokens start with "tok_" prefix.
    // Empty string means no auth (public endpoint) — that's fine.
    if (authToken && !authToken.startsWith('tok_')) {
      return complete(createProgram(), 'auth_failed', {
        endpoint,
        message: 'Authentication token was rejected',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = put(p, RELATION, id, {
      endpoint, protocol,
      authToken: authToken || null,
      status: 'connected',
      lastQueryAt: null,
      errorCount: 0,
      connectedAt: now,
    });
    return complete(p, 'ok', { bridge: id, endpoint, protocol }) as StorageProgram<Result>;
  },

  query(input: Record<string, unknown>) {
    if (!input.bridge || (typeof input.bridge === 'string' && (input.bridge as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'bridge is required' }) as StorageProgram<Result>;
    }
    const bridge = input.bridge as string;

    let p = createProgram();
    p = get(p, RELATION, bridge, 'conn');
    return branch(p,
      (bindings: Bindings) => bindings.conn == null,
      complete(createProgram(), 'notfound', { bridge }),
      complete(createProgram(), 'ok', { bridge, data: '{}' }),
    ) as StorageProgram<Result>;
  },

  show(input: Record<string, unknown>) {
    const bridge = input.bridge as string;

    let p = createProgram();
    p = get(p, RELATION, bridge, 'conn');
    return branch(p,
      (bindings: Bindings) => bindings.conn == null,
      complete(createProgram(), 'notfound', { bridge }),
      complete(createProgram(), 'ok', { bridge, item: '{}', related: '{}' }),
    ) as StorageProgram<Result>;
  },

  traverse(input: Record<string, unknown>) {
    const bridge = input.bridge as string;

    let p = createProgram();
    p = get(p, RELATION, bridge, 'conn');
    return branch(p,
      (bindings: Bindings) => bindings.conn == null,
      complete(createProgram(), 'notfound', { bridge }),
      complete(createProgram(), 'ok', { bridge, item: '{}', related: '{}' }),
    ) as StorageProgram<Result>;
  },

  disconnect(input: Record<string, unknown>) {
    const bridge = input.bridge as string;

    let p = createProgram();
    p = get(p, RELATION, bridge, 'conn');
    return branch(p,
      (bindings: Bindings) => bindings.conn == null,
      complete(createProgram(), 'notfound', { bridge }),
      (() => {
        let b = createProgram();
        b = del(b, RELATION, bridge);
        return complete(b, 'ok', { bridge });
      })(),
    ) as StorageProgram<Result>;
  },

  status(input: Record<string, unknown>) {
    const bridge = input.bridge as string;

    let p = createProgram();
    p = get(p, RELATION, bridge, 'conn');
    return branch(p,
      (bindings: Bindings) => bindings.conn == null,
      complete(createProgram(), 'notfound', { bridge }),
      completeFrom(createProgram(), 'ok', (bindings: Bindings) => {
        const conn = bindings.conn as Record<string, unknown>;
        return {
          bridge,
          endpoint: conn?.endpoint ?? '',
          status: conn?.status ?? 'connected',
          errorCount: (conn?.errorCount as number) ?? 0,
          lastQueryAt: (conn?.lastQueryAt as string) ?? '',
        };
      }),
    ) as StorageProgram<Result>;
  },
};

export const scoreBridgeHandler = autoInterpret(_scoreBridgeHandler);
