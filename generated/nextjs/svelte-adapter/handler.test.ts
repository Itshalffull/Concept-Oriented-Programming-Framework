// SvelteAdapter — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { svelteAdapterHandler } from './handler.js';
import type { SvelteAdapterStorage } from './types.js';

const createTestStorage = (): SvelteAdapterStorage => {
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

const createFailingStorage = (): SvelteAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = svelteAdapterHandler;

describe('SvelteAdapter handler', () => {
  describe('normalize', () => {
    it('should normalize basic props to Svelte representation', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'Button', props: JSON.stringify({ label: 'Click me' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.adapter).toBe('Button');
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.platform).toBe('svelte');
          expect(normalized.component).toBe('Button');
        }
      }
    });

    it('should map React-style event handlers to Svelte on: directives', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'Button', props: JSON.stringify({ onClick: 'handleClick', onChange: 'handleChange' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.props['on:click']).toBe('handleClick');
          expect(normalized.props['on:change']).toBe('handleChange');
          expect(normalized.events).toContain('on:click');
          expect(normalized.events).toContain('on:change');
        }
      }
    });

    it('should map bindable props to bind: directives', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'Input', props: JSON.stringify({ value: 'hello', checked: true }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.props['bind:value']).toBe('hello');
          expect(normalized.props['bind:checked']).toBe(true);
          expect(normalized.bindings).toContain('value');
          expect(normalized.bindings).toContain('checked');
        }
      }
    });

    it('should detect transition directives', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'Div', props: JSON.stringify({ transition: 'fade' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.transitions).toContain('fade');
        }
      }
    });

    it('should handle in/out transition directives', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'Div', props: JSON.stringify({ in: 'fly', out: 'slide' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.transitions).toContain('in:fly');
          expect(normalized.transitions).toContain('out:slide');
        }
      }
    });

    it('should map className to class', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'Div', props: JSON.stringify({ className: 'my-class' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.props['class']).toBe('my-class');
        }
      }
    });

    it('should recognize Svelte special elements', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'svelte:component', props: JSON.stringify({ this: 'MyComp' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.specialElement).toBe(true);
        }
      }
    });

    it('should return error for invalid JSON props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'Button', props: 'not-valid-json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for array props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'Button', props: '[1,2,3]' },
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
        { adapter: 'Button', props: JSON.stringify({ label: 'ok' }) },
        storage,
      )();
      const stored = await storage.get('svelteadapter', 'Button');
      expect(stored).not.toBeNull();
      expect(stored?.adapter).toBe('Button');
    });

    it('should return Left on storage failure during put', async () => {
      const storage = createFailingStorage();
      const result = await handler.normalize(
        { adapter: 'Button', props: JSON.stringify({ label: 'ok' }) },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
