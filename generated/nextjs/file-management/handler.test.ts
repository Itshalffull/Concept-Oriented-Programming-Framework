// FileManagement — handler.test.ts
// Unit tests for fileManagement handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { fileManagementHandler } from './handler.js';
import type { FileManagementStorage } from './types.js';

const createTestStorage = (): FileManagementStorage => {
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

const createFailingStorage = (): FileManagementStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('FileManagement handler', () => {
  describe('upload', () => {
    it('should upload a file successfully', async () => {
      const storage = createTestStorage();
      const result = await fileManagementHandler.upload(
        { file: 'avatar.png', data: 'base64data', mimeType: 'image/png' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.file).toBe('avatar.png');
        }
      }
    });

    it('should return error variant for empty data', async () => {
      const storage = createTestStorage();
      const result = await fileManagementHandler.upload(
        { file: 'empty.txt', data: '', mimeType: 'text/plain' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await fileManagementHandler.upload(
        { file: 'f.txt', data: 'data', mimeType: 'text/plain' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('addUsage', () => {
    it('should add usage to an existing file', async () => {
      const storage = createTestStorage();
      await fileManagementHandler.upload(
        { file: 'doc.pdf', data: 'pdfdata', mimeType: 'application/pdf' },
        storage,
      )();
      const result = await fileManagementHandler.addUsage(
        { file: 'doc.pdf', entity: 'post-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for missing file', async () => {
      const storage = createTestStorage();
      const result = await fileManagementHandler.addUsage(
        { file: 'missing.txt', entity: 'post-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should not duplicate usage entries', async () => {
      const storage = createTestStorage();
      await fileManagementHandler.upload(
        { file: 'img.jpg', data: 'imgdata', mimeType: 'image/jpeg' },
        storage,
      )();
      await fileManagementHandler.addUsage({ file: 'img.jpg', entity: 'e1' }, storage)();
      await fileManagementHandler.addUsage({ file: 'img.jpg', entity: 'e1' }, storage)();
      const fileRecord = await storage.get('file', 'img.jpg');
      const usages = (fileRecord as Record<string, unknown>).usages as string[];
      expect(usages.filter((u) => u === 'e1').length).toBe(1);
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await fileManagementHandler.addUsage(
        { file: 'f.txt', entity: 'e1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('removeUsage', () => {
    it('should remove a usage reference', async () => {
      const storage = createTestStorage();
      await fileManagementHandler.upload(
        { file: 'doc.pdf', data: 'data', mimeType: 'application/pdf' },
        storage,
      )();
      await fileManagementHandler.addUsage({ file: 'doc.pdf', entity: 'post-1' }, storage)();
      const result = await fileManagementHandler.removeUsage(
        { file: 'doc.pdf', entity: 'post-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for missing file', async () => {
      const storage = createTestStorage();
      const result = await fileManagementHandler.removeUsage(
        { file: 'nope.txt', entity: 'e1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await fileManagementHandler.removeUsage(
        { file: 'f.txt', entity: 'e1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('garbageCollect', () => {
    it('should remove orphaned files with no usages', async () => {
      const storage = createTestStorage();
      await fileManagementHandler.upload(
        { file: 'orphan.txt', data: 'data', mimeType: 'text/plain' },
        storage,
      )();
      const result = await fileManagementHandler.garbageCollect({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.removed).toBeGreaterThanOrEqual(1);
      }
    });

    it('should not remove files that have usages', async () => {
      const storage = createTestStorage();
      await fileManagementHandler.upload(
        { file: 'used.txt', data: 'data', mimeType: 'text/plain' },
        storage,
      )();
      await fileManagementHandler.addUsage({ file: 'used.txt', entity: 'e1' }, storage)();
      const result = await fileManagementHandler.garbageCollect({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.removed).toBe(0);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await fileManagementHandler.garbageCollect({}, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getFile', () => {
    it('should retrieve an uploaded file', async () => {
      const storage = createTestStorage();
      await fileManagementHandler.upload(
        { file: 'readme.md', data: '# Hello', mimeType: 'text/markdown' },
        storage,
      )();
      const result = await fileManagementHandler.getFile({ file: 'readme.md' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.data).toBe('# Hello');
          expect(result.right.mimeType).toBe('text/markdown');
        }
      }
    });

    it('should return notfound for missing file', async () => {
      const storage = createTestStorage();
      const result = await fileManagementHandler.getFile({ file: 'nope.txt' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await fileManagementHandler.getFile({ file: 'f.txt' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
