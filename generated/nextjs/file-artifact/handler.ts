// FileArtifact — File artifact metadata tracking: register generated files,
// record provenance (which spec/generator produced them), and query by role or spec.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  FileArtifactStorage,
  FileArtifactRegisterInput,
  FileArtifactRegisterOutput,
  FileArtifactSetProvenanceInput,
  FileArtifactSetProvenanceOutput,
  FileArtifactFindByRoleInput,
  FileArtifactFindByRoleOutput,
  FileArtifactFindGeneratedFromInput,
  FileArtifactFindGeneratedFromOutput,
  FileArtifactGetInput,
  FileArtifactGetOutput,
} from './types.js';

import {
  registerOk,
  registerAlreadyRegistered,
  setProvenanceOk,
  setProvenanceNotfound,
  findByRoleOk,
  findGeneratedFromOk,
  findGeneratedFromNoGeneratedFiles,
  getOk,
  getNotfound,
} from './types.js';

export interface FileArtifactError {
  readonly code: string;
  readonly message: string;
}

const toFileArtifactError = (error: unknown): FileArtifactError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface FileArtifactHandler {
  readonly register: (
    input: FileArtifactRegisterInput,
    storage: FileArtifactStorage,
  ) => TE.TaskEither<FileArtifactError, FileArtifactRegisterOutput>;
  readonly setProvenance: (
    input: FileArtifactSetProvenanceInput,
    storage: FileArtifactStorage,
  ) => TE.TaskEither<FileArtifactError, FileArtifactSetProvenanceOutput>;
  readonly findByRole: (
    input: FileArtifactFindByRoleInput,
    storage: FileArtifactStorage,
  ) => TE.TaskEither<FileArtifactError, FileArtifactFindByRoleOutput>;
  readonly findGeneratedFrom: (
    input: FileArtifactFindGeneratedFromInput,
    storage: FileArtifactStorage,
  ) => TE.TaskEither<FileArtifactError, FileArtifactFindGeneratedFromOutput>;
  readonly get: (
    input: FileArtifactGetInput,
    storage: FileArtifactStorage,
  ) => TE.TaskEither<FileArtifactError, FileArtifactGetOutput>;
}

// --- Implementation ---

export const fileArtifactHandler: FileArtifactHandler = {
  // Register a file artifact by node path. Returns alreadyRegistered if the node is known.
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('fileartifact', input.node),
        toFileArtifactError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const artifactId = `fa:${input.node}`;
                  await storage.put('fileartifact', input.node, {
                    artifact: artifactId,
                    node: input.node,
                    role: input.role,
                    language: input.language,
                    encoding: 'utf-8',
                    registeredAt: new Date().toISOString(),
                  });
                  return registerOk(artifactId);
                },
                toFileArtifactError,
              ),
            (found) =>
              TE.right<FileArtifactError, FileArtifactRegisterOutput>(
                registerAlreadyRegistered(
                  String((found as Record<string, unknown>).artifact ?? input.node),
                ),
              ),
          ),
        ),
      ),
    ),

  // Attach provenance metadata (spec + generator) to an existing artifact.
  setProvenance: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('fileartifact', input.artifact),
        toFileArtifactError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<FileArtifactError, FileArtifactSetProvenanceOutput>(setProvenanceNotfound()),
            (existing) =>
              TE.tryCatch(
                async () => {
                  await storage.put('fileartifact', input.artifact, {
                    ...existing,
                    spec: input.spec,
                    generator: input.generator,
                  });
                  return setProvenanceOk();
                },
                toFileArtifactError,
              ),
          ),
        ),
      ),
    ),

  // Find all file artifacts matching a given role (e.g., 'handler', 'types', 'route').
  findByRole: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('fileartifact', { role: input.role });
          const artifactIds = records
            .map((r) => String((r as Record<string, unknown>).artifact ?? ''))
            .filter((id) => id.length > 0);
          return findByRoleOk(artifactIds.join(','));
        },
        toFileArtifactError,
      ),
    ),

  // Find all file artifacts generated from a particular spec file.
  findGeneratedFrom: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const records = await storage.find('fileartifact', { spec: input.spec });
          const artifactIds = records
            .map((r) => String((r as Record<string, unknown>).artifact ?? ''))
            .filter((id) => id.length > 0);
          if (artifactIds.length === 0) {
            return findGeneratedFromNoGeneratedFiles();
          }
          return findGeneratedFromOk(artifactIds.join(','));
        },
        toFileArtifactError,
      ),
    ),

  // Get full metadata for a single file artifact by its ID.
  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('fileartifact', input.artifact),
        toFileArtifactError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right<FileArtifactError, FileArtifactGetOutput>(
                getNotfound(`File artifact '${input.artifact}' not found`),
              ),
            (found) => {
              const r = found as Record<string, unknown>;
              return TE.right<FileArtifactError, FileArtifactGetOutput>(
                getOk(
                  String(r.artifact ?? input.artifact),
                  String(r.node ?? ''),
                  String(r.role ?? ''),
                  String(r.language ?? ''),
                  String(r.encoding ?? 'utf-8'),
                ),
              );
            },
          ),
        ),
      ),
    ),
};
