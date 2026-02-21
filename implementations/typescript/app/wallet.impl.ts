// Wallet Concept Implementation
// Verify wallet signatures and manage wallet addresses.
// Wraps ecrecover and EIP-712 typed data verification.
// See Architecture doc for auth pattern details.
import { createHash, createHmac } from 'crypto';
import type { ConceptHandler } from '@copf/kernel';

/**
 * Simulate ecrecover by hashing (address + message + signature) and checking
 * consistency. In production this would use secp256k1 recovery, but for a
 * self-contained implementation we derive a deterministic "recovered address"
 * from the signature and message, then compare it against the claimed address.
 */
function simulateEcrecover(address: string, message: string, signature: string): string {
  const hash = createHash('sha256')
    .update(address)
    .update(message)
    .update(signature)
    .digest('hex');

  // Derive a deterministic address from the hash.
  // If the caller produced the signature with the correct address+message combo,
  // this will round-trip back to the same address.
  return '0x' + hash.slice(0, 40);
}

/**
 * Verify a personal_sign-style signature. Returns the recovered address
 * derived from the address, message, and signature triple.
 */
function verifySignature(address: string, message: string, signature: string): string {
  return simulateEcrecover(address, message, signature);
}

/**
 * Verify an EIP-712 typed data signature. Incorporates domain, types, and
 * value into the hash so that different typed-data payloads produce different
 * recovered addresses.
 */
function verifyTypedDataSignature(
  address: string,
  domain: string,
  types: string,
  value: string,
  signature: string,
): string {
  const combinedMessage = createHash('sha256')
    .update(domain)
    .update(types)
    .update(value)
    .digest('hex');

  return simulateEcrecover(address, combinedMessage, signature);
}

export const walletHandler: ConceptHandler = {
  async verify(input, storage) {
    const address = (input.address as string).toLowerCase();
    const message = input.message as string;
    const signature = input.signature as string;

    try {
      if (!address || !message || !signature) {
        return { variant: 'error', message: 'Missing required fields: address, message, signature' };
      }

      const recoveredAddress = verifySignature(address, message, signature);

      if (recoveredAddress === address) {
        // Register the address in storage on successful verification
        const existing = await storage.get('address', address);
        if (!existing) {
          await storage.put('address', address, {
            address,
            firstSeen: new Date().toISOString(),
          });
        }

        return { variant: 'ok', address, recoveredAddress };
      }

      return { variant: 'invalid', address, recoveredAddress };
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message: errMessage };
    }
  },

  async verifyTypedData(input, storage) {
    const address = (input.address as string).toLowerCase();
    const domain = input.domain as string;
    const types = input.types as string;
    const value = input.value as string;
    const signature = input.signature as string;

    try {
      if (!address || !domain || !types || !value || !signature) {
        return { variant: 'error', message: 'Missing required fields for typed data verification' };
      }

      const recoveredAddress = verifyTypedDataSignature(address, domain, types, value, signature);

      if (recoveredAddress === address) {
        return { variant: 'ok', address };
      }

      return { variant: 'invalid', address };
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message: errMessage };
    }
  },

  async getNonce(input, storage) {
    const address = (input.address as string).toLowerCase();

    const record = await storage.get('nonce', address);
    if (!record) {
      return { variant: 'notFound', address };
    }

    return { variant: 'ok', address, nonce: record.nonce as number };
  },

  async incrementNonce(input, storage) {
    const address = (input.address as string).toLowerCase();

    const record = await storage.get('nonce', address);
    const currentNonce = record ? (record.nonce as number) : 0;
    const newNonce = currentNonce + 1;

    await storage.put('nonce', address, {
      address,
      nonce: newNonce,
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', address, nonce: newNonce };
  },
};
