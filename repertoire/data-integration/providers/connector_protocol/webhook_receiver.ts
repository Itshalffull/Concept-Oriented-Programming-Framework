// WebhookReceiver — connector_protocol provider
// Inbound webhook endpoint with HMAC-SHA256 signature validation, payload queuing, and retry acknowledgment

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

export const PROVIDER_ID = 'webhook_receiver';
export const PLUGIN_TYPE = 'connector_protocol';

interface QueuedPayload {
  id: string;
  receivedAt: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  verified: boolean;
  acknowledged: boolean;
  retryCount: number;
}

function generateId(): string {
  return `wh_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

function computeHmacSha256(secret: string, payload: string): string {
  const crypto = require('crypto');
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function verifySignature(
  payload: string,
  signature: string | null,
  secret: string,
  headerPrefix: string
): boolean {
  if (!signature || !secret) return !secret; // Skip verification if no secret configured
  const computed = computeHmacSha256(secret, payload);
  const expected = signature.startsWith(headerPrefix) ? signature.slice(headerPrefix.length) : signature;
  // Constant-time comparison
  if (computed.length !== expected.length) return false;
  let result = 0;
  for (let i = 0; i < computed.length; i++) {
    result |= computed.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return result === 0;
}

export class WebhookReceiverConnectorProvider {
  private queue: QueuedPayload[] = [];
  private maxQueueSize: number = 10000;
  private secret: string = '';
  private signatureHeader: string = 'x-hub-signature-256';
  private signaturePrefix: string = 'sha256=';

  configure(config: ConnectorConfig): void {
    this.secret = (config.auth?.secret as string) ?? '';
    this.signatureHeader = (config.options?.signatureHeader as string) ?? 'x-hub-signature-256';
    this.signaturePrefix = (config.options?.signaturePrefix as string) ?? 'sha256=';
    this.maxQueueSize = (config.options?.maxQueueSize as number) ?? 10000;
  }

  receiveWebhook(
    body: string,
    headers: Record<string, string>
  ): { accepted: boolean; id?: string; message: string } {
    const signature = headers[this.signatureHeader] ?? headers[this.signatureHeader.toLowerCase()] ?? null;
    const verified = verifySignature(body, signature, this.secret, this.signaturePrefix);

    if (this.secret && !verified) {
      return { accepted: false, message: 'Invalid signature' };
    }

    if (this.queue.length >= this.maxQueueSize) {
      const oldestUnacked = this.queue.findIndex(p => p.acknowledged);
      if (oldestUnacked >= 0) {
        this.queue.splice(0, oldestUnacked + 1);
      } else {
        this.queue.shift();
      }
    }

    let parsedBody: Record<string, unknown>;
    try { parsedBody = JSON.parse(body); } catch { parsedBody = { raw: body }; }

    const id = generateId();
    this.queue.push({
      id,
      receivedAt: new Date().toISOString(),
      headers,
      body: parsedBody,
      verified,
      acknowledged: false,
      retryCount: 0,
    });

    return { accepted: true, id, message: 'Payload queued' };
  }

  acknowledge(id: string): boolean {
    const payload = this.queue.find(p => p.id === id);
    if (payload) { payload.acknowledged = true; return true; }
    return false;
  }

  async *read(query: QuerySpec, config: ConnectorConfig): AsyncGenerator<Record<string, unknown>> {
    this.configure(config);
    const limit = query.limit ?? this.queue.length;
    const onlyUnacked = (config.options?.onlyUnacknowledged as boolean) ?? true;
    const sinceId = query.cursor ?? null;

    let startIdx = 0;
    if (sinceId) {
      const idx = this.queue.findIndex(p => p.id === sinceId);
      if (idx >= 0) startIdx = idx + 1;
    }

    let yielded = 0;
    for (let i = startIdx; i < this.queue.length && yielded < limit; i++) {
      const payload = this.queue[i];
      if (onlyUnacked && payload.acknowledged) continue;
      yield {
        id: payload.id,
        receivedAt: payload.receivedAt,
        headers: payload.headers,
        body: payload.body,
        verified: payload.verified,
        acknowledged: payload.acknowledged,
      };
      yielded++;
    }
  }

  async write(records: Record<string, unknown>[], config: ConnectorConfig): Promise<WriteResult> {
    // Write = acknowledge received webhooks by ID
    const result: WriteResult = { created: 0, updated: 0, skipped: 0, errors: 0 };
    for (const record of records) {
      const id = record.id as string | undefined;
      if (id && this.acknowledge(id)) {
        result.updated++;
      } else {
        result.skipped++;
      }
    }
    return result;
  }

  async test(config: ConnectorConfig): Promise<TestResult> {
    this.configure(config);
    const start = Date.now();
    return {
      connected: true,
      message: `Webhook receiver ready. Queue size: ${this.queue.length}/${this.maxQueueSize}. ` +
               `Signature verification: ${this.secret ? 'enabled' : 'disabled'}`,
      latencyMs: Date.now() - start,
    };
  }

  async discover(config: ConnectorConfig): Promise<DiscoveryResult> {
    this.configure(config);
    const streams: StreamDef[] = [{
      name: 'webhooks',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          receivedAt: { type: 'string', format: 'date-time' },
          headers: { type: 'object' },
          body: { type: 'object' },
          verified: { type: 'boolean' },
          acknowledged: { type: 'boolean' },
        },
      },
      supportedSyncModes: ['full_refresh', 'incremental'],
    }];

    // Discover payload schemas from queued data
    if (this.queue.length > 0) {
      const bodyKeys = new Set<string>();
      for (const p of this.queue.slice(-20)) {
        for (const key of Object.keys(p.body)) bodyKeys.add(key);
      }
      const bodyProps: Record<string, unknown> = {};
      for (const key of bodyKeys) bodyProps[key] = { type: 'unknown' };
      streams.push({
        name: 'webhook_payloads',
        schema: { type: 'object', properties: bodyProps },
        supportedSyncModes: ['full_refresh'],
      });
    }
    return { streams };
  }
}

export default WebhookReceiverConnectorProvider;
