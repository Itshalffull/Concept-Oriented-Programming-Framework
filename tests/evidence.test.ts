// ============================================================
// Evidence Handler Tests — Formal Verification Suite
//
// Tests for verification evidence recording, validation,
// retrieval, comparison, counterexample minimization, and
// filtered listing by property and artifact type.
// See Architecture doc Section 18.3
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { evidenceHandler } from '../handlers/ts/kits/formal-verification/evidence.handler.js';

describe('Evidence Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // ----------------------------------------------------------
  // record
  // ----------------------------------------------------------

  describe('record', () => {
    it('stores evidence with a content hash', async () => {
      const result = await evidenceHandler.record({
        property_ref: 'Password.strength_invariant',
        artifact_type: 'proof_certificate',
        content: 'QED: password length >= 8 implies strength >= medium',
        solver: 'z3',
        run_ref: 'vr-001',
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.id).toBeDefined();
      expect(result.content_hash).toBeDefined();
      expect(result.content_hash).toMatch(/^sha256-/);
      expect(result.artifact_type).toBe('proof_certificate');
      expect(result.property_ref).toBe('Password.strength_invariant');
    });

    it('rejects an invalid artifact type', async () => {
      const result = await evidenceHandler.record({
        property_ref: 'Password.strength_invariant',
        artifact_type: 'invalid_type',
        content: 'some content',
      }, storage);

      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('Invalid artifact_type');
      expect(result.message).toContain('proof_certificate');
    });

    it('rejects empty content', async () => {
      const result = await evidenceHandler.record({
        property_ref: 'Password.strength_invariant',
        artifact_type: 'proof_certificate',
        content: '',
      }, storage);

      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('non-empty');
    });
  });

  // ----------------------------------------------------------
  // validate
  // ----------------------------------------------------------

  describe('validate', () => {
    it('recomputes hash and confirms integrity', async () => {
      const recorded = await evidenceHandler.record({
        property_ref: 'Password.strength_invariant',
        artifact_type: 'proof_certificate',
        content: 'QED: password length >= 8 implies strength >= medium',
        solver: 'z3',
      }, storage);

      const result = await evidenceHandler.validate({
        id: recorded.id,
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.valid).toBe(true);
      expect(result.stored_hash).toBe(result.recomputed_hash);
    });

    it('returns notfound for nonexistent evidence', async () => {
      const result = await evidenceHandler.validate({
        id: 'ev-nonexistent',
      }, storage);

      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // retrieve
  // ----------------------------------------------------------

  describe('retrieve', () => {
    it('returns full evidence details by ID', async () => {
      const recorded = await evidenceHandler.record({
        property_ref: 'User.email_format',
        artifact_type: 'counterexample',
        content: '{ "email": "not-an-email", "accepted": true }',
        solver: 'cvc5',
        run_ref: 'vr-002',
      }, storage);

      const result = await evidenceHandler.retrieve({
        id: recorded.id,
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.property_ref).toBe('User.email_format');
      expect(result.artifact_type).toBe('counterexample');
      expect(result.content).toContain('not-an-email');
      expect(result.solver).toBe('cvc5');
      expect(result.run_ref).toBe('vr-002');
      expect(result.created_at).toBeDefined();
    });

    it('returns notfound for a nonexistent ID', async () => {
      const result = await evidenceHandler.retrieve({
        id: 'ev-does-not-exist',
      }, storage);

      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // compare
  // ----------------------------------------------------------

  describe('compare', () => {
    it('identifies two different evidence artifacts as non-identical', async () => {
      const proof = await evidenceHandler.record({
        property_ref: 'Password.strength_invariant',
        artifact_type: 'proof_certificate',
        content: 'QED: password length >= 8 implies strength >= medium',
      }, storage);

      const counterexample = await evidenceHandler.record({
        property_ref: 'User.email_format',
        artifact_type: 'counterexample',
        content: '{ "email": "not-an-email", "accepted": true }',
      }, storage);

      const result = await evidenceHandler.compare({
        id_a: proof.id,
        id_b: counterexample.id,
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.identical).toBe(false);
      expect(result.same_type).toBe(false);
      expect(result.same_property).toBe(false);
    });

    it('identifies identical content across two evidence artifacts', async () => {
      const content = 'QED: invariant holds for all inputs in domain';

      const ev1 = await evidenceHandler.record({
        property_ref: 'Password.strength_invariant',
        artifact_type: 'proof_certificate',
        content,
      }, storage);

      const ev2 = await evidenceHandler.record({
        property_ref: 'Password.strength_invariant',
        artifact_type: 'proof_certificate',
        content,
      }, storage);

      const result = await evidenceHandler.compare({
        id_a: ev1.id,
        id_b: ev2.id,
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.identical).toBe(true);
      expect(result.same_type).toBe(true);
      expect(result.same_property).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // minimize
  // ----------------------------------------------------------

  describe('minimize', () => {
    it('minimizes a counterexample and reports reduction percentage', async () => {
      // Content must be > 20 chars for minimization to apply
      const longContent = '{ "email": "not-an-email-address-at-all", "password": "short", "accepted": true, "extra_field": "padding" }';

      const recorded = await evidenceHandler.record({
        property_ref: 'User.email_format',
        artifact_type: 'counterexample',
        content: longContent,
      }, storage);

      const result = await evidenceHandler.minimize({
        id: recorded.id,
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.original_id).toBe(recorded.id);
      expect(result.minimized_id).toBeDefined();
      expect(result.minimized_size).toBeLessThan(result.original_size as number);
      expect(result.reduction_pct).toBeGreaterThan(0);
    });

    it('returns not_applicable for proof_certificate evidence', async () => {
      const recorded = await evidenceHandler.record({
        property_ref: 'Password.strength_invariant',
        artifact_type: 'proof_certificate',
        content: 'QED: password length >= 8 implies strength >= medium',
      }, storage);

      const result = await evidenceHandler.minimize({
        id: recorded.id,
      }, storage);

      expect(result.variant).toBe('not_applicable');
      expect(result.artifact_type).toBe('proof_certificate');
      expect(result.message).toContain('Only counterexamples');
    });

    it('returns notfound for nonexistent evidence', async () => {
      const result = await evidenceHandler.minimize({
        id: 'ev-nonexistent',
      }, storage);

      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // list
  // ----------------------------------------------------------

  describe('list', () => {
    it('filters by property_ref', async () => {
      await evidenceHandler.record({
        property_ref: 'Password.strength_invariant',
        artifact_type: 'proof_certificate',
        content: 'proof content A',
      }, storage);
      await evidenceHandler.record({
        property_ref: 'User.email_format',
        artifact_type: 'counterexample',
        content: 'counterexample content B',
      }, storage);
      await evidenceHandler.record({
        property_ref: 'Password.strength_invariant',
        artifact_type: 'solver_log',
        content: 'solver log content C',
      }, storage);

      const result = await evidenceHandler.list({
        property_ref: 'Password.strength_invariant',
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.count).toBe(2);
      const items = JSON.parse(result.items as string);
      expect(items.every((e: any) => e.property_ref === 'Password.strength_invariant')).toBe(true);
    });

    it('filters by artifact_type', async () => {
      await evidenceHandler.record({
        property_ref: 'Password.strength_invariant',
        artifact_type: 'proof_certificate',
        content: 'proof content A',
      }, storage);
      await evidenceHandler.record({
        property_ref: 'User.email_format',
        artifact_type: 'counterexample',
        content: 'counterexample content B',
      }, storage);

      const result = await evidenceHandler.list({
        artifact_type: 'counterexample',
      }, storage);

      expect(result.variant).toBe('ok');
      expect(result.count).toBe(1);
      const items = JSON.parse(result.items as string);
      expect(items[0].artifact_type).toBe('counterexample');
    });

    it('returns all evidence when no filters are provided', async () => {
      await evidenceHandler.record({
        property_ref: 'Password.strength_invariant',
        artifact_type: 'proof_certificate',
        content: 'proof A',
      }, storage);
      await evidenceHandler.record({
        property_ref: 'User.email_format',
        artifact_type: 'counterexample',
        content: 'counterexample B',
      }, storage);

      const result = await evidenceHandler.list({}, storage);

      expect(result.variant).toBe('ok');
      expect(result.count).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // Full flow: record -> validate -> compare -> minimize
  // ----------------------------------------------------------

  describe('full evidence lifecycle', () => {
    it('records, validates, compares, and minimizes evidence end-to-end', async () => {
      // Record proof_certificate evidence
      const proof = await evidenceHandler.record({
        property_ref: 'Password.strength_invariant',
        artifact_type: 'proof_certificate',
        content: 'QED: password length >= 8 implies strength >= medium',
        solver: 'z3',
      }, storage);
      expect(proof.variant).toBe('ok');

      // Validate the proof — should be valid
      const validation = await evidenceHandler.validate({ id: proof.id }, storage);
      expect(validation.valid).toBe(true);

      // Record counterexample evidence
      const counterexample = await evidenceHandler.record({
        property_ref: 'User.email_format',
        artifact_type: 'counterexample',
        content: '{ "email": "not-an-email-address-that-fails-validation", "accepted": true, "extra": "data" }',
        solver: 'cvc5',
      }, storage);
      expect(counterexample.variant).toBe('ok');

      // Compare proof and counterexample — different content
      const comparison = await evidenceHandler.compare({
        id_a: proof.id,
        id_b: counterexample.id,
      }, storage);
      expect(comparison.identical).toBe(false);

      // Minimize counterexample — should succeed with reduction
      const minimized = await evidenceHandler.minimize({
        id: counterexample.id,
      }, storage);
      expect(minimized.variant).toBe('ok');
      expect(minimized.reduction_pct).toBeGreaterThan(0);

      // Minimize proof_certificate — should be not_applicable
      const notApplicable = await evidenceHandler.minimize({
        id: proof.id,
      }, storage);
      expect(notApplicable.variant).toBe('not_applicable');
    });
  });
});
