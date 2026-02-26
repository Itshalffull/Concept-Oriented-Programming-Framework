// CSV — connector_protocol provider
// CSV/TSV file reader and writer with configurable delimiters, quote handling, header detection, and streaming

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

export const PROVIDER_ID = 'csv';
export const PLUGIN_TYPE = 'connector_protocol';

interface CsvOptions {
  delimiter: string;
  quote: string;
  escape: string;
  hasHeader: boolean;
  encoding: string;
  skipRows: number;
  commentChar: string;
  nullValues: string[];
}

function getOptions(config: ConnectorConfig): CsvOptions {
  const opts = config.options ?? {};
  return {
    delimiter: (opts.delimiter as string) ?? ',',
    quote: (opts.quote as string) ?? '"',
    escape: (opts.escape as string) ?? '"',
    hasHeader: (opts.hasHeader as boolean) ?? true,
    encoding: (opts.encoding as string) ?? 'utf-8',
    skipRows: (opts.skipRows as number) ?? 0,
    commentChar: (opts.commentChar as string) ?? '',
    nullValues: (opts.nullValues as string[]) ?? ['', 'NULL', 'null', 'NA', 'N/A'],
  };
}

function parseCsvLine(line: string, delimiter: string, quote: string, escape: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === escape && i + 1 < line.length && line[i + 1] === quote) {
        current += quote;
        i += 2;
      } else if (ch === quote) {
        inQuotes = false;
        i++;
      } else {
        current += ch;
        i++;
      }
    } else {
      if (ch === quote) {
        inQuotes = true;
        i++;
      } else if (ch === delimiter) {
        fields.push(current);
        current = '';
        i++;
      } else {
        current += ch;
        i++;
      }
    }
  }
  fields.push(current);
  return fields;
}

function formatCsvField(value: string, delimiter: string, quote: string): string {
  if (value.includes(delimiter) || value.includes(quote) || value.includes('\n') || value.includes('\r')) {
    return quote + value.replace(new RegExp(quote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), quote + quote) + quote;
  }
  return value;
}

function formatCsvLine(fields: string[], delimiter: string, quote: string): string {
  return fields.map(f => formatCsvField(f, delimiter, quote)).join(delimiter);
}

function coerceValue(value: string, nullValues: string[]): unknown {
  if (nullValues.includes(value)) return null;
  if (/^-?\d+$/.test(value)) {
    const n = parseInt(value, 10);
    if (n >= Number.MIN_SAFE_INTEGER && n <= Number.MAX_SAFE_INTEGER) return n;
  }
  if (/^-?\d+\.?\d*(e[+-]?\d+)?$/i.test(value)) return parseFloat(value);
  if (value === 'true' || value === 'TRUE') return true;
  if (value === 'false' || value === 'FALSE') return false;
  return value;
}

function detectDelimiter(sample: string): string {
  const counts: Record<string, number> = { ',': 0, '\t': 0, '|': 0, ';': 0 };
  const firstLine = sample.split('\n')[0] ?? '';
  for (const ch of firstLine) {
    if (ch in counts) counts[ch]++;
  }
  let best = ',';
  let bestCount = 0;
  for (const [delim, count] of Object.entries(counts)) {
    if (count > bestCount) { bestCount = count; best = delim; }
  }
  return best;
}

function detectHeader(lines: string[], delimiter: string): boolean {
  if (lines.length < 2) return true;
  const firstFields = parseCsvLine(lines[0], delimiter, '"', '"');
  const secondFields = parseCsvLine(lines[1], delimiter, '"', '"');
  const firstAllText = firstFields.every(f => isNaN(Number(f)) || f === '');
  const secondHasNumbers = secondFields.some(f => !isNaN(Number(f)) && f !== '');
  return firstAllText && secondHasNumbers;
}

export class CsvConnectorProvider {
  async *read(query: QuerySpec, config: ConnectorConfig): AsyncGenerator<Record<string, unknown>> {
    const filePath = query.path ?? config.baseUrl ?? '';
    const opts = getOptions(config);
    const limit = query.limit ?? Infinity;
    const startRow = query.cursor ? parseInt(query.cursor, 10) : 0;

    let content: string;
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      const resp = await fetch(filePath, { headers: config.headers });
      if (!resp.ok) throw new Error(`CSV fetch failed: ${resp.status}`);
      content = await resp.text();
    } else {
      const fs = await import('fs');
      content = fs.readFileSync(filePath, opts.encoding as BufferEncoding);
    }

    const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
    const delimiter = opts.delimiter === 'auto' ? detectDelimiter(content) : opts.delimiter;
    const hasHeader = opts.hasHeader ?? detectHeader(lines, delimiter);

    let headerFields: string[];
    let dataStart: number;
    if (hasHeader) {
      headerFields = parseCsvLine(lines[opts.skipRows] ?? '', delimiter, opts.quote, opts.escape);
      dataStart = opts.skipRows + 1;
    } else {
      const sampleFields = parseCsvLine(lines[0] ?? '', delimiter, opts.quote, opts.escape);
      headerFields = sampleFields.map((_, i) => `column_${i}`);
      dataStart = opts.skipRows;
    }

    let yielded = 0;
    for (let i = dataStart + startRow; i < lines.length && yielded < limit; i++) {
      const line = lines[i];
      if (opts.commentChar && line.startsWith(opts.commentChar)) continue;
      const fields = parseCsvLine(line, delimiter, opts.quote, opts.escape);
      const record: Record<string, unknown> = {};
      for (let j = 0; j < headerFields.length; j++) {
        record[headerFields[j]] = coerceValue(fields[j] ?? '', opts.nullValues);
      }
      yield record;
      yielded++;
    }
  }

  async write(records: Record<string, unknown>[], config: ConnectorConfig): Promise<WriteResult> {
    const filePath = (config.options?.outputPath as string) ?? '';
    const opts = getOptions(config);
    if (!filePath) return { created: 0, updated: 0, skipped: records.length, errors: 0 };

    const allKeys = new Set<string>();
    for (const record of records) {
      for (const key of Object.keys(record)) allKeys.add(key);
    }
    const headers = Array.from(allKeys);

    const lines: string[] = [];
    if (opts.hasHeader) {
      lines.push(formatCsvLine(headers, opts.delimiter, opts.quote));
    }
    for (const record of records) {
      const fields = headers.map(h => String(record[h] ?? ''));
      lines.push(formatCsvLine(fields, opts.delimiter, opts.quote));
    }

    const fs = await import('fs');
    const appendMode = (config.options?.appendMode as boolean) ?? false;
    if (appendMode) {
      fs.appendFileSync(filePath, lines.join('\n') + '\n', opts.encoding as BufferEncoding);
    } else {
      fs.writeFileSync(filePath, lines.join('\n') + '\n', opts.encoding as BufferEncoding);
    }

    return { created: records.length, updated: 0, skipped: 0, errors: 0 };
  }

  async test(config: ConnectorConfig): Promise<TestResult> {
    const filePath = config.baseUrl ?? '';
    const start = Date.now();
    try {
      if (filePath.startsWith('http')) {
        const resp = await fetch(filePath, { method: 'HEAD', headers: config.headers });
        return { connected: resp.ok, message: resp.ok ? 'URL accessible' : `HTTP ${resp.status}`, latencyMs: Date.now() - start };
      }
      const fs = await import('fs');
      const exists = fs.existsSync(filePath);
      return { connected: exists, message: exists ? 'File exists' : 'File not found', latencyMs: Date.now() - start };
    } catch (err) {
      return { connected: false, message: String(err), latencyMs: Date.now() - start };
    }
  }

  async discover(config: ConnectorConfig): Promise<DiscoveryResult> {
    const filePath = config.baseUrl ?? '';
    try {
      let sample: string;
      if (filePath.startsWith('http')) {
        const resp = await fetch(filePath, { headers: { ...config.headers, Range: 'bytes=0-8192' } });
        sample = await resp.text();
      } else {
        const fs = await import('fs');
        const buf = Buffer.alloc(8192);
        const fd = fs.openSync(filePath, 'r');
        const bytesRead = fs.readSync(fd, buf, 0, 8192, 0);
        fs.closeSync(fd);
        sample = buf.slice(0, bytesRead).toString('utf-8');
      }
      const lines = sample.split(/\r?\n/).filter(l => l.trim() !== '');
      const delimiter = detectDelimiter(sample);
      const hasHeader = detectHeader(lines, delimiter);
      const headers = hasHeader
        ? parseCsvLine(lines[0], delimiter, '"', '"')
        : parseCsvLine(lines[0], delimiter, '"', '"').map((_, i) => `column_${i}`);

      const properties: Record<string, unknown> = {};
      for (const h of headers) properties[h] = { type: 'string' };

      return {
        streams: [{
          name: filePath.split('/').pop() ?? filePath,
          schema: { type: 'object', properties },
          supportedSyncModes: ['full_refresh'],
        }],
      };
    } catch {
      return { streams: [] };
    }
  }
}

export default CsvConnectorProvider;
