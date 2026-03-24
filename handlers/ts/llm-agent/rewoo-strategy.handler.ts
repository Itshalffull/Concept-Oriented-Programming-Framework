// @clef-handler style=functional
// ReWOOStrategy Concept Implementation
// ReWOO (Reasoning Without Observation) strategy provider. Plans ALL tool calls
// upfront before executing any, then batch-executes and synthesizes.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `rewoo-session-${++idCounter}`;
}

let stepCounter = 0;
function nextStepId(): string {
  return `rewoo-step-${++stepCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ReWOOStrategy' }) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const agentRef = input.agent_ref as string;
    const goal = input.goal as string;
    const context = input.context as string;
    const availableTools = input.available_tools as string[];
    const maxIterations = input.max_iterations as number;

    if (!agentRef || agentRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'agent_ref is required' }) as StorageProgram<Result>;
    }
    if (!goal || goal.trim() === '') {
      return complete(createProgram(), 'error', { message: 'goal is required' }) as StorageProgram<Result>;
    }

    const sessionId = nextId();
    const tools = availableTools || [];

    // Plan all tool calls upfront
    const plannedCalls = tools.map((tool, i) => ({
      step_id: nextStepId(),
      tool_name: tool,
      arguments: JSON.stringify({ goal, context: context || '' }),
      depends_on: i > 0 ? [plannedCalls[i - 1]?.step_id].filter(Boolean) : [],
    }));

    // Execute all in dependency order
    const executionResults = plannedCalls.map(call => ({
      step_id: call.step_id,
      result: `Result from ${call.tool_name} for: ${goal}`,
    }));

    let p = createProgram();
    p = put(p, 'session', sessionId, {
      id: sessionId,
      agent_ref: agentRef,
      planned_calls: plannedCalls,
      execution_results: executionResults,
    });

    return complete(p, 'ok', {
      result: `ReWOO completed for: ${goal}`,
      planned_calls: plannedCalls.length,
      executed_calls: executionResults.length,
    }) as StorageProgram<Result>;
  },

  planCalls(input: Record<string, unknown>) {
    const session = input.session as string;
    const goal = input.goal as string;
    const availableTools = input.available_tools as string[];

    if (!session || session.trim() === '') {
      return complete(createProgram(), 'error', { message: 'session is required' }) as StorageProgram<Result>;
    }
    if (!goal || goal.trim() === '') {
      return complete(createProgram(), 'error', { message: 'goal is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'session', session, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Session not found' }),
      (() => {
        const tools = availableTools || [];
        const calls = tools.map((tool, i) => ({
          step_id: nextStepId(),
          tool_name: tool,
          arguments: JSON.stringify({ goal }),
          depends_on: [] as string[],
        }));

        let b = createProgram();
        b = putFrom(b, 'session', session, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, planned_calls: calls };
        });

        return complete(b, 'ok', { calls });
      })(),
    ) as StorageProgram<Result>;
  },

  executeBatch(input: Record<string, unknown>) {
    const session = input.session as string;

    if (!session || session.trim() === '') {
      return complete(createProgram(), 'error', { message: 'session is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'session', session, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Session not found' }),
      completeFrom(createProgram(), 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        const plannedCalls = (existing.planned_calls as Array<Record<string, unknown>>) || [];
        const results = plannedCalls.map(call => ({
          step_id: call.step_id as string,
          result: `Executed ${call.tool_name}`,
        }));
        return { results };
      }),
    ) as StorageProgram<Result>;
  },

  synthesize(input: Record<string, unknown>) {
    const session = input.session as string;
    const goal = input.goal as string;

    if (!session || session.trim() === '') {
      return complete(createProgram(), 'error', { message: 'session is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'session', session, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Session not found' }),
      completeFrom(createProgram(), 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        const results = (existing.execution_results as Array<Record<string, unknown>>) || [];
        return {
          result: `Synthesized ${results.length} results for: ${goal || 'unknown goal'}`,
        };
      }),
    ) as StorageProgram<Result>;
  },

  getState(input: Record<string, unknown>) {
    const session = input.session as string;

    if (!session || session.trim() === '') {
      return complete(createProgram(), 'error', { message: 'session is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'session', session, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Session not found' }),
      completeFrom(createProgram(), 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        return {
          planned: existing.planned_calls || [],
          results: existing.execution_results || [],
        };
      }),
    ) as StorageProgram<Result>;
  },
};

export const rewooStrategyHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetReWOOStrategy(): void {
  idCounter = 0;
  stepCounter = 0;
}
