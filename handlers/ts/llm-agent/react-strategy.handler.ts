// @clef-handler style=functional
// ReactStrategy Concept Implementation
// ReAct (Reasoning + Acting) strategy provider for AgentLoop. Implements the
// greedy think-act-observe cycle with an interleaved scratchpad.
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
  return `react-session-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ReactStrategy' }) as StorageProgram<Result>;
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
    if (!maxIterations || maxIterations <= 0) {
      return complete(createProgram(), 'error', { message: 'max_iterations must be positive' }) as StorageProgram<Result>;
    }

    const sessionId = nextId();
    const scratchpad: Array<{ type: string; content: string; step: number }> = [];

    // Simulate a ReAct loop: think -> act -> observe
    let step = 0;
    let toolCalls = 0;
    const tools = availableTools || [];

    // Step 1: Think
    scratchpad.push({ type: 'thought', content: `Analyzing goal: ${goal}`, step: ++step });

    // Step 2: Act — choose a tool or produce final answer
    if (tools.length > 0) {
      scratchpad.push({ type: 'action', content: `Using tool: ${tools[0]}`, step: ++step });
      toolCalls++;
      // Step 3: Observe
      scratchpad.push({ type: 'observation', content: `Tool ${tools[0]} returned result for: ${goal}`, step: ++step });
    }

    // Final answer
    scratchpad.push({ type: 'thought', content: `Synthesizing final answer from ${context}`, step: ++step });

    let p = createProgram();
    p = put(p, 'session', sessionId, {
      id: sessionId,
      agent_ref: agentRef,
      scratchpad,
    });

    return complete(p, 'ok', {
      result: `Completed ReAct loop for: ${goal}`,
      steps: step,
      tool_calls: toolCalls,
      scratchpad: scratchpad.map(s => ({ type: s.type, content: s.content })),
    }) as StorageProgram<Result>;
  },

  stepOnce(input: Record<string, unknown>) {
    const session = input.session as string;

    if (!session || session.trim() === '') {
      return complete(createProgram(), 'error', { message: 'session is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'session', session, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Session not found' }),
      (() => {
        // Generate a thought step
        return complete(createProgram(), 'thought', {
          reasoning: 'Analyzing current state and determining next action',
        });
      })(),
    ) as StorageProgram<Result>;
  },

  addObservation(input: Record<string, unknown>) {
    const session = input.session as string;
    const observation = input.observation as string;

    if (!session || session.trim() === '') {
      return complete(createProgram(), 'error', { message: 'session is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'session', session, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Session not found' }),
      (() => {
        let b = createProgram();
        b = putFrom(b, 'session', session, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const scratchpad = (existing.scratchpad as Array<Record<string, unknown>>) || [];
          const step = scratchpad.length + 1;
          return {
            ...existing,
            scratchpad: [...scratchpad, { type: 'observation', content: observation, step }],
          };
        });
        return complete(b, 'ok', { session });
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
        return { scratchpad: existing.scratchpad || [] };
      }),
    ) as StorageProgram<Result>;
  },
};

export const reactStrategyHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetReactStrategy(): void {
  idCounter = 0;
}
