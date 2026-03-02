// VanillaAdapter — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { vanillaAdapterHandler } from './handler.js';
import type { VanillaAdapterStorage } from './types.js';

const createTestStorage = (): VanillaAdapterStorage => {
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

const createFailingStorage = (): VanillaAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = vanillaAdapterHandler;

describe('VanillaAdapter handler', () => {
  describe('normalize', () => {
    it('should normalize basic props into vanilla DOM representation', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'widgets/button',
          props: JSON.stringify({ id: 'btn-1', type: 'submit' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.element).toBe('button');
          expect(normalized.attributes.id).toBe('btn-1');
          expect(normalized.platform).toBe('vanilla');
          expect(normalized.framework).toBe('none');
        }
      }
    });

    it('should resolve known HTML elements from adapter path', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'components/input', props: JSON.stringify({ placeholder: 'Enter text' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.element).toBe('input');
      }
    });

    it('should default to div for unknown element names', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'widgets/MyCustomWidget', props: JSON.stringify({ title: 'hello' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.element).toBe('div');
      }
    });

    it('should classify style props separately', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'widgets/div',
          props: JSON.stringify({ color: 'red', fontSize: '16px', id: 'styled' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.style).toBeDefined();
        expect(normalized.style['color']).toBe('red');
        expect(normalized.style['font-size']).toBe('16px');
        expect(normalized.attributes.id).toBe('styled');
      }
    });

    it('should map data-* attributes to dataset', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'widgets/div',
          props: JSON.stringify({ 'data-testid': 'foo', 'data-value': '42' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.dataset).toBeDefined();
        expect(normalized.dataset.testid).toBe('foo');
        expect(normalized.dataset.value).toBe('42');
      }
    });

    it('should extract event listeners from on* props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'widgets/button',
          props: JSON.stringify({ onClick: 'handleClick', onMouseEnter: 'handleHover' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.eventListeners).toContain('click');
        expect(normalized.eventListeners).toContain('mouseenter');
      }
    });

    it('should convert className to class', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'widgets/span', props: JSON.stringify({ className: 'text-bold' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.attributes['class']).toBe('text-bold');
      }
    });

    it('should handle inline style object', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'widgets/div',
          props: JSON.stringify({ style: { backgroundColor: 'blue', padding: '10px' } }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.style['background-color']).toBe('blue');
        expect(normalized.style['padding']).toBe('10px');
      }
    });

    it('should return error on invalid props JSON', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'widgets/div', props: '{{invalid' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error when props is an array', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'widgets/div', props: '[1,2,3]' },
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
        { adapter: 'widgets/button', props: JSON.stringify({ id: 'persist' }) },
        storage,
      )();
      const stored = await storage.get('vanillaadapter', 'widgets/button');
      expect(stored).not.toBeNull();
      expect(stored!.adapter).toBe('widgets/button');
    });

    it('should return left on storage failure for persistence', async () => {
      const failOnPut: VanillaAdapterStorage = {
        get: async () => null,
        put: async () => { throw new Error('storage failure'); },
        delete: async () => false,
        find: async () => [],
      };
      const result = await handler.normalize(
        { adapter: 'widgets/div', props: JSON.stringify({ id: 'x' }) },
        failOnPut,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
