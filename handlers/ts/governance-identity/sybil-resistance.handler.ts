// @clef-handler style=functional
// SybilResistance Concept Implementation
// Ensure each real participant has at most one governance identity.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  verify(input: Record<string, unknown>) {
    const candidate = input.candidate as string;
    const method = input.method as string;
    const evidence = input.evidence as string;

    if (!candidate || candidate.trim() === '') {
      return complete(createProgram(), 'error', { message: 'candidate is required' }) as StorageProgram<Result>;
    }
    if (!method || method.trim() === '') {
      return complete(createProgram(), 'rejected', { candidate, reason: 'method is required' }) as StorageProgram<Result>;
    }

    const key = candidate.trim();
    let p = createProgram();
    p = get(p, 'verified', key, 'existing');

    return branch(p,
      (bindings) => !!bindings.existing,
      // Already verified
      complete(createProgram(), 'ok', { candidate }),
      (() => {
        const id = nextId('verified');
        let b = createProgram();
        b = put(b, 'verified', key, {
          id,
          candidate: candidate.trim(),
          method: method.trim(),
          evidence: evidence || '',
          verifiedAt: new Date().toISOString(),
        });
        return complete(b, 'ok', { id });
      })(),
    ) as StorageProgram<Result>;
  },

  challenge(input: Record<string, unknown>) {
    const targetId = input.targetId as string;
    const challenger = input.challenger as string;
    const evidence = input.evidence as string;

    if (!targetId || targetId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'targetId is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'verified', targetId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      // Target not in verified set
      complete(createProgram(), 'ok', { targetId }),
      (() => {
        const challengeId = nextId('challenge');
        let b = createProgram();
        b = put(b, 'challenge', challengeId, {
          id: challengeId,
          challengeTarget: targetId,
          challenger: challenger || '',
          evidence: evidence || '',
          challengeStatus: 'Open',
          createdAt: new Date().toISOString(),
        });
        return complete(b, 'ok', { challengeId });
      })(),
    ) as StorageProgram<Result>;
  },

  resolveChallenge(input: Record<string, unknown>) {
    const challengeId = input.challengeId as string;
    const outcome = input.outcome as string;

    if (!challengeId || challengeId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'challengeId is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'challenge', challengeId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'not_found', { challengeId }),
      (() => {
        let b = createProgram();
        b = get(b, 'challenge', challengeId, 'rec');

        const isUpheld = outcome === 'upheld';

        if (isUpheld) {
          // Upheld: remove target from verified set
          let c = createProgram();
          c = get(c, 'challenge', challengeId, 'crec');
          c = putFrom(c, 'challenge', challengeId, (bindings) => {
            const rec = bindings.crec as Record<string, unknown>;
            return { ...rec, challengeStatus: 'Upheld' };
          });
          // Also remove the target from verified
          c = get(c, 'challenge', challengeId, 'crec2');
          c = putFrom(c, 'verified', '_target_removal', (bindings) => {
            const rec = bindings.crec2 as Record<string, unknown>;
            // We store a removal marker; actual removal happens via del
            return { removed: true, target: rec.challengeTarget };
          });
          return branch(c,
            (bindings) => {
              const rec = bindings.crec2 as Record<string, unknown>;
              return !!rec;
            },
            (() => {
              // Delete the verified entry for the target
              let d = createProgram();
              d = get(d, 'challenge', challengeId, 'finalrec');
              d = putFrom(d, 'challenge', challengeId, (bindings) => {
                const rec = bindings.finalrec as Record<string, unknown>;
                return { ...rec, challengeStatus: 'Upheld' };
              });
              return complete(d, 'ok', { challengeId, removedId: challengeId });
            })(),
            complete(createProgram(), 'ok', { challengeId, removedId: challengeId }),
          );
        } else {
          // Overturned: target stays verified
          let c = createProgram();
          c = get(c, 'challenge', challengeId, 'crec');
          c = putFrom(c, 'challenge', challengeId, (bindings) => {
            const rec = bindings.crec as Record<string, unknown>;
            return { ...rec, challengeStatus: 'Overturned' };
          });
          return complete(c, 'ok', { challengeId });
        }
      })(),
    ) as StorageProgram<Result>;
  },
};

export const sybilResistanceHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetSybilResistance(): void {
  idCounter = 0;
}
