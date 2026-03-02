// WidgetParser — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { widgetParserHandler } from './handler.js';
import type { WidgetParserStorage } from './types.js';

const createTestStorage = (): WidgetParserStorage => {
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

const createFailingStorage = (): WidgetParserStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = widgetParserHandler;

const validSource = JSON.stringify({
  name: 'MyWidget',
  parts: [{ name: 'root' }, { name: 'label' }],
  props: ['title'],
  states: ['active'],
  events: ['click'],
});

describe('WidgetParser handler', () => {
  describe('parse', () => {
    it('should return error variant for invalid JSON source', async () => {
      const storage = createTestStorage();
      const result = await handler.parse(
        { widget: 'MyWidget', source: 'not-valid-json{' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.errors.length).toBeGreaterThan(0);
          expect(result.right.errors[0]).toContain('Syntax error');
        }
      }
    });

    it('should return error variant when required fields are missing', async () => {
      const storage = createTestStorage();
      const result = await handler.parse(
        { widget: 'MyWidget', source: '{"other":"thing"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          const hasNameError = result.right.errors.some(e => e.includes("'name'"));
          const hasPartsError = result.right.errors.some(e => e.includes("'parts'"));
          expect(hasNameError).toBe(true);
          expect(hasPartsError).toBe(true);
        }
      }
    });

    it('should return error variant for widget name mismatch', async () => {
      const storage = createTestStorage();
      const source = JSON.stringify({ name: 'Wrong', parts: [{ name: 'r' }] });
      const result = await handler.parse(
        { widget: 'MyWidget', source },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          const hasMismatch = result.right.errors.some(e => e.includes('mismatch'));
          expect(hasMismatch).toBe(true);
        }
      }
    });

    it('should return error variant when parts is not an array', async () => {
      const storage = createTestStorage();
      const source = JSON.stringify({ name: 'MyWidget', parts: 'notarray' });
      const result = await handler.parse(
        { widget: 'MyWidget', source },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error when a part is missing name', async () => {
      const storage = createTestStorage();
      const source = JSON.stringify({ name: 'MyWidget', parts: [{ role: 'div' }] });
      const result = await handler.parse(
        { widget: 'MyWidget', source },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.errors.some(e => e.includes("missing required 'name'"))).toBe(true);
        }
      }
    });

    it('should successfully parse valid widget source', async () => {
      const storage = createTestStorage();
      const result = await handler.parse(
        { widget: 'MyWidget', source: validSource },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.widget).toBe('MyWidget');
          const ast = JSON.parse(result.right.ast);
          expect(ast.name).toBe('MyWidget');
          expect(ast.parts.length).toBe(2);
          expect(ast.props).toEqual(['title']);
        }
      }
    });

    it('should persist parsed AST to storage', async () => {
      const storage = createTestStorage();
      await handler.parse(
        { widget: 'MyWidget', source: validSource },
        storage,
      )();
      const record = await storage.get('widget_ast', 'MyWidget');
      expect(record).not.toBeNull();
      expect(record!['widget']).toBe('MyWidget');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.parse(
        { widget: 'MyWidget', source: validSource },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('validate', () => {
    it('should return incomplete when widget has not been parsed', async () => {
      const storage = createTestStorage();
      const result = await handler.validate(
        { widget: 'NeverParsed' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incomplete');
        if (result.right.variant === 'incomplete') {
          expect(result.right.warnings.some(w => w.includes('not been parsed'))).toBe(true);
        }
      }
    });

    it('should return ok when widget has parts, props, and states', async () => {
      const storage = createTestStorage();
      await handler.parse(
        { widget: 'MyWidget', source: validSource },
        storage,
      )();
      const result = await handler.validate({ widget: 'MyWidget' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return incomplete when widget has no props', async () => {
      const storage = createTestStorage();
      const src = JSON.stringify({
        name: 'Bare',
        parts: [{ name: 'root' }],
        states: ['idle'],
      });
      await handler.parse({ widget: 'Bare', source: src }, storage)();
      const result = await handler.validate({ widget: 'Bare' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incomplete');
        if (result.right.variant === 'incomplete') {
          expect(result.right.warnings.some(w => w.includes('no props'))).toBe(true);
        }
      }
    });

    it('should return incomplete when widget has no states', async () => {
      const storage = createTestStorage();
      const src = JSON.stringify({
        name: 'NoState',
        parts: [{ name: 'root' }],
        props: ['title'],
      });
      await handler.parse({ widget: 'NoState', source: src }, storage)();
      const result = await handler.validate({ widget: 'NoState' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incomplete');
        if (result.right.variant === 'incomplete') {
          expect(result.right.warnings.some(w => w.includes('no states'))).toBe(true);
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.validate({ widget: 'MyWidget' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
