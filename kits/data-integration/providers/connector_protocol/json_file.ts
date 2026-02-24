// JSONFile — connector_protocol provider
// JSON/JSONL file and URL reader with JSON arrays, newline-delimited JSON, and JSONPath-based record extraction

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

export const PROVIDER_ID = 'json_file';
export const PLUGIN_TYPE = 'connector_protocol';

type JsonFormat = 'json' | 'jsonl' | 'auto';

function detectFormat(content: string): JsonFormat {
  const trimmed = content.trimStart();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const firstNewline = trimmed.indexOf('\n');
    if (firstNewline > 0) {
      const firstLine = trimmed.substring(0, firstNewline).trim();
      try { JSON.parse(firstLine); return 'jsonl'; } catch { /* not jsonl */ }
    }
    return 'json';
  }
  return 'jsonl';
}

function evaluateJsonPath(obj: unknown, path: string): unknown[] {
  if (!path || path === '$' || path === '.') return Array.isArray(obj) ? obj : [obj];

  const segments = path.replace(/^\$\.?/, '').split('.').filter(Boolean);
  let current: unknown[] = [obj];

  for (const segment of segments) {
    const next: unknown[] = [];
    for (const item of current) {
      if (segment === '*') {
        if (Array.isArray(item)) {
          next.push(...item);
        } else if (item && typeof item === 'object') {
          next.push(...Object.values(item as Record<string, unknown>));
        }
      } else if (segment.endsWith('[]')) {
        const key = segment.slice(0, -2);
        if (item && typeof item === 'object') {
          const val = (item as Record<string, unknown>)[key];
          if (Array.isArray(val)) next.push(...val);
        }
      } else {
        if (item && typeof item === 'object') {
          const val = (item as Record<string, unknown>)[segment];
          if (val !== undefined) next.push(val);
        }
      }
    }
    current = next;
  }
  return current;
}

function inferSchema(records: Record<string, unknown>[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const sample = records.slice(0, 20);
  for (const record of sample) {
    for (const [key, value] of Object.entries(record)) {
      if (key in properties) continue;
      if (value === null || value === undefined) {
        properties[key] = { type: 'null' };
      } else if (typeof value === 'number') {
        properties[key] = { type: Number.isInteger(value) ? 'integer' : 'number' };
      } else if (typeof value === 'boolean') {
        properties[key] = { type: 'boolean' };
      } else if (Array.isArray(value)) {
        properties[key] = { type: 'array' };
      } else if (typeof value === 'object') {
        properties[key] = { type: 'object' };
      } else {
        properties[key] = { type: 'string' };
      }
    }
  }
  return { type: 'object', properties };
}

async function loadContent(source: string, headers?: Record<string, string>): Promise<string> {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const resp = await fetch(source, { headers });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.text();
  }
  const fs = await import('fs');
  return fs.readFileSync(source, 'utf-8');
}

export class JsonFileConnectorProvider {
  async *read(query: QuerySpec, config: ConnectorConfig): AsyncGenerator<Record<string, unknown>> {
    const source = query.path ?? config.baseUrl ?? '';
    const format: JsonFormat = (config.options?.format as JsonFormat) ?? 'auto';
    const jsonPath = (config.options?.jsonPath as string) ?? '$';
    const limit = query.limit ?? Infinity;
    const offset = query.cursor ? parseInt(query.cursor, 10) : 0;

    const content = await loadContent(source, config.headers);
    const detectedFormat = format === 'auto' ? detectFormat(content) : format;

    let records: unknown[];
    if (detectedFormat === 'jsonl') {
      records = content
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => {
          try { return JSON.parse(line); } catch { return null; }
        })
        .filter(Boolean);
    } else {
      const parsed = JSON.parse(content);
      if (jsonPath && jsonPath !== '$') {
        records = evaluateJsonPath(parsed, jsonPath);
      } else if (Array.isArray(parsed)) {
        records = parsed;
      } else {
        records = [parsed];
      }
    }

    let yielded = 0;
    for (let i = offset; i < records.length && yielded < limit; i++) {
      const item = records[i];
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        yield item as Record<string, unknown>;
        yielded++;
      }
    }
  }

  async write(records: Record<string, unknown>[], config: ConnectorConfig): Promise<WriteResult> {
    const outputPath = (config.options?.outputPath as string) ?? '';
    const format: JsonFormat = (config.options?.outputFormat as JsonFormat) ?? 'json';
    if (!outputPath) return { created: 0, updated: 0, skipped: records.length, errors: 0 };

    const fs = await import('fs');
    let output: string;
    if (format === 'jsonl') {
      output = records.map(r => JSON.stringify(r)).join('\n') + '\n';
    } else {
      const pretty = (config.options?.pretty as boolean) ?? true;
      output = JSON.stringify(records, null, pretty ? 2 : undefined);
    }

    const appendMode = (config.options?.appendMode as boolean) ?? false;
    if (appendMode && format === 'jsonl') {
      fs.appendFileSync(outputPath, output);
    } else {
      fs.writeFileSync(outputPath, output);
    }

    return { created: records.length, updated: 0, skipped: 0, errors: 0 };
  }

  async test(config: ConnectorConfig): Promise<TestResult> {
    const source = config.baseUrl ?? '';
    const start = Date.now();
    try {
      if (source.startsWith('http')) {
        const resp = await fetch(source, { method: 'HEAD', headers: config.headers });
        return { connected: resp.ok, message: resp.ok ? 'URL accessible' : `HTTP ${resp.status}`, latencyMs: Date.now() - start };
      }
      const fs = await import('fs');
      const exists = fs.existsSync(source);
      if (!exists) return { connected: false, message: 'File not found', latencyMs: Date.now() - start };
      const sample = fs.readFileSync(source, 'utf-8').substring(0, 100);
      const fmt = detectFormat(sample);
      return { connected: true, message: `File exists (detected format: ${fmt})`, latencyMs: Date.now() - start };
    } catch (err) {
      return { connected: false, message: String(err), latencyMs: Date.now() - start };
    }
  }

  async discover(config: ConnectorConfig): Promise<DiscoveryResult> {
    const source = config.baseUrl ?? '';
    try {
      const content = await loadContent(source, config.headers);
      const format = detectFormat(content);
      let records: Record<string, unknown>[];
      if (format === 'jsonl') {
        records = content.split('\n').filter(l => l.trim()).slice(0, 20).map(l => {
          try { return JSON.parse(l); } catch { return null; }
        }).filter(Boolean);
      } else {
        const parsed = JSON.parse(content);
        records = Array.isArray(parsed) ? parsed.slice(0, 20) : [parsed];
      }
      const name = source.split('/').pop() ?? source;
      return {
        streams: [{
          name,
          schema: inferSchema(records),
          supportedSyncModes: ['full_refresh'],
        }],
      };
    } catch {
      return { streams: [] };
    }
  }
}

export default JsonFileConnectorProvider;
