// Profile — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { profileHandler } from './handler.js';
import type { ProfileStorage } from './types.js';

const createTestStorage = (): ProfileStorage => {
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

const createFailingStorage = (): ProfileStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Profile handler', () => {
  describe('update', () => {
    it('should create a new profile for a user', async () => {
      const storage = createTestStorage();

      const result = await profileHandler.update(
        { user: 'alice', bio: 'Hello world', image: 'https://example.com/avatar.jpg' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.user).toBe('alice');
        expect(result.right.bio).toBe('Hello world');
        expect(result.right.image).toBe('https://example.com/avatar.jpg');
      }
    });

    it('should update an existing profile', async () => {
      const storage = createTestStorage();
      await profileHandler.update(
        { user: 'bob', bio: 'Old bio', image: 'old.jpg' },
        storage,
      )();

      const result = await profileHandler.update(
        { user: 'bob', bio: 'New bio', image: 'new.jpg' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.bio).toBe('New bio');
        expect(result.right.image).toBe('new.jpg');
      }
    });

    it('should sanitize bio by trimming whitespace', async () => {
      const storage = createTestStorage();

      const result = await profileHandler.update(
        { user: 'carol', bio: '  padded bio  ', image: '' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.bio).toBe('padded bio');
      }
    });

    it('should truncate bio to max length', async () => {
      const storage = createTestStorage();
      const longBio = 'x'.repeat(3000);

      const result = await profileHandler.update(
        { user: 'dave', bio: longBio, image: '' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.bio.length).toBeLessThanOrEqual(2000);
      }
    });

    it('should normalize empty image URL', async () => {
      const storage = createTestStorage();

      const result = await profileHandler.update(
        { user: 'eve', bio: 'bio', image: '   ' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.image).toBe('');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await profileHandler.update(
        { user: 'fail', bio: 'bio', image: 'img' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('should retrieve an existing profile', async () => {
      const storage = createTestStorage();
      await profileHandler.update(
        { user: 'alice', bio: 'My bio', image: 'pic.png' },
        storage,
      )();

      const result = await profileHandler.get(
        { user: 'alice' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.user).toBe('alice');
        expect(result.right.bio).toBe('My bio');
        expect(result.right.image).toBe('pic.png');
      }
    });

    it('should return notfound for nonexistent user', async () => {
      const storage = createTestStorage();

      const result = await profileHandler.get(
        { user: 'nobody' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
        if (result.right.variant === 'notfound') {
          expect(result.right.message).toContain('nobody');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();

      const result = await profileHandler.get(
        { user: 'fail' },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
