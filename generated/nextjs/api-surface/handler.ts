import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { ApiSurfaceStorage, ApiSurfaceComposeInput, ApiSurfaceComposeOutput, ApiSurfaceEntrypointInput, ApiSurfaceEntrypointOutput } from './types.js';
import { composeOk, composeConflictingRoutes, entrypointOk } from './types.js';
export interface ApiSurfaceError { readonly code: string; readonly message: string; }
export interface ApiSurfaceHandler {
  readonly compose: (input: ApiSurfaceComposeInput, storage: ApiSurfaceStorage) => TE.TaskEither<ApiSurfaceError, ApiSurfaceComposeOutput>;
  readonly entrypoint: (input: ApiSurfaceEntrypointInput, storage: ApiSurfaceStorage) => TE.TaskEither<ApiSurfaceError, ApiSurfaceEntrypointOutput>;
}
let _surfaceCounter = 0;
const err = (error: unknown): ApiSurfaceError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });
export const apiSurfaceHandler: ApiSurfaceHandler = {
  compose: (input, storage) => pipe(TE.tryCatch(async () => {
    const outputs = input.outputs ?? [`${input.kit}/create`, `${input.kit}/get`];
    const existing = await storage.find('concept-outputs');
    const conflicts: string[] = [];
    for (const e of existing) {
      const path = e.path as string;
      if (outputs.includes(path)) conflicts.push(path);
    }
    if (conflicts.length > 0) return composeConflictingRoutes(input.target, conflicts);
    _surfaceCounter++;
    const surfaceId = `surface-${_surfaceCounter}`;
    const ep = `${input.target}://${input.kit}/entrypoint`;
    const conceptCount = outputs.length;
    await storage.put('apisurface', surfaceId, { kit: input.kit, target: input.target, entrypoint: ep, conceptCount, outputs: outputs as unknown as Record<string, unknown> });
    return composeOk(surfaceId, ep, conceptCount);
  }, err)),
  entrypoint: (input, storage) => pipe(TE.tryCatch(async () => {
    const r = await storage.get('apisurface', input.surface);
    if (!r) return entrypointOk(`Surface ${input.surface} not found`);
    const outputs = (r.outputs as string[]) ?? [];
    const lines = [`// ${r.target} entrypoint for ${r.kit}`, ...outputs.map(o => `export { default as ${o.replace(/\//g, '_')} } from './${o}';`)];
    return entrypointOk(lines.join('\n'));
  }, err)),
};
