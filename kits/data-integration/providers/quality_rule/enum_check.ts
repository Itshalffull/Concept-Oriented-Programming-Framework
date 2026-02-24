// Quality Rule Provider: Enum Check Validation
// Validates that field values belong to a set of allowed values.
// Dimension: validity

export const PROVIDER_ID = 'enum_check';
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

export class EnumCheckQualityProvider {
  validate(
    value: unknown,
    field: FieldDef,
    _record: Record<string, unknown>,
    config: RuleConfig
  ): RuleResult {
    if (value === null || value === undefined) {
      return { valid: true, severity: 'warning' };
    }

    const allowedValues = config.options?.values as unknown[] | undefined;
    if (!allowedValues || !Array.isArray(allowedValues) || allowedValues.length === 0) {
      return {
        valid: false,
        message: `Enum check for field '${field.name}' is misconfigured: no allowed values provided.`,
        severity: 'warning',
      };
    }

    const caseSensitive = config.options?.caseSensitive !== false;
    const stringValue = String(value);

    let isAllowed: boolean;
    if (caseSensitive) {
      isAllowed = allowedValues.some((allowed) => {
        if (typeof allowed === typeof value) return allowed === value;
        return String(allowed) === stringValue;
      });
    } else {
      const lowerValue = stringValue.toLowerCase();
      isAllowed = allowedValues.some((allowed) => String(allowed).toLowerCase() === lowerValue);
    }

    if (!isAllowed) {
      const allowedList = allowedValues.map(String).join(', ');
      return {
        valid: false,
        message: `Field '${field.name}' value '${stringValue}' is not in the allowed set [${allowedList}].`,
        severity: 'error',
      };
    }

    return { valid: true, severity: 'error' };
  }

  appliesTo(_field: FieldDef): boolean {
    return true;
  }

  dimension(): QualityDimension {
    return 'validity';
  }
}

export default EnumCheckQualityProvider;
