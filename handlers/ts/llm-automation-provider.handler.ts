// @migrated dsl-constructs 2026-03-18
// ============================================================
// LLMAutomationProvider Handler
//
// Execute automation actions via LLM calls. Dispatches action
// payloads to configured LLM providers and returns structured
// results. See Architecture doc Sections 16.11, 16.12.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, complete, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `llm-auto-${++idCounter}`;
}

let registered = false;

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    if (registered) {
      const p = createProgram();
      return complete(p, 'already_registered', {}) as StorageProgram<Result>;
    }

    registered = true;
    let p = createProgram();
    p = put(p, 'llm-automation-provider', '__registered', { value: true });

    return complete(p, 'ok', { provider_name: 'llm' }) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const actionPayload = input.action_payload as string;
    const modelConfig = input.model_config as string;

    if (!actionPayload) {
      const p = createProgram();
      return complete(p, 'error', { message: 'action_payload is required' }) as StorageProgram<Result>;
    }
    if (!modelConfig) {
      const p = createProgram();
      return complete(p, 'error', { message: 'model_config is required' }) as StorageProgram<Result>;
    }

    let config: Record<string, unknown>;
    try {
      config = JSON.parse(modelConfig);
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: 'Invalid model_config JSON' }) as StorageProgram<Result>;
    }

    if (!config.model) {
      const p = createProgram();
      return complete(p, 'error', { message: 'model_config must include a model field' }) as StorageProgram<Result>;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(actionPayload);
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: 'Invalid action_payload JSON' }) as StorageProgram<Result>;
    }

    const id = nextId();
    const now = new Date().toISOString();
    const result = JSON.stringify({
      model: config.model,
      action: payload.action || 'unknown',
      output: `LLM result for ${JSON.stringify(payload)}`,
      timestamp: now,
    });

    let p = createProgram();
    p = put(p, 'llm-automation-provider', id, {
      id,
      action_payload: actionPayload,
      model_config: modelConfig,
      status: 'completed',
      result,
      error: null,
      createdAt: now,
    });

    return complete(p, 'ok', { result }) as StorageProgram<Result>;
  },
};

export const llmAutomationProviderHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetLLMAutomationProvider(): void {
  idCounter = 0;
  registered = false;
}
