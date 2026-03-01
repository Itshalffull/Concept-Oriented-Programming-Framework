// ContentHash — handler.ts
// Content-addressable storage using cryptographic digests for deduplication,
// integrity verification, and immutable references.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import { createHash } from 'crypto';

import type {
  ContentHashStorage,
  ContentHashStoreInput,
  ContentHashStoreOutput,
  ContentHashRetrieveInput,
  ContentHashRetrieveOutput,
  ContentHashVerifyInput,
  ContentHashVerifyOutput,
  ContentHashDeleteInput,
  ContentHashDeleteOutput,
} from './types.js';

import {
  storeOk,
  storeAlreadyExists,
  retrieveOk,
  retrieveNotFound,
  verifyValid,
  verifyCorrupt,
  verifyNotFound,
  deleteOk,
  deleteNotFound,
  deleteReferenced,
} from './types.js';

export interface ContentHashError {
  readonly code: string;
  readonly message: string;
}

export interface ContentHashHandler {
  readonly store: (
    input: ContentHashStoreInput,
    storage: ContentHashStorage,
  ) => TE.TaskEither<ContentHashError, ContentHashStoreOutput>;
  readonly retrieve: (
    input: ContentHashRetrieveInput,
    storage: ContentHashStorage,
  ) => TE.TaskEither<ContentHashError, ContentHashRetrieveOutput>;
  readonly verify: (
    input: ContentHashVerifyInput,
    storage: ContentHashStorage,
  ) => TE.TaskEither<ContentHashError, ContentHashVerifyOutput>;
  readonly delete: (
    input: ContentHashDeleteInput,
    storage: ContentHashStorage,
  ) => TE.TaskEither<ContentHashError, ContentHashDeleteOutput>;
}

// --- Helpers ---

const storageError = (error: unknown): ContentHashError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const nowISO = (): string => new Date().toISOString();

// Compute SHA-256 hex digest of a Buffer
const sha256Hex = (content: Buffer): string =>
  createHash('sha256').update(content).digest('hex');

// --- Implementation ---

export const contentHashHandler: ContentHashHandler = {
  // Computes SHA-256 digest and stores content. Returns alreadyExists
  // (idempotent, not an error) if identical content is already stored.
  store: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const hash = sha256Hex(input.content);

          // Check for existing content with same hash (deduplication)
          const existing = await storage.get('content_object', hash);
          if (existing !== null) {
            return storeAlreadyExists(hash);
          }

          // Store the content keyed by its hash
          const record: Record<string, unknown> = {
            hash,
            content: input.content.toString('base64'),
            size: input.content.length,
            algorithm: 'sha256',
            created: nowISO(),
            refCount: 0,
          };
          await storage.put('content_object', hash, record);

          return storeOk(hash);
        },
        storageError,
      ),
    ),

  // Retrieves content for the given digest.
  // Returns notFound if no object with that digest exists.
  retrieve: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('content_object', input.hash),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<ContentHashError, ContentHashRetrieveOutput>(
              retrieveNotFound(`No object with hash ${input.hash}`),
            ),
            (found) => {
              const contentBase64 = typeof found.content === 'string'
                ? found.content
                : '';
              const contentBuffer = Buffer.from(contentBase64, 'base64');
              return TE.right<ContentHashError, ContentHashRetrieveOutput>(
                retrieveOk(contentBuffer),
              );
            },
          ),
        ),
      ),
    ),

  // Verifies content integrity by recomputing the hash and comparing
  // against the stored digest. Returns corrupt on mismatch.
  verify: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('content_object', input.hash),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<ContentHashError, ContentHashVerifyOutput>(
              verifyNotFound(`Hash ${input.hash} not in store`),
            ),
            (found) => {
              // Recompute hash from the provided content
              const actualHash = sha256Hex(input.content);

              if (actualHash === input.hash) {
                return TE.right<ContentHashError, ContentHashVerifyOutput>(
                  verifyValid(),
                );
              }

              return TE.right<ContentHashError, ContentHashVerifyOutput>(
                verifyCorrupt(input.hash, actualHash),
              );
            },
          ),
        ),
      ),
    ),

  // Removes object from store. Returns referenced if the object has
  // active references and cannot be garbage collected.
  delete: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('content_object', input.hash),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right<ContentHashError, ContentHashDeleteOutput>(
              deleteNotFound(`Hash ${input.hash} not in store`),
            ),
            (found) => {
              // Check reference count to prevent deletion of referenced objects
              const refCount = typeof found.refCount === 'number'
                ? found.refCount
                : 0;

              if (refCount > 0) {
                return TE.right<ContentHashError, ContentHashDeleteOutput>(
                  deleteReferenced(
                    `Object ${input.hash} is referenced ${refCount} time(s) and cannot be deleted`,
                  ),
                );
              }

              return TE.tryCatch(
                async () => {
                  await storage.delete('content_object', input.hash);
                  return deleteOk();
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),
};
