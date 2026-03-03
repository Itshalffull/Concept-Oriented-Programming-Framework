// ============================================================
// Circle Concept Conformance Tests
//
// Tests for sociocratic circles: creation, member management,
// link configuration, jurisdiction checks, and dissolution.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { circleHandler } from '../../handlers/ts/app/governance/circle.handler.js';

describe('Circle Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('create', () => {
    it('creates a circle', async () => {
      const result = await circleHandler.create({
        name: 'Engineering', domain: 'tech', purpose: 'Software development',
      }, storage);
      expect(result.variant).toBe('created');
      expect(result.circle).toBeDefined();
    });
  });

  describe('assignMember / removeMember', () => {
    it('assigns and removes a member', async () => {
      const c = await circleHandler.create({ name: 'Eng', domain: 'tech', purpose: 'Dev' }, storage);
      const assign = await circleHandler.assignMember(
        { circle: c.circle, member: 'alice', role: 'developer' },
        storage,
      );
      expect(assign.variant).toBe('member_assigned');

      const remove = await circleHandler.removeMember(
        { circle: c.circle, member: 'alice' },
        storage,
      );
      expect(remove.variant).toBe('member_removed');
    });
  });

  describe('setLinks', () => {
    it('sets lead and rep links', async () => {
      const c = await circleHandler.create({ name: 'Eng', domain: 'tech', purpose: 'Dev' }, storage);
      const result = await circleHandler.setLinks({
        circle: c.circle, leadLink: 'alice', repLink: 'bob',
      }, storage);
      expect(result.variant).toBe('links_set');
    });
  });

  describe('checkJurisdiction', () => {
    it('checks if an action is within jurisdiction', async () => {
      const c = await circleHandler.create({
        name: 'Finance', domain: 'finance', purpose: 'Budget',
      }, storage);
      const result = await circleHandler.checkJurisdiction({
        circle: c.circle, action: 'approve-budget',
      }, storage);
      expect(result.variant).toBe('within_jurisdiction');
    });
  });

  describe('dissolve', () => {
    it('dissolves a circle', async () => {
      const c = await circleHandler.create({ name: 'Temp', domain: 'temp', purpose: 'Test' }, storage);
      const result = await circleHandler.dissolve({ circle: c.circle }, storage);
      expect(result.variant).toBe('dissolved');
    });
  });
});
