// ============================================================
// FlakyTest Conformance Tests
//
// Validates flaky test detection, quarantine management, and
// reliability reporting: recording pass/fail outcomes, detecting
// flakiness via flip thresholds, quarantining and releasing
// tests, querying quarantine status, generating reports, and
// configuring detection policy.
// See Architecture doc Section 3.8
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/runtime';
import { flakyTestHandler } from '../../../../handlers/ts/framework/test/flaky-test.handler.js';
import type { ConceptStorage } from '@clef/runtime';

describe('FlakyTest conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- record: ok ---

  it('should record a passing result and return a test reference', async () => {
    const result = await flakyTestHandler.record(
      {
        testId: 'test-password-validate',
        language: 'typescript',
        builder: 'vitest',
        passed: true,
        duration: 50,
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.test).toBeDefined();
    expect(typeof result.test).toBe('string');
  });

  it('should record a failing result without triggering flaky detection on first failure', async () => {
    const result = await flakyTestHandler.record(
      {
        testId: 'test-user-create',
        language: 'typescript',
        builder: 'vitest',
        passed: false,
        duration: 80,
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.test).toBeDefined();
  });

  // --- record: flakyDetected ---

  it('should detect flakiness when flip threshold is exceeded', async () => {
    // Set a low threshold for easier testing
    await flakyTestHandler.setPolicy(
      { flipThreshold: 2, flipWindow: '7d', autoQuarantine: false, retryCount: 1 },
      storage,
    );

    // Record alternating pass/fail to create flips
    await flakyTestHandler.record(
      { testId: 'test-flaky', language: 'typescript', builder: 'vitest', passed: true, duration: 30 },
      storage,
    );
    await flakyTestHandler.record(
      { testId: 'test-flaky', language: 'typescript', builder: 'vitest', passed: false, duration: 30 },
      storage,
    );
    // flip 1: true -> false

    await flakyTestHandler.record(
      { testId: 'test-flaky', language: 'typescript', builder: 'vitest', passed: true, duration: 30 },
      storage,
    );
    // flip 2: false -> true — threshold reached

    const result = await flakyTestHandler.record(
      { testId: 'test-flaky', language: 'typescript', builder: 'vitest', passed: false, duration: 30 },
      storage,
    );
    // flip 3: true -> false — above threshold
    expect(result.variant).toBe('flakyDetected');
    expect(result.flipCount).toBeDefined();
    expect(typeof result.flipCount).toBe('number');
    expect(result.flipCount).toBeGreaterThanOrEqual(2);
    expect(result.recentResults).toBeDefined();
    expect(Array.isArray(result.recentResults)).toBe(true);
  });

  // --- quarantine: ok ---

  it('should quarantine a recorded test with reason and owner', async () => {
    // Record the test first
    await flakyTestHandler.record(
      { testId: 'test-quarantine-target', language: 'typescript', builder: 'vitest', passed: true, duration: 40 },
      storage,
    );

    const result = await flakyTestHandler.quarantine(
      {
        testId: 'test-quarantine-target',
        reason: 'Consistently flaky on CI',
        owner: 'team-infra',
      },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.test).toBeDefined();
    expect(typeof result.test).toBe('string');
  });

  // --- quarantine: alreadyQuarantined ---

  it('should return alreadyQuarantined when quarantining an already quarantined test', async () => {
    await flakyTestHandler.record(
      { testId: 'test-double-quarantine', language: 'typescript', builder: 'vitest', passed: true, duration: 40 },
      storage,
    );

    await flakyTestHandler.quarantine(
      { testId: 'test-double-quarantine', reason: 'Flaky', owner: 'team-a' },
      storage,
    );

    const result = await flakyTestHandler.quarantine(
      { testId: 'test-double-quarantine', reason: 'Still flaky', owner: 'team-b' },
      storage,
    );
    expect(result.variant).toBe('alreadyQuarantined');
    expect(result.test).toBeDefined();
  });

  // --- quarantine: notFound ---

  it('should return notFound when quarantining a test that was never recorded', async () => {
    const result = await flakyTestHandler.quarantine(
      { testId: 'test-nonexistent', reason: 'Unknown test' },
      storage,
    );
    expect(result.variant).toBe('notFound');
    expect(result.testId).toBe('test-nonexistent');
  });

  // --- release: ok ---

  it('should release a quarantined test', async () => {
    await flakyTestHandler.record(
      { testId: 'test-release-target', language: 'typescript', builder: 'vitest', passed: true, duration: 30 },
      storage,
    );
    await flakyTestHandler.quarantine(
      { testId: 'test-release-target', reason: 'Flaky' },
      storage,
    );

    const result = await flakyTestHandler.release(
      { testId: 'test-release-target' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.test).toBeDefined();
  });

  // --- release: notQuarantined ---

  it('should return notQuarantined when releasing a test that is not quarantined', async () => {
    await flakyTestHandler.record(
      { testId: 'test-not-quarantined', language: 'typescript', builder: 'vitest', passed: true, duration: 30 },
      storage,
    );

    const result = await flakyTestHandler.release(
      { testId: 'test-not-quarantined' },
      storage,
    );
    expect(result.variant).toBe('notQuarantined');
  });

  it('should return notQuarantined when releasing a test that was never recorded', async () => {
    const result = await flakyTestHandler.release(
      { testId: 'test-never-seen' },
      storage,
    );
    expect(result.variant).toBe('notQuarantined');
  });

  // --- isQuarantined: yes ---

  it('should return yes with details for a quarantined test', async () => {
    await flakyTestHandler.record(
      { testId: 'test-check-status', language: 'typescript', builder: 'vitest', passed: true, duration: 20 },
      storage,
    );
    await flakyTestHandler.quarantine(
      { testId: 'test-check-status', reason: 'Environment-dependent failure', owner: 'team-ci' },
      storage,
    );

    const result = await flakyTestHandler.isQuarantined(
      { testId: 'test-check-status' },
      storage,
    );
    expect(result.variant).toBe('yes');
    expect(result.test).toBeDefined();
    expect(result.reason).toBeDefined();
    expect(typeof result.reason).toBe('string');
    expect(result.quarantinedAt).toBeDefined();
    expect(typeof result.quarantinedAt).toBe('string');
  });

  // --- isQuarantined: no ---

  it('should return no for a recorded but not quarantined test', async () => {
    await flakyTestHandler.record(
      { testId: 'test-healthy', language: 'typescript', builder: 'vitest', passed: true, duration: 25 },
      storage,
    );

    const result = await flakyTestHandler.isQuarantined(
      { testId: 'test-healthy' },
      storage,
    );
    expect(result.variant).toBe('no');
    expect(result.test).toBeDefined();
  });

  // --- isQuarantined: unknown ---

  it('should return unknown for a test that was never recorded', async () => {
    const result = await flakyTestHandler.isQuarantined(
      { testId: 'test-unknown' },
      storage,
    );
    expect(result.variant).toBe('unknown');
    expect(result.testId).toBe('test-unknown');
  });

  // --- report ---

  it('should generate a summary report with flaky and quarantine statistics', async () => {
    // Set up some test data
    await flakyTestHandler.setPolicy(
      { flipThreshold: 2, flipWindow: '7d', autoQuarantine: false, retryCount: 1 },
      storage,
    );

    // Record a stable test
    await flakyTestHandler.record(
      { testId: 'test-stable', language: 'typescript', builder: 'vitest', passed: true, duration: 20 },
      storage,
    );

    // Record a flaky test with flips
    await flakyTestHandler.record(
      { testId: 'test-flaky-report', language: 'typescript', builder: 'vitest', passed: true, duration: 30 },
      storage,
    );
    await flakyTestHandler.record(
      { testId: 'test-flaky-report', language: 'typescript', builder: 'vitest', passed: false, duration: 30 },
      storage,
    );
    await flakyTestHandler.record(
      { testId: 'test-flaky-report', language: 'typescript', builder: 'vitest', passed: true, duration: 30 },
      storage,
    );

    // Quarantine one test
    await flakyTestHandler.quarantine(
      { testId: 'test-flaky-report', reason: 'Unstable', owner: 'team-test' },
      storage,
    );

    const result = await flakyTestHandler.report({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.summary).toBeDefined();
    const summary = result.summary as any;
    expect(typeof summary.totalTracked).toBe('number');
    expect(summary.totalTracked).toBeGreaterThanOrEqual(2);
    expect(typeof summary.currentlyFlaky).toBe('number');
    expect(typeof summary.quarantined).toBe('number');
    expect(summary.quarantined).toBeGreaterThanOrEqual(1);
    expect(typeof summary.stabilized).toBe('number');
    expect(summary.topFlaky).toBeDefined();
    expect(Array.isArray(summary.topFlaky)).toBe(true);
  });

  it('should return empty report when no tests are tracked', async () => {
    const result = await flakyTestHandler.report({}, storage);
    expect(result.variant).toBe('ok');
    const summary = result.summary as any;
    expect(summary.totalTracked).toBe(0);
    expect(summary.currentlyFlaky).toBe(0);
    expect(summary.quarantined).toBe(0);
  });

  // --- setPolicy ---

  it('should update detection policy and persist changes', async () => {
    const result = await flakyTestHandler.setPolicy(
      {
        flipThreshold: 5,
        flipWindow: '14d',
        autoQuarantine: true,
        retryCount: 3,
      },
      storage,
    );
    expect(result.variant).toBe('ok');

    // Verify the policy change took effect by setting a higher threshold
    // and confirming that fewer flips do not trigger detection
    await flakyTestHandler.record(
      { testId: 'test-policy-check', language: 'typescript', builder: 'vitest', passed: true, duration: 10 },
      storage,
    );
    await flakyTestHandler.record(
      { testId: 'test-policy-check', language: 'typescript', builder: 'vitest', passed: false, duration: 10 },
      storage,
    );
    await flakyTestHandler.record(
      { testId: 'test-policy-check', language: 'typescript', builder: 'vitest', passed: true, duration: 10 },
      storage,
    );
    // 2 flips — below threshold of 5
    const recordResult = await flakyTestHandler.record(
      { testId: 'test-policy-check', language: 'typescript', builder: 'vitest', passed: false, duration: 10 },
      storage,
    );
    expect(recordResult.variant).toBe('ok');
  });

  // --- invariant: record flips -> flakyDetected when threshold exceeded ---

  it('should transition from ok to flakyDetected as flips accumulate past threshold', async () => {
    await flakyTestHandler.setPolicy(
      { flipThreshold: 3, flipWindow: '7d', autoQuarantine: false, retryCount: 1 },
      storage,
    );

    // Initial stable recordings — no flips
    const first = await flakyTestHandler.record(
      { testId: 'test-invariant', language: 'typescript', builder: 'vitest', passed: true, duration: 10 },
      storage,
    );
    expect(first.variant).toBe('ok');

    // Start flipping: true -> false (flip 1)
    const second = await flakyTestHandler.record(
      { testId: 'test-invariant', language: 'typescript', builder: 'vitest', passed: false, duration: 10 },
      storage,
    );
    expect(second.variant).toBe('ok');

    // false -> true (flip 2)
    const third = await flakyTestHandler.record(
      { testId: 'test-invariant', language: 'typescript', builder: 'vitest', passed: true, duration: 10 },
      storage,
    );
    expect(third.variant).toBe('ok');

    // true -> false (flip 3 — meets threshold)
    const fourth = await flakyTestHandler.record(
      { testId: 'test-invariant', language: 'typescript', builder: 'vitest', passed: false, duration: 10 },
      storage,
    );
    expect(fourth.variant).toBe('flakyDetected');
    expect(fourth.flipCount).toBeGreaterThanOrEqual(3);
    expect(fourth.recentResults).toBeDefined();
    const results = fourth.recentResults as boolean[];
    expect(results.length).toBeGreaterThanOrEqual(4);
  });
});
