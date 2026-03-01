// Affordance — handler.ts
// Surface concept: UI affordance descriptors.
// Defines what interactions a component supports (clickable, draggable, editable),
// maps them to platform capabilities, and matches affordances by interactor and context.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  AffordanceStorage,
  AffordanceDeclareInput,
  AffordanceDeclareOutput,
  AffordanceMatchInput,
  AffordanceMatchOutput,
  AffordanceExplainInput,
  AffordanceExplainOutput,
  AffordanceRemoveInput,
  AffordanceRemoveOutput,
} from './types.js';

import {
  declareOk,
  declareDuplicate,
  matchOk,
  matchNone,
  explainOk,
  explainNotfound,
  removeOk,
  removeNotfound,
} from './types.js';

export interface AffordanceError {
  readonly code: string;
  readonly message: string;
}

export interface AffordanceHandler {
  readonly declare: (
    input: AffordanceDeclareInput,
    storage: AffordanceStorage,
  ) => TE.TaskEither<AffordanceError, AffordanceDeclareOutput>;
  readonly match: (
    input: AffordanceMatchInput,
    storage: AffordanceStorage,
  ) => TE.TaskEither<AffordanceError, AffordanceMatchOutput>;
  readonly explain: (
    input: AffordanceExplainInput,
    storage: AffordanceStorage,
  ) => TE.TaskEither<AffordanceError, AffordanceExplainOutput>;
  readonly remove: (
    input: AffordanceRemoveInput,
    storage: AffordanceStorage,
  ) => TE.TaskEither<AffordanceError, AffordanceRemoveOutput>;
}

// --- Domain helpers ---

const mkStorageError = (error: unknown): AffordanceError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const evaluateConditions = (
  conditions: string,
  context: string,
): boolean => {
  try {
    const condArr: readonly string[] = JSON.parse(conditions);
    const ctx: Record<string, unknown> = JSON.parse(context);
    // Each condition is a key that must be truthy in the context
    return condArr.every((cond) => Boolean(ctx[cond]));
  } catch {
    // If conditions or context are not parseable, treat as unconditional match
    return true;
  }
};

// --- Implementation ---

export const affordanceHandler: AffordanceHandler = {
  declare: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('affordances', input.affordance),
        mkStorageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const conditionsStr = pipe(
                    input.conditions,
                    O.getOrElse(() => '[]'),
                  );
                  const record = {
                    affordance: input.affordance,
                    widget: input.widget,
                    interactor: input.interactor,
                    specificity: input.specificity,
                    conditions: conditionsStr,
                    createdAt: new Date().toISOString(),
                  };
                  await storage.put('affordances', input.affordance, record);
                  return declareOk(input.affordance);
                },
                mkStorageError,
              ),
            () =>
              TE.right(
                declareDuplicate(`Affordance "${input.affordance}" already declared`),
              ),
          ),
        ),
      ),
    ),

  match: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('affordances', { interactor: input.interactor }),
        mkStorageError,
      ),
      TE.map((records) => {
        // Filter by conditions that match the provided context
        const matching = records
          .filter((r) => {
            const conditions = String(r['conditions'] ?? '[]');
            return evaluateConditions(conditions, input.context);
          })
          // Sort by specificity descending (highest specificity wins)
          .sort((a, b) => Number(b['specificity'] ?? 0) - Number(a['specificity'] ?? 0));

        if (matching.length === 0) {
          return matchNone(
            `No affordances match interactor "${input.interactor}" in the given context`,
          );
        }

        const matchSummary = matching.map((r) => ({
          affordance: String(r['affordance'] ?? ''),
          widget: String(r['widget'] ?? ''),
          specificity: Number(r['specificity'] ?? 0),
        }));

        return matchOk(JSON.stringify(matchSummary));
      }),
    ),

  explain: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('affordances', input.affordance),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                explainNotfound(`Affordance "${input.affordance}" not found`),
              ),
            (found) => {
              const lines: string[] = [];
              lines.push(`Affordance: ${found['affordance']}`);
              lines.push(`  Widget: ${found['widget']}`);
              lines.push(`  Interactor: ${found['interactor']}`);
              lines.push(`  Specificity: ${found['specificity']}`);
              lines.push(`  Conditions: ${found['conditions'] ?? 'none'}`);
              lines.push(`  Declared: ${found['createdAt'] ?? 'unknown'}`);

              return TE.right(
                explainOk(String(found['affordance']), lines.join('\n')),
              );
            },
          ),
        ),
      ),
    ),

  remove: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('affordances', input.affordance),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                removeNotfound(`Affordance "${input.affordance}" not found`),
              ),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('affordances', input.affordance);
                  return removeOk(input.affordance);
                },
                mkStorageError,
              ),
          ),
        ),
      ),
    ),
};
