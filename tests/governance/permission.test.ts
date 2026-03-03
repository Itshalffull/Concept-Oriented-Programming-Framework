// ============================================================
// Permission Concept Conformance Tests
//
// Tests for permission lifecycle: grant, revoke, and access checks.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { permissionHandler } from '../../handlers/ts/app/governance/permission.handler.js';

describe('Permission Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('grant', () => {
    it('grants a permission', async () => {
      const result = await permissionHandler.grant(
        { who: 'alice', where: 'treasury', what: 'withdraw', grantedBy: 'admin' },
        storage,
      );
      expect(result.variant).toBe('granted');
    });

    it('detects duplicate grants', async () => {
      await permissionHandler.grant({ who: 'alice', where: 'treasury', what: 'withdraw', grantedBy: 'admin' }, storage);
      const result = await permissionHandler.grant(
        { who: 'alice', where: 'treasury', what: 'withdraw', grantedBy: 'admin' },
        storage,
      );
      expect(result.variant).toBe('already_granted');
    });
  });

  describe('check', () => {
    it('allows when permission is granted', async () => {
      await permissionHandler.grant({ who: 'alice', where: 'docs', what: 'read', grantedBy: 'admin' }, storage);
      const result = await permissionHandler.check({ who: 'alice', where: 'docs', what: 'read' }, storage);
      expect(result.variant).toBe('allowed');
    });

    it('denies when no permission exists', async () => {
      const result = await permissionHandler.check({ who: 'bob', where: 'docs', what: 'write' }, storage);
      expect(result.variant).toBe('denied');
    });
  });

  describe('revoke', () => {
    it('revokes an existing permission', async () => {
      const grant = await permissionHandler.grant(
        { who: 'alice', where: 'docs', what: 'write', grantedBy: 'admin' },
        storage,
      );
      const result = await permissionHandler.revoke({ permission: grant.permission }, storage);
      expect(result.variant).toBe('revoked');
    });
  });
});
