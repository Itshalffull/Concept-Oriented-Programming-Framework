// ============================================================
// IntegrationTestGen now consumes scenario invariants from concept
// specs alongside fixture chains. This test feeds a concept spec
// containing both fixtures AND a scenario block, and proves the
// emitted ProcessSpec carries scenario-derived steps after the
// fixture-chain steps with proper settlement annotations.
// ============================================================

import { describe, it, expect } from 'vitest';
import { integrationTestGenHandler } from '../handlers/ts/framework/integration-test-gen.handler';
import { createInMemoryStorage } from '../runtime/adapters/storage';

const SPEC_WITH_SCENARIO = `
@version(1)
concept Widget [W] {
  purpose { Track widgets. }
  state {
    items: set W
    name: W -> String
  }
  actions {
    action create(name: String) {
      -> ok(id: W)
      -> error(message: String)
      fixture create_ok { name: "acme-widget" }
      fixture create_empty { name: "" } -> error
    }
    action get(id: W) {
      -> ok(name: String)
      -> notfound(message: String)
      fixture get_ok { id: $create_ok.id } after create_ok
      fixture get_missing { id: "no-such-id" } -> notfound
    }
  }

  scenario "create then read eventually" {
    when {
      create(name: "scenario-widget") -> ok(id: w)
    }
    then {
      get(id: w) -> ok(name: n)
    }
    settlement: "async-eventually" { timeoutMs: 250 }
  }
}
`;

describe('IntegrationTestGen scenario invariant translation', () => {
  it('emits scenario-derived steps after fixture-chain steps with settlement settings', async () => {
    const storage = createInMemoryStorage();
    const result = await integrationTestGenHandler.generate(
      {
        conceptSpec: SPEC_WITH_SCENARIO,
        ingestManifest: '{"target":"https://api.example.com"}',
        source: 'specs/widget.concept',
      },
      storage,
    );

    expect(result.variant).toBe('ok');
    const processSpec = JSON.parse(result.processSpec as string);

    // Fixture-chain steps come first
    const stepNames: string[] = processSpec.steps.map((s: { name: string }) => s.name);
    expect(stepNames).toContain('create_ok');
    expect(stepNames).toContain('get_ok');

    // Scenario-derived steps follow
    const scenarioSteps = processSpec.steps.filter(
      (s: { name: string }) => s.name.startsWith('create_then_read_eventually_'),
    );
    expect(scenarioSteps.length).toBeGreaterThanOrEqual(2); // 1 when + 1 then

    // when-step carries pollUntil settings from async-eventually settlement
    const whenStep = scenarioSteps.find((s: { name: string }) => /_when_\d+$/.test(s.name));
    expect(whenStep).toBeDefined();
    expect(whenStep.action).toBe('create');
    expect(whenStep.settings).toBeDefined();
    expect(whenStep.settings.pollUntil).toEqual({ timeoutMs: 250 });

    // then-step is an external-call against the read action
    const thenStep = scenarioSteps.find((s: { name: string }) => /_then_\d+$/.test(s.name));
    expect(thenStep).toBeDefined();
    expect(thenStep.action).toBe('get');
    expect(thenStep.assertions[0].expectedVariant).toBe('ok');

    // Fixture-chain steps must precede scenario steps (preserve today's behavior)
    const firstScenarioIdx = processSpec.steps.findIndex(
      (s: { name: string }) => s.name.startsWith('create_then_read_eventually_'),
    );
    const lastFixtureIdx = Math.max(
      processSpec.steps.findIndex((s: { name: string }) => s.name === 'create_ok'),
      processSpec.steps.findIndex((s: { name: string }) => s.name === 'get_ok'),
    );
    expect(firstScenarioIdx).toBeGreaterThan(lastFixtureIdx);
  });
});
