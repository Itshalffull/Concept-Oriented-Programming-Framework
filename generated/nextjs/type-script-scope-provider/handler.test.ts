// TypeScriptScopeProvider — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { typeScriptScopeProviderHandler } from './handler.js';
import type { TypeScriptScopeProviderStorage } from './types.js';

const createTestStorage = (): TypeScriptScopeProviderStorage => {
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

const createFailingStorage = (): TypeScriptScopeProviderStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = typeScriptScopeProviderHandler;

describe('TypeScriptScopeProvider handler', () => {
  describe('initialize', () => {
    it('should initialize and return an instance id', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('ts-scope-');
        }
      }
    });

    it('should persist provider metadata with scope and declaration kinds', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const instanceId = result.right.instance;
        const provider = await storage.get('providers', instanceId);
        expect(provider).not.toBeNull();
        expect(provider?.language).toBe('typescript');
        const scopeKinds = provider?.scopeKinds as readonly string[];
        expect(scopeKinds).toContain('module');
        expect(scopeKinds).toContain('function');
        expect(scopeKinds).toContain('block');
        expect(scopeKinds).toContain('class');
      }
    });

    it('should persist binding rules for var, let, and const', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const instanceId = result.right.instance;

        const varRule = await storage.get('binding_rules', `${instanceId}:var`);
        expect(varRule).not.toBeNull();
        expect(varRule?.hoisted).toBe(true);
        expect(varRule?.blockScoped).toBe(false);

        const letRule = await storage.get('binding_rules', `${instanceId}:let`);
        expect(letRule).not.toBeNull();
        expect(letRule?.hoisted).toBe(false);
        expect(letRule?.blockScoped).toBe(true);

        const constRule = await storage.get('binding_rules', `${instanceId}:const`);
        expect(constRule).not.toBeNull();
        expect(constRule?.hoisted).toBe(false);
        expect(constRule?.blockScoped).toBe(true);
        expect(constRule?.canRedeclare).toBe(false);
      }
    });

    it('should persist scope creator mappings', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const instanceId = result.right.instance;
        const funcScope = await storage.get('scope_creators', `${instanceId}:function_declaration`);
        expect(funcScope).not.toBeNull();
        expect(funcScope?.scopeKind).toBe('function');

        const classScope = await storage.get('scope_creators', `${instanceId}:class_declaration`);
        expect(classScope).not.toBeNull();
        expect(classScope?.scopeKind).toBe('class');
      }
    });

    it('should mark interface and type as type-only', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const instanceId = result.right.instance;
        const interfaceRule = await storage.get('binding_rules', `${instanceId}:interface`);
        expect(interfaceRule?.isTypeOnly).toBe(true);

        const typeRule = await storage.get('binding_rules', `${instanceId}:type`);
        expect(typeRule?.isTypeOnly).toBe(true);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });
});
