// @migrated dsl-constructs 2026-03-18
// Workflow Concept Implementation (Clef Bind)
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _interfaceWorkflowHandler: FunctionalConceptHandler = {
  define(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const steps = JSON.parse(input.steps as string) as string[];
    const config = input.config as string;

    if (steps.length === 0) {
      const p = createProgram();
      return complete(p, 'emptySteps', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let configData: Record<string, unknown>;
    try { configData = JSON.parse(config); }
    catch { configData = {}; }

    const stepTitles = (configData.titles as Record<string, string>) ?? {};
    const stepProse = (configData.prose as Record<string, string>) ?? {};

    for (let i = 0; i < steps.length; i++) {
      const action = steps[i];
      if (!action || action.trim() === '') {
        const p = createProgram();
        return complete(p, 'invalidAction', { action: action ?? '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
      }
    }

    const stepDefinitions = steps.map((action, i) => ({
      action,
      title: stepTitles[action] ?? action.charAt(0).toUpperCase() + action.slice(1),
      prose: stepProse[action] ?? '',
      order: i + 1,
    }));

    const checklists = (configData.checklists as Array<{ step: string; items: string[] }>) ?? [];
    const references = (configData.references as Array<{ step: string; path: string; label: string }>) ?? [];
    const examples = (configData.examples as Array<{ step: string; language: string; code: string }>) ?? [];
    const antiPatterns = (configData.antiPatterns as Array<{ title: string; description: string }>) ?? [];
    const relatedWorkflows = (configData.relatedWorkflows as string[]) ?? [];

    const workflowId = `workflow-${concept}-${Date.now()}`;

    let p = createProgram();
    p = put(p, 'workflow', workflowId, {
      workflowId, concept,
      steps: JSON.stringify(stepDefinitions),
      checklists: JSON.stringify(checklists),
      references: JSON.stringify(references),
      examples: JSON.stringify(examples),
      antiPatterns: JSON.stringify(antiPatterns),
      relatedWorkflows: JSON.stringify(relatedWorkflows),
      stepCount: steps.length,
    });

    return complete(p, 'ok', { workflow: workflowId, stepCount: steps.length }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  render(input: Record<string, unknown>) {
    const workflow = input.workflow as string;
    const format = input.format as string;

    const supportedFormats = ['skill-md', 'cli-help', 'rest-guide', 'generic'];
    if (!supportedFormats.includes(format)) {
      const p = createProgram();
      return complete(p, 'unknownFormat', { format }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'workflow', workflow, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { content: '' }),
      (b) => complete(b, 'unknownFormat', { format: 'Workflow not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const interfaceWorkflowHandler = autoInterpret(_interfaceWorkflowHandler);

