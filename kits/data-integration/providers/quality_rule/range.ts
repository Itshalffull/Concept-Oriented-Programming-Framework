// Quality Rule Provider: Range Validation
// Checks numeric or date values fall within min/max bounds.
// Dimension: validity

export const PROVIDER_ID = 'range';
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

export class RangeQualityProvider {
  validate(
    value: unknown,
    field: FieldDef,
    _record: Record<string, unknown>,
    config: RuleConfig
  ): RuleResult {
    if (value === null || value === undefined) {
      return { valid: true, severity: 'warning' };
    }

    const min = config.options?.min;
    const max = config.options?.max;
    const exclusiveMin = config.options?.exclusiveMin === true;
    const exclusiveMax = config.options?.exclusiveMax === true;
    const isDateField = field.type === 'date' || field.type === 'datetime';

    if (isDateField) {
      return this.validateDateRange(value, field, min, max, exclusiveMin, exclusiveMax);
    }

    return this.validateNumericRange(value, field, min, max, exclusiveMin, exclusiveMax);
  }

  private validateNumericRange(
    value: unknown,
    field: FieldDef,
    min: unknown,
    max: unknown,
    exclusiveMin: boolean,
    exclusiveMax: boolean
  ): RuleResult {
    const num = typeof value === 'number' ? value : Number(value);
    if (isNaN(num)) {
      return {
        valid: false,
        message: `Field '${field.name}' value cannot be parsed as a number for range check.`,
        severity: 'error',
      };
    }

    if (min !== undefined && min !== null) {
      const minVal = Number(min);
      if (!isNaN(minVal)) {
        if (exclusiveMin ? num <= minVal : num < minVal) {
          return {
            valid: false,
            message: `Field '${field.name}' value ${num} is below the minimum ${exclusiveMin ? '(exclusive)' : '(inclusive)'} of ${minVal}.`,
            severity: 'error',
          };
        }
      }
    }

    if (max !== undefined && max !== null) {
      const maxVal = Number(max);
      if (!isNaN(maxVal)) {
        if (exclusiveMax ? num >= maxVal : num > maxVal) {
          return {
            valid: false,
            message: `Field '${field.name}' value ${num} is above the maximum ${exclusiveMax ? '(exclusive)' : '(inclusive)'} of ${maxVal}.`,
            severity: 'error',
          };
        }
      }
    }

    return { valid: true, severity: 'error' };
  }

  private validateDateRange(
    value: unknown,
    field: FieldDef,
    min: unknown,
    max: unknown,
    exclusiveMin: boolean,
    exclusiveMax: boolean
  ): RuleResult {
    const timestamp = value instanceof Date ? value.getTime() : Date.parse(String(value));
    if (isNaN(timestamp)) {
      return {
        valid: false,
        message: `Field '${field.name}' value cannot be parsed as a date for range check.`,
        severity: 'error',
      };
    }

    if (min !== undefined && min !== null) {
      const minTs = Date.parse(String(min));
      if (!isNaN(minTs)) {
        if (exclusiveMin ? timestamp <= minTs : timestamp < minTs) {
          return {
            valid: false,
            message: `Field '${field.name}' date is before the minimum allowed date.`,
            severity: 'error',
          };
        }
      }
    }

    if (max !== undefined && max !== null) {
      const maxTs = Date.parse(String(max));
      if (!isNaN(maxTs)) {
        if (exclusiveMax ? timestamp >= maxTs : timestamp > maxTs) {
          return {
            valid: false,
            message: `Field '${field.name}' date is after the maximum allowed date.`,
            severity: 'error',
          };
        }
      }
    }

    return { valid: true, severity: 'error' };
  }

  appliesTo(field: FieldDef): boolean {
    const numericTypes = ['number', 'integer', 'float', 'date', 'datetime'];
    return numericTypes.includes(field.type.toLowerCase());
  }

  dimension(): QualityDimension {
    return 'validity';
  }
}

export default RangeQualityProvider;
