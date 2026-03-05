// ============================================================
// TestSelection Conformance Tests
//
// Validates change-aware test selection: analyzing source changes
// against coverage mappings, selecting minimum test sets within
// budget constraints, recording coverage data, and computing
// selection statistics.
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/runtime';
import { testSelectionHandler } from '../../../../handlers/ts/framework/test/test-selection.handler.js';
import type { ConceptStorage } from '@clef/runtime';

describe('TestSelection conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- record: ok ---

  it('should record a coverage mapping and return a mapping id', async () => {
    const result = await testSelectionHandler.record(
      {
        testId: 'test-password-validate',
        language: 'typescript',
        coveredSources: ['src/password.ts', 'src/hash.ts'],
        duration: 120,
        passed: true,
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.mapping).toBeDefined();
    expect(typeof result.mapping).toBe('string');
  });

  it('should update existing mapping with averaged duration on repeated record', async () => {
    await testSelectionHandler.record(
      {
        testId: 'test-user-create',
        language: 'typescript',
        coveredSources: ['src/user.ts'],
        duration: 100,
        passed: true,
      },
      storage,
    );

    const result = await testSelectionHandler.record(
      {
        testId: 'test-user-create',
        language: 'typescript',
        coveredSources: ['src/user.ts'],
        duration: 200,
        passed: true,
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.mapping).toBeDefined();
  });

  // --- analyze: ok ---

  it('should return affected tests for changed sources with direct coverage', async () => {
    // Record coverage mappings first
    await testSelectionHandler.record(
      {
        testId: 'test-password-validate',
        language: 'typescript',
        coveredSources: ['src/password.ts', 'src/hash.ts'],
        duration: 100,
        passed: true,
      },
      storage,
    );
    await testSelectionHandler.record(
      {
        testId: 'test-user-create',
        language: 'typescript',
        coveredSources: ['src/user.ts', 'src/db.ts'],
        duration: 150,
        passed: true,
      },
      storage,
    );

    const result = await testSelectionHandler.analyze(
      { changedSources: ['src/password.ts'] },
      storage,
    );
    expect(result.variant).toBe('ok');
    const affected = result.affectedTests as any[];
    expect(affected.length).toBeGreaterThanOrEqual(1);

    const passwordTest = affected.find((t: any) => t.testId === 'test-password-validate');
    expect(passwordTest).toBeDefined();
    expect(passwordTest.relevance).toBeDefined();
    expect(typeof passwordTest.relevance).toBe('number');
    expect(passwordTest.language).toBe('typescript');
  });

  it('should return multiple affected tests when change touches shared sources', async () => {
    await testSelectionHandler.record(
      {
        testId: 'test-a',
        language: 'typescript',
        coveredSources: ['src/shared.ts', 'src/a.ts'],
        duration: 50,
        passed: true,
      },
      storage,
    );
    await testSelectionHandler.record(
      {
        testId: 'test-b',
        language: 'typescript',
        coveredSources: ['src/shared.ts', 'src/b.ts'],
        duration: 75,
        passed: true,
      },
      storage,
    );

    const result = await testSelectionHandler.analyze(
      { changedSources: ['src/shared.ts'] },
      storage,
    );
    expect(result.variant).toBe('ok');
    const affected = result.affectedTests as any[];
    expect(affected.length).toBeGreaterThanOrEqual(2);
  });

  // --- analyze: noMappings ---

  it('should return noMappings when no coverage data exists', async () => {
    const result = await testSelectionHandler.analyze(
      { changedSources: ['src/unknown.ts'] },
      storage,
    );
    expect(result.variant).toBe('noMappings');
    expect(result.message).toBeDefined();
    expect(typeof result.message).toBe('string');
  });

  it('should return noMappings when no changed sources provided', async () => {
    const result = await testSelectionHandler.analyze(
      { changedSources: [] },
      storage,
    );
    expect(result.variant).toBe('noMappings');
  });

  // --- select: ok ---

  it('should select tests sorted by relevance with duration estimate and confidence', async () => {
    const affectedTests = [
      { testId: 'test-a', language: 'typescript', relevance: 1.0 },
      { testId: 'test-b', language: 'typescript', relevance: 0.7 },
      { testId: 'test-c', language: 'typescript', relevance: 0.9 },
    ];

    const result = await testSelectionHandler.select(
      { affectedTests },
      storage,
    );
    expect(result.variant).toBe('ok');
    const selected = result.selected as any[];
    expect(selected).toHaveLength(3);
    expect(typeof result.estimatedDuration).toBe('number');
    expect(result.estimatedDuration).toBeGreaterThanOrEqual(0);
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBe(1.0);
  });

  it('should return empty selection with full confidence when no tests affected', async () => {
    const result = await testSelectionHandler.select(
      { affectedTests: [] },
      storage,
    );
    expect(result.variant).toBe('ok');
    const selected = result.selected as any[];
    expect(selected).toHaveLength(0);
    expect(result.estimatedDuration).toBe(0);
    expect(result.confidence).toBe(1.0);
  });

  // --- select: budgetInsufficient ---

  it('should return budgetInsufficient when duration budget is exceeded', async () => {
    // Record mappings with known durations
    await testSelectionHandler.record(
      {
        testId: 'test-slow-a',
        language: 'typescript',
        coveredSources: ['src/a.ts'],
        duration: 500,
        passed: true,
      },
      storage,
    );
    await testSelectionHandler.record(
      {
        testId: 'test-slow-b',
        language: 'typescript',
        coveredSources: ['src/b.ts'],
        duration: 500,
        passed: true,
      },
      storage,
    );

    const affectedTests = [
      { testId: 'test-slow-a', language: 'typescript', relevance: 1.0 },
      { testId: 'test-slow-b', language: 'typescript', relevance: 0.8 },
    ];

    const result = await testSelectionHandler.select(
      { affectedTests, budget: { maxDuration: 400 } },
      storage,
    );
    expect(result.variant).toBe('budgetInsufficient');
    expect(result.missedTests).toBeDefined();
    expect(typeof result.missedTests).toBe('number');
    expect(result.missedTests).toBeGreaterThan(0);
    expect(result.confidence).toBeDefined();
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeLessThan(1.0);
  });

  // --- statistics ---

  it('should return aggregate statistics after recording and selecting', async () => {
    // Record some mappings
    await testSelectionHandler.record(
      {
        testId: 'test-stats-a',
        language: 'typescript',
        coveredSources: ['src/stats-a.ts'],
        duration: 100,
        passed: true,
      },
      storage,
    );
    await testSelectionHandler.record(
      {
        testId: 'test-stats-b',
        language: 'typescript',
        coveredSources: ['src/stats-b.ts'],
        duration: 200,
        passed: false,
      },
      storage,
    );

    // Perform a selection so selection history exists
    await testSelectionHandler.select(
      {
        affectedTests: [
          { testId: 'test-stats-a', language: 'typescript', relevance: 1.0 },
        ],
      },
      storage,
    );

    const result = await testSelectionHandler.statistics({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.stats).toBeDefined();
    const stats = result.stats as any;
    expect(typeof stats.totalMappings).toBe('number');
    expect(stats.totalMappings).toBeGreaterThanOrEqual(2);
    expect(typeof stats.avgSelectionRatio).toBe('number');
    expect(typeof stats.avgConfidence).toBe('number');
    expect(stats.lastUpdated).toBeDefined();
    expect(typeof stats.lastUpdated).toBe('string');
  });

  it('should return zero-value statistics when no data exists', async () => {
    const result = await testSelectionHandler.statistics({}, storage);
    expect(result.variant).toBe('ok');
    const stats = result.stats as any;
    expect(stats.totalMappings).toBe(0);
  });

  // --- invariant: record->ok then analyze->ok ---

  it('should find recorded coverage in subsequent analysis', async () => {
    // Record coverage
    const recordResult = await testSelectionHandler.record(
      {
        testId: 'test-invariant-check',
        language: 'typescript',
        coveredSources: ['src/invariant-target.ts'],
        duration: 80,
        passed: true,
      },
      storage,
    );
    expect(recordResult.variant).toBe('ok');

    // Analyze with a change to the covered source
    const analyzeResult = await testSelectionHandler.analyze(
      { changedSources: ['src/invariant-target.ts'] },
      storage,
    );
    expect(analyzeResult.variant).toBe('ok');
    const affected = analyzeResult.affectedTests as any[];
    expect(affected.length).toBeGreaterThanOrEqual(1);

    const match = affected.find((t: any) => t.testId === 'test-invariant-check');
    expect(match).toBeDefined();
    expect(match.language).toBe('typescript');
  });
});
