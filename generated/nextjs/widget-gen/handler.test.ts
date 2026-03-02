// WidgetGen — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { widgetGenHandler } from './handler.js';
import type { WidgetGenStorage } from './types.js';

const createTestStorage = (): WidgetGenStorage => {
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

const createFailingStorage = (): WidgetGenStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = widgetGenHandler;

const VALID_AST = JSON.stringify({
  name: 'TestWidget',
  parts: [{ name: 'root', role: 'group' }, { name: 'label', role: 'text' }],
  props: ['title', 'disabled'],
});

describe('WidgetGen handler', () => {
  describe('generate', () => {
    it('should return error variant for unsupported target', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { gen: 'gen-1', target: 'flutter', widgetAst: VALID_AST },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('Unsupported target');
        }
      }
    });

    it('should return error variant for invalid JSON AST', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { gen: 'gen-1', target: 'react', widgetAst: 'not-json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('not valid JSON');
        }
      }
    });

    it('should generate React component code', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { gen: 'gen-1', target: 'react', widgetAst: VALID_AST },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.output).toContain('TestWidget');
          expect(result.right.output).toContain('React.FC');
          expect(result.right.output).toContain('data-widget');
        }
      }
    });

    it('should generate Vue SFC code', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { gen: 'gen-1', target: 'vue', widgetAst: VALID_AST },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.output).toContain('<template>');
        expect(result.right.output).toContain('script setup');
      }
    });

    it('should generate Svelte component code', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { gen: 'gen-1', target: 'svelte', widgetAst: VALID_AST },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.output).toContain('<script lang="ts">');
        expect(result.right.output).toContain('data-widget');
      }
    });

    it('should generate HTML code', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { gen: 'gen-1', target: 'html', widgetAst: VALID_AST },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.output).toContain('<div data-widget="TestWidget">');
        expect(result.right.output).toContain('data-part="root"');
        expect(result.right.output).toContain('data-part="label"');
      }
    });

    it('should include parts as data-part elements in React output', async () => {
      const storage = createTestStorage();
      const result = await handler.generate(
        { gen: 'gen-1', target: 'react', widgetAst: VALID_AST },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.output).toContain('data-part="root"');
        expect(result.right.output).toContain('data-part="label"');
      }
    });

    it('should cache generated output to storage', async () => {
      const storage = createTestStorage();
      await handler.generate(
        { gen: 'gen-1', target: 'react', widgetAst: VALID_AST },
        storage,
      )();
      const cached = await storage.get('widget_gen', 'gen-1::react');
      expect(cached).not.toBeNull();
      expect(cached!['target']).toBe('react');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.generate(
        { gen: 'gen-1', target: 'react', widgetAst: VALID_AST },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
