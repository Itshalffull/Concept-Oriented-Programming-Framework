// Quality Rule Provider: No Duplicates (Record-Level Deduplication)
// Detects duplicate records using exact match, fuzzy, or phonetic strategies.
// Dimension: uniqueness

export const PROVIDER_ID = 'no_duplicates';
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

interface RecordSignature {
  id: string;
  fields: Record<string, string>;
}

export class NoDuplicatesQualityProvider {
  private seenRecords: RecordSignature[] = [];

  validate(
    _value: unknown,
    field: FieldDef,
    record: Record<string, unknown>,
    config: RuleConfig
  ): RuleResult {
    const fields = (config.options?.fields as string[]) ?? [field.name];
    const strategy = (config.options?.strategy as string) ?? 'exact';
    const threshold = config.threshold ?? 0.8;
    const recordId = (record._id as string) ?? String(this.seenRecords.length);

    const signature: Record<string, string> = {};
    for (const f of fields) {
      signature[f] = String(record[f] ?? '');
    }

    const duplicates: string[] = [];
    for (const seen of this.seenRecords) {
      const isDup = this.compareRecords(signature, seen.fields, strategy, threshold);
      if (isDup) {
        duplicates.push(seen.id);
      }
    }

    this.seenRecords.push({ id: recordId, fields: signature });

    if (duplicates.length > 0) {
      return {
        valid: false,
        message: `Record '${recordId}' is a duplicate of [${duplicates.join(', ')}] using '${strategy}' strategy on fields [${fields.join(', ')}].`,
        severity: 'warning',
      };
    }

    return { valid: true, severity: 'warning' };
  }

  private compareRecords(
    a: Record<string, string>,
    b: Record<string, string>,
    strategy: string,
    threshold: number
  ): boolean {
    const keys = Object.keys(a);

    switch (strategy) {
      case 'exact':
        return keys.every((k) => a[k] === b[k]);

      case 'fuzzy': {
        const similarities = keys.map((k) => this.levenshteinSimilarity(a[k], b[k]));
        const avgSimilarity = similarities.reduce((s, v) => s + v, 0) / similarities.length;
        return avgSimilarity >= threshold;
      }

      case 'phonetic': {
        return keys.every((k) => this.soundex(a[k]) === this.soundex(b[k]));
      }

      default:
        return keys.every((k) => a[k] === b[k]);
    }
  }

  private levenshteinSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1.0;

    const matrix: number[][] = [];
    for (let i = 0; i <= a.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[a.length][b.length];
    return 1.0 - distance / maxLen;
  }

  private soundex(str: string): string {
    const s = str.toUpperCase().replace(/[^A-Z]/g, '');
    if (s.length === 0) return '0000';

    const codes: Record<string, string> = {
      B: '1', F: '1', P: '1', V: '1',
      C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
      D: '3', T: '3',
      L: '4',
      M: '5', N: '5',
      R: '6',
    };

    let result = s[0];
    let lastCode = codes[s[0]] ?? '';

    for (let i = 1; i < s.length && result.length < 4; i++) {
      const code = codes[s[i]] ?? '';
      if (code && code !== lastCode) {
        result += code;
      }
      lastCode = code || lastCode;
    }

    return result.padEnd(4, '0');
  }

  appliesTo(_field: FieldDef): boolean {
    return true;
  }

  dimension(): QualityDimension {
    return 'uniqueness';
  }

  reset(): void {
    this.seenRecords = [];
  }
}

export default NoDuplicatesQualityProvider;
