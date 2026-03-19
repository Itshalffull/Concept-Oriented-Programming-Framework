// @migrated dsl-constructs 2026-03-18
// ============================================================
// FlakyTest Concept Implementation
//
// Detects, tracks, and quarantines unreliable tests across all
// languages and builders. Maintains per-test reliability history
// and quarantine status with configurable detection policy.
// See Architecture doc Section 3.8
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

const TESTS = 'flaky-tests';
const POLICY = 'flaky-policy';

const DEFAULT_POLICY = {
  flipThreshold: 3,
  flipWindow: '7d',
  autoQuarantine: false,
  retryCount: 1,
};

function parseWindowMs(window: string): number {
  const match = window.match(/^(\d+)([dhms])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7d
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'm': return value * 60 * 1000;
    case 's': return value * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

function resolvePolicy(stored: Record<string, unknown> | null): {
  flipThreshold: number;
  flipWindow: string;
  autoQuarantine: boolean;
  retryCount: number;
} {
  if (!stored) return { ...DEFAULT_POLICY };
  return {
    flipThreshold: (stored.flipThreshold as number) ?? DEFAULT_POLICY.flipThreshold,
    flipWindow: (stored.flipWindow as string) ?? DEFAULT_POLICY.flipWindow,
    autoQuarantine: (stored.autoQuarantine as boolean) ?? DEFAULT_POLICY.autoQuarantine,
    retryCount: (stored.retryCount as number) ?? DEFAULT_POLICY.retryCount,
  };
}

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {
  record(input: Record<string, unknown>) {
    let p = createProgram();
    const testId = input.testId as string;
    const language = input.language as string;
    const builder = input.builder as string;
    const testType = (input.testType as string) || 'unit';
    const passed = input.passed as boolean;
    const duration = input.duration as number;

    p = get(p, TESTS, testId, 'existing');
    p = get(p, POLICY, 'current', 'storedPolicy');

    // Compute record data, flip counting, and flaky threshold check
    p = mapBindings(p, (bindings) => {
      const existing = bindings.existing as Record<string, unknown> | null;
      const policy = resolvePolicy(bindings.storedPolicy as Record<string, unknown> | null);
      const now = new Date().toISOString();

      let results: Array<{ passed: boolean; timestamp: string; duration: number }> = [];
      let flipCount = 0;
      let lastFlipAt: string | null = null;
      let quarantined = false;
      let quarantinedAt: string | null = null;
      let quarantinedBy: string | null = null;
      let reason: string | null = null;
      let owner: string | null = null;

      if (existing) {
        results = JSON.parse(existing.results as string);
        flipCount = existing.flipCount as number;
        lastFlipAt = existing.lastFlipAt as string | null;
        quarantined = existing.quarantined as boolean;
        quarantinedAt = existing.quarantinedAt as string | null;
        quarantinedBy = existing.quarantinedBy as string | null;
        reason = existing.reason as string | null;
        owner = existing.owner as string | null;

        // Check if this result is a flip (different from last result)
        if (results.length > 0) {
          const lastResult = results[results.length - 1];
          if (lastResult.passed !== passed) {
            flipCount++;
            lastFlipAt = now;
          }
        }
      }

      // Add new result
      results.push({ passed, timestamp: now, duration });

      // Trim results to keep within window
      const windowMs = parseWindowMs(policy.flipWindow);
      const cutoff = new Date(Date.now() - windowMs).toISOString();
      results = results.filter(r => r.timestamp >= cutoff);

      // Recount flips within window
      let windowFlipCount = 0;
      for (let i = 1; i < results.length; i++) {
        if (results[i].passed !== results[i - 1].passed) {
          windowFlipCount++;
        }
      }

      const testRef = existing ? (existing.id as string) : `flaky-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const record: Record<string, unknown> = {
        id: testRef,
        testId,
        language,
        builder,
        testType,
        results: JSON.stringify(results),
        flipCount: windowFlipCount,
        lastFlipAt,
        quarantined,
        quarantinedAt,
        quarantinedBy,
        reason,
        owner,
      };

      // Check if flaky threshold exceeded and auto-quarantine
      if (windowFlipCount >= policy.flipThreshold && policy.autoQuarantine && !quarantined) {
        record.quarantined = true;
        record.quarantinedAt = now;
        record.quarantinedBy = 'auto';
        record.reason = `Auto-quarantined: ${windowFlipCount} flips in ${policy.flipWindow}`;
      }

      return {
        record,
        testRef,
        windowFlipCount,
        flakyThresholdExceeded: windowFlipCount >= policy.flipThreshold,
        recentResults: results.map(r => r.passed),
      };
    }, 'computed');

    // Write the record to storage
    p = putFrom(p, TESTS, testId, (bindings) => {
      const computed = bindings.computed as { record: Record<string, unknown> };
      return computed.record;
    });

    // Branch on whether flaky threshold exceeded
    return branch(
      p,
      (bindings) => {
        const computed = bindings.computed as { flakyThresholdExceeded: boolean };
        return computed.flakyThresholdExceeded;
      },
      (tp) => completeFrom(tp, 'flakyDetected', (bindings) => {
        const computed = bindings.computed as { testRef: string; windowFlipCount: number; recentResults: boolean[] };
        return { test: computed.testRef, flipCount: computed.windowFlipCount, recentResults: computed.recentResults };
      }),
      (ep) => completeFrom(ep, 'ok', (bindings) => {
        const computed = bindings.computed as { testRef: string };
        return { test: computed.testRef };
      }),
    ) as StorageProgram<Result>;
  },

  quarantine(input: Record<string, unknown>) {
    let p = createProgram();
    const testId = input.testId as string;
    const reasonText = input.reason as string;
    const owner = input.owner as string | undefined;

    // Find the test record
    p = find(p, TESTS, { testId }, 'allTests');

    // Compute: found test, already quarantined, and updated record
    p = mapBindings(p, (bindings) => {
      const allTests = bindings.allTests as Array<Record<string, unknown>>;
      if (!allTests || allTests.length === 0) {
        return { found: false, alreadyQuarantined: false, testRef: null, updatedRecord: null };
      }
      const test = allTests[0];
      const isQuarantined = test.quarantined as boolean;
      const now = new Date().toISOString();
      return {
        found: true,
        alreadyQuarantined: isQuarantined,
        testRef: test.id as string,
        updatedRecord: {
          ...test,
          quarantined: true,
          quarantinedAt: now,
          quarantinedBy: owner || 'manual',
          reason: reasonText,
          owner: owner || null,
        },
      };
    }, 'computed');

    // Branch: not found -> 'notFound'
    return branch(
      p,
      (bindings) => {
        const computed = bindings.computed as { found: boolean };
        return !computed.found;
      },
      // Not found
      (tp) => complete(tp, 'notFound', { testId } as Record<string, unknown>),
      // Found — check if already quarantined
      (ep) => branch(
        ep,
        (bindings) => {
          const computed = bindings.computed as { alreadyQuarantined: boolean };
          return computed.alreadyQuarantined;
        },
        // Already quarantined
        (tp2) => completeFrom(tp2, 'alreadyQuarantined', (bindings) => {
          const computed = bindings.computed as { testRef: string };
          return { test: computed.testRef };
        }),
        // Not quarantined — write updated record, then complete with 'ok'
        (ep2) => {
          let q = putFrom(ep2, TESTS, testId, (bindings) => {
            const computed = bindings.computed as { updatedRecord: Record<string, unknown> };
            return computed.updatedRecord;
          });
          return completeFrom(q, 'ok', (bindings) => {
            const computed = bindings.computed as { testRef: string };
            return { test: computed.testRef };
          });
        },
      ),
    ) as StorageProgram<Result>;
  },

  release(input: Record<string, unknown>) {
    let p = createProgram();
    const testId = input.testId as string;

    p = find(p, TESTS, { testId }, 'allTests');

    // Compute: found test, is quarantined
    p = mapBindings(p, (bindings) => {
      const allTests = bindings.allTests as Array<Record<string, unknown>>;
      if (!allTests || allTests.length === 0) {
        return { found: false, isQuarantined: false, testRef: null, releasedRecord: null };
      }
      const test = allTests[0];
      return {
        found: true,
        isQuarantined: test.quarantined as boolean,
        testRef: test.id as string,
        releasedRecord: {
          ...test,
          quarantined: false,
          quarantinedAt: null,
          quarantinedBy: null,
          reason: null,
        },
      };
    }, 'computed');

    // Branch: not found -> 'notQuarantined'
    return branch(
      p,
      (bindings) => {
        const computed = bindings.computed as { found: boolean };
        return !computed.found;
      },
      // Not found
      (tp) => complete(tp, 'notQuarantined', { test: testId } as Record<string, unknown>),
      // Found — check if quarantined
      (ep) => branch(
        ep,
        (bindings) => {
          const computed = bindings.computed as { isQuarantined: boolean };
          return !computed.isQuarantined;
        },
        // Not quarantined
        (tp2) => completeFrom(tp2, 'notQuarantined', (bindings) => {
          const computed = bindings.computed as { testRef: string };
          return { test: computed.testRef };
        }),
        // Quarantined — clear quarantine, then complete with 'ok'
        (ep2) => {
          let q = putFrom(ep2, TESTS, testId, (bindings) => {
            const computed = bindings.computed as { releasedRecord: Record<string, unknown> };
            return computed.releasedRecord;
          });
          return completeFrom(q, 'ok', (bindings) => {
            const computed = bindings.computed as { testRef: string };
            return { test: computed.testRef };
          });
        },
      ),
    ) as StorageProgram<Result>;
  },

  isQuarantined(input: Record<string, unknown>) {
    let p = createProgram();
    const testId = input.testId as string;

    p = find(p, TESTS, { testId }, 'allTests');

    // Compute: found, quarantine status
    p = mapBindings(p, (bindings) => {
      const allTests = bindings.allTests as Array<Record<string, unknown>>;
      if (!allTests || allTests.length === 0) {
        return { found: false, quarantined: false, testRef: null, reason: null, owner: null, quarantinedAt: null };
      }
      const test = allTests[0];
      return {
        found: true,
        quarantined: test.quarantined as boolean,
        testRef: test.id as string,
        reason: test.reason as string,
        owner: test.owner as string | null,
        quarantinedAt: test.quarantinedAt as string,
      };
    }, 'computed');

    // Branch: not found -> 'unknown'
    return branch(
      p,
      (bindings) => {
        const computed = bindings.computed as { found: boolean };
        return !computed.found;
      },
      // Not found
      (tp) => complete(tp, 'unknown', { testId } as Record<string, unknown>),
      // Found — check if quarantined
      (ep) => branch(
        ep,
        (bindings) => {
          const computed = bindings.computed as { quarantined: boolean };
          return computed.quarantined;
        },
        // Quarantined
        (tp2) => completeFrom(tp2, 'yes', (bindings) => {
          const computed = bindings.computed as { testRef: string; reason: string; owner: string | null; quarantinedAt: string };
          return { test: computed.testRef, reason: computed.reason, owner: computed.owner, quarantinedAt: computed.quarantinedAt };
        }),
        // Not quarantined
        (ep2) => completeFrom(ep2, 'no', (bindings) => {
          const computed = bindings.computed as { testRef: string };
          return { test: computed.testRef };
        }),
      ),
    ) as StorageProgram<Result>;
  },

  report(input: Record<string, unknown>) {
    let p = createProgram();
    const testTypeFilter = input.testType as string | undefined;
    p = find(p, TESTS, {}, 'allTests');
    p = get(p, POLICY, 'current', 'storedPolicy');

    return completeFrom(p, 'ok', (bindings) => {
      const allTests = bindings.allTests as Array<Record<string, unknown>>;
      const policy = resolvePolicy(bindings.storedPolicy as Record<string, unknown> | null);

      let totalTracked = 0;
      let currentlyFlaky = 0;
      let quarantinedCount = 0;
      let stabilized = 0;

      const topFlaky: Array<{
        testId: string;
        language: string;
        testType: string;
        flipCount: number;
        owner: string | null;
      }> = [];

      for (const test of allTests) {
        const testTestType = (test.testType as string) || 'unit';
        if (testTypeFilter && testTestType !== testTypeFilter) continue;
        totalTracked++;
        const flipCount = test.flipCount as number;
        const isQuarantined = test.quarantined as boolean;

        if (flipCount >= policy.flipThreshold) {
          currentlyFlaky++;
        }

        if (isQuarantined) {
          quarantinedCount++;

          // Check if stabilized (quarantined but passing consistently)
          const results = JSON.parse(test.results as string) as Array<{ passed: boolean }>;
          const recentResults = results.slice(-5);
          const allPassing = recentResults.length >= 3 && recentResults.every(r => r.passed);
          if (allPassing) {
            stabilized++;
          }
        }

        if (flipCount > 0) {
          topFlaky.push({
            testId: test.testId as string,
            language: test.language as string,
            testType: (test.testType as string) || 'unit',
            flipCount,
            owner: test.owner as string | null,
          });
        }
      }

      // Sort topFlaky by flipCount descending
      topFlaky.sort((a, b) => b.flipCount - a.flipCount);

      return {
        summary: {
          totalTracked,
          currentlyFlaky,
          quarantined: quarantinedCount,
          stabilized,
          topFlaky: topFlaky.slice(0, 10),
        },
      };
    }) as StorageProgram<Result>;
  },

  setPolicy(input: Record<string, unknown>) {
    let p = createProgram();
    p = get(p, POLICY, 'current', 'storedPolicy');

    // Compute the new policy from existing + input overrides
    p = mapBindings(p, (bindings) => {
      const existing = resolvePolicy(bindings.storedPolicy as Record<string, unknown> | null);
      return {
        flipThreshold: (input.flipThreshold as number) ?? existing.flipThreshold,
        flipWindow: (input.flipWindow as string) ?? existing.flipWindow,
        autoQuarantine: (input.autoQuarantine as boolean) ?? existing.autoQuarantine,
        retryCount: (input.retryCount as number) ?? existing.retryCount,
      };
    }, 'newPolicy');

    // Write the policy to storage
    p = putFrom(p, POLICY, 'current', (bindings) => {
      return bindings.newPolicy as Record<string, unknown>;
    });

    return complete(p, 'ok', {} as Record<string, unknown>) as StorageProgram<Result>;
  },
};

export const flakyTestHandler = autoInterpret(_handler);
