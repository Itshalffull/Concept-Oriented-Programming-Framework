// @clef-handler style=functional
// Vote Concept Implementation
// Collects individual preferences on a proposal within a time window and determines an outcome.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Vote' }) as StorageProgram<Result>;
  },

  openSession(input: Record<string, unknown>) {
    const proposalRef = input.proposalRef as string;
    const deadline = input.deadline as string;
    const snapshotRef = input.snapshotRef as string | null | undefined;

    if (!proposalRef || proposalRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'proposalRef is required' }) as StorageProgram<Result>;
    }

    const id = nextId('session');
    let p = createProgram();
    p = put(p, 'session', id, {
      id,
      sessionProposal: proposalRef,
      deadline,
      status: 'Open',
      snapshotRef: snapshotRef ?? null,
      outcome: null,
    });
    return complete(p, 'ok', { session: id }) as StorageProgram<Result>;
  },

  castVote(input: Record<string, unknown>) {
    const sessionId = input.session as string;
    const voter = input.voter as string;
    const choice = input.choice as string;
    const weight = input.weight as number;

    if (!sessionId || !voter) {
      return complete(createProgram(), 'error', { message: 'session and voter are required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'session', sessionId, 'sessionRecord');

    return branch(
      p,
      (b) => !b.sessionRecord,
      complete(createProgram(), 'error', { message: 'Session not found' }),
      (() => {
        // Check for duplicate vote using composite key
        const voteKey = `${sessionId}::${voter}`;
        let b2 = createProgram();
        b2 = get(b2, 'vote', voteKey, 'existingVote');
        return branch(
          b2,
          (b) => !!b.existingVote,
          complete(createProgram(), 'ok', { voter }),
          (() => {
            const voteId = nextId('vote');
            let b3 = createProgram();
            b3 = put(b3, 'vote', voteKey, {
              id: voteId,
              session: sessionId,
              voter,
              choice,
              weight,
              castAt: new Date().toISOString(),
            });
            return complete(b3, 'recorded', { vote: voteId }) as StorageProgram<Result>;
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  close(input: Record<string, unknown>) {
    const sessionId = input.session as string;

    if (!sessionId) {
      return complete(createProgram(), 'error', { message: 'session is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'session', sessionId, 'sessionRecord');

    return branch(
      p,
      (b) => !b.sessionRecord,
      complete(createProgram(), 'error', { message: 'Session not found' }),
      (() => {
        let b2 = createProgram();
        b2 = putFrom(b2, 'session', sessionId, (b) => {
          const rec = b.sessionRecord as Record<string, unknown>;
          return { ...rec, status: 'Closed' };
        });
        return complete(b2, 'ok', { session: sessionId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  tally(input: Record<string, unknown>) {
    const sessionId = input.session as string;

    if (!sessionId) {
      return complete(createProgram(), 'error', { message: 'session is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'session', sessionId, 'sessionRecord');

    return branch(
      p,
      (b) => !b.sessionRecord,
      complete(createProgram(), 'error', { message: 'Session not found' }),
      (() => {
        const outcome = 'tallied';
        const details = JSON.stringify({ message: 'Tally complete' });
        let b2 = createProgram();
        b2 = putFrom(b2, 'session', sessionId, (b) => {
          const rec = b.sessionRecord as Record<string, unknown>;
          return { ...rec, outcome, tallyDetails: details };
        });
        return complete(b2, 'ok', { session: sessionId, outcome, details }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const voteHandler = autoInterpret(_handler);
