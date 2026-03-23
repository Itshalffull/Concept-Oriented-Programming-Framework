// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// SybilResistance Concept Handler
// Coordination concept ensuring each participant has at most one identity.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _sybilResistanceHandler: FunctionalConceptHandler = {
  verify(input: Record<string, unknown>) {
    if (!input.candidate || (typeof input.candidate === 'string' && (input.candidate as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'candidate is required' }) as StorageProgram<Result>;
    }
    const { candidate, method, evidence } = input;
    let p = createProgram();
    p = get(p, 'verified', candidate as string, 'existing');

    p = branch(p, 'existing',
      (b) => complete(b, 'already_verified', { candidate }),
      (b) => {
        const id = `sybil-${Date.now()}`;
        let b2 = put(b, 'verified', candidate as string, { id, candidate, method, evidence, verifiedAt: new Date().toISOString() });
        return complete(b2, 'ok', { id });
      },
    );

    return p as StorageProgram<Result>;
  },

  challenge(input: Record<string, unknown>) {
    const { targetId, challenger, evidence } = input;
    let p = createProgram();
    p = get(p, 'verified', targetId as string, 'target');

    p = branch(p, 'target',
      (b) => {
        const challengeId = `challenge-${Date.now()}`;
        let b2 = put(b, 'challenge', challengeId, { challengeId, targetId, challenger, evidence, status: 'Open' });
        return complete(b2, 'ok', { challengeId });
      },
      (b) => complete(b, 'invalid_target', { targetId }),
    );

    return p as StorageProgram<Result>;
  },

  resolveChallenge(input: Record<string, unknown>) {
    const { challengeId, outcome } = input;
    let p = createProgram();
    p = get(p, 'challenge', challengeId as string, 'record');

    p = branch(p, 'record',
      (b) => {
        if (outcome === 'upheld') {
          return completeFrom(b, 'upheld', (bindings) => {
            const record = bindings.record as Record<string, unknown>;
            return { challengeId, removedId: record.targetId };
          });
        }
        let b2 = put(b, 'challenge', challengeId as string, { status: 'Overturned' });
        return complete(b2, 'ok', { challengeId });
      },
      (b) => complete(b, 'not_found', { challengeId }),
    );

    return p as StorageProgram<Result>;
  },
};

export const sybilResistanceHandler = autoInterpret(_sybilResistanceHandler);
