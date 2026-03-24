// @clef-handler style=functional
// CodeActStrategy Concept Implementation
// CodeAct strategy provider. Agent generates executable code to solve problems,
// runs it in a sandbox, observes output, iterates.
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
  return `codeact-session-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'CodeActStrategy' }) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const agentRef = input.agent_ref as string;
    const goal = input.goal as string;
    const context = input.context as string;
    const maxIterations = input.max_iterations as number;

    if (!agentRef || agentRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'agent_ref is required' }) as StorageProgram<Result>;
    }
    if (!goal || goal.trim() === '') {
      return complete(createProgram(), 'error', { message: 'goal is required' }) as StorageProgram<Result>;
    }

    const sessionId = nextId();

    // Simulate code generation and execution
    const code = `# Generated code for: ${goal}\nresult = solve(${JSON.stringify(goal)})\nprint(result)`;
    const output = `Solution for: ${goal}`;

    const codeHistory = [
      { code, output, error: null, step: 1 },
    ];

    let p = createProgram();
    p = put(p, 'session', sessionId, {
      id: sessionId,
      agent_ref: agentRef,
      code_history: codeHistory,
      runtime_env: 'python',
      sandbox_config: { timeout_ms: 30000, memory_limit_mb: 256 },
    });

    return complete(p, 'ok', {
      result: output,
      code_runs: 1,
      final_code: code,
    }) as StorageProgram<Result>;
  },

  generateCode(input: Record<string, unknown>) {
    const session = input.session as string;
    const goal = input.goal as string;
    const previousError = input.previous_error as string | undefined;

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
        let code: string;
        if (previousError) {
          code = `# Fixed code for: ${goal}\n# Previous error: ${previousError}\nresult = solve_fixed(${JSON.stringify(goal)})\nprint(result)`;
        } else {
          code = `# Generated code for: ${goal}\nresult = solve(${JSON.stringify(goal)})\nprint(result)`;
        }

        return complete(createProgram(), 'ok', {
          code,
          language: 'python',
        });
      })(),
    ) as StorageProgram<Result>;
  },

  executeCode(input: Record<string, unknown>) {
    const session = input.session as string;
    const code = input.code as string;

    if (!session || session.trim() === '') {
      return complete(createProgram(), 'error', { message: 'session is required' }) as StorageProgram<Result>;
    }
    if (!code || code.trim() === '') {
      return complete(createProgram(), 'error', { stderr: 'No code provided', exit_code: 1 }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'session', session, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Session not found' }),
      (() => {
        // Simulate code execution in sandbox
        const output = `Executed successfully:\n${code.split('\n').pop() || ''}`;

        let b = createProgram();
        b = putFrom(b, 'session', session, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const history = (existing.code_history as Array<Record<string, unknown>>) || [];
          return {
            ...existing,
            code_history: [...history, {
              code,
              output,
              error: null,
              step: history.length + 1,
            }],
          };
        });

        return complete(b, 'ok', { output });
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
        return { history: existing.code_history || [] };
      }),
    ) as StorageProgram<Result>;
  },
};

export const codeActStrategyHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetCodeActStrategy(): void {
  idCounter = 0;
}
