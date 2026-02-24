// Quality Rule Provider: Pattern (Regex) Validation
// Validates that string values match a configured regular expression.
// Dimension: validity

export const PROVIDER_ID = 'pattern';
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

export class PatternQualityProvider {
  private regexCache: Map<string, RegExp> = new Map();

  validate(
    value: unknown,
    field: FieldDef,
    _record: Record<string, unknown>,
    config: RuleConfig
  ): RuleResult {
    if (value === null || value === undefined) {
      return { valid: true, severity: 'warning' };
    }

    const patternStr = config.options?.pattern as string | undefined;
    if (!patternStr) {
      return {
        valid: false,
        message: `Pattern rule for field '${field.name}' is misconfigured: no pattern provided.`,
        severity: 'warning',
      };
    }

    const flags = (config.options?.flags as string) ?? '';
    const stringValue = String(value);

    let regex: RegExp;
    const cacheKey = `${patternStr}::${flags}`;

    if (this.regexCache.has(cacheKey)) {
      regex = this.regexCache.get(cacheKey)!;
      regex.lastIndex = 0;
    } else {
      try {
        regex = new RegExp(patternStr, flags);
        this.regexCache.set(cacheKey, regex);
      } catch (err) {
        return {
          valid: false,
          message: `Pattern rule for field '${field.name}' has an invalid regex: ${(err as Error).message}`,
          severity: 'error',
        };
      }
    }

    if (!regex.test(stringValue)) {
      return {
        valid: false,
        message: `Field '${field.name}' value '${stringValue}' does not match pattern '${patternStr}'.`,
        severity: 'error',
      };
    }

    return { valid: true, severity: 'error' };
  }

  appliesTo(field: FieldDef): boolean {
    return field.type.toLowerCase() === 'string';
  }

  dimension(): QualityDimension {
    return 'validity';
  }
}

export default PatternQualityProvider;
