// Quality Rule Provider: Unique Value Validation
// Ensures field values are unique across records of the same type.
// Dimension: uniqueness

export const PROVIDER_ID = 'unique';
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

export class UniqueQualityProvider {
  private globalIndex: Set<string> = new Set();
  private scopedIndex: Map<string, Set<string>> = new Map();

  validate(
    value: unknown,
    field: FieldDef,
    record: Record<string, unknown>,
    config: RuleConfig
  ): RuleResult {
    if (value === null || value === undefined) {
      return { valid: true, severity: 'error' };
    }

    const caseSensitive = config.options?.caseSensitive !== false;
    const scope = (config.options?.scope as string) ?? 'global';
    let normalizedValue = String(value);
    if (!caseSensitive) {
      normalizedValue = normalizedValue.toLowerCase();
    }

    if (scope === 'per-type') {
      const recordType = (record._type as string) ?? '__default__';
      if (!this.scopedIndex.has(recordType)) {
        this.scopedIndex.set(recordType, new Set());
      }
      const typeIndex = this.scopedIndex.get(recordType)!;
      const key = `${field.name}::${normalizedValue}`;

      if (typeIndex.has(key)) {
        return {
          valid: false,
          message: `Field '${field.name}' value '${value}' is not unique within type '${recordType}'.`,
          severity: 'error',
        };
      }
      typeIndex.add(key);
    } else {
      const key = `${field.name}::${normalizedValue}`;
      if (this.globalIndex.has(key)) {
        return {
          valid: false,
          message: `Field '${field.name}' value '${value}' is not unique.`,
          severity: 'error',
        };
      }
      this.globalIndex.add(key);
    }

    return { valid: true, severity: 'error' };
  }

  appliesTo(field: FieldDef): boolean {
    return field.constraints?.unique === true;
  }

  dimension(): QualityDimension {
    return 'uniqueness';
  }

  /** Reset the internal index (useful between validation runs). */
  reset(): void {
    this.globalIndex.clear();
    this.scopedIndex.clear();
  }
}

export default UniqueQualityProvider;
