// Widget — handler.ts
// Surface concept: widget registry with register/get/list/unregister.
// Validates widget names, tracks widget metadata (type, version, dependencies).

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  WidgetStorage,
  WidgetRegisterInput,
  WidgetRegisterOutput,
  WidgetGetInput,
  WidgetGetOutput,
  WidgetListInput,
  WidgetListOutput,
  WidgetUnregisterInput,
  WidgetUnregisterOutput,
} from './types.js';

import {
  registerOk,
  registerDuplicate,
  registerInvalid,
  getOk,
  getNotfound,
  listOk,
  unregisterOk,
  unregisterNotfound,
} from './types.js';

export interface WidgetError {
  readonly code: string;
  readonly message: string;
}

export interface WidgetHandler {
  readonly register: (
    input: WidgetRegisterInput,
    storage: WidgetStorage,
  ) => TE.TaskEither<WidgetError, WidgetRegisterOutput>;
  readonly get: (
    input: WidgetGetInput,
    storage: WidgetStorage,
  ) => TE.TaskEither<WidgetError, WidgetGetOutput>;
  readonly list: (
    input: WidgetListInput,
    storage: WidgetStorage,
  ) => TE.TaskEither<WidgetError, WidgetListOutput>;
  readonly unregister: (
    input: WidgetUnregisterInput,
    storage: WidgetStorage,
  ) => TE.TaskEither<WidgetError, WidgetUnregisterOutput>;
}

// --- Domain helpers ---

const WIDGET_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const VALID_CATEGORIES = ['display', 'input', 'layout', 'navigation', 'feedback', 'data', 'composite'] as const;

const mkStorageError = (error: unknown): WidgetError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const validateWidgetName = (name: string): E.Either<string, string> =>
  WIDGET_NAME_PATTERN.test(name)
    ? E.right(name)
    : E.left(`Invalid widget name "${name}": must start with a letter and contain only alphanumeric, hyphens, or underscores (max 64 chars)`);

const validateCategory = (category: string): E.Either<string, string> =>
  (VALID_CATEGORIES as readonly string[]).includes(category)
    ? E.right(category)
    : E.left(`Invalid category "${category}": must be one of ${VALID_CATEGORIES.join(', ')}`);

// --- Implementation ---

export const widgetHandler: WidgetHandler = {
  register: (input, storage) =>
    pipe(
      validateWidgetName(input.name),
      E.chain(() => validateCategory(input.category)),
      E.fold(
        (validationMsg) => TE.right(registerInvalid(validationMsg)),
        () =>
          pipe(
            TE.tryCatch(
              () => storage.get('widgets', input.widget),
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
                          widget: input.widget,
                          name: input.name,
                          ast: input.ast,
                          category: input.category,
                          createdAt: new Date().toISOString(),
                        };
                        await storage.put('widgets', input.widget, record);
                        return registerOk(input.widget);
                      },
                      mkStorageError,
                    ),
                  () =>
                    TE.right(
                      registerDuplicate(`Widget "${input.widget}" is already registered`),
                    ),
                ),
              ),
            ),
          ),
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('widgets', input.widget),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(getNotfound(`Widget "${input.widget}" not found`)),
            (found) =>
              TE.right(
                getOk(
                  String(found['widget'] ?? input.widget),
                  String(found['ast'] ?? ''),
                  String(found['name'] ?? ''),
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
              () => storage.find('widgets'),
              (cat) => storage.find('widgets', { category: cat }),
            ),
          ),
        mkStorageError,
      ),
      TE.map((records) => {
        const widgetIds = records.map((r) => String(r['widget'] ?? ''));
        return listOk(JSON.stringify(widgetIds));
      }),
    ),

  unregister: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('widgets', input.widget),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                unregisterNotfound(`Widget "${input.widget}" not found`),
              ),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('widgets', input.widget);
                  return unregisterOk(input.widget);
                },
                mkStorageError,
              ),
          ),
        ),
      ),
    ),
};
