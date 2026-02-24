// S3 — connector_protocol provider
// AWS S3 / compatible object storage with list/read, prefix filtering, continuation tokens, and last-modified incremental

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

export const PROVIDER_ID = 's3';
export const PLUGIN_TYPE = 'connector_protocol';

interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  pathStyle: boolean;
}

interface S3Object {
  key: string;
  size: number;
  lastModified: string;
  etag: string;
  storageClass: string;
}

function parseS3Config(config: ConnectorConfig): S3Config {
  const opts = config.options ?? {};
  const auth = config.auth ?? {};
  return {
    bucket: (opts.bucket as string) ?? '',
    region: (opts.region as string) ?? 'us-east-1',
    endpoint: config.baseUrl || (opts.endpoint as string) || undefined,
    accessKeyId: (auth.accessKeyId as string) ?? '',
    secretAccessKey: (auth.secretAccessKey as string) ?? '',
    pathStyle: (opts.pathStyle as boolean) ?? false,
  };
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  const crypto = require('crypto');
  return crypto.createHmac('sha256', key).update(data).digest();
}

function sha256(data: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
}

function signV4(
  method: string,
  url: URL,
  headers: Record<string, string>,
  body: string,
  s3Config: S3Config,
  service = 's3'
): Record<string, string> {
  const crypto = require('crypto');
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const shortDate = dateStamp.substring(0, 8);
  const scope = `${shortDate}/${s3Config.region}/${service}/aws4_request`;

  headers['x-amz-date'] = dateStamp;
  headers['x-amz-content-sha256'] = sha256(body);
  headers['host'] = url.host;

  const sortedHeaders = Object.keys(headers).sort();
  const signedHeaders = sortedHeaders.join(';');
  const canonicalHeaders = sortedHeaders.map(k => `${k.toLowerCase()}:${headers[k]}`).join('\n') + '\n';
  const canonicalRequest = [method, url.pathname, url.search.replace(/^\?/, ''), canonicalHeaders, signedHeaders, sha256(body)].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', dateStamp, scope, sha256(canonicalRequest)].join('\n');

  let signingKey: Buffer = hmacSha256(`AWS4${s3Config.secretAccessKey}`, shortDate);
  signingKey = hmacSha256(signingKey, s3Config.region);
  signingKey = hmacSha256(signingKey, service);
  signingKey = hmacSha256(signingKey, 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${s3Config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return headers;
}

function buildEndpoint(s3Config: S3Config): string {
  if (s3Config.endpoint) return s3Config.endpoint.replace(/\/$/, '');
  if (s3Config.pathStyle) return `https://s3.${s3Config.region}.amazonaws.com`;
  return `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com`;
}

function parseListResponse(xml: string): { objects: S3Object[]; continuationToken: string | null; isTruncated: boolean } {
  const objects: S3Object[] = [];
  const contentRegex = /<Contents>([\s\S]*?)<\/Contents>/g;
  let match;
  while ((match = contentRegex.exec(xml)) !== null) {
    const block = match[1];
    const extract = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
      return m ? m[1] : '';
    };
    objects.push({
      key: extract('Key'),
      size: parseInt(extract('Size') || '0', 10),
      lastModified: extract('LastModified'),
      etag: extract('ETag').replace(/"/g, ''),
      storageClass: extract('StorageClass') || 'STANDARD',
    });
  }
  const tokenMatch = xml.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/);
  const truncMatch = xml.match(/<IsTruncated>(.*?)<\/IsTruncated>/);
  return {
    objects,
    continuationToken: tokenMatch ? tokenMatch[1] : null,
    isTruncated: truncMatch ? truncMatch[1] === 'true' : false,
  };
}

export class S3ConnectorProvider {
  async *read(query: QuerySpec, config: ConnectorConfig): AsyncGenerator<Record<string, unknown>> {
    const s3Config = parseS3Config(config);
    const prefix = query.path ?? (config.options?.prefix as string) ?? '';
    const limit = query.limit ?? Infinity;
    const sinceModified = query.cursor ?? null;
    const endpoint = buildEndpoint(s3Config);
    const maxKeys = Math.min(1000, limit === Infinity ? 1000 : limit);

    let continuationToken = (query.params?.continuationToken as string) ?? null;
    let yielded = 0;
    let hasMore = true;

    while (hasMore && yielded < limit) {
      const params = new URLSearchParams({ 'list-type': '2', prefix, 'max-keys': String(maxKeys) });
      if (continuationToken) params.set('continuation-token', continuationToken);

      const pathSuffix = s3Config.pathStyle ? `/${s3Config.bucket}` : '';
      const url = new URL(`${endpoint}${pathSuffix}?${params.toString()}`);
      const headers: Record<string, string> = {};
      const signedHeaders = signV4('GET', url, headers, '', s3Config);

      const resp = await fetch(url.toString(), { headers: signedHeaders });
      if (!resp.ok) throw new Error(`S3 list failed: ${resp.status}`);
      const xml = await resp.text();
      const result = parseListResponse(xml);

      for (const obj of result.objects) {
        if (yielded >= limit) break;
        if (sinceModified && obj.lastModified <= sinceModified) continue;
        yield obj as unknown as Record<string, unknown>;
        yielded++;
      }

      hasMore = result.isTruncated;
      continuationToken = result.continuationToken;
    }
  }

  async write(records: Record<string, unknown>[], config: ConnectorConfig): Promise<WriteResult> {
    const s3Config = parseS3Config(config);
    const endpoint = buildEndpoint(s3Config);
    const result: WriteResult = { created: 0, updated: 0, skipped: 0, errors: 0 };

    for (const record of records) {
      const key = record.key as string | undefined;
      const body = record.body as string | undefined;
      if (!key || body === undefined) { result.skipped++; continue; }
      try {
        const pathSuffix = s3Config.pathStyle ? `/${s3Config.bucket}/${key}` : `/${key}`;
        const url = new URL(`${endpoint}${pathSuffix}`);
        const headers: Record<string, string> = { 'Content-Type': (record.contentType as string) ?? 'application/octet-stream' };
        const signedHeaders = signV4('PUT', url, headers, body, s3Config);
        const resp = await fetch(url.toString(), { method: 'PUT', headers: signedHeaders, body });
        if (resp.ok) result.created++;
        else result.errors++;
      } catch {
        result.errors++;
      }
    }
    return result;
  }

  async test(config: ConnectorConfig): Promise<TestResult> {
    const s3Config = parseS3Config(config);
    const endpoint = buildEndpoint(s3Config);
    const start = Date.now();
    try {
      const params = new URLSearchParams({ 'list-type': '2', 'max-keys': '1' });
      const pathSuffix = s3Config.pathStyle ? `/${s3Config.bucket}` : '';
      const url = new URL(`${endpoint}${pathSuffix}?${params.toString()}`);
      const headers: Record<string, string> = {};
      const signedHeaders = signV4('GET', url, headers, '', s3Config);
      const resp = await fetch(url.toString(), { headers: signedHeaders });
      return {
        connected: resp.ok,
        message: resp.ok ? `Connected to bucket: ${s3Config.bucket}` : `HTTP ${resp.status}`,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return { connected: false, message: String(err), latencyMs: Date.now() - start };
    }
  }

  async discover(config: ConnectorConfig): Promise<DiscoveryResult> {
    const s3Config = parseS3Config(config);
    const endpoint = buildEndpoint(s3Config);
    try {
      const params = new URLSearchParams({ 'list-type': '2', delimiter: '/', 'max-keys': '100' });
      const pathSuffix = s3Config.pathStyle ? `/${s3Config.bucket}` : '';
      const url = new URL(`${endpoint}${pathSuffix}?${params.toString()}`);
      const headers: Record<string, string> = {};
      const signedHeaders = signV4('GET', url, headers, '', s3Config);
      const resp = await fetch(url.toString(), { headers: signedHeaders });
      if (!resp.ok) return { streams: [] };
      const xml = await resp.text();

      const prefixes: string[] = [];
      const prefixRegex = /<CommonPrefixes><Prefix>(.*?)<\/Prefix><\/CommonPrefixes>/g;
      let match;
      while ((match = prefixRegex.exec(xml)) !== null) prefixes.push(match[1]);

      return {
        streams: prefixes.map(p => ({
          name: p.replace(/\/$/, ''),
          schema: {
            type: 'object',
            properties: {
              key: { type: 'string' }, size: { type: 'integer' },
              lastModified: { type: 'string' }, etag: { type: 'string' },
            },
          },
          supportedSyncModes: ['full_refresh', 'incremental'],
        })),
      };
    } catch {
      return { streams: [] };
    }
  }
}

export default S3ConnectorProvider;
