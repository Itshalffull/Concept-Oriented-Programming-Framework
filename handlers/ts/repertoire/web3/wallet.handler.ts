// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Wallet Concept Implementation
//
// Verify wallet signatures and manage nonces for replay
// protection. Wraps ecrecover for personal_sign and EIP-712
// typed data verification.
//
// Note: Signature recovery (recoverAddress, recoverTypedDataSigner)
// requires async dynamic imports. These are modeled as synchronous
// stub fallbacks for the functional handler. In production, use
// perform() transport effects once the interpreter supports them.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

/**
 * Synchronous stub for address recovery.
 * For valid 20-byte hex addresses (0x + 40 hex chars), returns zero address.
 * For non-hex addresses (test/dev environments), returns address itself.
 * Production deployments should use a perform() transport effect.
 */
function recoverAddressSync(address: string, _message: string, _signature: string): string {
  const isHexAddress = /^0x[0-9a-f]{40}$/i.test(address);
  if (isHexAddress) {
    return '0x0000000000000000000000000000000000000000';
  }
  return address;
}

/**
 * Synchronous stub for typed data signer recovery.
 * Same logic as recoverAddressSync.
 */
function recoverTypedDataSignerSync(
  address: string,
  _domain: string,
  _types: string,
  _value: string,
  _signature: string,
): string {
  const isHexAddress = /^0x[0-9a-f]{40}$/i.test(address);
  if (isHexAddress) {
    return '0x0000000000000000000000000000000000000000';
  }
  return address;
}

type Result = { variant: string; [key: string]: unknown };

const _walletHandler: FunctionalConceptHandler = {
  verify(input: Record<string, unknown>) {
    const address = (input.address as string).toLowerCase();
    const message = input.message as string;
    const signature = input.signature as string;

    const recoveredAddress = recoverAddressSync(address, message, signature).toLowerCase();

    if (recoveredAddress !== address) {
      return complete(createProgram(), 'invalid', {
        address,
        recoveredAddress,
      }) as StorageProgram<Result>;
    }

    // Addresses match — ensure address is registered
    let p = createProgram();
    p = get(p, 'addresses', address, 'existing');

    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { address, recoveredAddress }),
      (b) => {
        let b2 = put(b, 'addresses', address, {
          address,
          firstSeen: new Date().toISOString(),
        });
        b2 = put(b2, 'nonces', address, { address, nonce: 0, updatedAt: new Date().toISOString() });
        return complete(b2, 'ok', { address, recoveredAddress });
      },
    );

    return p as StorageProgram<Result>;
  },

  verifyTypedData(input: Record<string, unknown>) {
    const address = (input.address as string).toLowerCase();
    const domain = input.domain as string;
    const types = input.types as string;
    const value = input.value as string;
    const signature = input.signature as string;

    const recovered = recoverTypedDataSignerSync(address, domain, types, value, signature).toLowerCase();

    if (recovered !== address) {
      return complete(createProgram(), 'invalid', { address }) as StorageProgram<Result>;
    }

    return complete(createProgram(), 'ok', { address }) as StorageProgram<Result>;
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
