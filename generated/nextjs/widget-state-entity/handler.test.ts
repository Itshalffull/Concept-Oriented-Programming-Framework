// WidgetStateEntity — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { widgetStateEntityHandler } from './handler.js';
import type { WidgetStateEntityStorage } from './types.js';

const createTestStorage = (): WidgetStateEntityStorage => {
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

const createFailingStorage = (): WidgetStateEntityStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = widgetStateEntityHandler;

describe('WidgetStateEntity handler', () => {
  describe('register', () => {
    it('should register a widget state and return ok variant', async () => {
      const storage = createTestStorage();
      const result = await handler.register(
        { widget: 'Counter', name: 'idle', initial: 'true' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        expect(result.right.widgetState).toBe('Counter::idle');
      }
    });

    it('should persist state record to storage', async () => {
      const storage = createTestStorage();
      await handler.register(
        { widget: 'Counter', name: 'idle', initial: 'true' },
        storage,
      )();
      const record = await storage.get('widget_state', 'Counter::idle');
      expect(record).not.toBeNull();
      expect(record!['widget']).toBe('Counter');
      expect(record!['name']).toBe('idle');
      expect(record!['initial']).toBe('true');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.register(
        { widget: 'Counter', name: 'idle', initial: 'true' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('findByWidget', () => {
    it('should return empty list when no states registered', async () => {
      const storage = createTestStorage();
      const result = await handler.findByWidget(
        { widget: 'Counter' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const states = JSON.parse(result.right.states);
        expect(states).toEqual([]);
      }
    });

    it('should return registered states for a widget', async () => {
      const storage = createTestStorage();
      await handler.register({ widget: 'Counter', name: 'idle', initial: 'true' }, storage)();
      await handler.register({ widget: 'Counter', name: 'active', initial: 'false' }, storage)();
      const result = await handler.findByWidget({ widget: 'Counter' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const states = JSON.parse(result.right.states);
        expect(states.length).toBe(2);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.findByWidget({ widget: 'Counter' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('reachableFrom', () => {
    it('should return empty reachable set when state not found', async () => {
      const storage = createTestStorage();
      const result = await handler.reachableFrom(
        { widgetState: 'Counter::idle' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        const reachable = JSON.parse(result.right.reachable);
        expect(reachable).toEqual([]);
      }
    });

    it('should return empty reachable set when no transitions exist', async () => {
      const storage = createTestStorage();
      await handler.register({ widget: 'Counter', name: 'idle', initial: 'true' }, storage)();
      const result = await handler.reachableFrom(
        { widgetState: 'Counter::idle' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const reachable = JSON.parse(result.right.reachable);
        expect(reachable).toEqual([]);
      }
    });

    it('should compute reachable states through transitions', async () => {
      const storage = createTestStorage();
      await handler.register({ widget: 'Counter', name: 'idle', initial: 'true' }, storage)();
      await handler.register({ widget: 'Counter', name: 'active', initial: 'false' }, storage)();
      await storage.put('widget_transition', 't1', {
        widget: 'Counter',
        from: 'Counter::idle',
        to: 'Counter::active',
        event: 'start',
      });
      const result = await handler.reachableFrom(
        { widgetState: 'Counter::idle' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const reachable = JSON.parse(result.right.reachable);
        expect(reachable).toContain('Counter::active');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.reachableFrom(
        { widgetState: 'Counter::idle' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('unreachableStates', () => {
    it('should return all states as unreachable when no start state exists', async () => {
      const storage = createTestStorage();
      const result = await handler.unreachableStates(
        { widget: 'Counter' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const unreachable = JSON.parse(result.right.unreachable);
        expect(unreachable).toEqual([]);
      }
    });

    it('should detect unreachable states', async () => {
      const storage = createTestStorage();
      await handler.register({ widget: 'Counter', name: 'idle', initial: 'true' }, storage)();
      await handler.register({ widget: 'Counter', name: 'active', initial: 'false' }, storage)();
      await handler.register({ widget: 'Counter', name: 'orphan', initial: 'false' }, storage)();
      await storage.put('widget_transition', 't1', {
        widget: 'Counter',
        from: 'Counter::idle',
        to: 'Counter::active',
        event: 'start',
      });
      const result = await handler.unreachableStates({ widget: 'Counter' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const unreachable = JSON.parse(result.right.unreachable);
        expect(unreachable).toContain('Counter::orphan');
        expect(unreachable).not.toContain('Counter::idle');
        expect(unreachable).not.toContain('Counter::active');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.unreachableStates({ widget: 'Counter' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('traceEvent', () => {
    it('should return unhandled when event has no matching transitions', async () => {
      const storage = createTestStorage();
      await handler.register({ widget: 'Counter', name: 'idle', initial: 'true' }, storage)();
      const result = await handler.traceEvent(
        { widget: 'Counter', event: 'unknown' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unhandled');
      }
    });

    it('should return ok when event handled in all states', async () => {
      const storage = createTestStorage();
      await handler.register({ widget: 'W', name: 's1', initial: 'true' }, storage)();
      await storage.put('widget_transition', 't1', {
        widget: 'W',
        from: 'W::s1',
        to: 'W::s1',
        event: 'click',
      });
      const result = await handler.traceEvent(
        { widget: 'W', event: 'click' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const paths = JSON.parse(result.right.paths);
          expect(paths.length).toBe(1);
          expect(paths[0].event).toBe('click');
        }
      }
    });

    it('should return unhandled listing states that do not handle the event', async () => {
      const storage = createTestStorage();
      await handler.register({ widget: 'W', name: 's1', initial: 'true' }, storage)();
      await handler.register({ widget: 'W', name: 's2', initial: 'false' }, storage)();
      await storage.put('widget_transition', 't1', {
        widget: 'W',
        from: 'W::s1',
        to: 'W::s2',
        event: 'click',
      });
      const result = await handler.traceEvent(
        { widget: 'W', event: 'click' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unhandled');
        if (result.right.variant === 'unhandled') {
          const inStates = JSON.parse(result.right.inStates);
          expect(inStates).toContain('W::s2');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.traceEvent(
        { widget: 'W', event: 'click' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('get', () => {
    it('should return notfound when state does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.get(
        { widgetState: 'Counter::nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return ok with state details when it exists', async () => {
      const storage = createTestStorage();
      await handler.register({ widget: 'Counter', name: 'idle', initial: 'true' }, storage)();
      const result = await handler.get(
        { widgetState: 'Counter::idle' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.widgetState).toBe('Counter::idle');
          expect(result.right.widget).toBe('Counter');
          expect(result.right.name).toBe('idle');
          expect(result.right.initial).toBe('true');
          expect(result.right.transitionCount).toBe(0);
        }
      }
    });

    it('should count transitions from the state', async () => {
      const storage = createTestStorage();
      await handler.register({ widget: 'W', name: 's1', initial: 'true' }, storage)();
      await storage.put('widget_transition', 't1', {
        widget: 'W',
        from: 'W::s1',
        to: 'W::s2',
        event: 'click',
      });
      await storage.put('widget_transition', 't2', {
        widget: 'W',
        from: 'W::s1',
        to: 'W::s3',
        event: 'hover',
      });
      const result = await handler.get({ widgetState: 'W::s1' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        expect(result.right.transitionCount).toBe(2);
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.get(
        { widgetState: 'Counter::idle' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
