// ============================================================
// Role Concept Conformance Tests
//
// Tests for role lifecycle: creation, assignment, revocation,
// membership checks, and dissolution.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { roleHandler } from '../../handlers/ts/app/governance/governance-office.handler.js';

describe('Role Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('create', () => {
    it('creates a new role', async () => {
      const result = await roleHandler.create(
        { name: 'moderator', permissions: ['ban', 'mute'], polity: 'dao-1' },
        storage,
      );
      expect(result.variant).toBe('created');
      expect(result.role).toBeDefined();
    });
  });

  describe('assign / revoke', () => {
    it('assigns a role to a member', async () => {
      const role = await roleHandler.create({ name: 'editor', permissions: ['edit'] }, storage);
      const result = await roleHandler.assign(
        { role: role.role, member: 'alice', assignedBy: 'admin' },
        storage,
      );
      expect(result.variant).toBe('assigned');
    });

    it('revokes a role from a member', async () => {
      const role = await roleHandler.create({ name: 'editor', permissions: ['edit'] }, storage);
      await roleHandler.assign({ role: role.role, member: 'alice', assignedBy: 'admin' }, storage);
      const result = await roleHandler.revoke({ role: role.role, member: 'alice' }, storage);
      expect(result.variant).toBe('revoked');
    });

    it('returns not_assigned when revoking unassigned role', async () => {
      const role = await roleHandler.create({ name: 'editor', permissions: ['edit'] }, storage);
      const result = await roleHandler.revoke({ role: role.role, member: 'ghost' }, storage);
      expect(result.variant).toBe('not_assigned');
    });
  });

  describe('check', () => {
    it('confirms a member has a role', async () => {
      const role = await roleHandler.create({ name: 'viewer', permissions: ['read'] }, storage);
      await roleHandler.assign({ role: role.role, member: 'bob', assignedBy: 'admin' }, storage);
      const result = await roleHandler.check({ role: role.role, member: 'bob' }, storage);
      expect(result.variant).toBe('has_role');
    });

    it('confirms a member does not have a role', async () => {
      const role = await roleHandler.create({ name: 'viewer', permissions: ['read'] }, storage);
      const result = await roleHandler.check({ role: role.role, member: 'nobody' }, storage);
      expect(result.variant).toBe('no_role');
    });
  });

  describe('dissolve', () => {
    it('dissolves a role', async () => {
      const role = await roleHandler.create({ name: 'temp', permissions: [] }, storage);
      const result = await roleHandler.dissolve({ role: role.role }, storage);
      expect(result.variant).toBe('dissolved');
    });
  });
});
