// Content — Content-addressed storage and pinning
// Stores binary content with content-based addressing (CID generation),
// supports pinning to prevent garbage collection, unpinning to release,
// and resolving CIDs back to their original data with content type metadata.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ContentStorage,
  ContentStoreInput,
  ContentStoreOutput,
  ContentPinInput,
  ContentPinOutput,
  ContentUnpinInput,
  ContentUnpinOutput,
  ContentResolveInput,
  ContentResolveOutput,
} from './types.js';

import {
  storeOk,
  storeError,
  pinOk,
  pinError,
  unpinOk,
  unpinError,
  resolveOk,
  resolveNotFound,
  resolveUnavailable,
} from './types.js';

export interface ContentError {
  readonly code: string;
  readonly message: string;
}

export interface ContentHandler {
  readonly store: (
    input: ContentStoreInput,
    storage: ContentStorage,
  ) => TE.TaskEither<ContentError, ContentStoreOutput>;
  readonly pin: (
    input: ContentPinInput,
    storage: ContentStorage,
  ) => TE.TaskEither<ContentError, ContentPinOutput>;
  readonly unpin: (
    input: ContentUnpinInput,
    storage: ContentStorage,
  ) => TE.TaskEither<ContentError, ContentUnpinOutput>;
  readonly resolve: (
    input: ContentResolveInput,
    storage: ContentStorage,
  ) => TE.TaskEither<ContentError, ContentResolveOutput>;
}

const storageErr = (error: unknown): ContentError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Generate a deterministic content identifier from the raw data.
// Uses a simple hash for CID generation (in production this would be
// a cryptographic hash like SHA-256 with a multibase prefix).
const generateCid = (data: Buffer, contentType: string): string => {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data[i]) | 0;
  }
  const prefix = contentType.replace(/[^a-z]/g, '').slice(0, 4);
  return `cid:${prefix}:${Math.abs(hash).toString(36)}`;
};

// --- Implementation ---

export const contentHandler: ContentHandler = {
  // Store binary content and return its content-addressed identifier.
  // The CID is derived from the content bytes, making it deterministic.
  // Deduplicates: if the same content is stored again, returns the existing CID.
  store: (input, storage) => {
    if (!input.data || input.data.length === 0) {
      return TE.right(storeError('Content data must be non-empty'));
    }

    if (!input.contentType || input.contentType.trim().length === 0) {
      return TE.right(storeError('Content type must be specified'));
    }

    return pipe(
      TE.tryCatch(
        async () => {
          const cid = generateCid(input.data, input.contentType);
          const size = input.data.length;

          // Check for deduplication
          const existing = await storage.get('content_objects', cid);
          if (existing) {
            // Content already stored; return existing CID
            return storeOk(cid, size);
          }

          const now = new Date().toISOString();

          // Store the content object
          await storage.put('content_objects', cid, {
            cid,
            name: input.name,
            contentType: input.contentType,
            size,
            data: input.data.toString('base64'),
            pinned: false,
            pinCount: 0,
            storedAt: now,
          });

          // Store name-to-CID mapping for lookups
          await storage.put('content_names', input.name, {
            name: input.name,
            cid,
            contentType: input.contentType,
            storedAt: now,
          });

          return storeOk(cid, size);
        },
        storageErr,
      ),
    );
  },

  // Pin content to prevent garbage collection. Increments the pin count.
  // Only content that exists can be pinned.
  pin: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('content_objects', input.cid),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(pinError(input.cid, `Content '${input.cid}' not found`)),
            (found) => {
              const data = found as Record<string, unknown>;
              const currentPinCount = typeof data.pinCount === 'number' ? data.pinCount : 0;

              return TE.tryCatch(
                async () => {
                  await storage.put('content_objects', input.cid, {
                    ...data,
                    pinned: true,
                    pinCount: currentPinCount + 1,
                    lastPinnedAt: new Date().toISOString(),
                  });

                  return pinOk(input.cid);
                },
                storageErr,
              );
            },
          ),
        ),
      ),
    ),

  // Unpin content to allow garbage collection. Decrements the pin count.
  // Content is fully unpinned when pin count reaches zero.
  unpin: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('content_objects', input.cid),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(unpinError(input.cid, `Content '${input.cid}' not found`)),
            (found) => {
              const data = found as Record<string, unknown>;
              const currentPinCount = typeof data.pinCount === 'number' ? data.pinCount : 0;

              if (currentPinCount <= 0) {
                return TE.right(unpinError(input.cid, `Content '${input.cid}' is not pinned`));
              }

              const newPinCount = currentPinCount - 1;

              return TE.tryCatch(
                async () => {
                  await storage.put('content_objects', input.cid, {
                    ...data,
                    pinned: newPinCount > 0,
                    pinCount: newPinCount,
                    lastUnpinnedAt: new Date().toISOString(),
                  });

                  return unpinOk(input.cid);
                },
                storageErr,
              );
            },
          ),
        ),
      ),
    ),

  // Resolve a CID back to its content data, content type, and size.
  // Returns notFound if the CID does not exist, or unavailable if
  // the data cannot be decoded.
  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('content_objects', input.cid),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(resolveNotFound(input.cid)),
            (found) => {
              const data = found as Record<string, unknown>;
              const base64Data = data.data;
              const contentType = String(data.contentType ?? 'application/octet-stream');
              const size = typeof data.size === 'number' ? data.size : 0;

              if (typeof base64Data !== 'string' || base64Data.length === 0) {
                return TE.right(resolveUnavailable(
                  input.cid,
                  'Content data is missing or corrupted',
                ));
              }

              try {
                const buffer = Buffer.from(base64Data, 'base64');
                return TE.right(resolveOk(buffer, contentType, size));
              } catch {
                return TE.right(resolveUnavailable(
                  input.cid,
                  'Failed to decode content data from storage',
                ));
              }
            },
          ),
        ),
      ),
    ),
};
