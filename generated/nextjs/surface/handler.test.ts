// Surface — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import { surfaceHandler } from './handler.js';
import type { SurfaceStorage } from './types.js';

const createTestStorage = (): SurfaceStorage => {
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

const createFailingStorage = (): SurfaceStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = surfaceHandler;

describe('Surface handler', () => {
  describe('create', () => {
    it('should create a dom surface', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { surface: 'main', kind: 'dom', mountPoint: O.some('#app') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.surface).toBe('main');
        }
      }
    });

    it('should create a canvas surface', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { surface: 'game', kind: 'canvas', mountPoint: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return unsupported for invalid kind', async () => {
      const storage = createTestStorage();
      const result = await handler.create(
        { surface: 'bad', kind: 'vr', mountPoint: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('unsupported');
        if (result.right.variant === 'unsupported') {
          expect(result.right.message).toContain('vr');
          expect(result.right.message).toContain('dom');
        }
      }
    });

    it('should accept all valid kinds', async () => {
      const kinds = ['dom', 'canvas', 'native', 'terminal', 'webgl'];
      for (const kind of kinds) {
        const storage = createTestStorage();
        const result = await handler.create(
          { surface: `surf-${kind}`, kind, mountPoint: O.none },
          storage,
        )();
        expect(E.isRight(result)).toBe(true);
        if (E.isRight(result)) {
          expect(result.right.variant).toBe('ok');
        }
      }
    });

    it('should default mount point to root', async () => {
      const storage = createTestStorage();
      await handler.create(
        { surface: 'default-mount', kind: 'dom', mountPoint: O.none },
        storage,
      )();
      const record = await storage.get('surface', 'default-mount');
      expect(record).not.toBeNull();
      expect(record!['mountPoint']).toBe('root');
    });
  });

  describe('attach', () => {
    it('should attach a compatible renderer to a surface', async () => {
      const storage = createTestStorage();
      await handler.create({ surface: 'attach-surf', kind: 'dom', mountPoint: O.none }, storage)();
      const result = await handler.attach(
        { surface: 'attach-surf', renderer: 'react' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return incompatible for wrong renderer', async () => {
      const storage = createTestStorage();
      await handler.create({ surface: 'incompat', kind: 'dom', mountPoint: O.none }, storage)();
      const result = await handler.attach(
        { surface: 'incompat', renderer: 'three' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incompatible');
      }
    });

    it('should return incompatible for nonexistent surface', async () => {
      const storage = createTestStorage();
      const result = await handler.attach(
        { surface: 'missing', renderer: 'react' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('incompatible');
      }
    });

    it('should allow webgl renderer on webgl surface', async () => {
      const storage = createTestStorage();
      await handler.create({ surface: 'gl-surf', kind: 'webgl', mountPoint: O.none }, storage)();
      const result = await handler.attach(
        { surface: 'gl-surf', renderer: 'three' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });
  });

  describe('resize', () => {
    it('should resize an existing surface', async () => {
      const storage = createTestStorage();
      await handler.create({ surface: 'resize-surf', kind: 'dom', mountPoint: O.none }, storage)();
      const result = await handler.resize(
        { surface: 'resize-surf', width: 800, height: 600 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for nonexistent surface', async () => {
      const storage = createTestStorage();
      const result = await handler.resize(
        { surface: 'missing', width: 800, height: 600 },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('mount', () => {
    it('should mount a widget tree to a surface with attached renderer', async () => {
      const storage = createTestStorage();
      await handler.create({ surface: 'mount-surf', kind: 'dom', mountPoint: O.none }, storage)();
      await handler.attach({ surface: 'mount-surf', renderer: 'react' }, storage)();
      const result = await handler.mount(
        { surface: 'mount-surf', tree: 'widget-tree-1', zone: O.some('main') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return error when no renderer is attached', async () => {
      const storage = createTestStorage();
      await handler.create({ surface: 'no-renderer', kind: 'dom', mountPoint: O.none }, storage)();
      const result = await handler.mount(
        { surface: 'no-renderer', tree: 'tree', zone: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return notfound for nonexistent surface', async () => {
      const storage = createTestStorage();
      const result = await handler.mount(
        { surface: 'missing', tree: 'tree', zone: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should default zone to default', async () => {
      const storage = createTestStorage();
      await handler.create({ surface: 'default-zone', kind: 'dom', mountPoint: O.none }, storage)();
      await handler.attach({ surface: 'default-zone', renderer: 'vue' }, storage)();
      await handler.mount({ surface: 'default-zone', tree: 'tree-1', zone: O.none }, storage)();
      const record = await storage.get('surface', 'default-zone');
      expect(record).not.toBeNull();
      const zones = record!['zones'] as Record<string, unknown>;
      expect(zones['default']).toBeDefined();
    });
  });

  describe('unmount', () => {
    it('should unmount a zone from a surface', async () => {
      const storage = createTestStorage();
      await handler.create({ surface: 'unmount-surf', kind: 'dom', mountPoint: O.none }, storage)();
      await handler.attach({ surface: 'unmount-surf', renderer: 'react' }, storage)();
      await handler.mount({ surface: 'unmount-surf', tree: 'tree', zone: O.some('main') }, storage)();
      const result = await handler.unmount(
        { surface: 'unmount-surf', zone: O.some('main') },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
      }
    });

    it('should return notfound for nonexistent surface', async () => {
      const storage = createTestStorage();
      const result = await handler.unmount(
        { surface: 'missing', zone: O.none },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });
  });

  describe('destroy', () => {
    it('should destroy an existing surface', async () => {
      const storage = createTestStorage();
      await handler.create({ surface: 'destroy-surf', kind: 'dom', mountPoint: O.none }, storage)();
      const result = await handler.destroy({ surface: 'destroy-surf' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.surface).toBe('destroy-surf');
        }
      }
      const record = await storage.get('surface', 'destroy-surf');
      expect(record).toBeNull();
    });

    it('should return notfound for nonexistent surface', async () => {
      const storage = createTestStorage();
      const result = await handler.destroy({ surface: 'missing' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('notfound');
      }
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.destroy({ surface: 'test' }, storage)();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
