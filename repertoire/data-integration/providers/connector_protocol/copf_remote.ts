// CopfRemote — connector_protocol provider
// Connects to another COPF instance API for schema sharing, identity field mapping, and bidirectional sync

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

export const PROVIDER_ID = 'copf_remote';
export const PLUGIN_TYPE = 'connector_protocol';

interface CopfApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: { cursor?: string; hasMore?: boolean; total?: number };
}

interface ConceptSchema {
  name: string;
  identityFields: string[];
  fields: Array<{ name: string; type: string; required: boolean }>;
  conventions: string[];
}

interface FieldMapping {
  local: string;
  remote: string;
  transform?: string;
}

function buildApiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}/api/v1${path}`;
}

function buildHeaders(config: ConnectorConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-COPF-Client': 'connector_protocol/copf_remote',
    ...config.headers,
  };
  if (config.auth) {
    const token = config.auth.token as string | undefined;
    const apiKey = config.auth.apiKey as string | undefined;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (apiKey) headers['X-COPF-API-Key'] = apiKey;
  }
  return headers;
}

function mapFields(
  record: Record<string, unknown>,
  mappings: FieldMapping[],
  direction: 'toRemote' | 'toLocal'
): Record<string, unknown> {
  if (mappings.length === 0) return record;
  const mapped: Record<string, unknown> = {};
  for (const mapping of mappings) {
    const sourceField = direction === 'toRemote' ? mapping.local : mapping.remote;
    const targetField = direction === 'toRemote' ? mapping.remote : mapping.local;
    if (sourceField in record) {
      let value = record[sourceField];
      if (mapping.transform) {
        switch (mapping.transform) {
          case 'toString': value = String(value); break;
          case 'toNumber': value = Number(value); break;
          case 'toBoolean': value = Boolean(value); break;
          case 'toLowerCase': value = String(value).toLowerCase(); break;
          case 'toUpperCase': value = String(value).toUpperCase(); break;
        }
      }
      mapped[targetField] = value;
    }
  }
  // Include unmapped fields
  for (const [key, value] of Object.entries(record)) {
    if (!mappings.some(m => (direction === 'toRemote' ? m.local : m.remote) === key)) {
      mapped[key] = value;
    }
  }
  return mapped;
}

function resolveIdentityConflict(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  identityFields: string[],
  strategy: string
): Record<string, unknown> | null {
  const localId = identityFields.map(f => String(local[f] ?? '')).join(':');
  const remoteId = identityFields.map(f => String(remote[f] ?? '')).join(':');
  if (localId !== remoteId) return null;

  switch (strategy) {
    case 'remote_wins': return remote;
    case 'local_wins': return local;
    case 'merge': return { ...local, ...remote };
    case 'newest': {
      const localTime = new Date(String(local.updatedAt ?? local.createdAt ?? 0)).getTime();
      const remoteTime = new Date(String(remote.updatedAt ?? remote.createdAt ?? 0)).getTime();
      return remoteTime >= localTime ? remote : local;
    }
    default: return remote;
  }
}

export class CopfRemoteConnectorProvider {
  private fieldMappings: FieldMapping[] = [];

  private getFieldMappings(config: ConnectorConfig): FieldMapping[] {
    const raw = config.options?.fieldMappings as FieldMapping[] | undefined;
    return raw ?? [];
  }

  async *read(query: QuerySpec, config: ConnectorConfig): AsyncGenerator<Record<string, unknown>> {
    const baseUrl = config.baseUrl ?? '';
    const headers = buildHeaders(config);
    const conceptName = query.path ?? '';
    const limit = query.limit ?? 100;
    const fieldMappings = this.getFieldMappings(config);

    let cursor = query.cursor ?? null;
    let hasMore = true;
    let totalYielded = 0;

    while (hasMore && totalYielded < limit) {
      const params = new URLSearchParams({
        limit: String(Math.min(limit - totalYielded, 100)),
        ...(cursor ? { cursor } : {}),
      });
      if (query.params) {
        for (const [k, v] of Object.entries(query.params)) {
          params.set(k, String(v));
        }
      }

      const url = buildApiUrl(baseUrl, `/concepts/${conceptName}/records?${params.toString()}`);
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`COPF remote read failed: ${resp.status}`);

      const result: CopfApiResponse<Record<string, unknown>[]> = await resp.json();
      if (!result.success || !result.data) break;

      for (const record of result.data) {
        const mapped = mapFields(record, fieldMappings, 'toLocal');
        yield mapped;
        totalYielded++;
      }

      hasMore = result.meta?.hasMore ?? false;
      cursor = result.meta?.cursor ?? null;
    }
  }

  async write(records: Record<string, unknown>[], config: ConnectorConfig): Promise<WriteResult> {
    const baseUrl = config.baseUrl ?? '';
    const headers = buildHeaders(config);
    const conceptName = (config.options?.concept as string) ?? '';
    const syncMode = (config.options?.syncMode as string) ?? 'upsert';
    const fieldMappings = this.getFieldMappings(config);
    const batchSize = (config.options?.batchSize as number) ?? 50;
    const result: WriteResult = { created: 0, updated: 0, skipped: 0, errors: 0 };

    const mappedRecords = records.map(r => mapFields(r, fieldMappings, 'toRemote'));

    for (let i = 0; i < mappedRecords.length; i += batchSize) {
      const batch = mappedRecords.slice(i, i + batchSize);
      try {
        const url = buildApiUrl(baseUrl, `/concepts/${conceptName}/sync`);
        const resp = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ records: batch, mode: syncMode }),
        });
        if (resp.ok) {
          const body: CopfApiResponse<WriteResult> = await resp.json();
          if (body.data) {
            result.created += body.data.created;
            result.updated += body.data.updated;
            result.skipped += body.data.skipped;
          }
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
    const baseUrl = config.baseUrl ?? '';
    const headers = buildHeaders(config);
    const start = Date.now();
    try {
      const url = buildApiUrl(baseUrl, '/health');
      const resp = await fetch(url, { headers });
      if (!resp.ok) return { connected: false, message: `HTTP ${resp.status}`, latencyMs: Date.now() - start };
      const body: CopfApiResponse<{ version: string; instance: string }> = await resp.json();
      return {
        connected: true,
        message: `Connected to COPF instance: ${body.data?.instance ?? 'unknown'} (v${body.data?.version ?? '?'})`,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return { connected: false, message: String(err), latencyMs: Date.now() - start };
    }
  }

  async discover(config: ConnectorConfig): Promise<DiscoveryResult> {
    const baseUrl = config.baseUrl ?? '';
    const headers = buildHeaders(config);
    try {
      const url = buildApiUrl(baseUrl, '/concepts');
      const resp = await fetch(url, { headers });
      if (!resp.ok) return { streams: [] };
      const body: CopfApiResponse<ConceptSchema[]> = await resp.json();
      if (!body.data) return { streams: [] };

      return {
        streams: body.data.map(concept => ({
          name: concept.name,
          schema: {
            type: 'object',
            properties: Object.fromEntries(
              concept.fields.map(f => [f.name, { type: f.type, required: f.required }])
            ),
            identityFields: concept.identityFields,
            conventions: concept.conventions,
          },
          supportedSyncModes: ['full_refresh', 'incremental', 'bidirectional'],
        })),
      };
    } catch {
      return { streams: [] };
    }
  }
}

export default CopfRemoteConnectorProvider;
