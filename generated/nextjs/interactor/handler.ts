// Interactor — handler.ts
// Surface concept: interaction handler that maps user gestures to actions.
// Registers interaction patterns, classifies field types to appropriate
// interactors, and resolves gesture-to-action mappings.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  InteractorStorage,
  InteractorDefineInput,
  InteractorDefineOutput,
  InteractorClassifyInput,
  InteractorClassifyOutput,
  InteractorGetInput,
  InteractorGetOutput,
  InteractorListInput,
  InteractorListOutput,
} from './types.js';

import {
  defineOk,
  defineDuplicate,
  classifyOk,
  classifyAmbiguous,
  getOk,
  getNotfound,
  listOk,
} from './types.js';

export interface InteractorError {
  readonly code: string;
  readonly message: string;
}

export interface InteractorHandler {
  readonly define: (
    input: InteractorDefineInput,
    storage: InteractorStorage,
  ) => TE.TaskEither<InteractorError, InteractorDefineOutput>;
  readonly classify: (
    input: InteractorClassifyInput,
    storage: InteractorStorage,
  ) => TE.TaskEither<InteractorError, InteractorClassifyOutput>;
  readonly get: (
    input: InteractorGetInput,
    storage: InteractorStorage,
  ) => TE.TaskEither<InteractorError, InteractorGetOutput>;
  readonly list: (
    input: InteractorListInput,
    storage: InteractorStorage,
  ) => TE.TaskEither<InteractorError, InteractorListOutput>;
}

// --- Domain helpers ---

const mkStorageError = (error: unknown): InteractorError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const VALID_CATEGORIES = ['input', 'gesture', 'selection', 'navigation', 'trigger', 'drag', 'resize'] as const;

// Default field-type-to-interactor mapping for classification
const FIELD_TYPE_MAP: Record<string, readonly string[]> = {
  string: ['text-input', 'textarea'],
  number: ['number-input', 'slider'],
  boolean: ['checkbox', 'toggle', 'switch'],
  date: ['date-picker', 'calendar'],
  enum: ['select', 'radio-group', 'dropdown'],
  file: ['file-upload', 'dropzone'],
  color: ['color-picker'],
  range: ['slider', 'range-input'],
};

const AMBIGUITY_THRESHOLD = 0.15;

const scoreInteractorForField = (
  interactorProps: Record<string, unknown>,
  fieldType: string,
  constraints: string | null,
  intent: string | null,
): number => {
  let score = 0.3; // base score for any registered interactor

  // Check if the interactor's supported field types include the requested type
  const supportedTypes = String(interactorProps['supportedTypes'] ?? '');
  if (supportedTypes.includes(fieldType)) {
    score += 0.4;
  }

  // Check intent alignment
  if (intent && String(interactorProps['intent'] ?? '').includes(intent)) {
    score += 0.2;
  }

  // Check constraint compatibility
  if (constraints) {
    const constraintMatch = String(interactorProps['constraints'] ?? '');
    if (constraintMatch.includes(constraints)) {
      score += 0.1;
    }
  }

  return Math.min(score, 1.0);
};

// --- Implementation ---

export const interactorHandler: InteractorHandler = {
  define: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('interactors', input.interactor),
        mkStorageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const record = {
                    interactor: input.interactor,
                    name: input.name,
                    category: input.category,
                    properties: input.properties,
                    createdAt: new Date().toISOString(),
                  };
                  await storage.put('interactors', input.interactor, record);
                  return defineOk(input.interactor);
                },
                mkStorageError,
              ),
            () =>
              TE.right(
                defineDuplicate(`Interactor "${input.interactor}" already defined`),
              ),
          ),
        ),
      ),
    ),

  classify: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('interactors'),
        mkStorageError,
      ),
      TE.map((allInteractors) => {
        const constraintsStr = pipe(
          input.constraints,
          O.getOrElse(() => ''),
        );
        const intentStr = pipe(
          input.intent,
          O.getOrElse(() => ''),
        );

        // Score each interactor for the requested field type
        const scored = allInteractors
          .map((r) => {
            let props: Record<string, unknown> = {};
            try {
              props = JSON.parse(String(r['properties'] ?? '{}'));
            } catch {
              props = {};
            }
            return {
              interactor: String(r['interactor'] ?? ''),
              score: scoreInteractorForField(
                props,
                input.fieldType,
                constraintsStr || null,
                intentStr || null,
              ),
            };
          })
          .sort((a, b) => b.score - a.score);

        if (scored.length === 0) {
          // Fall back to default mapping
          const defaults = FIELD_TYPE_MAP[input.fieldType];
          if (defaults && defaults.length > 0) {
            return classifyOk(defaults[0], 0.5);
          }
          return classifyOk('text-input', 0.2);
        }

        // Check for ambiguity between top candidates
        if (
          scored.length > 1 &&
          Math.abs(scored[0].score - scored[1].score) < AMBIGUITY_THRESHOLD
        ) {
          const topCandidates = scored
            .filter((s) => Math.abs(s.score - scored[0].score) < AMBIGUITY_THRESHOLD)
            .map((s) => `${s.interactor}(${s.score.toFixed(2)})`)
            .join(', ');
          return classifyAmbiguous(input.interactor, topCandidates);
        }

        return classifyOk(scored[0].interactor, scored[0].score);
      }),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('interactors', input.interactor),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                getNotfound(`Interactor "${input.interactor}" not found`),
              ),
            (found) =>
              TE.right(
                getOk(
                  String(found['interactor'] ?? input.interactor),
                  String(found['name'] ?? ''),
                  String(found['category'] ?? ''),
                  String(found['properties'] ?? '{}'),
                ),
              ),
          ),
        ),
      ),
    ),

  list: (input, storage) =>
    pipe(
      TE.tryCatch(
        () =>
          pipe(
            input.category,
            O.fold(
              () => storage.find('interactors'),
              (cat) => storage.find('interactors', { category: cat }),
            ),
          ),
        mkStorageError,
      ),
      TE.map((records) => {
        const interactorList = records.map((r) => ({
          interactor: String(r['interactor'] ?? ''),
          name: String(r['name'] ?? ''),
          category: String(r['category'] ?? ''),
        }));
        return listOk(JSON.stringify(interactorList));
      }),
    ),
};
