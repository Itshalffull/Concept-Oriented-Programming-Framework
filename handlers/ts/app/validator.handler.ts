// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Validator Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _validatorHandler: FunctionalConceptHandler = {
  registerConstraint(input: Record<string, unknown>) {
    if (!input.validator || (typeof input.validator === 'string' && (input.validator as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'validator is required' }) as StorageProgram<Result>;
    }
    const validator = input.validator as string;
    const constraint = input.constraint as string;
    let p = createProgram();
    p = spGet(p, 'validator', validator, 'entry');
    p = putFrom(p, 'validator', validator, (bindings) => {
      const entry = bindings.entry as Record<string, unknown> | null;
      const constraints: string[] = entry ? (entry.constraints as string[]) : [];
      if (constraints.includes(constraint)) return entry || { validator, constraints, fieldRules: {}, customValidators: {} };
      constraints.push(constraint);
      return { validator, constraints, fieldRules: entry ? entry.fieldRules : {}, customValidators: entry ? entry.customValidators : {} };
    });
    return complete(p, 'ok', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  addRule(input: Record<string, unknown>) {
    if (!input.validator || (typeof input.validator === 'string' && (input.validator as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'validator is required' }) as StorageProgram<Result>;
    }
    const validator = input.validator as string;
    const field = input.field as string;
    const rule = input.rule as string;
    let p = createProgram();
    p = spGet(p, 'validator', validator, 'entry');
    p = branch(p, 'entry',
      (b) => {
        let b2 = putFrom(b, 'validator', validator, (bindings) => {
          const entry = bindings.entry as Record<string, unknown>;
          const fieldRules = (entry.fieldRules ?? {}) as Record<string, string>;
          fieldRules[field] = rule;
          return { ...entry, fieldRules };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  validate(input: Record<string, unknown>) {
    const validator = input.validator as string;
    const data = input.data as string;
    let p = createProgram();
    p = spGet(p, 'validator', validator, 'entry');
    p = mapBindings(p, (bindings) => {
      const entry = bindings.entry as Record<string, unknown> | null;
      const constraints = entry ? (entry.constraints as string[]) : [];
      const fieldRules = entry ? ((entry.fieldRules ?? {}) as Record<string, string>) : {};
      const parsed = JSON.parse(data) as Record<string, unknown>;
      const errors: string[] = [];
      for (const [field, ruleStr] of Object.entries(fieldRules)) {
        const rules = ruleStr.split('|').map(r => r.trim());
        const value = parsed[field];
        for (const rule of rules) {
          if (rule === 'required' && (value === undefined || value === null || value === '')) errors.push(`${field} is required`);
          if (rule === 'email' && typeof value === 'string' && value !== '') { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.push(`${field} must be a valid email`); }
          if (rule === 'string' && value !== undefined && value !== null && typeof value !== 'string') errors.push(`${field} must be a string`);
          if (rule === 'number' && value !== undefined && value !== null && typeof value !== 'number') errors.push(`${field} must be a number`);
          if (rule.startsWith('min:') && typeof value === 'string') { const minLen = parseInt(rule.split(':')[1], 10); if (value.length < minLen) errors.push(`${field} must be at least ${minLen} characters`); }
          if (rule.startsWith('max:') && typeof value === 'string') { const maxLen = parseInt(rule.split(':')[1], 10); if (value.length > maxLen) errors.push(`${field} must be at most ${maxLen} characters`); }
        }
      }
      for (const constraint of constraints) {
        if (constraint === 'required') for (const field of Object.keys(fieldRules)) {
          if (parsed[field] === undefined || parsed[field] === null || parsed[field] === '') { const msg = `${field} is required`; if (!errors.includes(msg)) errors.push(msg); }
        }
      }
      return { valid: errors.length === 0, errorsValue: errors.length === 0 ? '' : errors.join(', ') };
    }, 'result');
    return completeFrom(p, 'ok', (bindings) => {
      const result = bindings.result as { valid: boolean; errorsValue: string };
      return { valid: result.valid, errors: result.errorsValue };
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  validateField(input: Record<string, unknown>) {
    if (!input.value || (typeof input.value === 'string' && (input.value as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'value is required' }) as StorageProgram<Result>;
    }
    const validator = input.validator as string;
    const field = input.field as string;
    const value = input.value as string;
    let p = createProgram();
    p = spGet(p, 'validator', validator, 'entry');
    p = mapBindings(p, (bindings) => {
      const entry = bindings.entry as Record<string, unknown> | null;
      const fieldRules = entry ? ((entry.fieldRules ?? {}) as Record<string, string>) : {};
      const ruleStr = fieldRules[field] ?? '';
      const rules = ruleStr.split('|').map(r => r.trim()).filter(Boolean);
      const errors: string[] = [];
      for (const rule of rules) {
        if (rule === 'required' && (value === undefined || value === null || value === '')) errors.push(`${field} is required`);
        if (rule === 'email' && typeof value === 'string' && value !== '') { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.push(`${field} must be a valid email`); }
        if (rule.startsWith('min:') && typeof value === 'string') { const minLen = parseInt(rule.split(':')[1], 10); if (value.length < minLen) errors.push(`${field} must be at least ${minLen} characters`); }
        if (rule.startsWith('max:') && typeof value === 'string') { const maxLen = parseInt(rule.split(':')[1], 10); if (value.length > maxLen) errors.push(`${field} must be at most ${maxLen} characters`); }
      }
      return { valid: errors.length === 0, errors: JSON.stringify(errors) };
    }, 'result');
    return completeFrom(p, 'ok', (bindings) => {
      const result = bindings.result as { valid: boolean; errors: string };
      return { valid: result.valid, errors: result.errors };
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  coerce(input: Record<string, unknown>) {
    const validator = input.validator as string;
    const data = input.data as string;
    let p = createProgram();
    p = spGet(p, 'validator', validator, 'entry');
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(data); } catch { return complete(p, 'error', { message: 'Invalid JSON data' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    p = mapBindings(p, (bindings) => {
      const entry = bindings.entry as Record<string, unknown> | null;
      const fieldRules = entry ? ((entry.fieldRules ?? {}) as Record<string, string>) : {};
      const coerced = { ...parsed };
      for (const [field, ruleStr] of Object.entries(fieldRules)) {
        const rules = ruleStr.split('|').map(r => r.trim());
        for (const rule of rules) {
          if (rule === 'string' && coerced[field] !== undefined && typeof coerced[field] !== 'string') coerced[field] = String(coerced[field]);
          if (rule === 'number' && coerced[field] !== undefined && typeof coerced[field] !== 'number') { const num = Number(coerced[field]); if (!isNaN(num)) coerced[field] = num; }
          if (rule.startsWith('max:') && typeof coerced[field] === 'string') { const maxLen = parseInt(rule.split(':')[1], 10); if ((coerced[field] as string).length > maxLen) coerced[field] = (coerced[field] as string).slice(0, maxLen); }
        }
        if (rules.includes('required') && (coerced[field] === undefined || coerced[field] === null)) coerced[field] = '';
      }
      return JSON.stringify(coerced);
    }, 'coerced');
    return completeFrom(p, 'ok', (bindings) => ({ coerced: bindings.coerced as string })) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  addCustomValidator(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const validator = input.validator as string;
    const name = input.name as string;
    const implementation = input.implementation as string;
    let p = createProgram();
    p = spGet(p, 'validator', validator, 'entry');
    p = putFrom(p, 'validator', validator, (bindings) => {
      const entry = (bindings.entry as Record<string, unknown>) || { validator, constraints: [], fieldRules: {}, customValidators: {} };
      const customValidators = ((entry.customValidators ?? {}) as Record<string, string>);
      if (customValidators[name]) return entry;
      customValidators[name] = implementation;
      return { ...entry, customValidators };
    });
    return complete(p, 'ok', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const validatorHandler = autoInterpret(_validatorHandler);

