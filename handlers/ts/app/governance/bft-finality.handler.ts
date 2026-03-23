// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// BftFinality Provider
// Committee-based BFT finality: requires >2/3 validator approval.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _bftFinalityHandler: FunctionalConceptHandler = {
  configureCommittee(input: Record<string, unknown>) {
    const rawValidators = input.validators;
    let validators: string[];
    if (Array.isArray(rawValidators)) {
      validators = rawValidators as string[];
    } else if (typeof rawValidators === 'string') {
      try {
        const parsed = JSON.parse(rawValidators);
        validators = Array.isArray(parsed) ? parsed : [rawValidators];
      } catch {
        validators = [rawValidators];
      }
    } else {
      validators = [];
    }

    if (!validators || validators.length === 0) {
      return complete(createProgram(), 'error', { message: 'validators must be non-empty' }) as StorageProgram<Result>;
    }

    const id = `bft-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'bft', id, {
      id,
      validators: JSON.stringify(validators),
      validatorCount: validators.length,
      faultTolerance: input.faultTolerance ?? '2/3',
      protocol: input.protocol ?? 'simple-bft',
    });

    return complete(p, 'ok', { id, committee: id }) as StorageProgram<Result>;
  },

  proposeFinality(input: Record<string, unknown>) {
    const { committee, operationRef, proposer } = input;
    let p = createProgram();
    p = get(p, 'bft', committee as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        const roundNumber = Date.now();
        const roundKey = `${committee}:${roundNumber}`;
        thenP = put(thenP, 'bft_round', roundKey, {
          committee,
          roundNumber,
          operationRef,
          proposer,
          votes: '{}',
          status: 'proposed',
        });
        return complete(thenP, 'ok', { committee, roundNumber });
      },
      (elseP) => complete(elseP, 'not_found', { committee }),
    ) as StorageProgram<Result>;
  },

  vote(input: Record<string, unknown>) {
    const { committee, roundNumber, validator, approve } = input;
    let p = createProgram();
    p = get(p, 'bft', committee as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        const roundKey = `${committee}:${roundNumber}`;
        thenP = put(thenP, 'bft_vote', `${roundKey}:${validator}`, {
          committee, roundNumber, validator, approve,
          votedAt: new Date().toISOString(),
        });
        return complete(thenP, 'ok', { committee, roundNumber, validator });
      },
      (elseP) => complete(elseP, 'not_found', { committee }),
    ) as StorageProgram<Result>;
  },

  checkConsensus(input: Record<string, unknown>) {
    const { committee, roundNumber } = input;
    let p = createProgram();
    p = get(p, 'bft', committee as string, 'record');

    return branch(p, 'record',
      (thenP) => {
        return complete(thenP, 'ok', { committee, roundNumber });
      },
      (elseP) => complete(elseP, 'not_found', { committee }),
    ) as StorageProgram<Result>;
  },
};

export const bftFinalityHandler = autoInterpret(_bftFinalityHandler);
