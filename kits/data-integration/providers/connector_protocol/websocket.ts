// WebSocket — connector_protocol provider
// WebSocket streaming with persistent connections, JSON/binary framing, auto-reconnect with backoff, and message buffering

export interface ConnectorConfig {
  baseUrl?: string;
  connectionString?: string;
  auth?: Record<string, unknown>;
  headers?: Record<string, string>;
  options?: Record<string, unknown>;
}

export interface QuerySpec {
  path?: string;
  query?: string;
  params?: Record<string, unknown>;
  cursor?: string;
  limit?: number;
}

export interface WriteResult { created: number; updated: number; skipped: number; errors: number; }
export interface TestResult { connected: boolean; message: string; latencyMs?: number; }
export interface StreamDef { name: string; schema: Record<string, unknown>; supportedSyncModes: string[]; }
export interface DiscoveryResult { streams: StreamDef[]; }

export const PROVIDER_ID = 'websocket';
export const PLUGIN_TYPE = 'connector_protocol';

interface WsConfig {
  url: string;
  protocols: string[];
  maxReconnectAttempts: number;
  reconnectBaseDelay: number;
  maxReconnectDelay: number;
  heartbeatInterval: number;
  heartbeatMessage: string;
  bufferSize: number;
  messageFormat: 'json' | 'binary' | 'text';
  subscribeMessage: Record<string, unknown> | null;
}

interface BufferedMessage {
  id: string;
  timestamp: string;
  data: Record<string, unknown>;
  raw?: string;
}

function parseWsConfig(config: ConnectorConfig): WsConfig {
  const opts = config.options ?? {};
  let url = config.baseUrl ?? '';
  if (url.startsWith('http://')) url = url.replace('http://', 'ws://');
  if (url.startsWith('https://')) url = url.replace('https://', 'wss://');
  if (!url.startsWith('ws://') && !url.startsWith('wss://')) url = `wss://${url}`;

  return {
    url,
    protocols: (opts.protocols as string[]) ?? [],
    maxReconnectAttempts: (opts.maxReconnectAttempts as number) ?? 10,
    reconnectBaseDelay: (opts.reconnectBaseDelay as number) ?? 1000,
    maxReconnectDelay: (opts.maxReconnectDelay as number) ?? 30000,
    heartbeatInterval: (opts.heartbeatInterval as number) ?? 30000,
    heartbeatMessage: (opts.heartbeatMessage as string) ?? '{"type":"ping"}',
    bufferSize: (opts.bufferSize as number) ?? 10000,
    messageFormat: (opts.messageFormat as 'json' | 'binary' | 'text') ?? 'json',
    subscribeMessage: (opts.subscribeMessage as Record<string, unknown>) ?? null,
  };
}

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export class WebsocketConnectorProvider {
  private ws: WebSocket | null = null;
  private buffer: BufferedMessage[] = [];
  private wsConfig: WsConfig | null = null;
  private reconnectAttempts = 0;
  private isConnected = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  private parseMessage(data: string | ArrayBuffer): Record<string, unknown> | null {
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch { return { raw: data }; }
    }
    if (data instanceof ArrayBuffer) {
      const decoder = new TextDecoder();
      const text = decoder.decode(data);
      try { return JSON.parse(text); } catch { return { raw: text, binary: true }; }
    }
    return null;
  }

  private bufferMessage(data: Record<string, unknown>): void {
    if (!this.wsConfig) return;
    if (this.buffer.length >= this.wsConfig.bufferSize) {
      this.buffer.shift();
    }
    this.buffer.push({
      id: generateMessageId(),
      timestamp: new Date().toISOString(),
      data,
    });
  }

  private async connectWs(config: WsConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(config.url, config.protocols);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;

          if (config.subscribeMessage) {
            this.ws?.send(JSON.stringify(config.subscribeMessage));
          }

          if (config.heartbeatInterval > 0) {
            this.heartbeatTimer = setInterval(() => {
              if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(config.heartbeatMessage);
              }
            }, config.heartbeatInterval);
          }
          resolve();
        };

        this.ws.onmessage = (event) => {
          const parsed = this.parseMessage(event.data);
          if (parsed) this.bufferMessage(parsed);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
          this.scheduleReconnect(config);
        };

        this.ws.onerror = (err) => {
          if (!this.isConnected) reject(err);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private scheduleReconnect(config: WsConfig): void {
    if (this.reconnectAttempts >= config.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    const delay = Math.min(
      config.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts - 1),
      config.maxReconnectDelay
    );
    setTimeout(() => this.connectWs(config).catch(() => {}), delay);
  }

  async *read(query: QuerySpec, config: ConnectorConfig): AsyncGenerator<Record<string, unknown>> {
    this.wsConfig = parseWsConfig(config);
    const limit = query.limit ?? Infinity;
    const sinceId = query.cursor;

    if (!this.isConnected) {
      await this.connectWs(this.wsConfig);
    }

    // Yield buffered messages
    let startIdx = 0;
    if (sinceId) {
      const idx = this.buffer.findIndex(m => m.id === sinceId);
      if (idx >= 0) startIdx = idx + 1;
    }

    let yielded = 0;
    for (let i = startIdx; i < this.buffer.length && yielded < limit; i++) {
      const msg = this.buffer[i];
      yield {
        id: msg.id,
        timestamp: msg.timestamp,
        ...msg.data,
      };
      yielded++;
    }

    // If we need more, wait for new messages
    if (yielded < limit && this.ws) {
      const remaining = limit === Infinity ? 100 : limit - yielded;
      let newMessages = 0;
      const waitForMessages = (): Promise<void> => {
        return new Promise(resolve => {
          const handler = (event: MessageEvent) => {
            const parsed = this.parseMessage(event.data);
            if (parsed) {
              this.bufferMessage(parsed);
              newMessages++;
              if (newMessages >= remaining) {
                this.ws?.removeEventListener('message', handler);
                resolve();
              }
            }
          };
          this.ws?.addEventListener('message', handler);
          setTimeout(() => {
            this.ws?.removeEventListener('message', handler);
            resolve();
          }, (config.options?.readTimeout as number) ?? 5000);
        });
      };

      await waitForMessages();
      const newBuffered = this.buffer.slice(-newMessages);
      for (const msg of newBuffered) {
        yield { id: msg.id, timestamp: msg.timestamp, ...msg.data };
      }
    }
  }

  async write(records: Record<string, unknown>[], config: ConnectorConfig): Promise<WriteResult> {
    if (!this.wsConfig) this.wsConfig = parseWsConfig(config);
    if (!this.isConnected) {
      await this.connectWs(this.wsConfig);
    }
    const result: WriteResult = { created: 0, updated: 0, skipped: 0, errors: 0 };
    for (const record of records) {
      try {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(record));
          result.created++;
        } else {
          result.errors++;
        }
      } catch {
        result.errors++;
      }
    }
    return result;
  }

  async test(config: ConnectorConfig): Promise<TestResult> {
    const wsConfig = parseWsConfig(config);
    const start = Date.now();
    try {
      await this.connectWs(wsConfig);
      const latency = Date.now() - start;
      return { connected: true, message: `Connected to ${wsConfig.url}`, latencyMs: latency };
    } catch (err) {
      return { connected: false, message: String(err), latencyMs: Date.now() - start };
    }
  }

  async discover(config: ConnectorConfig): Promise<DiscoveryResult> {
    const wsConfig = parseWsConfig(config);
    return {
      streams: [{
        name: wsConfig.url,
        schema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            data: { type: 'object' },
          },
        },
        supportedSyncModes: ['incremental'],
      }],
    };
  }

  disconnect(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.reconnectAttempts = this.wsConfig?.maxReconnectAttempts ?? 999;
    this.ws?.close();
    this.ws = null;
    this.isConnected = false;
  }
}

export default WebsocketConnectorProvider;
