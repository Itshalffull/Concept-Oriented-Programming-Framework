import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { AppKitAdapterStorage, AppKitAdapterNormalizeInput, AppKitAdapterNormalizeOutput } from './types.js';
import { normalizeOk, normalizeError } from './types.js';

export interface AppKitAdapterError { readonly code: string; readonly message: string; }
export interface AppKitAdapterHandler {
  readonly normalize: (input: AppKitAdapterNormalizeInput, storage: AppKitAdapterStorage) => TE.TaskEither<AppKitAdapterError, AppKitAdapterNormalizeOutput>;
}

const err = (error: unknown): AppKitAdapterError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const appKitAdapterHandler: AppKitAdapterHandler = {
  normalize: (input, storage) => pipe(TE.tryCatch(async () => {
    if (!input.props || input.props.trim() === '') {
      return normalizeError(`Failed to parse props for adapter '${input.adapter}': invalid JSON`);
    }
    const normalizedJson = input.props;
    await storage.put('normalizations', input.adapter, { adapter: input.adapter, normalized: normalizedJson });
    return normalizeOk(input.adapter, normalizedJson);
  }, err)),
};
