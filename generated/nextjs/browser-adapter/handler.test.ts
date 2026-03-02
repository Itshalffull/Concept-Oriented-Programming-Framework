// BrowserAdapter — handler.test.ts
// Unit tests for browserAdapter handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { browserAdapterHandler } from './handler.js';
import type { BrowserAdapterStorage } from './types.js';

// In-memory test storage
const createTestStorage = (): BrowserAdapterStorage => {
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

// Failing storage for error propagation tests
const createFailingStorage = (): BrowserAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('BrowserAdapter handler', () => {
  describe('normalize', () => {
    it('should return ok for a known widget type with layout props', async () => {
      const storage = createTestStorage();
      const props = JSON.stringify({
        type: 'button',
        direction: 'horizontal',
        padding: 8,
      });

      const result = await browserAdapterHandler.normalize(
        { adapter: 'test-adapter', props },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.adapter).toBe('test-adapter');
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.element).toBe('button');
          expect(normalized.styles['padding']).toBe('8px');
          expect(normalized.styles['flex-direction']).toBe('row');
        }
      }
    });

    it('should return ok with accessibility props', async () => {
      const storage = createTestStorage();
      const props = JSON.stringify({
        type: 'container',
        accessibilityLabel: 'Main content',
        role: 'main',
      });

      const result = await browserAdapterHandler.normalize(
        { adapter: 'test-adapter', props },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.element).toBe('div');
          expect(normalized.aria['aria-label']).toBe('Main content');
          expect(normalized.aria['role']).toBe('main');
        }
      }
    });

    it('should return ok with interaction props mapped to DOM events', async () => {
      const storage = createTestStorage();
      const props = JSON.stringify({
        type: 'button',
        onClick: true,
        onHover: true,
      });

      const result = await browserAdapterHandler.normalize(
        { adapter: 'test-adapter', props },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.events['onclick']).toBe('handleClick');
          expect(normalized.events['onmouseenter']).toBe('handleHover');
        }
      }
    });

    it('should return error for invalid JSON props', async () => {
      const storage = createTestStorage();

      const result = await browserAdapterHandler.normalize(
        { adapter: 'test-adapter', props: 'not-valid-json{' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for unknown widget type', async () => {
      const storage = createTestStorage();
      const props = JSON.stringify({ type: 'unknown-widget' });

      const result = await browserAdapterHandler.normalize(
        { adapter: 'test-adapter', props },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const props = JSON.stringify({ type: 'button' });

      const result = await browserAdapterHandler.normalize(
        { adapter: 'test-adapter', props },
        storage,
      )();

      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });
});
