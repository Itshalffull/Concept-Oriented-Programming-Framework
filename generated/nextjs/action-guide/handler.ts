import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { ActionGuideStorage, ActionGuideDefineInput, ActionGuideDefineOutput, ActionGuideRenderInput, ActionGuideRenderOutput } from './types.js';
import { defineOk, defineInvalidAction, defineEmptySteps, renderOk, renderUnknownFormat } from './types.js';
export interface ActionGuideError { readonly code: string; readonly message: string; }
export interface ActionGuideHandler {
  readonly define: (input: ActionGuideDefineInput, storage: ActionGuideStorage) => TE.TaskEither<ActionGuideError, ActionGuideDefineOutput>;
  readonly render: (input: ActionGuideRenderInput, storage: ActionGuideStorage) => TE.TaskEither<ActionGuideError, ActionGuideRenderOutput>;
}
const VALID_CONCEPT = /^[a-zA-Z][a-zA-Z0-9-]*$/;
const err = (error: unknown): ActionGuideError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });
export const actionGuideHandler: ActionGuideHandler = {
  define: (input, storage) => pipe(TE.tryCatch(async () => {
    if (!VALID_CONCEPT.test(input.concept)) return defineInvalidAction(input.concept);
    let steps = input.steps;
    if (!steps || (Array.isArray(steps) && steps.length === 0)) {
      if (!steps) {
        // Try to derive steps from content JSON
        try {
          const parsed = JSON.parse(input.content);
          const keys = Object.keys(parsed);
          steps = keys.length > 0 ? keys : [];
        } catch {
          steps = [];
        }
      }
      if (Array.isArray(steps) && steps.length === 0) return defineEmptySteps();
    }
    const workflowId = `guide:${input.concept}`;
    const stepCount = steps.length;
    await storage.put('actionguide', workflowId, { concept: input.concept, steps: steps as unknown as Record<string, unknown>, content: input.content, workflowId, stepCount });
    return defineOk(workflowId, stepCount);
  }, err)),
  render: (input, storage) => pipe(TE.tryCatch(async () => {
    if (input.format !== 'markdown' && input.format !== 'text' && input.format !== 'skill-md') return renderUnknownFormat(input.format);
    const record = await storage.get('actionguide', input.workflow);
    if (!record) return renderOk('No guide found');
    const steps = (record.steps as string[]) ?? [];
    if (input.format === 'markdown' || input.format === 'skill-md') {
      const lines = [`# Action Guide: ${record.concept}`, '', record.content as string, '', ...steps.map((s, i) => `${i + 1}. ${s}`)];
      return renderOk(lines.join('\n'));
    }
    const lines = [`Action Guide: ${record.concept}`, '', record.content as string, '', ...steps.map((s, i) => `${i + 1}. ${s}`)];
    return renderOk(lines.join('\n'));
  }, err)),
};
