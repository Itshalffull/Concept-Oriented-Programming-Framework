// ============================================================
// Test Selection Accuracy Integration Test
//
// Tests the Resource->TestSelection->Builder/test pipeline that
// sync chains would orchestrate:
// 1. TestSelection/record builds coverage database from test runs
// 2. Multiple tests recorded with different covered sources
// 3. TestSelection/analyze on changed source -> only affected tests
// 4. TestSelection/select with budget -> prioritized subset
// 5. TestSelection/statistics shows selection effectiveness
// 6. Non-matching changes produce no affected tests
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/kernel';
import { testSelectionHandler } from '../../implementations/typescript/test-selection.impl.js';
import type { ConceptStorage } from '@clef/kernel';

/**
 * Simulates recording a test run with its coverage data into the
 * TestSelection coverage database. In a real sync chain the Builder
 * concept would produce test results with coverage and TestSelection
 * would record the source-to-test mappings.
 */
async function recordTestCoverage(
  storage: ConceptStorage,
  testId: string,
  language: string,
  coveredSources: string[],
  duration: number,
  passed: boolean = true,
): Promise<Record<string, unknown>> {
  return testSelectionHandler.record(
    { testId, language, coveredSources, duration, passed },
    storage,
  );
}

describe('Test selection accuracy integration', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('should record test coverage mappings for multiple tests', async () => {
    const result1 = await recordTestCoverage(
      storage,
      'test-password-validate',
      'typescript',
      ['src/password.ts', 'src/crypto.ts'],
      120,
    );

    const result2 = await recordTestCoverage(
      storage,
      'test-user-create',
      'typescript',
      ['src/user.ts', 'src/db.ts'],
      200,
    );

    const result3 = await recordTestCoverage(
      storage,
      'test-session-auth',
      'typescript',
      ['src/session.ts', 'src/user.ts', 'src/crypto.ts'],
      350,
    );

    expect(result1.variant).toBe('ok');
    expect(result1.mapping).toBeDefined();
    expect(result2.variant).toBe('ok');
    expect(result2.mapping).toBeDefined();
    expect(result3.variant).toBe('ok');
    expect(result3.mapping).toBeDefined();
  });

  it('should identify affected tests when a covered source changes', async () => {
    // Build coverage database
    await recordTestCoverage(
      storage, 'test-password-validate', 'typescript',
      ['src/password.ts', 'src/crypto.ts'], 120,
    );
    await recordTestCoverage(
      storage, 'test-user-create', 'typescript',
      ['src/user.ts', 'src/db.ts'], 200,
    );
    await recordTestCoverage(
      storage, 'test-session-auth', 'typescript',
      ['src/session.ts', 'src/user.ts', 'src/crypto.ts'], 350,
    );

    // Change src/crypto.ts — should affect password-validate and session-auth
    const analyzeResult = await testSelectionHandler.analyze(
      { changedSources: ['src/crypto.ts'] },
      storage,
    );

    expect(analyzeResult.variant).toBe('ok');
    const affected = analyzeResult.affectedTests as Array<{ testId: string; relevance: number }>;
    expect(affected.length).toBeGreaterThanOrEqual(2);

    const affectedIds = affected.map(t => t.testId);
    expect(affectedIds).toContain('test-password-validate');
    expect(affectedIds).toContain('test-session-auth');
    // user-create does not cover crypto.ts
    expect(affectedIds).not.toContain('test-user-create');
  });

  it('should select prioritized subset of tests within budget constraints', async () => {
    // Build coverage database with varying durations
    await recordTestCoverage(
      storage, 'test-fast-unit', 'typescript',
      ['src/password.ts'], 50,
    );
    await recordTestCoverage(
      storage, 'test-medium-integration', 'typescript',
      ['src/password.ts', 'src/crypto.ts'], 300,
    );
    await recordTestCoverage(
      storage, 'test-slow-e2e', 'typescript',
      ['src/password.ts', 'src/user.ts', 'src/crypto.ts'], 800,
    );

    // Analyze changes
    const analyzeResult = await testSelectionHandler.analyze(
      { changedSources: ['src/password.ts'] },
      storage,
    );
    const affected = analyzeResult.affectedTests as Array<{
      testId: string;
      language: string;
      relevance: number;
    }>;

    // Select with a tight maxTests budget
    const selectResult = await testSelectionHandler.select(
      { affectedTests: affected, budget: { maxTests: 2 } },
      storage,
    );

    expect(selectResult.variant).toBe('ok');
    const selected = selectResult.selected as Array<{ testId: string; priority: number }>;
    expect(selected.length).toBeLessThanOrEqual(2);
    expect(selectResult.confidence).toBeDefined();
    // Tests should be ordered by priority
    for (let i = 1; i < selected.length; i++) {
      expect(selected[i - 1].priority).toBeLessThan(selected[i].priority);
    }
  });

  it('should report budget insufficient when duration budget is exceeded', async () => {
    // Record tests with known durations
    await recordTestCoverage(
      storage, 'test-a', 'typescript', ['src/core.ts'], 500,
    );
    await recordTestCoverage(
      storage, 'test-b', 'typescript', ['src/core.ts'], 500,
    );
    await recordTestCoverage(
      storage, 'test-c', 'typescript', ['src/core.ts'], 500,
    );

    // Analyze
    const analyzeResult = await testSelectionHandler.analyze(
      { changedSources: ['src/core.ts'] },
      storage,
    );
    const affected = analyzeResult.affectedTests as Array<{
      testId: string;
      language: string;
      relevance: number;
    }>;

    // Select with a tight duration budget that can only fit ~1 test
    const selectResult = await testSelectionHandler.select(
      { affectedTests: affected, budget: { maxDuration: 600 } },
      storage,
    );

    // Should be budgetInsufficient since we can't fit all tests
    if (affected.length > 1) {
      expect(selectResult.variant).toBe('budgetInsufficient');
      expect(selectResult.missedTests).toBeDefined();
      expect((selectResult.missedTests as number)).toBeGreaterThan(0);
      expect(selectResult.confidence).toBeDefined();
      expect((selectResult.confidence as number)).toBeLessThan(1.0);
    }
  });

  it('should show selection effectiveness via statistics', async () => {
    // Build coverage database and perform a selection
    await recordTestCoverage(
      storage, 'test-x', 'typescript', ['src/x.ts'], 100,
    );
    await recordTestCoverage(
      storage, 'test-y', 'typescript', ['src/y.ts'], 200,
    );
    await recordTestCoverage(
      storage, 'test-z', 'typescript', ['src/x.ts', 'src/z.ts'], 150,
    );

    // Perform an analysis and selection to generate history
    const analyzeResult = await testSelectionHandler.analyze(
      { changedSources: ['src/x.ts'] },
      storage,
    );
    const affected = analyzeResult.affectedTests as Array<{
      testId: string;
      language: string;
      relevance: number;
    }>;

    await testSelectionHandler.select(
      { affectedTests: affected },
      storage,
    );

    // Check statistics
    const statsResult = await testSelectionHandler.statistics({}, storage);

    expect(statsResult.variant).toBe('ok');
    const stats = statsResult.stats as {
      totalMappings: number;
      avgSelectionRatio: number;
      avgConfidence: number;
      lastUpdated: string;
    };

    expect(stats.totalMappings).toBe(3);
    expect(typeof stats.avgSelectionRatio).toBe('number');
    expect(typeof stats.avgConfidence).toBe('number');
    expect(stats.lastUpdated).toBeDefined();
    expect(typeof stats.lastUpdated).toBe('string');
  });

  it('should return no affected tests for changes to uncovered sources', async () => {
    // Build coverage database for specific sources
    await recordTestCoverage(
      storage, 'test-password', 'typescript',
      ['src/password.ts'], 100,
    );
    await recordTestCoverage(
      storage, 'test-user', 'typescript',
      ['src/user.ts'], 150,
    );

    // Change a source that no test covers
    const analyzeResult = await testSelectionHandler.analyze(
      { changedSources: ['src/completely-unrelated.ts'] },
      storage,
    );

    expect(analyzeResult.variant).toBe('ok');
    const affected = analyzeResult.affectedTests as Array<{ testId: string }>;
    expect(affected.length).toBe(0);
  });

  it('should return noMappings when no coverage data exists', async () => {
    // Analyze without any recorded coverage
    const result = await testSelectionHandler.analyze(
      { changedSources: ['src/anything.ts'] },
      storage,
    );

    expect(result.variant).toBe('noMappings');
    expect(result.message).toBeDefined();
  });
});
