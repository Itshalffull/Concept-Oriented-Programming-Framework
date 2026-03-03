import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { ContentDigestStorage, ContentDigestComputeInput, ContentDigestComputeOutput, ContentDigestLookupInput, ContentDigestLookupOutput } from './types.js';
import { computeOk, lookupOk } from './types.js';

export interface ContentDigestError { readonly code: string; readonly message: string; }
export interface ContentDigestHandler {
  readonly compute: (input: ContentDigestComputeInput, storage: ContentDigestStorage) => TE.TaskEither<ContentDigestError, ContentDigestComputeOutput>;
  readonly lookup: (input: ContentDigestLookupInput, storage: ContentDigestStorage) => TE.TaskEither<ContentDigestError, ContentDigestLookupOutput>;
}

let _digestCounter = 0;
const err = (error: unknown): ContentDigestError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const contentDigestHandler: ContentDigestHandler = {
  compute: (input, storage) => pipe(TE.tryCatch(async () => {
    _digestCounter++;
    const digest = `digest-${_digestCounter}`;
    await storage.put('digests', digest, { digest, unit: input.unit, algorithm: input.algorithm });
    return computeOk(digest);
  }, err)),
  lookup: (input, storage) => pipe(TE.tryCatch(async () => {
    const all = await storage.find('digests');
    const units = all.map(r => String(r.unit ?? '')).join(',');
    return lookupOk(units || '[]');
  }, err)),
};
