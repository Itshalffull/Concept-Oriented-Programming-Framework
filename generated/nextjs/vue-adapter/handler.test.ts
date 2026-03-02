// VueAdapter — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { vueAdapterHandler } from './handler.js';
import type { VueAdapterStorage } from './types.js';

const createTestStorage = (): VueAdapterStorage => {
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

const createFailingStorage = (): VueAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = vueAdapterHandler;

describe('VueAdapter handler', () => {
  describe('normalize', () => {
    it('should normalize basic props into Vue component representation', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'widgets/MyButton',
          props: JSON.stringify({ id: 'btn-1', type: 'primary' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.component).toBe('MyButton');
          expect(normalized.platform).toBe('vue');
          expect(normalized.framework).toBe('vue3');
          expect(normalized.compositionAPI).toBe(true);
          expect(normalized.sfc).toBe(true);
          expect(normalized.props.id).toBe('btn-1');
        }
      }
    });

    it('should map React-style event handlers to Vue @event syntax', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'widgets/form',
          props: JSON.stringify({ onClick: 'handleClick', onChange: 'handleChange' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.props['@click']).toBe('handleClick');
        expect(normalized.props['@change']).toBe('handleChange');
        expect(normalized.events).toContain('@click');
        expect(normalized.events).toContain('@change');
      }
    });

    it('should convert value/modelValue props to v-model bindings', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'widgets/input',
          props: JSON.stringify({ modelValue: 'text', checked: true }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.props['v-model']).toBe('text');
        expect(normalized.props['v-model:checked']).toBe(true);
        expect(normalized.vmodels).toContain('v-model');
        expect(normalized.vmodels).toContain('v-model:checked');
      }
    });

    it('should pass through Vue directives', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'widgets/item',
          props: JSON.stringify({ 'v-if': 'isVisible', 'v-for': 'item in items' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.props['v-if']).toBe('isVisible');
        expect(normalized.props['v-for']).toBe('item in items');
        expect(normalized.directives).toContain('v-if');
        expect(normalized.directives).toContain('v-for');
      }
    });

    it('should detect Composition API usage', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'widgets/comp',
          props: JSON.stringify({ ref: 'myRef', computed: 'myComputed', id: 'x' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.compositionAPIs).toContain('ref');
        expect(normalized.compositionAPIs).toContain('computed');
      }
    });

    it('should convert className to class', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'widgets/box',
          props: JSON.stringify({ className: 'container mx-auto' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.props['class']).toBe('container mx-auto');
      }
    });

    it('should pass through dynamic binding props (:prop)', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'widgets/dynamic',
          props: JSON.stringify({ ':src': 'imageUrl', 'v-bind:alt': 'altText' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.props[':src']).toBe('imageUrl');
        expect(normalized.props['v-bind:alt']).toBe('altText');
      }
    });

    it('should resolve Vue built-in components', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'components/Teleport', props: JSON.stringify({ to: '#modal' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.component).toBe('Teleport');
      }
    });

    it('should return error on invalid props JSON', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'widgets/bad', props: '{{invalid' },
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
        { adapter: 'widgets/bad', props: '[1,2,3]' },
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
        { adapter: 'widgets/persist', props: JSON.stringify({ id: 'p' }) },
        storage,
      )();
      const stored = await storage.get('vueadapter', 'widgets/persist');
      expect(stored).not.toBeNull();
      expect(stored!.adapter).toBe('widgets/persist');
    });

    it('should return left on storage failure for persistence', async () => {
      const failOnPut: VueAdapterStorage = {
        get: async () => null,
        put: async () => { throw new Error('storage failure'); },
        delete: async () => false,
        find: async () => [],
      };
      const result = await handler.normalize(
        { adapter: 'widgets/fail', props: JSON.stringify({ id: 'x' }) },
        failOnPut,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
