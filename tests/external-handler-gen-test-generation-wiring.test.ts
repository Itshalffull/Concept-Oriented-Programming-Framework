// ============================================================
// Proves that when ExternalHandlerGen/generate completes ok the
// RunTestsOnExternalHandlerGen sync fires and dispatches
// TestGeneration/run for the same concept name. Mirrors the shape of
// builder-test-quality-signal-wiring.test.ts.
//
// We use a recording stub for TestGeneration so the test asserts the
// sync wiring fires without requiring the full pipeline (assertion
// contexts, parsers, renderers) to be booted.
// ============================================================

import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { bootKernel } from '../handlers/ts/framework/kernel-boot.handler';
import { externalHandlerGenHandler } from '../handlers/ts/framework/external-handler-gen.handler';
import type { ConceptHandler } from '../runtime/types';

describe('ExternalHandlerGen wires into the TestGeneration pipeline', () => {
  it('ExternalHandlerGen/generate ok fires TestGeneration/run with the same concept', async () => {
    const recorded: Array<Record<string, unknown>> = [];

    // Recording stub for TestGeneration — proves the sync dispatched.
    const testGenStub: ConceptHandler = {
      async run(input: Record<string, unknown>) {
        recorded.push(input);
        return { variant: 'ok', generated: 0, changed: 0, failed: 0 };
      },
    };

    const { kernel } = bootKernel({
      concepts: [
        {
          uri: 'urn:clef/ExternalHandlerGen',
          handler: externalHandlerGenHandler,
          storageName: 'external-handler-gen',
        },
        {
          uri: 'urn:clef/TestGeneration',
          handler: testGenStub,
          storageName: 'test-generation',
        },
      ],
      syncFiles: [
        resolve(
          __dirname,
          '..',
          'repertoire/concepts/testing/syncs/run-tests-on-external-handler-gen.sync',
        ),
      ],
    });

    const manifest = JSON.stringify({
      sources: [{
        name: 'payments',
        baseUrl: 'https://api.payments.example/v1',
        authConfig: { type: 'bearer', tokenEnvVar: 'PAYMENTS_TOKEN' },
        concepts: [{
          name: 'Charge',
          actions: [{
            name: 'create',
            method: 'POST',
            path: '/charges',
            fieldTransforms: { request: [], response: [] },
          }],
        }],
      }],
    });

    const result = await kernel.invokeConcept(
      'urn:clef/ExternalHandlerGen',
      'generate',
      { manifest, source: 'payments', concept: 'Charge' },
    );
    expect(result.variant).toBe('ok');

    // Tick to let the sync fan-out complete.
    await new Promise((r) => setTimeout(r, 10));

    expect(recorded.length).toBeGreaterThanOrEqual(1);
    expect(recorded[0].target).toBe('Charge');
  });
});
