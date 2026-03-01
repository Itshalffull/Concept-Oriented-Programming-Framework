// Validator — handler.ts
// Real fp-ts domain logic for constraint registration, rule-based validation, and error aggregation.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ValidatorStorage,
  ValidatorRegisterConstraintInput,
  ValidatorRegisterConstraintOutput,
  ValidatorAddRuleInput,
  ValidatorAddRuleOutput,
  ValidatorValidateInput,
  ValidatorValidateOutput,
  ValidatorValidateFieldInput,
  ValidatorValidateFieldOutput,
  ValidatorAddCustomValidatorInput,
  ValidatorAddCustomValidatorOutput,
} from './types.js';

import {
  registerConstraintOk,
  registerConstraintExists,
  addRuleOk,
  addRuleNotfound,
  validateOk,
  validateFieldOk,
  addCustomValidatorOk,
  addCustomValidatorExists,
} from './types.js';

export interface ValidatorError {
  readonly code: string;
  readonly message: string;
}

export interface ValidatorHandler {
  readonly registerConstraint: (
    input: ValidatorRegisterConstraintInput,
    storage: ValidatorStorage,
  ) => TE.TaskEither<ValidatorError, ValidatorRegisterConstraintOutput>;
  readonly addRule: (
    input: ValidatorAddRuleInput,
    storage: ValidatorStorage,
  ) => TE.TaskEither<ValidatorError, ValidatorAddRuleOutput>;
  readonly validate: (
    input: ValidatorValidateInput,
    storage: ValidatorStorage,
  ) => TE.TaskEither<ValidatorError, ValidatorValidateOutput>;
  readonly validateField: (
    input: ValidatorValidateFieldInput,
    storage: ValidatorStorage,
  ) => TE.TaskEither<ValidatorError, ValidatorValidateFieldOutput>;
  readonly addCustomValidator: (
    input: ValidatorAddCustomValidatorInput,
    storage: ValidatorStorage,
  ) => TE.TaskEither<ValidatorError, ValidatorAddCustomValidatorOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): ValidatorError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const constraintKey = (validator: string, constraint: string): string =>
  `${validator}::constraint::${constraint}`;

const ruleKey = (validator: string, field: string): string =>
  `${validator}::rule::${field}`;

const customValidatorKey = (validator: string, name: string): string =>
  `${validator}::custom::${name}`;

/** Parse a pipe-separated rule string into individual rule names. */
const parseRuleString = (rule: string): readonly string[] =>
  rule.split('|').map((r) => r.trim()).filter((r) => r.length > 0);

/** Safely parse JSON data, returning an empty object on failure. */
const safeParseJson = (raw: string): Record<string, unknown> => {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
};

/**
 * Apply a single built-in validation rule to a value.
 * Returns an error message string if validation fails, or null if it passes.
 */
const applyRule = (
  ruleName: string,
  fieldName: string,
  value: unknown,
): string | null => {
  switch (ruleName) {
    case 'required':
      if (value === undefined || value === null || value === '') {
        return `${fieldName} is required`;
      }
      return null;

    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof value === 'string' && !emailRegex.test(value)) {
        return `${fieldName} must be a valid email address`;
      }
      return null;
    }

    case 'string':
      if (typeof value !== 'string') {
        return `${fieldName} must be a string`;
      }
      return null;

    case 'number':
      if (typeof value !== 'number' && (typeof value === 'string' && isNaN(Number(value)))) {
        return `${fieldName} must be a number`;
      }
      return null;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return `${fieldName} must be a boolean`;
      }
      return null;

    case 'nonempty':
      if (typeof value === 'string' && value.trim().length === 0) {
        return `${fieldName} must not be empty`;
      }
      return null;

    default: {
      // Handle min:N and max:N patterns
      if (ruleName.startsWith('min:')) {
        const min = parseInt(ruleName.slice(4), 10);
        if (!isNaN(min) && typeof value === 'string' && value.length < min) {
          return `${fieldName} must be at least ${min} characters`;
        }
      }
      if (ruleName.startsWith('max:')) {
        const max = parseInt(ruleName.slice(4), 10);
        if (!isNaN(max) && typeof value === 'string' && value.length > max) {
          return `${fieldName} must be at most ${max} characters`;
        }
      }
      return null;
    }
  }
};

/**
 * Run all rules against a field value and collect error messages.
 */
const validateFieldValue = (
  rules: readonly string[],
  fieldName: string,
  value: unknown,
): readonly string[] =>
  rules
    .map((rule) => applyRule(rule, fieldName, value))
    .filter((msg): msg is string => msg !== null);

// --- Implementation ---

export const validatorHandler: ValidatorHandler = {
  /**
   * Register a named constraint type on a validator instance. Returns exists
   * if the constraint is already registered.
   */
  registerConstraint: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('constraints', constraintKey(input.validator, input.constraint)),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put(
                    'constraints',
                    constraintKey(input.validator, input.constraint),
                    {
                      validator: input.validator,
                      constraint: input.constraint,
                      registeredAt: Date.now(),
                    },
                  );
                  return registerConstraintOk();
                },
                storageError,
              ),
            () => TE.right<ValidatorError, ValidatorRegisterConstraintOutput>(
              registerConstraintExists(),
            ),
          ),
        ),
      ),
    ),

  /**
   * Add a field-level validation rule to a validator. The validator must
   * exist (have at least one registered constraint).
   */
  addRule: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('constraints', { validator: input.validator }),
        storageError,
      ),
      TE.chain((constraints) => {
        if (constraints.length === 0) {
          return TE.right<ValidatorError, ValidatorAddRuleOutput>(addRuleNotfound());
        }
        return TE.tryCatch(
          async () => {
            const key = ruleKey(input.validator, input.field);
            const existing = await storage.get('rules', key);
            const currentRules = existing
              ? (existing.rules as string) ?? ''
              : '';
            // Merge rule strings: append new rules (pipe-separated)
            const mergedRules = currentRules
              ? `${currentRules}|${input.rule}`
              : input.rule;
            await storage.put('rules', key, {
              validator: input.validator,
              field: input.field,
              rules: mergedRules,
              updatedAt: Date.now(),
            });
            return addRuleOk();
          },
          storageError,
        );
      }),
    ),

  /**
   * Validate a full data object against all registered rules for this
   * validator. Aggregates errors across all fields and returns the
   * composite validity result.
   */
  validate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('rules', { validator: input.validator }),
        storageError,
      ),
      TE.map((ruleRecords) => {
        const data = safeParseJson(input.data);
        const allErrors: string[] = [];

        for (const ruleRecord of ruleRecords) {
          const fieldName = ruleRecord.field as string;
          const rulesStr = ruleRecord.rules as string;
          const rules = parseRuleString(rulesStr);
          const value = data[fieldName];
          const fieldErrors = validateFieldValue(rules, fieldName, value);
          allErrors.push(...fieldErrors);
        }

        const valid = allErrors.length === 0;
        return validateOk(valid, allErrors.join('; '));
      }),
    ),

  /**
   * Validate a single field value against its registered rules.
   */
  validateField: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('rules', ruleKey(input.validator, input.field)),
        storageError,
      ),
      TE.map((ruleRecord) =>
        pipe(
          O.fromNullable(ruleRecord),
          O.fold(
            // No rules registered for this field — it is valid by default
            () => validateFieldOk(true, ''),
            (record) => {
              const rules = parseRuleString(record.rules as string);
              const errors = validateFieldValue(rules, input.field, input.value);
              return validateFieldOk(errors.length === 0, errors.join('; '));
            },
          ),
        ),
      ),
    ),

  /**
   * Register a custom validator function by name. Returns exists if a custom
   * validator with the same name is already registered.
   */
  addCustomValidator: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('customValidators', customValidatorKey(input.validator, input.name)),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put(
                    'customValidators',
                    customValidatorKey(input.validator, input.name),
                    {
                      validator: input.validator,
                      name: input.name,
                      implementation: input.implementation,
                      registeredAt: Date.now(),
                    },
                  );
                  return addCustomValidatorOk();
                },
                storageError,
              ),
            () => TE.right<ValidatorError, ValidatorAddCustomValidatorOutput>(
              addCustomValidatorExists(),
            ),
          ),
        ),
      ),
    ),
};
