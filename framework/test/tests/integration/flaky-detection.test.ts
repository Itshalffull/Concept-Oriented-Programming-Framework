// ============================================================
// Flaky Test Detection & Quarantine Integration Test
//
// Tests the Builder/test->FlakyTest pipeline that sync chains
// would orchestrate:
// 1. Builder/test produces results (simulated)
// 2. FlakyTest/record tracks each result
// 3. Alternating pass/fail results -> flakyDetected
// 4. setPolicy with autoQuarantine=true
// 5. Next flip -> auto-quarantined
// 6. isQuarantined -> yes
// 7. FlakyTest/report shows dashboard
// 8. release -> no longer quarantined
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/runtime';
import { flakyTestHandler } from '../../../../handlers/ts/framework/test/flaky-test.handler.js';
import type { ConceptStorage } from '@clef/runtime';

/**
 * Simulates a Builder/test result being fed into FlakyTest/record.
 * In a real sync chain the Builder concept would run tests and the
 * FlakyTest concept would record each outcome for flakiness tracking.
 */
async function recordTestResult(
  storage: ConceptStorage,
  testId: string,
  language: string,
  passed: boolean,
): Promise<Record<string, unknown>> {
  return flakyTestHandler.record(
    {
      testId,
      language,
      builder: `${language}-builder`,
      passed,
      duration: Math.floor(Math.random() * 500) + 50,
    },
    storage,
  );
}

describe('Flaky test detection and quarantine integration', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('should record a stable test result without detecting flakiness', async () => {
    const result = await recordTestResult(storage, 'test-login', 'typescript', true);

    expect(result.variant).toBe('ok');
    expect(result.test).toBeDefined();
    expect(typeof result.test).toBe('string');
  });

  it('should detect flakiness after alternating pass/fail results', async () => {
    // Default flip threshold is 3 — alternate pass/fail to reach it
    // pass, fail (flip 1), pass (flip 2), fail (flip 3)
    await recordTestResult(storage, 'test-api-call', 'typescript', true);
    await recordTestResult(storage, 'test-api-call', 'typescript', false);
    await recordTestResult(storage, 'test-api-call', 'typescript', true);
    const result = await recordTestResult(storage, 'test-api-call', 'typescript', false);

    expect(result.variant).toBe('flakyDetected');
    expect(result.flipCount).toBeDefined();
    expect((result.flipCount as number)).toBeGreaterThanOrEqual(3);
    expect(result.recentResults).toBeDefined();
    expect(Array.isArray(result.recentResults)).toBe(true);
  });

  it('should not detect flakiness for consistently passing tests', async () => {
    // Record five consecutive passes — no flips
    for (let i = 0; i < 5; i++) {
      const result = await recordTestResult(storage, 'test-stable', 'rust', true);
      expect(result.variant).toBe('ok');
    }
  });

  it('should auto-quarantine when policy enables autoQuarantine', async () => {
    // Enable auto-quarantine policy
    await flakyTestHandler.setPolicy(
      { flipThreshold: 3, autoQuarantine: true, flipWindow: '7d' },
      storage,
    );

    // Generate enough flips to trigger detection
    await recordTestResult(storage, 'test-db-conn', 'typescript', true);
    await recordTestResult(storage, 'test-db-conn', 'typescript', false);
    await recordTestResult(storage, 'test-db-conn', 'typescript', true);
    const flakyResult = await recordTestResult(storage, 'test-db-conn', 'typescript', false);

    expect(flakyResult.variant).toBe('flakyDetected');

    // Verify it was auto-quarantined
    const quarantineCheck = await flakyTestHandler.isQuarantined(
      { testId: 'test-db-conn' },
      storage,
    );

    expect(quarantineCheck.variant).toBe('yes');
    expect(quarantineCheck.reason).toBeDefined();
    expect(typeof quarantineCheck.reason).toBe('string');
    expect((quarantineCheck.reason as string)).toContain('Auto-quarantined');
  });

  it('should confirm quarantine status via isQuarantined', async () => {
    // Enable auto-quarantine and trigger flakiness
    await flakyTestHandler.setPolicy(
      { flipThreshold: 3, autoQuarantine: true },
      storage,
    );

    await recordTestResult(storage, 'test-cache-hit', 'rust', true);
    await recordTestResult(storage, 'test-cache-hit', 'rust', false);
    await recordTestResult(storage, 'test-cache-hit', 'rust', true);
    await recordTestResult(storage, 'test-cache-hit', 'rust', false);

    const result = await flakyTestHandler.isQuarantined(
      { testId: 'test-cache-hit' },
      storage,
    );

    expect(result.variant).toBe('yes');
    expect(result.test).toBeDefined();
    expect(result.quarantinedAt).toBeDefined();
    expect(typeof result.quarantinedAt).toBe('string');
  });

  it('should generate a flaky test report with summary statistics', async () => {
    // Record mixed results for several tests
    await recordTestResult(storage, 'test-auth', 'typescript', true);
    await recordTestResult(storage, 'test-auth', 'typescript', false);
    await recordTestResult(storage, 'test-auth', 'typescript', true);
    await recordTestResult(storage, 'test-auth', 'typescript', false);

    await recordTestResult(storage, 'test-render', 'typescript', true);
    await recordTestResult(storage, 'test-render', 'typescript', true);

    await recordTestResult(storage, 'test-network', 'rust', false);
    await recordTestResult(storage, 'test-network', 'rust', true);

    const reportResult = await flakyTestHandler.report({}, storage);

    expect(reportResult.variant).toBe('ok');
    const summary = reportResult.summary as {
      totalTracked: number;
      currentlyFlaky: number;
      quarantined: number;
      topFlaky: Array<{ testId: string; flipCount: number }>;
    };

    expect(summary.totalTracked).toBeGreaterThanOrEqual(3);
    expect(typeof summary.currentlyFlaky).toBe('number');
    expect(typeof summary.quarantined).toBe('number');
    expect(Array.isArray(summary.topFlaky)).toBe(true);
    // topFlaky should be sorted by flipCount descending
    for (let i = 1; i < summary.topFlaky.length; i++) {
      expect(summary.topFlaky[i - 1].flipCount).toBeGreaterThanOrEqual(
        summary.topFlaky[i].flipCount,
      );
    }
  });

  it('should release a quarantined test and confirm it is no longer quarantined', async () => {
    // Enable auto-quarantine and trigger it
    await flakyTestHandler.setPolicy(
      { flipThreshold: 3, autoQuarantine: true },
      storage,
    );

    await recordTestResult(storage, 'test-flaky-release', 'typescript', true);
    await recordTestResult(storage, 'test-flaky-release', 'typescript', false);
    await recordTestResult(storage, 'test-flaky-release', 'typescript', true);
    await recordTestResult(storage, 'test-flaky-release', 'typescript', false);

    // Confirm it is quarantined
    const beforeRelease = await flakyTestHandler.isQuarantined(
      { testId: 'test-flaky-release' },
      storage,
    );
    expect(beforeRelease.variant).toBe('yes');

    // Release
    const releaseResult = await flakyTestHandler.release(
      { testId: 'test-flaky-release' },
      storage,
    );
    expect(releaseResult.variant).toBe('ok');

    // Confirm no longer quarantined
    const afterRelease = await flakyTestHandler.isQuarantined(
      { testId: 'test-flaky-release' },
      storage,
    );
    expect(afterRelease.variant).toBe('no');
  });

  it('should manually quarantine a test with a reason and owner', async () => {
    // Record some results first so the test exists
    await recordTestResult(storage, 'test-manual-q', 'typescript', true);
    await recordTestResult(storage, 'test-manual-q', 'typescript', false);

    // Manually quarantine
    const quarantineResult = await flakyTestHandler.quarantine(
      {
        testId: 'test-manual-q',
        reason: 'Known race condition in CI environment',
        owner: 'alice',
      },
      storage,
    );

    expect(quarantineResult.variant).toBe('ok');

    // Verify quarantine details
    const check = await flakyTestHandler.isQuarantined(
      { testId: 'test-manual-q' },
      storage,
    );
    expect(check.variant).toBe('yes');
    expect(check.reason).toBe('Known race condition in CI environment');
    expect(check.owner).toBe('alice');
  });
});
