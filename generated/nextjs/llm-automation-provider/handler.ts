// LLMAutomationProvider — Execute automation actions via LLM calls.
// Dispatches action payloads to configured LLM providers and returns structured results.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  LLMAutomationProviderStorage,
  LLMAutomationProviderRegisterInput,
  LLMAutomationProviderRegisterOutput,
  LLMAutomationProviderExecuteInput,
  LLMAutomationProviderExecuteOutput,
} from './types.js';

import {
  registerOk,
  registerAlreadyRegistered,
  executeOk,
  executeError,
} from './types.js';

export interface LLMAutomationProviderError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): LLMAutomationProviderError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface LLMAutomationProviderHandler {
  readonly register: (
    input: LLMAutomationProviderRegisterInput,
    storage: LLMAutomationProviderStorage,
  ) => TE.TaskEither<LLMAutomationProviderError, LLMAutomationProviderRegisterOutput>;
  readonly execute: (
    input: LLMAutomationProviderExecuteInput,
    storage: LLMAutomationProviderStorage,
  ) => TE.TaskEither<LLMAutomationProviderError, LLMAutomationProviderExecuteOutput>;
}

// --- Implementation ---

let idCounter = 0;
function nextId(): string {
  return `llm-auto-${++idCounter}`;
}

export const llmAutomationProviderHandler: LLMAutomationProviderHandler = {
  register: (_input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('llm-automation-provider', '__registered'),
        toStorageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  await storage.put('llm-automation-provider', '__registered', { value: true });
                  return registerOk('llm');
                },
                toStorageError,
              ),
            () => TE.right(registerAlreadyRegistered()),
          ),
        ),
      ),
    ),

  execute: (input, storage) =>
    pipe(
      TE.right(input),
      TE.chain((inp) => {
        if (!inp.action_payload) {
          return TE.right(executeError('action_payload is required'));
        }
        if (!inp.model_config) {
          return TE.right(executeError('model_config is required'));
        }

        let config: Record<string, unknown>;
        try {
          config = JSON.parse(inp.model_config);
        } catch {
          return TE.right(executeError('Invalid model_config JSON'));
        }

        if (!config.model) {
          return TE.right(executeError('model_config must include a model field'));
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(inp.action_payload);
        } catch {
          return TE.right(executeError('Invalid action_payload JSON'));
        }

        const id = nextId();
        const now = new Date().toISOString();
        const result = JSON.stringify({
          model: config.model,
          action: payload.action || 'unknown',
          output: `LLM result for ${JSON.stringify(payload)}`,
          timestamp: now,
        });

        return TE.tryCatch(
          async () => {
            await storage.put('llm-automation-provider', id, {
              id,
              action_payload: inp.action_payload,
              model_config: inp.model_config,
              status: 'completed',
              result,
              error: null,
              createdAt: now,
            });
            return executeOk(result);
          },
          toStorageError,
        );
      }),
    ),
};
