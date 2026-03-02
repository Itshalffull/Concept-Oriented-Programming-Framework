// DesignToken — handler.test.ts
// Unit tests for designToken handler actions.

import { describe, it, expect } from 'vitest';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';

import { designTokenHandler } from './handler.js';
import type { DesignTokenStorage } from './types.js';

const createTestStorage = (): DesignTokenStorage => {
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

const createFailingStorage = (): DesignTokenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('DesignToken handler', () => {
  describe('define', () => {
    it('returns ok when token is new', async () => {
      const storage = createTestStorage();
      const result = await designTokenHandler.define(
        { token: 'color-primary', name: 'primary', value: '#ff0000', type: 'color', tier: 'core' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.token).toBe('color-primary');
        }
      }
    });

    it('returns duplicate when token already exists', async () => {
      const storage = createTestStorage();
      await designTokenHandler.define(
        { token: 'color-primary', name: 'primary', value: '#ff0000', type: 'color', tier: 'core' },
        storage,
      )();
      const result = await designTokenHandler.define(
        { token: 'color-primary', name: 'primary', value: '#00ff00', type: 'color', tier: 'core' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('duplicate');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await designTokenHandler.define(
        { token: 'color-primary', name: 'primary', value: '#ff0000', type: 'color', tier: 'core' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('alias', () => {
    it('returns ok when reference exists', async () => {
      const storage = createTestStorage();
      await designTokenHandler.define(
        { token: 'color-primary', name: 'primary', value: '#ff0000', type: 'color', tier: 'core' },
        storage,
      )();
      const result = await designTokenHandler.alias(
        { token: 'brand-color', name: 'brand', reference: 'color-primary', tier: 'semantic' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound when reference does not exist', async () => {
      const storage = createTestStorage();
      const result = await designTokenHandler.alias(
        { token: 'brand-color', name: 'brand', reference: 'missing', tier: 'semantic' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await designTokenHandler.alias(
        { token: 'brand-color', name: 'brand', reference: 'color-primary', tier: 'semantic' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('resolve', () => {
    it('returns ok with resolved value for concrete token', async () => {
      const storage = createTestStorage();
      await designTokenHandler.define(
        { token: 'color-primary', name: 'primary', value: '#ff0000', type: 'color', tier: 'core' },
        storage,
      )();
      const result = await designTokenHandler.resolve(
        { token: 'color-primary' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.resolvedValue).toBe('#ff0000');
        }
      }
    });

    it('returns notfound when token does not exist', async () => {
      const storage = createTestStorage();
      const result = await designTokenHandler.resolve(
        { token: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await designTokenHandler.resolve(
        { token: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('update', () => {
    it('returns ok when token exists and value is Some', async () => {
      const storage = createTestStorage();
      await designTokenHandler.define(
        { token: 'color-primary', name: 'primary', value: '#ff0000', type: 'color', tier: 'core' },
        storage,
      )();
      const result = await designTokenHandler.update(
        { token: 'color-primary', value: O.some('#00ff00') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound when token does not exist', async () => {
      const storage = createTestStorage();
      const result = await designTokenHandler.update(
        { token: 'missing', value: O.some('new-value') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await designTokenHandler.update(
        { token: 'test', value: O.some('val') },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('remove', () => {
    it('returns ok when token exists', async () => {
      const storage = createTestStorage();
      await designTokenHandler.define(
        { token: 'color-primary', name: 'primary', value: '#ff0000', type: 'color', tier: 'core' },
        storage,
      )();
      const result = await designTokenHandler.remove(
        { token: 'color-primary' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('returns notfound when token does not exist', async () => {
      const storage = createTestStorage();
      const result = await designTokenHandler.remove(
        { token: 'missing' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('returns left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await designTokenHandler.remove(
        { token: 'test' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('export', () => {
    it('returns ok with CSS output for css format', async () => {
      const storage = createTestStorage();
      await designTokenHandler.define(
        { token: 'color-primary', name: 'primary', value: '#ff0000', type: 'color', tier: 'core' },
        storage,
      )();
      const result = await designTokenHandler.export(
        { format: 'css' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.output).toContain(':root');
        }
      }
    });

    it('returns unsupported for unknown format', async () => {
      const storage = createTestStorage();
      const result = await designTokenHandler.export(
        { format: 'xml' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unsupported');
      }
    });

    it('returns left on storage failure for supported format', async () => {
      const storage = createFailingStorage();
      const result = await designTokenHandler.export(
        { format: 'css' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
