// RustSdkTarget — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { rustSdkTargetHandler } from './handler.js';
import type { RustSdkTargetStorage } from './types.js';

const createTestStorage = (): RustSdkTargetStorage => {
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

const createFailingStorage = (): RustSdkTargetStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = rustSdkTargetHandler;

describe('RustSdkTarget handler', () => {
  describe('generate', () => {
    it('should generate a Rust SDK crate from JSON projection', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({
        concept: 'Order',
        actions: ['create', 'get', 'list'],
        fields: [{ name: 'id', type: 'string' }, { name: 'total', type: 'number' }],
      });
      const result = await handler.generate({ projection, config: '{}' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.crate).toContain('client');
        expect(result.right.files.length).toBeGreaterThan(0);
        expect(result.right.files).toContain('Cargo.toml');
        expect(result.right.files).toContain('src/lib.rs');
      }
    });

    it('should use defaults for plain-string projection', async () => {
      const storage = createTestStorage();
      const result = await handler.generate({ projection: 'UserProfile', config: '{}' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.crate).toContain('user_profile_client');
      }
    });

    it('should persist crate metadata to storage', async () => {
      const storage = createTestStorage();
      const projection = JSON.stringify({ concept: 'Payment', actions: ['charge'] });
      await handler.generate({ projection, config: '{}' }, storage)();
      const stored = await storage.get('crates', 'payment_client');
      expect(stored).not.toBeNull();
      expect(stored!['concept']).toBe('Payment');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.generate({ projection: 'X', config: '{}' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
