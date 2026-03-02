// NextjsAdapter — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { nextjsAdapterHandler } from './handler.js';
import type { NextjsAdapterStorage } from './types.js';

const createTestStorage = (): NextjsAdapterStorage => {
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

const createFailingStorage = (): NextjsAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = nextjsAdapterHandler;

describe('NextjsAdapter handler', () => {
  describe('normalize', () => {
    it('should normalize a server component with static rendering', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'div',
          props: JSON.stringify({ className: 'container' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.platform).toBe('nextjs');
          expect(normalized.directive).toBe('use server');
          expect(normalized.renderStrategy).toBe('static');
          expect(normalized.appRouter).toBe(true);
        }
      }
    });

    it('should apply use client directive for interactive components', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'Button',
          props: JSON.stringify({ label: 'Click me' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.directive).toBe('use client');
        expect(normalized.renderStrategy).toBe('client');
      }
    });

    it('should apply use client for components with event handler props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'div',
          props: JSON.stringify({ onClick: 'handleClick' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.directive).toBe('use client');
        expect(normalized.renderStrategy).toBe('client');
      }
    });

    it('should optimize img to Next.js Image component', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'img',
          props: JSON.stringify({ src: '/photo.jpg', alt: 'Photo' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.component).toBe('Image');
        expect(normalized.props.loading).toBe('lazy');
        expect(normalized.props.width).toBeDefined();
        expect(normalized.props.height).toBeDefined();
      }
    });

    it('should optimize link to Next.js Link component', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'a',
          props: JSON.stringify({ href: '/about' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.component).toBe('Link');
        expect(normalized.props.prefetch).toBe(true);
      }
    });

    it('should detect ISR rendering strategy', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'div',
          props: JSON.stringify({ revalidate: 60 }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.renderStrategy).toBe('isr');
      }
    });

    it('should detect SSR rendering strategy', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'div',
          props: JSON.stringify({ ssr: true }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.renderStrategy).toBe('ssr');
      }
    });

    it('should return error for invalid JSON props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'div', props: 'not json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error for non-object JSON props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'div', props: JSON.stringify([1, 2, 3]) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return left on storage failure during persistence', async () => {
      const storage = createFailingStorage();
      const result = await handler.normalize(
        { adapter: 'div', props: JSON.stringify({ width: 100 }) },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });

    it('should pass through unknown component names', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        {
          adapter: 'CustomCard',
          props: JSON.stringify({ title: 'Hello' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.component).toBe('CustomCard');
      }
    });
  });
});
