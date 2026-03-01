// PageAsRecord — Wiki/CMS pages as structured records: create pages with schemas,
// set/get typed properties, append content, attach schemas, and convert freeform pages.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  PageAsRecordStorage,
  PageAsRecordCreateInput,
  PageAsRecordCreateOutput,
  PageAsRecordSetPropertyInput,
  PageAsRecordSetPropertyOutput,
  PageAsRecordGetPropertyInput,
  PageAsRecordGetPropertyOutput,
  PageAsRecordAppendToBodyInput,
  PageAsRecordAppendToBodyOutput,
  PageAsRecordAttachToSchemaInput,
  PageAsRecordAttachToSchemaOutput,
  PageAsRecordConvertFromFreeformInput,
  PageAsRecordConvertFromFreeformOutput,
} from './types.js';

import {
  createOk,
  createExists,
  setPropertyOk,
  setPropertyNotfound,
  setPropertyInvalid,
  getPropertyOk,
  getPropertyNotfound,
  appendToBodyOk,
  appendToBodyNotfound,
  attachToSchemaOk,
  attachToSchemaNotfound,
  convertFromFreeformOk,
  convertFromFreeformNotfound,
} from './types.js';

export interface PageAsRecordError {
  readonly code: string;
  readonly message: string;
}

const toPageAsRecordError = (error: unknown): PageAsRecordError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface PageAsRecordHandler {
  readonly create: (
    input: PageAsRecordCreateInput,
    storage: PageAsRecordStorage,
  ) => TE.TaskEither<PageAsRecordError, PageAsRecordCreateOutput>;
  readonly setProperty: (
    input: PageAsRecordSetPropertyInput,
    storage: PageAsRecordStorage,
  ) => TE.TaskEither<PageAsRecordError, PageAsRecordSetPropertyOutput>;
  readonly getProperty: (
    input: PageAsRecordGetPropertyInput,
    storage: PageAsRecordStorage,
  ) => TE.TaskEither<PageAsRecordError, PageAsRecordGetPropertyOutput>;
  readonly appendToBody: (
    input: PageAsRecordAppendToBodyInput,
    storage: PageAsRecordStorage,
  ) => TE.TaskEither<PageAsRecordError, PageAsRecordAppendToBodyOutput>;
  readonly attachToSchema: (
    input: PageAsRecordAttachToSchemaInput,
    storage: PageAsRecordStorage,
  ) => TE.TaskEither<PageAsRecordError, PageAsRecordAttachToSchemaOutput>;
  readonly convertFromFreeform: (
    input: PageAsRecordConvertFromFreeformInput,
    storage: PageAsRecordStorage,
  ) => TE.TaskEither<PageAsRecordError, PageAsRecordConvertFromFreeformOutput>;
}

// --- Implementation ---

export const pageAsRecordHandler: PageAsRecordHandler = {
  // Create a new page with a schema. Returns 'exists' if the page ID is already taken.
  create: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('page', input.page),
        toPageAsRecordError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('page', input.page, {
                    page: input.page,
                    schema: input.schema,
                    properties: {},
                    body: '',
                    createdAt: new Date().toISOString(),
                  });
                  return createOk(input.page);
                },
                toPageAsRecordError,
              ),
            () =>
              TE.right<PageAsRecordError, PageAsRecordCreateOutput>(
                createExists(`Page '${input.page}' already exists`),
              ),
          ),
        ),
      ),
    ),

  // Set a property on a page. Returns notfound if page missing, invalid if key is empty.
  setProperty: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('page', input.page),
        toPageAsRecordError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<PageAsRecordError, PageAsRecordSetPropertyOutput>(
                setPropertyNotfound(`Page '${input.page}' not found`),
              ),
            (existing) => {
              if (!input.key || input.key.trim().length === 0) {
                return TE.right<PageAsRecordError, PageAsRecordSetPropertyOutput>(
                  setPropertyInvalid('Property key cannot be empty'),
                );
              }
              return TE.tryCatch(
                async () => {
                  const r = existing as Record<string, unknown>;
                  const properties = typeof r.properties === 'object' && r.properties !== null
                    ? { ...(r.properties as Record<string, string>) }
                    : {};
                  properties[input.key] = input.value;
                  await storage.put('page', input.page, { ...existing, properties });
                  return setPropertyOk(input.page);
                },
                toPageAsRecordError,
              );
            },
          ),
        ),
      ),
    ),

  // Get a single property value from a page. Returns notfound if page or property is missing.
  getProperty: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('page', input.page),
        toPageAsRecordError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<PageAsRecordError, PageAsRecordGetPropertyOutput>(
                getPropertyNotfound(`Page '${input.page}' not found`),
              ),
            (found) => {
              const r = found as Record<string, unknown>;
              const properties = typeof r.properties === 'object' && r.properties !== null
                ? (r.properties as Record<string, string>)
                : {};
              const value = properties[input.key];
              if (value === undefined) {
                return TE.right<PageAsRecordError, PageAsRecordGetPropertyOutput>(
                  getPropertyNotfound(`Property '${input.key}' not found on page '${input.page}'`),
                );
              }
              return TE.right<PageAsRecordError, PageAsRecordGetPropertyOutput>(
                getPropertyOk(String(value)),
              );
            },
          ),
        ),
      ),
    ),

  // Append content to the page body. Returns notfound if page does not exist.
  appendToBody: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('page', input.page),
        toPageAsRecordError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<PageAsRecordError, PageAsRecordAppendToBodyOutput>(
                appendToBodyNotfound(`Page '${input.page}' not found`),
              ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const r = existing as Record<string, unknown>;
                  const currentBody = typeof r.body === 'string' ? r.body : '';
                  await storage.put('page', input.page, {
                    ...existing,
                    body: currentBody + input.content,
                  });
                  return appendToBodyOk(input.page);
                },
                toPageAsRecordError,
              ),
          ),
        ),
      ),
    ),

  // Attach a different schema to an existing page. Returns notfound if page is missing.
  attachToSchema: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('page', input.page),
        toPageAsRecordError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<PageAsRecordError, PageAsRecordAttachToSchemaOutput>(
                attachToSchemaNotfound(`Page '${input.page}' not found`),
              ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  await storage.put('page', input.page, { ...existing, schema: input.schema });
                  return attachToSchemaOk(input.page);
                },
                toPageAsRecordError,
              ),
          ),
        ),
      ),
    ),

  // Convert a freeform (unstructured) page to a schema-backed record page.
  convertFromFreeform: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('page', input.page),
        toPageAsRecordError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<PageAsRecordError, PageAsRecordConvertFromFreeformOutput>(
                convertFromFreeformNotfound(`Page '${input.page}' not found`),
              ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const r = existing as Record<string, unknown>;
                  // Initialize empty properties if not already structured
                  const properties = typeof r.properties === 'object' && r.properties !== null
                    ? r.properties
                    : {};
                  await storage.put('page', input.page, {
                    ...existing,
                    schema: input.schema,
                    properties,
                    convertedAt: new Date().toISOString(),
                  });
                  return convertFromFreeformOk(input.page);
                },
                toPageAsRecordError,
              ),
          ),
        ),
      ),
    ),
};
