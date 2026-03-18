// @migrated dsl-constructs 2026-03-18
// ============================================================
// TestSelection Concept Implementation
//
// Change-aware test selection using source-to-test coverage
// mappings. Selects minimum test set for confident defect
// detection given a code change.
// See Architecture doc Section 3.8
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

const MAPPINGS = 'test-selection-mappings';
const SELECTIONS = 'test-selection-history';
const STATS = 'test-selection-stats';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  analyze(input: Record<string, unknown>) {
    let p = createProgram();
    const changedSources = input.changedSources as string[];

    if (!changedSources || changedSources.length === 0) {
      return complete(p, 'noMappings', { message: 'No changed sources provided' }) as StorageProgram<Result>;
    }

    // Look up all coverage mappings
    p = find(p, MAPPINGS, 'allMappings');

    if (allMappings.length === 0) {
      return complete(p, 'noMappings', {
        message: 'No coverage mappings available — run tests with coverage first',
      }) as StorageProgram<Result>;
    }

    const testType = input.testType as string | undefined;

    // Find tests whose covered sources overlap with changed sources
    const affectedTests: Array<{
      testId: string;
      language: string;
      testType: string;
      relevance: number;
      reason: string;
    }> = [];

    const changedSet = new Set(changedSources);

    for (const mapping of allMappings) {
      const coveredSources = JSON.parse(mapping.coveredSources as string) as string[];
      const testId = mapping.testId as string;
      const language = mapping.language as string;
      const mappingTestType = (mapping.testType as string) || 'unit';

      // Filter by testType if specified
      if (testType && mappingTestType !== testType) continue;

      // Check direct coverage
      const directHit = coveredSources.some(s => changedSet.has(s));
      if (directHit) {
        affectedTests.push({
          testId,
          language,
          testType: mappingTestType,
          relevance: 1.0,
          reason: 'direct-coverage',
        });
        continue;
      }

      // Check transitive dependency (simplified: partial path overlap)
      const transitiveHit = coveredSources.some(s =>
        changedSources.some(changed => s.includes(changed.split('/').pop()!) || changed.includes(s.split('/').pop()!)),
      );
      if (transitiveHit) {
        affectedTests.push({
          testId,
          language,
          testType: mappingTestType,
          relevance: 0.7,
          reason: 'transitive-dep',
        });
      }
    }

    // Deduplicate by testId+language
    const seen = new Set<string>();
    const deduplicated = affectedTests.filter(t => {
      const key = `${t.testId}:${t.language}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return complete(p, 'ok', { affectedTests: deduplicated }) as StorageProgram<Result>;
  },

  select(input: Record<string, unknown>) {
    let p = createProgram();
    const affectedTests = input.affectedTests as Array<{
      testId: string;
      language: string;
      testType: string;
      relevance: number;
    }>;
    const budget = input.budget as { maxDuration?: number; maxTests?: number } | null | undefined;

    if (!affectedTests || affectedTests.length === 0) {
      return complete(p, 'ok', { selected: [], estimatedDuration: 0, confidence: 1.0 }) as StorageProgram<Result>;
    }

    // Sort by relevance descending (highest relevance first)
    const sorted = [...affectedTests].sort((a, b) => b.relevance - a.relevance);

    // Look up historical durations
    let totalEstimatedDuration = 0;
    const selected: Array<{ testId: string; language: string; testType: string; priority: number }> = [];

    for (let i = 0; i < sorted.length; i++) {
      const test = sorted[i];
      p = get(p, MAPPINGS, `${test.testId}:${test.language}`, 'mapping');
      const avgDuration = mapping ? (mapping.avgDuration as number) : 100;

      // Check budget constraints
      if (budget) {
        if (budget.maxTests && selected.length >= budget.maxTests) break;
        if (budget.maxDuration && totalEstimatedDuration + avgDuration > budget.maxDuration) {
          // Budget exceeded — return what we have with reduced confidence
          const missedTests = sorted.length - selected.length;
          const confidence = selected.length / sorted.length;

          const selectionId = `sel-${Date.now()}`;
          p = put(p, SELECTIONS, selectionId, {
            id: selectionId,
            selectedCount: selected.length,
            totalAffected: sorted.length,
            confidence,
            estimatedDuration: totalEstimatedDuration,
            createdAt: new Date().toISOString(),
          });

          return complete(p, 'budgetInsufficient', {
            selected: selected.map(s => ({ testId: s.testId })),
            missedTests,
            confidence,
          }) as StorageProgram<Result>;
        }
      }

      selected.push({
        testId: test.testId,
        language: test.language,
        testType: test.testType || 'unit',
        priority: i + 1,
      });
      totalEstimatedDuration += avgDuration;
    }

    // Confidence based on how many affected tests we're running
    const confidence = 1.0;

    const selectionId = `sel-${Date.now()}`;
    p = put(p, SELECTIONS, selectionId, {
      id: selectionId,
      selectedCount: selected.length,
      totalAffected: sorted.length,
      confidence,
      estimatedDuration: totalEstimatedDuration,
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { selected, estimatedDuration: totalEstimatedDuration, confidence }) as StorageProgram<Result>;
  },

  record(input: Record<string, unknown>) {
    let p = createProgram();
    const testId = input.testId as string;
    const language = input.language as string;
    const testType = (input.testType as string) || 'unit';
    const coveredSources = input.coveredSources as string[];
    const duration = input.duration as number;
    const passed = input.passed as boolean;

    const mappingKey = `${testId}:${language}`;
    p = get(p, MAPPINGS, mappingKey, 'existing');

    let avgDuration = duration;
    let failureRate = passed ? 0 : 1;
    let runCount = 1;

    if (existing) {
      const prevAvg = existing.avgDuration as number;
      const prevRate = existing.failureRate as number;
      const prevRuns = (existing.runCount as number) || 1;
      runCount = prevRuns + 1;
      avgDuration = Math.round((prevAvg * prevRuns + duration) / runCount);
      failureRate = (prevRate * prevRuns + (passed ? 0 : 1)) / runCount;
    }

    const mappingId = existing ? (existing.id as string) : `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    p = put(p, MAPPINGS, mappingKey, {
      id: mappingId,
      testId,
      language,
      testType,
      coveredSources: JSON.stringify(coveredSources),
      avgDuration,
      failureRate,
      runCount,
      lastExecuted: new Date().toISOString(),
    });

    return complete(p, 'ok', { mapping: mappingId }) as StorageProgram<Result>;
  },

  statistics(input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, MAPPINGS, 'allMappings');
    p = find(p, SELECTIONS, 'allSelections');

    const totalMappings = allMappings.length;

    let avgSelectionRatio = 0;
    let avgConfidence = 0;
    let lastUpdated = '';

    if (allSelections.length > 0) {
      let totalRatio = 0;
      let totalConf = 0;

      for (const sel of allSelections) {
        const selected = sel.selectedCount as number;
        const total = sel.totalAffected as number;
        totalRatio += total > 0 ? selected / total : 1;
        totalConf += sel.confidence as number;
        const created = sel.createdAt as string;
        if (created > lastUpdated) lastUpdated = created;
      }

      avgSelectionRatio = totalRatio / allSelections.length;
      avgConfidence = totalConf / allSelections.length;
    }

    if (!lastUpdated && allMappings.length > 0) {
      for (const m of allMappings) {
        const executed = m.lastExecuted as string;
        if (executed > lastUpdated) lastUpdated = executed;
      }
    }

    return complete(p, 'ok', {
      stats: {
        totalMappings,
        avgSelectionRatio: Math.round(avgSelectionRatio * 1000) / 1000,
        avgConfidence: Math.round(avgConfidence * 1000) / 1000,
        lastUpdated: lastUpdated || new Date().toISOString(),
      },
    }) as StorageProgram<Result>;
  },
};

export const testSelectionHandler = autoInterpret(_handler);
