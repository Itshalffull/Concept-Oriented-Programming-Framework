// @clef-handler style=functional concept=ProcessSpecRenderer
// ============================================================
// ProcessSpecRenderer — TestPlan -> ProcessSpec JSON.
//
// Self-registers via register() + sync-to-PluginRegistry pattern so it
// becomes one of the platform targets that the test-generation
// pipeline dispatches to. IntegrationTestGen builds a TestPlan-shaped
// payload and routes it through render() to obtain the final
// ProcessSpec JSON string used by external-call integration tests.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, complete,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';
import { renderTestPlanToProcessSpec } from '../../framework/integration-test-gen.handler.js';

type Result = { variant: string; [key: string]: unknown };

const CAPABILITIES = [
  'external-call',
  'check-verification',
  'after-chain',
  'fixture-chain',
  'scenario',
  'sync-settlement',
  'async-eventually',
  'async-with-anchor',
].join(',');

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', {
      name: 'process-spec',
      capabilities: CAPABILITIES,
    }) as StorageProgram<Result>;
  },

  render(input: Record<string, unknown>) {
    const planStr = (input.plan as string | undefined) ?? '';
    if (!planStr || planStr.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'plan is required',
      }) as StorageProgram<Result>;
    }

    let plan: Record<string, unknown>;
    try {
      plan = JSON.parse(planStr);
    } catch (err) {
      return complete(createProgram(), 'error', {
        message: `plan is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      }) as StorageProgram<Result>;
    }

    if (!plan || typeof plan !== 'object'
        || typeof plan.concept !== 'string'
        || typeof plan.sourceRef !== 'string'
        || !Array.isArray(plan.fixtureSteps)) {
      return complete(createProgram(), 'error', {
        message: 'plan is missing required fields (concept, sourceRef, fixtureSteps)',
      }) as StorageProgram<Result>;
    }

    const normalized = {
      planId: (plan.planId as string) ?? `plan:${plan.sourceRef}:${Date.now()}`,
      specKind: 'concept' as const,
      sourceRef: plan.sourceRef as string,
      concept: plan.concept as string,
      target: (plan.target as string) ?? '',
      ...(plan.auth ? { auth: plan.auth as string } : {}),
      fixtureSteps: plan.fixtureSteps as Array<Record<string, unknown>>,
      cleanupSteps: (plan.cleanupSteps as Array<Record<string, unknown>>) ?? [],
      scenarioSteps: (plan.scenarioSteps as Array<Record<string, unknown>>) ?? [],
      skippedActions: (plan.skippedActions as Array<{ action: string; reason: string }>) ?? [],
    };

    // Cast to the handler-internal plan shape; renderer is a pure function.
    const processSpec = renderTestPlanToProcessSpec(normalized as Parameters<typeof renderTestPlanToProcessSpec>[0]);
    const code = JSON.stringify(processSpec);
    return complete(createProgram(), 'ok', { code }) as StorageProgram<Result>;
  },
};

export const processSpecRendererHandler = autoInterpret(_handler);
export default processSpecRendererHandler;
