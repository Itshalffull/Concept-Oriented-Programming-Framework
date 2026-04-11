import { describe, it, expect } from 'vitest';
import {
  validateField,
  validateForm,
  parseValidationRules,
  type ValidationRule,
} from '../clef-base/lib/form-validation';

// ---------------------------------------------------------------------------
// validateField — required
// ---------------------------------------------------------------------------
describe('validateField — required', () => {
  const rule: ValidationRule = { type: 'required', params: {} };

  it('passes for a non-empty string', () => {
    expect(validateField('hello', [rule])).toEqual([]);
  });

  it('fails for empty string', () => {
    expect(validateField('', [rule])).toEqual(['This field is required']);
  });

  it('fails for null', () => {
    expect(validateField(null, [rule])).toEqual(['This field is required']);
  });

  it('fails for undefined', () => {
    expect(validateField(undefined, [rule])).toEqual(['This field is required']);
  });

  it('fails for empty array', () => {
    expect(validateField([], [rule])).toEqual(['This field is required']);
  });

  it('passes for a non-empty array', () => {
    expect(validateField(['a'], [rule])).toEqual([]);
  });

  it('passes for the number 0 (not empty)', () => {
    expect(validateField(0, [rule])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateField — min-length
// ---------------------------------------------------------------------------
describe('validateField — min-length', () => {
  const rule: ValidationRule = { type: 'min-length', params: { min: 3 } };

  it('passes when length >= min', () => {
    expect(validateField('abc', [rule])).toEqual([]);
    expect(validateField('abcd', [rule])).toEqual([]);
  });

  it('fails when length < min', () => {
    expect(validateField('ab', [rule])).toEqual(['Must be at least 3 characters']);
  });

  it('skips empty values (non-required rule)', () => {
    expect(validateField('', [rule])).toEqual([]);
    expect(validateField(null, [rule])).toEqual([]);
  });

  it('uses custom message with interpolation', () => {
    const customRule: ValidationRule = {
      type: 'min-length',
      params: { min: 5 },
      message: 'Need at least {min} chars',
    };
    expect(validateField('hi', [customRule])).toEqual(['Need at least 5 chars']);
  });
});

// ---------------------------------------------------------------------------
// validateField — max-length
// ---------------------------------------------------------------------------
describe('validateField — max-length', () => {
  const rule: ValidationRule = { type: 'max-length', params: { max: 5 } };

  it('passes when length <= max', () => {
    expect(validateField('hello', [rule])).toEqual([]);
  });

  it('fails when length > max', () => {
    expect(validateField('toolong', [rule])).toEqual(['Must be at most 5 characters']);
  });

  it('skips empty values', () => {
    expect(validateField('', [rule])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateField — min-value
// ---------------------------------------------------------------------------
describe('validateField — min-value', () => {
  const rule: ValidationRule = { type: 'min-value', params: { min: 10 } };

  it('passes when value >= min', () => {
    expect(validateField(10, [rule])).toEqual([]);
    expect(validateField(100, [rule])).toEqual([]);
  });

  it('fails when value < min', () => {
    expect(validateField(9, [rule])).toEqual(['Must be at least 10']);
  });

  it('coerces string to number', () => {
    expect(validateField('5', [rule])).toEqual(['Must be at least 10']);
    expect(validateField('15', [rule])).toEqual([]);
  });

  it('skips empty values', () => {
    expect(validateField(null, [rule])).toEqual([]);
    expect(validateField('', [rule])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateField — max-value
// ---------------------------------------------------------------------------
describe('validateField — max-value', () => {
  const rule: ValidationRule = { type: 'max-value', params: { max: 100 } };

  it('passes when value <= max', () => {
    expect(validateField(100, [rule])).toEqual([]);
  });

  it('fails when value > max', () => {
    expect(validateField(101, [rule])).toEqual(['Must be at most 100']);
  });

  it('coerces string to number', () => {
    expect(validateField('200', [rule])).toEqual(['Must be at most 100']);
  });
});

// ---------------------------------------------------------------------------
// validateField — regex
// ---------------------------------------------------------------------------
describe('validateField — regex', () => {
  const emailRule: ValidationRule = {
    type: 'regex',
    params: { pattern: '^[\\w.+-]+@[\\w-]+\\.[\\w.]+$' },
  };

  it('passes valid email', () => {
    expect(validateField('user@example.com', [emailRule])).toEqual([]);
  });

  it('fails invalid email', () => {
    expect(validateField('not-an-email', [emailRule])).toEqual(['Invalid format']);
  });

  it('skips empty values', () => {
    expect(validateField('', [emailRule])).toEqual([]);
  });

  it('handles invalid regex pattern gracefully (returns error, does not throw)', () => {
    const badRule: ValidationRule = {
      type: 'regex',
      params: { pattern: '[invalid(regex' },
    };
    expect(() => validateField('anything', [badRule])).not.toThrow();
    expect(validateField('anything', [badRule])).toEqual(['Invalid format']);
  });

  it('supports flags', () => {
    const caseRule: ValidationRule = {
      type: 'regex',
      params: { pattern: '^hello$', flags: 'i' },
    };
    expect(validateField('HELLO', [caseRule])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateField — allowed-values
// ---------------------------------------------------------------------------
describe('validateField — allowed-values', () => {
  const rule: ValidationRule = {
    type: 'allowed-values',
    params: { values: ['draft', 'published', 'archived'] },
  };

  it('passes for a value in the allowed list', () => {
    expect(validateField('draft', [rule])).toEqual([]);
    expect(validateField('published', [rule])).toEqual([]);
  });

  it('fails for a value not in the allowed list', () => {
    const errors = validateField('unknown', [rule]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('draft');
    expect(errors[0]).toContain('published');
    expect(errors[0]).toContain('archived');
  });

  it('skips empty values', () => {
    expect(validateField('', [rule])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateField — unique
// ---------------------------------------------------------------------------
describe('validateField — unique', () => {
  const rule: ValidationRule = {
    type: 'unique',
    params: { existingValues: ['alice', 'bob', 'carol'] },
  };

  it('passes for a new unique value', () => {
    expect(validateField('dave', [rule])).toEqual([]);
  });

  it('fails when value already exists', () => {
    expect(validateField('alice', [rule])).toEqual(['Must be unique']);
  });

  it('skips empty values', () => {
    expect(validateField('', [rule])).toEqual([]);
  });

  it('passes when existingValues is not provided', () => {
    const ruleNoExisting: ValidationRule = { type: 'unique', params: {} };
    expect(validateField('anything', [ruleNoExisting])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateField — custom-expression
// ---------------------------------------------------------------------------
describe('validateField — custom-expression', () => {
  it('passes when expression evaluates to true', () => {
    const rule: ValidationRule = {
      type: 'custom-expression',
      params: { expression: 'value > 0' },
    };
    expect(validateField(5, [rule])).toEqual([]);
  });

  it('fails when expression evaluates to false', () => {
    const rule: ValidationRule = {
      type: 'custom-expression',
      params: { expression: 'value > 0' },
    };
    expect(validateField(-1, [rule])).toEqual(['Validation failed']);
  });

  it('fails gracefully when expression throws', () => {
    const rule: ValidationRule = {
      type: 'custom-expression',
      params: { expression: 'value.nonexistent.deep.access' },
    };
    expect(() => validateField('text', [rule])).not.toThrow();
    expect(validateField('text', [rule])).toEqual(['Validation failed']);
  });

  it('skips empty values', () => {
    const rule: ValidationRule = {
      type: 'custom-expression',
      params: { expression: 'false' },
    };
    expect(validateField('', [rule])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateField — multiple rules
// ---------------------------------------------------------------------------
describe('validateField — multiple rules', () => {
  it('collects errors from multiple failing rules', () => {
    const rules: ValidationRule[] = [
      { type: 'required', params: {} },
      { type: 'min-length', params: { min: 5 } },
    ];
    // Empty string fails required; min-length skips empty values
    const errors = validateField('', rules);
    expect(errors).toContain('This field is required');
    expect(errors).toHaveLength(1);
  });

  it('returns no errors when all rules pass', () => {
    const rules: ValidationRule[] = [
      { type: 'required', params: {} },
      { type: 'min-length', params: { min: 3 } },
      { type: 'max-length', params: { max: 20 } },
    ];
    expect(validateField('hello', rules)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateForm
// ---------------------------------------------------------------------------
describe('validateForm', () => {
  it('validates all fields and returns a map of field errors', () => {
    const values = { name: '', age: 5 };
    const fieldRules: Record<string, ValidationRule[]> = {
      name: [{ type: 'required', params: {} }],
      age: [{ type: 'min-value', params: { min: 18 } }],
    };
    const result = validateForm(values, fieldRules);
    expect(result.name).toEqual(['This field is required']);
    expect(result.age).toEqual(['Must be at least 18']);
  });

  it('includes fields with empty error arrays when valid', () => {
    const values = { email: 'user@example.com' };
    const fieldRules: Record<string, ValidationRule[]> = {
      email: [{ type: 'required', params: {} }],
    };
    const result = validateForm(values, fieldRules);
    expect(result.email).toEqual([]);
  });

  it('handles fields present in rules but missing from values (treats as undefined)', () => {
    const values: Record<string, unknown> = {};
    const fieldRules: Record<string, ValidationRule[]> = {
      title: [{ type: 'required', params: {} }],
    };
    const result = validateForm(values, fieldRules);
    expect(result.title).toEqual(['This field is required']);
  });
});

// ---------------------------------------------------------------------------
// parseValidationRules
// ---------------------------------------------------------------------------
describe('parseValidationRules', () => {
  it('parses a valid JSON array of rules', () => {
    const json = JSON.stringify([
      { type: 'required', params: {} },
      { type: 'min-length', params: { min: 3 } },
    ]);
    const rules = parseValidationRules(json);
    expect(rules).toHaveLength(2);
    expect(rules[0].type).toBe('required');
    expect(rules[1].type).toBe('min-length');
  });

  it('returns empty array for empty string', () => {
    expect(parseValidationRules('')).toEqual([]);
  });

  it('returns empty array for invalid JSON', () => {
    expect(parseValidationRules('not json')).toEqual([]);
  });

  it('returns empty array when JSON is not an array', () => {
    expect(parseValidationRules('{"type":"required"}')).toEqual([]);
  });

  it('filters out items without a type field', () => {
    const json = JSON.stringify([{ params: {} }, { type: 'required', params: {} }]);
    const rules = parseValidationRules(json);
    expect(rules).toHaveLength(1);
    expect(rules[0].type).toBe('required');
  });

  it('preserves custom message overrides', () => {
    const json = JSON.stringify([
      { type: 'required', params: {}, message: 'Custom required message' },
    ]);
    const rules = parseValidationRules(json);
    expect(rules[0].message).toBe('Custom required message');
  });
});
