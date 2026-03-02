// TreeSitterWidgetSpec — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { treeSitterWidgetSpecHandler } from './handler.js';
import type { TreeSitterWidgetSpecStorage } from './types.js';

const createTestStorage = (): TreeSitterWidgetSpecStorage => {
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

const createFailingStorage = (): TreeSitterWidgetSpecStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = treeSitterWidgetSpecHandler;

describe('TreeSitterWidgetSpec handler', () => {
  describe('initialize', () => {
    it('should initialize and return an instance id', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('widget-spec-grammar-');
        }
      }
    });

    it('should persist grammar metadata with slot and inheritance support', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const instanceId = result.right.instance;
        const grammar = await storage.get('grammars', instanceId);
        expect(grammar).not.toBeNull();
        expect(grammar?.language).toBe('widget-spec');
        expect(grammar?.supportsSlots).toBe(true);
        expect(grammar?.supportsInheritance).toBe(true);
        expect(grammar?.supportsConditionalRender).toBe(true);
      }
    });

    it('should categorize widget nodes by domain', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const instanceId = result.right.instance;

        const propsBlock = await storage.get('node_types', `${instanceId}:props_block`);
        expect(propsBlock?.category).toBe('props');

        const slotDecl = await storage.get('node_types', `${instanceId}:slot_declaration`);
        expect(slotDecl?.category).toBe('slots');

        const stateDecl = await storage.get('node_types', `${instanceId}:state_declaration`);
        expect(stateDecl?.category).toBe('state');

        const eventDecl = await storage.get('node_types', `${instanceId}:event_declaration`);
        expect(eventDecl?.category).toBe('events');

        const renderBlock = await storage.get('node_types', `${instanceId}:render_block`);
        expect(renderBlock?.category).toBe('render');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isLeft(result)).toBe(true);
      if (E.isLeft(result)) {
        expect(result.left.code).toBe('STORAGE_ERROR');
      }
    });
  });
});
