// JSON schema detector — infers schema from JSON objects or CSV content
// Detects field types, patterns (email, URL, date, UUID), cardinality, nullability

export const PROVIDER_ID = 'json_schema_detector';
export const PLUGIN_TYPE = 'structure_detector';

export interface DetectorConfig {
  options?: Record<string, unknown>;
  confidenceThreshold?: number;
}

export interface Detection {
  field: string;
  value: unknown;
  type: string;
  confidence: number;
  evidence: string;
}

interface FieldSchema {
  name: string;
  type: string;
  pattern?: string;
  nullable: boolean;
  count: number;
  totalSamples: number;
}

const PATTERN_MATCHERS: Array<{ name: string; regex: RegExp }> = [
  { name: 'email', regex: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/ },
  { name: 'url', regex: /^https?:\/\/\S+$/ },
  { name: 'uuid', regex: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i },
  { name: 'iso_date', regex: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/ },
  { name: 'ipv4', regex: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/ },
  { name: 'phone', regex: /^\+?\d[\d\s()-]{6,20}$/ },
];

function inferJsonType(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return 'unknown';
}

function detectPattern(value: string): string | undefined {
  for (const matcher of PATTERN_MATCHERS) {
    if (matcher.regex.test(value)) return matcher.name;
  }
  return undefined;
}

function analyzeObjects(objects: Record<string, unknown>[]): FieldSchema[] {
  const fieldMap = new Map<string, {
    types: Map<string, number>;
    patterns: Map<string, number>;
    nullCount: number;
    count: number;
  }>();

  const totalSamples = objects.length;

  for (const obj of objects) {
    for (const [key, val] of Object.entries(obj)) {
      if (!fieldMap.has(key)) {
        fieldMap.set(key, { types: new Map(), patterns: new Map(), nullCount: 0, count: 0 });
      }
      const stats = fieldMap.get(key)!;
      stats.count++;

      const type = inferJsonType(val);
      stats.types.set(type, (stats.types.get(type) ?? 0) + 1);

      if (val === null || val === undefined) {
        stats.nullCount++;
      } else if (typeof val === 'string') {
        const pattern = detectPattern(val);
        if (pattern) {
          stats.patterns.set(pattern, (stats.patterns.get(pattern) ?? 0) + 1);
        }
      }
    }
  }

  const schemas: FieldSchema[] = [];
  for (const [name, stats] of fieldMap) {
    // Determine dominant type
    let dominantType = 'string';
    let maxCount = 0;
    for (const [type, count] of stats.types) {
      if (type !== 'null' && count > maxCount) {
        dominantType = type;
        maxCount = count;
      }
    }

    // Determine dominant pattern
    let pattern: string | undefined;
    for (const [pat, count] of stats.patterns) {
      if (count > (stats.count - stats.nullCount) * 0.7) {
        pattern = pat;
        break;
      }
    }

    schemas.push({
      name,
      type: dominantType,
      pattern,
      nullable: stats.nullCount > 0,
      count: stats.count,
      totalSamples,
    });
  }

  return schemas;
}

function parseCsvToObjects(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
  const objects: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
    const obj: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const raw = values[j] ?? '';
      if (raw === '' || raw.toLowerCase() === 'null') {
        obj[headers[j]] = null;
      } else if (/^-?\d+$/.test(raw)) {
        obj[headers[j]] = parseInt(raw, 10);
      } else if (/^-?\d+\.\d+$/.test(raw)) {
        obj[headers[j]] = parseFloat(raw);
      } else if (/^(true|false)$/i.test(raw)) {
        obj[headers[j]] = raw.toLowerCase() === 'true';
      } else {
        obj[headers[j]] = raw;
      }
    }
    objects.push(obj);
  }

  return objects;
}

export class JsonSchemaDetectorProvider {
  detect(
    content: unknown,
    existingStructure: Record<string, unknown>,
    config: DetectorConfig
  ): Detection[] {
    const threshold = config.confidenceThreshold ?? 0.5;
    let objects: Record<string, unknown>[] = [];

    // Try parsing as JSON
    if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          objects = parsed.filter(item => typeof item === 'object' && item !== null);
        } else if (typeof parsed === 'object' && parsed !== null) {
          objects = [parsed];
        }
      } catch {
        // Try CSV parsing
        objects = parseCsvToObjects(content);
      }
    } else if (Array.isArray(content)) {
      objects = content.filter(item => typeof item === 'object' && item !== null);
    } else if (typeof content === 'object' && content !== null) {
      objects = [content as Record<string, unknown>];
    }

    if (objects.length === 0) return [];

    const schemas = analyzeObjects(objects);
    const detections: Detection[] = [];

    for (const schema of schemas) {
      const cardinality = schema.count / schema.totalSamples;
      let confidence = cardinality >= 1.0 ? 0.95 : 0.80;
      if (schema.pattern) confidence = Math.min(confidence + 0.03, 0.99);

      if (confidence < threshold) continue;

      detections.push({
        field: `schema.${schema.name}`,
        value: {
          type: schema.type,
          pattern: schema.pattern ?? null,
          nullable: schema.nullable,
          cardinality: Math.round(cardinality * 100) / 100,
          samples: schema.totalSamples,
        },
        type: 'schema_field',
        confidence,
        evidence: `Field "${schema.name}": ${schema.type}${schema.pattern ? ` (${schema.pattern})` : ''}, ${schema.nullable ? 'nullable' : 'required'}`,
      });
    }

    // Add overall schema detection
    if (detections.length > 0) {
      detections.push({
        field: 'schema',
        value: {
          fieldCount: schemas.length,
          sampleCount: objects.length,
          fields: schemas.map(s => s.name),
        },
        type: 'json_schema',
        confidence: 0.90,
        evidence: `Schema with ${schemas.length} fields from ${objects.length} sample(s)`,
      });
    }

    return detections;
  }

  appliesTo(contentType: string): boolean {
    return ['application/json', 'text/csv', 'text/tab-separated-values', 'application/x-ndjson'].includes(contentType);
  }
}

export default JsonSchemaDetectorProvider;
