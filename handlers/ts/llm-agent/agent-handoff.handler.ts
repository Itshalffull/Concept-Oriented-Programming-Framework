// @clef-handler style=functional
// AgentHandoff Concept Implementation
// Structured transfer of control between agents with context packaging.
// Different from message passing because handoff involves context
// summarization, tool state transfer, responsibility transfer, and
// acceptance/rejection protocol.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(prefix: string = 'agent-handoff'): string {
  return `${prefix}-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'AgentHandoff' }) as StorageProgram<Result>;
  },

  prepare(input: Record<string, unknown>) {
    const source = input.source as string;
    const target = input.target as string;
    const reason = input.reason as string;

    if (!source || source.trim() === '') {
      return complete(createProgram(), 'error', { message: 'source is required' }) as StorageProgram<Result>;
    }
    if (!target || target.trim() === '') {
      return complete(createProgram(), 'error', { message: 'target is required' }) as StorageProgram<Result>;
    }
    if (!reason || reason.trim() === '') {
      return complete(createProgram(), 'error', { message: 'reason is required' }) as StorageProgram<Result>;
    }

    const id = nextId();
    const now = new Date().toISOString();

    // Build context package from source agent's state
    const contextPackage = JSON.stringify({
      source_agent: source,
      target_agent: target,
      reason,
      summary: `Context transfer from ${source} to ${target}: ${reason}`,
      timestamp: now,
    });

    let p = createProgram();
    p = put(p, 'handoff', id, {
      id,
      source_agent: source,
      target_agent: target,
      context_summary: `Transfer from ${source} to ${target}: ${reason}`,
      transferred_tools: [],
      transferred_state: null,
      reason,
      status: 'prepared',
      createdAt: now,
    });

    return complete(p, 'ok', { handoff: id, context_package: contextPackage }) as StorageProgram<Result>;
  },

  execute(input: Record<string, unknown>) {
    const handoff = input.handoff as string;

    if (!handoff || (handoff as string).trim() === '') {
      return complete(createProgram(), 'rejected', { reason: 'handoff is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'handoff', handoff, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'rejected', { reason: 'Handoff not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'handoff', handoff, 'handoffData');
        b = putFrom(b, 'handoff', handoff, (bindings) => {
          const data = bindings.handoffData as Record<string, unknown>;
          return {
            ...data,
            status: 'completed',
            completedAt: new Date().toISOString(),
          };
        });
        return complete(b, 'ok', { handoff });
      })(),
    ) as StorageProgram<Result>;
  },

  escalate(input: Record<string, unknown>) {
    const source = input.source as string;
    const reason = input.reason as string;

    if (!source || source.trim() === '') {
      return complete(createProgram(), 'ok', { message: 'No suitable escalation target' }) as StorageProgram<Result>;
    }
    if (!reason || reason.trim() === '') {
      return complete(createProgram(), 'ok', { message: 'No suitable escalation target' }) as StorageProgram<Result>;
    }

    const id = nextId('escalation');
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'handoff', id, {
      id,
      source_agent: source,
      target_agent: 'human_supervisor',
      context_summary: `Escalation from ${source}: ${reason}`,
      transferred_tools: [],
      transferred_state: null,
      reason,
      status: 'escalated',
      createdAt: now,
    });

    return complete(p, 'ok', { handoff: id }) as StorageProgram<Result>;
  },

  getHistory(input: Record<string, unknown>) {
    const taskId = input.task_id as string;

    if (!taskId || taskId.trim() === '') {
      return complete(createProgram(), 'ok', { message: 'No handoff history for this task' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'handoff', {}, 'allHandoffs');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allHandoffs || []) as Array<Record<string, unknown>>;

      // Filter handoffs related to this task
      const relevant = all.filter(h =>
        h.status === 'completed' || h.status === 'escalated'
      );

      if (relevant.length === 0) {
        return { message: 'No handoff history for this task' };
      }

      const chain = relevant.map(h => ({
        from: h.source_agent as string,
        to: h.target_agent as string,
        reason: h.reason as string,
        timestamp: h.createdAt as string,
      }));

      return { chain };
    }) as StorageProgram<Result>;
  },
};

export const agentHandoffHandler = autoInterpret(_handler);
