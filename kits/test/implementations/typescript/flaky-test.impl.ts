// ============================================================
// FlakyTest Concept Implementation
//
// Detects, tracks, and quarantines unreliable tests across all
// languages and builders. Maintains per-test reliability history
// and quarantine status with configurable detection policy.
// See Architecture doc Section 3.8
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../kernel/src/types.js';

const TESTS = 'flaky-tests';
const POLICY = 'flaky-policy';

const DEFAULT_POLICY = {
  flipThreshold: 3,
  flipWindow: '7d',
  autoQuarantine: false,
  retryCount: 1,
};

async function getPolicy(storage: ConceptStorage): Promise<{
  flipThreshold: number;
  flipWindow: string;
  autoQuarantine: boolean;
  retryCount: number;
}> {
  const stored = await storage.get(POLICY, 'current');
  if (!stored) return { ...DEFAULT_POLICY };
  return {
    flipThreshold: (stored.flipThreshold as number) ?? DEFAULT_POLICY.flipThreshold,
    flipWindow: (stored.flipWindow as string) ?? DEFAULT_POLICY.flipWindow,
    autoQuarantine: (stored.autoQuarantine as boolean) ?? DEFAULT_POLICY.autoQuarantine,
    retryCount: (stored.retryCount as number) ?? DEFAULT_POLICY.retryCount,
  };
}

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

export const flakyTestHandler: ConceptHandler = {
  async record(input, storage) {
    const testId = input.testId as string;
    const language = input.language as string;
    const builder = input.builder as string;
    const passed = input.passed as boolean;
    const duration = input.duration as number;

    const testKey = `${testId}:${language}`;
    const existing = await storage.get(TESTS, testKey);
    const now = new Date().toISOString();
    const policy = await getPolicy(storage);

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

    await storage.put(TESTS, testKey, {
      id: testRef,
      testId,
      language,
      builder,
      results: JSON.stringify(results),
      flipCount: windowFlipCount,
      lastFlipAt,
      quarantined,
      quarantinedAt,
      quarantinedBy,
      reason,
      owner,
    });

    // Check if flaky threshold exceeded
    if (windowFlipCount >= policy.flipThreshold) {
      if (policy.autoQuarantine && !quarantined) {
        // Auto-quarantine
        await storage.put(TESTS, testKey, {
          id: testRef,
          testId,
          language,
          builder,
          results: JSON.stringify(results),
          flipCount: windowFlipCount,
          lastFlipAt,
          quarantined: true,
          quarantinedAt: now,
          quarantinedBy: 'auto',
          reason: `Auto-quarantined: ${windowFlipCount} flips in ${policy.flipWindow}`,
          owner,
        });
      }

      return {
        variant: 'flakyDetected',
        test: testRef,
        flipCount: windowFlipCount,
        recentResults: results.map(r => r.passed),
      };
    }

    return { variant: 'ok', test: testRef };
  },

  async quarantine(input, storage) {
    const testId = input.testId as string;
    const reasonText = input.reason as string;
    const owner = input.owner as string | undefined;

    // Find the test record across all languages
    const allTests = await storage.find(TESTS, { testId });
    if (allTests.length === 0) {
      return { variant: 'notFound', testId };
    }

    const test = allTests[0];
    if (test.quarantined as boolean) {
      return { variant: 'alreadyQuarantined', test: test.id as string };
    }

    const testKey = `${testId}:${test.language as string}`;
    const now = new Date().toISOString();

    await storage.put(TESTS, testKey, {
      ...test,
      quarantined: true,
      quarantinedAt: now,
      quarantinedBy: owner || 'manual',
      reason: reasonText,
      owner: owner || null,
    });

    return { variant: 'ok', test: test.id as string };
  },

  async release(input, storage) {
    const testId = input.testId as string;

    const allTests = await storage.find(TESTS, { testId });
    if (allTests.length === 0) {
      return { variant: 'notQuarantined', test: testId };
    }

    const test = allTests[0];
    if (!(test.quarantined as boolean)) {
      return { variant: 'notQuarantined', test: test.id as string };
    }

    const testKey = `${testId}:${test.language as string}`;

    await storage.put(TESTS, testKey, {
      ...test,
      quarantined: false,
      quarantinedAt: null,
      quarantinedBy: null,
      reason: null,
    });

    return { variant: 'ok', test: test.id as string };
  },

  async isQuarantined(input, storage) {
    const testId = input.testId as string;

    const allTests = await storage.find(TESTS, { testId });
    if (allTests.length === 0) {
      return { variant: 'unknown', testId };
    }

    const test = allTests[0];
    if (test.quarantined as boolean) {
      return {
        variant: 'yes',
        test: test.id as string,
        reason: test.reason as string,
        owner: test.owner as string | null,
        quarantinedAt: test.quarantinedAt as string,
      };
    }

    return { variant: 'no', test: test.id as string };
  },

  async report(_input, storage) {
    const allTests = await storage.find(TESTS);
    const policy = await getPolicy(storage);

    let totalTracked = 0;
    let currentlyFlaky = 0;
    let quarantinedCount = 0;
    let stabilized = 0;

    const topFlaky: Array<{
      testId: string;
      language: string;
      flipCount: number;
      owner: string | null;
    }> = [];

    for (const test of allTests) {
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
          flipCount,
          owner: test.owner as string | null,
        });
      }
    }

    // Sort topFlaky by flipCount descending
    topFlaky.sort((a, b) => b.flipCount - a.flipCount);

    return {
      variant: 'ok',
      summary: {
        totalTracked,
        currentlyFlaky,
        quarantined: quarantinedCount,
        stabilized,
        topFlaky: topFlaky.slice(0, 10),
      },
    };
  },

  async setPolicy(input, storage) {
    const existing = await getPolicy(storage);

    const newPolicy = {
      flipThreshold: (input.flipThreshold as number) ?? existing.flipThreshold,
      flipWindow: (input.flipWindow as string) ?? existing.flipWindow,
      autoQuarantine: (input.autoQuarantine as boolean) ?? existing.autoQuarantine,
      retryCount: (input.retryCount as number) ?? existing.retryCount,
    };

    await storage.put(POLICY, 'current', newPolicy);

    return { variant: 'ok' };
  },
};
