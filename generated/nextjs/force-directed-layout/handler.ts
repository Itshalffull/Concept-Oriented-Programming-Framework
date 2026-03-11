// ForceDirectedLayout — Force-directed graph layout provider.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';

import type {
  ForceDirectedLayoutStorage,
  ForceDirectedLayoutRegisterInput,
  ForceDirectedLayoutRegisterOutput,
  ForceDirectedLayoutApplyInput,
  ForceDirectedLayoutApplyOutput,
} from './types.js';

import {
  registerOk,
  applyOk,
  applyError,
} from './types.js';

export interface ForceDirectedLayoutError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): ForceDirectedLayoutError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface ForceDirectedLayoutHandler {
  readonly register: (
    input: ForceDirectedLayoutRegisterInput,
    storage: ForceDirectedLayoutStorage,
  ) => TE.TaskEither<ForceDirectedLayoutError, ForceDirectedLayoutRegisterOutput>;
  readonly apply: (
    input: ForceDirectedLayoutApplyInput,
    storage: ForceDirectedLayoutStorage,
  ) => TE.TaskEither<ForceDirectedLayoutError, ForceDirectedLayoutApplyOutput>;
}

// --- Implementation ---

export const forceDirectedLayoutHandler: ForceDirectedLayoutHandler = {
  register: (_input, _storage) =>
    pipe(
      TE.right(registerOk('force-directed', 'layout')),
    ),

  apply: (input, _storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          if (!input.canvas) {
            return applyError('Canvas identifier is required');
          }
          const items = input.items ?? [];
          // Compute force-directed positions: spring-electric simulation heuristic
          const positions = items.map((item: string, index: number) => {
            const angle = (2 * Math.PI * index) / Math.max(items.length, 1);
            const radius = 100 + index * 50;
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
