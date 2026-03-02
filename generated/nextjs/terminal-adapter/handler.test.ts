// TerminalAdapter — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { terminalAdapterHandler } from './handler.js';
import type { TerminalAdapterStorage } from './types.js';

const createTestStorage = (): TerminalAdapterStorage => {
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

const createFailingStorage = (): TerminalAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('TerminalAdapter handler', () => {
  describe('normalize', () => {
    it('should normalize valid props with color mappings', async () => {
      const storage = createTestStorage();
      const props = JSON.stringify({ color: 'red', bold: true, width: 40 });

      const result = await terminalAdapterHandler.normalize(
        { adapter: 'tui/Text', props },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.widget).toBe('Text');
          expect(normalized.platform).toBe('terminal');
          expect(normalized.props.style.fg).toBe('red');
          expect(normalized.props.style.bold).toBe(true);
          expect(normalized.props.width).toBe(40);
        }
      }
    });

    it('should resolve unknown widget names to Box', async () => {
      const storage = createTestStorage();
      const props = JSON.stringify({ padding: 2 });

      const result = await terminalAdapterHandler.normalize(
        { adapter: 'tui/UnknownWidget', props },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.widget).toBe('Box');
        }
      }
    });

    it('should return error for invalid JSON props', async () => {
      const storage = createTestStorage();

      const result = await terminalAdapterHandler.normalize(
        { adapter: 'tui/Box', props: 'not-json{' },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should clamp width to default columns', async () => {
      const storage = createTestStorage();
      const props = JSON.stringify({ width: 200 });

      const result = await terminalAdapterHandler.normalize(
        { adapter: 'tui/Box', props },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.props.width).toBe(80);
        }
      }
    });

    it('should handle border style mapping', async () => {
      const storage = createTestStorage();
      const props = JSON.stringify({ border: 'double' });

      const result = await terminalAdapterHandler.normalize(
        { adapter: 'tui/Box', props },
        storage,
      )();

      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.props.border).toBe('double');
        }
      }
    });

    it('should return left on storage failure during put', async () => {
      const failOnPut: TerminalAdapterStorage = {
        get: async () => null,
        put: async () => { throw new Error('storage failure'); },
        delete: async () => false,
        find: async () => [],
      };

      const result = await terminalAdapterHandler.normalize(
        { adapter: 'tui/Box', props: JSON.stringify({ padding: 1 }) },
        failOnPut,
      )();

      expect(E.isLeft(result)).toBe(true);
    });
  });
});
