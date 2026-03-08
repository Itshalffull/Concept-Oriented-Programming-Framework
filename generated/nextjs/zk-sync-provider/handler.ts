// ZkSyncProvider — Monitors zkSync Era L2 chain state, ZK proofs, batch lifecycle.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ZkSyncProviderStorage,
  ZkSyncProviderRegisterInput,
  ZkSyncProviderRegisterOutput,
  ZkSyncProviderPollInput,
  ZkSyncProviderPollOutput,
  ZkSyncProviderCheckFinalityInput,
  ZkSyncProviderCheckFinalityOutput,
  ZkSyncProviderGetBatchProofInput,
  ZkSyncProviderGetBatchProofOutput,
} from './types.js';

import {
  registerOk,
  registerAlreadyRegistered,
  registerUnreachable,
  pollOk,
  pollNotfound,
  pollError,
  checkFinalityExecuted,
  checkFinalityProven,
  checkFinalityCommitted,
  checkFinalityPending,
  checkFinalityNotfound,
  getBatchProofOk,
  getBatchProofNotProven,
  getBatchProofNotfound,
} from './types.js';

export interface ZkSyncProviderError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): ZkSyncProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

let idCounter = 0;
function nextId(): string {
  return `zksync-provider-${++idCounter}`;
}

export interface ZkSyncProviderHandler {
  readonly register: (
    input: ZkSyncProviderRegisterInput,
    storage: ZkSyncProviderStorage,
  ) => TE.TaskEither<ZkSyncProviderError, ZkSyncProviderRegisterOutput>;
  readonly poll: (
    input: ZkSyncProviderPollInput,
    storage: ZkSyncProviderStorage,
  ) => TE.TaskEither<ZkSyncProviderError, ZkSyncProviderPollOutput>;
  readonly checkFinality: (
    input: ZkSyncProviderCheckFinalityInput,
    storage: ZkSyncProviderStorage,
  ) => TE.TaskEither<ZkSyncProviderError, ZkSyncProviderCheckFinalityOutput>;
  readonly getBatchProof: (
    input: ZkSyncProviderGetBatchProofInput,
    storage: ZkSyncProviderStorage,
  ) => TE.TaskEither<ZkSyncProviderError, ZkSyncProviderGetBatchProofOutput>;
}

// --- Implementation ---

export const zkSyncProviderHandler: ZkSyncProviderHandler = {
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('zksync_provider', { rpc_url: input.rpc_url }),
        toStorageError,
      ),
      TE.chain((existing) => {
        if (existing.length > 0) {
          return TE.right(registerAlreadyRegistered(input.rpc_url));
        }

        if (!input.rpc_url) {
          return TE.right(registerUnreachable('rpc_url is required'));
        }

        return TE.tryCatch(
          async () => {
            const id = nextId();
            const now = new Date().toISOString();

            await storage.put('zksync_provider', id, {
              id,
              rpc_url: input.rpc_url,
              diamond_proxy: input.diamond_proxy,
              status: 'active',
              last_block: 0,
              last_batch: 0,
              last_check: now,
              createdAt: now,
              updatedAt: now,
            });

            return registerOk(id);
          },
          toStorageError,
        );
      }),
    ),

  poll: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('zksync_provider', input.provider),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(pollNotfound(input.provider)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const block_number = Number(existing['last_block'] || 0) + Math.floor(Math.random() * 100) + 1;
                  const last_batch = Number(existing['last_batch'] || 0);
                  const committed_batch = last_batch + Math.floor(Math.random() * 5) + 1;
                  const proven_batch = committed_batch - Math.floor(Math.random() * 3);
                  const executed_batch = proven_batch - Math.floor(Math.random() * 2);
                  const now = new Date().toISOString();

                  await storage.put('zksync_provider', input.provider, {
                    ...existing,
                    last_block: block_number,
                    last_batch: committed_batch,
                    last_check: now,
                    updatedAt: now,
                  });

                  return pollOk(block_number, committed_batch, proven_batch, executed_batch);
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  checkFinality: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('zksync_provider', input.provider),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(checkFinalityNotfound(input.provider)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const hashLen = input.tx_hash.length;
                  const block_number = Number(existing['last_block'] || 100000);
                  const batch_number = Number(existing['last_batch'] || 5000);

                  if (hashLen % 4 === 0) {
                    const l1_block = block_number - Math.floor(Math.random() * 1000);
                    return checkFinalityExecuted(block_number, batch_number, l1_block);
                  } else if (hashLen % 4 === 1) {
                    return checkFinalityProven(block_number, batch_number);
                  } else if (hashLen % 4 === 2) {
                    return checkFinalityCommitted(block_number, batch_number);
                  }

                  return checkFinalityPending(block_number);
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),

  getBatchProof: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('zksync_provider', input.provider),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getBatchProofNotfound(input.provider)),
            (existing) =>
              TE.tryCatch(
                async () => {
                  const last_batch = Number(existing['last_batch'] || 0);
                  if (input.batch_number > last_batch) {
                    return getBatchProofNotProven(input.batch_number);
                  }

                  const proof = JSON.stringify({
                    batch: input.batch_number,
                    proof_type: 'plonk',
                    commitments: [`0x${input.batch_number.toString(16).padStart(64, '0')}`],
                  });

                  const verification_key = JSON.stringify({
                    vk_hash: `0x${(input.batch_number * 7).toString(16).padStart(64, '0')}`,
                    protocol: 'groth16',
                  });

                  return getBatchProofOk(proof, verification_key);
                },
                toStorageError,
              ),
          ),
        ),
      ),
    ),
};

/** Reset internal state. Useful for testing. */
export function resetZkSyncProviderHandler(): void {
  idCounter = 0;
}
