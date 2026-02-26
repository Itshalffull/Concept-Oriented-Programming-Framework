// Date/time pattern detector — finds ISO 8601, US, European, natural language dates,
// times, and durations in text content

export const PROVIDER_ID = 'date_detector';
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

interface DatePattern {
  regex: RegExp;
  field: string;
  type: string;
  confidence: number;
  parse: (match: RegExpMatchArray) => unknown;
}

const MONTHS = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december'
];
const MONTH_ABBR = MONTHS.map(m => m.slice(0, 3));

const DATE_PATTERNS: DatePattern[] = [
  {
    // ISO 8601 full datetime: 2026-02-24T10:30:00Z
    regex: /\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2}))\b/g,
    field: 'date', type: 'datetime', confidence: 0.98,
    parse: (m) => m[1],
  },
  {
    // ISO 8601 date only: 2026-02-24
    regex: /\b(\d{4}-\d{2}-\d{2})\b/g,
    field: 'date', type: 'datetime', confidence: 0.95,
    parse: (m) => m[1],
  },
  {
    // US format: 02/24/2026 or 2/24/2026
    regex: /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
    field: 'date', type: 'datetime', confidence: 0.80,
    parse: (m) => `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`,
  },
  {
    // European format: 24.02.2026
    regex: /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g,
    field: 'date', type: 'datetime', confidence: 0.80,
    parse: (m) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`,
  },
  {
    // Natural language: March 15, 2026 or Mar 15, 2026
    regex: new RegExp(
      `\\b(${MONTHS.join('|')}|${MONTH_ABBR.join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'gi'
    ),
    field: 'date', type: 'datetime', confidence: 0.90,
    parse: (m) => {
      const monthStr = m[1].toLowerCase();
      const idx = MONTHS.indexOf(monthStr) !== -1
        ? MONTHS.indexOf(monthStr) : MONTH_ABBR.indexOf(monthStr);
      const month = String(idx + 1).padStart(2, '0');
      return `${m[3]}-${month}-${m[2].padStart(2, '0')}`;
    },
  },
  {
    // Relative dates: "last Tuesday", "next week", "yesterday", "tomorrow"
    regex: /\b(last|next|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|year)\b/gi,
    field: 'date', type: 'relative_datetime', confidence: 0.70,
    parse: (m) => ({ relative: m[1].toLowerCase(), unit: m[2].toLowerCase() }),
  },
  {
    // Time: 3:30 PM, 15:30
    regex: /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?\b/g,
    field: 'time', type: 'datetime', confidence: 0.85,
    parse: (m) => {
      let hours = parseInt(m[1], 10);
      const minutes = m[2];
      const seconds = m[3] || '00';
      const meridiem = m[4]?.toUpperCase();
      if (meridiem === 'PM' && hours < 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
    },
  },
  {
    // Duration: "2 hours", "3 days", "15 minutes", "1 year"
    regex: /\b(\d+)\s+(second|minute|hour|day|week|month|year)s?\b/gi,
    field: 'duration', type: 'duration', confidence: 0.85,
    parse: (m) => ({ amount: parseInt(m[1], 10), unit: m[2].toLowerCase() }),
  },
];

export class DateDetectorProvider {
  detect(
    content: unknown,
    existingStructure: Record<string, unknown>,
    config: DetectorConfig
  ): Detection[] {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const threshold = config.confidenceThreshold ?? 0.5;
    const detections: Detection[] = [];
    const seen = new Set<string>();

    for (const pattern of DATE_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(text)) !== null) {
        if (pattern.confidence < threshold) continue;
        const evidence = match[0];
        const dedupKey = `${pattern.field}:${evidence}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        detections.push({
          field: pattern.field,
          value: pattern.parse(match),
          type: pattern.type,
          confidence: pattern.confidence,
          evidence,
        });
      }
    }

    return detections;
  }

  appliesTo(contentType: string): boolean {
    return ['text/plain', 'text/html', 'text/markdown', 'application/json'].includes(contentType);
  }
}

export default DateDetectorProvider;
