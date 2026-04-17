// ============================================================
// Team Concept Conformance Tests
//
// Tests for governance teams: creation, member management,
// link configuration, jurisdiction checks, and dissolution.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { teamHandler } from '../../handlers/ts/app/governance/team.handler.js';

describe('Team Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('create', () => {
    it('creates a team', async () => {
      const result = await teamHandler.create({
        name: 'Engineering', domain: 'tech', purpose: 'Software development',
      }, storage);
      expect(result.variant).toBe('ok');
      expect(result.team).toBeDefined();
    });
  });

  describe('assignMember / removeMember', () => {
    it('assigns and removes a member', async () => {
      const t = await teamHandler.create({ name: 'Eng', domain: 'tech', purpose: 'Dev' }, storage);
      const assign = await teamHandler.assignMember(
        { team: t.team, member: 'alice', role: 'developer' },
        storage,
      );
      expect(assign.variant).toBe('ok');

      const remove = await teamHandler.removeMember(
        { team: t.team, member: 'alice' },
        storage,
      );
      expect(remove.variant).toBe('ok');
    });
  });

  describe('setLinks', () => {
    it('sets lead and rep links', async () => {
      const t = await teamHandler.create({ name: 'Eng', domain: 'tech', purpose: 'Dev' }, storage);
      const result = await teamHandler.setLinks({
        team: t.team, leadLink: 'alice', repLink: 'bob',
      }, storage);
      expect(result.variant).toBe('ok');
    });
  });

  describe('checkJurisdiction', () => {
    it('checks if an action is within jurisdiction', async () => {
      const t = await teamHandler.create({
        name: 'Finance', domain: 'finance', purpose: 'Budget',
      }, storage);
      const result = await teamHandler.checkJurisdiction({
        team: t.team, action: 'approve-budget',
      }, storage);
      expect(result.variant).toBe('ok');
    });
  });

  describe('dissolve', () => {
    it('dissolves a team', async () => {
      const t = await teamHandler.create({ name: 'Temp', domain: 'temp', purpose: 'Test' }, storage);
      const result = await teamHandler.dissolve({ team: t.team }, storage);
      expect(result.variant).toBe('ok');
    });
  });
});
