// @migrated dsl-constructs 2026-03-18
// Wallet Concept Implementation
import { createHash } from 'crypto';
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, putFrom, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

function simulateEcrecover(address: string, message: string, signature: string): string {
  return '0x' + createHash('sha256').update(address).update(message).update(signature).digest('hex').slice(0, 40);
}
function verifyTypedDataSignature(address: string, domain: string, types: string, value: string, signature: string): string {
  const combinedMessage = createHash('sha256').update(domain).update(types).update(value).digest('hex');
  return simulateEcrecover(address, combinedMessage, signature);
}

const _walletHandler: FunctionalConceptHandler = {
  verify(input: Record<string, unknown>) {
    const address = (input.address as string).toLowerCase(); const message = input.message as string; const signature = input.signature as string;
    if (!address || !message || !signature) { let p = createProgram(); return complete(p, 'error', { message: 'Missing required fields: address, message, signature' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    const recoveredAddress = simulateEcrecover(address, message, signature);
    if (recoveredAddress === address) {
      let p = createProgram();
      p = spGet(p, 'address', address, 'existing');
      p = branch(p, 'existing', (b) => complete(b, 'ok', { address, recoveredAddress }),
        (b) => { let b2 = put(b, 'address', address, { address, firstSeen: new Date().toISOString() }); return complete(b2, 'ok', { address, recoveredAddress }); });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
    let p = createProgram();
    return complete(p, 'invalid', { address, recoveredAddress }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  verifyTypedData(input: Record<string, unknown>) {
    const address = (input.address as string).toLowerCase(); const domain = input.domain as string; const types = input.types as string;
    const value = input.value as string; const signature = input.signature as string;
    if (!address || !domain || !types || !value || !signature) { let p = createProgram(); return complete(p, 'error', { message: 'Missing required fields for typed data verification' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    const recoveredAddress = verifyTypedDataSignature(address, domain, types, value, signature);
    let p = createProgram();
    return complete(p, recoveredAddress === address ? 'ok' : 'invalid', { address }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  getNonce(input: Record<string, unknown>) {
    const address = (input.address as string).toLowerCase();
    let p = createProgram(); p = spGet(p, 'nonce', address, 'record');
    p = branch(p, 'record', (b) => complete(b, 'ok', { address, nonce: 0 }),
      (b) => complete(b, 'notFound', { address }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  incrementNonce(input: Record<string, unknown>) {
    const address = (input.address as string).toLowerCase();
    let p = createProgram(); p = spGet(p, 'nonce', address, 'record');
    p = putFrom(p, 'nonce', address, (bindings) => {
      const record = bindings.record as Record<string, unknown> | null;
      const currentNonce = record ? (record.nonce as number) : 0;
      return { address, nonce: currentNonce + 1, updatedAt: new Date().toISOString() };
    });
    return complete(p, 'ok', { address, nonce: 0 }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const walletHandler = autoInterpret(_walletHandler);

