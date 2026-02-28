// Data Integration Kit - API Poll Capture Provider
// Periodic API query with delta detection via hash, cursor, or timestamp strategies

export const PROVIDER_ID = 'api_poll';
export const PLUGIN_TYPE = 'capture_mode';

export interface CaptureInput {
  url?: string;
  file?: Buffer;
  email?: string;
  shareData?: unknown;
}

export interface CaptureConfig {
  mode: string;
  options?: Record<string, unknown>;
}

export interface SourceMetadata {
  title: string;
  url?: string;
  capturedAt: string;
  contentType: string;
  author?: string;
  tags?: string[];
  source?: string;
}

export interface CaptureItem {
  content: string;
  sourceMetadata: SourceMetadata;
  rawData?: unknown;
}

type DeltaStrategy = 'hash' | 'cursor' | 'timestamp';

interface PollConfig {
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  deltaStrategy: DeltaStrategy;
  timestampField?: string;
  cursorField?: string;
  itemsPath?: string;
  pollIntervalMs: number;
}

interface PollState {
  lastHash?: string;
  lastTimestamp?: string;
  lastCursor?: string;
  lastPollAt?: string;
}

// Simple hash for delta comparison using DJB2 algorithm
function computeHash(data: string): string {
  let hash = 5381;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) + hash + data.charCodeAt(i)) & 0xFFFFFFFF;
  }
  return hash.toString(16);
}

function parsePollConfig(input: CaptureInput, config: CaptureConfig): PollConfig {
  const opts = config.options || {};
  return {
    endpoint: input.url || (opts.endpoint as string) || '',
    method: ((opts.method as string) || 'GET').toUpperCase(),
    headers: (opts.headers as Record<string, string>) || { 'Accept': 'application/json' },
    body: opts.body as string | undefined,
    deltaStrategy: (opts.deltaStrategy as DeltaStrategy) || 'hash',
    timestampField: opts.timestampField as string | undefined,
    cursorField: opts.cursorField as string | undefined,
    itemsPath: opts.itemsPath as string | undefined,
    pollIntervalMs: (opts.pollIntervalMs as number) || 60000,
  };
}

function extractJsonPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function detectChangesHash(responseBody: string, previousHash?: string): { changed: boolean; newHash: string } {
  const newHash = computeHash(responseBody);
  return {
    changed: previousHash !== undefined ? newHash !== previousHash : true,
    newHash,
  };
}

function detectChangesTimestamp(
  data: unknown,
  itemsPath: string | undefined,
  timestampField: string,
  lastTimestamp?: string
): { changed: boolean; newItems: unknown[]; latestTimestamp: string | undefined } {
  const items = itemsPath ? extractJsonPath(data, itemsPath) : data;
  if (!Array.isArray(items)) return { changed: true, newItems: [data], latestTimestamp: undefined };

  let latestTimestamp: string | undefined;
  const newItems: unknown[] = [];

  for (const item of items) {
    const ts = extractJsonPath(item, timestampField) as string | undefined;
    if (!ts) continue;
    if (!lastTimestamp || ts > lastTimestamp) {
      newItems.push(item);
    }
    if (!latestTimestamp || ts > latestTimestamp) {
      latestTimestamp = ts;
    }
  }

  return {
    changed: newItems.length > 0,
    newItems,
    latestTimestamp,
  };
}

function detectChangesCursor(
  data: unknown,
  cursorField: string,
  itemsPath: string | undefined
): { items: unknown[]; nextCursor: string | undefined } {
  const items = itemsPath ? extractJsonPath(data, itemsPath) : data;
  const nextCursor = extractJsonPath(data, cursorField) as string | undefined;

  return {
    items: Array.isArray(items) ? items : [data],
    nextCursor,
  };
}

// In-memory state store (in production, this would be persistent storage)
const pollStateStore = new Map<string, PollState>();

export class ApiPollCaptureProvider {
  async capture(input: CaptureInput, config: CaptureConfig): Promise<CaptureItem> {
    const pollConfig = parsePollConfig(input, config);
    if (!pollConfig.endpoint) throw new Error('api_poll capture requires an endpoint URL');

    const stateKey = computeHash(pollConfig.endpoint + pollConfig.method);
    const previousState = pollStateStore.get(stateKey) || {};

    // Build request with cursor if applicable
    let requestUrl = pollConfig.endpoint;
    if (pollConfig.deltaStrategy === 'cursor' && previousState.lastCursor) {
      const separator = requestUrl.includes('?') ? '&' : '?';
      requestUrl = `${requestUrl}${separator}cursor=${encodeURIComponent(previousState.lastCursor)}`;
    }
    if (pollConfig.deltaStrategy === 'timestamp' && previousState.lastTimestamp) {
      const separator = requestUrl.includes('?') ? '&' : '?';
      requestUrl = `${requestUrl}${separator}since=${encodeURIComponent(previousState.lastTimestamp)}`;
    }

    const fetchOptions: RequestInit = {
      method: pollConfig.method,
      headers: pollConfig.headers,
    };
    if (pollConfig.body && pollConfig.method !== 'GET') {
      fetchOptions.body = pollConfig.body;
    }

    const response = await fetch(requestUrl, fetchOptions);
    const responseBody = await response.text();
    const now = new Date().toISOString();

    let parsedData: unknown;
    try { parsedData = JSON.parse(responseBody); } catch { parsedData = responseBody; }

    let changed = false;
    let capturedItems: unknown[] = [];
    const newState: PollState = { lastPollAt: now };

    switch (pollConfig.deltaStrategy) {
      case 'hash': {
        const result = detectChangesHash(responseBody, previousState.lastHash);
        changed = result.changed;
        newState.lastHash = result.newHash;
        if (changed) capturedItems = [parsedData];
        break;
      }
      case 'timestamp': {
        const result = detectChangesTimestamp(
          parsedData, pollConfig.itemsPath,
          pollConfig.timestampField || 'updated_at',
          previousState.lastTimestamp
        );
        changed = result.changed;
        capturedItems = result.newItems;
        newState.lastTimestamp = result.latestTimestamp || previousState.lastTimestamp;
        break;
      }
      case 'cursor': {
        const result = detectChangesCursor(
          parsedData,
          pollConfig.cursorField || 'next_cursor',
          pollConfig.itemsPath
        );
        changed = result.items.length > 0;
        capturedItems = result.items;
        newState.lastCursor = result.nextCursor;
        break;
      }
    }

    pollStateStore.set(stateKey, newState);

    const content = changed
      ? JSON.stringify(capturedItems, null, 2)
      : '(no changes detected)';

    return {
      content,
      sourceMetadata: {
        title: `API Poll: ${new URL(pollConfig.endpoint).hostname}`,
        url: pollConfig.endpoint,
        capturedAt: now,
        contentType: 'application/json',
        tags: [
          'api-poll',
          pollConfig.deltaStrategy,
          changed ? 'changed' : 'unchanged',
          `items:${capturedItems.length}`,
        ],
        source: 'api_poll',
      },
      rawData: config.options?.includeState ? {
        previousState,
        newState,
        responseStatus: response.status,
      } : undefined,
    };
  }

  supports(input: CaptureInput): boolean {
    if (input.url) {
      try {
        const parsed = new URL(input.url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch { return false; }
    }
    return false;
  }
}

export default ApiPollCaptureProvider;
