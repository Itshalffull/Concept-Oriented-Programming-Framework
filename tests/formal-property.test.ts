// ============================================================
// FormalProperty Handler Tests
//
// Validates formal property definition, proof lifecycle,
// solver dispatch, synthesis, coverage reporting, listing
// with filters, and invalidation.
// See Architecture doc Section 18.1
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/index.js';
import { interpret } from '../runtime/interpreter.js';
import { formalPropertyHandler } from '../handlers/ts/suites/formal-verification/formal-property.handler.js';
import type { ConceptStorage } from '../runtime/types.js';

describe('FormalProperty Handler', () => {
  let storage: ConceptStorage;

  async function run(program: any) {
    const execResult = await interpret(program, storage);
    return { variant: execResult.variant, ...execResult.output };
  }

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // ============================================================
  // define action
  // ============================================================

  describe('define', () => {
    it('creates a valid formal property and returns ok', async () => {
      const result = await run(formalPropertyHandler.define({
        name: 'balance-non-negative',
        kind: 'invariant',
        formal_language: 'smtlib',
        expression: '(assert (>= balance 0))',
        target_symbol: 'Account',
        scope: 'local',
        priority: 'required',
      }));

      expect(result.variant).toBe('ok');
      expect(result.id).toBeTruthy();
      expect(result.name).toBe('balance-non-negative');
      expect(result.kind).toBe('invariant');
      expect(result.status).toBe('unproven');
    });

    it('creates properties with different valid kinds', async () => {
      const kinds = ['invariant', 'precondition', 'postcondition', 'temporal', 'safety', 'liveness'];

      for (const kind of kinds) {
        const result = await run(formalPropertyHandler.define({
          name: `prop-${kind}`,
          kind,
          formal_language: 'smtlib',
          expression: `(assert (${kind}-holds))`,
          target_symbol: 'Target',
          scope: 'local',
          priority: 'optional',
        }));
        expect(result.variant).toBe('ok');
        expect(result.kind).toBe(kind);
      }
    });

    it('creates properties with different valid formal languages', async () => {
      const languages = ['smtlib', 'tlaplus', 'alloy', 'lean', 'dafny', 'cvl'];

      for (const lang of languages) {
        const result = await run(formalPropertyHandler.define({
          name: `prop-${lang}`,
          kind: 'invariant',
          formal_language: lang,
          expression: `expr-in-${lang}`,
          target_symbol: 'Target',
          scope: 'local',
          priority: 'optional',
        }));
        expect(result.variant).toBe('ok');
      }
    });

    it('rejects an invalid kind', async () => {
      const result = await run(formalPropertyHandler.define({
        name: 'bad-kind',
        kind: 'hypothesis',
        formal_language: 'smtlib',
        expression: '(assert true)',
        target_symbol: 'Target',
        scope: 'local',
        priority: 'required',
      }));

      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('kind');
      expect(result.message).toContain('hypothesis');
    });

    it('rejects an invalid formal_language', async () => {
      const result = await run(formalPropertyHandler.define({
        name: 'bad-lang',
        kind: 'invariant',
        formal_language: 'coq',
        expression: '(assert true)',
        target_symbol: 'Target',
        scope: 'local',
        priority: 'required',
      }));

      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('formal_language');
      expect(result.message).toContain('coq');
    });

    it('rejects an invalid scope', async () => {
      const result = await run(formalPropertyHandler.define({
        name: 'bad-scope',
        kind: 'invariant',
        formal_language: 'smtlib',
        expression: '(assert true)',
        target_symbol: 'Target',
        scope: 'module',
        priority: 'required',
      }));

      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('scope');
    });

    it('rejects an invalid priority', async () => {
      const result = await run(formalPropertyHandler.define({
        name: 'bad-priority',
        kind: 'invariant',
        formal_language: 'smtlib',
        expression: '(assert true)',
        target_symbol: 'Target',
        scope: 'local',
        priority: 'critical',
      }));

      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('priority');
    });
  });

  // ============================================================
  // prove action
  // ============================================================

  describe('prove', () => {
    it('transitions a property status to proved with evidence', async () => {
      const defined = await run(formalPropertyHandler.define({
        name: 'prov-test',
        kind: 'invariant',
        formal_language: 'smtlib',
        expression: '(assert (> x 0))',
        target_symbol: 'Prover',
        scope: 'local',
        priority: 'required',
      }));

      const result = await run(formalPropertyHandler.prove({
        id: defined.id as string,
        evidence_ref: 'proof://z3-output-abc',
      }));

      expect(result.variant).toBe('ok');
      expect(result.id).toBe(defined.id);
      expect(result.status).toBe('proved');
      expect(result.evidence_ref).toBe('proof://z3-output-abc');
    });

    it('returns notfound for a nonexistent property', async () => {
      const result = await run(formalPropertyHandler.prove({
        id: 'fp-does-not-exist',
        evidence_ref: 'proof://missing',
      }));

      expect(result.variant).toBe('notfound');
      expect(result.id).toBe('fp-does-not-exist');
    });
  });

  // ============================================================
  // refute action
  // ============================================================

  describe('refute', () => {
    it('transitions a property status to refuted with counterexample', async () => {
      const defined = await run(formalPropertyHandler.define({
        name: 'refute-test',
        kind: 'postcondition',
        formal_language: 'lean',
        expression: 'theorem post : result > 0',
        target_symbol: 'Refuter',
        scope: 'local',
        priority: 'required',
      }));

      const result = await run(formalPropertyHandler.refute({
        id: defined.id as string,
        evidence_ref: 'counterexample://lean-ce-42',
      }));

      expect(result.variant).toBe('ok');
      expect(result.id).toBe(defined.id);
      expect(result.status).toBe('refuted');
      expect(result.evidence_ref).toBe('counterexample://lean-ce-42');
    });

    it('returns notfound for a nonexistent property', async () => {
      const result = await run(formalPropertyHandler.refute({
        id: 'fp-nonexistent',
        evidence_ref: 'counterexample://none',
      }));

      expect(result.variant).toBe('notfound');
    });
  });

  // ============================================================
  // check action
  // ============================================================

  describe('check', () => {
    it('dispatches solver check and returns a result', async () => {
      const defined = await run(formalPropertyHandler.define({
        name: 'check-test',
        kind: 'safety',
        formal_language: 'tlaplus',
        expression: 'Safety == []P',
        target_symbol: 'Checker',
        scope: 'global',
        priority: 'required',
      }));

      const result = await run(formalPropertyHandler.check({
        id: defined.id as string,
        solver: 'z3',
      }));

      expect(result.variant).toBe('ok');
      expect(result.id).toBe(defined.id);
      expect(result.current_status).toBe('unproven');
      expect(['proved', 'refuted', 'unknown']).toContain(result.check_result);
      expect(result.solver).toBe('z3');
    });

    it('uses mock solver when no solver is specified', async () => {
      const defined = await run(formalPropertyHandler.define({
        name: 'check-default-solver',
        kind: 'invariant',
        formal_language: 'smtlib',
        expression: '(assert true)',
        target_symbol: 'DefaultSolver',
        scope: 'local',
        priority: 'optional',
      }));

      const result = await run(formalPropertyHandler.check({
        id: defined.id as string,
      }));

      expect(result.variant).toBe('ok');
      expect(result.solver).toBe('mock');
    });

    it('returns notfound for a nonexistent property', async () => {
      const result = await run(formalPropertyHandler.check({
        id: 'fp-ghost',
      }));

      expect(result.variant).toBe('notfound');
    });
  });

  // ============================================================
  // synthesize action
  // ============================================================

  describe('synthesize', () => {
    it('generates properties from an intent reference', async () => {
      const result = await run(formalPropertyHandler.synthesize({
        intent_ref: 'intent://transfer-funds',
        target_symbol: 'TransferService',
        formal_language: 'smtlib',
      }));

      expect(result.variant).toBe('ok');
      expect(result.intent_ref).toBe('intent://transfer-funds');
      expect(result.count).toBe(3); // invariant + precondition + postcondition

      const propertyIds = JSON.parse(result.property_ids as string) as string[];
      expect(propertyIds).toHaveLength(3);

      // Verify each synthesized property is stored and has unproven status
      for (const id of propertyIds) {
        const prop = await storage.get('formal-properties', id);
        expect(prop).toBeTruthy();
        expect(prop!.status).toBe('unproven');
        expect(prop!.target_symbol).toBe('TransferService');
        expect(prop!.formal_language).toBe('smtlib');
        expect(prop!.intent_ref).toBe('intent://transfer-funds');
      }
    });

    it('defaults to smtlib when formal_language is not provided', async () => {
      const result = await run(formalPropertyHandler.synthesize({
        intent_ref: 'intent://default-lang',
        target_symbol: 'DefaultLang',
      }));

      expect(result.variant).toBe('ok');
      const propertyIds = JSON.parse(result.property_ids as string) as string[];
      const firstProp = await storage.get('formal-properties', propertyIds[0]);
      expect(firstProp!.formal_language).toBe('smtlib');
    });
  });

  // ============================================================
  // coverage action
  // ============================================================

  describe('coverage', () => {
    it('reports correct coverage stats after define and prove', async () => {
      // Define two properties for the same target
      const p1 = await run(formalPropertyHandler.define({
        name: 'cov-prop-1',
        kind: 'invariant',
        formal_language: 'smtlib',
        expression: '(assert (> x 0))',
        target_symbol: 'CovTarget',
        scope: 'local',
        priority: 'required',
      }));

      const p2 = await run(formalPropertyHandler.define({
        name: 'cov-prop-2',
        kind: 'precondition',
        formal_language: 'smtlib',
        expression: '(assert (not (= input nil)))',
        target_symbol: 'CovTarget',
        scope: 'local',
        priority: 'required',
      }));

      // Prove one of them
      await run(formalPropertyHandler.prove({
        id: p1.id as string,
        evidence_ref: 'proof://z3-1',
      }));

      const result = await run(formalPropertyHandler.coverage({
        target_symbol: 'CovTarget',
      }));

      expect(result.variant).toBe('ok');
      expect(result.target_symbol).toBe('CovTarget');
      expect(result.total).toBe(2);
      expect(result.proved).toBe(1);
      expect(result.unproven).toBe(1);
      expect(result.refuted).toBe(0);
      expect(result.coverage_pct).toBe(0.5);
    });

    it('reports 100% coverage when all properties are proved', async () => {
      const p1 = await run(formalPropertyHandler.define({
        name: 'all-proved-1',
        kind: 'invariant',
        formal_language: 'lean',
        expression: 'theorem t1 : True',
        target_symbol: 'FullCov',
        scope: 'local',
        priority: 'required',
      }));

      await run(formalPropertyHandler.prove({
        id: p1.id as string,
        evidence_ref: 'proof://lean-1',
      }));

      const result = await run(formalPropertyHandler.coverage({
        target_symbol: 'FullCov',
      }));

      expect(result.variant).toBe('ok');
      expect(result.total).toBe(1);
      expect(result.proved).toBe(1);
      expect(result.coverage_pct).toBe(1);
    });

    it('reports 0 total when no properties exist for the target', async () => {
      const result = await run(formalPropertyHandler.coverage({
        target_symbol: 'NoPropTarget',
      }));

      expect(result.variant).toBe('ok');
      expect(result.total).toBe(0);
      expect(result.coverage_pct).toBe(0);
    });
  });

  // ============================================================
  // list action
  // ============================================================

  describe('list', () => {
    beforeEach(async () => {
      // Seed several properties with different attributes
      await run(formalPropertyHandler.define({
        name: 'list-inv-alpha',
        kind: 'invariant',
        formal_language: 'smtlib',
        expression: '(assert alpha)',
        target_symbol: 'Alpha',
        scope: 'local',
        priority: 'required',
      }));

      await run(formalPropertyHandler.define({
        name: 'list-pre-alpha',
        kind: 'precondition',
        formal_language: 'lean',
        expression: 'theorem pre_alpha',
        target_symbol: 'Alpha',
        scope: 'local',
        priority: 'optional',
      }));

      const betaProp = await run(formalPropertyHandler.define({
        name: 'list-inv-beta',
        kind: 'invariant',
        formal_language: 'smtlib',
        expression: '(assert beta)',
        target_symbol: 'Beta',
        scope: 'global',
        priority: 'required',
      }));

      // Prove the Beta property to create a different status
      await run(formalPropertyHandler.prove({
        id: betaProp.id as string,
        evidence_ref: 'proof://beta',
      }));
    });

    it('lists all properties when no filters provided', async () => {
      const result = await run(formalPropertyHandler.list({}));

      expect(result.variant).toBe('ok');
      expect(result.count).toBe(3);
    });

    it('filters by target_symbol', async () => {
      const result = await run(formalPropertyHandler.list({
        target_symbol: 'Alpha',
      }));

      expect(result.variant).toBe('ok');
      expect(result.count).toBe(2);
      const items = JSON.parse(result.items as string) as Array<{ target_symbol: string }>;
      expect(items.every(i => i.target_symbol === 'Alpha')).toBe(true);
    });

    it('filters by kind', async () => {
      const result = await run(formalPropertyHandler.list({
        kind: 'invariant',
      }));

      expect(result.variant).toBe('ok');
      expect(result.count).toBe(2);
      const items = JSON.parse(result.items as string) as Array<{ kind: string }>;
      expect(items.every(i => i.kind === 'invariant')).toBe(true);
    });

    it('filters by status', async () => {
      const result = await run(formalPropertyHandler.list({
        status: 'proved',
      }));

      expect(result.variant).toBe('ok');
      expect(result.count).toBe(1);
      const items = JSON.parse(result.items as string) as Array<{ status: string; target_symbol: string }>;
      expect(items[0].status).toBe('proved');
      expect(items[0].target_symbol).toBe('Beta');
    });

    it('combines multiple filters', async () => {
      const result = await run(formalPropertyHandler.list({
        target_symbol: 'Alpha',
        kind: 'invariant',
      }));

      expect(result.variant).toBe('ok');
      expect(result.count).toBe(1);
    });

    it('returns empty list when no properties match', async () => {
      const result = await run(formalPropertyHandler.list({
        target_symbol: 'NonexistentTarget',
      }));

      expect(result.variant).toBe('ok');
      expect(result.count).toBe(0);
    });
  });

  // ============================================================
  // invalidate action
  // ============================================================

  describe('invalidate', () => {
    it('resets a proved property to unproven', async () => {
      const defined = await run(formalPropertyHandler.define({
        name: 'invalidate-test',
        kind: 'invariant',
        formal_language: 'smtlib',
        expression: '(assert (> x 0))',
        target_symbol: 'InvalidateTarget',
        scope: 'local',
        priority: 'required',
      }));

      await run(formalPropertyHandler.prove({
        id: defined.id as string,
        evidence_ref: 'proof://z3-inv',
      }));

      const result = await run(formalPropertyHandler.invalidate({
        id: defined.id as string,
      }));

      expect(result.variant).toBe('ok');
      expect(result.previous_status).toBe('proved');
      expect(result.status).toBe('unproven');
    });

    it('resets a refuted property to unproven', async () => {
      const defined = await run(formalPropertyHandler.define({
        name: 'invalidate-refuted',
        kind: 'postcondition',
        formal_language: 'dafny',
        expression: 'ensures result > 0',
        target_symbol: 'RefutedTarget',
        scope: 'local',
        priority: 'required',
      }));

      await run(formalPropertyHandler.refute({
        id: defined.id as string,
        evidence_ref: 'counterexample://dafny-ce',
      }));

      const result = await run(formalPropertyHandler.invalidate({
        id: defined.id as string,
      }));

      expect(result.variant).toBe('ok');
      expect(result.previous_status).toBe('refuted');
      expect(result.status).toBe('unproven');
    });

    it('returns unchanged when property is already unproven', async () => {
      const defined = await run(formalPropertyHandler.define({
        name: 'already-unproven',
        kind: 'invariant',
        formal_language: 'smtlib',
        expression: '(assert true)',
        target_symbol: 'UnprovenTarget',
        scope: 'local',
        priority: 'optional',
      }));

      const result = await run(formalPropertyHandler.invalidate({
        id: defined.id as string,
      }));

      expect(result.variant).toBe('unchanged');
      expect(result.status).toBe('unproven');
    });

    it('returns notfound for a nonexistent property', async () => {
      const result = await run(formalPropertyHandler.invalidate({
        id: 'fp-nonexistent',
      }));

      expect(result.variant).toBe('notfound');
    });
  });

  // ============================================================
  // Integration: full property lifecycle flow
  // ============================================================

  describe('property lifecycle flow', () => {
    it('defines, proves, checks coverage, invalidates, and verifies coverage drops', async () => {
      // Define a property
      const defined = await run(formalPropertyHandler.define({
        name: 'lifecycle-invariant',
        kind: 'invariant',
        formal_language: 'smtlib',
        expression: '(assert (>= balance 0))',
        target_symbol: 'LifecycleModule',
        scope: 'local',
        priority: 'required',
      }));

      expect(defined.variant).toBe('ok');
      const propId = defined.id as string;

      // Coverage before proving: 0%
      const covBefore = await run(formalPropertyHandler.coverage({
        target_symbol: 'LifecycleModule',
      }));
      expect(covBefore.total).toBe(1);
      expect(covBefore.proved).toBe(0);
      expect(covBefore.coverage_pct).toBe(0);

      // Prove the property
      const proved = await run(formalPropertyHandler.prove({
        id: propId,
        evidence_ref: 'proof://lifecycle-z3',
      }));
      expect(proved.variant).toBe('ok');
      expect(proved.status).toBe('proved');

      // Coverage after proving: 100%
      const covAfter = await run(formalPropertyHandler.coverage({
        target_symbol: 'LifecycleModule',
      }));
      expect(covAfter.total).toBe(1);
      expect(covAfter.proved).toBe(1);
      expect(covAfter.coverage_pct).toBe(1);

      // Invalidate the property
      const invalidated = await run(formalPropertyHandler.invalidate({
        id: propId,
      }));
      expect(invalidated.variant).toBe('ok');
      expect(invalidated.previous_status).toBe('proved');
      expect(invalidated.status).toBe('unproven');

      // Coverage after invalidation: back to 0%
      const covFinal = await run(formalPropertyHandler.coverage({
        target_symbol: 'LifecycleModule',
      }));
      expect(covFinal.total).toBe(1);
      expect(covFinal.proved).toBe(0);
      expect(covFinal.unproven).toBe(1);
      expect(covFinal.coverage_pct).toBe(0);
    });

    it('defines invalid kind and receives invalid variant', async () => {
      const result = await run(formalPropertyHandler.define({
        name: 'bad-kind-flow',
        kind: 'theorem',
        formal_language: 'smtlib',
        expression: '(assert false)',
        target_symbol: 'BadKind',
        scope: 'local',
        priority: 'required',
      }));

      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('kind');
    });
  });
});
