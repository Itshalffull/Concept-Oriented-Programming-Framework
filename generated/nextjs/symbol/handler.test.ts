// Symbol — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { symbolHandler } from './handler.js';
import type { SymbolStorage } from './types.js';

const createTestStorage = (): SymbolStorage => {
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

const createFailingStorage = (): SymbolStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = symbolHandler;

describe('Symbol handler', () => {
  describe('register', () => {
    it('should register a new symbol successfully', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { symbolString: 'com.app.MyClass', kind: 'class', displayName: 'MyClass', definingFile: 'MyClass.ts' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.symbol).toContain('sym_');
        }
      }
    });

    it('should return alreadyExists when registering duplicate', async () => {
      const storage = createTestStorage();
      await handler.register(
        { symbolString: 'com.app.MyClass', kind: 'class', displayName: 'MyClass', definingFile: 'MyClass.ts' },
        storage,
      )();
      const result = await handler.register(
        { symbolString: 'com.app.MyClass', kind: 'class', displayName: 'MyClass', definingFile: 'MyClass.ts' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('alreadyExists');
      }
    });

    it('should derive namespace from symbol string', async () => {
      const storage = createTestStorage();
      await handler.register(
        { symbolString: 'com.app.MyClass', kind: 'class', displayName: 'MyClass', definingFile: 'MyClass.ts' },
        storage,
      )();
      const key = 'sym_com_app_MyClass';
      const stored = await storage.get('symbol', key);
      expect(stored).not.toBeNull();
      expect(stored?.namespace).toBe('com.app');
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.register(
        { symbolString: 'com.app.MyClass', kind: 'class', displayName: 'MyClass', definingFile: 'MyClass.ts' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('resolve', () => {
    it('should resolve an exact match', async () => {
      const storage = createTestStorage();
      await handler.register(
        { symbolString: 'com.app.MyClass', kind: 'class', displayName: 'MyClass', definingFile: 'MyClass.ts' },
        storage,
      )();
      const result = await handler.resolve(
        { symbolString: 'com.app.MyClass' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound when symbol does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.resolve(
        { symbolString: 'nonexistent.Symbol' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('findByKind', () => {
    it('should find symbols of a given kind', async () => {
      const storage = createTestStorage();
      await handler.register(
        { symbolString: 'com.ClassA', kind: 'class', displayName: 'ClassA', definingFile: 'a.ts' },
        storage,
      )();
      await handler.register(
        { symbolString: 'com.funcB', kind: 'function', displayName: 'funcB', definingFile: 'b.ts' },
        storage,
      )();
      const result = await handler.findByKind(
        { kind: 'class', namespace: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const symbols = JSON.parse(result.right.symbols);
        expect(symbols.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('findByFile', () => {
    it('should find symbols defined in a given file', async () => {
      const storage = createTestStorage();
      await handler.register(
        { symbolString: 'com.ClassA', kind: 'class', displayName: 'ClassA', definingFile: 'module.ts' },
        storage,
      )();
      const result = await handler.findByFile(
        { file: 'module.ts' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('rename', () => {
    it('should rename a symbol successfully', async () => {
      const storage = createTestStorage();
      await handler.register(
        { symbolString: 'com.OldName', kind: 'class', displayName: 'OldName', definingFile: 'a.ts' },
        storage,
      )();
      const key = 'sym_com_OldName';
      const result = await handler.rename(
        { symbol: key, newName: 'NewName' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.oldName).toBe('OldName');
        }
      }
    });

    it('should return notfound for nonexistent symbol', async () => {
      const storage = createTestStorage();
      const result = await handler.rename(
        { symbol: 'nonexistent', newName: 'NewName' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return conflict when new name already exists', async () => {
      const storage = createTestStorage();
      await handler.register(
        { symbolString: 'com.Alpha', kind: 'class', displayName: 'Alpha', definingFile: 'a.ts' },
        storage,
      )();
      await handler.register(
        { symbolString: 'com.Beta', kind: 'class', displayName: 'Beta', definingFile: 'b.ts' },
        storage,
      )();
      const result = await handler.rename(
        { symbol: 'sym_com_Alpha', newName: 'Beta' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('conflict');
      }
    });
  });

  describe('get', () => {
    it('should get a registered symbol', async () => {
      const storage = createTestStorage();
      await handler.register(
        { symbolString: 'com.app.MyClass', kind: 'class', displayName: 'MyClass', definingFile: 'MyClass.ts' },
        storage,
      )();
      const result = await handler.get(
        { symbol: 'sym_com_app_MyClass' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.kind).toBe('class');
          expect(result.right.displayName).toBe('MyClass');
          expect(result.right.definingFile).toBe('MyClass.ts');
          expect(result.right.namespace).toBe('com.app');
        }
      }
    });

    it('should return notfound for unknown symbol', async () => {
      const storage = createTestStorage();
      const result = await handler.get(
        { symbol: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
