// Shape — Basic geometric primitives with fill, stroke, and text.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ShapeStorage,
  ShapeCreateInput,
  ShapeCreateOutput,
  ShapeUpdateInput,
  ShapeUpdateOutput,
  ShapeDeleteInput,
  ShapeDeleteOutput,
  ShapeListInput,
  ShapeListOutput,
} from './types.js';

import {
  createOk,
  updateOk,
  updateNotfound,
  deleteOk,
  deleteNotfound,
  listOk,
} from './types.js';

export interface ShapeError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): ShapeError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

let idCounter = 0;
function nextId(): string {
  return `shape-${++idCounter}`;
}

export interface ShapeHandler {
  readonly create: (
    input: ShapeCreateInput,
    storage: ShapeStorage,
  ) => TE.TaskEither<ShapeError, ShapeCreateOutput>;
  readonly update: (
    input: ShapeUpdateInput,
    storage: ShapeStorage,
  ) => TE.TaskEither<ShapeError, ShapeUpdateOutput>;
  readonly delete: (
    input: ShapeDeleteInput,
    storage: ShapeStorage,
  ) => TE.TaskEither<ShapeError, ShapeDeleteOutput>;
  readonly list: (
    input: ShapeListInput,
    storage: ShapeStorage,
  ) => TE.TaskEither<ShapeError, ShapeListOutput>;
}

// --- Implementation ---

export const shapeHandler: ShapeHandler = {
  create: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const id = nextId();
          const now = new Date().toISOString();
          await storage.put('shape', id, {
            id,
            kind: input.kind,
            fill: input.fill ?? null,
            stroke: input.stroke ?? null,
            text: input.text ?? null,
            createdAt: now,
            updatedAt: now,
          });
          return createOk(id);
        },
        toStorageError,
      ),
    ),

  update: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('shape', input.shape),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                updateNotfound(`Shape '${input.shape}' not found`),
              ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  const updated = { ...existing };
                  if (input.fill !== undefined) updated['fill'] = input.fill;
                  if (input.stroke !== undefined) updated['stroke'] = input.stroke;
                  if (input.text !== undefined) updated['text'] = input.text;
                  updated['updatedAt'] = now;
                  await storage.put('shape', input.shape, updated);
                  return updateOk();
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  delete: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('shape', input.shape),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                deleteNotfound(`Shape '${input.shape}' not found`),
              ),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('shape', input.shape);
                  return deleteOk();
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  list: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('shape', input.kind ? { kind: input.kind } : undefined),
        toStorageError,
      ),
      TE.map((records) => listOk(JSON.stringify(records))),
    ),
};
