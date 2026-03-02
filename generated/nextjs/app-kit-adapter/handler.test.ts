// AppKitAdapter — handler.test.ts
// Unit tests for appKitAdapter handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { appKitAdapterHandler } from './handler.js';
import type { AppKitAdapterStorage } from './types.js';

const createTestStorage = (): AppKitAdapterStorage => {
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

const createFailingStorage = (): AppKitAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('AppKitAdapter handler', () => {
  describe('normalize', () => {
    it('normalizes button widget to NSButton', async () => {
      const storage = createTestStorage();
      const result = await appKitAdapterHandler.normalize(
        { adapter: 'button', props: JSON.stringify({ type: 'button', onClick: true }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.adapter).toBe('button');
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.viewClass).toBe('NSButton');
        }
      }
    });

    it('normalizes text widget to NSTextField', async () => {
      const storage = createTestStorage();
      const result = await appKitAdapterHandler.normalize(
        { adapter: 'text', props: JSON.stringify({ type: 'text' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.viewClass).toBe('NSTextField');
        }
      }
    });

    it('includes layout properties in normalized output', async () => {
      const storage = createTestStorage();
      const result = await appKitAdapterHandler.normalize(
        { adapter: 'container', props: JSON.stringify({ type: 'container', padding: 8, direction: 'horizontal', spacing: 4 }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.viewClass).toBe('NSStackView');
        expect(normalized.edgeInsets).toBeDefined();
        expect(normalized.spacing).toBe(4);
      }
    });

    it('returns error for invalid JSON props', async () => {
      const storage = createTestStorage();
      const result = await appKitAdapterHandler.normalize(
        { adapter: 'button', props: 'not-valid-json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('returns error for unknown widget type', async () => {
      const storage = createTestStorage();
      const result = await appKitAdapterHandler.normalize(
        { adapter: 'unknown-widget', props: JSON.stringify({ type: 'unknown-widget' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await appKitAdapterHandler.normalize(
        { adapter: 'button', props: JSON.stringify({ type: 'button' }) },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
