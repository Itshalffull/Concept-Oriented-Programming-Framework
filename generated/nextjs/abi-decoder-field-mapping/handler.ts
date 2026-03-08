// AbiDecoderFieldMapping — Translates ABI-encoded data to/from structured entity fields.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  AbiDecoderFieldMappingStorage,
  AbiDecoderFieldMappingApplyInput,
  AbiDecoderFieldMappingApplyOutput,
  AbiDecoderFieldMappingReverseInput,
  AbiDecoderFieldMappingReverseOutput,
  AbiDecoderFieldMappingRegisterInput,
  AbiDecoderFieldMappingRegisterOutput,
} from './types.js';

import {
  applyOk,
  applyNotfound,
  applyError,
  reverseOk,
  reverseNotfound,
  reverseError,
  registerOk,
  registerInvalid,
} from './types.js';

export interface AbiDecoderFieldMappingError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): AbiDecoderFieldMappingError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

let idCounter = 0;
function nextId(): string {
  return `abi-map-${++idCounter}`;
}

export interface AbiDecoderFieldMappingHandler {
  readonly apply: (
    input: AbiDecoderFieldMappingApplyInput,
    storage: AbiDecoderFieldMappingStorage,
  ) => TE.TaskEither<AbiDecoderFieldMappingError, AbiDecoderFieldMappingApplyOutput>;
  readonly reverse: (
    input: AbiDecoderFieldMappingReverseInput,
    storage: AbiDecoderFieldMappingStorage,
  ) => TE.TaskEither<AbiDecoderFieldMappingError, AbiDecoderFieldMappingReverseOutput>;
  readonly register: (
    input: AbiDecoderFieldMappingRegisterInput,
    storage: AbiDecoderFieldMappingStorage,
  ) => TE.TaskEither<AbiDecoderFieldMappingError, AbiDecoderFieldMappingRegisterOutput>;
}

// --- Implementation ---

export const abiDecoderFieldMappingHandler: AbiDecoderFieldMappingHandler = {
  apply: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('abi_decoder_field_mapping', input.mapper),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(applyNotfound(input.mapper)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  let fieldRules: Record<string, unknown>;
                  try {
                    fieldRules = JSON.parse(String(existing['field_rules'] || '{}'));
                  } catch {
                    return applyError('Invalid field_rules in mapping');
                  }

                  const mapped = JSON.stringify({
                    source_contract: input.contract,
                    decoded_fields: fieldRules,
                    raw_data: input.data,
                  });

                  return applyOk(mapped);
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  reverse: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('abi_decoder_field_mapping', input.mapper),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(reverseNotfound(input.mapper)),
            () =>
              TE.tryCatch(
                async () => {
                  let entityData: Record<string, unknown>;
                  try {
                    entityData = JSON.parse(input.data);
                  } catch {
                    return reverseError('Invalid entity data JSON');
                  }

                  const encoded = `0x${Buffer.from(JSON.stringify(entityData)).toString('hex')}`;
                  return reverseOk(encoded);
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Validate ABI JSON
          try {
            JSON.parse(input.contract_abi);
          } catch {
            return registerInvalid('contract_abi is not valid JSON');
          }

          // Validate field rules JSON
          try {
            JSON.parse(input.field_rules);
          } catch {
            return registerInvalid('field_rules is not valid JSON');
          }

          const id = nextId();
          const now = new Date().toISOString();

          await storage.put('abi_decoder_field_mapping', id, {
            id,
            contract_abi: input.contract_abi,
            entity_schema: input.entity_schema,
            field_rules: input.field_rules,
            status: 'active',
            createdAt: now,
            updatedAt: now,
          });

          return registerOk(id);
        },
        toStorageError,
      ),
    ),
};

/** Reset internal state. Useful for testing. */
export function resetAbiDecoderFieldMappingHandler(): void {
  idCounter = 0;
}
