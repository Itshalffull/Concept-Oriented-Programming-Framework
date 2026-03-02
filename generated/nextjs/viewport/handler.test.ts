// Viewport — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { viewportHandler } from './handler.js';
import type { ViewportStorage } from './types.js';

const createTestStorage = (): ViewportStorage => {
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

const createFailingStorage = (): ViewportStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = viewportHandler;

describe('Viewport handler', () => {
  describe('observe', () => {
    it('should classify a wide viewport as landscape', async () => {
      const storage = createTestStorage();
      const result = await handler.observe(
        { viewport: 'main', width: 1440, height: 900 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.orientation).toBe('landscape');
      }
    });

    it('should classify a tall viewport as portrait', async () => {
      const storage = createTestStorage();
      const result = await handler.observe(
        { viewport: 'mobile', width: 375, height: 812 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.orientation).toBe('portrait');
      }
    });

    it('should classify a square viewport as square', async () => {
      const storage = createTestStorage();
      const result = await handler.observe(
        { viewport: 'square', width: 500, height: 500 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.orientation).toBe('square');
      }
    });

    it('should classify breakpoints using defaults', async () => {
      const storage = createTestStorage();

      // xs: width < 640
      const xsResult = await handler.observe(
        { viewport: 'v-xs', width: 320, height: 480 },
        storage,
      )();
      expect(E.isRight(xsResult)).toBe(true);
      if (E.isRight(xsResult)) {
        expect(xsResult.right.breakpoint).toBe('xs');
      }

      // md: width >= 768
      const mdResult = await handler.observe(
        { viewport: 'v-md', width: 800, height: 600 },
        storage,
      )();
      expect(E.isRight(mdResult)).toBe(true);
      if (E.isRight(mdResult)) {
        expect(mdResult.right.breakpoint).toBe('md');
      }

      // xl: width >= 1280
      const xlResult = await handler.observe(
        { viewport: 'v-xl', width: 1300, height: 800 },
        storage,
      )();
      expect(E.isRight(xlResult)).toBe(true);
      if (E.isRight(xlResult)) {
        expect(xlResult.right.breakpoint).toBe('xl');
      }
    });

    it('should persist observed state to storage', async () => {
      const storage = createTestStorage();
      await handler.observe(
        { viewport: 'persist-vp', width: 1024, height: 768 },
        storage,
      )();
      const stored = await storage.get('viewport', 'persist-vp');
      expect(stored).not.toBeNull();
      expect(stored!.width).toBe(1024);
      expect(stored!.height).toBe(768);
    });

    it('should use custom breakpoints when set', async () => {
      const storage = createTestStorage();
      await handler.setBreakpoints(
        {
          viewport: 'custom-bp',
          breakpoints: JSON.stringify({ small: 0, large: 1000 }),
        },
        storage,
      )();

      const result = await handler.observe(
        { viewport: 'custom-bp', width: 500, height: 300 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.breakpoint).toBe('small');
      }

      const result2 = await handler.observe(
        { viewport: 'custom-bp', width: 1200, height: 800 },
        storage,
      )();
      expect(E.isRight(result2)).toBe(true);
      if (E.isRight(result2)) {
        expect(result2.right.breakpoint).toBe('large');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.observe(
        { viewport: 'fail', width: 100, height: 100 },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('setBreakpoints', () => {
    it('should set valid breakpoints', async () => {
      const storage = createTestStorage();
      const result = await handler.setBreakpoints(
        {
          viewport: 'bp-test',
          breakpoints: JSON.stringify({ phone: 0, tablet: 768, desktop: 1024 }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return invalid for non-object breakpoints', async () => {
      const storage = createTestStorage();
      const result = await handler.setBreakpoints(
        { viewport: 'bp-bad', breakpoints: JSON.stringify([1, 2, 3]) },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for negative breakpoint values', async () => {
      const storage = createTestStorage();
      const result = await handler.setBreakpoints(
        {
          viewport: 'bp-neg',
          breakpoints: JSON.stringify({ bad: -10 }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for non-numeric breakpoint values', async () => {
      const storage = createTestStorage();
      const result = await handler.setBreakpoints(
        {
          viewport: 'bp-str',
          breakpoints: JSON.stringify({ bad: 'not-a-number' }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return left on malformed JSON', async () => {
      const storage = createTestStorage();
      const result = await handler.setBreakpoints(
        { viewport: 'bp-json', breakpoints: '{{bad json' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('PARSE_ERROR');
      }
    });
  });

  describe('getBreakpoint', () => {
    it('should return current breakpoint for an observed viewport', async () => {
      const storage = createTestStorage();
      await handler.observe(
        { viewport: 'get-bp', width: 1024, height: 768 },
        storage,
      )();
      const result = await handler.getBreakpoint(
        { viewport: 'get-bp' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.viewport).toBe('get-bp');
          expect(result.right.breakpoint).toBe('lg');
          expect(result.right.width).toBe(1024);
          expect(result.right.height).toBe(768);
        }
      }
    });

    it('should return notfound for unobserved viewport', async () => {
      const storage = createTestStorage();
      const result = await handler.getBreakpoint(
        { viewport: 'unobserved' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.getBreakpoint(
        { viewport: 'fail' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
