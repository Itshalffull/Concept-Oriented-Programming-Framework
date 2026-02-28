// Quality Rule Provider: Required Field Validation
// Ensures fields marked as required contain non-empty values.
// Dimension: completeness

export const PROVIDER_ID = 'required';
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

export class RequiredQualityProvider {
  validate(
    value: unknown,
    field: FieldDef,
    _record: Record<string, unknown>,
    config: RuleConfig
  ): RuleResult {
    const treatWhitespaceAsEmpty = config.options?.treatWhitespaceAsEmpty === true;

    if (value === null || value === undefined) {
      return {
        valid: false,
        message: `Field '${field.name}' is required but has no value.`,
        severity: 'error',
      };
    }

    if (typeof value === 'string') {
      const testValue = treatWhitespaceAsEmpty ? value.trim() : value;
      if (testValue.length === 0) {
        return {
          valid: false,
          message: `Field '${field.name}' is required but is empty.`,
          severity: 'error',
        };
      }
    }

    if (Array.isArray(value) && value.length === 0) {
      return {
        valid: false,
        message: `Field '${field.name}' is required but is an empty array.`,
        severity: 'error',
      };
    }

    return { valid: true, severity: 'error' };
  }

  appliesTo(field: FieldDef): boolean {
    return field.required === true;
  }

  dimension(): QualityDimension {
    return 'completeness';
  }
}

export default RequiredQualityProvider;
