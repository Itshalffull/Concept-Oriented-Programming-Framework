// Clef Data Integration Kit - Auto-tagging enricher provider
// Classifies content into existing taxonomy using TF-IDF similarity or LLM classification.

export const PROVIDER_ID = 'auto_tag';
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

interface TaxonomyTerm {
  term: string;
  taxonomy: string;
  synonyms?: string[];
  keywords?: string[];
}

interface TagResult {
  term: string;
  taxonomy: string;
  confidence: number;
}

// Stop words to exclude from TF-IDF computation
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
  'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each',
  'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'because',
  'this', 'that', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'we',
  'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them',
]);

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function computeTermFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  // Normalize by document length
  const maxFreq = Math.max(...tf.values(), 1);
  for (const [term, freq] of tf) {
    tf.set(term, 0.5 + 0.5 * (freq / maxFreq));
  }
  return tf;
}

function buildTermVector(termOrSynonyms: string[]): Map<string, number> {
  const vector = new Map<string, number>();
  for (const word of termOrSynonyms) {
    const tokens = tokenize(word);
    for (const token of tokens) {
      vector.set(token, (vector.get(token) ?? 0) + 1);
    }
  }
  // Normalize
  const maxVal = Math.max(...vector.values(), 1);
  for (const [k, v] of vector) {
    vector.set(k, v / maxVal);
  }
  return vector;
}

function cosineSimilarity(vecA: Map<string, number>, vecB: Map<string, number>): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  const allKeys = new Set([...vecA.keys(), ...vecB.keys()]);
  for (const key of allKeys) {
    const a = vecA.get(key) ?? 0;
    const b = vecB.get(key) ?? 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 0 ? dotProduct / denominator : 0;
}

function parseTaxonomies(taxonomyConfig: unknown[]): TaxonomyTerm[] {
  const terms: TaxonomyTerm[] = [];
  for (const taxonomy of taxonomyConfig) {
    const t = taxonomy as Record<string, unknown>;
    const taxonomyName = (t.name as string) ?? 'default';
    const termsList = (t.terms as Array<Record<string, unknown>>) ?? [];

    for (const term of termsList) {
      terms.push({
        term: (term.term as string) ?? (term.name as string) ?? '',
        taxonomy: taxonomyName,
        synonyms: (term.synonyms as string[]) ?? [],
        keywords: (term.keywords as string[]) ?? [],
      });
    }
  }
  return terms;
}

export class AutoTagEnricherProvider {
  async enrich(item: ContentItem, config: EnricherConfig): Promise<EnrichmentResult> {
    const taxonomies = (config.options?.taxonomies as unknown[]) ?? [];
    const maxTags = (config.options?.maxTags as number) ?? 10;
    const threshold = config.threshold ?? 0.3;

    const terms = parseTaxonomies(taxonomies);
    const contentTokens = tokenize(item.content);
    const contentTf = computeTermFrequency(contentTokens);

    // Score each taxonomy term against content using TF-IDF cosine similarity
    const tagResults: TagResult[] = [];

    for (const taxonomyTerm of terms) {
      // Build term vector from term name + synonyms + keywords
      const termWords = [
        taxonomyTerm.term,
        ...(taxonomyTerm.synonyms ?? []),
        ...(taxonomyTerm.keywords ?? []),
      ];
      const termVector = buildTermVector(termWords);

      // Compute similarity
      let similarity = cosineSimilarity(contentTf, termVector);

      // Boost for exact term match in content
      const lowerContent = item.content.toLowerCase();
      if (lowerContent.includes(taxonomyTerm.term.toLowerCase())) {
        similarity = Math.min(1.0, similarity + 0.3);
      }

      // Boost for synonym matches
      for (const synonym of (taxonomyTerm.synonyms ?? [])) {
        if (lowerContent.includes(synonym.toLowerCase())) {
          similarity = Math.min(1.0, similarity + 0.15);
        }
      }

      if (similarity >= threshold) {
        tagResults.push({
          term: taxonomyTerm.term,
          taxonomy: taxonomyTerm.taxonomy,
          confidence: Math.round(similarity * 1000) / 1000,
        });
      }
    }

    // Sort by confidence descending and limit
    tagResults.sort((a, b) => b.confidence - a.confidence);
    const topTags = tagResults.slice(0, maxTags);

    const avgConfidence = topTags.length > 0
      ? topTags.reduce((sum, t) => sum + t.confidence, 0) / topTags.length
      : 0;

    // Group tags by taxonomy
    const tagsByTaxonomy: Record<string, TagResult[]> = {};
    for (const tag of topTags) {
      if (!tagsByTaxonomy[tag.taxonomy]) tagsByTaxonomy[tag.taxonomy] = [];
      tagsByTaxonomy[tag.taxonomy].push(tag);
    }

    return {
      fields: {
        tags: topTags,
        tag_count: topTags.length,
        tags_by_taxonomy: tagsByTaxonomy,
      },
      confidence: avgConfidence,
      metadata: {
        provider: PROVIDER_ID,
        taxonomyCount: taxonomies.length,
        termCount: terms.length,
        threshold,
        maxTags,
        mode: 'tfidf_similarity',
      },
    };
  }

  appliesTo(schema: SchemaRef): boolean {
    const applicable = ['text', 'article', 'document', 'content', 'post', 'page', 'product'];
    return applicable.some((s) => schema.name.toLowerCase().includes(s));
  }

  costEstimate(item: ContentItem): CostEstimate {
    const charCount = item.content.length;
    // TF-IDF computation: ~0.5ms per 1000 chars
    const durationMs = Math.max(5, Math.ceil(charCount / 2000));
    return { durationMs, apiCalls: 0 };
  }
}

export default AutoTagEnricherProvider;
