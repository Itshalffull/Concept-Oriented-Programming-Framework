// @clef-handler style=functional
// ReflectionStrategy Concept Implementation
// Reflection strategy provider. Iterative self-critique and revision: generate a
// draft, critique it, revise, repeat until satisfactory or max rounds.
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
  return `reflection-session-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ReflectionStrategy' }) as StorageProgram<Result>;
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
    const maxRounds = maxIterations || 3;

    // Simulate reflection loop: draft -> critique -> revise
    const history: Array<{ draft: string; critique: string }> = [];

    // Round 1: Initial draft and critique
    const initialDraft = `Draft response for: ${goal} (using context: ${context || 'none'})`;
    const initialCritique = `Critique: The draft addresses the goal but could be more specific.`;
    history.push({ draft: initialDraft, critique: initialCritique });

    // Round 2: Revised draft
    const revisedDraft = `Revised response for: ${goal} - improved specificity based on critique.`;
    const revisedCritique = `Critique: The revised draft is satisfactory.`;
    history.push({ draft: revisedDraft, critique: revisedCritique });

    let p = createProgram();
    p = put(p, 'session', sessionId, {
      id: sessionId,
      agent_ref: agentRef,
      draft_history: history.map((h, i) => ({ ...h, round: i + 1 })),
      max_rounds: maxRounds,
    });

    return complete(p, 'ok', {
      result: revisedDraft,
      rounds: history.length,
      history,
    }) as StorageProgram<Result>;
  },

  critique(input: Record<string, unknown>) {
    const session = input.session as string;
    const draft = input.draft as string;

    if (!session || session.trim() === '') {
      return complete(createProgram(), 'error', { message: 'session is required' }) as StorageProgram<Result>;
    }
    if (!draft || draft.trim() === '') {
      return complete(createProgram(), 'error', { message: 'draft is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'session', session, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Session not found' }),
      (() => {
        // Evaluate the draft
        const satisfactory = draft.length > 50;
        const critique = satisfactory
          ? 'The draft meets quality criteria.'
          : 'The draft needs more detail and specificity.';

        return complete(createProgram(), 'ok', {
          critique,
          satisfactory,
        });
      })(),
    ) as StorageProgram<Result>;
  },

  revise(input: Record<string, unknown>) {
    const session = input.session as string;
    const draft = input.draft as string;
    const critique = input.critique as string;

    if (!session || session.trim() === '') {
      return complete(createProgram(), 'error', { message: 'session is required' }) as StorageProgram<Result>;
    }
    if (!draft || draft.trim() === '') {
      return complete(createProgram(), 'error', { message: 'draft is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'session', session, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'error', { message: 'Session not found' }),
      (() => {
        const revised = `${draft} [Revised based on: ${critique}]`;

        let b = createProgram();
        b = putFrom(b, 'session', session, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const history = (existing.draft_history as Array<Record<string, unknown>>) || [];
          return {
            ...existing,
            draft_history: [...history, { draft, critique, round: history.length + 1 }],
          };
        });

        return complete(b, 'ok', { revised });
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
        return { history: existing.draft_history || [] };
      }),
    ) as StorageProgram<Result>;
  },
};

export const reflectionStrategyHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetReflectionStrategy(): void {
  idCounter = 0;
}
