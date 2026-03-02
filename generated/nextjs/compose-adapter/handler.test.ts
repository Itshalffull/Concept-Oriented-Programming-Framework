// ComposeAdapter — handler.test.ts
// Unit tests for composeAdapter handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { composeAdapterHandler } from './handler.js';
import type { ComposeAdapterStorage } from './types.js';

const handler = composeAdapterHandler;

const createTestStorage = (): ComposeAdapterStorage => {
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

const createFailingStorage = (): ComposeAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ComposeAdapter handler', () => {
  describe('normalize', () => {
    it('should normalize a known widget type to a Compose composable', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'button', props: JSON.stringify({ type: 'button', padding: 8 }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.adapter).toBe('button');
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.composable).toBe('Button');
        }
      }
    });

    it('should return error for invalid JSON props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'button', props: 'not-json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for unknown widget type', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'unknown-widget', props: JSON.stringify({ type: 'unknown-widget' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should build modifier chain from layout props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'card',
          props: JSON.stringify({
            type: 'card',
            padding: 16,
            width: 'match_parent',
            cornerRadius: 8,
          }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.modifierChain).toContain('padding');
        expect(normalized.modifierChain).toContain('fillMaxWidth');
        expect(normalized.modifierChain).toContain('clip');
      }
    });

    it('should use container composable when direction is set', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'container',
          props: JSON.stringify({ type: 'container', direction: 'horizontal' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.composable).toBe('Row');
      }
    });

    it('should return Left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.normalize(
        { adapter: 'button', props: JSON.stringify({ type: 'button' }) },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
