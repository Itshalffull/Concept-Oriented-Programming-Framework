// ============================================================
// Wallet Concept Implementation
//
// Verify wallet signatures and manage nonces for replay
// protection. Wraps ecrecover for personal_sign and EIP-712
// typed data verification.
// ============================================================

import type {
  ConceptHandler,
  ConceptStorage,
} from '../../../../runtime/types.js';

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

export const walletHandler: ConceptHandler = {
  async verify(input, storage) {
    const address = (input.address as string).toLowerCase();
    const message = input.message as string;
    const signature = input.signature as string;

    try {
      const recoveredAddress = (await recoverAddress(message, signature)).toLowerCase();

      if (recoveredAddress === address) {
        // Ensure address is registered
        const existing = await storage.get('addresses', address);
        if (!existing) {
          await storage.put('addresses', address, {
            address,
            firstSeen: new Date().toISOString(),
          });
        }

        return { variant: 'ok', address, recoveredAddress };
      }

      return { variant: 'invalid', address, recoveredAddress };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },

  async verifyTypedData(input, storage) {
    const address = (input.address as string).toLowerCase();
    const domain = input.domain as string;
    const types = input.types as string;
    const value = input.value as string;
    const signature = input.signature as string;

    try {
      const recovered = (await recoverTypedDataSigner(domain, types, value, signature)).toLowerCase();

      if (recovered === address) {
        return { variant: 'ok', address };
      }

      return { variant: 'invalid', address };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message: msg };
    }
  },

  async getNonce(input, storage) {
    const address = (input.address as string).toLowerCase();

    const record = await storage.get('nonces', address);
    if (!record) {
      return { variant: 'notFound', address };
    }

    return { variant: 'ok', address, nonce: record.nonce as number };
  },

  async incrementNonce(input, storage) {
    const address = (input.address as string).toLowerCase();

    const record = await storage.get('nonces', address);
    const currentNonce = record ? (record.nonce as number) : 0;
    const newNonce = currentNonce + 1;

    await storage.put('nonces', address, {
      address,
      nonce: newNonce,
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', address, nonce: newNonce };
  },
};
