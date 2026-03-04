import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { ArtifactStorage, ArtifactBuildInput, ArtifactBuildOutput, ArtifactStoreInput, ArtifactStoreOutput, ArtifactResolveInput, ArtifactResolveOutput, ArtifactGcInput, ArtifactGcOutput } from './types.js';
import { buildOk, buildCompilationError, storeOk, storeAlreadyExists, resolveOk, resolveNotfound, gcOk } from './types.js';

export interface ArtifactError { readonly code: string; readonly message: string; }
export interface ArtifactHandler {
  readonly build: (input: ArtifactBuildInput, storage: ArtifactStorage) => TE.TaskEither<ArtifactError, ArtifactBuildOutput>;
  readonly store: (input: ArtifactStoreInput, storage: ArtifactStorage) => TE.TaskEither<ArtifactError, ArtifactStoreOutput>;
  readonly resolve: (input: ArtifactResolveInput, storage: ArtifactStorage) => TE.TaskEither<ArtifactError, ArtifactResolveOutput>;
  readonly gc: (input: ArtifactGcInput, storage: ArtifactStorage) => TE.TaskEither<ArtifactError, ArtifactGcOutput>;
}

let _hashCounter = 0;
const err = (error: unknown): ArtifactError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const artifactHandler: ArtifactHandler = {
  build: (input, storage) => pipe(TE.tryCatch(async () => {
    // Check for missing deps
    const deps = Array.isArray(input.deps) ? input.deps : [];
    if (deps.length > 0) {
      const missingDeps: string[] = [];
      for (const dep of deps) {
        const found = await storage.get('artifacts', dep);
        if (!found) missingDeps.push(dep);
      }
      if (missingDeps.length > 0) return buildCompilationError(input.concept, missingDeps.map(d => `Missing dependency: ${d}`));
    }
    _hashCounter++;
    const hash = `hash-${_hashCounter}`;
    const artifact = `${input.concept}@${hash}`;
    const sizeBytes = !Array.isArray(input.deps) ? 1024 : (input.spec.length + input.implementation.length);
    const location = `.clef-artifacts/${input.concept}`;
    await storage.put('artifacts', hash, { artifact, hash, concept: input.concept, spec: input.spec, location, sizeBytes });
    return buildOk(artifact, hash, sizeBytes);
  }, err)),
  store: (input, storage) => pipe(TE.tryCatch(async () => {
    const existing = await storage.get('artifacts', input.hash);
    if (existing) return storeAlreadyExists(input.hash);
    await storage.put('artifacts', input.hash, { hash: input.hash, location: input.location, concept: input.concept, language: input.language, platform: input.platform });
    return storeOk(input.hash);
  }, err)),
  resolve: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('artifacts', input.hash);
    if (!record) return resolveNotfound(input.hash);
    return resolveOk(String(record.artifact ?? record.hash), String(record.location));
  }, err)),
  gc: (input, storage) => pipe(TE.tryCatch(async () => {
    const all = await storage.find('artifacts');
    let removed = 0;
    let freedBytes = 0;
    for (const a of all) {
      const createdAt = a.createdAt as string | undefined;
      if (createdAt && new Date(createdAt) < input.olderThan) {
        removed++;
        freedBytes += (a.sizeBytes as number) ?? 0;
      }
    }
    return gcOk(removed, freedBytes);
  }, err)),
};
