import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { DesktopAdapterStorage, DesktopAdapterNormalizeInput, DesktopAdapterNormalizeOutput } from './types.js';
import { normalizeOk, normalizeError } from './types.js';

export interface DesktopAdapterError { readonly code: string; readonly message: string; }
export interface DesktopAdapterHandler {
  readonly normalize: (input: DesktopAdapterNormalizeInput, storage: DesktopAdapterStorage) => TE.TaskEither<DesktopAdapterError, DesktopAdapterNormalizeOutput>;
}

const err = (error: unknown): DesktopAdapterError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const desktopAdapterHandler: DesktopAdapterHandler = {
  normalize: (input, storage) => pipe(TE.tryCatch(async () => {
    if (!input.props || input.props.trim() === '') {
      return normalizeError(`Failed to parse props for adapter '${input.adapter}': invalid JSON`);
    }
    const normalizedJson = input.props;
    await storage.put('normalizations', input.adapter, { adapter: input.adapter, normalized: normalizedJson });
    return normalizeOk(input.adapter, normalizedJson);
  }, err)),
};
