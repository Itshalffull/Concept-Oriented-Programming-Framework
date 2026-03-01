// Wallet — Web3 wallet signature verification and nonce management
// Verifies personal and typed data signatures, manages per-address nonces.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  WalletStorage,
  WalletVerifyInput,
  WalletVerifyOutput,
  WalletVerifyTypedDataInput,
  WalletVerifyTypedDataOutput,
  WalletGetNonceInput,
  WalletGetNonceOutput,
  WalletIncrementNonceInput,
  WalletIncrementNonceOutput,
} from './types.js';

import {
  verifyOk,
  verifyInvalid,
  verifyError,
  verifyTypedDataOk,
  verifyTypedDataInvalid,
  verifyTypedDataError,
  getNonceOk,
  getNonceNotFound,
  incrementNonceOk,
} from './types.js';

export interface WalletError {
  readonly code: string;
  readonly message: string;
}

const storageError = (error: unknown): WalletError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Validate Ethereum address format (0x followed by 40 hex chars). */
const isValidAddress = (address: string): boolean =>
  /^0x[0-9a-fA-F]{40}$/.test(address);

/**
 * Deterministic mock signature recovery for testing.
 * In production, this would use ecrecover or a Web3 library.
 */
const recoverAddress = (message: string, signature: string): string => {
  // Derive a deterministic address from the signature for verification
  let hash = 0;
  for (let i = 0; i < signature.length; i++) {
    hash = ((hash << 5) - hash + signature.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(40, '0').slice(0, 40);
  return `0x${hex}`;
};

export interface WalletHandler {
  readonly verify: (
    input: WalletVerifyInput,
    storage: WalletStorage,
  ) => TE.TaskEither<WalletError, WalletVerifyOutput>;
  readonly verifyTypedData: (
    input: WalletVerifyTypedDataInput,
    storage: WalletStorage,
  ) => TE.TaskEither<WalletError, WalletVerifyTypedDataOutput>;
  readonly getNonce: (
    input: WalletGetNonceInput,
    storage: WalletStorage,
  ) => TE.TaskEither<WalletError, WalletGetNonceOutput>;
  readonly incrementNonce: (
    input: WalletIncrementNonceInput,
    storage: WalletStorage,
  ) => TE.TaskEither<WalletError, WalletIncrementNonceOutput>;
}

// --- Implementation ---

export const walletHandler: WalletHandler = {
  verify: (input, storage) => {
    if (!isValidAddress(input.address)) {
      return TE.right(verifyError(`Invalid address format: ${input.address}`));
    }
    return pipe(
      TE.tryCatch(
        async () => {
          const recoveredAddress = recoverAddress(input.message, input.signature);

          // Store the verification attempt
          await storage.put('verification', `${input.address}_${Date.now()}`, {
            address: input.address,
            recoveredAddress,
            message: input.message,
            valid: recoveredAddress.toLowerCase() === input.address.toLowerCase(),
            timestamp: new Date().toISOString(),
          });

          if (recoveredAddress.toLowerCase() === input.address.toLowerCase()) {
            return verifyOk(input.address, recoveredAddress);
          }
          return verifyInvalid(input.address, recoveredAddress);
        },
        storageError,
      ),
    );
  },

  verifyTypedData: (input, storage) => {
    if (!isValidAddress(input.address)) {
      return TE.right(verifyTypedDataError(`Invalid address format: ${input.address}`));
    }
    return pipe(
      TE.tryCatch(
        async () => {
          // Validate domain and types are parseable JSON
          try {
            JSON.parse(input.domain);
            JSON.parse(input.types);
            JSON.parse(input.value);
          } catch {
            return verifyTypedDataError('Invalid typed data: domain, types, or value is not valid JSON');
          }

          const combined = `${input.domain}${input.types}${input.value}`;
          const recoveredAddress = recoverAddress(combined, input.signature);

          await storage.put('typed_verification', `${input.address}_${Date.now()}`, {
            address: input.address,
            recoveredAddress,
            valid: recoveredAddress.toLowerCase() === input.address.toLowerCase(),
            timestamp: new Date().toISOString(),
          });

          if (recoveredAddress.toLowerCase() === input.address.toLowerCase()) {
            return verifyTypedDataOk(input.address);
          }
          return verifyTypedDataInvalid(input.address);
        },
        storageError,
      ),
    );
  },

  getNonce: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('nonce', input.address),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(getNonceNotFound(input.address)),
            (found) => TE.right(getNonceOk(input.address, Number(found['nonce'] ?? 0))),
          ),
        ),
      ),
    ),

  incrementNonce: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const existing = await storage.get('nonce', input.address);
          const currentNonce = existing ? Number(existing['nonce'] ?? 0) : 0;
          const newNonce = currentNonce + 1;

          await storage.put('nonce', input.address, {
            address: input.address,
            nonce: newNonce,
            updatedAt: new Date().toISOString(),
          });

          return incrementNonceOk(input.address, newNonce);
        },
        storageError,
      ),
    ),
};
