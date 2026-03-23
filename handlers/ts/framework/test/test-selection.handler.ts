// @clef-handler style=functional
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

/** Normalize a value that may be an array, a string, or a test-gen list ref object */
function toStringArray(val: unknown): string[] | null {
  if (Array.isArray(val)) return val as string[];
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* not JSON */ }
    return [trimmed];
  }
  // Handle test generator's list ref: { type: "list", items: [{ type: "literal", value: "..." }, ...] }
  if (val && typeof val === 'object' && (val as any).type === 'list' && Array.isArray((val as any).items)) {
    return (val as any).items.map((item: any) => item.value ?? String(item));
  }
  return null;
}

const _handler: FunctionalConceptHandler = {
  analyze(input: Record<string, unknown>) {
    const changedSources = toStringArray(input.changedSources);

    // Empty or missing changedSources → noMappings
    if (!changedSources || changedSources.length === 0) {
      return complete(createProgram(), 'noMappings', { message: 'No changed sources provided' }) as StorageProgram<Result>;
    }

    // Non-empty changedSources: look up mappings and always return ok
    const testType = input.testType as string | undefined;
    let p = createProgram();
    p = find(p, MAPPINGS, {}, 'allMappings');
    p = mapBindings(p, (bindings) => {
      const allMappings = bindings.allMappings as Array<Record<string, unknown>>;
      const changedSet = new Set(changedSources);

      const affectedTests: Array<{
        testId: string;
        language: string;
        testType: string;
        relevance: number;
        reason: string;
      }> = [];

      for (const mapping of allMappings) {
        let coveredSources: string[];
        try { coveredSources = JSON.parse(mapping.coveredSources as string) as string[]; } catch { coveredSources = []; }
        const testId = mapping.testId as string;
        const language = mapping.language as string;
        const mappingTestType = (mapping.testType as string) || 'unit';

        // Filter by testType if specified
        if (testType && mappingTestType !== testType) continue;

        // Check direct coverage
        const directHit = coveredSources.some(s => changedSet.has(s));
        if (directHit) {
          affectedTests.push({ testId, language, testType: mappingTestType, relevance: 1.0, reason: 'direct-coverage' });
          continue;
        }

        // Check transitive dependency (simplified: partial path overlap)
        const transitiveHit = coveredSources.some(s =>
          changedSources.some(changed => s.includes(changed.split('/').pop()!) || changed.includes(s.split('/').pop()!)),
        );
        if (transitiveHit) {
          affectedTests.push({ testId, language, testType: mappingTestType, relevance: 0.7, reason: 'transitive-dep' });
        }
      }

      // Deduplicate by testId+language
      const seen = new Set<string>();
      return affectedTests.filter(t => {
        const key = `${t.testId}:${t.language}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }, 'deduplicated');

    return completeFrom(p, 'ok', (bindings) => ({ affectedTests: bindings.deduplicated })) as StorageProgram<Result>;
  },

  select(input: Record<string, unknown>) {
    if (!input.affectedTests || (typeof input.affectedTests === 'string' && (input.affectedTests as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'affectedTests is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const affectedTests = input.affectedTests as Array<{
      testId: string;
      language: string;
      testType: string;
      relevance: number;
    }>;
    const budget = input.budget as { maxDuration?: number; maxTests?: number } | null | undefined;

    if (!affectedTests || affectedTests.length === 0) {
      return complete(p, 'error', { message: 'No affected tests to select from' }) as StorageProgram<Result>;
    }

    // Sort by relevance descending (highest relevance first)
    const sorted = [...affectedTests].sort((a, b) => b.relevance - a.relevance);

    // Look up historical durations for each test
    for (let i = 0; i < sorted.length; i++) {
      const test = sorted[i];
      p = get(p, MAPPINGS, `${test.testId}:${test.language}`, `mapping_${i}`);
    }

    // Process all mappings in a single mapBindings to compute selection
    p = mapBindings(p, (bindings) => {
      let totalEstimatedDuration = 0;
      const selected: Array<{ testId: string; language: string; testType: string; priority: number }> = [];

      for (let i = 0; i < sorted.length; i++) {
        const test = sorted[i];
        const mapping = bindings[`mapping_${i}`] as Record<string, unknown> | null;
        const avgDuration = mapping ? (mapping.avgDuration as number) : 100;

        // Check budget constraints
        if (budget) {
          if (budget.maxTests && selected.length >= budget.maxTests) break;
          if (budget.maxDuration && totalEstimatedDuration + avgDuration > budget.maxDuration) {
            // Budget exceeded — return what we have with reduced confidence
            const missedTests = sorted.length - selected.length;
            const confidence = selected.length / sorted.length;
            return {
              budgetExceeded: true,
              selected: selected.map(s => ({ testId: s.testId })),
              missedTests,
              confidence,
              estimatedDuration: totalEstimatedDuration,
              selectedCount: selected.length,
              totalAffected: sorted.length,
            };
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

      return {
        budgetExceeded: false,
        selected,
        estimatedDuration: totalEstimatedDuration,
        selectedCount: selected.length,
        totalAffected: sorted.length,
        confidence: 1.0,
      };
    }, 'selectionResult');

    const selectionId = `sel-${Date.now()}`;

    // Branch on whether budget was exceeded
    p = branch(p,
      (bindings) => (bindings.selectionResult as any).budgetExceeded === true,
      // Then: budget exceeded
      (() => {
        let q = createProgram();

        q = putFrom(q, SELECTIONS, selectionId, (bindings) => {
          const result = bindings.selectionResult as any;
          return {
            id: selectionId,
            selectedCount: result.selectedCount,
            totalAffected: result.totalAffected,
            confidence: result.confidence,
            estimatedDuration: result.estimatedDuration,
            createdAt: new Date().toISOString(),
          };
        });

        return completeFrom(q, 'budgetInsufficient', (bindings) => {
          const result = bindings.selectionResult as any;
          return {
            selected: result.selected,
            missedTests: result.missedTests,
            confidence: result.confidence,
          };
        });
      })(),
      // Else: all tests selected
      (() => {
        let q = createProgram();

        q = putFrom(q, SELECTIONS, selectionId, (bindings) => {
          const result = bindings.selectionResult as any;
          return {
            id: selectionId,
            selectedCount: result.selectedCount,
            totalAffected: result.totalAffected,
            confidence: result.confidence,
            estimatedDuration: result.estimatedDuration,
            createdAt: new Date().toISOString(),
          };
        });

        return completeFrom(q, 'ok', (bindings) => {
          const result = bindings.selectionResult as any;
          return {
            selected: result.selected,
            estimatedDuration: result.estimatedDuration,
            confidence: result.confidence,
          };
        });
      })(),
    );

    return p as StorageProgram<Result>;
  },

  record(input: Record<string, unknown>) {
    if (!input.coveredSources || (typeof input.coveredSources === 'string' && (input.coveredSources as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'coveredSources is required' }) as StorageProgram<Result>;
    }
    // Validate passed: string "false" or boolean false → error (failing tests)
    const passedVal = input.passed;
    const passedFailed = passedVal === false || passedVal === 'false';
    if (passedFailed) {
      return complete(createProgram(), 'error', { message: 'test execution failed' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const testId = input.testId as string;
    const language = input.language as string;
    const testType = (input.testType as string) || 'unit';
    const coveredSources = toStringArray(input.coveredSources) || [];
    const duration = input.duration as number;
    const passed = input.passed as boolean;

    const mappingKey = `${testId}:${language}`;
    p = get(p, MAPPINGS, mappingKey, 'existing');

    // Compute updated stats from existing binding, then put the mapping
    p = mapBindings(p, (bindings) => {
      const existing = bindings.existing as Record<string, unknown> | null;

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

      return {
        mappingId,
        avgDuration,
        failureRate,
        runCount,
      };
    }, 'computed');

    p = putFrom(p, MAPPINGS, mappingKey, (bindings) => {
      const computed = bindings.computed as {
        mappingId: string;
        avgDuration: number;
        failureRate: number;
        runCount: number;
      };
      return {
        id: computed.mappingId,
        testId,
        language,
        testType,
        coveredSources: JSON.stringify(coveredSources),
        avgDuration: computed.avgDuration,
        failureRate: computed.failureRate,
        runCount: computed.runCount,
        lastExecuted: new Date().toISOString(),
      };
    });

    return completeFrom(p, 'ok', (bindings) => {
      const computed = bindings.computed as { mappingId: string };
      return { mapping: computed.mappingId };
    }) as StorageProgram<Result>;
  },

  statistics(input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, MAPPINGS, {}, 'allMappings');
    p = find(p, SELECTIONS, {}, 'allSelections');

    // Derive all statistics from bindings
    return completeFrom(p, 'ok', (bindings) => {
      const allMappings = bindings.allMappings as Array<Record<string, unknown>>;
      const allSelections = bindings.allSelections as Array<Record<string, unknown>>;

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

      return {
        stats: {
          totalMappings,
          avgSelectionRatio: Math.round(avgSelectionRatio * 1000) / 1000,
          avgConfidence: Math.round(avgConfidence * 1000) / 1000,
          lastUpdated: lastUpdated || new Date().toISOString(),
        },
      };
    }) as StorageProgram<Result>;
  },
};

export const testSelectionHandler = autoInterpret(_handler);
