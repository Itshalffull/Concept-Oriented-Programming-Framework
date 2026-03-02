// ReactNativeAdapter — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { reactNativeAdapterHandler } from './handler.js';
import type { ReactNativeAdapterStorage } from './types.js';

const createTestStorage = (): ReactNativeAdapterStorage => {
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

const createFailingStorage = (): ReactNativeAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = reactNativeAdapterHandler;

describe('ReactNativeAdapter handler', () => {
  describe('normalize', () => {
    it('should return error for invalid props JSON', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'widgets/Button', props: 'not-json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should map DOM element names to React Native primitives', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'widgets/div', props: JSON.stringify({ flex: 1 }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.component).toBe('View');
        expect(normalized.platform).toBe('react-native');
      }
    });

    it('should map img to Image', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'widgets/img', props: JSON.stringify({ source: 'url' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.component).toBe('Image');
      }
    });

    it('should map button to Pressable', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'ui/button', props: JSON.stringify({ onPress: 'handler' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.component).toBe('Pressable');
        expect(normalized.interactive).toBe(true);
      }
    });

    it('should enforce minimum touch target on interactive components', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'ui/button', props: JSON.stringify({ width: 20, height: 20 }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.props.style.minWidth).toBe(44);
        expect(normalized.props.style.minHeight).toBe(44);
      }
    });

    it('should filter out unsupported CSS props and add warnings', async () => {
      const storage = createTestStorage();
      const props = { float: 'left', cursor: 'pointer', backgroundColor: 'blue' };
      const result = await handler.normalize(
        { adapter: 'View', props: JSON.stringify(props) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.props._rnWarnings).toBeDefined();
        expect(normalized.props._rnWarnings).toContain('float');
        expect(normalized.props._rnWarnings).toContain('cursor');
      }
    });

    it('should pass through recognized RN primitives directly', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'ScrollView', props: JSON.stringify({ horizontal: true }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.component).toBe('ScrollView');
      }
    });

    it('should set runtime to hermes', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'View', props: JSON.stringify({}) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.runtime).toBe('hermes');
      }
    });

    it('should return left on storage failure for valid normalize', async () => {
      const storage = createFailingStorage();
      const result = await handler.normalize(
        { adapter: 'A', props: JSON.stringify({ x: 1 }) },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
