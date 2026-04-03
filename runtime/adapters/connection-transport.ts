// ============================================================
// Clef Connection — Transport Adapter Interface & WebSocket Impl
//
// Section 6.4: Transport Layer
//   TransportAdapter — client-side interface for Connection concept.
//   Abstracts wire protocol so Connection works identically over
//   WebSocket, HTTP, IPC, or in-process transports.
//
// WebSocketTransportAdapter — primary adapter. Bidirectional,
//   supports observe/streaming natively. Used by CLI, MCP, and
//   browser clients.
// ============================================================

// --- Transport Adapter Interface ---

/**
 * Session returned by a successful connect(). Opaque to callers —
 * each adapter stores whatever state it needs internally.
 */
export interface TransportSession {
  /** Unique session identifier assigned by the kernel. */
  readonly sessionId: string;
  /** Kernel endpoint this session is connected to. */
  readonly endpoint: string;
  /** Concept names registered on the connected kernel. */
  readonly registeredConcepts: string[];
  /** True while the session is active. */
  readonly connected: boolean;
}

/**
 * A completion event emitted from an observe stream.
 */
export interface CompletionEvent {
  readonly variant: string;
  readonly output: string;
}

/**
 * Transport adapter interface for the Connection concept.
 * Both WebSocket and HTTP adapters implement this contract.
 *
 * Lifecycle: connect → invoke/observe → disconnect.
 */
export interface TransportAdapter {
  /**
   * Open a connection to a kernel endpoint, perform handshake,
   * and discover registered concepts.
   *
   * @param endpoint - Kernel address (e.g., ws://localhost:3000/kernel)
   * @param credentials - Optional auth token or API key
   * @returns A TransportSession on success
   * @throws TransportError on connection failure or auth rejection
   */
  connect(endpoint: string, credentials?: string): Promise<TransportSession>;

  /**
   * Invoke a concept action and wait for the completion.
   *
   * @param session - Active session from connect()
   * @param concept - Concept name (e.g., "Task")
   * @param action - Action name (e.g., "create")
   * @param input - JSON-serialized action input
   * @returns Completion variant and JSON-serialized output
   * @throws TransportError if session is disconnected or request fails
   */
  invoke(
    session: TransportSession,
    concept: string,
    action: string,
    input: string,
  ): Promise<{ variant: string; output: string }>;

  /**
   * Subscribe to a completion stream for a concept, optionally
   * filtered to a specific action. Returns an async iterable that
   * yields completion events until the session disconnects or
   * the caller breaks out of the loop.
   *
   * @param session - Active session from connect()
   * @param concept - Concept to observe
   * @param action - Optional action filter; omit for all actions
   * @returns Async iterable of completion events
   */
  observe(
    session: TransportSession,
    concept: string,
    action?: string,
  ): AsyncIterable<CompletionEvent>;

  /**
   * Close the connection cleanly, releasing all resources.
   * After disconnect, the session is no longer usable.
   *
   * @param session - Active session to close
   */
  disconnect(session: TransportSession): Promise<void>;
}

// --- Transport Errors ---

export type TransportErrorCode =
  | 'CONNECTION_FAILED'
  | 'HANDSHAKE_FAILED'
  | 'UNAUTHORIZED'
  | 'TIMEOUT'
  | 'DISCONNECTED'
  | 'SEND_FAILED'
  | 'INVALID_RESPONSE';

export class TransportError extends Error {
  constructor(
    public readonly code: TransportErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

// --- WebSocket Transport Message Protocol ---

/**
 * Messages exchanged over the WebSocket connection between
 * a client (TransportAdapter) and a kernel server.
 */
interface WsTransportMessage {
  type:
    | 'handshake'
    | 'handshake_ack'
    | 'invoke'
    | 'invoke_result'
    | 'observe'
    | 'observe_event'
    | 'observe_end'
    | 'disconnect'
    | 'error';
  id: string;
  payload: unknown;
}

interface HandshakePayload {
  credentials?: string;
}

interface HandshakeAckPayload {
  sessionId: string;
  registeredConcepts: string[];
}

interface InvokePayload {
  concept: string;
  action: string;
  input: string;
}

interface InvokeResultPayload {
  variant: string;
  output: string;
}

interface ObservePayload {
  concept: string;
  action?: string;
}

interface ObserveEventPayload {
  subscriptionId: string;
  variant: string;
  output: string;
}

// --- WebSocket Abstraction ---

/**
 * Minimal WebSocket interface that works with both browser WebSocket
 * and Node.js ws library, plus mock implementations for testing.
 */
export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(event: 'open', handler: () => void): void;
  addEventListener(event: 'message', handler: (ev: { data: string }) => void): void;
  addEventListener(event: 'close', handler: (ev: { code: number; reason: string }) => void): void;
  addEventListener(event: 'error', handler: (ev: unknown) => void): void;
  removeEventListener(event: string, handler: (...args: unknown[]) => void): void;
}

/** WebSocket readyState constants. */
// WS_CONNECTING = 0, WS_CLOSING = 2, WS_CLOSED = 3 — unused but documented for reference.
const WS_OPEN = 1;

/**
 * Factory function that creates a WebSocketLike from a URL.
 * In browsers, pass `(url) => new WebSocket(url)`.
 * In Node.js, pass `(url) => new (require('ws'))(url)`.
 * In tests, pass a mock factory.
 */
export type WebSocketLikeFactory = (url: string) => WebSocketLike;

// --- WebSocket Transport Adapter Configuration ---

export interface WebSocketTransportOptions {
  /**
   * Factory for creating WebSocket connections.
   * Required — allows adapter to work in any environment.
   */
  wsFactory: WebSocketLikeFactory;

  /**
   * Timeout for connect handshake in milliseconds. Default: 10000.
   */
  connectTimeoutMs?: number;

  /**
   * Timeout for invoke requests in milliseconds. Default: 30000.
   */
  invokeTimeoutMs?: number;

  /**
   * Whether to attempt automatic reconnection on unexpected
   * disconnects. Default: true.
   */
  autoReconnect?: boolean;

  /**
   * Maximum number of reconnection attempts. Default: 5.
   */
  maxReconnectAttempts?: number;

  /**
   * Base delay between reconnection attempts in milliseconds.
   * Uses exponential backoff: delay * 2^attempt. Default: 1000.
   */
  reconnectBaseDelayMs?: number;
}

// --- Internal Session State ---

interface InternalSession {
  sessionId: string;
  endpoint: string;
  credentials?: string;
  registeredConcepts: string[];
  connected: boolean;
  ws: WebSocketLike;
  pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>;
  observeSubscriptions: Map<string, {
    concept: string;
    action?: string;
    push: (event: CompletionEvent) => void;
    end: () => void;
  }>;
  messageCounter: number;
  reconnectAttempts: number;
}

// --- WebSocket Transport Adapter ---

/**
 * Create a WebSocket transport adapter for the Connection concept.
 *
 * Bidirectional, supports observe/streaming natively. Primary adapter
 * for CLI, MCP, and browser clients.
 */
export function createWebSocketTransportAdapter(
  options: WebSocketTransportOptions,
): TransportAdapter {
  const {
    wsFactory,
    connectTimeoutMs = 10_000,
    invokeTimeoutMs = 30_000,
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectBaseDelayMs = 1_000,
  } = options;

  // Track all active sessions for cleanup
  const sessions = new Map<string, InternalSession>();

  function nextId(session: InternalSession): string {
    return `msg-${++session.messageCounter}`;
  }

  function sendMessage(session: InternalSession, msg: WsTransportMessage): void {
    if (session.ws.readyState !== WS_OPEN) {
      throw new TransportError('DISCONNECTED', 'WebSocket is not open');
    }
    session.ws.send(JSON.stringify(msg));
  }

  function handleMessage(session: InternalSession, data: string): void {
    let msg: WsTransportMessage;
    try {
      msg = JSON.parse(data);
    } catch {
      // Ignore malformed messages
      return;
    }

    // Route invoke results to pending request
    if (msg.type === 'invoke_result' || msg.type === 'error' || msg.type === 'handshake_ack') {
      const pending = session.pendingRequests.get(msg.id);
      if (pending) {
        session.pendingRequests.delete(msg.id);
        clearTimeout(pending.timer);
        if (msg.type === 'error') {
          const errorMsg = typeof msg.payload === 'string'
            ? msg.payload
            : JSON.stringify(msg.payload);
          pending.reject(new TransportError('INVALID_RESPONSE', errorMsg));
        } else {
          pending.resolve(msg.payload);
        }
      }
      return;
    }

    // Route observe events to subscription handlers
    if (msg.type === 'observe_event') {
      const event = msg.payload as ObserveEventPayload;
      const sub = session.observeSubscriptions.get(event.subscriptionId);
      if (sub) {
        sub.push({ variant: event.variant, output: event.output });
      }
      return;
    }

    // Observe stream ended by server
    if (msg.type === 'observe_end') {
      const subId = (msg.payload as { subscriptionId: string }).subscriptionId;
      const sub = session.observeSubscriptions.get(subId);
      if (sub) {
        session.observeSubscriptions.delete(subId);
        sub.end();
      }
      return;
    }
  }

  function handleClose(session: InternalSession, code: number, _reason: string): void {
    session.connected = false;

    // Reject all pending requests
    for (const [, pending] of session.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new TransportError('DISCONNECTED', `Connection closed (code ${code})`));
    }
    session.pendingRequests.clear();

    // End all observe subscriptions
    for (const [, sub] of session.observeSubscriptions) {
      sub.end();
    }
    session.observeSubscriptions.clear();

    // Attempt reconnection if this was unexpected
    if (autoReconnect && code !== 1000 && session.reconnectAttempts < maxReconnectAttempts) {
      attemptReconnect(session);
    }
  }

  async function attemptReconnect(session: InternalSession): Promise<void> {
    session.reconnectAttempts++;
    const delay = reconnectBaseDelayMs * Math.pow(2, session.reconnectAttempts - 1);

    await new Promise(resolve => setTimeout(resolve, delay));

    // Don't reconnect if session was explicitly disconnected
    if (sessions.get(session.sessionId) !== session) {
      return;
    }

    try {
      const ws = wsFactory(session.endpoint);
      session.ws = ws;

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new TransportError('TIMEOUT', 'Reconnection timed out'));
        }, connectTimeoutMs);

        ws.addEventListener('open', () => {
          clearTimeout(timer);
          resolve();
        });

        ws.addEventListener('error', (ev) => {
          clearTimeout(timer);
          reject(new TransportError('CONNECTION_FAILED', 'Reconnection failed', ev));
        });
      });

      // Re-authenticate with the same credentials
      setupWsHandlers(session);

      const ack = await sendAndWait<HandshakeAckPayload>(
        session,
        'handshake',
        { credentials: session.credentials } satisfies HandshakePayload,
        connectTimeoutMs,
      );

      session.sessionId = ack.sessionId;
      session.registeredConcepts = ack.registeredConcepts;
      session.connected = true;
      session.reconnectAttempts = 0;

      // Update session map with new sessionId
      sessions.set(session.sessionId, session);
    } catch {
      // If reconnection fails, try again if we have attempts left
      if (session.reconnectAttempts < maxReconnectAttempts) {
        attemptReconnect(session);
      }
    }
  }

  function setupWsHandlers(session: InternalSession): void {
    session.ws.addEventListener('message', (ev: { data: string }) => {
      handleMessage(session, typeof ev.data === 'string' ? ev.data : String(ev.data));
    });

    session.ws.addEventListener('close', (ev: { code: number; reason: string }) => {
      handleClose(session, ev.code, ev.reason);
    });

    session.ws.addEventListener('error', () => {
      // Error events are typically followed by close events.
      // Connection-time errors are handled in connect().
    });
  }

  function sendAndWait<T>(
    session: InternalSession,
    type: WsTransportMessage['type'],
    payload: unknown,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = nextId(session);

      const timer = setTimeout(() => {
        session.pendingRequests.delete(id);
        reject(new TransportError('TIMEOUT', `Request ${type} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      session.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });

      try {
        sendMessage(session, { type, id, payload });
      } catch (err) {
        session.pendingRequests.delete(id);
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  // --- Adapter Implementation ---

  return {
    async connect(endpoint: string, credentials?: string): Promise<TransportSession> {
      let ws: WebSocketLike;

      try {
        ws = wsFactory(endpoint);
      } catch (err) {
        throw new TransportError(
          'CONNECTION_FAILED',
          `Failed to create WebSocket connection to ${endpoint}`,
          err,
        );
      }

      // Wait for WebSocket to open
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          ws.close();
          reject(new TransportError('TIMEOUT', `Connection to ${endpoint} timed out`));
        }, connectTimeoutMs);

        ws.addEventListener('open', () => {
          clearTimeout(timer);
          resolve();
        });

        ws.addEventListener('error', (ev) => {
          clearTimeout(timer);
          reject(new TransportError(
            'CONNECTION_FAILED',
            `WebSocket connection to ${endpoint} failed`,
            ev,
          ));
        });
      });

      // Create internal session
      const session: InternalSession = {
        sessionId: '', // will be set by handshake ack
        endpoint,
        credentials,
        registeredConcepts: [],
        connected: false,
        ws,
        pendingRequests: new Map(),
        observeSubscriptions: new Map(),
        messageCounter: 0,
        reconnectAttempts: 0,
      };

      setupWsHandlers(session);

      // Perform handshake
      let ack: HandshakeAckPayload;
      try {
        ack = await sendAndWait<HandshakeAckPayload>(
          session,
          'handshake',
          { credentials } satisfies HandshakePayload,
          connectTimeoutMs,
        );
      } catch (err) {
        ws.close();
        if (err instanceof TransportError) throw err;
        throw new TransportError('HANDSHAKE_FAILED', 'Handshake failed', err);
      }

      session.sessionId = ack.sessionId;
      session.registeredConcepts = ack.registeredConcepts;
      session.connected = true;

      sessions.set(session.sessionId, session);

      return {
        sessionId: ack.sessionId,
        endpoint,
        registeredConcepts: ack.registeredConcepts,
        connected: true,
      };
    },

    async invoke(
      transportSession: TransportSession,
      concept: string,
      action: string,
      input: string,
    ): Promise<{ variant: string; output: string }> {
      const session = sessions.get(transportSession.sessionId);
      if (!session || !session.connected) {
        throw new TransportError(
          'DISCONNECTED',
          'Session is not connected',
        );
      }

      const payload: InvokePayload = { concept, action, input };

      const result = await sendAndWait<InvokeResultPayload>(
        session,
        'invoke',
        payload,
        invokeTimeoutMs,
      );

      return { variant: result.variant, output: result.output };
    },

    observe(
      transportSession: TransportSession,
      concept: string,
      action?: string,
    ): AsyncIterable<CompletionEvent> {
      const session = sessions.get(transportSession.sessionId);
      if (!session || !session.connected) {
        throw new TransportError(
          'DISCONNECTED',
          'Session is not connected',
        );
      }

      const subscriptionId = nextId(session);

      // Create a push-based async iterable using a buffered queue
      const buffer: CompletionEvent[] = [];
      let waiting: ((value: IteratorResult<CompletionEvent>) => void) | null = null;
      let ended = false;

      session.observeSubscriptions.set(subscriptionId, {
        concept,
        action,
        push(event: CompletionEvent) {
          if (waiting) {
            const resolve = waiting;
            waiting = null;
            resolve({ value: event, done: false });
          } else {
            buffer.push(event);
          }
        },
        end() {
          ended = true;
          if (waiting) {
            const resolve = waiting;
            waiting = null;
            resolve({ value: undefined as unknown as CompletionEvent, done: true });
          }
        },
      });

      // Send the observe request to the server
      const observePayload: ObservePayload = { concept, action };
      try {
        sendMessage(session, {
          type: 'observe',
          id: subscriptionId,
          payload: observePayload,
        });
      } catch (err) {
        session.observeSubscriptions.delete(subscriptionId);
        throw err;
      }

      return {
        [Symbol.asyncIterator](): AsyncIterator<CompletionEvent> {
          return {
            next(): Promise<IteratorResult<CompletionEvent>> {
              // Drain buffer first
              if (buffer.length > 0) {
                return Promise.resolve({ value: buffer.shift()!, done: false });
              }
              // Stream has ended
              if (ended) {
                return Promise.resolve({ value: undefined as unknown as CompletionEvent, done: true });
              }
              // Wait for next event
              return new Promise(resolve => {
                waiting = resolve;
              });
            },
            return(): Promise<IteratorResult<CompletionEvent>> {
              // Clean up subscription when caller breaks out of for-await
              session.observeSubscriptions.delete(subscriptionId);
              ended = true;
              return Promise.resolve({ value: undefined as unknown as CompletionEvent, done: true });
            },
          };
        },
      };
    },

    async disconnect(transportSession: TransportSession): Promise<void> {
      const session = sessions.get(transportSession.sessionId);
      if (!session) {
        return; // Already disconnected
      }

      sessions.delete(session.sessionId);

      // Send disconnect message if still connected
      if (session.connected && session.ws.readyState === WS_OPEN) {
        try {
          sendMessage(session, {
            type: 'disconnect',
            id: nextId(session),
            payload: null,
          });
        } catch {
          // Best-effort disconnect notification
        }
      }

      session.connected = false;

      // Clean up pending requests
      for (const [, pending] of session.pendingRequests) {
        clearTimeout(pending.timer);
        pending.reject(new TransportError('DISCONNECTED', 'Session disconnected'));
      }
      session.pendingRequests.clear();

      // End observe subscriptions
      for (const [, sub] of session.observeSubscriptions) {
        sub.end();
      }
      session.observeSubscriptions.clear();

      // Close WebSocket cleanly (1000 = normal closure)
      session.ws.close(1000, 'Client disconnect');
    },
  };
}
