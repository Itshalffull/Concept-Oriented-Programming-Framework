// VersionSpace concept handler tests -- parallel overlay management,
// copy-on-write overrides, merge, archive, and resolution chain.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { versionSpaceHandler } from '../handlers/ts/version-space.handler.js';

describe('VersionSpace', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('fork', () => {
    it('creates a new version space from base', async () => {
      const result = await versionSpaceHandler.fork(
        { name: 'redesign', parent: null, scope: null, visibility: 'shared' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.space).toBeDefined();
    });

    it('creates a nested sub-space from parent', async () => {
      const parent = await versionSpaceHandler.fork(
        { name: 'parent', parent: null, scope: null, visibility: 'shared' },
        storage,
      );
      const child = await versionSpaceHandler.fork(
        { name: 'child', parent: parent.space, scope: null, visibility: 'private' },
        storage,
      );
      expect(child.variant).toBe('ok');
      expect(child.space).toBeDefined();
    });

    it('rejects fork from non-existent parent', async () => {
      const result = await versionSpaceHandler.fork(
        { name: 'child', parent: 'nonexistent', scope: null, visibility: 'private' },
        storage,
      );
      expect(result.variant).toBe('parent_not_found');
    });

    it('rejects fork from archived parent', async () => {
      const parent = await versionSpaceHandler.fork(
        { name: 'parent', parent: null, scope: null, visibility: 'shared' },
        storage,
      );
      await versionSpaceHandler.archive({ space: parent.space }, storage);
      const result = await versionSpaceHandler.fork(
        { name: 'child', parent: parent.space, scope: null, visibility: 'private' },
        storage,
      );
      expect(result.variant).toBe('parent_not_found');
    });
  });

  describe('write and resolve', () => {
    it('writes an override and resolves it', async () => {
      const fork = await versionSpaceHandler.fork(
        { name: 'test', parent: null, scope: null, visibility: 'shared' },
        storage,
      );
      const space = fork.space as string;

      const write = await versionSpaceHandler.write(
        { space, entity_id: 'e1', fields: '{"title":"New Title"}' },
        storage,
      );
      expect(write.variant).toBe('ok');

      const resolve = await versionSpaceHandler.resolve(
        { space, entity_id: 'e1' },
        storage,
      );
      expect(resolve.variant).toBe('ok');
      expect(resolve.fields).toBe('{"title":"New Title"}');
    });

    it('returns base when no override exists', async () => {
      const fork = await versionSpaceHandler.fork(
        { name: 'test', parent: null, scope: null, visibility: 'shared' },
        storage,
      );
      const resolve = await versionSpaceHandler.resolve(
        { space: fork.space as string, entity_id: 'unmodified' },
        storage,
      );
      expect(resolve.variant).toBe('ok');
      expect(resolve.source).toBe('base');
    });

    it('updates existing override on second write', async () => {
      const fork = await versionSpaceHandler.fork(
        { name: 'test', parent: null, scope: null, visibility: 'shared' },
        storage,
      );
      const space = fork.space as string;

      await versionSpaceHandler.write(
        { space, entity_id: 'e1', fields: '{"title":"First"}' },
        storage,
      );
      await versionSpaceHandler.write(
        { space, entity_id: 'e1', fields: '{"title":"Second"}' },
        storage,
      );

      const resolve = await versionSpaceHandler.resolve(
        { space, entity_id: 'e1' },
        storage,
      );
      expect(resolve.fields).toBe('{"title":"Second"}');
    });
  });

  describe('create_in_space', () => {
    it('creates entity visible only in the space', async () => {
      const fork = await versionSpaceHandler.fork(
        { name: 'experiment', parent: null, scope: null, visibility: 'private' },
        storage,
      );
      const space = fork.space as string;

      const created = await versionSpaceHandler.create_in_space(
        { space, fields: '{"title":"Space-Only"}' },
        storage,
      );
      expect(created.variant).toBe('ok');
      expect(created.entity_id).toBeDefined();

      const resolve = await versionSpaceHandler.resolve(
        { space, entity_id: created.entity_id as string },
        storage,
      );
      expect(resolve.variant).toBe('ok');
    });
  });

  describe('delete_in_space', () => {
    it('marks entity as deleted with tombstone', async () => {
      const fork = await versionSpaceHandler.fork(
        { name: 'test', parent: null, scope: null, visibility: 'shared' },
        storage,
      );
      const space = fork.space as string;

      // Write then delete
      await versionSpaceHandler.write(
        { space, entity_id: 'e1', fields: '{"title":"To Delete"}' },
        storage,
      );
      await versionSpaceHandler.delete_in_space(
        { space, entity_id: 'e1' },
        storage,
      );

      const resolve = await versionSpaceHandler.resolve(
        { space, entity_id: 'e1' },
        storage,
      );
      expect(resolve.variant).toBe('not_found');
    });
  });

  describe('enter and leave', () => {
    it('allows entering a public space', async () => {
      const fork = await versionSpaceHandler.fork(
        { name: 'public', parent: null, scope: null, visibility: 'public' },
        storage,
      );
      const result = await versionSpaceHandler.enter(
        { space: fork.space as string, user: 'anyone' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('denies entry to non-members of private space', async () => {
      const fork = await versionSpaceHandler.fork(
        { name: 'private', parent: null, scope: null, visibility: 'private', user: 'owner' },
        storage,
      );
      const result = await versionSpaceHandler.enter(
        { space: fork.space as string, user: 'stranger' },
        storage,
      );
      expect(result.variant).toBe('access_denied');
    });

    it('rejects entry to archived space', async () => {
      const fork = await versionSpaceHandler.fork(
        { name: 'to-archive', parent: null, scope: null, visibility: 'public' },
        storage,
      );
      await versionSpaceHandler.archive({ space: fork.space as string }, storage);
      const result = await versionSpaceHandler.enter(
        { space: fork.space as string, user: 'anyone' },
        storage,
      );
      expect(result.variant).toBe('archived');
    });
  });

  describe('propose', () => {
    it('transitions space to proposed status', async () => {
      const fork = await versionSpaceHandler.fork(
        { name: 'proposal', parent: null, scope: null, visibility: 'shared' },
        storage,
      );
      const result = await versionSpaceHandler.propose(
        { space: fork.space as string, target: null, message: 'Ready for review' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('rejects double proposal', async () => {
      const fork = await versionSpaceHandler.fork(
        { name: 'proposal', parent: null, scope: null, visibility: 'shared' },
        storage,
      );
      await versionSpaceHandler.propose(
        { space: fork.space as string, target: null, message: 'First' },
        storage,
      );
      const result = await versionSpaceHandler.propose(
        { space: fork.space as string, target: null, message: 'Second' },
        storage,
      );
      expect(result.variant).toBe('already_proposed');
    });
  });

  describe('merge', () => {
    it('merges overrides and marks space as merged', async () => {
      const fork = await versionSpaceHandler.fork(
        { name: 'to-merge', parent: null, scope: null, visibility: 'shared' },
        storage,
      );
      const space = fork.space as string;

      await versionSpaceHandler.write(
        { space, entity_id: 'e1', fields: '{"title":"Changed"}' },
        storage,
      );

      const result = await versionSpaceHandler.merge(
        { space, target: null, strategy: 'field_merge' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.merged_count).toBe(1);
    });
  });

  describe('cherry_pick', () => {
    it('copies override from source to target', async () => {
      const source = await versionSpaceHandler.fork(
        { name: 'source', parent: null, scope: null, visibility: 'shared' },
        storage,
      );
      const target = await versionSpaceHandler.fork(
        { name: 'target', parent: null, scope: null, visibility: 'shared' },
        storage,
      );

      await versionSpaceHandler.write(
        { space: source.space as string, entity_id: 'e1', fields: '{"title":"Cherry"}' },
        storage,
      );

      const result = await versionSpaceHandler.cherry_pick(
        { source: source.space as string, target: target.space as string, entity_id: 'e1' },
        storage,
      );
      expect(result.variant).toBe('ok');

      // Verify the override is now in target
      const resolve = await versionSpaceHandler.resolve(
        { space: target.space as string, entity_id: 'e1' },
        storage,
      );
      expect(resolve.variant).toBe('ok');
      expect(resolve.fields).toBe('{"title":"Cherry"}');
    });

    it('returns not_overridden when source has no override', async () => {
      const source = await versionSpaceHandler.fork(
        { name: 'source', parent: null, scope: null, visibility: 'shared' },
        storage,
      );
      const target = await versionSpaceHandler.fork(
        { name: 'target', parent: null, scope: null, visibility: 'shared' },
        storage,
      );

      const result = await versionSpaceHandler.cherry_pick(
        { source: source.space as string, target: target.space as string, entity_id: 'e1' },
        storage,
      );
      expect(result.variant).toBe('not_overridden');
    });
  });

  describe('promote_to_base', () => {
    it('promotes space to base and returns snapshot', async () => {
      const fork = await versionSpaceHandler.fork(
        { name: 'to-promote', parent: null, scope: null, visibility: 'shared' },
        storage,
      );
      const result = await versionSpaceHandler.promote_to_base(
        { space: fork.space as string },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.old_base_snapshot).toBeDefined();
    });

    it('rejects promotion when active children exist', async () => {
      const parent = await versionSpaceHandler.fork(
        { name: 'parent', parent: null, scope: null, visibility: 'shared' },
        storage,
      );
      await versionSpaceHandler.fork(
        { name: 'child', parent: parent.space, scope: null, visibility: 'private' },
        storage,
      );

      const result = await versionSpaceHandler.promote_to_base(
        { space: parent.space as string },
        storage,
      );
      expect(result.variant).toBe('has_children');
    });
  });

  describe('diff', () => {
    it('returns structured changeset of overrides', async () => {
      const fork = await versionSpaceHandler.fork(
        { name: 'to-diff', parent: null, scope: null, visibility: 'shared' },
        storage,
      );
      const space = fork.space as string;

      await versionSpaceHandler.write(
        { space, entity_id: 'e1', fields: '{"title":"Changed"}' },
        storage,
      );

      const result = await versionSpaceHandler.diff({ space }, storage);
      expect(result.variant).toBe('ok');
      const changes = JSON.parse(result.changes as string);
      expect(changes).toHaveLength(1);
      expect(changes[0].entity_id).toBe('e1');
    });
  });

  describe('archive', () => {
    it('transitions space to archived', async () => {
      const fork = await versionSpaceHandler.fork(
        { name: 'to-archive', parent: null, scope: null, visibility: 'shared' },
        storage,
      );
      const result = await versionSpaceHandler.archive(
        { space: fork.space as string },
        storage,
      );
      expect(result.variant).toBe('ok');
    });
  });

  describe('execute_in_space', () => {
    it('returns ok for active space', async () => {
      const fork = await versionSpaceHandler.fork(
        { name: 'exec', parent: null, scope: null, visibility: 'shared' },
        storage,
      );
      const result = await versionSpaceHandler.execute_in_space(
        { space: fork.space as string, action: 'test', params: '{}' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('returns space_not_found for non-existent space', async () => {
      const result = await versionSpaceHandler.execute_in_space(
        { space: 'nonexistent', action: 'test', params: '{}' },
        storage,
      );
      expect(result.variant).toBe('space_not_found');
    });
  });
});
