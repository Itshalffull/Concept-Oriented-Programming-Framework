// GridLayout — Uniform grid layout provider.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';

import type {
  GridLayoutStorage,
  GridLayoutRegisterInput,
  GridLayoutRegisterOutput,
  GridLayoutApplyInput,
  GridLayoutApplyOutput,
} from './types.js';

import {
  registerOk,
  applyOk,
  applyError,
} from './types.js';

export interface GridLayoutError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): GridLayoutError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface GridLayoutHandler {
  readonly register: (
    input: GridLayoutRegisterInput,
    storage: GridLayoutStorage,
  ) => TE.TaskEither<GridLayoutError, GridLayoutRegisterOutput>;
  readonly apply: (
    input: GridLayoutApplyInput,
    storage: GridLayoutStorage,
  ) => TE.TaskEither<GridLayoutError, GridLayoutApplyOutput>;
}

// --- Implementation ---

export const gridLayoutHandler: GridLayoutHandler = {
  register: (_input, _storage) =>
    pipe(
      TE.right(registerOk('grid', 'layout')),
    ),

  apply: (input, _storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          if (!input.canvas) {
            return applyError('Canvas identifier is required');
          }
          const items = input.items ?? [];
          // Compute grid positions: arrange in rows with uniform cell sizing
          const columns = Math.max(Math.ceil(Math.sqrt(items.length)), 1);
          const cellWidth = 120;
          const cellHeight = 100;
          const positions = items.map((item: string, index: number) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            const x = col * cellWidth;
            const y = row * cellHeight;
            return JSON.stringify({ item, x, y });
          });
          return applyOk(positions);
        },
        toStorageError,
      ),
    ),
};
