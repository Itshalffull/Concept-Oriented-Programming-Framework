// ============================================================
// VerificationRun Handler Tests — Formal Verification Suite
//
// Tests for verification run lifecycle: starting, completing,
// timeout handling, cancellation, status tracking with progress,
// and cross-run comparison for regressions and improvements.
// See Architecture doc Section 18.4
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { verificationRunHandler } from '../handlers/ts/suites/formal-verification/verification-run.handler.js';
import { interpret } from '../runtime/interpreter.js';

describe('VerificationRun Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  async function run(program: any) {
    const execResult = await interpret(program, storage);
    return { variant: execResult.variant, ...execResult.output };
  }

  // ----------------------------------------------------------
  // start
  // ----------------------------------------------------------

  describe('start', () => {
    it('creates a run in "running" status with correct property count', async () => {
      const result = await run(verificationRunHandler.start({
        name: 'Password verification',
        property_ids: JSON.stringify(['prop-1', 'prop-2', 'prop-3']),
        solver_provider: 'z3',
        timeout_ms: 60000,
      }));

      expect(result.variant).toBe('ok');
      expect(result.id).toBeDefined();
      expect(result.status).toBe('running');
      expect(result.total_count).toBe(3);
      expect(result.started_at).toBeDefined();
    });

    it('rejects invalid JSON in property_ids', async () => {
      const result = await run(verificationRunHandler.start({
        name: 'Bad run',
        property_ids: 'not-json',
      }));

      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('valid JSON');
    });

    it('rejects an empty property_ids array', async () => {
      const result = await run(verificationRunHandler.start({
        name: 'Empty run',
        property_ids: JSON.stringify([]),
      }));

      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('non-empty');
    });
  });

  // ----------------------------------------------------------
  // complete
  // ----------------------------------------------------------

  describe('complete', () => {
    it('transitions a running run to "completed" with result counts', async () => {
      const started = await run(verificationRunHandler.start({
        name: 'Password verification',
        property_ids: JSON.stringify(['prop-1', 'prop-2', 'prop-3']),
      }));

      const result = await run(verificationRunHandler.complete({
        id: started.id,
        results: JSON.stringify({
          'prop-1': 'proved',
          'prop-2': 'proved',
          'prop-3': 'refuted',
        }),
        resource_usage: JSON.stringify({ cpu_ms: 1500, memory_mb: 256, solver_calls: 42 }),
      }));

      expect(result.variant).toBe('ok');
      expect(result.status).toBe('completed');
      expect(result.proved).toBe(2);
      expect(result.refuted).toBe(1);
      expect(result.unknown).toBe(0);
      expect(result.ended_at).toBeDefined();
    });

    it('rejects completing a non-running run', async () => {
      const started = await run(verificationRunHandler.start({
        name: 'Already done',
        property_ids: JSON.stringify(['prop-1']),
      }));

      // Complete it first
      await run(verificationRunHandler.complete({
        id: started.id,
        results: JSON.stringify({ 'prop-1': 'proved' }),
      }));

      // Try to complete again
      const result = await run(verificationRunHandler.complete({
        id: started.id,
        results: JSON.stringify({ 'prop-1': 'proved' }),
      }));

      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('not in running state');
    });
  });

  // ----------------------------------------------------------
  // timeout
  // ----------------------------------------------------------

  describe('timeout', () => {
    it('transitions to "timeout" with partial results and remaining count', async () => {
      const started = await run(verificationRunHandler.start({
        name: 'Slow verification',
        property_ids: JSON.stringify(['prop-1', 'prop-2', 'prop-3']),
        timeout_ms: 5000,
      }));

      const result = await run(verificationRunHandler.timeout({
        id: started.id,
        partial_results: JSON.stringify({
          'prop-1': 'proved',
        }),
      }));

      expect(result.variant).toBe('ok');
      expect(result.status).toBe('timeout');
      expect(result.completed_count).toBe(1);
      expect(result.remaining_count).toBe(2);
      expect(result.total_count).toBe(3);
      expect(result.ended_at).toBeDefined();
    });

    it('rejects timeout on a non-running run', async () => {
      const started = await run(verificationRunHandler.start({
        name: 'Cancelled run',
        property_ids: JSON.stringify(['prop-1']),
      }));

      await run(verificationRunHandler.cancel({ id: started.id }));

      const result = await run(verificationRunHandler.timeout({
        id: started.id,
        partial_results: JSON.stringify({}),
      }));

      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('not in running state');
    });
  });

  // ----------------------------------------------------------
  // cancel
  // ----------------------------------------------------------

  describe('cancel', () => {
    it('transitions a running run to "cancelled"', async () => {
      const started = await run(verificationRunHandler.start({
        name: 'Cancellable run',
        property_ids: JSON.stringify(['prop-1', 'prop-2']),
      }));

      const result = await run(verificationRunHandler.cancel({
        id: started.id,
      }));

      expect(result.variant).toBe('ok');
      expect(result.status).toBe('cancelled');
      expect(result.ended_at).toBeDefined();
    });

    it('rejects cancelling a non-running run', async () => {
      const started = await run(verificationRunHandler.start({
        name: 'Completed run',
        property_ids: JSON.stringify(['prop-1']),
      }));

      await run(verificationRunHandler.complete({
        id: started.id,
        results: JSON.stringify({ 'prop-1': 'proved' }),
      }));

      const result = await run(verificationRunHandler.cancel({
        id: started.id,
      }));

      expect(result.variant).toBe('invalid');
      expect(result.message).toContain('not in running state');
    });
  });

  // ----------------------------------------------------------
  // get_status
  // ----------------------------------------------------------

  describe('get_status', () => {
    it('reports running status with zero progress initially', async () => {
      const started = await run(verificationRunHandler.start({
        name: 'Status check run',
        property_ids: JSON.stringify(['prop-1', 'prop-2', 'prop-3']),
      }));

      const result = await run(verificationRunHandler.get_status({
        id: started.id,
      }));

      expect(result.variant).toBe('ok');
      expect(result.status).toBe('running');
      expect(result.completed_count).toBe(0);
      expect(result.total_count).toBe(3);
      expect(result.progress).toBe(0);
      expect(result.started_at).toBeDefined();
    });

    it('reports completed status with full progress', async () => {
      const started = await run(verificationRunHandler.start({
        name: 'Completed status check',
        property_ids: JSON.stringify(['prop-1', 'prop-2']),
      }));

      await run(verificationRunHandler.complete({
        id: started.id,
        results: JSON.stringify({ 'prop-1': 'proved', 'prop-2': 'refuted' }),
      }));

      const result = await run(verificationRunHandler.get_status({
        id: started.id,
      }));

      expect(result.variant).toBe('ok');
      expect(result.status).toBe('completed');
      expect(result.completed_count).toBe(2);
      expect(result.progress).toBe(1);
    });

    it('returns notfound for nonexistent run', async () => {
      const result = await run(verificationRunHandler.get_status({
        id: 'vr-nonexistent',
      }));

      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // compare
  // ----------------------------------------------------------

  describe('compare', () => {
    it('identifies regressions and improvements between two runs', async () => {
      // Run A: prop-1 proved, prop-2 proved, prop-3 refuted
      const runA = await run(verificationRunHandler.start({
        name: 'Baseline run',
        property_ids: JSON.stringify(['prop-1', 'prop-2', 'prop-3']),
      }));
      await run(verificationRunHandler.complete({
        id: runA.id,
        results: JSON.stringify({
          'prop-1': 'proved',
          'prop-2': 'proved',
          'prop-3': 'refuted',
        }),
      }));

      // Run B: prop-1 proved, prop-2 refuted (regression), prop-3 proved (improvement)
      const runB = await run(verificationRunHandler.start({
        name: 'Updated run',
        property_ids: JSON.stringify(['prop-1', 'prop-2', 'prop-3']),
      }));
      await run(verificationRunHandler.complete({
        id: runB.id,
        results: JSON.stringify({
          'prop-1': 'proved',
          'prop-2': 'refuted',
          'prop-3': 'proved',
        }),
      }));

      const result = await run(verificationRunHandler.compare({
        run_id_a: runA.id,
        run_id_b: runB.id,
      }));

      expect(result.variant).toBe('ok');

      const regressions = JSON.parse(result.regressions as string);
      const improvements = JSON.parse(result.improvements as string);
      const unchanged = JSON.parse(result.unchanged as string);

      // prop-2: proved -> refuted = regression
      expect(regressions).toContain('prop-2');
      expect(result.regression_count).toBe(1);

      // prop-3: refuted -> proved = improvement
      expect(improvements).toContain('prop-3');
      expect(result.improvement_count).toBe(1);

      // prop-1: proved -> proved = unchanged
      expect(unchanged).toContain('prop-1');
    });

    it('reports all unchanged when runs have identical results', async () => {
      const runA = await run(verificationRunHandler.start({
        name: 'Run A identical',
        property_ids: JSON.stringify(['prop-1', 'prop-2']),
      }));
      await run(verificationRunHandler.complete({
        id: runA.id,
        results: JSON.stringify({ 'prop-1': 'proved', 'prop-2': 'proved' }),
      }));

      const runB = await run(verificationRunHandler.start({
        name: 'Run B identical',
        property_ids: JSON.stringify(['prop-1', 'prop-2']),
      }));
      await run(verificationRunHandler.complete({
        id: runB.id,
        results: JSON.stringify({ 'prop-1': 'proved', 'prop-2': 'proved' }),
      }));

      const result = await run(verificationRunHandler.compare({
        run_id_a: runA.id,
        run_id_b: runB.id,
      }));

      expect(result.regression_count).toBe(0);
      expect(result.improvement_count).toBe(0);
      expect(result.unchanged_count).toBe(2);
    });

    it('returns notfound when a run ID does not exist', async () => {
      const runA = await run(verificationRunHandler.start({
        name: 'Existing run',
        property_ids: JSON.stringify(['prop-1']),
      }));

      const result = await run(verificationRunHandler.compare({
        run_id_a: runA.id,
        run_id_b: 'vr-nonexistent',
      }));

      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // Full flow: start -> get_status -> complete -> compare
  // ----------------------------------------------------------

  describe('full verification run lifecycle', () => {
    it('starts, checks status, completes, and compares runs end-to-end', async () => {
      // Start a run for Password concept with 3 properties
      const run1 = await run(verificationRunHandler.start({
        name: 'Password verification v1',
        property_ids: JSON.stringify(['strength_invariant', 'hash_collision', 'policy_compliance']),
        solver_provider: 'z3',
      }));
      expect(run1.variant).toBe('ok');
      expect(run1.status).toBe('running');

      // Check status — running, progress 0
      const status1 = await run(verificationRunHandler.get_status({ id: run1.id }));
      expect(status1.status).toBe('running');
      expect(status1.progress).toBe(0);
      expect(status1.total_count).toBe(3);

      // Complete with results: 2 proved, 1 refuted
      const completed1 = await run(verificationRunHandler.complete({
        id: run1.id,
        results: JSON.stringify({
          'strength_invariant': 'proved',
          'hash_collision': 'proved',
          'policy_compliance': 'refuted',
        }),
        resource_usage: JSON.stringify({ cpu_ms: 3200, memory_mb: 512, solver_calls: 87 }),
      }));
      expect(completed1.proved).toBe(2);
      expect(completed1.refuted).toBe(1);

      // Start a second run with different results
      const run2 = await run(verificationRunHandler.start({
        name: 'Password verification v2',
        property_ids: JSON.stringify(['strength_invariant', 'hash_collision', 'policy_compliance']),
        solver_provider: 'cvc5',
      }));

      // Complete second run: policy_compliance now proved, hash_collision now refuted
      await run(verificationRunHandler.complete({
        id: run2.id,
        results: JSON.stringify({
          'strength_invariant': 'proved',
          'hash_collision': 'refuted',
          'policy_compliance': 'proved',
        }),
      }));

      // Compare runs — identify regressions and improvements
      const comparison = await run(verificationRunHandler.compare({
        run_id_a: run1.id,
        run_id_b: run2.id,
      }));

      expect(comparison.variant).toBe('ok');

      const regressions = JSON.parse(comparison.regressions as string);
      const improvements = JSON.parse(comparison.improvements as string);

      // hash_collision: proved -> refuted = regression
      expect(regressions).toContain('hash_collision');

      // policy_compliance: refuted -> proved = improvement
      expect(improvements).toContain('policy_compliance');

      // strength_invariant: proved -> proved = unchanged
      expect(comparison.unchanged_count).toBe(1);
    });
  });
});
