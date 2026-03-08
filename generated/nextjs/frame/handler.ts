// Frame — Named spatial regions for grouping items with bounds and background.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  FrameStorage,
  FrameCreateInput,
  FrameCreateOutput,
  FrameResizeInput,
  FrameResizeOutput,
  FrameRenameInput,
  FrameRenameOutput,
  FrameAddItemInput,
  FrameAddItemOutput,
  FrameRemoveItemInput,
  FrameRemoveItemOutput,
  FrameDeleteInput,
  FrameDeleteOutput,
  FrameListInput,
  FrameListOutput,
  FrameSetBackgroundInput,
  FrameSetBackgroundOutput,
} from './types.js';

import {
  createOk,
  resizeOk,
  resizeNotfound,
  renameOk,
  renameNotfound,
  addItemOk,
  addItemNotfound,
  removeItemOk,
  removeItemNotfound,
  deleteOk,
  deleteNotfound,
  listOk,
  setBackgroundOk,
  setBackgroundNotfound,
} from './types.js';

export interface FrameError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): FrameError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

let idCounter = 0;
function nextId(): string {
  return `frame-${++idCounter}`;
}

export interface FrameHandler {
  readonly create: (
    input: FrameCreateInput,
    storage: FrameStorage,
  ) => TE.TaskEither<FrameError, FrameCreateOutput>;
  readonly resize: (
    input: FrameResizeInput,
    storage: FrameStorage,
  ) => TE.TaskEither<FrameError, FrameResizeOutput>;
  readonly rename: (
    input: FrameRenameInput,
    storage: FrameStorage,
  ) => TE.TaskEither<FrameError, FrameRenameOutput>;
  readonly addItem: (
    input: FrameAddItemInput,
    storage: FrameStorage,
  ) => TE.TaskEither<FrameError, FrameAddItemOutput>;
  readonly removeItem: (
    input: FrameRemoveItemInput,
    storage: FrameStorage,
  ) => TE.TaskEither<FrameError, FrameRemoveItemOutput>;
  readonly delete: (
    input: FrameDeleteInput,
    storage: FrameStorage,
  ) => TE.TaskEither<FrameError, FrameDeleteOutput>;
  readonly list: (
    input: FrameListInput,
    storage: FrameStorage,
  ) => TE.TaskEither<FrameError, FrameListOutput>;
  readonly setBackground: (
    input: FrameSetBackgroundInput,
    storage: FrameStorage,
  ) => TE.TaskEither<FrameError, FrameSetBackgroundOutput>;
}

// --- Implementation ---

export const frameHandler: FrameHandler = {
  create: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const id = nextId();
          const now = new Date().toISOString();
          await storage.put('frame', id, {
            id,
            canvas: input.canvas,
            name: input.name,
            x: input.x,
            y: input.y,
            width: input.width,
            height: input.height,
            items: '[]',
            background: null,
            createdAt: now,
            updatedAt: now,
          });
          return createOk(id);
        },
        toStorageError,
      ),
    ),

  resize: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('frame', input.frame),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                resizeNotfound(`Frame '${input.frame}' not found`),
              ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  await storage.put('frame', input.frame, {
                    ...existing,
                    width: input.width,
                    height: input.height,
                    updatedAt: now,
                  });
                  return resizeOk();
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  rename: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('frame', input.frame),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                renameNotfound(`Frame '${input.frame}' not found`),
              ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  await storage.put('frame', input.frame, {
                    ...existing,
                    name: input.name,
                    updatedAt: now,
                  });
                  return renameOk();
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  addItem: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('frame', input.frame),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                addItemNotfound(`Frame '${input.frame}' not found`),
              ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  const items: readonly string[] =
                    existing['items'] ? JSON.parse(String(existing['items'])) : [];
                  const updatedItems = [...items, input.item_id];
                  await storage.put('frame', input.frame, {
                    ...existing,
                    items: JSON.stringify(updatedItems),
                    updatedAt: now,
                  });
                  return addItemOk();
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  removeItem: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('frame', input.frame),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                removeItemNotfound(`Frame '${input.frame}' not found`),
              ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  const items: readonly string[] =
                    existing['items'] ? JSON.parse(String(existing['items'])) : [];
                  const updatedItems = items.filter((i) => i !== input.item_id);
                  await storage.put('frame', input.frame, {
                    ...existing,
                    items: JSON.stringify(updatedItems),
                    updatedAt: now,
                  });
                  return removeItemOk();
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
        () => storage.get('frame', input.frame),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                deleteNotfound(`Frame '${input.frame}' not found`),
              ),
            () =>
              TE.tryCatch(
                async () => {
                  await storage.delete('frame', input.frame);
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
        () => storage.find('frame', input.canvas ? { canvas: input.canvas } : undefined),
        toStorageError,
      ),
      TE.map((records) => listOk(JSON.stringify(records))),
    ),

  setBackground: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('frame', input.frame),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                setBackgroundNotfound(`Frame '${input.frame}' not found`),
              ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  await storage.put('frame', input.frame, {
                    ...existing,
                    background: input.color,
                    updatedAt: now,
                  });
                  return setBackgroundOk();
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),
};
