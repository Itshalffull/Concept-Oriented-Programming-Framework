// ContentDigest — Content hashing and fingerprinting
// Computes deterministic digests for content units using configurable
// algorithms, maintains a reverse-lookup index from hash to unit,
// and compares digests to determine content equivalence.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ContentDigestStorage,
  ContentDigestComputeInput,
  ContentDigestComputeOutput,
  ContentDigestLookupInput,
  ContentDigestLookupOutput,
  ContentDigestEquivalentInput,
  ContentDigestEquivalentOutput,
} from './types.js';

import {
  computeOk,
  computeUnsupportedAlgorithm,
  lookupOk,
  lookupNotfound,
  equivalentYes,
  equivalentNo,
} from './types.js';

export interface ContentDigestError {
  readonly code: string;
  readonly message: string;
}

export interface ContentDigestHandler {
  readonly compute: (
    input: ContentDigestComputeInput,
    storage: ContentDigestStorage,
  ) => TE.TaskEither<ContentDigestError, ContentDigestComputeOutput>;
  readonly lookup: (
    input: ContentDigestLookupInput,
    storage: ContentDigestStorage,
  ) => TE.TaskEither<ContentDigestError, ContentDigestLookupOutput>;
  readonly equivalent: (
    input: ContentDigestEquivalentInput,
    storage: ContentDigestStorage,
  ) => TE.TaskEither<ContentDigestError, ContentDigestEquivalentOutput>;
}

const storageError = (error: unknown): ContentDigestError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// Supported hashing algorithms
const SUPPORTED_ALGORITHMS: readonly string[] = ['sha256', 'sha1', 'md5', 'xxhash', 'murmur3'];

// Simple deterministic hash function for digest computation.
// In production this would delegate to a proper crypto library based
// on the algorithm parameter. Here we use a portable implementation.
const computeHash = (content: string, algorithm: string): string => {
  let hash = 0;

  // Use different seed multipliers per algorithm to produce distinct digests
  const seed = algorithm === 'sha256' ? 31
    : algorithm === 'sha1' ? 37
    : algorithm === 'md5' ? 41
    : algorithm === 'xxhash' ? 43
    : 47; // murmur3

  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    hash = ((hash * seed) + ch) | 0;
  }

  // Produce a hex-like string with algorithm prefix
  const absHash = Math.abs(hash);
  const hexPart = absHash.toString(16).padStart(8, '0');

  // Extend to look like a real digest by repeating with different offsets
  const part2 = ((absHash >>> 4) ^ (absHash << 3)).toString(16).padStart(8, '0');
  const part3 = ((absHash >>> 8) ^ (absHash << 5)).toString(16).padStart(8, '0');

  return `${algorithm}:${hexPart}${part2}${part3}`;
};

// --- Implementation ---

export const contentDigestHandler: ContentDigestHandler = {
  // Compute a digest for a content unit using the specified algorithm.
  // Stores the digest and maintains a reverse index for lookups.
  compute: (input, storage) => {
    if (!SUPPORTED_ALGORITHMS.includes(input.algorithm)) {
      return TE.right(computeUnsupportedAlgorithm(input.algorithm));
    }

    return pipe(
      TE.tryCatch(
        async () => {
          const digest = computeHash(input.unit, input.algorithm);
          const now = new Date().toISOString();

          // Store the unit -> digest mapping
          await storage.put('content_digests', `${input.algorithm}::${input.unit}`, {
            unit: input.unit,
            algorithm: input.algorithm,
            digest,
            computedAt: now,
          });

          // Store the reverse index: digest -> unit
          // Multiple units can share the same digest (collision tracking)
          const existingLookup = await storage.get('digest_index', digest);
          const existingUnits: string[] = existingLookup
            ? (Array.isArray((existingLookup as Record<string, unknown>).units)
              ? (existingLookup as Record<string, unknown>).units as string[]
              : [String((existingLookup as Record<string, unknown>).units ?? '')])
            : [];

          if (!existingUnits.includes(input.unit)) {
            existingUnits.push(input.unit);
          }

          await storage.put('digest_index', digest, {
            digest,
            units: existingUnits,
            algorithm: input.algorithm,
            updatedAt: now,
          });

          return computeOk(digest);
        },
        storageError,
      ),
    );
  },

  // Look up which content units map to a given hash digest.
  // Returns the list of units associated with the digest, or notfound.
  lookup: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('digest_index', input.hash),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(lookupNotfound()),
            (found) => {
              const data = found as Record<string, unknown>;
              const units = Array.isArray(data.units)
                ? data.units.map(String)
                : [String(data.units ?? '')];
              return TE.right(lookupOk(JSON.stringify(units)));
            },
          ),
        ),
      ),
    ),

  // Determine whether two content units are equivalent by comparing
  // their digests. Computes digests for both units using sha256 and
  // compares them. If different, provides a summary of the divergence.
  equivalent: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const algorithm = 'sha256';

          // Try to retrieve cached digests first
          const [recordA, recordB] = await Promise.all([
            storage.get('content_digests', `${algorithm}::${input.a}`),
            storage.get('content_digests', `${algorithm}::${input.b}`),
          ]);

          // Compute digests if not cached
          const digestA = recordA
            ? String((recordA as Record<string, unknown>).digest ?? '')
            : computeHash(input.a, algorithm);
          const digestB = recordB
            ? String((recordB as Record<string, unknown>).digest ?? '')
            : computeHash(input.b, algorithm);

          // Cache any freshly computed digests
          const now = new Date().toISOString();
          if (!recordA) {
            await storage.put('content_digests', `${algorithm}::${input.a}`, {
              unit: input.a,
              algorithm,
              digest: digestA,
              computedAt: now,
            });
          }
          if (!recordB) {
            await storage.put('content_digests', `${algorithm}::${input.b}`, {
              unit: input.b,
              algorithm,
              digest: digestB,
              computedAt: now,
            });
          }

          if (digestA === digestB) {
            return equivalentYes();
          }

          // Compute a diff summary showing how the content differs
          const lenA = input.a.length;
          const lenB = input.b.length;
          const sizeDiff = Math.abs(lenA - lenB);
          const summary = [
            `digest_a=${digestA}`,
            `digest_b=${digestB}`,
            `size_a=${lenA}`,
            `size_b=${lenB}`,
            sizeDiff > 0 ? `size_diff=${sizeDiff}` : 'same_size',
          ].join(', ');

          return equivalentNo(summary);
        },
        storageError,
      ),
    ),
};
