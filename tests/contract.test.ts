// ============================================================
// Contract Handler Tests — Formal Verification Suite
//
// Tests for assume-guarantee contract definition, verification,
// composition, assumption discharge, and listing with filters.
// See Architecture doc Section 18.2
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { contractHandler } from '../handlers/ts/kits/formal-verification/contract.handler.js';

describe('Contract Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // ----------------------------------------------------------
  // define
  // ----------------------------------------------------------

  describe('define', () => {
    it('creates a contract with assumptions and guarantees', async () => {
      const result = await contractHandler.define({
        name: 'UserPasswordContract',
        source_concept: 'User',
        target_concept: 'Password',
        assumptions: JSON.stringify(['user.exists', 'user.authenticated']),
        guarantees: JSON.stringify(['password.hashed', 'password.meets_policy']),
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.id).toBeDefined();
      expect(result.name).toBe('UserPasswordContract');
      expect(result.source_concept).toBe('User');
      expect(result.target_concept).toBe('Password');
      expect(result.compatibility_status).toBe('unchecked');
    });

    it('rejects input missing required fields', async () => {
      const result = await contractHandler.define({
        name: 'IncompleteContract',
        source_concept: '',
        target_concept: '',
        assumptions: '[]',
        guarantees: '[]',
      }, storage);

      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('required');
    });

    it('rejects invalid JSON in assumptions', async () => {
      const result = await contractHandler.define({
        name: 'BadJsonContract',
        source_concept: 'User',
        target_concept: 'Password',
        assumptions: 'not-valid-json',
        guarantees: '[]',
      }, storage);

      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('valid JSON');
    });
  });

  // ----------------------------------------------------------
  // verify
  // ----------------------------------------------------------

  describe('verify', () => {
    it('verifies a compatible contract', async () => {
      const defined = await contractHandler.define({
        name: 'UserPasswordContract',
        source_concept: 'User',
        target_concept: 'Password',
        assumptions: JSON.stringify(['user.exists']),
        guarantees: JSON.stringify(['password.hashed', 'password.stored']),
      }, storage);

      const result = await contractHandler.verify({
        id: defined.id,
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.compatibility_status).toBe('compatible');
      expect(result.assumption_count).toBe(1);
      expect(result.guarantee_count).toBe(2);
    });

    it('reports incompatible when guarantees contain empty entries', async () => {
      const defined = await contractHandler.define({
        name: 'WeakContract',
        source_concept: 'User',
        target_concept: 'Password',
        assumptions: JSON.stringify(['user.exists']),
        guarantees: JSON.stringify(['password.hashed', '']),
      }, storage);

      const result = await contractHandler.verify({
        id: defined.id,
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.compatibility_status).toBe('incompatible');
      const missing = JSON.parse(result.missing_guarantees as string);
      expect(missing).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------
  // compose
  // ----------------------------------------------------------

  describe('compose', () => {
    it('chains multiple contracts and discharges matching assumptions', async () => {
      // Contract 1: User -> Session, guarantees session.created
      const c1 = await contractHandler.define({
        name: 'UserSessionContract',
        source_concept: 'User',
        target_concept: 'Session',
        assumptions: JSON.stringify(['user.authenticated']),
        guarantees: JSON.stringify(['session.created', 'session.valid']),
      }, storage);

      // Contract 2: Session -> Password, assumes session.created (discharged by c1 guarantees)
      const c2 = await contractHandler.define({
        name: 'SessionPasswordContract',
        source_concept: 'Session',
        target_concept: 'Password',
        assumptions: JSON.stringify(['session.created', 'session.has_user']),
        guarantees: JSON.stringify(['password.changeable']),
      }, storage);

      const result = await contractHandler.compose({
        contract_ids: JSON.stringify([c1.id, c2.id]),
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.id).toBeDefined();
      expect(result.discharged_count).toBe(1); // session.created discharged
      const remaining = JSON.parse(result.remaining_assumptions as string);
      expect(remaining).toContain('user.authenticated');
      expect(remaining).toContain('session.has_user');
      expect(remaining).not.toContain('session.created');
      expect(result.total_guarantees).toBe(3);
    });

    it('rejects composition with fewer than two contracts', async () => {
      const c1 = await contractHandler.define({
        name: 'SingleContract',
        source_concept: 'A',
        target_concept: 'B',
        assumptions: JSON.stringify(['a.ready']),
        guarantees: JSON.stringify(['b.ready']),
      }, storage);

      const result = await contractHandler.compose({
        contract_ids: JSON.stringify([c1.id]),
      }, storage);

      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('two contracts');
    });
  });

  // ----------------------------------------------------------
  // discharge
  // ----------------------------------------------------------

  describe('discharge', () => {
    it('discharges assumptions one at a time and tracks remaining count', async () => {
      const defined = await contractHandler.define({
        name: 'MultiAssumptionContract',
        source_concept: 'User',
        target_concept: 'Password',
        assumptions: JSON.stringify(['user.exists', 'user.authenticated', 'user.active']),
        guarantees: JSON.stringify(['password.valid']),
      }, storage);

      // Discharge first assumption
      const d1 = await contractHandler.discharge({
        id: defined.id,
        assumption_ref: 'user.exists',
      }, storage);
      expect(d1.variant).toBe('ok');
      expect(d1.discharged_assumption).toBe('user.exists');
      expect(d1.remaining_count).toBe(2);

      // Discharge second assumption
      const d2 = await contractHandler.discharge({
        id: defined.id,
        assumption_ref: 'user.authenticated',
      }, storage);
      expect(d2.variant).toBe('ok');
      expect(d2.remaining_count).toBe(1);

      // Discharge third assumption
      const d3 = await contractHandler.discharge({
        id: defined.id,
        assumption_ref: 'user.active',
      }, storage);
      expect(d3.variant).toBe('ok');
      expect(d3.remaining_count).toBe(0);
    });

    it('returns already_discharged when discharging the same assumption twice', async () => {
      const defined = await contractHandler.define({
        name: 'DuplicateDischarge',
        source_concept: 'User',
        target_concept: 'Password',
        assumptions: JSON.stringify(['user.exists']),
        guarantees: JSON.stringify(['password.valid']),
      }, storage);

      await contractHandler.discharge({
        id: defined.id,
        assumption_ref: 'user.exists',
      }, storage);

      const result = await contractHandler.discharge({
        id: defined.id,
        assumption_ref: 'user.exists',
      }, storage);

      expect(result.variant).toBe('already_discharged');
    });

    it('rejects discharging an assumption not in the contract', async () => {
      const defined = await contractHandler.define({
        name: 'NoSuchAssumption',
        source_concept: 'User',
        target_concept: 'Password',
        assumptions: JSON.stringify(['user.exists']),
        guarantees: JSON.stringify(['password.valid']),
      }, storage);

      const result = await contractHandler.discharge({
        id: defined.id,
        assumption_ref: 'nonexistent.assumption',
      }, storage);

      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('not found');
    });
  });

  // ----------------------------------------------------------
  // list
  // ----------------------------------------------------------

  describe('list', () => {
    it('filters contracts by source_concept', async () => {
      await contractHandler.define({
        name: 'C1',
        source_concept: 'User',
        target_concept: 'Password',
        assumptions: '[]',
        guarantees: '[]',
      }, storage);
      await contractHandler.define({
        name: 'C2',
        source_concept: 'Session',
        target_concept: 'Token',
        assumptions: '[]',
        guarantees: '[]',
      }, storage);
      await contractHandler.define({
        name: 'C3',
        source_concept: 'User',
        target_concept: 'Profile',
        assumptions: '[]',
        guarantees: '[]',
      }, storage);

      const result = await contractHandler.list({
        source_concept: 'User',
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.count).toBe(2);
      const items = JSON.parse(result.items as string);
      expect(items.every((c: any) => c.source_concept === 'User')).toBe(true);
    });

    it('filters contracts by target_concept', async () => {
      await contractHandler.define({
        name: 'C1',
        source_concept: 'User',
        target_concept: 'Password',
        assumptions: '[]',
        guarantees: '[]',
      }, storage);
      await contractHandler.define({
        name: 'C2',
        source_concept: 'Session',
        target_concept: 'Password',
        assumptions: '[]',
        guarantees: '[]',
      }, storage);

      const result = await contractHandler.list({
        target_concept: 'Password',
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.count).toBe(2);
      const items = JSON.parse(result.items as string);
      expect(items.every((c: any) => c.target_concept === 'Password')).toBe(true);
    });

    it('returns all contracts when no filter is provided', async () => {
      await contractHandler.define({
        name: 'C1',
        source_concept: 'User',
        target_concept: 'Password',
        assumptions: '[]',
        guarantees: '[]',
      }, storage);
      await contractHandler.define({
        name: 'C2',
        source_concept: 'Session',
        target_concept: 'Token',
        assumptions: '[]',
        guarantees: '[]',
      }, storage);

      const result = await contractHandler.list({}, storage);

      expect(result.variant).toBe('ok');
      expect(result.count).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // Full flow: define -> verify -> compose -> discharge
  // ----------------------------------------------------------

  describe('full contract lifecycle', () => {
    it('defines, verifies, composes, and discharges contracts end-to-end', async () => {
      // Define contract between User and Password
      const c1 = await contractHandler.define({
        name: 'UserPasswordContract',
        source_concept: 'User',
        target_concept: 'Password',
        assumptions: JSON.stringify(['user.exists', 'user.authenticated']),
        guarantees: JSON.stringify(['password.hashed', 'password.stored']),
      }, storage);
      expect(c1.variant).toBe('ok');

      // Verify compatibility
      const v1 = await contractHandler.verify({ id: c1.id }, storage);
      expect(v1.compatibility_status).toBe('compatible');

      // Define a second contract
      const c2 = await contractHandler.define({
        name: 'PasswordTokenContract',
        source_concept: 'Password',
        target_concept: 'Token',
        assumptions: JSON.stringify(['password.hashed']),
        guarantees: JSON.stringify(['token.issued']),
      }, storage);
      expect(c2.variant).toBe('ok');

      // Compose the two contracts
      const composed = await contractHandler.compose({
        contract_ids: JSON.stringify([c1.id, c2.id]),
      }, storage);
      expect(composed.variant).toBe('ok');
      expect(composed.discharged_count).toBe(1); // password.hashed discharged

      // Discharge remaining assumptions on composed contract
      const remaining = JSON.parse(composed.remaining_assumptions as string);
      expect(remaining).toEqual(['user.exists', 'user.authenticated']);

      const d1 = await contractHandler.discharge({
        id: composed.id,
        assumption_ref: 'user.exists',
      }, storage);
      expect(d1.remaining_count).toBe(1);

      const d2 = await contractHandler.discharge({
        id: composed.id,
        assumption_ref: 'user.authenticated',
      }, storage);
      expect(d2.remaining_count).toBe(0);
    });
  });
});
