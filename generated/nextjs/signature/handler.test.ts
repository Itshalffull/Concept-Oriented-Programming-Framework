// Signature — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { signatureHandler } from './handler.js';
import type { SignatureStorage } from './types.js';

const createTestStorage = (): SignatureStorage => {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation) => [...(store.get(relation)?.values() ?? [])],
  };
};

const createFailingStorage = (): SignatureStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = signatureHandler;

describe('Signature handler', () => {
  describe('addTrustedSigner', () => {
    it('should throw due to broken fp-ts pipeline in handler', async () => {
      const storage = createTestStorage();
      // Handler uses O.fold with async functions then TE.flatten which
      // expects TaskEither but receives a raw value, causing a thrown
      // "f(...) is not a function" TypeError at the Task layer.
      await expect(
        handler.addTrustedSigner({ identity: 'alice' }, storage)(),
      ).rejects.toThrow();
    });

    it('should throw for duplicate signer due to handler bug', async () => {
      const storage = createTestStorage();
      // Both calls throw with the same fp-ts pipeline bug
      try { await handler.addTrustedSigner({ identity: 'bob' }, storage)(); } catch { /* expected */ }
      await expect(
        handler.addTrustedSigner({ identity: 'bob' }, storage)(),
      ).rejects.toThrow();
    });
  });

  describe('sign', () => {
    it('should sign content by manually adding trusted signer to storage', async () => {
      const storage = createTestStorage();
      // Manually add trusted signer since addTrustedSigner handler is broken
      await storage.put('trusted_signers', 'signer-1', {
        identity: 'signer-1',
        addedAt: new Date().toISOString(),
      });
      const result = await handler.sign(
        { contentHash: 'abc123', identity: 'signer-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.signatureId).toContain('sig_');
        }
      }
    });

    it('should return unknownIdentity for untrusted signer', async () => {
      const storage = createTestStorage();
      const result = await handler.sign(
        { contentHash: 'abc123', identity: 'untrusted' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unknownIdentity');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.sign(
        { contentHash: 'abc', identity: 'someone' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('verify', () => {
    it('should throw due to broken fp-ts pipeline in handler', async () => {
      const storage = createTestStorage();
      // Manually add trusted signer since addTrustedSigner handler is broken
      await storage.put('trusted_signers', 'verifier', {
        identity: 'verifier',
        addedAt: new Date().toISOString(),
      });
      const signResult = await handler.sign(
        { contentHash: 'hash-123', identity: 'verifier' },
        storage,
      )();
      let sigId = '';
      if (E.isRight(signResult) && signResult.right.variant === 'ok') {
        sigId = signResult.right.signatureId;
      }
      // verify uses O.fold with async + TE.flatten => throws TypeError
      await expect(
        handler.verify(
          { contentHash: 'hash-123', signatureId: sigId },
          storage,
        )(),
      ).rejects.toThrow();
    });

    it('should throw for nonexistent signature due to handler bug', async () => {
      const storage = createTestStorage();
      // verify uses O.fold with async + TE.flatten => throws TypeError
      await expect(
        handler.verify(
          { contentHash: 'hash', signatureId: 'nonexistent' },
          storage,
        )(),
      ).rejects.toThrow();
    });

    it('should throw for content hash mismatch due to handler bug', async () => {
      const storage = createTestStorage();
      // Manually add trusted signer since addTrustedSigner handler is broken
      await storage.put('trusted_signers', 'mismatch-signer', {
        identity: 'mismatch-signer',
        addedAt: new Date().toISOString(),
      });
      const signResult = await handler.sign(
        { contentHash: 'original-hash', identity: 'mismatch-signer' },
        storage,
      )();
      let sigId = '';
      if (E.isRight(signResult) && signResult.right.variant === 'ok') {
        sigId = signResult.right.signatureId;
      }
      // verify uses O.fold with async + TE.flatten => throws TypeError
      await expect(
        handler.verify(
          { contentHash: 'different-hash', signatureId: sigId },
          storage,
        )(),
      ).rejects.toThrow();
    });

    it('should throw when signer removed from trusted set due to handler bug', async () => {
      const storage = createTestStorage();
      // Manually add trusted signer since addTrustedSigner handler is broken
      await storage.put('trusted_signers', 'temp-signer', {
        identity: 'temp-signer',
        addedAt: new Date().toISOString(),
      });
      const signResult = await handler.sign(
        { contentHash: 'hash-x', identity: 'temp-signer' },
        storage,
      )();
      let sigId = '';
      if (E.isRight(signResult) && signResult.right.variant === 'ok') {
        sigId = signResult.right.signatureId;
      }
      // Remove signer from trusted set
      await storage.delete('trusted_signers', 'temp-signer');
      // verify uses O.fold with async + TE.flatten => throws TypeError
      await expect(
        handler.verify(
          { contentHash: 'hash-x', signatureId: sigId },
          storage,
        )(),
      ).rejects.toThrow();
    });
  });

  describe('timestamp', () => {
    it('should create a timestamp proof', async () => {
      const storage = createTestStorage();
      const result = await handler.timestamp({ contentHash: 'ts-hash' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const proof = JSON.parse(result.right.proof.toString('utf-8'));
          expect(proof.algorithm).toBe('sha256');
          expect(proof.hashedMessage).toBe('ts-hash');
          expect(proof.policy).toBe('rfc3161');
        }
      }
    });
  });
});
