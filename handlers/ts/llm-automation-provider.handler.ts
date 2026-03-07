// ============================================================
// LLMAutomationProvider Handler
//
// Execute automation actions via LLM calls. Dispatches action
// payloads to configured LLM providers and returns structured
// results. See Architecture doc Sections 16.11, 16.12.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `llm-auto-${++idCounter}`;
}

let registered = false;

export const llmAutomationProviderHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    if (registered) {
      return { variant: 'already_registered' };
    }

    registered = true;
    await storage.put('llm-automation-provider', '__registered', { value: true });

    return { variant: 'ok', provider_name: 'llm' };
  },

  async execute(input: Record<string, unknown>, storage: ConceptStorage) {
    const actionPayload = input.action_payload as string;
    const modelConfig = input.model_config as string;

    // Validate inputs
    if (!actionPayload) {
      return { variant: 'error', message: 'action_payload is required' };
    }
    if (!modelConfig) {
      return { variant: 'error', message: 'model_config is required' };
    }

    // Parse and validate model config
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(modelConfig);
    } catch {
      return { variant: 'error', message: 'Invalid model_config JSON' };
    }

    if (!config.model) {
      return { variant: 'error', message: 'model_config must include a model field' };
    }

    // Parse action payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(actionPayload);
    } catch {
      return { variant: 'error', message: 'Invalid action_payload JSON' };
    }

    // Simulate LLM execution — in production this would call the actual LLM API
    const id = nextId();
    const now = new Date().toISOString();
    const result = JSON.stringify({
      model: config.model,
      action: payload.action || 'unknown',
      output: `LLM result for ${JSON.stringify(payload)}`,
      timestamp: now,
    });

    await storage.put('llm-automation-provider', id, {
      id,
      action_payload: actionPayload,
      model_config: modelConfig,
      status: 'completed',
      result,
      error: null,
      createdAt: now,
    });

    return { variant: 'ok', result };
  },
};

/** Reset internal state. Useful for testing. */
export function resetLLMAutomationProvider(): void {
  idCounter = 0;
  registered = false;
}
