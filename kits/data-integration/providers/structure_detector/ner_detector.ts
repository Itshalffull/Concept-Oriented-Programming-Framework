// Named entity recognition detector — rule-based NER using capitalization patterns,
// known location lists, date patterns, and context heuristics

export const PROVIDER_ID = 'ner_detector';
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

// Common title prefixes that signal PERSON entities
const PERSON_PREFIXES = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sir', 'madam', 'president', 'ceo', 'cto',
  'director', 'senator', 'governor', 'judge', 'captain', 'general',
]);

// Common organization suffixes
const ORG_SUFFIXES = new Set([
  'inc', 'corp', 'ltd', 'llc', 'co', 'company', 'corporation', 'group',
  'foundation', 'institute', 'university', 'association', 'organization',
  'bank', 'hospital', 'agency', 'department', 'committee',
]);

// Known major locations for LOC entity detection
const KNOWN_LOCATIONS = new Set([
  'new york', 'los angeles', 'chicago', 'london', 'paris', 'tokyo', 'berlin',
  'sydney', 'toronto', 'san francisco', 'washington', 'boston', 'seattle',
  'amsterdam', 'beijing', 'shanghai', 'mumbai', 'dubai', 'singapore',
  'california', 'texas', 'florida', 'europe', 'asia', 'africa', 'america',
  'united states', 'united kingdom', 'canada', 'australia', 'germany',
  'france', 'japan', 'china', 'india', 'brazil', 'mexico', 'russia',
]);

// Context words that appear before/after entities
const LOCATION_CONTEXT = new Set([
  'in', 'at', 'from', 'near', 'to', 'across', 'throughout', 'between', 'around',
  'city', 'state', 'country', 'region', 'province', 'county',
]);

const PERSON_CONTEXT = new Set([
  'said', 'says', 'told', 'asked', 'wrote', 'met', 'called', 'named',
  'according', 'by', 'with', 'interview',
]);

interface EntitySpan {
  text: string;
  start: number;
  end: number;
  entityType: string;
  confidence: number;
}

export class NerDetectorProvider {
  detect(
    content: unknown,
    existingStructure: Record<string, unknown>,
    config: DetectorConfig
  ): Detection[] {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const threshold = config.confidenceThreshold ?? 0.5;
    const entities: EntitySpan[] = [];
    const seen = new Set<string>();

    // Detect PERSON/ORG via capitalized word sequences
    const capsRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4})\b/g;
    let match: RegExpExecArray | null;

    while ((match = capsRegex.exec(text)) !== null) {
      const span = match[1];
      const start = match.index;
      const words = span.split(/\s+/);
      if (words.length < 1) continue;

      // Check context: word before the entity
      const beforeStart = Math.max(0, start - 30);
      const beforeText = text.slice(beforeStart, start).toLowerCase();
      const beforeWords = beforeText.split(/\s+/).filter(w => w.length > 0);
      const wordBefore = beforeWords[beforeWords.length - 1] ?? '';

      // Check context: word after the entity
      const afterEnd = Math.min(text.length, start + span.length + 30);
      const afterText = text.slice(start + span.length, afterEnd).toLowerCase();
      const afterWords = afterText.split(/\s+/).filter(w => w.length > 0);
      const wordAfter = afterWords[0] ?? '';

      // Determine entity type
      let entityType = 'UNKNOWN';
      let confidence = 0.50;

      // Check for person prefix
      if (PERSON_PREFIXES.has(wordBefore.replace(/[.]$/, ''))) {
        entityType = 'PERSON';
        confidence = 0.92;
      }
      // Check for person context
      else if (PERSON_CONTEXT.has(wordAfter) || PERSON_CONTEXT.has(wordBefore)) {
        entityType = 'PERSON';
        confidence = 0.78;
      }
      // Check for known location
      else if (KNOWN_LOCATIONS.has(span.toLowerCase())) {
        entityType = 'LOC';
        confidence = 0.90;
      }
      // Check for location context
      else if (LOCATION_CONTEXT.has(wordBefore)) {
        entityType = 'LOC';
        confidence = 0.75;
      }
      // Check for org suffixes
      else if (ORG_SUFFIXES.has(words[words.length - 1].toLowerCase())) {
        entityType = 'ORG';
        confidence = 0.88;
      }
      // Two+ capitalized words without context — likely PERSON or ORG
      else if (words.length >= 2 && words.length <= 3) {
        entityType = 'PERSON';
        confidence = 0.60;
      }

      if (entityType === 'UNKNOWN' || confidence < threshold) continue;

      const dedupKey = `${entityType}:${span.toLowerCase()}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      entities.push({ text: span, start, end: start + span.length, entityType, confidence });
    }

    // Detect CONTACT entities (email/phone)
    const emailRegex = /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
    while ((match = emailRegex.exec(text)) !== null) {
      const dedupKey = `CONTACT:${match[1].toLowerCase()}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      entities.push({
        text: match[1], start: match.index, end: match.index + match[0].length,
        entityType: 'CONTACT', confidence: 0.95,
      });
    }

    // Convert entity spans to Detection[]
    return entities.map(e => ({
      field: `entity_${e.entityType.toLowerCase()}`,
      value: { text: e.text, start: e.start, end: e.end },
      type: e.entityType,
      confidence: e.confidence,
      evidence: e.text,
    }));
  }

  appliesTo(contentType: string): boolean {
    return ['text/plain', 'text/html', 'text/markdown'].includes(contentType);
  }
}

export default NerDetectorProvider;
