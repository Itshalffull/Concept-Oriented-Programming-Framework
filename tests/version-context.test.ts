// VersionContext concept handler tests -- user version space stack
// tracking, push/pop operations, and resolution delegation.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { versionContextHandler } from '../handlers/ts/version-context.handler.js';

describe('VersionContext', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('push', () => {
    it('creates a new context with one space on the stack', async () => {
      const result = await versionContextHandler.push(
        { user: 'alice', space_id: 'space-1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.context).toBeDefined();
    });

    it('adds to existing stack on second push', async () => {
      await versionContextHandler.push(
        { user: 'alice', space_id: 'space-1' },
        storage,
      );
      const result = await versionContextHandler.push(
        { user: 'alice', space_id: 'sub-space-1' },
        storage,
      );
      expect(result.variant).toBe('ok');

      const get = await versionContextHandler.get({ user: 'alice' }, storage);
      expect(get.variant).toBe('ok');
      expect(get.stack).toEqual(['space-1', 'sub-space-1']);
    });
  });

  describe('pop', () => {
    it('removes space from stack', async () => {
      await versionContextHandler.push(
        { user: 'bob', space_id: 'space-1' },
        storage,
      );
      const result = await versionContextHandler.pop(
        { user: 'bob', space_id: 'space-1' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('removes child sub-spaces when parent is popped', async () => {
      await versionContextHandler.push(
        { user: 'carol', space_id: 'space-1' },
        storage,
      );
      await versionContextHandler.push(
        { user: 'carol', space_id: 'sub-space-1' },
        storage,
      );
      await versionContextHandler.pop(
        { user: 'carol', space_id: 'space-1' },
        storage,
      );

      const get = await versionContextHandler.get({ user: 'carol' }, storage);
      // After popping parent, context should be empty (base)
      expect(get.variant).toBe('no_context');
    });
  });

  describe('get', () => {
    it('returns stack for user with context', async () => {
      await versionContextHandler.push(
        { user: 'alice', space_id: 'space-1' },
        storage,
      );
      const result = await versionContextHandler.get({ user: 'alice' }, storage);
      expect(result.variant).toBe('ok');
      expect(result.stack).toEqual(['space-1']);
    });

    it('returns no_context for user without context', async () => {
      const result = await versionContextHandler.get({ user: 'nobody' }, storage);
      expect(result.variant).toBe('no_context');
    });
  });

  describe('resolve_for', () => {
    it('returns base when user has no context', async () => {
      const result = await versionContextHandler.resolve_for(
        { user: 'alice', entity_id: 'e1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.source_space).toBe('base');
    });

    it('returns innermost space when user has context', async () => {
      await versionContextHandler.push(
        { user: 'bob', space_id: 'space-1' },
        storage,
      );
      await versionContextHandler.push(
        { user: 'bob', space_id: 'sub-space-1' },
        storage,
      );

      const result = await versionContextHandler.resolve_for(
        { user: 'bob', entity_id: 'e1' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.source_space).toBe('sub-space-1');
    });
  });
});
