// MediaAsset — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { mediaAssetHandler } from './handler.js';
import type { MediaAssetStorage } from './types.js';

const createTestStorage = (): MediaAssetStorage => {
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

const createFailingStorage = (): MediaAssetStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = mediaAssetHandler;

describe('MediaAsset handler', () => {
  describe('createMedia', () => {
    it('should create a media asset with valid image file', async () => {
      const storage = createTestStorage();
      const result = await handler.createMedia(
        { asset: 'img-1', source: 'upload', file: 'photo.jpg' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.asset).toBe('img-1');
        }
      }
    });

    it('should create a media asset for video files', async () => {
      const storage = createTestStorage();
      const result = await handler.createMedia(
        { asset: 'vid-1', source: 'upload', file: 'clip.mp4' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return error for file with no extension', async () => {
      const storage = createTestStorage();
      const result = await handler.createMedia(
        { asset: 'bad-1', source: 'upload', file: 'noext' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for unsupported file type', async () => {
      const storage = createTestStorage();
      const result = await handler.createMedia(
        { asset: 'bad-2', source: 'upload', file: 'data.xyz' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.createMedia(
        { asset: 'fail', source: 'upload', file: 'test.png' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('extractMetadata', () => {
    it('should extract metadata from an existing asset', async () => {
      const storage = createTestStorage();
      await handler.createMedia(
        { asset: 'meta-img', source: 'upload', file: 'photo.png' },
        storage,
      )();
      const result = await handler.extractMetadata({ asset: 'meta-img' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const metadata = JSON.parse(result.right.metadata);
          expect(metadata.mimeType).toBe('image/png');
          expect(metadata.isImage).toBe(true);
        }
      }
    });

    it('should return notfound for non-existent asset', async () => {
      const storage = createTestStorage();
      const result = await handler.extractMetadata({ asset: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('generateThumbnail', () => {
    it('should generate thumbnail for image asset', async () => {
      const storage = createTestStorage();
      await handler.createMedia(
        { asset: 'thumb-img', source: 'upload', file: 'image.jpg' },
        storage,
      )();
      const result = await handler.generateThumbnail({ asset: 'thumb-img' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.thumbnail).toContain('thumb_');
        }
      }
    });

    it('should generate placeholder thumbnail for non-image asset', async () => {
      const storage = createTestStorage();
      await handler.createMedia(
        { asset: 'thumb-vid', source: 'upload', file: 'movie.mp4' },
        storage,
      )();
      const result = await handler.generateThumbnail({ asset: 'thumb-vid' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.thumbnail).toContain('placeholder_');
        }
      }
    });

    it('should return notfound for non-existent asset', async () => {
      const storage = createTestStorage();
      const result = await handler.generateThumbnail({ asset: 'nope' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('getMedia', () => {
    it('should retrieve media asset details', async () => {
      const storage = createTestStorage();
      await handler.createMedia(
        { asset: 'get-img', source: 'camera', file: 'shot.webp' },
        storage,
      )();
      const result = await handler.getMedia({ asset: 'get-img' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.asset).toBe('get-img');
          const metadata = JSON.parse(result.right.metadata);
          expect(metadata.mimeType).toBe('image/webp');
        }
      }
    });

    it('should return notfound for non-existent asset', async () => {
      const storage = createTestStorage();
      const result = await handler.getMedia({ asset: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
