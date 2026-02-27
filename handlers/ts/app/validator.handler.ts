// Validator Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const validatorHandler: ConceptHandler = {
  async registerConstraint(input, storage) {
    const validator = input.validator as string;
    const constraint = input.constraint as string;

    const entry = await storage.get('validator', validator);
    const constraints: string[] = entry
      ? (entry.constraints as string[])
      : [];

    if (constraints.includes(constraint)) {
      return { variant: 'exists' };
    }

    constraints.push(constraint);

    await storage.put('validator', validator, {
      validator,
      constraints,
      fieldRules: entry ? entry.fieldRules : {},
      customValidators: entry ? entry.customValidators : {},
    });

    return { variant: 'ok' };
  },

  async addRule(input, storage) {
    const validator = input.validator as string;
    const field = input.field as string;
    const rule = input.rule as string;

    const entry = await storage.get('validator', validator);
    if (!entry) {
      return { variant: 'notfound' };
    }

    const fieldRules = (entry.fieldRules ?? {}) as Record<string, string>;
    fieldRules[field] = rule;

    await storage.put('validator', validator, {
      ...entry,
      fieldRules,
    });

    return { variant: 'ok' };
  },

  async validate(input, storage) {
    const validator = input.validator as string;
    const data = input.data as string;

    const entry = await storage.get('validator', validator);
    const constraints = entry ? (entry.constraints as string[]) : [];
    const fieldRules = entry ? ((entry.fieldRules ?? {}) as Record<string, string>) : {};
    const customValidators = entry
      ? ((entry.customValidators ?? {}) as Record<string, string>)
      : {};

    const parsed = JSON.parse(data) as Record<string, unknown>;
    const errors: string[] = [];

    // Validate each field against its rules
    for (const [field, ruleStr] of Object.entries(fieldRules)) {
      const rules = ruleStr.split('|').map(r => r.trim());
      const value = parsed[field];

      for (const rule of rules) {
        if (rule === 'required' && (value === undefined || value === null || value === '')) {
          errors.push(`${field} is required`);
        }
        if (rule === 'email' && typeof value === 'string' && value !== '') {
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailPattern.test(value)) {
            errors.push(`${field} must be a valid email`);
          }
        }
        if (rule === 'string' && value !== undefined && value !== null && typeof value !== 'string') {
          errors.push(`${field} must be a string`);
        }
        if (rule === 'number' && value !== undefined && value !== null && typeof value !== 'number') {
          errors.push(`${field} must be a number`);
        }
        if (rule.startsWith('min:') && typeof value === 'string') {
          const minLen = parseInt(rule.split(':')[1], 10);
          if (value.length < minLen) {
            errors.push(`${field} must be at least ${minLen} characters`);
          }
        }
        if (rule.startsWith('max:') && typeof value === 'string') {
          const maxLen = parseInt(rule.split(':')[1], 10);
          if (value.length > maxLen) {
            errors.push(`${field} must be at most ${maxLen} characters`);
          }
        }
        // Apply custom validators
        if (customValidators[rule]) {
          // Custom validator is stored as a rule name reference
          errors.push(`${field} failed custom validation: ${rule}`);
        }
      }
    }

    // Check global constraints
    for (const constraint of constraints) {
      if (constraint === 'required') {
        // Ensure all fields in rules have values
        for (const field of Object.keys(fieldRules)) {
          if (parsed[field] === undefined || parsed[field] === null || parsed[field] === '') {
            const msg = `${field} is required`;
            if (!errors.includes(msg)) {
              errors.push(msg);
            }
          }
        }
      }
    }

    const valid = errors.length === 0;

    // Return errors as plain string: single error directly, empty string when none
    const errorsValue = errors.length === 0 ? '' : errors.join(', ');
    return { variant: 'ok', valid, errors: errorsValue };
  },

  async validateField(input, storage) {
    const validator = input.validator as string;
    const field = input.field as string;
    const value = input.value as string;

    const entry = await storage.get('validator', validator);
    const fieldRules = entry ? ((entry.fieldRules ?? {}) as Record<string, string>) : {};
    const ruleStr = fieldRules[field] ?? '';
    const rules = ruleStr.split('|').map(r => r.trim()).filter(Boolean);

    const errors: string[] = [];

    for (const rule of rules) {
      if (rule === 'required' && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
      }
      if (rule === 'email' && typeof value === 'string' && value !== '') {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(value)) {
          errors.push(`${field} must be a valid email`);
        }
      }
      if (rule === 'string' && value !== undefined && typeof value !== 'string') {
        errors.push(`${field} must be a string`);
      }
      if (rule === 'number' && value !== undefined && typeof value !== 'number') {
        errors.push(`${field} must be a number`);
      }
      if (rule.startsWith('min:') && typeof value === 'string') {
        const minLen = parseInt(rule.split(':')[1], 10);
        if (value.length < minLen) {
          errors.push(`${field} must be at least ${minLen} characters`);
        }
      }
      if (rule.startsWith('max:') && typeof value === 'string') {
        const maxLen = parseInt(rule.split(':')[1], 10);
        if (value.length > maxLen) {
          errors.push(`${field} must be at most ${maxLen} characters`);
        }
      }
    }

    const valid = errors.length === 0;

    return { variant: 'ok', valid, errors: JSON.stringify(errors) };
  },

  async coerce(input, storage) {
    const validator = input.validator as string;
    const data = input.data as string;

    const entry = await storage.get('validator', validator);
    const fieldRules = entry ? ((entry.fieldRules ?? {}) as Record<string, string>) : {};

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(data) as Record<string, unknown>;
    } catch {
      return { variant: 'error', message: 'Invalid JSON data' };
    }

    const coerced = { ...parsed };

    for (const [field, ruleStr] of Object.entries(fieldRules)) {
      const rules = ruleStr.split('|').map(r => r.trim());
      const value = coerced[field];

      for (const rule of rules) {
        if (rule === 'string' && value !== undefined && typeof value !== 'string') {
          coerced[field] = String(value);
        }
        if (rule === 'number' && value !== undefined && typeof value !== 'number') {
          const num = Number(value);
          if (isNaN(num)) {
            return { variant: 'error', message: `Cannot coerce ${field} to number` };
          }
          coerced[field] = num;
        }
        if (rule.startsWith('max:') && typeof coerced[field] === 'string') {
          const maxLen = parseInt(rule.split(':')[1], 10);
          if ((coerced[field] as string).length > maxLen) {
            coerced[field] = (coerced[field] as string).slice(0, maxLen);
          }
        }
      }

      if (rules.includes('required') && (coerced[field] === undefined || coerced[field] === null)) {
        coerced[field] = '';
      }
    }

    return { variant: 'ok', coerced: JSON.stringify(coerced) };
  },

  async addCustomValidator(input, storage) {
    const validator = input.validator as string;
    const name = input.name as string;
    const implementation = input.implementation as string;

    const entry = await storage.get('validator', validator);
    const customValidators = entry
      ? ((entry.customValidators ?? {}) as Record<string, string>)
      : {};

    if (customValidators[name]) {
      return { variant: 'exists' };
    }

    customValidators[name] = implementation;

    if (entry) {
      await storage.put('validator', validator, {
        ...entry,
        customValidators,
      });
    } else {
      await storage.put('validator', validator, {
        validator,
        constraints: [],
        fieldRules: {},
        customValidators,
      });
    }

    return { variant: 'ok' };
  },
};
