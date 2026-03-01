// Spec — Concept specification management, validation, and emission.
// Stores concept spec documents, validates them against structural invariants,
// and emits serialised representations in supported formats (yaml, json).

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SpecStorage,
  SpecEmitInput,
  SpecEmitOutput,
  SpecValidateInput,
  SpecValidateOutput,
} from './types.js';

import {
  emitOk,
  emitFormatError,
  validateOk,
  validateInvalid,
} from './types.js';

export interface SpecError {
  readonly code: string;
  readonly message: string;
}

export interface SpecHandler {
  readonly emit: (
    input: SpecEmitInput,
    storage: SpecStorage,
  ) => TE.TaskEither<SpecError, SpecEmitOutput>;
  readonly validate: (
    input: SpecValidateInput,
    storage: SpecStorage,
  ) => TE.TaskEither<SpecError, SpecValidateOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): SpecError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Supported emission formats. */
const SUPPORTED_FORMATS: ReadonlySet<string> = new Set(['yaml', 'json']);

/** Collect all projection records from storage into a single document object. */
const collectProjections = async (
  storage: SpecStorage,
  projections: readonly string[],
): Promise<readonly Record<string, unknown>[]> => {
  const results: Record<string, unknown>[] = [];
  for (const projection of projections) {
    const record = await storage.get('projections', projection);
    if (record !== null) {
      results.push(record);
    }
  }
  return results;
};

/** Serialise a list of projection records into the requested format. */
const serialise = (
  projections: readonly Record<string, unknown>[],
  format: string,
): string => {
  if (format === 'json') {
    return JSON.stringify(projections, null, 2);
  }
  // Simple yaml-like serialisation for the yaml format
  return projections
    .map((p) =>
      Object.entries(p)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
        .join('\n'),
    )
    .join('\n---\n');
};

/** Required top-level fields for a valid spec document. */
const REQUIRED_FIELDS: readonly string[] = ['concept', 'actions'];

/** Validate a stored spec document record and return a list of errors. */
const validateRecord = (record: Record<string, unknown>): readonly string[] => {
  const errors: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    if (!(field in record) || record[field] === undefined || record[field] === null) {
      errors.push(`Missing required field: '${field}'`);
    }
  }

  // The concept field must be a non-empty string
  if (typeof record['concept'] === 'string' && record['concept'].trim().length === 0) {
    errors.push("Field 'concept' must be a non-empty string");
  }

  // actions must be an array
  if ('actions' in record && !Array.isArray(record['actions'])) {
    errors.push("Field 'actions' must be an array");
  }

  return errors;
};

// --- Implementation ---

export const specHandler: SpecHandler = {
  emit: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Guard: format must be supported
          if (!SUPPORTED_FORMATS.has(input.format)) {
            return emitFormatError(
              input.format,
              `Unsupported format '${input.format}'. Supported: ${[...SUPPORTED_FORMATS].join(', ')}`,
            );
          }

          // Collect each projection from storage
          const projections = await collectProjections(storage, input.projections);

          // If no projections are found, still emit an empty document
          const content = serialise(projections, input.format);
          const documentId = `spec:${input.projections.join('+')}:${input.format}`;

          // Persist the emitted document so it can be validated later
          await storage.put('documents', documentId, {
            projections: [...input.projections],
            format: input.format,
            config: input.config,
            content,
            emittedAt: new Date().toISOString(),
          });

          return emitOk(documentId, content);
        },
        storageError,
      ),
    ),

  validate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const record = await storage.get('documents', input.document);

          return pipe(
            O.fromNullable(record),
            O.fold(
              // Document not in storage -- treat as invalid with a clear error
              () =>
                validateInvalid(input.document, [
                  `Document '${input.document}' not found in storage`,
                ]),
              (doc) => {
                const errors = validateRecord(doc);
                return errors.length === 0
                  ? validateOk(input.document)
                  : validateInvalid(input.document, errors);
              },
            ),
          );
        },
        storageError,
      ),
    ),
};
