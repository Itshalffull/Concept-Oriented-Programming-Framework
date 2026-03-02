// Workflow — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { workflowHandler } from './handler.js';
import type { WorkflowStorage } from './types.js';

const createTestStorage = (): WorkflowStorage => {
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

const createFailingStorage = (): WorkflowStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = workflowHandler;

describe('Workflow handler', () => {
  describe('defineState', () => {
    it('should define a new state successfully', async () => {
      const storage = createTestStorage();
      const result = await handler.defineState(
        { workflow: 'order', name: 'pending', flags: 'initial' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should persist state to storage', async () => {
      const storage = createTestStorage();
      await handler.defineState(
        { workflow: 'order', name: 'pending', flags: 'initial' },
        storage,
      )();
      const record = await storage.get('workflow_states', 'order::state::pending');
      expect(record).not.toBeNull();
      expect(record!['workflow']).toBe('order');
      expect(record!['name']).toBe('pending');
      expect(record!['flags']).toBe('initial');
    });

    it('should return exists variant for duplicate state', async () => {
      const storage = createTestStorage();
      await handler.defineState(
        { workflow: 'order', name: 'pending', flags: 'initial' },
        storage,
      )();
      const result = await handler.defineState(
        { workflow: 'order', name: 'pending', flags: 'initial' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('exists');
        if (result.right.variant === 'exists') {
          expect(result.right.message).toContain('pending');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.defineState(
        { workflow: 'order', name: 'pending', flags: '' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('defineTransition', () => {
    it('should define a transition between existing states', async () => {
      const storage = createTestStorage();
      await handler.defineState({ workflow: 'order', name: 'pending', flags: 'initial' }, storage)();
      await handler.defineState({ workflow: 'order', name: 'confirmed', flags: '' }, storage)();
      const result = await handler.defineTransition(
        { workflow: 'order', from: 'pending', to: 'confirmed', label: 'confirm', guard: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return error when source state does not exist', async () => {
      const storage = createTestStorage();
      await handler.defineState({ workflow: 'order', name: 'confirmed', flags: '' }, storage)();
      const result = await handler.defineTransition(
        { workflow: 'order', from: 'nonexistent', to: 'confirmed', label: 'start', guard: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('nonexistent');
          expect(result.right.message).toContain('Source state');
        }
      }
    });

    it('should return error when target state does not exist', async () => {
      const storage = createTestStorage();
      await handler.defineState({ workflow: 'order', name: 'pending', flags: 'initial' }, storage)();
      const result = await handler.defineTransition(
        { workflow: 'order', from: 'pending', to: 'nonexistent', label: 'start', guard: '' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
        if (result.right.variant === 'error') {
          expect(result.right.message).toContain('nonexistent');
          expect(result.right.message).toContain('Target state');
        }
      }
    });

    it('should persist transition to storage', async () => {
      const storage = createTestStorage();
      await handler.defineState({ workflow: 'order', name: 'pending', flags: '' }, storage)();
      await handler.defineState({ workflow: 'order', name: 'shipped', flags: '' }, storage)();
      await handler.defineTransition(
        { workflow: 'order', from: 'pending', to: 'shipped', label: 'ship', guard: 'hasPaid' },
        storage,
      )();
      const record = await storage.get('workflow_transitions', 'order::transition::ship');
      expect(record).not.toBeNull();
      expect(record!['from']).toBe('pending');
      expect(record!['to']).toBe('shipped');
      expect(record!['guard']).toBe('hasPaid');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.defineTransition(
        { workflow: 'order', from: 'a', to: 'b', label: 'x', guard: '' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('transition', () => {
    it('should return notfound when transition does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.transition(
        { workflow: 'order', entity: 'order-1', transition: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should execute transition and move entity to new state', async () => {
      const storage = createTestStorage();
      await handler.defineState({ workflow: 'order', name: 'pending', flags: '' }, storage)();
      await handler.defineState({ workflow: 'order', name: 'confirmed', flags: '' }, storage)();
      await handler.defineTransition(
        { workflow: 'order', from: 'pending', to: 'confirmed', label: 'confirm', guard: '' },
        storage,
      )();
      // Set entity to pending state
      await storage.put('workflow_entities', 'order::entity::order-1', {
        workflow: 'order',
        entity: 'order-1',
        currentState: 'pending',
        historyVersion: 0,
      });
      const result = await handler.transition(
        { workflow: 'order', entity: 'order-1', transition: 'confirm' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.newState).toBe('confirmed');
        }
      }
    });

    it('should return forbidden when entity is in wrong state', async () => {
      const storage = createTestStorage();
      await handler.defineState({ workflow: 'order', name: 'pending', flags: '' }, storage)();
      await handler.defineState({ workflow: 'order', name: 'confirmed', flags: '' }, storage)();
      await handler.defineTransition(
        { workflow: 'order', from: 'pending', to: 'confirmed', label: 'confirm', guard: '' },
        storage,
      )();
      await storage.put('workflow_entities', 'order::entity::order-1', {
        workflow: 'order',
        entity: 'order-1',
        currentState: 'confirmed',
        historyVersion: 0,
      });
      const result = await handler.transition(
        { workflow: 'order', entity: 'order-1', transition: 'confirm' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('forbidden');
      }
    });

    it('should record transition history', async () => {
      const storage = createTestStorage();
      await handler.defineState({ workflow: 'order', name: 'pending', flags: '' }, storage)();
      await handler.defineState({ workflow: 'order', name: 'confirmed', flags: '' }, storage)();
      await handler.defineTransition(
        { workflow: 'order', from: 'pending', to: 'confirmed', label: 'confirm', guard: '' },
        storage,
      )();
      await storage.put('workflow_entities', 'order::entity::order-1', {
        workflow: 'order',
        entity: 'order-1',
        currentState: 'pending',
        historyVersion: 0,
      });
      await handler.transition(
        { workflow: 'order', entity: 'order-1', transition: 'confirm' },
        storage,
      )();
      const history = await storage.get('workflow_history', 'order::order-1::1');
      expect(history).not.toBeNull();
      expect(history!['from']).toBe('pending');
      expect(history!['to']).toBe('confirmed');
      expect(history!['transition']).toBe('confirm');
    });

    it('should update entity record with new state', async () => {
      const storage = createTestStorage();
      await handler.defineState({ workflow: 'order', name: 'pending', flags: '' }, storage)();
      await handler.defineState({ workflow: 'order', name: 'confirmed', flags: '' }, storage)();
      await handler.defineTransition(
        { workflow: 'order', from: 'pending', to: 'confirmed', label: 'confirm', guard: '' },
        storage,
      )();
      await storage.put('workflow_entities', 'order::entity::order-1', {
        workflow: 'order',
        entity: 'order-1',
        currentState: 'pending',
        historyVersion: 0,
      });
      await handler.transition(
        { workflow: 'order', entity: 'order-1', transition: 'confirm' },
        storage,
      )();
      const entity = await storage.get('workflow_entities', 'order::entity::order-1');
      expect(entity).not.toBeNull();
      expect(entity!['currentState']).toBe('confirmed');
      expect(entity!['previousState']).toBe('pending');
      expect(entity!['lastTransition']).toBe('confirm');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.transition(
        { workflow: 'order', entity: 'order-1', transition: 'confirm' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('getCurrentState', () => {
    it('should return notfound when entity does not exist', async () => {
      const storage = createTestStorage();
      const result = await handler.getCurrentState(
        { workflow: 'order', entity: 'nonexistent' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return current state of an entity', async () => {
      const storage = createTestStorage();
      await storage.put('workflow_entities', 'order::entity::order-1', {
        workflow: 'order',
        entity: 'order-1',
        currentState: 'pending',
      });
      const result = await handler.getCurrentState(
        { workflow: 'order', entity: 'order-1' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.state).toBe('pending');
        }
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.getCurrentState(
        { workflow: 'order', entity: 'order-1' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
