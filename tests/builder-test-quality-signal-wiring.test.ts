// ============================================================
// MAG-917 INV-13 — Builder/test → QualitySignal sync wiring.
//
// Proves that when Builder/test completes with ok(passed, failed,
// skipped, duration, testType) the dormant
// UnitTestPassPublishesQualitySignal sync in
// repertoire/concepts/testing/syncs fires and records a
// QualitySignal row. This is the minimal end-to-end check that
// the previously-dormant wiring is now live.
//
// The test uses Builder's simulated test path (no `execute: true`)
// so we don't spawn vitest recursively from inside vitest. The
// simulated path returns the exact same completion variant shape
// the real vitest path produces, so it exercises the sync
// pattern match without shelling out.
// ============================================================

import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { bootKernel } from '../handlers/ts/framework/kernel-boot.handler';
import { builderHandler } from '../handlers/ts/deploy/builder.handler';
import { qualitySignalHandler } from '../handlers/ts/framework/test/quality-signal.handler';

describe('Builder/test wires into the QualitySignal sync chain', () => {
  it('Builder/build then Builder/test fires UnitTestPassPublishesQualitySignal', async () => {
    const { kernel } = bootKernel({
      concepts: [
        { uri: 'urn:clef/Builder', handler: builderHandler, storageName: 'builder' },
        { uri: 'urn:clef/QualitySignal', handler: qualitySignalHandler, storageName: 'quality-signal' },
      ],
      syncFiles: [
        resolve(
          __dirname,
          '..',
          'repertoire/concepts/testing/syncs/unit-tests-publish-quality-signal.sync',
        ),
      ],
    });

    // Seed a build record so Builder/test's simulated path finds it.
    const buildResult = await kernel.invokeConcept('urn:clef/Builder', 'build', {
      concept: 'DemoConcept',
      source: './src',
      language: 'typescript',
      platform: 'linux-x86_64',
      config: { mode: 'debug' },
    });
    expect(buildResult.variant).toBe('ok');

    // Invoke Builder/test — NOT with execute:true, so we stay on the
    // simulated in-storage path and don't spawn vitest recursively.
    const testResult = await kernel.invokeConcept('urn:clef/Builder', 'test', {
      concept: 'DemoConcept',
      language: 'typescript',
      platform: 'linux-x86_64',
      testType: 'unit',
    });
    expect(testResult.variant).toBe('ok');
    expect(testResult).toHaveProperty('passed');
    expect(testResult).toHaveProperty('testType', 'unit');

    // Give the engine a tick to process the synchronous sync fan-out.
    await new Promise((r) => setTimeout(r, 10));

    // Confirm the sync actually recorded a QualitySignal.
    const latest = await kernel.invokeConcept('urn:clef/QualitySignal', 'latest', {
      target_symbol: 'DemoConcept',
      dimension: 'unit',
    });
    expect(latest.variant).toBe('ok');
    const signal = latest.signal as Record<string, unknown>;
    expect(signal.status).toBe('pass');
    expect(signal.severity).toBe('gate');
    expect(signal.dimension).toBe('unit');
    expect(signal.target_symbol).toBe('DemoConcept');
  });
});
