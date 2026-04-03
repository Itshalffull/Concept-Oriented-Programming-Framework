// @clef-handler style=functional concept=ValidatorCheckEvaluatorProvider
// ============================================================
// ValidatorCheckEvaluatorProvider Handler
//
// Delegates check evaluation to schema-based validation rules.
// Registers with PluginRegistry as a check-evaluator provider
// under name "validator".
//
// Config JSON shape:
//   {
//     schema: Record<string, unknown>,   // JSON Schema-like validation rules
//     subject: Record<string, unknown>   // The data object to validate
//   }
//
// Validates subject against schema rules. Each failing rule reduces
// the score. Returns 1.0 if all rules pass, 0.0 if all fail.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const PROVIDER_NAME = 'ValidatorCheckEvaluatorProvider';
const EVALUATOR_KIND = 'validator';

// ──────────────────────────────────────────────────────────────
// Schema validation logic
// ──────────────────────────────────────────────────────────────

interface ValidationRule {
  field: string;
  operator: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'min' | 'max' | 'enum' | 'type';
  value?: unknown;
}

interface ValidationResult {
  rule: string;
  field: string;
  passed: boolean;
  message: string;
}

function applyRule(
  rule: ValidationRule,
  subject: Record<string, unknown>,
): ValidationResult {
  const fieldValue = subject[rule.field];
  const label = `${rule.field}:${rule.operator}`;

  switch (rule.operator) {
    case 'required': {
      const passed = fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
      return { rule: label, field: rule.field, passed, message: passed ? 'ok' : `${rule.field} is required` };
    }
    case 'minLength': {
      const str = String(fieldValue ?? '');
      const min = Number(rule.value ?? 0);
      const passed = str.length >= min;
      return { rule: label, field: rule.field, passed, message: passed ? 'ok' : `${rule.field} must be at least ${min} characters` };
    }
    case 'maxLength': {
      const str = String(fieldValue ?? '');
      const max = Number(rule.value ?? Infinity);
      const passed = str.length <= max;
      return { rule: label, field: rule.field, passed, message: passed ? 'ok' : `${rule.field} must be at most ${max} characters` };
    }
    case 'pattern': {
      const str = String(fieldValue ?? '');
      const pattern = new RegExp(String(rule.value ?? ''));
      const passed = pattern.test(str);
      return { rule: label, field: rule.field, passed, message: passed ? 'ok' : `${rule.field} does not match pattern ${rule.value}` };
    }
    case 'min': {
      const num = Number(fieldValue);
      const min = Number(rule.value ?? 0);
      const passed = !isNaN(num) && num >= min;
      return { rule: label, field: rule.field, passed, message: passed ? 'ok' : `${rule.field} must be >= ${min}` };
    }
    case 'max': {
      const num = Number(fieldValue);
      const max = Number(rule.value ?? Infinity);
      const passed = !isNaN(num) && num <= max;
      return { rule: label, field: rule.field, passed, message: passed ? 'ok' : `${rule.field} must be <= ${max}` };
    }
    case 'enum': {
      const allowed = Array.isArray(rule.value) ? rule.value : [rule.value];
      const passed = allowed.includes(fieldValue);
      return { rule: label, field: rule.field, passed, message: passed ? 'ok' : `${rule.field} must be one of: ${allowed.join(', ')}` };
    }
    case 'type': {
      const expectedType = String(rule.value ?? 'string');
      const actualType = Array.isArray(fieldValue) ? 'array' : typeof fieldValue;
      const passed = actualType === expectedType;
      return { rule: label, field: rule.field, passed, message: passed ? 'ok' : `${rule.field} must be of type ${expectedType}, got ${actualType}` };
    }
    default: {
      return { rule: label, field: rule.field, passed: true, message: 'unknown rule — skipped' };
    }
  }
}

function validateSubject(
  rules: ValidationRule[],
  subject: Record<string, unknown>,
): { score: number; results: ValidationResult[] } {
  if (rules.length === 0) return { score: 1, results: [] };

  const results = rules.map(rule => applyRule(rule, subject));
  const passCount = results.filter(r => r.passed).length;
  const score = passCount / rules.length;

  return { score, results };
}

// ──────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: PROVIDER_NAME,
      kind: EVALUATOR_KIND,
    }) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const cv = (input.cv as string) ?? '';
    const configRaw = (input.config as string) ?? '';

    if (!cv || cv.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'cv is required' }) as StorageProgram<Result>;
    }

    if (!configRaw || configRaw.trim() === '') {
      const p = createProgram();
      return complete(p, 'error', { message: 'config is required' }) as StorageProgram<Result>;
    }

    let config: { rules?: ValidationRule[]; subject?: Record<string, unknown> };
    try {
      config = JSON.parse(configRaw);
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: 'config must be valid JSON' }) as StorageProgram<Result>;
    }

    const rules: ValidationRule[] = Array.isArray(config.rules) ? config.rules : [];
    const subject: Record<string, unknown> = (config.subject != null && typeof config.subject === 'object' && !Array.isArray(config.subject))
      ? config.subject as Record<string, unknown>
      : {};

    let validation: { score: number; results: ValidationResult[] };
    try {
      validation = validateSubject(rules, subject);
    } catch (err) {
      const p = createProgram();
      return complete(p, 'error', { message: `Validation failed: ${String(err)}` }) as StorageProgram<Result>;
    }

    const failures = validation.results.filter(r => !r.passed).map(r => r.message);
    const status: string = validation.score >= 1 ? 'passing' : 'failing';
    const evidence = JSON.stringify({
      rulesChecked: rules.length,
      passed: validation.results.filter(r => r.passed).length,
      failed: failures.length,
      failures,
      score: validation.score,
    });

    const p = createProgram();
    return complete(p, 'ok', {
      score: validation.score,
      evidence,
      status,
    }) as StorageProgram<Result>;
  },
};

export const validatorCheckEvaluatorHandler = autoInterpret(_handler);

export default validatorCheckEvaluatorHandler;
