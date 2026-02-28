// OData — connector_protocol provider
// OData v4 protocol with $filter, $select, $expand, $orderby, batch requests, and delta links for change tracking

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

export const PROVIDER_ID = 'odata';
export const PLUGIN_TYPE = 'connector_protocol';

interface ODataResponse {
  '@odata.context'?: string;
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
  '@odata.count'?: number;
  value?: Record<string, unknown>[];
}

interface ODataMetadata {
  EntitySets: Array<{
    Name: string;
    EntityType: string;
    Properties: Array<{ Name: string; Type: string; Nullable: boolean }>;
    NavigationProperties: string[];
  }>;
}

interface ODataQueryOptions {
  $filter?: string;
  $select?: string;
  $expand?: string;
  $orderby?: string;
  $top?: number;
  $skip?: number;
  $count?: boolean;
  $search?: string;
}

function buildAuthHeaders(config: ConnectorConfig): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'OData-Version': '4.0',
    'OData-MaxVersion': '4.0',
    ...config.headers,
  };
  if (config.auth) {
    const token = config.auth.token as string | undefined;
    const style = config.auth.style as string | undefined;
    if (style === 'bearer' && token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (style === 'basic') {
      const encoded = Buffer.from(
        `${config.auth.username}:${config.auth.password}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${encoded}`;
    }
  }
  return headers;
}

function buildQueryUrl(baseUrl: string, entitySet: string, options: ODataQueryOptions): string {
  const params = new URLSearchParams();
  if (options.$filter) params.set('$filter', options.$filter);
  if (options.$select) params.set('$select', options.$select);
  if (options.$expand) params.set('$expand', options.$expand);
  if (options.$orderby) params.set('$orderby', options.$orderby);
  if (options.$top !== undefined) params.set('$top', String(options.$top));
  if (options.$skip !== undefined) params.set('$skip', String(options.$skip));
  if (options.$count) params.set('$count', 'true');
  if (options.$search) params.set('$search', options.$search);
  const qs = params.toString();
  return `${baseUrl.replace(/\/$/, '')}/${entitySet}${qs ? `?${qs}` : ''}`;
}

function buildBatchRequest(
  baseUrl: string,
  requests: Array<{ method: string; url: string; body?: unknown }>
): { batchBody: string; boundary: string } {
  const boundary = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  let body = '';
  for (const req of requests) {
    body += `--${boundary}\r\n`;
    body += 'Content-Type: application/http\r\n';
    body += 'Content-Transfer-Encoding: binary\r\n\r\n';
    body += `${req.method} ${req.url} HTTP/1.1\r\n`;
    body += 'Content-Type: application/json\r\n';
    body += 'Accept: application/json\r\n\r\n';
    if (req.body) body += JSON.stringify(req.body);
    body += '\r\n';
  }
  body += `--${boundary}--\r\n`;
  return { batchBody: body, boundary };
}

function parseBatchResponse(body: string, boundary: string): Array<{ status: number; body: unknown }> {
  const parts = body.split(`--${boundary}`).filter(p => p.trim() && !p.includes('--'));
  return parts.map(part => {
    const statusMatch = part.match(/HTTP\/1\.\d\s+(\d+)/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;
    const bodyStart = part.indexOf('\r\n\r\n', part.indexOf('\r\n\r\n') + 1);
    let parsedBody: unknown = null;
    if (bodyStart > 0) {
      const jsonStr = part.substring(bodyStart + 4).trim();
      try { parsedBody = JSON.parse(jsonStr); } catch { parsedBody = jsonStr; }
    }
    return { status, body: parsedBody };
  });
}

function parseODataType(edmType: string): string {
  const typeMap: Record<string, string> = {
    'Edm.String': 'string',
    'Edm.Int32': 'integer',
    'Edm.Int64': 'integer',
    'Edm.Int16': 'integer',
    'Edm.Double': 'number',
    'Edm.Decimal': 'number',
    'Edm.Single': 'number',
    'Edm.Boolean': 'boolean',
    'Edm.DateTime': 'string',
    'Edm.DateTimeOffset': 'string',
    'Edm.Guid': 'string',
    'Edm.Binary': 'string',
    'Edm.Byte': 'integer',
  };
  return typeMap[edmType] ?? 'string';
}

export class OdataConnectorProvider {
  private deltaLinks = new Map<string, string>();

  async *read(query: QuerySpec, config: ConnectorConfig): AsyncGenerator<Record<string, unknown>> {
    const baseUrl = config.baseUrl ?? '';
    const headers = buildAuthHeaders(config);
    const entitySet = query.path ?? '';
    const limit = query.limit ?? Infinity;
    const useDelta = (config.options?.useDelta as boolean) ?? false;

    const queryOptions: ODataQueryOptions = {
      $filter: (query.params?.$filter as string) ?? (config.options?.$filter as string),
      $select: (query.params?.$select as string) ?? (config.options?.$select as string),
      $expand: (query.params?.$expand as string) ?? (config.options?.$expand as string),
      $orderby: (query.params?.$orderby as string) ?? (config.options?.$orderby as string),
      $top: Math.min(limit === Infinity ? 1000 : limit, 1000),
      $count: (config.options?.$count as boolean) ?? false,
      $search: query.query ?? undefined,
    };

    // Use delta link for incremental sync if available
    let url: string;
    if (useDelta && this.deltaLinks.has(entitySet)) {
      url = this.deltaLinks.get(entitySet)!;
    } else if (query.cursor) {
      url = query.cursor; // cursor = nextLink from previous page
    } else {
      url = buildQueryUrl(baseUrl, entitySet, queryOptions);
    }

    let yielded = 0;
    let hasMore = true;

    while (hasMore && yielded < limit) {
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`OData request failed: ${resp.status}`);
      const body: ODataResponse = await resp.json();

      const records = body.value ?? [];
      for (const record of records) {
        if (yielded >= limit) break;
        // Remove OData metadata annotations from records
        const clean: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(record)) {
          if (!key.startsWith('@odata.') && !key.startsWith('odata.')) {
            clean[key] = value;
          }
        }
        yield clean;
        yielded++;
      }

      if (body['@odata.deltaLink']) {
        this.deltaLinks.set(entitySet, body['@odata.deltaLink']);
      }

      if (body['@odata.nextLink'] && yielded < limit) {
        url = body['@odata.nextLink'];
      } else {
        hasMore = false;
      }
    }
  }

  async write(records: Record<string, unknown>[], config: ConnectorConfig): Promise<WriteResult> {
    const baseUrl = config.baseUrl ?? '';
    const headers = buildAuthHeaders(config);
    const entitySet = (config.options?.entitySet as string) ?? '';
    const idField = (config.options?.idField as string) ?? 'Id';
    const useBatch = (config.options?.useBatch as boolean) ?? (records.length > 10);
    const result: WriteResult = { created: 0, updated: 0, skipped: 0, errors: 0 };

    if (useBatch && records.length > 1) {
      const batchRequests = records.map(record => {
        const id = record[idField];
        if (id !== undefined && id !== null) {
          return {
            method: 'PATCH',
            url: `${baseUrl}/${entitySet}(${typeof id === 'string' ? `'${id}'` : id})`,
            body: record,
          };
        }
        return { method: 'POST', url: `${baseUrl}/${entitySet}`, body: record };
      });

      const { batchBody, boundary } = buildBatchRequest(baseUrl, batchRequests);
      const resp = await fetch(`${baseUrl}/$batch`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': `multipart/mixed; boundary=${boundary}`,
        },
        body: batchBody,
      });

      if (resp.ok) {
        const responseText = await resp.text();
        const responseBoundary = resp.headers.get('Content-Type')?.match(/boundary=(.+)/)?.[1] ?? boundary;
        const responses = parseBatchResponse(responseText, responseBoundary);
        for (const r of responses) {
          if (r.status === 201) result.created++;
          else if (r.status === 200 || r.status === 204) result.updated++;
          else result.errors++;
        }
      } else {
        result.errors += records.length;
      }
    } else {
      for (const record of records) {
        const id = record[idField];
        try {
          let resp: Response;
          if (id !== undefined && id !== null) {
            const entityUrl = `${baseUrl}/${entitySet}(${typeof id === 'string' ? `'${id}'` : id})`;
            resp = await fetch(entityUrl, { method: 'PATCH', headers, body: JSON.stringify(record) });
            if (resp.ok) result.updated++;
            else result.errors++;
          } else {
            resp = await fetch(`${baseUrl}/${entitySet}`, { method: 'POST', headers, body: JSON.stringify(record) });
            if (resp.ok || resp.status === 201) result.created++;
            else result.errors++;
          }
        } catch {
          result.errors++;
        }
      }
    }
    return result;
  }

  async test(config: ConnectorConfig): Promise<TestResult> {
    const baseUrl = config.baseUrl ?? '';
    const headers = buildAuthHeaders(config);
    const start = Date.now();
    try {
      const resp = await fetch(baseUrl, { headers });
      if (!resp.ok) return { connected: false, message: `HTTP ${resp.status}`, latencyMs: Date.now() - start };
      const body = await resp.json();
      const context = body['@odata.context'] ?? '';
      return {
        connected: true,
        message: `Connected to OData v4 service${context ? ` (${context})` : ''}`,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return { connected: false, message: String(err), latencyMs: Date.now() - start };
    }
  }

  async discover(config: ConnectorConfig): Promise<DiscoveryResult> {
    const baseUrl = config.baseUrl ?? '';
    const headers = buildAuthHeaders(config);
    try {
      // Fetch $metadata document
      const metaResp = await fetch(`${baseUrl}/$metadata`, {
        headers: { ...headers, Accept: 'application/xml' },
      });
      if (!metaResp.ok) {
        // Fallback: try service document
        const serviceResp = await fetch(baseUrl, { headers });
        if (!serviceResp.ok) return { streams: [] };
        const serviceDoc = await serviceResp.json();
        const entitySets: Array<{ name: string; url: string }> = serviceDoc.value ?? [];
        return {
          streams: entitySets.map(es => ({
            name: es.name,
            schema: {},
            supportedSyncModes: ['full_refresh', 'incremental'],
          })),
        };
      }

      const metadataXml = await metaResp.text();
      const streams: StreamDef[] = [];

      // Parse EntityType definitions from CSDL XML
      const entityTypeRegex = /<EntityType\s+Name="(\w+)">([\s\S]*?)<\/EntityType>/g;
      let match;
      while ((match = entityTypeRegex.exec(metadataXml)) !== null) {
        const [, typeName, typeBody] = match;
        const properties: Record<string, unknown> = {};
        const propRegex = /<Property\s+Name="(\w+)"\s+Type="([^"]+)"(?:\s+Nullable="([^"]+)")?/g;
        let propMatch;
        while ((propMatch = propRegex.exec(typeBody)) !== null) {
          const [, propName, propType, nullable] = propMatch;
          properties[propName] = {
            type: parseODataType(propType),
            nullable: nullable !== 'false',
          };
        }

        const keyRegex = /<Key>[\s\S]*?<PropertyRef\s+Name="(\w+)"[\s\S]*?<\/Key>/;
        const keyMatch = typeBody.match(keyRegex);
        const keyField = keyMatch ? keyMatch[1] : null;

        streams.push({
          name: typeName,
          schema: {
            type: 'object',
            properties,
            ...(keyField ? { primaryKey: keyField } : {}),
          },
          supportedSyncModes: ['full_refresh', 'incremental'],
        });
      }
      return { streams };
    } catch {
      return { streams: [] };
    }
  }
}

export default OdataConnectorProvider;
