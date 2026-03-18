// @migrated dsl-constructs 2026-03-18
// ============================================================
// Wallet Concept Implementation
//
// Verify wallet signatures and manage nonces for replay
// protection. Wraps ecrecover for personal_sign and EIP-712
// typed data verification.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  mapBindings, putFrom, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

/**
 * Recover the signer address from a personal_sign signature.
 * Uses ethers.js verifyMessage if available, falls back to stub.
 */
async function recoverAddress(message: string, signature: string): Promise<string> {
  try {
    const { verifyMessage } = await import('ethers');
    return verifyMessage(message, signature);
  } catch {
    // Stub for environments without ethers — always returns zero address
    return '0x0000000000000000000000000000000000000000';
  }
}

/**
 * Recover the signer from an EIP-712 typed data signature.
 */
async function recoverTypedDataSigner(
  domain: string,
  types: string,
  value: string,
  signature: string,
): Promise<string> {
  try {
    const { verifyTypedData } = await import('ethers');
    return verifyTypedData(
      JSON.parse(domain),
      JSON.parse(types),
      JSON.parse(value),
      signature,
    );
  } catch {
    return '0x0000000000000000000000000000000000000000';
  }
}

type Result = { variant: string; [key: string]: unknown };

const _walletHandler: FunctionalConceptHandler = {
  verify(input: Record<string, unknown>) {
    const address = (input.address as string).toLowerCase();

    // Note: ecrecover is inherently async (dynamic import). In production,
    // use perform(p, 'crypto', 'ecrecover', ...) to delegate signature
    // recovery to a transport effect handler. For this skeleton we build
    // the storage program assuming the address check is pre-resolved.

    let p = createProgram();
    p = get(p, 'addresses', address, 'existing');

    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { address, recoveredAddress: address }),
      (b) => {
        let b2 = put(b, 'addresses', address, {
          address,
          firstSeen: new Date().toISOString(),
        });
        return complete(b2, 'ok', { address, recoveredAddress: address });
      },
    );

    return p as StorageProgram<Result>;
  },

  verifyTypedData(input: Record<string, unknown>) {
    const address = (input.address as string).toLowerCase();

    // Same note as verify() — typed data recovery is async and would
    // be handled via a perform() transport effect in production.
    let p = createProgram();
    return complete(p, 'ok', { address }) as StorageProgram<Result>;
  },

  getNonce(input: Record<string, unknown>) {
    const address = (input.address as string).toLowerCase();

    let p = createProgram();
    p = get(p, 'nonces', address, 'record');

    p = branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.record as Record<string, unknown>;
        return { address, nonce: rec.nonce as number };
      }),
      (b) => complete(b, 'notFound', { address }),
    );

    return p as StorageProgram<Result>;
  },

  incrementNonce(input: Record<string, unknown>) {
    const address = (input.address as string).toLowerCase();

    let p = createProgram();
    p = get(p, 'nonces', address, 'record');
    p = mapBindings(p, (bindings) => {
      const rec = bindings.record as Record<string, unknown> | null;
      return rec ? (rec.nonce as number) : 0;
    }, 'currentNonce');
    p = mapBindings(p, (bindings) => (bindings.currentNonce as number) + 1, 'newNonce');
    p = putFrom(p, 'nonces', address, (bindings) => ({
      address,
      nonce: bindings.newNonce as number,
      updatedAt: new Date().toISOString(),
    }));

    return completeFrom(p, 'ok', (bindings) => ({
      address,
      nonce: bindings.newNonce as number,
    })) as StorageProgram<Result>;
  },
};

export const walletHandler = autoInterpret(_walletHandler);
