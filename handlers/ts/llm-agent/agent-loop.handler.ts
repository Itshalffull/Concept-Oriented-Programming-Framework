// @clef-handler style=functional
// AgentLoop Concept Implementation
// Coordination concept for agent reasoning cycles. Defines the interface
// contract for agent execution: create, run, step, observe, interrupt, resume.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `agent-loop-${++idCounter}`;
}

const VALID_STATUSES = new Set(['idle', 'running', 'paused', 'completed', 'error', 'waiting_for_human']);

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'AgentLoop' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const availableTools = input.available_tools as string[];
    const maxIterations = input.max_iterations as number;

    if (!availableTools || !Array.isArray(availableTools)) {
      return complete(createProgram(), 'invalid', { message: 'available_tools is required and must be a list' }) as StorageProgram<Result>;
    }
    if (!maxIterations || typeof maxIterations !== 'number' || maxIterations <= 0) {
      return complete(createProgram(), 'invalid', { message: 'max_iterations must be a positive integer' }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'agent', id, {
      id,
      available_tools: availableTools,
      max_iterations: maxIterations,
      current_step: 0,
      status: 'idle',
      goal: null,
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { agent: id }) as StorageProgram<Result>;
  },

  run(input: Record<string, unknown>) {
    const agent = input.agent as string;
    const goal = input.goal as string;
    const context = input.context as string;
    const strategy = input.strategy as string;

    if (!agent || (agent as string).trim() === '') {
      return complete(createProgram(), 'error', { message: 'agent is required', step: 0 }) as StorageProgram<Result>;
    }
    if (!goal || (goal as string).trim() === '') {
      return complete(createProgram(), 'error', { message: 'goal is required', step: 0 }) as StorageProgram<Result>;
    }
    if (!strategy || (strategy as string).trim() === '') {
      return complete(createProgram(), 'error', { message: 'strategy is required', step: 0 }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'agent', agent, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Agent not found', step: 0 }),
      (() => {
        let b = createProgram();
        b = get(b, 'agent', agent, 'agentData');
        b = mapBindings(b, (bindings) => {
          const data = bindings.agentData as Record<string, unknown>;
          return data.max_iterations as number;
        }, '_maxIter');

        b = putFrom(b, 'agent', agent, (bindings) => {
          const data = bindings.agentData as Record<string, unknown>;
          const steps = Math.min(3, data.max_iterations as number);
          return {
            ...data,
            status: 'completed',
            goal,
            current_step: steps,
          };
        });

        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.agentData as Record<string, unknown>;
          const steps = Math.min(3, data.max_iterations as number);
          return {
            result: `Completed goal: ${goal}`,
            steps,
            tool_calls: Math.max(1, steps - 1),
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  step(input: Record<string, unknown>) {
    const agent = input.agent as string;

    if (!agent || (agent as string).trim() === '') {
      return complete(createProgram(), 'error', { message: 'agent is required', step: 0 }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'agent', agent, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Agent not found', step: 0 }),
      (() => {
        let b = createProgram();
        b = get(b, 'agent', agent, 'agentData');
        b = putFrom(b, 'agent', agent, (bindings) => {
          const data = bindings.agentData as Record<string, unknown>;
          return {
            ...data,
            current_step: (data.current_step as number) + 1,
          };
        });
        return completeFrom(b, 'thought', (bindings) => {
          const data = bindings.agentData as Record<string, unknown>;
          return {
            reasoning: 'Analyzing current state and determining next action',
            step: (data.current_step as number) + 1,
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  observe(input: Record<string, unknown>) {
    const agent = input.agent as string;
    const observation = input.observation as string;

    if (!agent || (agent as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'agent is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'agent', agent, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Agent not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'agent', agent, 'agentData');
        b = putFrom(b, 'agent', agent, (bindings) => {
          const data = bindings.agentData as Record<string, unknown>;
          return {
            ...data,
            last_observation: observation,
          };
        });
        return complete(b, 'ok', { agent });
      })(),
    ) as StorageProgram<Result>;
  },

  interrupt(input: Record<string, unknown>) {
    const agent = input.agent as string;

    if (!agent || (agent as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'agent is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'agent', agent, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Agent not found or not running' }),
      (() => {
        let b = createProgram();
        b = get(b, 'agent', agent, 'agentData');
        b = putFrom(b, 'agent', agent, (bindings) => {
          const data = bindings.agentData as Record<string, unknown>;
          return { ...data, status: 'paused' };
        });
        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.agentData as Record<string, unknown>;
          return {
            state_snapshot: JSON.stringify({ status: data.status, step: data.current_step, goal: data.goal }),
            step: data.current_step as number,
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  resume(input: Record<string, unknown>) {
    const agent = input.agent as string;
    const humanInput = input.human_input as string;

    if (!agent || (agent as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'agent is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'agent', agent, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Agent not found or not paused' }),
      (() => {
        let b = createProgram();
        b = get(b, 'agent', agent, 'agentData');
        b = putFrom(b, 'agent', agent, (bindings) => {
          const data = bindings.agentData as Record<string, unknown>;
          return {
            ...data,
            status: 'running',
            last_human_input: humanInput,
          };
        });
        return complete(b, 'ok', { agent });
      })(),
    ) as StorageProgram<Result>;
  },
};

export const agentLoopHandler = autoInterpret(_handler);
