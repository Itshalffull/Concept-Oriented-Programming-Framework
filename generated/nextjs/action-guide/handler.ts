import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import type { ActionGuideStorage, ActionGuideDefineInput, ActionGuideDefineOutput, ActionGuideRenderInput, ActionGuideRenderOutput } from './types.js';
import { defineOk, renderOk } from './types.js';
export interface ActionGuideError { readonly code: string; readonly message: string; }
export interface ActionGuideHandler {
  readonly define: (input: ActionGuideDefineInput, storage: ActionGuideStorage) => TE.TaskEither<ActionGuideError, ActionGuideDefineOutput>;
  readonly render: (input: ActionGuideRenderInput, storage: ActionGuideStorage) => TE.TaskEither<ActionGuideError, ActionGuideRenderOutput>;
}
let _wfCounter = 0;
const err = (error: unknown): ActionGuideError => ({ code: 'STORAGE_ERROR', message: error instanceof Error ? error.message : String(error) });
export const actionGuideHandler: ActionGuideHandler = {
  define: (input, storage) => pipe(TE.tryCatch(async () => {
    _wfCounter++;
    const workflowId = `wf-${_wfCounter}`;
    let stepCount = 0;
    try { const p = JSON.parse(input.content); for (const k of Object.keys(p)) { if (Array.isArray(p[k])) { stepCount = p[k].length; break; } } } catch {}
    if (stepCount === 0) stepCount = 1;
    await storage.put('actionguide', workflowId, { concept: input.concept, content: input.content, workflowId, stepCount });
    return defineOk(workflowId, stepCount);
  }, err)),
  render: (input, storage) => pipe(TE.tryCatch(async () => {
    const record = await storage.get('actionguide', input.workflow);
    return renderOk(record ? String(record.content ?? '') : '');
  }, err)),
};
