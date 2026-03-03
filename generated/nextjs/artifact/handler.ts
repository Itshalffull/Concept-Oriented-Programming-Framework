import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { ArtifactStorage, ArtifactBuildInput, ArtifactBuildOutput, ArtifactResolveInput, ArtifactResolveOutput } from './types.js';
import { buildOk, resolveOk, resolveNotfound } from './types.js';

export interface ArtifactError { readonly code: string; readonly message: string; }
export interface ArtifactHandler {
  readonly build: (input: ArtifactBuildInput, storage: ArtifactStorage) => TE.TaskEither<ArtifactError, ArtifactBuildOutput>;
  readonly resolve: (input: ArtifactResolveInput, storage: ArtifactStorage) => TE.TaskEither<ArtifactError, ArtifactResolveOutput>;
}

let _artifactCounter = 0;
let _hashCounter = 0;
const err = (error: unknown): ArtifactError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });

export const artifactHandler: ArtifactHandler = {
  build: (input, storage) => pipe(TE.tryCatch(async () => {
    _artifactCounter++;
    _hashCounter++;
    const artifact = `art-${_artifactCounter}`;
    const hash = `hash-${_hashCounter}`;
    const location = `.clef-artifacts/${input.concept}`;
    await storage.put('artifacts', hash, { artifact, hash, concept: input.concept, spec: input.spec, location, sizeBytes: 1024 });
    return buildOk(artifact, hash, 1024);
  }, err)),
  resolve: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('artifacts', input.hash);
    if (!record) return resolveNotfound(input.hash);
    return resolveOk(String(record.artifact), String(record.location));
  }, err)),
};
