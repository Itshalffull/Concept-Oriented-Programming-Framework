// GraphQL — connector_protocol provider
// GraphQL connector with variable binding, relay cursor pagination, query batching, and schema introspection

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

export const PROVIDER_ID = 'graphql';
export const PLUGIN_TYPE = 'connector_protocol';

interface GraphQLResponse {
  data?: Record<string, unknown>;
  errors?: Array<{ message: string; locations?: Array<{ line: number; column: number }> }>;
}

interface RelayConnection {
  edges?: Array<{ node: Record<string, unknown>; cursor?: string }>;
  pageInfo?: { hasNextPage: boolean; endCursor?: string };
  nodes?: Record<string, unknown>[];
  totalCount?: number;
}

async function executeGraphQL(
  endpoint: string,
  query: string,
  variables: Record<string, unknown>,
  headers: Record<string, string>
): Promise<GraphQLResponse> {
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ query, variables }),
  });
  if (!resp.ok) throw new Error(`GraphQL request failed: ${resp.status}`);
  return resp.json();
}

async function executeBatchGraphQL(
  endpoint: string,
  queries: Array<{ query: string; variables: Record<string, unknown> }>,
  headers: Record<string, string>
): Promise<GraphQLResponse[]> {
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(queries),
  });
  if (!resp.ok) throw new Error(`GraphQL batch request failed: ${resp.status}`);
  return resp.json();
}

const INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      types {
        name
        kind
        fields {
          name
          type {
            name
            kind
            ofType { name kind }
          }
        }
      }
    }
  }
`;

function extractConnection(data: Record<string, unknown>): RelayConnection | null {
  for (const value of Object.values(data)) {
    if (value && typeof value === 'object' && ('edges' in (value as object) || 'nodes' in (value as object))) {
      return value as RelayConnection;
    }
    if (value && typeof value === 'object') {
      const nested = extractConnection(value as Record<string, unknown>);
      if (nested) return nested;
    }
  }
  return null;
}

function buildHeaders(config: ConnectorConfig): Record<string, string> {
  const headers: Record<string, string> = { ...config.headers };
  if (config.auth) {
    const token = config.auth.token as string | undefined;
    const style = config.auth.style as string | undefined;
    if (style === 'bearer' && token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (style === 'api_key') {
      const headerName = (config.auth.apiKeyHeader as string) ?? 'X-API-Key';
      headers[headerName] = (config.auth.apiKey as string) ?? '';
    }
  }
  return headers;
}

export class GraphqlConnectorProvider {
  async *read(query: QuerySpec, config: ConnectorConfig): AsyncGenerator<Record<string, unknown>> {
    const endpoint = config.baseUrl ?? '';
    const gqlQuery = query.query ?? '';
    const headers = buildHeaders(config);
    const pageSize = query.limit ?? 50;
    const useRelay = (config.options?.relayPagination as boolean) ?? true;

    if (!useRelay) {
      const variables = { ...query.params, first: pageSize };
      const result = await executeGraphQL(endpoint, gqlQuery, variables, headers);
      if (result.errors?.length) throw new Error(result.errors.map(e => e.message).join('; '));
      if (!result.data) return;
      const connection = extractConnection(result.data);
      if (connection?.edges) {
        for (const edge of connection.edges) yield edge.node;
      } else if (connection?.nodes) {
        for (const node of connection.nodes) yield node as Record<string, unknown>;
      } else if (Array.isArray(Object.values(result.data)[0])) {
        for (const item of Object.values(result.data)[0] as Record<string, unknown>[]) yield item;
      }
      return;
    }

    let cursor = query.cursor ?? null;
    let hasMore = true;

    while (hasMore) {
      const variables: Record<string, unknown> = {
        ...query.params,
        first: pageSize,
        ...(cursor ? { after: cursor } : {}),
      };

      const result = await executeGraphQL(endpoint, gqlQuery, variables, headers);
      if (result.errors?.length) throw new Error(result.errors.map(e => e.message).join('; '));
      if (!result.data) break;

      const connection = extractConnection(result.data);
      if (!connection) break;

      if (connection.edges) {
        for (const edge of connection.edges) {
          yield edge.node;
        }
      } else if (connection.nodes) {
        for (const node of connection.nodes) {
          yield node as Record<string, unknown>;
        }
      }

      hasMore = connection.pageInfo?.hasNextPage ?? false;
      cursor = connection.pageInfo?.endCursor ?? null;
    }
  }

  async write(records: Record<string, unknown>[], config: ConnectorConfig): Promise<WriteResult> {
    const endpoint = config.baseUrl ?? '';
    const mutation = (config.options?.mutation as string) ?? '';
    const batchSize = (config.options?.batchSize as number) ?? 10;
    const headers = buildHeaders(config);
    const result: WriteResult = { created: 0, updated: 0, skipped: 0, errors: 0 };
    const useBatching = (config.options?.batchRequests as boolean) ?? false;

    if (useBatching) {
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const queries = batch.map(record => ({
          query: mutation,
          variables: { input: record },
        }));
        try {
          const responses = await executeBatchGraphQL(endpoint, queries, headers);
          for (const resp of responses) {
            if (resp.errors?.length) result.errors++;
            else result.created++;
          }
        } catch {
          result.errors += batch.length;
        }
      }
    } else {
      for (const record of records) {
        try {
          const resp = await executeGraphQL(endpoint, mutation, { input: record }, headers);
          if (resp.errors?.length) result.errors++;
          else result.created++;
        } catch {
          result.errors++;
        }
      }
    }
    return result;
  }

  async test(config: ConnectorConfig): Promise<TestResult> {
    const endpoint = config.baseUrl ?? '';
    const headers = buildHeaders(config);
    const start = Date.now();
    try {
      const result = await executeGraphQL(endpoint, '{ __typename }', {}, headers);
      const hasErrors = !!result.errors?.length;
      return {
        connected: !hasErrors && !!result.data,
        message: hasErrors ? result.errors!.map(e => e.message).join('; ') : 'Connected successfully',
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return { connected: false, message: String(err), latencyMs: Date.now() - start };
    }
  }

  async discover(config: ConnectorConfig): Promise<DiscoveryResult> {
    const endpoint = config.baseUrl ?? '';
    const headers = buildHeaders(config);
    try {
      const result = await executeGraphQL(endpoint, INTROSPECTION_QUERY, {}, headers);
      if (!result.data) return { streams: [] };
      const schema = result.data.__schema as {
        types: Array<{ name: string; kind: string; fields?: Array<{ name: string; type: { name: string; kind: string } }> }>;
      };
      const queryTypes = schema.types.filter(
        t => t.kind === 'OBJECT' && !t.name.startsWith('__') && t.fields && t.fields.length > 0
      );
      return {
        streams: queryTypes.map(t => ({
          name: t.name,
          schema: {
            type: 'object',
            properties: Object.fromEntries(
              (t.fields ?? []).map(f => [f.name, { type: f.type.name ?? f.type.kind }])
            ),
          },
          supportedSyncModes: ['full_refresh'],
        })),
      };
    } catch {
      return { streams: [] };
    }
  }
}

export default GraphqlConnectorProvider;
