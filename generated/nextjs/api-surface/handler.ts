import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { ApiSurfaceStorage, ApiSurfaceComposeInput, ApiSurfaceComposeOutput, ApiSurfaceEntrypointInput, ApiSurfaceEntrypointOutput } from './types.js';
import { composeOk, entrypointOk } from './types.js';
export interface ApiSurfaceError { readonly code: string; readonly message: string; }
export interface ApiSurfaceHandler {
  readonly compose: (input: ApiSurfaceComposeInput, storage: ApiSurfaceStorage) => TE.TaskEither<ApiSurfaceError, ApiSurfaceComposeOutput>;
  readonly entrypoint: (input: ApiSurfaceEntrypointInput, storage: ApiSurfaceStorage) => TE.TaskEither<ApiSurfaceError, ApiSurfaceEntrypointOutput>;
}
let _surfaceCounter = 0;
const err = (error: unknown): ApiSurfaceError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });
export const apiSurfaceHandler: ApiSurfaceHandler = {
  compose: (input, storage) => pipe(TE.tryCatch(async () => {
    _surfaceCounter++;
    const surfaceId = `surface-${_surfaceCounter}`;
    const ep = `${input.target}://${input.kit}/entrypoint`;
    await storage.put('apisurface', surfaceId, { kit: input.kit, target: input.target, entrypoint: ep, conceptCount: 2 });
    return composeOk(surfaceId, ep, 2);
  }, err)),
  entrypoint: (input, storage) => pipe(TE.tryCatch(async () => {
    const r = await storage.get('apisurface', input.surface);
    return entrypointOk(r ? String(r.entrypoint ?? '') : '');
  }, err)),
};
