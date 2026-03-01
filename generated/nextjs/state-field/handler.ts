// StateField — Concept state field tracking and constraint validation
// Registers typed fields per concept, traces to generated code and storage targets.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  StateFieldStorage,
  StateFieldRegisterInput,
  StateFieldRegisterOutput,
  StateFieldFindByConceptInput,
  StateFieldFindByConceptOutput,
  StateFieldTraceToGeneratedInput,
  StateFieldTraceToGeneratedOutput,
  StateFieldTraceToStorageInput,
  StateFieldTraceToStorageOutput,
  StateFieldGetInput,
  StateFieldGetOutput,
} from './types.js';

import {
  registerOk,
  findByConceptOk,
  traceToGeneratedOk,
  traceToStorageOk,
  getOk,
  getNotfound,
} from './types.js';

export interface StateFieldError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): StateFieldError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Derive cardinality from the type expression (e.g., "Array<T>" -> "many", "T | null" -> "optional"). */
const deriveCardinality = (typeExpr: string): string => {
  if (typeExpr.startsWith('Array<') || typeExpr.endsWith('[]') || typeExpr.startsWith('ReadonlyArray<')) {
    return 'many';
  }
  if (typeExpr.includes('| null') || typeExpr.includes('| undefined') || typeExpr.endsWith('?')) {
    return 'optional';
  }
  return 'one';
};

const fieldKey = (concept: string, name: string): string =>
  `field_${concept}_${name}`;

export interface StateFieldHandler {
  readonly register: (
    input: StateFieldRegisterInput,
    storage: StateFieldStorage,
  ) => TE.TaskEither<StateFieldError, StateFieldRegisterOutput>;
  readonly findByConcept: (
    input: StateFieldFindByConceptInput,
    storage: StateFieldStorage,
  ) => TE.TaskEither<StateFieldError, StateFieldFindByConceptOutput>;
  readonly traceToGenerated: (
    input: StateFieldTraceToGeneratedInput,
    storage: StateFieldStorage,
  ) => TE.TaskEither<StateFieldError, StateFieldTraceToGeneratedOutput>;
  readonly traceToStorage: (
    input: StateFieldTraceToStorageInput,
    storage: StateFieldStorage,
  ) => TE.TaskEither<StateFieldError, StateFieldTraceToStorageOutput>;
  readonly get: (
    input: StateFieldGetInput,
    storage: StateFieldStorage,
  ) => TE.TaskEither<StateFieldError, StateFieldGetOutput>;
}

// --- Implementation ---

export const stateFieldHandler: StateFieldHandler = {
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const key = fieldKey(input.concept, input.name);
          const cardinality = deriveCardinality(input.typeExpr);
          await storage.put('state_field', key, {
            id: key,
            concept: input.concept,
            name: input.name,
            typeExpr: input.typeExpr,
            cardinality,
            createdAt: new Date().toISOString(),
          });
          return registerOk(key);
        },
        storageError,
      ),
    ),

  findByConcept: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('state_field', { concept: input.concept });
          const fields = records.map((r) => ({
            id: String(r['id']),
            name: String(r['name']),
            typeExpr: String(r['typeExpr']),
            cardinality: String(r['cardinality']),
          }));
          return findByConceptOk(JSON.stringify(fields));
        },
        storageError,
      ),
    ),

  traceToGenerated: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const field = await storage.get('state_field', input.field);
          if (!field) {
            return traceToGeneratedOk(JSON.stringify([]));
          }
          // Look up generated code artifacts that reference this field
          const concept = String(field['concept']);
          const fieldName = String(field['name']);
          const generatedTargets = await storage.find('generated_artifact', { concept, field: fieldName });
          const targets = generatedTargets.map((r) => ({
            file: String(r['file'] ?? r['id']),
            language: String(r['language'] ?? 'unknown'),
          }));
          return traceToGeneratedOk(JSON.stringify(targets));
        },
        storageError,
      ),
    ),

  traceToStorage: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const field = await storage.get('state_field', input.field);
          if (!field) {
            return traceToStorageOk(JSON.stringify([]));
          }
          // Look up storage layer mappings for this field
          const concept = String(field['concept']);
          const fieldName = String(field['name']);
          const storageTargets = await storage.find('storage_mapping', { concept, field: fieldName });
          const targets = storageTargets.map((r) => ({
            table: String(r['table'] ?? r['relation']),
            column: String(r['column'] ?? fieldName),
          }));
          return traceToStorageOk(JSON.stringify(targets));
        },
        storageError,
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('state_field', input.field),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNotfound()),
            (found) =>
              TE.right(
                getOk(
                  String(found['id']),
                  String(found['concept']),
                  String(found['name']),
                  String(found['typeExpr']),
                  String(found['cardinality']),
                ),
              ),
          ),
        ),
      ),
    ),
};
