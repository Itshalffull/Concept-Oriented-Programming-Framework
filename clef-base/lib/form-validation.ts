/**
 * Client-side field validation engine for Clef Base forms.
 * Validates field values against declarative ValidationRule arrays.
 *
 * See architecture doc Section 10.1 for content-native schema patterns.
 */

export interface ValidationRule {
  type:
    | 'required'
    | 'min-length'
    | 'max-length'
    | 'min-value'
    | 'max-value'
    | 'regex'
    | 'allowed-values'
    | 'unique'
    | 'custom-expression';
  params: Record<string, unknown>;
  message?: string; // custom error message override
}

/**
 * Interpolate {param} placeholders in a message template.
 * E.g. "Must be at least {min} characters" with params { min: 3 } → "Must be at least 3 characters"
 */
function interpolate(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = params[key];
    return val !== undefined && val !== null ? String(val) : `{${key}}`;
  });
}

/**
 * Resolve the error message for a rule: use rule.message if set (with interpolation),
 * otherwise use the supplied default (also interpolated).
 */
function resolveMessage(rule: ValidationRule, defaultTemplate: string): string {
  const template = rule.message ?? defaultTemplate;
  return interpolate(template, rule.params);
}

/**
 * Return true if the value is "empty" for purposes of skipping non-required rules.
 * null, undefined, "", and [] are considered empty.
 */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/**
 * Validate a single field value against an array of rules.
 * Returns an array of error messages (empty array = valid).
 *
 * Edge cases:
 * - null, undefined, "", and [] pass all rules except 'required'
 * - Number rules coerce string values to numbers
 * - Invalid regex patterns produce an error rather than throwing
 */
export function validateField(value: unknown, rules: ValidationRule[]): string[] {
  const errors: string[] = [];

  for (const rule of rules) {
    switch (rule.type) {
      case 'required': {
        if (isEmpty(value)) {
          errors.push(resolveMessage(rule, 'This field is required'));
        }
        break;
      }

      case 'min-length': {
        if (isEmpty(value)) break; // non-required rule: skip empty values
        const str = typeof value === 'string' ? value : String(value);
        const min = rule.params.min as number;
        if (str.length < min) {
          errors.push(resolveMessage(rule, 'Must be at least {min} characters'));
        }
        break;
      }

      case 'max-length': {
        if (isEmpty(value)) break;
        const str = typeof value === 'string' ? value : String(value);
        const max = rule.params.max as number;
        if (str.length > max) {
          errors.push(resolveMessage(rule, 'Must be at most {max} characters'));
        }
        break;
      }

      case 'min-value': {
        if (isEmpty(value)) break;
        const num = typeof value === 'number' ? value : Number(value);
        const min = rule.params.min as number;
        if (!isNaN(num) && num < min) {
          errors.push(resolveMessage(rule, 'Must be at least {min}'));
        }
        break;
      }

      case 'max-value': {
        if (isEmpty(value)) break;
        const num = typeof value === 'number' ? value : Number(value);
        const max = rule.params.max as number;
        if (!isNaN(num) && num > max) {
          errors.push(resolveMessage(rule, 'Must be at most {max}'));
        }
        break;
      }

      case 'regex': {
        if (isEmpty(value)) break;
        const str = typeof value === 'string' ? value : String(value);
        const pattern = rule.params.pattern as string;
        const flags = (rule.params.flags as string | undefined) ?? '';
        let regex: RegExp;
        try {
          regex = new RegExp(pattern, flags);
        } catch {
          // Invalid regex pattern — treat as validation failure
          errors.push(resolveMessage(rule, 'Invalid format'));
          break;
        }
        if (!regex.test(str)) {
          errors.push(resolveMessage(rule, 'Invalid format'));
        }
        break;
      }

      case 'allowed-values': {
        if (isEmpty(value)) break;
        const allowedValues = rule.params.values as string[];
        const strValue = String(value);
        if (!allowedValues.includes(strValue)) {
          const valuesDisplay = allowedValues.join(', ');
          const message = resolveMessage(rule, `Must be one of: ${valuesDisplay}`);
          errors.push(message);
        }
        break;
      }

      case 'unique': {
        if (isEmpty(value)) break;
        const existingValues = (rule.params.existingValues ?? []) as unknown[];
        const isDuplicate = existingValues.some((existing) => {
          if (existing === null || existing === undefined) return false;
          return String(existing) === String(value);
        });
        if (isDuplicate) {
          errors.push(resolveMessage(rule, 'Must be unique'));
        }
        break;
      }

      case 'custom-expression': {
        if (isEmpty(value)) break;
        // Custom expressions are evaluated as boolean JS expressions.
        // The expression receives 'value' as a variable in scope.
        // Invalid/throwing expressions produce a validation failure.
        const expression = rule.params.expression as string;
        try {
          // eslint-disable-next-line no-new-func
          const fn = new Function('value', `return !!(${expression})`);
          const passed = fn(value) as boolean;
          if (!passed) {
            errors.push(resolveMessage(rule, 'Validation failed'));
          }
        } catch {
          errors.push(resolveMessage(rule, 'Validation failed'));
        }
        break;
      }
    }
  }

  return errors;
}

/**
 * Validate all fields in a form against their rule sets.
 * Returns a map of fieldId → array of error messages.
 * Fields with no errors are included with an empty array.
 */
export function validateForm(
  values: Record<string, unknown>,
  fieldRules: Record<string, ValidationRule[]>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const [fieldId, rules] of Object.entries(fieldRules)) {
    const value = values[fieldId];
    result[fieldId] = validateField(value, rules);
  }

  return result;
}

/**
 * Parse validation rules from a FieldDefinition's `validations` JSON string.
 * Returns an empty array on invalid or missing input.
 */
export function parseValidationRules(validationsJson: string): ValidationRule[] {
  if (!validationsJson || validationsJson.trim() === '') return [];
  try {
    const parsed = JSON.parse(validationsJson);
    if (!Array.isArray(parsed)) return [];
    // Filter to objects that have a valid `type` field
    return parsed.filter(
      (item): item is ValidationRule =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.type === 'string',
    );
  } catch {
    return [];
  }
}
