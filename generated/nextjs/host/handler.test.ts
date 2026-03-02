// Host — handler.test.ts
// Unit tests for host handler actions.

import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { hostHandler } from './handler.js';
import type { HostStorage } from './types.js';

const createTestStorage = (): HostStorage => {
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

const createFailingStorage = (): HostStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

describe('Host handler', () => {
  describe('mount', () => {
    it('should successfully mount a new host', async () => {
      const storage = createTestStorage();
      const input = {
        host: 'host-1',
        concept: 'user',
        view: 'list',
        level: 0,
        zone: O.some('primary'),
      };

      const result = await hostHandler.mount(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.host).toBe('host-1');
        }
      }
    });

    it('should mount with default zone when None is given', async () => {
      const storage = createTestStorage();
      const input = {
        host: 'host-2',
        concept: 'order',
        view: 'detail',
        level: 1,
        zone: O.none,
      };

      const result = await hostHandler.mount(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return invalid for negative mount level', async () => {
      const storage = createTestStorage();
      const input = {
        host: 'host-3',
        concept: 'user',
        view: 'list',
        level: -1,
        zone: O.none,
      };

      const result = await hostHandler.mount(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for duplicate mount', async () => {
      const storage = createTestStorage();
      const input = {
        host: 'host-dup',
        concept: 'user',
        view: 'list',
        level: 0,
        zone: O.none,
      };

      await hostHandler.mount(input, storage)();
      const result = await hostHandler.mount(input, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const input = { host: 'h', concept: 'c', view: 'v', level: 0, zone: O.none };
      const result = await hostHandler.mount(input, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });

  describe('ready', () => {
    it('should mark a mounted host as ready', async () => {
      const storage = createTestStorage();
      await hostHandler.mount({
        host: 'rdy', concept: 'c', view: 'v', level: 0, zone: O.none,
      }, storage)();

      const result = await hostHandler.ready({ host: 'rdy' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return invalid for unmounted host', async () => {
      const storage = createTestStorage();
      const result = await hostHandler.ready({ host: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });

    it('should return invalid for host in error state', async () => {
      const storage = createTestStorage();
      await hostHandler.mount({
        host: 'err-host', concept: 'c', view: 'v', level: 0, zone: O.none,
      }, storage)();
      await hostHandler.setError({ host: 'err-host', errorInfo: 'bad' }, storage)();

      const result = await hostHandler.ready({ host: 'err-host' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });
  });

  describe('trackResource', () => {
    it('should track a resource for an existing host', async () => {
      const storage = createTestStorage();
      await hostHandler.mount({
        host: 'tr-host', concept: 'c', view: 'v', level: 0, zone: O.none,
      }, storage)();

      const result = await hostHandler.trackResource({
        host: 'tr-host', kind: 'socket', ref: 'ws://localhost:3000',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for missing host', async () => {
      const storage = createTestStorage();
      const result = await hostHandler.trackResource({
        host: 'no-host', kind: 'socket', ref: 'ws://x',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('unmount', () => {
    it('should unmount an existing host', async () => {
      const storage = createTestStorage();
      await hostHandler.mount({
        host: 'un-host', concept: 'c', view: 'v', level: 0, zone: O.none,
      }, storage)();

      const result = await hostHandler.unmount({ host: 'un-host' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.host).toBe('un-host');
        }
      }
    });

    it('should return notfound for missing host', async () => {
      const storage = createTestStorage();
      const result = await hostHandler.unmount({ host: 'gone' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('refresh', () => {
    it('should refresh an existing host', async () => {
      const storage = createTestStorage();
      await hostHandler.mount({
        host: 'ref-host', concept: 'c', view: 'v', level: 0, zone: O.none,
      }, storage)();

      const result = await hostHandler.refresh({ host: 'ref-host' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for missing host', async () => {
      const storage = createTestStorage();
      const result = await hostHandler.refresh({ host: 'no' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return invalid for host in error state', async () => {
      const storage = createTestStorage();
      await hostHandler.mount({
        host: 'err-ref', concept: 'c', view: 'v', level: 0, zone: O.none,
      }, storage)();
      await hostHandler.setError({ host: 'err-ref', errorInfo: 'crash' }, storage)();

      const result = await hostHandler.refresh({ host: 'err-ref' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('invalid');
      }
    });
  });

  describe('setError', () => {
    it('should set error state on an existing host', async () => {
      const storage = createTestStorage();
      await hostHandler.mount({
        host: 'se-host', concept: 'c', view: 'v', level: 0, zone: O.none,
      }, storage)();

      const result = await hostHandler.setError({
        host: 'se-host', errorInfo: 'something broke',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for missing host', async () => {
      const storage = createTestStorage();
      const result = await hostHandler.setError({
        host: 'missing', errorInfo: 'err',
      }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });
});
