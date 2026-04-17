// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, mergeFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const _agentSessionHandler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'AgentSession' }) as StorageProgram<Result>;
  },

  spawn(input: Record<string, unknown>) {
    const personaPageId = input.personaPageId as string;
    const strategy = input.strategy as string;
    const tools = input.tools as string;
    const context = input.context as string;
    // attributionRef traces back to the originating request or user
    const attributionRefInput = (input.attributionRef as string | null | undefined) ?? null;
    const attributionRef: string | null =
      typeof attributionRefInput === 'string' && attributionRefInput.trim() !== ''
        ? attributionRefInput.trim()
        : null;

    // Validate non-empty personaPageId -> error variant
    if (!personaPageId || personaPageId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'personaPageId is required' }) as StorageProgram<Result>;
    }

    // Validate tools is parseable JSON -> error variant
    try {
      JSON.parse(tools || '[]');
    } catch {
      return complete(createProgram(), 'error', { message: 'tools must be a valid JSON array' }) as StorageProgram<Result>;
    }

    // Look up the AgentRegistration backing record to resolve subjectId.
    // If no registration exists the session still spawns successfully — persona
    // page existence is validated by PersonaCompiler via syncs, not here.
    // effectivePolicySnapshotRef starts as a placeholder referencing the agent
    // identity; real enforcement snapshots are materialized by the authorization
    // infrastructure at runtime.
    const sessionId = randomId();
    const agentLoopId = randomId();
    const conversationId = randomId();
    const now = new Date().toISOString();

    let p = createProgram();
    p = spGet(p, 'registration', personaPageId, 'agentReg');

    // Derive subjectId from registration: follows the "agent:{agentId}"
    // convention used by agent-registration-to-subject.sync.
    // When no registration exists, subjectId is null (spawn still proceeds).
    p = mapBindings(p, (bindings) => {
      const reg = bindings.agentReg as Record<string, unknown> | null;
      return reg ? `agent:${personaPageId}` : null;
    }, '_subjectId');

    p = mapBindings(p, (bindings) => {
      const subjectId = bindings._subjectId as string | null;
      return subjectId ? `snapshot:${subjectId}` : null;
    }, '_policySnapshotRef');

    p = putFrom(p, 'session', sessionId, (bindings) => ({
      session: sessionId,
      personaPageId,
      compilationId: '',
      agentLoopId,
      conversationId,
      strategy,
      tools,
      context,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      totalTokens: 0,
      totalCost: 0,
      metadata: '{}',
      snapshot: '',
      subjectId: bindings._subjectId as string | null,
      attributionRef,
      effectivePolicySnapshotRef: bindings._policySnapshotRef as string | null,
    }));

    return completeFrom(p, 'ok', (bindings) => ({
      session: sessionId,
      agentLoopId,
      conversationId,
      subjectId: bindings._subjectId as string | null,
      attributionRef,
      effectivePolicySnapshotRef: bindings._policySnapshotRef as string | null,
    })) as StorageProgram<Result>;
  },

  invoke(input: Record<string, unknown>) {
    const session = input.session as string;
    const goal = input.goal as string;

    let p = createProgram();
    p = spGet(p, 'session', session, 'existing');
    // Extract status from existing record for branching
    p = mapBindings(p, (bindings) => {
      const rec = bindings.existing as Record<string, unknown> | null;
      return rec ? (rec.status as string) : null;
    }, '_status');

    p = branch(p, 'existing',
      (b) => {
        // Session found — check status via nested branch
        let b2 = branch(b,
          (bindings) => (bindings._status as string) !== 'active',
          (inv) => completeFrom(inv, 'invalid', (bindings) => ({
            message: `Session is in status "${bindings._status as string}" and cannot accept new goals`,
          })) as StorageProgram<Result>,
          (ok) => {
            // Status is active — simulate invocation result
            const tokensUsed = 100;
            const cost = 0.002;
            const steps = 3;
            const result = `Completed goal: ${goal}`;
            const now = new Date().toISOString();

            let b3 = mergeFrom(ok, 'session', session, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              return {
                totalTokens: ((existing.totalTokens as number) || 0) + tokensUsed,
                totalCost: ((existing.totalCost as number) || 0) + cost,
                updatedAt: now,
              };
            });
            return complete(b3, 'ok', { result, steps, tokensUsed, cost }) as StorageProgram<Result>;
          },
        );
        return b2;
      },
      (b) => complete(b, 'notfound', { message: 'No session exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },

  suspend(input: Record<string, unknown>) {
    const session = input.session as string;

    let p = createProgram();
    p = spGet(p, 'session', session, 'existing');
    p = mapBindings(p, (bindings) => {
      const rec = bindings.existing as Record<string, unknown> | null;
      return rec ? (rec.status as string) : null;
    }, '_status');

    p = branch(p, 'existing',
      (b) => {
        return branch(b,
          (bindings) => (bindings._status as string) !== 'active',
          (inv) => completeFrom(inv, 'invalid', (bindings) => ({
            message: `Session is in status "${bindings._status as string}" and cannot be suspended`,
          })) as StorageProgram<Result>,
          (ok) => {
            const now = new Date().toISOString();
            const snapshot = JSON.stringify({ suspendedAt: now, session });

            let b2 = mergeFrom(ok, 'session', session, (_bindings) => ({
              status: 'suspended',
              snapshot,
              updatedAt: now,
            }));
            return complete(b2, 'ok', { session, snapshot }) as StorageProgram<Result>;
          },
        );
      },
      (b) => complete(b, 'notfound', { message: 'No session exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },

  resume(input: Record<string, unknown>) {
    const session = input.session as string;

    let p = createProgram();
    p = spGet(p, 'session', session, 'existing');
    p = mapBindings(p, (bindings) => {
      const rec = bindings.existing as Record<string, unknown> | null;
      return rec ? (rec.status as string) : null;
    }, '_status');

    p = branch(p, 'existing',
      (b) => {
        return branch(b,
          (bindings) => (bindings._status as string) !== 'suspended',
          (inv) => completeFrom(inv, 'invalid', (bindings) => ({
            message: `Session is in status "${bindings._status as string}" and cannot be resumed`,
          })) as StorageProgram<Result>,
          (ok) => {
            const now = new Date().toISOString();

            let b2 = mergeFrom(ok, 'session', session, (_bindings) => ({
              status: 'active',
              updatedAt: now,
            }));
            return complete(b2, 'ok', { session }) as StorageProgram<Result>;
          },
        );
      },
      (b) => complete(b, 'notfound', { message: 'No session exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },

  terminate(input: Record<string, unknown>) {
    const session = input.session as string;

    let p = createProgram();
    p = spGet(p, 'session', session, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const now = new Date().toISOString();
        let b2 = mergeFrom(b, 'session', session, (_bindings) => ({
          status: 'terminated',
          updatedAt: now,
        }));
        return completeFrom(b2, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            session,
            summary: `Session terminated. Strategy: ${rec.strategy || 'unknown'}.`,
            totalTokens: (rec.totalTokens as number) || 0,
            totalCost: (rec.totalCost as number) || 0,
          };
        }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', { message: 'No session exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },

  getStatus(input: Record<string, unknown>) {
    const session = input.session as string;

    let p = createProgram();
    p = spGet(p, 'session', session, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        const createdAt = rec.createdAt as string;
        const now = new Date();
        const created = new Date(createdAt);
        const durationMs = now.getTime() - created.getTime();
        const durationSeconds = Math.floor(durationMs / 1000);
        const duration = `${durationSeconds}s`;
        return {
          status: rec.status as string,
          personaPageId: rec.personaPageId as string,
          tokensUsed: (rec.totalTokens as number) || 0,
          cost: (rec.totalCost as number) || 0,
          duration,
        };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', { message: 'No session exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },

  list(input: Record<string, unknown>) {
    const personaPageId = input.personaPageId as string | undefined;
    const status = input.status as string | undefined;

    // Build criteria for find
    const criteria: Record<string, unknown> = {};
    if (personaPageId && personaPageId.trim() !== '') {
      criteria.personaPageId = personaPageId;
    }
    if (status && status.trim() !== '') {
      criteria.status = status;
    }

    let p = createProgram();
    p = find(p, 'session', criteria, 'results');
    return completeFrom(p, 'ok', (bindings) => ({
      sessions: JSON.stringify((bindings.results as Array<Record<string, unknown>>) || []),
    })) as StorageProgram<Result>;
  },

  cancel(input: Record<string, unknown>) {
    const session = input.session as string;

    // Guard: empty session id -> error
    if (!session || typeof session !== 'string' || session.trim() === '') {
      return complete(createProgram(), 'error', { message: 'session id is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'session', session, 'existing');
    p = mapBindings(p, (bindings) => {
      const rec = bindings.existing as Record<string, unknown> | null;
      return rec ? (rec.status as string) : null;
    }, '_status');

    p = branch(p, 'existing',
      (b) => {
        // Session found — check if status is "active" (running)
        return branch(b,
          (bindings) => (bindings._status as string) !== 'active',
          (notRunning) => completeFrom(notRunning, 'not_running', (_bindings) => ({
            session,
          })) as StorageProgram<Result>,
          (ok) => {
            const now = new Date().toISOString();
            let b2 = mergeFrom(ok, 'session', session, (_bindings) => ({
              status: 'cancelled',
              updatedAt: now,
            }));
            return complete(b2, 'ok', { session }) as StorageProgram<Result>;
          },
        );
      },
      (b) => complete(b, 'notfound', { message: 'No session exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },
};

export const agentSessionHandler = autoInterpret(_agentSessionHandler);
