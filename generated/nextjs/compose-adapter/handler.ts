import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { ComposeAdapterStorage, ComposeAdapterNormalizeInput, ComposeAdapterNormalizeOutput } from './types.js';
import { normalizeOk, normalizeError } from './types.js';

export interface ComposeAdapterError { readonly code: string; readonly message: string; }
export interface ComposeAdapterHandler {
  readonly normalize: (input: ComposeAdapterNormalizeInput, storage: ComposeAdapterStorage) => TE.TaskEither<ComposeAdapterError, ComposeAdapterNormalizeOutput>;
}

const err = (error: unknown): ComposeAdapterError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const composeAdapterHandler: ComposeAdapterHandler = {
  normalize: (input, storage) => pipe(TE.tryCatch(async () => {
    if (!input.props || input.props.trim() === '') {
      return normalizeError(`Failed to parse props for adapter '${input.adapter}': invalid JSON`);
    }
    const normalizedJson = input.props;
    await storage.put('normalizations', input.adapter, { adapter: input.adapter, normalized: normalizedJson });
    return normalizeOk(input.adapter, normalizedJson);
  }, err)),
};
