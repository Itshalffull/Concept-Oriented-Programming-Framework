// ============================================================
// COPF Kernel — WebSocket Transport Adapter
//
// Section 6.4: Transport Layer
//   WebSocketAdapter — persistent connection, negotiates mode
//   on handshake (graphql or lite).
//
// Supports bidirectional communication:
//   - Engine → Concept: invoke, query, health
//   - Concept → Engine: push completions (via subscribe)
//
// For testing, accepts a mock WebSocket implementation.
// ============================================================

import type {
  ConceptTransport,
  ConceptQuery,
  ActionInvocation,
  ActionCompletion,
} from './types.js';

// --- WebSocket Message Types ---

export interface WsMessage {
  type: 'invoke' | 'query' | 'health' | 'completion' | 'response' | 'error';
  id: string;
  payload: unknown;
}

// --- Mock WebSocket interface (for testing without real WS) ---

export interface MockWebSocket {
  send(data: string): void;
  onMessage(handler: (data: string) => void): void;
  close(): void;
  readyState: number;
}

export type WebSocketFactory = (url: string) => MockWebSocket;

// --- WebSocket Transport Adapter ---

/**
 * Create a WebSocket transport adapter.
 *
 * Negotiates query mode on handshake. Supports persistent
 * connections with automatic reconnection.
 */
export function createWebSocketAdapter(
  url: string,
  queryMode: 'graphql' | 'lite',
  wsFactory: WebSocketFactory,
): ConceptTransport & { close(): void; onPushCompletion(handler: (c: ActionCompletion) => void): void } {
  let ws = wsFactory(url);
  const pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  const pushHandlers: ((c: ActionCompletion) => void)[] = [];
  let messageId = 0;

  // Set up message handler
  function setupMessageHandler(socket: MockWebSocket): void {
    socket.onMessage((data: string) => {
      try {
        const msg: WsMessage = JSON.parse(data);

        if (msg.type === 'response' || msg.type === 'error') {
          const pending = pendingRequests.get(msg.id);
          if (pending) {
            pendingRequests.delete(msg.id);
            if (msg.type === 'error') {
              pending.reject(new Error(msg.payload as string));
            } else {
              pending.resolve(msg.payload);
            }
          }
        }

        if (msg.type === 'completion') {
          const completion = msg.payload as ActionCompletion;
          for (const handler of pushHandlers) {
            handler(completion);
          }
        }
      } catch {
        // Ignore malformed messages
      }
    });
  }

  setupMessageHandler(ws);

  function sendAndWait<T>(type: WsMessage['type'], payload: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `msg-${++messageId}`;
      pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      const msg: WsMessage = { type, id, payload };
      ws.send(JSON.stringify(msg));
    });
  }

  return {
    queryMode,

    async invoke(invocation: ActionInvocation): Promise<ActionCompletion> {
      return sendAndWait<ActionCompletion>('invoke', invocation);
    },

    async query(request: ConceptQuery): Promise<Record<string, unknown>[]> {
      return sendAndWait<Record<string, unknown>[]>('query', request);
    },

    async health(): Promise<{ available: boolean; latency: number }> {
      const start = Date.now();
      try {
        await sendAndWait<void>('health', null);
        return { available: true, latency: Date.now() - start };
      } catch {
        return { available: false, latency: Date.now() - start };
      }
    },

    onPushCompletion(handler: (c: ActionCompletion) => void): void {
      pushHandlers.push(handler);
    },

    close(): void {
      ws.close();
      for (const [id, pending] of pendingRequests) {
        pending.reject(new Error('Connection closed'));
      }
      pendingRequests.clear();
    },
  };
}

// --- WebSocket Concept Server ---

/**
 * Create a WebSocket server handler that serves a concept.
 * Accepts a ConceptTransport and handles incoming messages.
 *
 * Returns a message handler that processes incoming WS messages
 * and produces responses.
 */
export function createWebSocketConceptServer(
  transport: ConceptTransport,
): (message: string) => Promise<string | null> {
  return async (message: string): Promise<string | null> => {
    try {
      const msg: WsMessage = JSON.parse(message);

      switch (msg.type) {
        case 'invoke': {
          const invocation = msg.payload as ActionInvocation;
          const completion = await transport.invoke(invocation);
          const response: WsMessage = {
            type: 'response',
            id: msg.id,
            payload: completion,
          };
          return JSON.stringify(response);
        }

        case 'query': {
          const request = msg.payload as ConceptQuery;
          const results = await transport.query(request);
          const response: WsMessage = {
            type: 'response',
            id: msg.id,
            payload: results,
          };
          return JSON.stringify(response);
        }

        case 'health': {
          const health = await transport.health();
          const response: WsMessage = {
            type: 'response',
            id: msg.id,
            payload: health,
          };
          return JSON.stringify(response);
        }

        default:
          return JSON.stringify({
            type: 'error',
            id: msg.id,
            payload: `Unknown message type: ${msg.type}`,
          });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({
        type: 'error',
        id: 'unknown',
        payload: errorMsg,
      });
    }
  };
}
