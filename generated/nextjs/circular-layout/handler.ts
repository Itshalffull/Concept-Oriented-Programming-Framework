// CircularLayout — Circular/arc layout provider.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';

import type {
  CircularLayoutStorage,
  CircularLayoutRegisterInput,
  CircularLayoutRegisterOutput,
  CircularLayoutApplyInput,
  CircularLayoutApplyOutput,
} from './types.js';

import {
  registerOk,
  applyOk,
  applyError,
} from './types.js';

export interface CircularLayoutError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): CircularLayoutError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface CircularLayoutHandler {
  readonly register: (
    input: CircularLayoutRegisterInput,
    storage: CircularLayoutStorage,
  ) => TE.TaskEither<CircularLayoutError, CircularLayoutRegisterOutput>;
  readonly apply: (
    input: CircularLayoutApplyInput,
    storage: CircularLayoutStorage,
  ) => TE.TaskEither<CircularLayoutError, CircularLayoutApplyOutput>;
}

// --- Implementation ---

export const circularLayoutHandler: CircularLayoutHandler = {
  register: (_input, _storage) =>
    pipe(
      TE.right(registerOk('circular', 'layout')),
    ),

  apply: (input, _storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          if (!input.canvas) {
            return applyError('Canvas identifier is required');
          }
          const items = input.items ?? [];
          // Compute circular positions: distribute at equal angular intervals
          const radius = 200;
          const positions = items.map((item: string, index: number) => {
            const angle = (2 * Math.PI * index) / Math.max(items.length, 1);
            const x = Math.round(Math.cos(angle) * radius);
            const y = Math.round(Math.sin(angle) * radius);
            return JSON.stringify({ item, x, y });
          });
          return applyOk(positions);
        },
        toStorageError,
      ),
    ),
};
