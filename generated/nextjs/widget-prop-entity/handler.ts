// WidgetPropEntity — handler.ts
// Surface concept: widget property definitions.
// Defines typed props with defaults, validation rules, and serialization hints.
// Supports tracing props back to concept fields via bindings.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  WidgetPropEntityStorage,
  WidgetPropEntityRegisterInput,
  WidgetPropEntityRegisterOutput,
  WidgetPropEntityFindByWidgetInput,
  WidgetPropEntityFindByWidgetOutput,
  WidgetPropEntityTraceToFieldInput,
  WidgetPropEntityTraceToFieldOutput,
  WidgetPropEntityGetInput,
  WidgetPropEntityGetOutput,
} from './types.js';

import {
  registerOk,
  findByWidgetOk,
  traceToFieldOk,
  traceToFieldNoBinding,
  getOk,
  getNotfound,
} from './types.js';

export interface WidgetPropEntityError {
  readonly code: string;
  readonly message: string;
}

export interface WidgetPropEntityHandler {
  readonly register: (
    input: WidgetPropEntityRegisterInput,
    storage: WidgetPropEntityStorage,
  ) => TE.TaskEither<WidgetPropEntityError, WidgetPropEntityRegisterOutput>;
  readonly findByWidget: (
    input: WidgetPropEntityFindByWidgetInput,
    storage: WidgetPropEntityStorage,
  ) => TE.TaskEither<WidgetPropEntityError, WidgetPropEntityFindByWidgetOutput>;
  readonly traceToField: (
    input: WidgetPropEntityTraceToFieldInput,
    storage: WidgetPropEntityStorage,
  ) => TE.TaskEither<WidgetPropEntityError, WidgetPropEntityTraceToFieldOutput>;
  readonly get: (
    input: WidgetPropEntityGetInput,
    storage: WidgetPropEntityStorage,
  ) => TE.TaskEither<WidgetPropEntityError, WidgetPropEntityGetOutput>;
}

// --- Domain helpers ---

const VALID_TYPE_EXPRS = ['string', 'number', 'boolean', 'object', 'array', 'enum', 'slot', 'callback'] as const;

const mkStorageError = (error: unknown): WidgetPropEntityError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const derivePropId = (widget: string, name: string): string =>
  `${widget}::${name}`;

const isValidTypeExpr = (typeExpr: string): boolean => {
  const baseType = typeExpr.split('<')[0].split('|')[0].trim();
  return (VALID_TYPE_EXPRS as readonly string[]).includes(baseType) || typeExpr.includes('|');
};

// --- Implementation ---

export const widgetPropEntityHandler: WidgetPropEntityHandler = {
  register: (input, storage) =>
    pipe(
      TE.Do,
      TE.chain(() => {
        if (!isValidTypeExpr(input.typeExpr)) {
          return TE.left<WidgetPropEntityError>({
            code: 'INVALID_TYPE',
            message: `Type expression "${input.typeExpr}" is not a recognized prop type`,
          });
        }

        const propId = derivePropId(input.widget, input.name);

        return pipe(
          TE.tryCatch(
            async () => {
              const record = {
                prop: propId,
                widget: input.widget,
                name: input.name,
                typeExpr: input.typeExpr,
                defaultValue: input.defaultValue,
                createdAt: new Date().toISOString(),
              };
              await storage.put('props', propId, record);
              return registerOk(propId);
            },
            mkStorageError,
          ),
        );
      }),
    ),

  findByWidget: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('props', { widget: input.widget }),
        mkStorageError,
      ),
      TE.map((records) => {
        const props = records.map((r) => ({
          prop: String(r['prop'] ?? ''),
          name: String(r['name'] ?? ''),
          typeExpr: String(r['typeExpr'] ?? ''),
          defaultValue: String(r['defaultValue'] ?? ''),
        }));
        return findByWidgetOk(JSON.stringify(props));
      }),
    ),

  traceToField: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('props', input.prop),
        mkStorageError,
      ),
      TE.chain((propRecord) =>
        pipe(
          O.fromNullable(propRecord),
          O.fold(
            () => TE.right(traceToFieldNoBinding()),
            () =>
              pipe(
                TE.tryCatch(
                  () => storage.find('bindings', { prop: input.prop }),
                  mkStorageError,
                ),
                TE.map((bindings) => {
                  if (bindings.length === 0) {
                    return traceToFieldNoBinding();
                  }
                  const binding = bindings[0];
                  return traceToFieldOk(
                    String(binding['field'] ?? ''),
                    String(binding['concept'] ?? ''),
                    String(binding['viaBinding'] ?? ''),
                  );
                }),
              ),
          ),
        ),
      ),
    ),

  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('props', input.prop),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNotfound()),
            (found) =>
              TE.right(
                getOk(
                  String(found['prop'] ?? input.prop),
                  String(found['widget'] ?? ''),
                  String(found['name'] ?? ''),
                  String(found['typeExpr'] ?? ''),
                  String(found['defaultValue'] ?? ''),
                ),
              ),
          ),
        ),
      ),
    ),
};
