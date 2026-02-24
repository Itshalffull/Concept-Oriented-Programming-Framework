// Quality Rule Provider: Reconciliation Validation
// Matches field values against external knowledge bases for accuracy verification.
// Dimension: accuracy

export const PROVIDER_ID = 'reconciliation';
export const PLUGIN_TYPE = 'quality_rule';

export interface FieldDef {
  name: string;
  type: string;
  required?: boolean;
  constraints?: Record<string, unknown>;
}

export interface RuleConfig {
  options?: Record<string, unknown>;
  threshold?: number;
}

export interface RuleResult {
  valid: boolean;
  message?: string;
  severity: 'error' | 'warning' | 'info';
}

export type QualityDimension = 'completeness' | 'uniqueness' | 'validity' | 'consistency' | 'timeliness' | 'accuracy';

interface KBMatch {
  canonicalValue: string;
  confidence: number;
  source: string;
}

type KBQueryFn = (value: string, config: Record<string, unknown>) => Promise<KBMatch[]>;

export class ReconciliationQualityProvider {
  private knowledgeBaseHandlers: Map<string, KBQueryFn> = new Map();

  constructor() {
    this.registerDefaultHandlers();
  }

  /**
   * Register a custom knowledge base query handler.
   */
  registerKnowledgeBase(name: string, handler: KBQueryFn): void {
    this.knowledgeBaseHandlers.set(name, handler);
  }

  async validateAsync(
    value: unknown,
    field: FieldDef,
    _record: Record<string, unknown>,
    config: RuleConfig
  ): Promise<RuleResult> {
    if (value === null || value === undefined) {
      return { valid: true, severity: 'info' };
    }

    const knowledgeBase = (config.options?.knowledgeBase as string) ?? 'wikidata';
    const matchThreshold = config.threshold ?? 0.8;
    const stringValue = String(value);

    const handler = this.knowledgeBaseHandlers.get(knowledgeBase);
    if (!handler) {
      return {
        valid: false,
        message: `Reconciliation rule for '${field.name}': unknown knowledge base '${knowledgeBase}'.`,
        severity: 'warning',
      };
    }

    try {
      const matches = await handler(stringValue, config.options ?? {});

      if (matches.length === 0) {
        return {
          valid: false,
          message: `Field '${field.name}' value '${stringValue}' not found in knowledge base '${knowledgeBase}'.`,
          severity: 'warning',
        };
      }

      const bestMatch = matches.reduce((best, m) =>
        m.confidence > best.confidence ? m : best
      );

      if (bestMatch.confidence >= matchThreshold) {
        if (bestMatch.canonicalValue !== stringValue) {
          return {
            valid: true,
            message: `Field '${field.name}': canonical form is '${bestMatch.canonicalValue}' (confidence: ${(bestMatch.confidence * 100).toFixed(1)}%, source: ${bestMatch.source}).`,
            severity: 'info',
          };
        }
        return { valid: true, severity: 'info' };
      }

      return {
        valid: false,
        message: `Field '${field.name}' value '${stringValue}' has low confidence match (${(bestMatch.confidence * 100).toFixed(1)}%) against '${knowledgeBase}'. Best match: '${bestMatch.canonicalValue}'.`,
        severity: 'warning',
      };
    } catch (err) {
      return {
        valid: false,
        message: `Reconciliation error for '${field.name}': ${(err as Error).message}`,
        severity: 'warning',
      };
    }
  }

  /**
   * Synchronous validate for interface compatibility.
   * For real KB lookups, use validateAsync instead.
   */
  validate(
    value: unknown,
    field: FieldDef,
    _record: Record<string, unknown>,
    config: RuleConfig
  ): RuleResult {
    if (value === null || value === undefined) {
      return { valid: true, severity: 'info' };
    }

    const stringValue = String(value);
    const matchThreshold = config.threshold ?? 0.8;

    // Synchronous local-dictionary check when no async KB is needed
    const localValues = config.options?.localDictionary as string[] | undefined;
    if (localValues && localValues.length > 0) {
      const bestMatch = this.findBestLocalMatch(stringValue, localValues);
      if (bestMatch.confidence >= matchThreshold) {
        if (bestMatch.canonicalValue !== stringValue) {
          return {
            valid: true,
            message: `Field '${field.name}': suggested canonical form is '${bestMatch.canonicalValue}' (similarity: ${(bestMatch.confidence * 100).toFixed(1)}%).`,
            severity: 'info',
          };
        }
        return { valid: true, severity: 'info' };
      }
      return {
        valid: false,
        message: `Field '${field.name}' value '${stringValue}' could not be reconciled. Best local match: '${bestMatch.canonicalValue}' (${(bestMatch.confidence * 100).toFixed(1)}%).`,
        severity: 'warning',
      };
    }

    return {
      valid: true,
      message: `Field '${field.name}': reconciliation requires async validation or a localDictionary config.`,
      severity: 'info',
    };
  }

  private findBestLocalMatch(
    value: string,
    candidates: string[]
  ): { canonicalValue: string; confidence: number } {
    let bestCanonical = candidates[0] ?? '';
    let bestConfidence = 0;
    const lowerValue = value.toLowerCase();

    for (const candidate of candidates) {
      const lowerCandidate = candidate.toLowerCase();
      if (lowerValue === lowerCandidate) {
        return { canonicalValue: candidate, confidence: 1.0 };
      }
      const similarity = this.jaroWinkler(lowerValue, lowerCandidate);
      if (similarity > bestConfidence) {
        bestConfidence = similarity;
        bestCanonical = candidate;
      }
    }

    return { canonicalValue: bestCanonical, confidence: bestConfidence };
  }

  private jaroWinkler(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;
    const len1 = s1.length;
    const len2 = s2.length;
    if (len1 === 0 || len2 === 0) return 0.0;

    const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);

    let matches = 0;
    let transpositions = 0;

    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - matchDistance);
      const end = Math.min(i + matchDistance + 1, len2);
      for (let j = start; j < end; j++) {
        if (s2Matches[j] || s1[i] !== s2[j]) continue;
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0.0;

    let k = 0;
    for (let i = 0; i < len1; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }

    const jaro =
      (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

    let prefix = 0;
    for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
      if (s1[i] === s2[i]) prefix++;
      else break;
    }

    return jaro + prefix * 0.1 * (1 - jaro);
  }

  private registerDefaultHandlers(): void {
    // Wikidata SPARQL handler (requires async invocation via validateAsync)
    this.knowledgeBaseHandlers.set('wikidata', async (value: string, options: Record<string, unknown>) => {
      const endpoint = (options.apiEndpoint as string) ?? 'https://www.wikidata.org/w/api.php';
      const url = `${endpoint}?action=wbsearchentities&search=${encodeURIComponent(value)}&language=en&format=json`;

      const response = await fetch(url);
      const data = await response.json() as { search?: Array<{ label: string; description?: string }> };

      if (!data.search || data.search.length === 0) return [];

      return data.search.slice(0, 5).map((item: { label: string; description?: string }) => ({
        canonicalValue: item.label,
        confidence: item.label.toLowerCase() === value.toLowerCase() ? 1.0 : 0.7,
        source: 'wikidata',
      }));
    });

    // Custom API handler
    this.knowledgeBaseHandlers.set('custom', async (value: string, options: Record<string, unknown>) => {
      const apiEndpoint = options.apiEndpoint as string | undefined;
      if (!apiEndpoint) throw new Error('Custom KB requires apiEndpoint configuration.');

      const response = await fetch(`${apiEndpoint}?q=${encodeURIComponent(value)}`);
      const data = await response.json() as { results?: Array<{ value: string; score: number }> };

      return (data.results ?? []).map((r: { value: string; score: number }) => ({
        canonicalValue: r.value,
        confidence: r.score,
        source: 'custom',
      }));
    });
  }

  appliesTo(field: FieldDef): boolean {
    return field.type.toLowerCase() === 'string';
  }

  dimension(): QualityDimension {
    return 'accuracy';
  }
}

export default ReconciliationQualityProvider;
