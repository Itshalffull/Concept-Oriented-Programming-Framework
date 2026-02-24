// Key-value detector — finds "Key: Value", "Key = Value", "Key -> Value" patterns
// Infers value types: numbers, dates, booleans, URLs, plain strings

export const PROVIDER_ID = 'kv_detector';
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

type ValueType = 'number' | 'boolean' | 'date' | 'url' | 'email' | 'string';

interface ParsedValue {
  value: unknown;
  type: ValueType;
}

function inferValueType(raw: string): ParsedValue {
  const trimmed = raw.trim();

  // Boolean
  if (/^(true|false|yes|no|on|off)$/i.test(trimmed)) {
    const truthyValues = new Set(['true', 'yes', 'on']);
    return { value: truthyValues.has(trimmed.toLowerCase()), type: 'boolean' };
  }

  // Integer
  if (/^-?\d{1,15}$/.test(trimmed)) {
    return { value: parseInt(trimmed, 10), type: 'number' };
  }

  // Float
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return { value: parseFloat(trimmed), type: 'number' };
  }

  // ISO date
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(trimmed)) {
    return { value: trimmed, type: 'date' };
  }

  // URL
  if (/^https?:\/\/\S+/i.test(trimmed)) {
    return { value: trimmed, type: 'url' };
  }

  // Email
  if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(trimmed)) {
    return { value: trimmed, type: 'email' };
  }

  return { value: trimmed, type: 'string' };
}

function normalizeKey(raw: string): string {
  return raw.trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

// Separator patterns for key-value detection with confidence weights
const KV_SEPARATORS = [
  { regex: /^([A-Za-z][A-Za-z0-9 _-]{0,50})\s*:\s+(.+)$/,  confidence: 0.92, sep: ':' },
  { regex: /^([A-Za-z][A-Za-z0-9 _-]{0,50})\s*=\s+(.+)$/,  confidence: 0.88, sep: '=' },
  { regex: /^([A-Za-z][A-Za-z0-9 _-]{0,50})\s*->\s+(.+)$/,  confidence: 0.85, sep: '->' },
  { regex: /^([A-Za-z][A-Za-z0-9 _-]{0,50})\s*=>\s+(.+)$/,  confidence: 0.85, sep: '=>' },
  { regex: /^([A-Za-z][A-Za-z0-9 _-]{0,50})\s*\u2192\s+(.+)$/,  confidence: 0.85, sep: '\u2192' },
  { regex: /^([A-Za-z][A-Za-z0-9 _-]{0,50})\s+-\s+(.+)$/,   confidence: 0.70, sep: '-' },
];

export class KvDetectorProvider {
  detect(
    content: unknown,
    existingStructure: Record<string, unknown>,
    config: DetectorConfig
  ): Detection[] {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const threshold = config.confidenceThreshold ?? 0.5;
    const detections: Detection[] = [];
    const seen = new Set<string>();

    const lines = text.split(/\r?\n/);

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.length === 0) continue;

      for (const pattern of KV_SEPARATORS) {
        const match = trimmedLine.match(pattern.regex);
        if (!match) continue;

        const rawKey = match[1];
        const rawValue = match[2];
        const key = normalizeKey(rawKey);

        if (key.length === 0 || key.length > 50) continue;
        if (rawValue.trim().length === 0) continue;

        // Skip if already detected this key (first wins)
        if (seen.has(key)) continue;
        seen.add(key);

        const parsed = inferValueType(rawValue);

        // Boost confidence if value type is specific (non-string)
        let confidence = pattern.confidence;
        if (parsed.type !== 'string') {
          confidence = Math.min(confidence + 0.05, 0.99);
        }

        // Reduce confidence for short keys or the dash separator (ambiguous)
        if (rawKey.trim().length <= 2) {
          confidence -= 0.15;
        }

        if (confidence < threshold) continue;

        detections.push({
          field: key,
          value: parsed.value,
          type: parsed.type,
          confidence,
          evidence: trimmedLine,
        });

        break; // first matching separator wins for this line
      }
    }

    return detections;
  }

  appliesTo(contentType: string): boolean {
    return ['text/plain', 'text/markdown', 'text/yaml', 'application/x-yaml'].includes(contentType);
  }
}

export default KvDetectorProvider;
