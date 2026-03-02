// Machine — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { machineHandler } from './handler.js';
import type { MachineStorage } from './types.js';

const createTestStorage = (): MachineStorage => {
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

const createFailingStorage = (): MachineStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = machineHandler;

const VALID_DEFINITION = JSON.stringify({
  initial: 'idle',
  states: {
    idle: { on: { START: { target: 'running' } } },
    running: { on: { STOP: { target: 'idle' }, PAUSE: { target: 'paused' } } },
    paused: { on: { RESUME: { target: 'running' } } },
  },
});

const GUARDED_DEFINITION = JSON.stringify({
  initial: 'locked',
  states: {
    locked: { on: { UNLOCK: { target: 'unlocked', guard: 'isAuthenticated' } } },
    unlocked: { on: { LOCK: { target: 'locked' } } },
  },
});

describe('Machine handler', () => {
  describe('spawn', () => {
    it('should spawn a machine with valid definition and existing widget', async () => {
      const storage = createTestStorage();
      await storage.put('widgets', 'my-widget', { id: 'my-widget' });
      const result = await handler.spawn(
        { machine: 'fsm-1', widget: 'my-widget', context: VALID_DEFINITION },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.machine).toBe('fsm-1');
        }
      }
    });

    it('should return notfound when widget does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.spawn(
        { machine: 'fsm-2', widget: 'missing-widget', context: VALID_DEFINITION },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return invalid for malformed JSON context', async () => {
      const storage = createTestStorage();
      const result = await handler.spawn(
        { machine: 'fsm-3', widget: 'w', context: 'not json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid when initial state not in states', async () => {
      const storage = createTestStorage();
      const result = await handler.spawn(
        {
          machine: 'fsm-4',
          widget: 'w',
          context: JSON.stringify({ initial: 'missing', states: { idle: {} } }),
        },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });
  });

  describe('send', () => {
    it('should transition to a new state on valid event', async () => {
      const storage = createTestStorage();
      await storage.put('widgets', 'w1', { id: 'w1' });
      await handler.spawn(
        { machine: 'send-fsm', widget: 'w1', context: VALID_DEFINITION },
        storage,
      )();
      const result = await handler.send(
        { machine: 'send-fsm', event: 'START' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.state).toBe('running');
        }
      }
    });

    it('should return invalid for unknown event', async () => {
      const storage = createTestStorage();
      await storage.put('widgets', 'w2', { id: 'w2' });
      await handler.spawn(
        { machine: 'event-fsm', widget: 'w2', context: VALID_DEFINITION },
        storage,
      )();
      const result = await handler.send(
        { machine: 'event-fsm', event: 'UNKNOWN_EVENT' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return guarded when transition has a guard', async () => {
      const storage = createTestStorage();
      await storage.put('widgets', 'w3', { id: 'w3' });
      await handler.spawn(
        { machine: 'guard-fsm', widget: 'w3', context: GUARDED_DEFINITION },
        storage,
      )();
      const result = await handler.send(
        { machine: 'guard-fsm', event: 'UNLOCK' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('guarded');
        if (result.right.variant === 'guarded') {
          expect(result.right.guard).toBe('isAuthenticated');
        }
      }
    });

    it('should return invalid for non-existent machine', async () => {
      const storage = createTestStorage();
      const result = await handler.send(
        { machine: 'nope', event: 'START' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });
  });

  describe('connect', () => {
    it('should return machine props with current state and available events', async () => {
      const storage = createTestStorage();
      await storage.put('widgets', 'wc', { id: 'wc' });
      await handler.spawn(
        { machine: 'conn-fsm', widget: 'wc', context: VALID_DEFINITION },
        storage,
      )();
      const result = await handler.connect({ machine: 'conn-fsm' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const props = JSON.parse(result.right.props);
          expect(props.currentState).toBe('idle');
          expect(props.availableEvents).toContain('START');
        }
      }
    });

    it('should return notfound for missing machine', async () => {
      const storage = createTestStorage();
      const result = await handler.connect({ machine: 'nope' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('destroy', () => {
    it('should destroy an existing machine', async () => {
      const storage = createTestStorage();
      await storage.put('widgets', 'wd', { id: 'wd' });
      await handler.spawn(
        { machine: 'del-fsm', widget: 'wd', context: VALID_DEFINITION },
        storage,
      )();
      const result = await handler.destroy({ machine: 'del-fsm' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for missing machine', async () => {
      const storage = createTestStorage();
      const result = await handler.destroy({ machine: 'nope' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.destroy({ machine: 'any' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
