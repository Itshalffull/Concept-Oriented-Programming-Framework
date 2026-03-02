// ActionGuide — handler.test.ts
// Unit tests for actionGuide handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { actionGuideHandler } from './handler.js';
import type { ActionGuideStorage } from './types.js';

const createTestStorage = (): ActionGuideStorage => {
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

const createFailingStorage = (): ActionGuideStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('ActionGuide handler', () => {
  describe('define', () => {
    it('defines successfully with valid input', async () => {
      const storage = createTestStorage();
      const result = await actionGuideHandler.define(
        { concept: 'user-profile', steps: ['Step 1', 'Step 2'], content: 'Guide content' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.workflow).toBe('guide:user-profile');
          expect(result.right.stepCount).toBe(2);
        }
      }
    });

    it('returns invalidAction for bad concept name', async () => {
      const storage = createTestStorage();
      const result = await actionGuideHandler.define(
        { concept: 'INVALID NAME!', steps: ['Step 1'], content: 'Content' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalidAction');
      }
    });

    it('returns emptySteps when steps array is empty', async () => {
      const storage = createTestStorage();
      const result = await actionGuideHandler.define(
        { concept: 'valid-concept', steps: [], content: 'Content' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('emptySteps');
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await actionGuideHandler.define(
        { concept: 'test-concept', steps: ['Step 1'], content: 'Content' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('render', () => {
    it('renders markdown format after define', async () => {
      const storage = createTestStorage();
      await actionGuideHandler.define(
        { concept: 'my-guide', steps: ['First', 'Second'], content: 'Description' },
        storage,
      )();
      const result = await actionGuideHandler.render(
        { workflow: 'guide:my-guide', format: 'markdown' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.content).toContain('# Action Guide');
        }
      }
    });

    it('renders text format after define', async () => {
      const storage = createTestStorage();
      await actionGuideHandler.define(
        { concept: 'my-guide', steps: ['First'], content: 'Description' },
        storage,
      )();
      const result = await actionGuideHandler.render(
        { workflow: 'guide:my-guide', format: 'text' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.content).toContain('Action Guide');
        }
      }
    });

    it('returns unknownFormat for unsupported format', async () => {
      const storage = createTestStorage();
      const result = await actionGuideHandler.render(
        { workflow: 'guide:test', format: 'pdf' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unknownFormat');
        if (result.right.variant === 'unknownFormat') {
          expect(result.right.format).toBe('pdf');
        }
      }
    });

    it('returns ok with stub message for missing workflow', async () => {
      const storage = createTestStorage();
      const result = await actionGuideHandler.render(
        { workflow: 'guide:nonexistent', format: 'markdown' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.content).toContain('No guide found');
        }
      }
    });

    it('propagates storage errors', async () => {
      const storage = createFailingStorage();
      const result = await actionGuideHandler.render(
        { workflow: 'guide:test', format: 'markdown' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
