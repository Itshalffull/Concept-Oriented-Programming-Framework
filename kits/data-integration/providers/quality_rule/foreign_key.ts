// Quality Rule Provider: Foreign Key Validation
// Ensures referenced entities exist in the target content type's storage.
// Dimension: consistency

export const PROVIDER_ID = 'foreign_key';
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

export class ForeignKeyQualityProvider {
  private referenceStore: Map<string, Set<string>> = new Map();

  /**
   * Register known reference values for a given target type and field.
   * This populates the internal store used for validation lookups.
   */
  registerReferences(targetType: string, targetField: string, values: unknown[]): void {
    const key = `${targetType}::${targetField}`;
    if (!this.referenceStore.has(key)) {
      this.referenceStore.set(key, new Set());
    }
    const store = this.referenceStore.get(key)!;
    for (const v of values) {
      store.add(String(v));
    }
  }

  validate(
    value: unknown,
    field: FieldDef,
    _record: Record<string, unknown>,
    config: RuleConfig
  ): RuleResult {
    if (value === null || value === undefined) {
      return { valid: true, severity: 'error' };
    }

    const targetType = config.options?.targetType as string | undefined;
    const targetField = config.options?.targetField as string | undefined;

    if (!targetType || !targetField) {
      return {
        valid: false,
        message: `Foreign key rule for field '${field.name}' is misconfigured: targetType and targetField are required.`,
        severity: 'error',
      };
    }

    const storeKey = `${targetType}::${targetField}`;
    const store = this.referenceStore.get(storeKey);

    if (!store) {
      return {
        valid: false,
        message: `Foreign key rule for field '${field.name}': no reference data loaded for ${targetType}.${targetField}.`,
        severity: 'error',
      };
    }

    const refValue = String(value);
    if (!store.has(refValue)) {
      return {
        valid: false,
        message: `Field '${field.name}' references '${refValue}' which does not exist in ${targetType}.${targetField}. Dangling reference detected.`,
        severity: 'error',
      };
    }

    return { valid: true, severity: 'error' };
  }

  appliesTo(field: FieldDef): boolean {
    const refTypes = ['reference', 'foreign_key', 'fk', 'relation'];
    return refTypes.includes(field.type.toLowerCase()) || field.constraints?.foreignKey !== undefined;
  }

  dimension(): QualityDimension {
    return 'consistency';
  }
}

export default ForeignKeyQualityProvider;
