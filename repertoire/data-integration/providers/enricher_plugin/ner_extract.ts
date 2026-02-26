// Clef Data Integration Kit - Named Entity Recognition enricher provider
// Tokenizes text, applies NER model/rules (pattern-based for known entity types), returns entity spans.

export const PROVIDER_ID = 'ner_extract';
export const PLUGIN_TYPE = 'enricher_plugin';

export interface ContentItem {
  id: string;
  content: string;
  contentType: string;
  metadata?: Record<string, unknown>;
}

export interface EnricherConfig {
  model?: string;
  apiKey?: string;
  threshold?: number;
  options?: Record<string, unknown>;
}

export interface EnrichmentResult {
  fields: Record<string, unknown>;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface SchemaRef {
  name: string;
  fields?: string[];
}

export interface CostEstimate {
  tokens?: number;
  apiCalls?: number;
  durationMs?: number;
}

type EntityType = 'PERSON' | 'ORG' | 'LOC' | 'EVENT' | 'DATE' | 'MONEY' | 'EMAIL' | 'URL' | 'PHONE';

interface Entity {
  text: string;
  type: EntityType;
  start: number;
  end: number;
  confidence: number;
}

// Pattern-based NER rules for common entity types
const ENTITY_PATTERNS: { type: EntityType; pattern: RegExp; confidence: number }[] = [
  // EMAIL: standard email pattern
  { type: 'EMAIL', pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, confidence: 0.98 },
  // URL: http/https URLs
  { type: 'URL', pattern: /https?:\/\/[^\s<>\"']+/g, confidence: 0.97 },
  // PHONE: various phone formats
  { type: 'PHONE', pattern: /(?:\+\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g, confidence: 0.85 },
  // DATE: common date patterns
  { type: 'DATE', pattern: /\b(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})\b/gi, confidence: 0.92 },
  // MONEY: currency amounts
  { type: 'MONEY', pattern: /(?:\$|EUR|GBP|USD|JPY)\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?(?:\s?(?:million|billion|thousand|M|B|K))?\b/gi, confidence: 0.9 },
];

// Title-cased word sequences indicate PERSON, ORG, LOC candidates
const TITLE_CASE_SEQUENCE = /\b([A-Z][a-z]+(?:\s+(?:of|the|and|de|van|von|al|el)\s+)?(?:[A-Z][a-z]+\s*){0,4})\b/g;

// Context clue words for disambiguation
const PERSON_INDICATORS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sir', 'president', 'ceo', 'director',
  'said', 'told', 'according', 'born', 'died', 'married', 'senator', 'minister',
]);
const ORG_INDICATORS = new Set([
  'inc', 'corp', 'ltd', 'llc', 'company', 'organization', 'foundation',
  'university', 'institute', 'bank', 'group', 'association', 'commission',
]);
const LOC_INDICATORS = new Set([
  'city', 'state', 'country', 'river', 'mountain', 'island', 'street',
  'avenue', 'boulevard', 'county', 'province', 'district', 'republic',
]);
const EVENT_INDICATORS = new Set([
  'conference', 'summit', 'festival', 'championship', 'olympics', 'election',
  'ceremony', 'tournament', 'expo', 'convention', 'meeting', 'war', 'battle',
]);

function getContextWords(text: string, start: number, end: number, windowSize: number): string[] {
  const before = text.slice(Math.max(0, start - windowSize), start).toLowerCase();
  const after = text.slice(end, Math.min(text.length, end + windowSize)).toLowerCase();
  return (before + ' ' + after).split(/\s+/).filter(Boolean);
}

function classifyTitleCaseEntity(
  text: string,
  fullContent: string,
  start: number,
  end: number,
): { type: EntityType; confidence: number } | null {
  const contextWords = getContextWords(fullContent, start, end, 100);
  const entityWords = text.toLowerCase().split(/\s+/);

  // Check organization indicators (suffix-based are high confidence)
  const orgSuffixes = ['inc', 'corp', 'ltd', 'llc', 'co'];
  if (orgSuffixes.some((s) => entityWords[entityWords.length - 1] === s)) {
    return { type: 'ORG', confidence: 0.92 };
  }
  if (contextWords.some((w) => ORG_INDICATORS.has(w)) || entityWords.some((w) => ORG_INDICATORS.has(w))) {
    return { type: 'ORG', confidence: 0.78 };
  }

  // Check person indicators
  if (contextWords.some((w) => PERSON_INDICATORS.has(w))) {
    return { type: 'PERSON', confidence: 0.82 };
  }
  // 2-3 word title case with no org/loc clue often indicates person
  if (entityWords.length >= 2 && entityWords.length <= 3) {
    const allCapitalized = text.split(/\s+/).every((w) => /^[A-Z]/.test(w));
    if (allCapitalized) return { type: 'PERSON', confidence: 0.65 };
  }

  // Check location indicators
  if (contextWords.some((w) => LOC_INDICATORS.has(w)) || entityWords.some((w) => LOC_INDICATORS.has(w))) {
    return { type: 'LOC', confidence: 0.75 };
  }

  // Check event indicators
  if (contextWords.some((w) => EVENT_INDICATORS.has(w)) || entityWords.some((w) => EVENT_INDICATORS.has(w))) {
    return { type: 'EVENT', confidence: 0.7 };
  }

  // If no strong signal, skip low-confidence guesses
  return null;
}

function deduplicateEntities(entities: Entity[]): Entity[] {
  // Remove overlapping entities, preferring higher confidence
  entities.sort((a, b) => b.confidence - a.confidence);
  const result: Entity[] = [];
  for (const entity of entities) {
    const overlaps = result.some(
      (e) => entity.start < e.end && entity.end > e.start,
    );
    if (!overlaps) {
      result.push(entity);
    }
  }
  return result.sort((a, b) => a.start - b.start);
}

export class NerExtractEnricherProvider {
  async enrich(item: ContentItem, config: EnricherConfig): Promise<EnrichmentResult> {
    const entityTypes = (config.options?.entityTypes as EntityType[]) ?? [
      'PERSON', 'ORG', 'LOC', 'EVENT', 'DATE', 'MONEY', 'EMAIL', 'URL', 'PHONE',
    ];
    const threshold = config.threshold ?? 0.5;
    const text = item.content;

    const entities: Entity[] = [];

    // Apply regex-based patterns for structured entity types
    for (const { type, pattern, confidence } of ENTITY_PATTERNS) {
      if (!entityTypes.includes(type)) continue;
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          text: match[0],
          type,
          start: match.index,
          end: match.index + match[0].length,
          confidence,
        });
      }
    }

    // Apply title-case sequence matching for PERSON, ORG, LOC, EVENT
    const titleTypes: EntityType[] = ['PERSON', 'ORG', 'LOC', 'EVENT'];
    if (titleTypes.some((t) => entityTypes.includes(t))) {
      TITLE_CASE_SEQUENCE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = TITLE_CASE_SEQUENCE.exec(text)) !== null) {
        const candidateText = match[1].trim();
        // Skip single common words that happen to be capitalized at sentence start
        if (candidateText.split(/\s+/).length < 2 && match.index > 0 && text[match.index - 1] !== '.') {
          continue;
        }

        const classification = classifyTitleCaseEntity(
          candidateText, text, match.index, match.index + candidateText.length,
        );
        if (classification && entityTypes.includes(classification.type)) {
          entities.push({
            text: candidateText,
            type: classification.type,
            start: match.index,
            end: match.index + candidateText.length,
            confidence: classification.confidence,
          });
        }
      }
    }

    // Filter by threshold and deduplicate
    const filtered = deduplicateEntities(
      entities.filter((e) => e.confidence >= threshold),
    );

    const avgConfidence = filtered.length > 0
      ? filtered.reduce((sum, e) => sum + e.confidence, 0) / filtered.length
      : 0;

    return {
      fields: {
        entities: filtered,
        entity_count: filtered.length,
        entity_type_counts: entityTypes.reduce((acc, type) => {
          acc[type] = filtered.filter((e) => e.type === type).length;
          return acc;
        }, {} as Record<string, number>),
      },
      confidence: avgConfidence,
      metadata: {
        provider: PROVIDER_ID,
        entityTypes,
        threshold,
        mode: 'pattern_based',
      },
    };
  }

  appliesTo(schema: SchemaRef): boolean {
    const textSchemas = ['text', 'article', 'document', 'content', 'post', 'message', 'note'];
    return textSchemas.some((s) => schema.name.toLowerCase().includes(s));
  }

  costEstimate(item: ContentItem): CostEstimate {
    const charCount = item.content.length;
    // Pattern-based NER: ~0.1ms per 100 chars
    const durationMs = Math.max(10, Math.ceil(charCount / 1000));
    return { durationMs, apiCalls: 0 };
  }
}

export default NerExtractEnricherProvider;
