// SyncedContent — handler.ts
// Single-source-of-truth transclusion: editing the original
// automatically updates all references. Version tracking on content changes.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SyncedContentStorage,
  SyncedContentCreateReferenceInput,
  SyncedContentCreateReferenceOutput,
  SyncedContentEditOriginalInput,
  SyncedContentEditOriginalOutput,
  SyncedContentDeleteReferenceInput,
  SyncedContentDeleteReferenceOutput,
  SyncedContentConvertToIndependentInput,
  SyncedContentConvertToIndependentOutput,
} from './types.js';

import {
  createReferenceOk,
  createReferenceNotfound,
  editOriginalOk,
  editOriginalNotfound,
  deleteReferenceOk,
  deleteReferenceNotfound,
  convertToIndependentOk,
  convertToIndependentNotfound,
} from './types.js';

export interface SyncedContentError {
  readonly code: string;
  readonly message: string;
}

export interface SyncedContentHandler {
  readonly createReference: (
    input: SyncedContentCreateReferenceInput,
    storage: SyncedContentStorage,
  ) => TE.TaskEither<SyncedContentError, SyncedContentCreateReferenceOutput>;
  readonly editOriginal: (
    input: SyncedContentEditOriginalInput,
    storage: SyncedContentStorage,
  ) => TE.TaskEither<SyncedContentError, SyncedContentEditOriginalOutput>;
  readonly deleteReference: (
    input: SyncedContentDeleteReferenceInput,
    storage: SyncedContentStorage,
  ) => TE.TaskEither<SyncedContentError, SyncedContentDeleteReferenceOutput>;
  readonly convertToIndependent: (
    input: SyncedContentConvertToIndependentInput,
    storage: SyncedContentStorage,
  ) => TE.TaskEither<SyncedContentError, SyncedContentConvertToIndependentOutput>;
}

// --- Helpers ---

const storageError = (error: unknown): SyncedContentError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const nowISO = (): string => new Date().toISOString();

// --- Implementation ---

export const syncedContentHandler: SyncedContentHandler = {
  // Creates a live reference that mirrors the original's content.
  // Verifies the original exists before creating the reference link.
  createReference: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('original', input.original),
        storageError,
      ),
      TE.chain((originalRecord) =>
        pipe(
          O.fromNullable(originalRecord),
          O.fold(
            () => TE.right<SyncedContentError, SyncedContentCreateReferenceOutput>(
              createReferenceNotfound(`Original content ${input.original} does not exist`),
            ),
            (original) =>
              TE.tryCatch(
                async () => {
                  // Store the reference pointing to the original
                  const refRecord: Record<string, unknown> = {
                    id: input.ref,
                    originalId: input.original,
                    independent: false,
                    content: original.content ?? '',
                    version: original.version ?? 1,
                    createdAt: nowISO(),
                    updatedAt: nowISO(),
                  };
                  await storage.put('reference', input.ref, refRecord);

                  // Track reference in original's reference set
                  const existingRefs = original.references;
                  const refsArray: readonly string[] = Array.isArray(existingRefs)
                    ? existingRefs as string[]
                    : [];
                  const updatedOriginal = {
                    ...original,
                    references: [...refsArray, input.ref],
                    updatedAt: nowISO(),
                  };
                  await storage.put('original', input.original, updatedOriginal);

                  return createReferenceOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Updates the original content, incrementing the version counter and
  // propagating the new content to all live references.
  editOriginal: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('original', input.original),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<SyncedContentError, SyncedContentEditOriginalOutput>(
              editOriginalNotfound(`Original content ${input.original} does not exist`),
            ),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const currentVersion = typeof existing.version === 'number'
                    ? existing.version
                    : 1;
                  const nextVersion = currentVersion + 1;

                  // Update the original with new content and version
                  const updated = {
                    ...existing,
                    content: input.content,
                    version: nextVersion,
                    updatedAt: nowISO(),
                  };
                  await storage.put('original', input.original, updated);

                  // Propagate content change to all live (non-independent) references
                  const refsArray: readonly string[] = Array.isArray(existing.references)
                    ? existing.references as string[]
                    : [];
                  for (const refId of refsArray) {
                    const refRecord = await storage.get('reference', refId);
                    if (refRecord !== null && refRecord.independent !== true) {
                      const updatedRef = {
                        ...refRecord,
                        content: input.content,
                        version: nextVersion,
                        updatedAt: nowISO(),
                      };
                      await storage.put('reference', refId, updatedRef);
                    }
                  }

                  return editOriginalOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Removes the reference without affecting the original. Cleans up
  // the original's reference tracking set.
  deleteReference: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('reference', input.ref),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<SyncedContentError, SyncedContentDeleteReferenceOutput>(
              deleteReferenceNotfound(`Reference ${input.ref} does not exist`),
            ),
            (refRecord) =>
              TE.tryCatch(
                async () => {
                  const originalId = typeof refRecord.originalId === 'string'
                    ? refRecord.originalId
                    : '';

                  // Remove the reference record
                  await storage.delete('reference', input.ref);

                  // Remove from original's reference tracking set
                  if (originalId !== '') {
                    const originalRecord = await storage.get('original', originalId);
                    if (originalRecord !== null) {
                      const refsArray: readonly string[] = Array.isArray(originalRecord.references)
                        ? originalRecord.references as string[]
                        : [];
                      const filteredRefs = refsArray.filter((r) => r !== input.ref);
                      const updatedOriginal = {
                        ...originalRecord,
                        references: filteredRefs,
                        updatedAt: nowISO(),
                      };
                      await storage.put('original', originalId, updatedOriginal);
                    }
                  }

                  return deleteReferenceOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Detaches the reference from the original, turning it into standalone content.
  // The reference keeps its current content but no longer receives updates.
  convertToIndependent: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('reference', input.ref),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<SyncedContentError, SyncedContentConvertToIndependentOutput>(
              convertToIndependentNotfound(`Reference ${input.ref} does not exist`),
            ),
            (refRecord) =>
              TE.tryCatch(
                async () => {
                  // Mark reference as independent so it no longer receives updates
                  const updated = {
                    ...refRecord,
                    independent: true,
                    updatedAt: nowISO(),
                  };
                  await storage.put('reference', input.ref, updated);

                  // Remove from original's active reference tracking
                  const originalId = typeof refRecord.originalId === 'string'
                    ? refRecord.originalId
                    : '';
                  if (originalId !== '') {
                    const originalRecord = await storage.get('original', originalId);
                    if (originalRecord !== null) {
                      const refsArray: readonly string[] = Array.isArray(originalRecord.references)
                        ? originalRecord.references as string[]
                        : [];
                      const filteredRefs = refsArray.filter((r) => r !== input.ref);
                      const updatedOriginal = {
                        ...originalRecord,
                        references: filteredRefs,
                        updatedAt: nowISO(),
                      };
                      await storage.put('original', originalId, updatedOriginal);
                    }
                  }

                  return convertToIndependentOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),
};
