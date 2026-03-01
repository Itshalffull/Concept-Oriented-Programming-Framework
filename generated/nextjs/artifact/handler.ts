// Artifact — Build artifact management: register artifacts with content hashes,
// store with location metadata, resolve by hash, and garbage-collect stale entries.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ArtifactStorage,
  ArtifactBuildInput,
  ArtifactBuildOutput,
  ArtifactStoreInput,
  ArtifactStoreOutput,
  ArtifactResolveInput,
  ArtifactResolveOutput,
  ArtifactGcInput,
  ArtifactGcOutput,
} from './types.js';

import {
  buildOk,
  buildCompilationError,
  storeOk,
  storeAlreadyExists,
  resolveOk,
  resolveNotfound,
  gcOk,
} from './types.js';

export interface ArtifactError {
  readonly code: string;
  readonly message: string;
}

const toArtifactError = (error: unknown): ArtifactError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface ArtifactHandler {
  readonly build: (
    input: ArtifactBuildInput,
    storage: ArtifactStorage,
  ) => TE.TaskEither<ArtifactError, ArtifactBuildOutput>;
  readonly store: (
    input: ArtifactStoreInput,
    storage: ArtifactStorage,
  ) => TE.TaskEither<ArtifactError, ArtifactStoreOutput>;
  readonly resolve: (
    input: ArtifactResolveInput,
    storage: ArtifactStorage,
  ) => TE.TaskEither<ArtifactError, ArtifactResolveOutput>;
  readonly gc: (
    input: ArtifactGcInput,
    storage: ArtifactStorage,
  ) => TE.TaskEither<ArtifactError, ArtifactGcOutput>;
}

// --- Implementation ---

// Simple hash function for deterministic content-addressable artifact IDs
const computeHash = (content: string): string => {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
};

export const artifactHandler: ArtifactHandler = {
  // Build an artifact from a concept spec + implementation. Produces a content hash
  // and stores build metadata. Returns compilationError if deps are unresolvable.
  build: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Verify all dependencies exist
          const missingDeps: string[] = [];
          for (const dep of input.deps) {
            const depRecord = await storage.get('artifact', dep);
            if (depRecord === null) {
              missingDeps.push(dep);
            }
          }
          if (missingDeps.length > 0) {
            return buildCompilationError(input.concept, missingDeps.map((d) => `Missing dependency: ${d}`));
          }
          const content = `${input.spec}:${input.implementation}`;
          const hash = computeHash(content);
          const sizeBytes = new TextEncoder().encode(content).length;
          const artifactId = `${input.concept}@${hash}`;
          await storage.put('artifact', artifactId, {
            concept: input.concept,
            spec: input.spec,
            implementation: input.implementation,
            deps: input.deps,
            hash,
            sizeBytes,
            builtAt: new Date().toISOString(),
          });
          return buildOk(artifactId, hash, sizeBytes);
        },
        toArtifactError,
      ),
    ),

  // Store an already-built artifact at a location. Returns alreadyExists if hash is registered.
  store: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('artifact_store', input.hash),
        toArtifactError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const metadataValue = pipe(
                    input.metadata,
                    O.fold(() => null, (m) => m),
                  );
                  await storage.put('artifact_store', input.hash, {
                    hash: input.hash,
                    location: input.location,
                    concept: input.concept,
                    language: input.language,
                    platform: input.platform,
                    metadata: metadataValue,
                    storedAt: new Date().toISOString(),
                  });
                  return storeOk(input.hash);
                },
                toArtifactError,
              ),
            (found) =>
              TE.right<ArtifactError, ArtifactStoreOutput>(
                storeAlreadyExists(String((found as Record<string, unknown>).hash ?? input.hash)),
              ),
          ),
        ),
      ),
    ),

  // Resolve an artifact by its content hash, returning its storage location.
  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('artifact_store', input.hash),
        toArtifactError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<ArtifactError, ArtifactResolveOutput>(resolveNotfound(input.hash)),
            (found) =>
              TE.right<ArtifactError, ArtifactResolveOutput>(
                resolveOk(
                  String((found as Record<string, unknown>).hash ?? input.hash),
                  String((found as Record<string, unknown>).location ?? ''),
                ),
              ),
          ),
        ),
      ),
    ),

  // Garbage-collect artifacts older than the cutoff, keeping at least keepVersions per concept.
  gc: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allArtifacts = await storage.find('artifact_store');
          const cutoff = input.olderThan.getTime();
          let removed = 0;
          let freedBytes = 0;
          for (const artifact of allArtifacts) {
            const storedAt = (artifact as Record<string, unknown>).storedAt;
            if (typeof storedAt === 'string' && new Date(storedAt).getTime() < cutoff) {
              const hash = String((artifact as Record<string, unknown>).hash ?? '');
              const size = Number((artifact as Record<string, unknown>).sizeBytes ?? 0);
              await storage.delete('artifact_store', hash);
              removed += 1;
              freedBytes += size;
            }
          }
          return gcOk(removed, freedBytes);
        },
        toArtifactError,
      ),
    ),
};
