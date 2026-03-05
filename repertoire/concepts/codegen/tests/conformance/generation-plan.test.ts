// ============================================================
// GenerationPlan Conformance Tests
//
// Validates passive run tracking: begin, recordStep, complete,
// status, summary, and history. GenerationPlan does NOT plan
// or query other concepts — syncs feed it all data.
// See clef-generation-suite.md Part 1.4
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/runtime';
import { generationPlanHandler } from '../../../../handlers/ts/framework/generation/generation-plan.handler.js';
import type { ConceptStorage } from '@clef/runtime';

describe('GenerationPlan conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- begin / recordStep / complete ---

  it('should track a full run lifecycle', async () => {
    // Begin
    const beginResult = await generationPlanHandler.begin({}, storage);
    expect(beginResult.variant).toBe('ok');
    const runId = beginResult.run as string;
    expect(runId).toBeDefined();

    // Record steps
    await generationPlanHandler.recordStep(
      { stepKey: 'framework:TypeScriptGen:password', status: 'done', filesProduced: 3, duration: 150, cached: false },
      storage,
    );
    await generationPlanHandler.recordStep(
      { stepKey: 'framework:RustGen:password', status: 'cached', cached: true },
      storage,
    );

    // Status
    const statusResult = await generationPlanHandler.status(
      { run: runId },
      storage,
    );
    expect(statusResult.variant).toBe('ok');
    const steps = statusResult.steps as any[];
    expect(steps).toHaveLength(2);

    // Complete
    const completeResult = await generationPlanHandler.complete({}, storage);
    expect(completeResult.variant).toBe('ok');
    expect(completeResult.run).toBe(runId);
  });

  // --- begin ---

  it('should create a new run with a unique ID', async () => {
    const r1 = await generationPlanHandler.begin({}, storage);
    await generationPlanHandler.complete({}, storage);
    const r2 = await generationPlanHandler.begin({}, storage);
    expect(r1.run).not.toBe(r2.run);
  });

  // --- recordStep ---

  it('should handle recordStep with no active run gracefully', async () => {
    const result = await generationPlanHandler.recordStep(
      { stepKey: 'orphan', status: 'done', cached: false },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('should record multiple steps in a run', async () => {
    const beginResult = await generationPlanHandler.begin({}, storage);
    const runId = beginResult.run as string;

    await generationPlanHandler.recordStep(
      { stepKey: 'step1', status: 'done', filesProduced: 2, duration: 50, cached: false },
      storage,
    );
    await generationPlanHandler.recordStep(
      { stepKey: 'step2', status: 'cached', cached: true },
      storage,
    );
    await generationPlanHandler.recordStep(
      { stepKey: 'step3', status: 'failed', cached: false },
      storage,
    );

    const statusResult = await generationPlanHandler.status(
      { run: runId },
      storage,
    );
    expect((statusResult.steps as any[]).length).toBe(3);
  });

  // --- summary ---

  it('should return correct summary statistics', async () => {
    const beginResult = await generationPlanHandler.begin({}, storage);
    const runId = beginResult.run as string;

    await generationPlanHandler.recordStep(
      { stepKey: 'step1', status: 'done', filesProduced: 3, duration: 100, cached: false },
      storage,
    );
    await generationPlanHandler.recordStep(
      { stepKey: 'step2', status: 'cached', cached: true },
      storage,
    );
    await generationPlanHandler.recordStep(
      { stepKey: 'step3', status: 'failed', cached: false },
      storage,
    );

    await generationPlanHandler.complete({}, storage);

    const result = await generationPlanHandler.summary(
      { run: runId },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.total).toBe(3);
    expect(result.executed).toBe(1);
    expect(result.cached).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.filesProduced).toBe(3);
  });

  // --- history ---

  it('should return recent runs', async () => {
    // Run 1
    await generationPlanHandler.begin({}, storage);
    await generationPlanHandler.recordStep(
      { stepKey: 's1', status: 'done', cached: false },
      storage,
    );
    await generationPlanHandler.complete({}, storage);

    // Run 2
    await generationPlanHandler.begin({}, storage);
    await generationPlanHandler.recordStep(
      { stepKey: 's2', status: 'cached', cached: true },
      storage,
    );
    await generationPlanHandler.complete({}, storage);

    const result = await generationPlanHandler.history({ limit: 10 }, storage);
    expect(result.variant).toBe('ok');
    const runs = result.runs as any[];
    expect(runs).toHaveLength(2);
  });

  it('should respect limit parameter', async () => {
    // Create 3 runs
    for (let i = 0; i < 3; i++) {
      await generationPlanHandler.begin({}, storage);
      await generationPlanHandler.complete({}, storage);
    }

    const result = await generationPlanHandler.history({ limit: 2 }, storage);
    const runs = result.runs as any[];
    expect(runs).toHaveLength(2);
  });

  // --- complete with no active run ---

  it('should handle complete with no active run', async () => {
    const result = await generationPlanHandler.complete({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.run).toBeNull();
  });
});
