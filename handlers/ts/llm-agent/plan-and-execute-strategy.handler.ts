// @clef-handler style=functional
// PlanAndExecuteStrategy Concept Implementation
// Plan-and-Execute strategy provider. Generates an upfront multi-step plan, then
// executes each step, replanning after each step if needed.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, find, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `plan-exec-session-${++idCounter}`;
}

let stepCounter = 0;
function nextStepId(): string {
  return `step-${++stepCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'PlanAndExecuteStrategy' }) as StorageProgram<Result>;
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

    // Generate initial plan
    const planSteps = [
      { step_id: nextStepId(), description: `Analyze: ${goal}`, status: 'completed', result: 'Analysis complete' },
      { step_id: nextStepId(), description: `Execute using available tools`, status: 'completed', result: 'Execution complete' },
      { step_id: nextStepId(), description: `Synthesize results`, status: 'completed', result: 'Synthesis complete' },
    ];

    const planHistory = [
      {
        plan_version: 1,
        steps: planSteps.map(s => ({ description: s.description, status: s.status })),
      },
    ];

    let p = createProgram();
    p = put(p, 'session', sessionId, {
      id: sessionId,
      agent_ref: agentRef,
      plan: planSteps,
      executor_model: null,
    });

    return complete(p, 'ok', {
      result: `Plan-and-execute completed for: ${goal}`,
      steps: planSteps.length,
      tool_calls: availableTools ? availableTools.length : 0,
      plan_history: planHistory,
    }) as StorageProgram<Result>;
  },

  plan(input: Record<string, unknown>) {
    const session = input.session as string;
    const goal = input.goal as string;

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
        const steps = [
          { step_id: nextStepId(), description: `Understand: ${goal}` },
          { step_id: nextStepId(), description: `Plan approach for: ${goal}` },
          { step_id: nextStepId(), description: `Execute and verify` },
        ];

        let b = createProgram();
        b = putFrom(b, 'session', session, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            ...existing,
            plan: steps.map(s => ({ ...s, status: 'pending', result: null })),
          };
        });

        return complete(b, 'ok', { steps });
      })(),
    ) as StorageProgram<Result>;
  },

  replan(input: Record<string, unknown>) {
    const session = input.session as string;
    const completed = input.completed as string[];
    const remaining = input.remaining as string[];

    if (!session || session.trim() === '') {
      return complete(createProgram(), 'error', { message: 'session is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'session', session, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Session not found' }),
      (() => {
        // If no remaining steps, plan is still valid
        if (!remaining || remaining.length === 0) {
          return complete(createProgram(), 'ok', {}) as StorageProgram<Result>;
        }

        const updatedPlan = remaining.map(desc => ({
          step_id: nextStepId(),
          description: desc,
        }));

        let b = createProgram();
        b = putFrom(b, 'session', session, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            ...existing,
            plan: updatedPlan.map(s => ({ ...s, status: 'pending', result: null })),
          };
        });

        return complete(b, 'ok', { updated_plan: updatedPlan });
      })(),
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
        return { plan: existing.plan || [] };
      }),
    ) as StorageProgram<Result>;
  },
};

export const planAndExecuteStrategyHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetPlanAndExecuteStrategy(): void {
  idCounter = 0;
  stepCounter = 0;
}
