// Quality Rule Provider: Cross-Field Validation
// Evaluates multi-field validation expressions across record fields.
// Dimension: consistency

export const PROVIDER_ID = 'cross_field';
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

export class CrossFieldQualityProvider {
  validate(
    _value: unknown,
    field: FieldDef,
    record: Record<string, unknown>,
    config: RuleConfig
  ): RuleResult {
    const expression = config.options?.expression as string | undefined;
    const fields = config.options?.fields as string[] | undefined;

    if (!expression) {
      return {
        valid: false,
        message: `Cross-field rule for '${field.name}' is misconfigured: no expression provided.`,
        severity: 'error',
      };
    }

    if (!fields || fields.length === 0) {
      return {
        valid: false,
        message: `Cross-field rule for '${field.name}' is misconfigured: no fields specified.`,
        severity: 'error',
      };
    }

    try {
      const result = this.evaluateExpression(expression, fields, record);
      if (!result) {
        return {
          valid: false,
          message: `Cross-field validation failed for '${field.name}': expression '${expression}' evaluated to false.`,
          severity: 'error',
        };
      }
      return { valid: true, severity: 'error' };
    } catch (err) {
      return {
        valid: false,
        message: `Cross-field rule evaluation error for '${field.name}': ${(err as Error).message}`,
        severity: 'error',
      };
    }
  }

  private evaluateExpression(
    expression: string,
    fields: string[],
    record: Record<string, unknown>
  ): boolean {
    // Handle comparison expressions: field_a > field_b, field_a >= field_b, etc.
    const comparisonMatch = expression.match(
      /^(\w+)\s*(>|>=|<|<=|==|!=)\s*(\w+)$/
    );
    if (comparisonMatch) {
      const [, leftField, operator, rightField] = comparisonMatch;
      const leftVal = this.resolveValue(record[leftField]);
      const rightVal = this.resolveValue(record[rightField]);

      if (leftVal === null || rightVal === null) return true;

      switch (operator) {
        case '>': return leftVal > rightVal;
        case '>=': return leftVal >= rightVal;
        case '<': return leftVal < rightVal;
        case '<=': return leftVal <= rightVal;
        case '==': return leftVal === rightVal;
        case '!=': return leftVal !== rightVal;
        default: return false;
      }
    }

    // Handle conditional required: if field_a == "value" then field_b required
    const conditionalMatch = expression.match(
      /^if\s+(\w+)\s*==\s*"([^"]*)"\s+then\s+(\w+)\s+required$/
    );
    if (conditionalMatch) {
      const [, condField, condValue, reqField] = conditionalMatch;
      const fieldVal = record[condField];
      if (String(fieldVal) === condValue) {
        const reqVal = record[reqField];
        return reqVal !== null && reqVal !== undefined && reqVal !== '';
      }
      return true;
    }

    // Handle mutual exclusion: exactly_one_of(field_a, field_b, ...)
    const mutexMatch = expression.match(/^exactly_one_of\(([^)]+)\)$/);
    if (mutexMatch) {
      const mutexFields = mutexMatch[1].split(',').map((f) => f.trim());
      const presentCount = mutexFields.filter((f) => {
        const v = record[f];
        return v !== null && v !== undefined && v !== '';
      }).length;
      return presentCount === 1;
    }

    // Handle at_least_one_of(field_a, field_b, ...)
    const atLeastMatch = expression.match(/^at_least_one_of\(([^)]+)\)$/);
    if (atLeastMatch) {
      const checkFields = atLeastMatch[1].split(',').map((f) => f.trim());
      return checkFields.some((f) => {
        const v = record[f];
        return v !== null && v !== undefined && v !== '';
      });
    }

    // Fallback: use Function constructor for simple JS boolean expressions
    const context: Record<string, unknown> = {};
    for (const f of fields) {
      context[f] = record[f];
    }
    const paramNames = Object.keys(context);
    const paramValues = Object.values(context);
    const fn = new Function(...paramNames, `return Boolean(${expression});`);
    return fn(...paramValues);
  }

  private resolveValue(val: unknown): number | null {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    const dateTs = Date.parse(String(val));
    if (!isNaN(dateTs)) return dateTs;
    const num = Number(val);
    return isNaN(num) ? null : num;
  }

  appliesTo(_field: FieldDef): boolean {
    return true;
  }

  dimension(): QualityDimension {
    return 'consistency';
  }
}

export default CrossFieldQualityProvider;
