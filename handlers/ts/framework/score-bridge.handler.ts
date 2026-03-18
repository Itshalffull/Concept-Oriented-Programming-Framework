// ============================================================
// ScoreBridge — Functional Handler
// ============================================================
//
// Proxies Score queries to a remote Clef runtime over transport.
// Uses perform() for all network I/O — the interpreter resolves
// the concrete transport (HTTP, WebSocket) at execution time.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, perform, branch, pure, complete,
  getLens, putLens, modifyLens, mapBindings,
  relation, at, field,
  type StorageProgram, type Bindings,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

// --- Lenses ---

const connectionsRel = relation('connections');

// --- Helpers ---

/** Generate a bridge connection ID. */
function bridgeId(endpoint: string): string {
  return `bridge-${endpoint.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').slice(0, 64)}`;
}

// --- Handler ---

const _scoreBridgeHandler: FunctionalConceptHandler = {

  connect(input: Record<string, unknown>) {
    const endpoint = input.endpoint as string;
    const protocol = input.protocol as string;
    const authToken = input.authToken as string;
    const id = bridgeId(endpoint);
    const now = new Date().toISOString();

    let p = createProgram();

    // Perform health check against the remote Score endpoint
    p = perform(p, protocol, 'healthCheck', {
      url: `${endpoint}/health`,
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    }, 'healthResult');

    // Branch on health check result
    p = mapBindings(p, (bindings: Bindings) => {
      const result = bindings.healthResult as {
        status?: number;
        ok?: boolean;
        error?: string;
        authError?: boolean;
      } | null;

      if (!result || result.error) {
        return {
          reachable: false,
          authFailed: false,
          message: result?.error ?? 'No response from endpoint',
        };
      }

      if (result.authError || result.status === 401 || result.status === 403) {
        return {
          reachable: true,
          authFailed: true,
          message: 'Authentication rejected by remote endpoint',
        };
      }

      return { reachable: true, authFailed: false };
    }, 'healthParsed');

    // Unreachable branch
    const unreachableBranch = complete(createProgram(), 'unreachable', {
      endpoint,
      message: 'Remote endpoint did not respond to health check',
    });

    // Auth failed branch
    const authFailedBranch = complete(createProgram(), 'auth_failed', {
      endpoint,
      message: 'Authentication token was rejected',
    });

    // Success branch: store the connection
    let successBranch = createProgram();
    successBranch = putLens(successBranch, at(connectionsRel, id), {
      endpoint,
      protocol,
      authToken: authToken || null,
      status: 'connected',
      lastQueryAt: null,
      errorCount: 0,
      connectedAt: now,
    });
    successBranch = complete(successBranch, 'ok', {
      bridge: id,
      endpoint,
      protocol,
    });

    // First check reachability
    p = branch(p,
      (bindings: Bindings) => {
        const parsed = bindings.healthParsed as { reachable: boolean };
        return !parsed.reachable;
      },
      unreachableBranch,
      createProgram(), // continue to auth check
    );

    // Then check auth
    p = branch(p,
      (bindings: Bindings) => {
        const parsed = bindings.healthParsed as { authFailed: boolean };
        return parsed.authFailed;
      },
      authFailedBranch,
      successBranch,
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  query(input: Record<string, unknown>) {
    const bridge = input.bridge as string;
    const graphql = input.graphql as string;

    let p = createProgram();
    p = getLens(p, at(connectionsRel, bridge), 'conn');

    // Not found branch
    const notFoundBranch = complete(createProgram(), 'notfound', { bridge });

    // Found: execute remote query
    let queryBranch = createProgram();

    // Build the remote request from connection data
    queryBranch = perform(queryBranch, 'http', 'request', {
      bridge,
      graphql,
    }, 'queryResult');

    queryBranch = mapBindings(queryBranch, (bindings: Bindings) => {
      const conn = bindings.conn as Record<string, unknown>;
      const result = bindings.queryResult as {
        ok?: boolean;
        data?: unknown;
        error?: string;
        disconnected?: boolean;
      } | null;

      if (result?.disconnected) {
        return {
          variant: 'disconnected',
          bridge,
          message: 'Connection lost during query',
        };
      }

      if (result?.error) {
        return {
          variant: 'remote_error',
          bridge,
          message: result.error,
        };
      }

      return {
        variant: 'ok',
        bridge,
        data: JSON.stringify(result?.data ?? {}),
      };
    }, 'queryParsed');

    // Update last query timestamp and error count
    queryBranch = modifyLens(queryBranch, at(connectionsRel, bridge), (bindings: Bindings) => {
      const conn = bindings.conn as Record<string, unknown>;
      const parsed = bindings.queryParsed as { variant: string };
      const now = new Date().toISOString();

      if (parsed.variant === 'ok') {
        return { ...conn, lastQueryAt: now, errorCount: 0 };
      }
      if (parsed.variant === 'disconnected') {
        return { ...conn, status: 'disconnected', errorCount: ((conn.errorCount as number) ?? 0) + 1 };
      }
      // remote_error: increment error count but stay connected
      return { ...conn, errorCount: ((conn.errorCount as number) ?? 0) + 1 };
    });

    queryBranch = pure(queryBranch, {
      variant: 'ok',
      bridge,
      data: '{}',
    });

    p = branch(p,
      (bindings: Bindings) => bindings.conn == null,
      notFoundBranch,
      queryBranch,
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  show(input: Record<string, unknown>) {
    const bridge = input.bridge as string;
    const kind = input.kind as string;
    const name = input.name as string;

    let p = createProgram();
    p = getLens(p, at(connectionsRel, bridge), 'conn');

    const notFoundBranch = complete(createProgram(), 'notfound', { bridge });

    // Execute remote show via Score query
    let showBranch = createProgram();
    showBranch = perform(showBranch, 'http', 'request', {
      bridge,
      operation: 'show',
      kind,
      name,
    }, 'showResult');

    showBranch = mapBindings(showBranch, (bindings: Bindings) => {
      const result = bindings.showResult as {
        ok?: boolean;
        item?: unknown;
        related?: unknown;
        error?: string;
        entityNotFound?: boolean;
      } | null;

      if (result?.entityNotFound) {
        return { variant: 'entity_notfound', kind, name };
      }
      if (result?.error) {
        return { variant: 'remote_error', bridge, message: result.error };
      }
      return {
        variant: 'ok',
        bridge,
        item: JSON.stringify(result?.item ?? {}),
        related: JSON.stringify(result?.related ?? {}),
      };
    }, 'showParsed');

    // Update last query timestamp
    showBranch = modifyLens(showBranch, at(connectionsRel, bridge), (bindings: Bindings) => {
      const conn = bindings.conn as Record<string, unknown>;
      return { ...conn, lastQueryAt: new Date().toISOString() };
    });

    showBranch = pure(showBranch, {
      variant: 'ok',
      bridge,
      item: '{}',
      related: '{}',
    });

    p = branch(p,
      (bindings: Bindings) => bindings.conn == null,
      notFoundBranch,
      showBranch,
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  traverse(input: Record<string, unknown>) {
    const bridge = input.bridge as string;
    const rel = input.relation as string;
    const target = input.target as string;

    let p = createProgram();
    p = getLens(p, at(connectionsRel, bridge), 'conn');

    const notFoundBranch = complete(createProgram(), 'notfound', { bridge });

    let traverseBranch = createProgram();
    traverseBranch = perform(traverseBranch, 'http', 'request', {
      bridge,
      operation: 'traverse',
      relation: rel,
      target,
    }, 'traverseResult');

    traverseBranch = mapBindings(traverseBranch, (bindings: Bindings) => {
      const result = bindings.traverseResult as {
        ok?: boolean;
        item?: unknown;
        related?: unknown;
        error?: string;
        edgeNotFound?: boolean;
      } | null;

      if (result?.edgeNotFound) {
        return { variant: 'edge_notfound', relation: rel, target };
      }
      if (result?.error) {
        return { variant: 'remote_error', bridge, message: result.error };
      }
      return {
        variant: 'ok',
        bridge,
        item: JSON.stringify(result?.item ?? {}),
        related: JSON.stringify(result?.related ?? {}),
      };
    }, 'traverseParsed');

    traverseBranch = modifyLens(traverseBranch, at(connectionsRel, bridge), (bindings: Bindings) => {
      const conn = bindings.conn as Record<string, unknown>;
      return { ...conn, lastQueryAt: new Date().toISOString() };
    });

    traverseBranch = pure(traverseBranch, {
      variant: 'ok',
      bridge,
      item: '{}',
      related: '{}',
    });

    p = branch(p,
      (bindings: Bindings) => bindings.conn == null,
      notFoundBranch,
      traverseBranch,
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  disconnect(input: Record<string, unknown>) {
    const bridge = input.bridge as string;

    let p = createProgram();
    p = getLens(p, at(connectionsRel, bridge), 'conn');

    const notFoundBranch = complete(createProgram(), 'notfound', { bridge });

    let disconnectBranch = createProgram();
    disconnectBranch = del(disconnectBranch, 'connections', bridge);
    disconnectBranch = complete(disconnectBranch, 'ok', { bridge });

    p = branch(p,
      (bindings: Bindings) => bindings.conn == null,
      notFoundBranch,
      disconnectBranch,
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  status(input: Record<string, unknown>) {
    const bridge = input.bridge as string;

    let p = createProgram();
    p = getLens(p, at(connectionsRel, bridge), 'conn');

    const notFoundBranch = complete(createProgram(), 'notfound', { bridge });

    let statusBranch = createProgram();
    statusBranch = mapBindings(statusBranch, (bindings: Bindings) => {
      const conn = bindings.conn as Record<string, unknown>;
      return {
        bridge,
        endpoint: conn.endpoint as string,
        status: conn.status as string,
        errorCount: (conn.errorCount as number) ?? 0,
        lastQueryAt: (conn.lastQueryAt as string) ?? '',
      };
    }, 'statusData');
    statusBranch = complete(statusBranch, 'ok', {
      bridge,
      endpoint: '',
      status: 'connected',
      errorCount: 0,
      lastQueryAt: '',
    });

    p = branch(p,
      (bindings: Bindings) => bindings.conn == null,
      notFoundBranch,
      statusBranch,
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const scoreBridgeHandler = autoInterpret(_scoreBridgeHandler);

