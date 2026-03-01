// Slot — handler.ts
// Surface concept: named insertion points in widget templates.
// Registers named slots within host widgets, fills them with content,
// and supports fallback content when no explicit fill is provided.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SlotStorage,
  SlotDefineInput,
  SlotDefineOutput,
  SlotFillInput,
  SlotFillOutput,
  SlotClearInput,
  SlotClearOutput,
} from './types.js';

import {
  defineOk,
  defineDuplicate,
  fillOk,
  fillNotfound,
  clearOk,
  clearNotfound,
} from './types.js';

export interface SlotError {
  readonly code: string;
  readonly message: string;
}

export interface SlotHandler {
  readonly define: (
    input: SlotDefineInput,
    storage: SlotStorage,
  ) => TE.TaskEither<SlotError, SlotDefineOutput>;
  readonly fill: (
    input: SlotFillInput,
    storage: SlotStorage,
  ) => TE.TaskEither<SlotError, SlotFillOutput>;
  readonly clear: (
    input: SlotClearInput,
    storage: SlotStorage,
  ) => TE.TaskEither<SlotError, SlotClearOutput>;
}

// --- Domain helpers ---

const mkStorageError = (error: unknown): SlotError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const VALID_POSITIONS = ['before', 'after', 'replace', 'prepend', 'append'] as const;

const isValidPosition = (position: string): boolean =>
  (VALID_POSITIONS as readonly string[]).includes(position);

// --- Implementation ---

export const slotHandler: SlotHandler = {
  define: (input, storage) =>
    pipe(
      isValidPosition(input.position)
        ? E.right(input.position)
        : E.left(`Invalid slot position "${input.position}": must be one of ${VALID_POSITIONS.join(', ')}`),
      E.fold(
        (msg) =>
          TE.left<SlotError>({ code: 'INVALID_POSITION', message: msg }),
        () =>
          pipe(
            TE.tryCatch(
              () => storage.get('slots', input.slot),
              mkStorageError,
            ),
            TE.chain((existing) =>
              pipe(
                O.fromNullable(existing),
                O.fold(
                  () =>
                    TE.tryCatch(
                      async () => {
                        const fallbackContent = pipe(
                          input.fallback,
                          O.getOrElse(() => ''),
                        );
                        const record = {
                          slot: input.slot,
                          name: input.name,
                          host: input.host,
                          position: input.position,
                          fallback: fallbackContent,
                          filled: false,
                          content: '',
                          createdAt: new Date().toISOString(),
                        };
                        await storage.put('slots', input.slot, record);
                        return defineOk(input.slot);
                      },
                      mkStorageError,
                    ),
                  () =>
                    TE.right(
                      defineDuplicate(
                        `Slot "${input.slot}" is already defined on host "${input.host}"`,
                      ),
                    ),
                ),
              ),
            ),
          ),
      ),
    ),

  fill: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('slots', input.slot),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                fillNotfound(`Slot "${input.slot}" not found`),
              ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const updated = {
                    ...existing,
                    content: input.content,
                    filled: true,
                    filledAt: new Date().toISOString(),
                  };
                  await storage.put('slots', input.slot, updated);
                  return fillOk(input.slot);
                },
                mkStorageError,
              ),
          ),
        ),
      ),
    ),

  clear: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('slots', input.slot),
        mkStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                clearNotfound(`Slot "${input.slot}" not found`),
              ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const updated = {
                    ...existing,
                    content: '',
                    filled: false,
                  };
                  await storage.put('slots', input.slot, updated);
                  return clearOk(input.slot);
                },
                mkStorageError,
              ),
          ),
        ),
      ),
    ),
};
