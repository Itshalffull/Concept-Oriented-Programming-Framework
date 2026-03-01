// ContentStorage — Content persistence layer: save/load content records,
// delete by key, query with filters, and generate schemas from stored data.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ContentStorageStorage,
  ContentStorageSaveInput,
  ContentStorageSaveOutput,
  ContentStorageLoadInput,
  ContentStorageLoadOutput,
  ContentStorageDeleteInput,
  ContentStorageDeleteOutput,
  ContentStorageQueryInput,
  ContentStorageQueryOutput,
  ContentStorageGenerateSchemaInput,
  ContentStorageGenerateSchemaOutput,
} from './types.js';

import {
  saveOk,
  saveError,
  loadOk,
  loadNotfound,
  deleteOk,
  deleteNotfound,
  queryOk,
  generateSchemaOk,
  generateSchemaNotfound,
} from './types.js';

export interface ContentStorageError {
  readonly code: string;
  readonly message: string;
}

const toContentStorageError = (error: unknown): ContentStorageError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface ContentStorageHandler {
  readonly save: (
    input: ContentStorageSaveInput,
    storage: ContentStorageStorage,
  ) => TE.TaskEither<ContentStorageError, ContentStorageSaveOutput>;
  readonly load: (
    input: ContentStorageLoadInput,
    storage: ContentStorageStorage,
  ) => TE.TaskEither<ContentStorageError, ContentStorageLoadOutput>;
  readonly delete: (
    input: ContentStorageDeleteInput,
    storage: ContentStorageStorage,
  ) => TE.TaskEither<ContentStorageError, ContentStorageDeleteOutput>;
  readonly query: (
    input: ContentStorageQueryInput,
    storage: ContentStorageStorage,
  ) => TE.TaskEither<ContentStorageError, ContentStorageQueryOutput>;
  readonly generateSchema: (
    input: ContentStorageGenerateSchemaInput,
    storage: ContentStorageStorage,
  ) => TE.TaskEither<ContentStorageError, ContentStorageGenerateSchemaOutput>;
}

// --- Implementation ---

export const contentStorageHandler: ContentStorageHandler = {
  // Save content data keyed by record ID. Validates that data is non-empty.
  save: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          if (!input.data || input.data.length === 0) {
            return saveError('Content data cannot be empty');
          }
          await storage.put('content', input.record, {
            record: input.record,
            data: input.data,
            savedAt: new Date().toISOString(),
          });
          return saveOk(input.record);
        },
        toContentStorageError,
      ),
    ),

  // Load content by record ID. Returns notfound if the record key does not exist.
  load: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('content', input.record),
        toContentStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<ContentStorageError, ContentStorageLoadOutput>(
                loadNotfound(`Record '${input.record}' not found`),
              ),
            (found) => {
              const r = found as Record<string, unknown>;
              return TE.right<ContentStorageError, ContentStorageLoadOutput>(
                loadOk(input.record, String(r.data ?? '')),
              );
            },
          ),
        ),
      ),
    ),

  // Delete a content record. Returns notfound if the record does not exist.
  delete: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('content', input.record),
        toContentStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<ContentStorageError, ContentStorageDeleteOutput>(
                deleteNotfound(`Record '${input.record}' not found`),
              ),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('content', input.record);
                  return deleteOk(input.record);
                },
                toContentStorageError,
              ),
          ),
        ),
      ),
    ),

  // Query content records using a filter expression. Returns matching record IDs.
  query: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const filterObj = input.filter ? { filter: input.filter } : undefined;
          const records = await storage.find('content', filterObj);
          const results = records
            .map((r) => String((r as Record<string, unknown>).record ?? ''))
            .filter((id) => id.length > 0)
            .join(',');
          return queryOk(results);
        },
        toContentStorageError,
      ),
    ),

  // Generate a schema by inspecting the structure of a stored record's data.
  generateSchema: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('content', input.record),
        toContentStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<ContentStorageError, ContentStorageGenerateSchemaOutput>(
                generateSchemaNotfound(`Record '${input.record}' not found`),
              ),
            (found) => {
              const r = found as Record<string, unknown>;
              // Attempt to infer schema from stored data fields
              const dataStr = String(r.data ?? '');
              const fields = Object.keys(r).filter((k) => k !== 'record' && k !== 'savedAt');
              const schema = JSON.stringify({ type: 'object', fields });
              return TE.right<ContentStorageError, ContentStorageGenerateSchemaOutput>(
                generateSchemaOk(schema),
              );
            },
          ),
        ),
      ),
    ),
};
