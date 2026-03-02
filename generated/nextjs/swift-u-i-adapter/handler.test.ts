// SwiftUIAdapter — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { swiftUIAdapterHandler } from './handler.js';
import type { SwiftUIAdapterStorage } from './types.js';

const createTestStorage = (): SwiftUIAdapterStorage => {
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

const createFailingStorage = (): SwiftUIAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = swiftUIAdapterHandler;

describe('SwiftUIAdapter handler', () => {
  describe('normalize', () => {
    it('should normalize basic props into SwiftUI representation', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'Text', props: JSON.stringify({ text: 'Hello' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.platform).toBe('swiftui');
          expect(normalized.runtime).toBe('apple');
          expect(normalized.view).toBe('Text');
          expect(normalized.declarativeUI).toBe(true);
        }
      }
    });

    it('should recognize SwiftUI container views', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'VStack', props: JSON.stringify({ spacing: 10 }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.view).toBe('VStack');
        expect(normalized.isContainer).toBe(true);
        expect(normalized.viewParams.spacing).toBe(10);
      }
    });

    it('should recognize SwiftUI primitive views', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'Button', props: JSON.stringify({ label: 'Tap' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.view).toBe('Button');
        expect(normalized.isContainer).toBe(false);
      }
    });

    it('should map CSS-like layout props to SwiftUI modifiers', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'VStack', props: JSON.stringify({ padding: 16, opacity: 0.8, backgroundColor: 'blue' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        const modNames = normalized.modifiers.map((m: { name: string }) => m.name);
        expect(modNames).toContain('.padding');
        expect(modNames).toContain('.opacity');
        expect(modNames).toContain('.background');
      }
    });

    it('should combine width and height into a single .frame modifier', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'Rectangle', props: JSON.stringify({ width: 100, height: 50 }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        const frameMod = normalized.modifiers.find((m: { name: string }) => m.name === '.frame');
        expect(frameMod).toBeDefined();
        expect(frameMod.value.width).toBe(100);
        expect(frameMod.value.height).toBe(50);
      }
    });

    it('should infer VStack from column flex-direction', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'custom-layout', props: JSON.stringify({ 'flex-direction': 'column' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.view).toBe('VStack');
      }
    });

    it('should infer HStack from row flex-direction', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'custom-layout', props: JSON.stringify({ flexDirection: 'horizontal' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.view).toBe('HStack');
      }
    });

    it('should detect property wrappers starting with @', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'Text', props: JSON.stringify({ '@State': 'count', text: 'hi' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.propertyWrappers).toContain('@State');
      }
    });

    it('should default to VStack for unknown adapter', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'unknown-view', props: JSON.stringify({}) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.view).toBe('VStack');
      }
    });

    it('should return error for invalid JSON props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'Text', props: '{bad json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should persist normalized result to storage', async () => {
      const storage = createTestStorage();
      await handler.normalize(
        { adapter: 'Text', props: JSON.stringify({ text: 'ok' }) },
        storage,
      )();
      const stored = await storage.get('swiftuiadapter', 'Text');
      expect(stored).not.toBeNull();
      expect(stored?.adapter).toBe('Text');
    });

    it('should return Left on storage failure during put', async () => {
      const storage = createFailingStorage();
      const result = await handler.normalize(
        { adapter: 'Text', props: JSON.stringify({ text: 'ok' }) },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
