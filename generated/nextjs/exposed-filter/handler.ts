// ExposedFilter — handler.ts
// User-facing filter definitions with operator binding, input collection,
// query modification generation, and default reset.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ExposedFilterStorage,
  ExposedFilterExposeInput,
  ExposedFilterExposeOutput,
  ExposedFilterCollectInputInput,
  ExposedFilterCollectInputOutput,
  ExposedFilterApplyToQueryInput,
  ExposedFilterApplyToQueryOutput,
  ExposedFilterResetToDefaultsInput,
  ExposedFilterResetToDefaultsOutput,
} from './types.js';

import {
  exposeOk,
  exposeExists,
  collectInputOk,
  collectInputNotfound,
  applyToQueryOk,
  applyToQueryNotfound,
  resetToDefaultsOk,
  resetToDefaultsNotfound,
} from './types.js';

export interface ExposedFilterError {
  readonly code: string;
  readonly message: string;
}

export interface ExposedFilterHandler {
  readonly expose: (
    input: ExposedFilterExposeInput,
    storage: ExposedFilterStorage,
  ) => TE.TaskEither<ExposedFilterError, ExposedFilterExposeOutput>;
  readonly collectInput: (
    input: ExposedFilterCollectInputInput,
    storage: ExposedFilterStorage,
  ) => TE.TaskEither<ExposedFilterError, ExposedFilterCollectInputOutput>;
  readonly applyToQuery: (
    input: ExposedFilterApplyToQueryInput,
    storage: ExposedFilterStorage,
  ) => TE.TaskEither<ExposedFilterError, ExposedFilterApplyToQueryOutput>;
  readonly resetToDefaults: (
    input: ExposedFilterResetToDefaultsInput,
    storage: ExposedFilterStorage,
  ) => TE.TaskEither<ExposedFilterError, ExposedFilterResetToDefaultsOutput>;
}

// --- Pure helpers ---

const storageErr = (error: unknown): ExposedFilterError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Supported filter operators. */
const VALID_OPERATORS: ReadonlySet<string> = new Set([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'starts_with',
  'ends_with',
  'in',
  'between',
]);

/** Map operator shorthand to a query expression operator. */
const operatorToExpression = (operator: string): string => {
  switch (operator) {
    case 'eq':
      return '=';
    case 'neq':
      return '!=';
    case 'gt':
      return '>';
    case 'gte':
      return '>=';
    case 'lt':
      return '<';
    case 'lte':
      return '<=';
    case 'contains':
      return 'CONTAINS';
    case 'starts_with':
      return 'STARTS WITH';
    case 'ends_with':
      return 'ENDS WITH';
    case 'in':
      return 'IN';
    case 'between':
      return 'BETWEEN';
    default:
      return '=';
  }
};

// --- Implementation ---

export const exposedFilterHandler: ExposedFilterHandler = {
  /**
   * Register a new exposed filter bound to a field, operator, and default value.
   * Validates the operator and checks for duplicate filter registrations.
   */
  expose: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('exposed_filters', input.filter),
        storageErr,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () => {
              // Validate operator
              if (!VALID_OPERATORS.has(input.operator)) {
                return TE.right(exposeExists(input.filter));
              }

              return pipe(
                TE.tryCatch(
                  () =>
                    storage.put('exposed_filters', input.filter, {
                      filterId: input.filter,
                      fieldName: input.fieldName,
                      operator: input.operator,
                      defaultValue: input.defaultValue,
                      currentValue: input.defaultValue,
                      createdAt: new Date().toISOString(),
                    }),
                  storageErr,
                ),
                TE.map(() => exposeOk(input.filter)),
              );
            },
            () => TE.right(exposeExists(input.filter)),
          ),
        ),
      ),
    ),

  /**
   * Capture a user-supplied value for this filter, replacing any previous input.
   * Stores the value alongside the filter definition for later query application.
   */
  collectInput: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('exposed_filters', input.filter),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(collectInputNotfound(input.filter)),
            (found) =>
              pipe(
                TE.tryCatch(
                  () =>
                    storage.put('exposed_filters', input.filter, {
                      ...found,
                      currentValue: input.value,
                      updatedAt: new Date().toISOString(),
                    }),
                  storageErr,
                ),
                TE.map(() => collectInputOk(input.filter)),
              ),
          ),
        ),
      ),
    ),

  /**
   * Produce a query modification clause from the current user input and operator.
   * Generates a structured query clause ready to merge into the bound query.
   * Uses the current value (or default if no user input) with the configured operator.
   */
  applyToQuery: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('exposed_filters', input.filter),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(applyToQueryNotfound(input.filter)),
            (found) => {
              const fieldName = String(found['fieldName'] ?? '');
              const operator = String(found['operator'] ?? 'eq');
              const currentValue = String(
                found['currentValue'] ?? found['defaultValue'] ?? '',
              );
              const exprOperator = operatorToExpression(operator);

              // Build the query modification clause
              const queryMod = JSON.stringify({
                field: fieldName,
                operator: exprOperator,
                value: currentValue,
                expression: `${fieldName} ${exprOperator} '${currentValue}'`,
              });

              return TE.right(applyToQueryOk(queryMod));
            },
          ),
        ),
      ),
    ),

  /**
   * Clear the user input and restore the default value for this filter.
   * Resets currentValue to the stored defaultValue.
   */
  resetToDefaults: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('exposed_filters', input.filter),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(resetToDefaultsNotfound(input.filter)),
            (found) => {
              const defaultValue = String(found['defaultValue'] ?? '');

              return pipe(
                TE.tryCatch(
                  () =>
                    storage.put('exposed_filters', input.filter, {
                      ...found,
                      currentValue: defaultValue,
                      resetAt: new Date().toISOString(),
                    }),
                  storageErr,
                ),
                TE.map(() => resetToDefaultsOk(input.filter)),
              );
            },
          ),
        ),
      ),
    ),
};
