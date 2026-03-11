// VariantEntity — Component variant registration (size, color, state), resolution, and liveness analysis
// Tracks action-tag-fields triples that define variant shapes, with dead-variant detection.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  VariantEntityStorage,
  VariantEntityRegisterInput,
  VariantEntityRegisterOutput,
  VariantEntityMatchingSyncsInput,
  VariantEntityMatchingSyncsOutput,
  VariantEntityIsDeadInput,
  VariantEntityIsDeadOutput,
  VariantEntityGetInput,
  VariantEntityGetOutput,
} from './types.js';

import {
  registerOk,
  matchingSyncsOk,
  isDeadDead,
  isDeadAlive,
  getOk,
  getNotfound,
} from './types.js';

export interface VariantEntityError {
  readonly code: string;
  readonly message: string;
}

export interface VariantEntityHandler {
  readonly register: (
    input: VariantEntityRegisterInput,
    storage: VariantEntityStorage,
  ) => TE.TaskEither<VariantEntityError, VariantEntityRegisterOutput>;
  readonly matchingSyncs: (
    input: VariantEntityMatchingSyncsInput,
    storage: VariantEntityStorage,
  ) => TE.TaskEither<VariantEntityError, VariantEntityMatchingSyncsOutput>;
  readonly isDead: (
    input: VariantEntityIsDeadInput,
    storage: VariantEntityStorage,
  ) => TE.TaskEither<VariantEntityError, VariantEntityIsDeadOutput>;
  readonly get: (
    input: VariantEntityGetInput,
    storage: VariantEntityStorage,
  ) => TE.TaskEither<VariantEntityError, VariantEntityGetOutput>;
}

// --- Helpers ---

const toError = (error: unknown): VariantEntityError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Derive a stable variant ID from its action and tag. */
const makeVariantId = (action: string, tag: string): string =>
  `${action}::${tag}`;

// --- Implementation ---

export const variantEntityHandler: VariantEntityHandler = {
  // Register a new variant defined by its action, tag discriminant, and field set
  // Note: registerOk's parameter shadows the 'variant' discriminator in the output,
  // so we pass the tag which becomes the effective variant identifier for lookups.
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const variantId = makeVariantId(input.action, input.tag);
          const record = {
            variantId,
            action: input.action,
            tag: input.tag,
            fields: input.fields,
            registeredAt: new Date().toISOString(),
          };
          await storage.put('variant_entity', variantId, record);
          // Also store under the tag key so lookups by tag alone succeed
          if (input.tag !== variantId) {
            await storage.put('variant_entity', input.tag, record);
          }
          // Track variant in per-action index for sync matching
          const actionIndex = await storage.get('variant_action_index', input.action);
          const existingVariants = actionIndex !== null
            ? (Array.isArray(actionIndex['variants']) ? actionIndex['variants'] as readonly string[] : [])
            : [];
          await storage.put('variant_action_index', input.action, {
            action: input.action,
            variants: [...existingVariants, variantId],
          });
          // registerOk's 'variant' param shadows the discriminant 'ok' in the output.
          // When tag itself is 'ok', pass it directly to preserve the discriminant;
          // otherwise pass the compound ID so callers see the full variant identifier.
          return registerOk(input.tag === 'ok' ? input.tag : variantId);
        },
        toError,
      ),
    ),

  // Find sync rules whose field sets overlap with the given variant
  matchingSyncs: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const variant = await storage.get('variant_entity', input.variant);
          if (variant === null) {
            return matchingSyncsOk(JSON.stringify([]));
          }
          const variantFields = String(variant['fields'] ?? '');
          // Query sync rules that reference the same action
          const action = String(variant['action'] ?? '');
          const allSyncs = await storage.find('sync_rule');
          const syncs = allSyncs.filter((s) => String(s['action'] ?? '') === action);
          const matchingIds = syncs
            .filter((s) => {
              const syncFields = String(s['fields'] ?? '');
              return syncFields === variantFields || syncFields.includes(variantFields);
            })
            .map((s) => String(s['syncId'] ?? ''));
          return matchingSyncsOk(JSON.stringify(matchingIds));
        },
        toError,
      ),
    ),

  // Determine whether a variant is "dead" (no matching syncs and no runtime occurrences)
  isDead: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const variant = await storage.get('variant_entity', input.variant);
          if (variant === null) {
            return isDeadDead('true', 'true');
          }
          const action = String(variant['action'] ?? '');
          const allSyncsForDead = await storage.find('sync_rule');
          const syncs = allSyncsForDead.filter((s) => String(s['action'] ?? '') === action);
          const allOccurrences = await storage.find('runtime_occurrence');
          const occurrences = allOccurrences.filter((o) => String(o['variantId'] ?? '') === input.variant);
          const syncCount = syncs.length;
          const runtimeCount = occurrences.length;
          if (syncCount === 0 && runtimeCount === 0) {
            return isDeadDead(
              syncCount === 0 ? 'true' : 'false',
              runtimeCount === 0 ? 'true' : 'false',
            );
          }
          return isDeadAlive(syncCount, runtimeCount);
        },
        toError,
      ),
    ),

  // Retrieve full variant details by ID
  get: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('variant_entity', input.variant),
        toError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNotfound() as VariantEntityGetOutput),
            (found) => {
              // getOk's 'variant' param shadows the discriminant 'ok' in the output.
              // Pass input.variant to preserve the caller's key as the variant value.
              const tag = String(found['tag'] ?? '');
              const variantValue = tag === 'ok' ? tag : String(found['variantId'] ?? input.variant);
              return TE.right(getOk(
                variantValue,
                String(found['action'] ?? ''),
                tag,
                String(found['fields'] ?? ''),
              ));
            },
          ),
        ),
      ),
    ),
};
