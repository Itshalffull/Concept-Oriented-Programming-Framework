// SyncedContent — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { syncedContentHandler } from './handler.js';
import type { SyncedContentStorage } from './types.js';

const createTestStorage = (): SyncedContentStorage => {
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

const createFailingStorage = (): SyncedContentStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = syncedContentHandler;

/** Helper to seed an original content record. */
const seedOriginal = async (storage: SyncedContentStorage, id: string, content: string) => {
  await storage.put('original', id, {
    id,
    content,
    version: 1,
    references: [],
    createdAt: new Date().toISOString(),
  });
};

describe('SyncedContent handler', () => {
  describe('createReference', () => {
    it('should create a reference to an existing original', async () => {
      const storage = createTestStorage();
      await seedOriginal(storage, 'doc-1', 'Hello World');
      const result = await handler.createReference(
        { ref: 'ref-1', original: 'doc-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should copy content to the reference', async () => {
      const storage = createTestStorage();
      await seedOriginal(storage, 'doc-1', 'Hello World');
      await handler.createReference({ ref: 'ref-1', original: 'doc-1' }, storage)();
      const refRecord = await storage.get('reference', 'ref-1');
      expect(refRecord).not.toBeNull();
      expect(refRecord?.content).toBe('Hello World');
      expect(refRecord?.independent).toBe(false);
    });

    it('should add ref to original reference tracking set', async () => {
      const storage = createTestStorage();
      await seedOriginal(storage, 'doc-1', 'Hello');
      await handler.createReference({ ref: 'ref-1', original: 'doc-1' }, storage)();
      const original = await storage.get('original', 'doc-1');
      expect(original).not.toBeNull();
      expect((original?.references as string[]).includes('ref-1')).toBe(true);
    });

    it('should return notfound when original does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.createReference(
        { ref: 'ref-1', original: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.createReference(
        { ref: 'ref-1', original: 'doc-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('editOriginal', () => {
    it('should update original content and increment version', async () => {
      const storage = createTestStorage();
      await seedOriginal(storage, 'doc-1', 'v1');
      const result = await handler.editOriginal(
        { original: 'doc-1', content: 'v2' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
      const updated = await storage.get('original', 'doc-1');
      expect(updated?.content).toBe('v2');
      expect(updated?.version).toBe(2);
    });

    it('should propagate content to live references', async () => {
      const storage = createTestStorage();
      await seedOriginal(storage, 'doc-1', 'v1');
      await handler.createReference({ ref: 'ref-1', original: 'doc-1' }, storage)();
      await handler.editOriginal({ original: 'doc-1', content: 'v2' }, storage)();
      const refRecord = await storage.get('reference', 'ref-1');
      expect(refRecord?.content).toBe('v2');
      expect(refRecord?.version).toBe(2);
    });

    it('should not propagate to independent references', async () => {
      const storage = createTestStorage();
      await seedOriginal(storage, 'doc-1', 'v1');
      await handler.createReference({ ref: 'ref-1', original: 'doc-1' }, storage)();
      await handler.convertToIndependent({ ref: 'ref-1' }, storage)();
      await handler.editOriginal({ original: 'doc-1', content: 'v2' }, storage)();
      const refRecord = await storage.get('reference', 'ref-1');
      expect(refRecord?.content).toBe('v1');
    });

    it('should return notfound when original does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.editOriginal(
        { original: 'nonexistent', content: 'x' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('deleteReference', () => {
    it('should delete an existing reference', async () => {
      const storage = createTestStorage();
      await seedOriginal(storage, 'doc-1', 'content');
      await handler.createReference({ ref: 'ref-1', original: 'doc-1' }, storage)();
      const result = await handler.deleteReference({ ref: 'ref-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
      const refRecord = await storage.get('reference', 'ref-1');
      expect(refRecord).toBeNull();
    });

    it('should remove ref from original tracking set', async () => {
      const storage = createTestStorage();
      await seedOriginal(storage, 'doc-1', 'content');
      await handler.createReference({ ref: 'ref-1', original: 'doc-1' }, storage)();
      await handler.deleteReference({ ref: 'ref-1' }, storage)();
      const original = await storage.get('original', 'doc-1');
      expect((original?.references as string[]).includes('ref-1')).toBe(false);
    });

    it('should return notfound when reference does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.deleteReference({ ref: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('convertToIndependent', () => {
    it('should mark reference as independent', async () => {
      const storage = createTestStorage();
      await seedOriginal(storage, 'doc-1', 'content');
      await handler.createReference({ ref: 'ref-1', original: 'doc-1' }, storage)();
      const result = await handler.convertToIndependent({ ref: 'ref-1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
      const refRecord = await storage.get('reference', 'ref-1');
      expect(refRecord?.independent).toBe(true);
    });

    it('should remove from original active reference tracking', async () => {
      const storage = createTestStorage();
      await seedOriginal(storage, 'doc-1', 'content');
      await handler.createReference({ ref: 'ref-1', original: 'doc-1' }, storage)();
      await handler.convertToIndependent({ ref: 'ref-1' }, storage)();
      const original = await storage.get('original', 'doc-1');
      expect((original?.references as string[]).includes('ref-1')).toBe(false);
    });

    it('should return notfound when reference does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.convertToIndependent({ ref: 'nonexistent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
