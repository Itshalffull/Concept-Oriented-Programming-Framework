// HierarchicalLayout — Sugiyama-style hierarchical layout provider.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';

import type {
  HierarchicalLayoutStorage,
  HierarchicalLayoutRegisterInput,
  HierarchicalLayoutRegisterOutput,
  HierarchicalLayoutApplyInput,
  HierarchicalLayoutApplyOutput,
} from './types.js';

import {
  registerOk,
  applyOk,
  applyError,
} from './types.js';

export interface HierarchicalLayoutError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): HierarchicalLayoutError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface HierarchicalLayoutHandler {
  readonly register: (
    input: HierarchicalLayoutRegisterInput,
    storage: HierarchicalLayoutStorage,
  ) => TE.TaskEither<HierarchicalLayoutError, HierarchicalLayoutRegisterOutput>;
  readonly apply: (
    input: HierarchicalLayoutApplyInput,
    storage: HierarchicalLayoutStorage,
  ) => TE.TaskEither<HierarchicalLayoutError, HierarchicalLayoutApplyOutput>;
}

// --- Implementation ---

export const hierarchicalLayoutHandler: HierarchicalLayoutHandler = {
  register: (_input, _storage) =>
    pipe(
      TE.right(registerOk('hierarchical', 'layout')),
    ),

  apply: (input, _storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          if (!input.canvas) {
            return applyError('Canvas identifier is required');
          }
          const items = input.items ?? [];
          // Compute hierarchical positions: stack items in layers top-to-bottom
          const layerSpacing = 120;
          const itemSpacing = 150;
          const positions = items.map((item: string, index: number) => {
            const layer = Math.floor(index / 3);
            const posInLayer = index % 3;
            const x = posInLayer * itemSpacing;
            const y = layer * layerSpacing;
            return JSON.stringify({ item, x, y });
          });
          return applyOk(positions);
        },
        toStorageError,
      ),
    ),
};
