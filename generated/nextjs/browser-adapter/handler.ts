import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { BrowserAdapterStorage, BrowserAdapterNormalizeInput, BrowserAdapterNormalizeOutput } from './types.js';
import { normalizeOk, normalizeError } from './types.js';

export interface BrowserAdapterError { readonly code: string; readonly message: string; }
export interface BrowserAdapterHandler {
  readonly normalize: (input: BrowserAdapterNormalizeInput, storage: BrowserAdapterStorage) => TE.TaskEither<BrowserAdapterError, BrowserAdapterNormalizeOutput>;
}

const err = (error: unknown): BrowserAdapterError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const browserAdapterHandler: BrowserAdapterHandler = {
  normalize: (input, storage) => pipe(TE.tryCatch(async () => {
    if (!input.props || input.props.trim() === '') {
      return normalizeError(`Failed to parse props for adapter '${input.adapter}': invalid JSON`);
    }
    const normalizedJson = input.props;
    await storage.put('normalizations', input.adapter, { adapter: input.adapter, normalized: normalizedJson });
    return normalizeOk(input.adapter, normalizedJson);
  }, err)),
};
