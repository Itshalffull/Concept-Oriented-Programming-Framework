// ============================================================
// ProcessSpecRenderer: register() reports its name + capabilities
// (driving the RegisterProcessSpecRenderer sync into PluginRegistry),
// and render() emits a ProcessSpec JSON string from a TestPlan-shaped
// input that matches the shape IntegrationTestGen used to emit
// directly.
// ============================================================

import { describe, it, expect } from 'vitest';
import { processSpecRendererHandler } from '../handlers/ts/repertoire/test-plan-renderers/process-spec-renderer.handler';
import { createInMemoryStorage } from '../runtime/adapters/storage';

describe('ProcessSpecRenderer', () => {
  it('register returns ok with name "process-spec" and capabilities', async () => {
    const storage = createInMemoryStorage();
    const result = await processSpecRendererHandler.register({}, storage);
    expect(result.variant).toBe('ok');
    expect(result.name).toBe('process-spec');
    expect(typeof result.capabilities).toBe('string');
    expect(result.capabilities as string).toContain('external-call');
    expect(result.capabilities as string).toContain('check-verification');
    expect(result.capabilities as string).toContain('scenario');
  });

  it('render emits ProcessSpec JSON from a TestPlan-shaped payload', async () => {
    const storage = createInMemoryStorage();
    const plan = {
      planId: 'plan:specs/x.concept:1',
      specKind: 'concept',
      sourceRef: 'specs/x.concept',
      concept: 'X',
      target: 'https://api.example.com',
      auth: 'bearer',
      fixtureSteps: [
        {
          type: 'external-call',
          name: 'create_ok',
          action: 'create',
          input: { name: 'demo' },
          outputBindings: ['id'],
          after: [],
          assertions: [{ kind: 'check-verification', expectedVariant: 'ok' }],
        },
      ],
      cleanupSteps: [],
      scenarioSteps: [
        {
          type: 'external-call',
          name: 'sc_when_0',
          action: 'create',
          input: { name: 'sc' },
          outputBindings: ['id'],
          after: [],
          assertions: [{ kind: 'check-verification', expectedVariant: 'ok' }],
        },
      ],
      skippedActions: [],
    };

    const result = await processSpecRendererHandler.render(
      { plan: JSON.stringify(plan) },
      storage,
    );

    expect(result.variant).toBe('ok');
    const processSpec = JSON.parse(result.code as string);
    expect(processSpec.concept).toBe('X');
    expect(processSpec.source).toBe('specs/x.concept');
    expect(processSpec.target).toBe('https://api.example.com');
    expect(processSpec.auth).toBe('bearer');
    expect(processSpec.steps).toHaveLength(2); // fixture + scenario
    expect(processSpec.steps[0].name).toBe('create_ok');
    expect(processSpec.steps[1].name).toBe('sc_when_0');
  });

  it('render returns error on invalid JSON', async () => {
    const storage = createInMemoryStorage();
    const result = await processSpecRendererHandler.render({ plan: 'not-json' }, storage);
    expect(result.variant).toBe('error');
  });

  it('render returns error on empty plan', async () => {
    const storage = createInMemoryStorage();
    const result = await processSpecRendererHandler.render({ plan: '' }, storage);
    expect(result.variant).toBe('error');
  });

  it('render returns error when required fields are missing', async () => {
    const storage = createInMemoryStorage();
    const result = await processSpecRendererHandler.render(
      { plan: JSON.stringify({ planId: 'p1' }) },
      storage,
    );
    expect(result.variant).toBe('error');
  });
});
