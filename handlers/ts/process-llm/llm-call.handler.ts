// @clef-handler style=functional
// LLMCall Concept Implementation
// Manage LLM prompt execution with structured output validation,
// tool calling, and repair loops. Actual model invocation is delegated to providers.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `llmcall-${++idCounter}`;
}

const _llmCallHandler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'LLMCall' }) as StorageProgram<Result>;
  },

  request(input: Record<string, unknown>) {
    const stepRef = input.step_ref as string;
    const model = input.model as string;
    const prompt = input.prompt as string;
    const outputSchema = input.output_schema as string | undefined;
    const maxAttempts = input.max_attempts as number;

    if (!stepRef || stepRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'step_ref is required' }) as StorageProgram<Result>;
    }

    const callId = nextId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'call', callId, {
      call: callId,
      step_ref: stepRef,
      model,
      system_prompt: null,
      user_prompt: prompt,
      tools: [],
      output_schema: outputSchema || null,
      status: 'requesting',
      raw_output: null,
      validated_output: null,
      validation_errors: null,
      attempt_count: 0,
      max_attempts: maxAttempts || 3,
      input_tokens: null,
      output_tokens: null,
      created_at: now,
    });
    return complete(p, 'ok', { call: callId, step_ref: stepRef, model }) as StorageProgram<Result>;
  },

  record_response(input: Record<string, unknown>) {
    const callId = input.call as string;
    const rawOutput = input.raw_output as string;
    const inputTokens = input.input_tokens as number;
    const outputTokens = input.output_tokens as number;

    if (!callId) {
      return complete(createProgram(), 'error', { message: 'call is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'call', callId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      (() => complete(createProgram(), 'error', { message: 'call not found' }))(),
      (() => {
        let b = createProgram();
        b = get(b, 'call', callId, 'existing');
        b = putFrom(b, 'call', callId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const hasSchema = existing.output_schema != null && existing.output_schema !== '';
          return {
            ...existing,
            raw_output: rawOutput,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            status: hasSchema ? 'validating' : 'accepted',
          };
        });
        return complete(b, 'ok', { call: callId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  validate(input: Record<string, unknown>) {
    const callId = input.call as string;

    if (!callId) {
      return complete(createProgram(), 'error', { message: 'call is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'call', callId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      (() => complete(createProgram(), 'error', { message: 'call not found' }))(),
      (() => {
        // In a real implementation, schema validation would be performed here.
        // For now, we accept the output as valid (provider validates via sync).
        let b = createProgram();
        b = get(b, 'call', callId, 'existing');
        b = putFrom(b, 'call', callId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            ...existing,
            validated_output: existing.raw_output,
            status: 'accepted',
          };
        });
        b = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return existing.step_ref as string;
        }, '_stepRef');
        b = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return existing.raw_output as string;
        }, '_output');
        return completeFrom(b, 'ok', (bindings) => ({
          call: callId,
          step_ref: bindings._stepRef as string,
          validated_output: bindings._output as string,
        }));
      })(),
    ) as StorageProgram<Result>;
  },

  repair(input: Record<string, unknown>) {
    const callId = input.call as string;
    const errors = input.errors as string;

    if (!callId) {
      return complete(createProgram(), 'error', { message: 'call is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'call', callId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      (() => complete(createProgram(), 'error', { message: 'call not found' }))(),
      (() => {
        let b = createProgram();
        b = get(b, 'call', callId, 'existing');
        b = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const attemptCount = (existing.attempt_count as number) + 1;
          const maxAttempts = existing.max_attempts as number;
          return attemptCount >= maxAttempts;
        }, '_exhausted');
        b = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return existing.step_ref as string;
        }, '_stepRef');

        return branch(b,
          (bindings) => bindings._exhausted === true,
          (() => {
            // Max attempts exhausted -> rejected
            let r = createProgram();
            r = get(r, 'call', callId, 'existing');
            r = putFrom(r, 'call', callId, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              return {
                ...existing,
                status: 'rejected',
                validation_errors: errors,
                attempt_count: (existing.attempt_count as number) + 1,
              };
            });
            r = mapBindings(r, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              return existing.step_ref as string;
            }, '_stepRef');
            return completeFrom(r, 'ok', (bindings) => ({
              call: callId,
              step_ref: bindings._stepRef as string,
            }));
          })(),
          (() => {
            // Can still retry -> back to requesting
            let r = createProgram();
            r = get(r, 'call', callId, 'existing');
            r = putFrom(r, 'call', callId, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              return {
                ...existing,
                status: 'requesting',
                validation_errors: errors,
                attempt_count: (existing.attempt_count as number) + 1,
              };
            });
            return complete(r, 'ok', { call: callId }) as StorageProgram<Result>;
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  accept(input: Record<string, unknown>) {
    const callId = input.call as string;

    if (!callId) {
      return complete(createProgram(), 'error', { message: 'call is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'call', callId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      (() => complete(createProgram(), 'error', { message: 'call not found' }))(),
      (() => {
        let b = createProgram();
        b = get(b, 'call', callId, 'existing');
        b = putFrom(b, 'call', callId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, status: 'accepted' };
        });
        b = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return existing.step_ref as string;
        }, '_stepRef');
        b = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return existing.raw_output as string;
        }, '_output');
        return completeFrom(b, 'ok', (bindings) => ({
          call: callId,
          step_ref: bindings._stepRef as string,
          output: bindings._output as string,
        }));
      })(),
    ) as StorageProgram<Result>;
  },

  reject(input: Record<string, unknown>) {
    const callId = input.call as string;
    const reason = input.reason as string;

    if (!callId) {
      return complete(createProgram(), 'error', { message: 'call is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'call', callId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      (() => complete(createProgram(), 'error', { message: 'call not found' }))(),
      (() => {
        let b = createProgram();
        b = get(b, 'call', callId, 'existing');
        b = putFrom(b, 'call', callId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, status: 'rejected' };
        });
        b = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return existing.step_ref as string;
        }, '_stepRef');
        return completeFrom(b, 'ok', (bindings) => ({
          call: callId,
          step_ref: bindings._stepRef as string,
          reason,
        }));
      })(),
    ) as StorageProgram<Result>;
  },
};

export const llmCallHandler = autoInterpret(_llmCallHandler);
