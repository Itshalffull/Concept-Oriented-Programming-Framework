// REST — connector_protocol provider
// Generic REST API connector with pagination, auth, rate limiting, and retry logic

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

export const PROVIDER_ID = 'rest';
export const PLUGIN_TYPE = 'connector_protocol';

type PaginationStyle = 'cursor' | 'offset' | 'page' | 'link';
type AuthStyle = 'bearer' | 'api_key' | 'oauth2' | 'basic';

interface AuthConfig {
  style: AuthStyle;
  token?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  clientId?: string;
  clientSecret?: string;
  tokenUrl?: string;
  username?: string;
  password?: string;
}

function buildAuthHeaders(auth: AuthConfig): Record<string, string> {
  switch (auth.style) {
    case 'bearer':
      return { Authorization: `Bearer ${auth.token}` };
    case 'api_key':
      return { [auth.apiKeyHeader ?? 'X-API-Key']: auth.apiKey ?? '' };
    case 'basic': {
      const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
      return { Authorization: `Basic ${encoded}` };
    }
    case 'oauth2':
      return { Authorization: `Bearer ${auth.token}` };
    default:
      return {};
  }
}

async function refreshOAuth2Token(auth: AuthConfig): Promise<string> {
  if (!auth.tokenUrl || !auth.clientId || !auth.clientSecret) {
    throw new Error('OAuth2 requires tokenUrl, clientId, and clientSecret');
  }
  const resp = await fetch(auth.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: auth.clientId,
      client_secret: auth.clientSecret,
    }),
  });
  if (!resp.ok) throw new Error(`OAuth2 token refresh failed: ${resp.status}`);
  const data = await resp.json();
  return data.access_token;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, init);
      if (resp.status === 429 || resp.status >= 500) {
        const retryAfter = resp.headers.get('Retry-After');
        const delayMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(1000 * Math.pow(2, attempt), 30000);
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      return resp;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError ?? new Error('Request failed after retries');
}

export class RestConnectorProvider {
  private cachedToken: string | null = null;

  private async getHeaders(config: ConnectorConfig): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...config.headers };
    if (config.auth) {
      const auth = config.auth as unknown as AuthConfig;
      if (auth.style === 'oauth2' && !this.cachedToken) {
        this.cachedToken = await refreshOAuth2Token(auth);
        auth.token = this.cachedToken;
      }
      Object.assign(headers, buildAuthHeaders(auth));
    }
    return headers;
  }

  async *read(query: QuerySpec, config: ConnectorConfig): AsyncGenerator<Record<string, unknown>> {
    const baseUrl = config.baseUrl?.replace(/\/$/, '') ?? '';
    const path = query.path ?? '/';
    const paginationStyle: PaginationStyle = (config.options?.pagination as PaginationStyle) ?? 'offset';
    const pageSize = query.limit ?? 100;
    const dataKey = (config.options?.dataKey as string) ?? 'data';
    const headers = await this.getHeaders(config);

    let cursor = query.cursor;
    let offset = 0;
    let page = 1;
    let nextLink: string | null = null;
    let hasMore = true;

    while (hasMore) {
      let url: string;
      if (nextLink) {
        url = nextLink;
      } else {
        const params = new URLSearchParams();
        if (query.params) {
          for (const [k, v] of Object.entries(query.params)) params.set(k, String(v));
        }
        params.set('limit', String(pageSize));
        if (paginationStyle === 'cursor' && cursor) params.set('cursor', cursor);
        if (paginationStyle === 'offset') params.set('offset', String(offset));
        if (paginationStyle === 'page') params.set('page', String(page));
        url = `${baseUrl}${path}?${params.toString()}`;
      }

      const resp = await fetchWithRetry(url, { method: 'GET', headers });
      if (!resp.ok) throw new Error(`REST read failed: ${resp.status} ${resp.statusText}`);
      const body = await resp.json();

      const records: Record<string, unknown>[] = Array.isArray(body)
        ? body
        : (body[dataKey] ?? []);

      for (const record of records) {
        yield record;
      }

      if (records.length < pageSize) {
        hasMore = false;
      } else if (paginationStyle === 'cursor') {
        cursor = body.next_cursor ?? body.cursor ?? body.nextCursor;
        hasMore = !!cursor;
      } else if (paginationStyle === 'offset') {
        offset += records.length;
      } else if (paginationStyle === 'page') {
        page++;
      } else if (paginationStyle === 'link') {
        nextLink = body.links?.next ?? null;
        hasMore = !!nextLink;
      }
    }
  }

  async write(records: Record<string, unknown>[], config: ConnectorConfig): Promise<WriteResult> {
    const baseUrl = config.baseUrl?.replace(/\/$/, '') ?? '';
    const writePath = (config.options?.writePath as string) ?? '/';
    const batchSize = (config.options?.batchSize as number) ?? 50;
    const method = (config.options?.writeMethod as string) ?? 'POST';
    const headers = await this.getHeaders(config);
    const result: WriteResult = { created: 0, updated: 0, skipped: 0, errors: 0 };

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      try {
        const resp = await fetchWithRetry(`${baseUrl}${writePath}`, {
          method,
          headers,
          body: JSON.stringify(batch),
        });
        if (resp.ok) {
          const body = await resp.json();
          result.created += body.created ?? batch.length;
          result.updated += body.updated ?? 0;
          result.skipped += body.skipped ?? 0;
        } else {
          result.errors += batch.length;
        }
      } catch {
        result.errors += batch.length;
      }
    }
    return result;
  }

  async test(config: ConnectorConfig): Promise<TestResult> {
    const baseUrl = config.baseUrl?.replace(/\/$/, '') ?? '';
    const healthPath = (config.options?.healthPath as string) ?? '/';
    const headers = await this.getHeaders(config);
    const start = Date.now();
    try {
      const resp = await fetchWithRetry(`${baseUrl}${healthPath}`, { method: 'GET', headers }, 1);
      return {
        connected: resp.ok,
        message: resp.ok ? 'Connected successfully' : `HTTP ${resp.status}`,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return { connected: false, message: String(err), latencyMs: Date.now() - start };
    }
  }

  async discover(config: ConnectorConfig): Promise<DiscoveryResult> {
    const baseUrl = config.baseUrl?.replace(/\/$/, '') ?? '';
    const discoveryPath = (config.options?.discoveryPath as string) ?? '/';
    const headers = await this.getHeaders(config);
    try {
      const resp = await fetchWithRetry(`${baseUrl}${discoveryPath}`, { method: 'GET', headers }, 1);
      if (!resp.ok) return { streams: [] };
      const body = await resp.json();
      const endpoints: string[] = Array.isArray(body) ? body : Object.keys(body);
      return {
        streams: endpoints.map(name => ({
          name,
          schema: {},
          supportedSyncModes: ['full_refresh', 'incremental'],
        })),
      };
    } catch {
      return { streams: [] };
    }
  }
}

export default RestConnectorProvider;
