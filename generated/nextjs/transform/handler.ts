// Transform — Data transformation pipeline
// Defines named transforms with logic expressions, applies individual
// transforms or chains of transforms to input values, and previews
// before/after results without persisting side effects.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  TransformStorage,
  TransformApplyInput,
  TransformApplyOutput,
  TransformChainInput,
  TransformChainOutput,
  TransformPreviewInput,
  TransformPreviewOutput,
} from './types.js';

import {
  applyOk,
  applyNotfound,
  applyError,
  chainOk,
  chainError,
  previewOk,
  previewNotfound,
} from './types.js';

export interface TransformError {
  readonly code: string;
  readonly message: string;
}

export interface TransformHandler {
  readonly apply: (
    input: TransformApplyInput,
    storage: TransformStorage,
  ) => TE.TaskEither<TransformError, TransformApplyOutput>;
  readonly chain: (
    input: TransformChainInput,
    storage: TransformStorage,
  ) => TE.TaskEither<TransformError, TransformChainOutput>;
  readonly preview: (
    input: TransformPreviewInput,
    storage: TransformStorage,
  ) => TE.TaskEither<TransformError, TransformPreviewOutput>;
}

const storageError = (error: unknown): TransformError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Apply a stored transform function to a value.
// Transform records contain a "kind" field indicating the operation type
// and a "config" field with operation-specific parameters.
const executeTransform = (value: string, transformRecord: Record<string, unknown>): string => {
  const kind = String(transformRecord.kind ?? 'identity');
  const config = (transformRecord.config ?? {}) as Record<string, unknown>;

  switch (kind) {
    case 'uppercase':
      return value.toUpperCase();
    case 'lowercase':
      return value.toLowerCase();
    case 'trim':
      return value.trim();
    case 'prefix': {
      const prefix = String(config.prefix ?? '');
      return `${prefix}${value}`;
    }
    case 'suffix': {
      const suffix = String(config.suffix ?? '');
      return `${value}${suffix}`;
    }
    case 'replace': {
      const from = String(config.from ?? '');
      const to = String(config.to ?? '');
      return from.length > 0 ? value.split(from).join(to) : value;
    }
    case 'slice': {
      const start = typeof config.start === 'number' ? config.start : 0;
      const end = typeof config.end === 'number' ? config.end : undefined;
      return value.slice(start, end);
    }
    case 'json-extract': {
      const path = String(config.path ?? '');
      try {
        const parsed = JSON.parse(value);
        const keys = path.split('.');
        let current: unknown = parsed;
        for (const key of keys) {
          if (typeof current === 'object' && current !== null && key in current) {
            current = (current as Record<string, unknown>)[key];
          } else {
            return '';
          }
        }
        return typeof current === 'string' ? current : JSON.stringify(current);
      } catch {
        return value;
      }
    }
    case 'identity':
    default:
      return value;
  }
};

// --- Implementation ---

export const transformHandler: TransformHandler = {
  // Apply a single named transform to a value. Looks up the transform
  // definition, executes it, and records the transformation history.
  apply: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('transforms', input.transformId),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(applyNotfound(`Transform '${input.transformId}' not found`)),
            (found) => {
              const transformData = found as Record<string, unknown>;

              try {
                const result = executeTransform(input.value, transformData);

                return TE.tryCatch(
                  async () => {
                    // Log the transformation
                    const now = new Date().toISOString();
                    await storage.put('transform_history', `${input.transformId}::${now}`, {
                      transformId: input.transformId,
                      inputValue: input.value,
                      outputValue: result,
                      appliedAt: now,
                    });

                    return applyOk(result);
                  },
                  storageError,
                );
              } catch (err) {
                return TE.right(applyError(
                  `Transform '${input.transformId}' failed: ${err instanceof Error ? err.message : String(err)}`,
                ));
              }
            },
          ),
        ),
      ),
    ),

  // Chain multiple transforms together, applying each one sequentially.
  // The output of each transform becomes the input to the next.
  // Stops at the first failure and reports which transform failed.
  chain: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Parse the comma-separated transform IDs
          const transformIds = input.transformIds
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id.length > 0);

          if (transformIds.length === 0) {
            return chainOk(input.value);
          }

          let currentValue = input.value;

          for (const transformId of transformIds) {
            const record = await storage.get('transforms', transformId);

            if (!record) {
              return chainError(
                `Transform '${transformId}' not found in chain`,
                transformId,
              );
            }

            const transformData = record as Record<string, unknown>;

            try {
              currentValue = executeTransform(currentValue, transformData);
            } catch (err) {
              return chainError(
                `Transform '${transformId}' failed: ${err instanceof Error ? err.message : String(err)}`,
                transformId,
              );
            }
          }

          // Log the chain execution
          const now = new Date().toISOString();
          await storage.put('transform_history', `chain::${now}`, {
            transformIds,
            inputValue: input.value,
            outputValue: currentValue,
            appliedAt: now,
          });

          return chainOk(currentValue);
        },
        storageError,
      ),
    ),

  // Preview a transform application without recording history.
  // Shows both the before and after values side by side.
  preview: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('transforms', input.transformId),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(previewNotfound(`Transform '${input.transformId}' not found`)),
            (found) => {
              const transformData = found as Record<string, unknown>;
              const result = executeTransform(input.value, transformData);
              return TE.right(previewOk(input.value, result));
            },
          ),
        ),
      ),
    ),
};
