// ============================================================
// Polity Concept Conformance Tests
//
// Tests for polity establishment, amendment, and dissolution.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { polityHandler } from '../../handlers/ts/app/governance/polity.handler.js';

describe('Polity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('establish', () => {
    it('establishes a new polity', async () => {
      const result = await polityHandler.establish({
        name: 'TestDAO', purpose: 'Governance research',
        scope: 'protocol', values: ['transparency', 'fairness'],
        amendmentThreshold: 0.67,
      }, storage);
      expect(result.variant).toBe('established');
      expect(result.polity).toBeDefined();
    });
  });

  describe('amend', () => {
    it('amends a polity field', async () => {
      const p = await polityHandler.establish({
        name: 'TestDAO', purpose: 'Research', scope: 'protocol',
      }, storage);
      const result = await polityHandler.amend({
        polity: p.polity, field: 'purpose', newValue: 'Governance and research',
        proposedBy: 'alice',
      }, storage);
      expect(result.variant).toBe('amended');
    });

    it('returns not_found for unknown polity', async () => {
      const result = await polityHandler.amend({
        polity: 'nonexistent', field: 'name', newValue: 'X', proposedBy: 'bob',
      }, storage);
      expect(result.variant).toBe('not_found');
    });
  });

  describe('dissolve', () => {
    it('dissolves a polity', async () => {
      const p = await polityHandler.establish({ name: 'TempDAO', purpose: 'Test' }, storage);
      const result = await polityHandler.dissolve({ polity: p.polity, reason: 'Complete' }, storage);
      expect(result.variant).toBe('dissolved');
    });
  });
});
