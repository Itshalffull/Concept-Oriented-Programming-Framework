// Quality Rule Provider: Type Check Validation
// Validates that field values match their declared type.
// Dimension: validity

export const PROVIDER_ID = 'type_check';
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

export class TypeCheckQualityProvider {
  validate(
    value: unknown,
    field: FieldDef,
    _record: Record<string, unknown>,
    config: RuleConfig
  ): RuleResult {
    if (value === null || value === undefined) {
      return { valid: true, severity: 'error' };
    }

    const strict = config.options?.strict === true;
    const declaredType = field.type.toLowerCase();
    const result = this.checkType(value, declaredType, strict);

    if (!result.valid) {
      return {
        valid: false,
        message: `Field '${field.name}' expected type '${declaredType}' but received incompatible value.`,
        severity: 'error',
      };
    }

    return { valid: true, severity: 'error' };
  }

  private checkType(value: unknown, declaredType: string, strict: boolean): { valid: boolean } {
    switch (declaredType) {
      case 'string':
        if (strict) {
          return { valid: typeof value === 'string' };
        }
        return { valid: typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' };

      case 'number':
      case 'integer':
      case 'float':
        if (typeof value === 'number') {
          if (declaredType === 'integer' && !Number.isInteger(value)) {
            return { valid: !strict };
          }
          return { valid: !isNaN(value) };
        }
        if (!strict && typeof value === 'string') {
          const parsed = Number(value);
          if (!isNaN(parsed)) {
            if (declaredType === 'integer') {
              return { valid: Number.isInteger(parsed) };
            }
            return { valid: true };
          }
        }
        return { valid: false };

      case 'boolean':
        if (typeof value === 'boolean') return { valid: true };
        if (!strict && typeof value === 'string') {
          return { valid: value === 'true' || value === 'false' };
        }
        return { valid: false };

      case 'date':
      case 'datetime':
        if (value instanceof Date) {
          return { valid: !isNaN(value.getTime()) };
        }
        if (typeof value === 'string') {
          const parsed = Date.parse(value);
          return { valid: !isNaN(parsed) };
        }
        return { valid: false };

      case 'array':
        return { valid: Array.isArray(value) };

      case 'object':
        return { valid: typeof value === 'object' && !Array.isArray(value) && value !== null };

      default:
        return { valid: true };
    }
  }

  appliesTo(_field: FieldDef): boolean {
    return true;
  }

  dimension(): QualityDimension {
    return 'validity';
  }
}

export default TypeCheckQualityProvider;
