// ============================================================
// Organization Concept Conformance Tests
//
// Tests for organization establishment, amendment, and dissolution.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { organizationHandler } from '../../handlers/ts/app/governance/organization.handler.js';

describe('Organization Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('establish', () => {
    it('establishes a new organization', async () => {
      const result = await organizationHandler.establish({
        name: 'TestDAO', purpose: 'Governance research',
        scope: 'protocol', values: ['transparency', 'fairness'],
        amendmentThreshold: 0.67,
      }, storage);
      expect(result.variant).toBe('ok');
      expect(result.organization).toBeDefined();
    });
  });

  describe('amend', () => {
    it('amends an organization field', async () => {
      const o = await organizationHandler.establish({
        name: 'TestDAO', purpose: 'Research', scope: ['protocol'],
        values: ['transparency'],
      }, storage);
      const result = await organizationHandler.amend({
        organization: o.organization, field: 'purpose', newValue: 'Governance and research',
      }, storage);
      expect(result.variant).toBe('ok');
    });

    it('returns not_found for unknown organization', async () => {
      const result = await organizationHandler.amend({
        organization: 'nonexistent', field: 'name', newValue: 'X',
      }, storage);
      expect(result.variant).toBe('not_found');
    });
  });

  describe('dissolve', () => {
    it('dissolves an organization', async () => {
      const o = await organizationHandler.establish({
        name: 'TempDAO', purpose: 'Test', scope: ['all'], values: [],
      }, storage);
      const result = await organizationHandler.dissolve({ organization: o.organization, reason: 'Complete' }, storage);
      expect(result.variant).toBe('ok');
    });
  });
});
