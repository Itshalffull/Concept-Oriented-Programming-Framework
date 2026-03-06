// ============================================================
// SolverProvider Handler Tests
//
// Register, dispatch to, health-check, and manage external
// solver backends (SMT solvers, model checkers, proof assistants)
// as pluggable providers.
// See Architecture doc Section 18.5
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { solverProviderHandler } from '../handlers/ts/suites/formal-verification/solver-provider.handler.js';

describe('SolverProvider Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // ----- helpers -----
  async function registerZ3() {
    return solverProviderHandler.register!(
      {
        provider_id: 'z3',
        name: 'Z3 SMT Solver',
        supported_languages: JSON.stringify(['smtlib']),
        supported_kinds: JSON.stringify(['invariant', 'precondition', 'postcondition', 'safety']),
        endpoint: 'http://localhost:9001',
        priority: 1,
      },
      storage,
    );
  }

  async function registerAlloy() {
    return solverProviderHandler.register!(
      {
        provider_id: 'alloy',
        name: 'Alloy Analyzer',
        supported_languages: JSON.stringify(['alloy']),
        supported_kinds: JSON.stringify(['invariant', 'safety', 'temporal']),
        endpoint: 'http://localhost:9002',
        priority: 1,
      },
      storage,
    );
  }

  async function registerCVC5() {
    return solverProviderHandler.register!(
      {
        provider_id: 'cvc5',
        name: 'CVC5 SMT Solver',
        supported_languages: JSON.stringify(['smtlib']),
        supported_kinds: JSON.stringify(['invariant', 'precondition']),
        endpoint: 'http://localhost:9003',
        priority: 2,
      },
      storage,
    );
  }

  // ----- register -----
  describe('register', () => {
    it('registers a solver provider and returns ok', async () => {
      const result = await registerZ3();
      expect(result.variant).toBe('ok');
      expect(result.provider_id).toBe('z3');
      expect(result.name).toBe('Z3 SMT Solver');
      expect(result.status).toBe('active');
    });

    it('registers multiple providers with different IDs', async () => {
      const r1 = await registerZ3();
      const r2 = await registerAlloy();
      const r3 = await registerCVC5();
      expect(r1.variant).toBe('ok');
      expect(r2.variant).toBe('ok');
      expect(r3.variant).toBe('ok');
    });

    it('rejects duplicate provider_id registration', async () => {
      await registerZ3();
      const dup = await registerZ3();
      expect(dup.variant).toBe('duplicate');
      expect(dup.provider_id).toBe('z3');
    });
  });

  // ----- dispatch -----
  describe('dispatch', () => {
    it('selects Z3 for smtlib invariant (lowest priority wins)', async () => {
      await registerZ3();
      await registerCVC5();

      const result = await solverProviderHandler.dispatch!(
        { formal_language: 'smtlib', kind: 'invariant', property_ref: 'fp-001' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.provider_id).toBe('z3');
      expect(result.property_ref).toBe('fp-001');
      expect(result.run_ref).toBeDefined();
    });

    it('selects Alloy for alloy temporal property', async () => {
      await registerZ3();
      await registerAlloy();

      const result = await solverProviderHandler.dispatch!(
        { formal_language: 'alloy', kind: 'temporal', property_ref: 'fp-002' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.provider_id).toBe('alloy');
    });

    it('returns no_provider when no solver matches language+kind', async () => {
      await registerZ3();
      await registerAlloy();

      const result = await solverProviderHandler.dispatch!(
        { formal_language: 'tlaplus', kind: 'liveness', property_ref: 'fp-003' },
        storage,
      );
      expect(result.variant).toBe('no_provider');
      expect(result.formal_language).toBe('tlaplus');
      expect(result.kind).toBe('liveness');
    });
  });

  // ----- dispatch_batch -----
  describe('dispatch_batch', () => {
    it('assigns multiple properties to optimal providers', async () => {
      await registerZ3();
      await registerAlloy();
      await registerCVC5();

      const result = await solverProviderHandler.dispatch_batch!(
        {
          property_refs: JSON.stringify(['fp-batch-1', 'fp-batch-2', 'fp-batch-3']),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.assigned_count).toBe(3);

      const assignments = JSON.parse(result.assignments as string);
      expect(assignments).toHaveLength(3);
      // Z3 has lower priority (1) than CVC5 (2) for smtlib+invariant
      for (const a of assignments) {
        expect(a.provider_id).toBe('z3');
        expect(a.run_ref).toBeDefined();
      }
    });

    it('reports unassigned properties when no provider matches', async () => {
      // No providers registered at all
      const result = await solverProviderHandler.dispatch_batch!(
        {
          property_refs: JSON.stringify(['fp-orphan-1', 'fp-orphan-2']),
        },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.assigned_count).toBe(0);
      expect(result.unassigned_count).toBe(2);

      const unassigned = JSON.parse(result.unassigned as string);
      expect(unassigned).toContain('fp-orphan-1');
      expect(unassigned).toContain('fp-orphan-2');
    });
  });

  // ----- health_check -----
  describe('health_check', () => {
    it('returns ok with status and latency for a registered provider', async () => {
      await registerZ3();

      const result = await solverProviderHandler.health_check!(
        { provider_id: 'z3' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.provider_id).toBe('z3');
      expect(result.name).toBe('Z3 SMT Solver');
      expect(result.status).toBe('active');
      expect(typeof result.latency_ms).toBe('number');
    });

    it('returns notfound for an unregistered provider', async () => {
      const result = await solverProviderHandler.health_check!(
        { provider_id: 'nonexistent-solver' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  // ----- list -----
  describe('list', () => {
    it('returns all registered providers', async () => {
      await registerZ3();
      await registerAlloy();
      await registerCVC5();

      const result = await solverProviderHandler.list!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(3);

      const items = JSON.parse(result.items as string);
      const ids = items.map((i: any) => i.provider_id);
      expect(ids).toContain('z3');
      expect(ids).toContain('alloy');
      expect(ids).toContain('cvc5');
    });

    it('returns empty list when no providers exist', async () => {
      const result = await solverProviderHandler.list!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.count).toBe(0);
    });
  });

  // ----- unregister -----
  describe('unregister', () => {
    it('removes a registered provider', async () => {
      await registerZ3();
      await registerAlloy();
      await registerCVC5();

      const result = await solverProviderHandler.unregister!(
        { provider_id: 'cvc5' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.provider_id).toBe('cvc5');

      // Confirm list shrinks
      const listResult = await solverProviderHandler.list!({}, storage);
      expect(listResult.count).toBe(2);
      const items = JSON.parse(listResult.items as string);
      const ids = items.map((i: any) => i.provider_id);
      expect(ids).not.toContain('cvc5');
    });

    it('returns notfound when unregistering an unknown provider', async () => {
      const result = await solverProviderHandler.unregister!(
        { provider_id: 'not-registered' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  // ----- integrated flow -----
  describe('end-to-end provider lifecycle', () => {
    it('register, dispatch, unregister, re-dispatch flow', async () => {
      // Register three providers
      await registerZ3();
      await registerAlloy();
      await registerCVC5();

      // Dispatch smtlib invariant -> Z3 (priority 1 < 2)
      const d1 = await solverProviderHandler.dispatch!(
        { formal_language: 'smtlib', kind: 'invariant', property_ref: 'fp-flow-1' },
        storage,
      );
      expect(d1.variant).toBe('ok');
      expect(d1.provider_id).toBe('z3');

      // Unregister CVC5
      await solverProviderHandler.unregister!({ provider_id: 'cvc5' }, storage);

      // List should show 2
      const list = await solverProviderHandler.list!({}, storage);
      expect(list.count).toBe(2);

      // Health check Z3
      const hc = await solverProviderHandler.health_check!({ provider_id: 'z3' }, storage);
      expect(hc.variant).toBe('ok');
      expect(hc.status).toBe('active');

      // Batch dispatch with remaining providers
      const batch = await solverProviderHandler.dispatch_batch!(
        { property_refs: JSON.stringify(['fp-b1', 'fp-b2']) },
        storage,
      );
      expect(batch.variant).toBe('ok');
      expect(batch.assigned_count).toBe(2);
    });
  });
});
