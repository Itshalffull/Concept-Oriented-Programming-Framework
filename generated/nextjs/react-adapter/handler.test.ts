// ReactAdapter — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { reactAdapterHandler } from './handler.js';
import type { ReactAdapterStorage } from './types.js';

const createTestStorage = (): ReactAdapterStorage => {
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

const createFailingStorage = (): ReactAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = reactAdapterHandler;

describe('ReactAdapter handler', () => {
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

    it('should normalize HTML attributes to React equivalents', async () => {
      const storage = createTestStorage();
      const props = { class: 'btn', for: 'input-1', tabindex: 3 };
      const result = await handler.normalize(
        { adapter: 'widgets/Button', props: JSON.stringify(props) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.props.className).toBe('btn');
          expect(normalized.props.htmlFor).toBe('input-1');
          expect(normalized.props.tabIndex).toBe(3);
        }
      }
    });

    it('should extract CSS-like props into a style object', async () => {
      const storage = createTestStorage();
      const props = { 'background-color': 'red', 'font-size': '14px', label: 'test' };
      const result = await handler.normalize(
        { adapter: 'widgets/div', props: JSON.stringify(props) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.props.style.backgroundColor).toBe('red');
        expect(normalized.props.style.fontSize).toBe('14px');
        expect(normalized.props.label).toBe('test');
      }
    });

    it('should detect event handlers', async () => {
      const storage = createTestStorage();
      const props = { onClick: 'handler', onChange: 'handler', label: 'btn' };
      const result = await handler.normalize(
        { adapter: 'Input', props: JSON.stringify(props) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.events).toContain('onClick');
        expect(normalized.events).toContain('onChange');
      }
    });

    it('should identify controlled components', async () => {
      const storage = createTestStorage();
      const props = { onChange: 'handler', value: 'current' };
      const result = await handler.normalize(
        { adapter: 'Input', props: JSON.stringify(props) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.controlled).toBe(true);
      }
    });

    it('should resolve component name from adapter path', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'ui/forms/TextInput', props: JSON.stringify({ placeholder: 'type' }) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.component).toBe('TextInput');
        expect(normalized.platform).toBe('react');
      }
    });

    it('should detect hooks', async () => {
      const storage = createTestStorage();
      const props = { useState: true, useEffect: true, title: 'widget' };
      const result = await handler.normalize(
        { adapter: 'Widget', props: JSON.stringify(props) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.hooks).toContain('useState');
        expect(normalized.hooks).toContain('useEffect');
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
