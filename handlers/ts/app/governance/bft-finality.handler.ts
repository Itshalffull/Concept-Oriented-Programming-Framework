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
    const id = `bft-${Date.now()}`;
    const validators = typeof input.validators === 'string'
      ? JSON.parse(input.validators)
      : input.validators;

    let p = createProgram();
    p = put(p, 'bft', id, {
      id,
      validators: JSON.stringify(validators),
      validatorCount: (validators as string[]).length,
      faultTolerance: input.faultTolerance ?? '2/3',
      protocol: input.protocol ?? 'simple-bft',
    });

    p = put(p, 'plugin-registry', `finality-provider:${id}`, {
      id: `finality-provider:${id}`,
      pluginKind: 'finality-provider',
      provider: 'BftFinality',
      instanceId: id,
    });

    return complete(p, 'configured', { committee: id }) as StorageProgram<Result>;
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
        return complete(thenP, 'proposed', { committee, roundNumber });
      },
      (elseP) => complete(elseP, 'not_found', { committee }),
    ) as StorageProgram<Result>;
  },

  vote(input: Record<string, unknown>) {
    const { committee, roundNumber, validator, approve } = input;
    const roundKey = `${committee}:${roundNumber}`;
    let p = createProgram();
    p = get(p, 'bft_round', roundKey, 'round');

    return branch(p, 'round',
      (thenP) => {
        thenP = get(thenP, 'bft', committee as string, 'record');

        return branch(thenP, 'record',
          (hasRecord) => {
            // Check if validator is in committee
            hasRecord = mapBindings(hasRecord, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              const validators = JSON.parse(record.validators as string) as string[];
              return validators.includes(validator as string);
            }, 'isValidator');

            return branch(hasRecord, 'isValidator',
              (validP) => {
                // Write updated votes
                validP = putFrom(validP, 'bft_round', roundKey, (bindings) => {
                  const round = bindings.round as Record<string, unknown>;
                  const votes = JSON.parse(round.votes as string) as Record<string, boolean>;
                  votes[validator as string] = approve as boolean;
                  return { ...round, votes: JSON.stringify(votes) };
                });
                return complete(validP, 'voted', { committee, roundNumber, validator });
              },
              (invalidP) => complete(invalidP, 'not_a_validator', { validator }),
            );
          },
          (noRecord) => complete(noRecord, 'not_found', { committee }),
        );
      },
      (elseP) => complete(elseP, 'not_found', { committee, roundNumber }),
    ) as StorageProgram<Result>;
  },

  checkConsensus(input: Record<string, unknown>) {
    const { committee, roundNumber } = input;
    const roundKey = `${committee}:${roundNumber}`;
    let p = createProgram();
    p = get(p, 'bft_round', roundKey, 'round');

    return branch(p, 'round',
      (thenP) => {
        thenP = get(thenP, 'bft', committee as string, 'record');

        return branch(thenP, 'record',
          (hasRecord) => {
            // Compute consensus status
            hasRecord = mapBindings(hasRecord, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              const round = bindings.round as Record<string, unknown>;
              const validatorCount = record.validatorCount as number;
              const required = Math.ceil(validatorCount * 2 / 3);
              const votes = JSON.parse(round.votes as string) as Record<string, boolean>;
              const approvals = Object.values(votes).filter(v => v).length;
              const rejections = Object.values(votes).filter(v => !v).length;

              if (approvals >= required) return 'finalized';
              if (rejections > validatorCount - required) return 'rejected';
              return 'insufficient';
            }, 'consensusStatus');

            // Write status update for finalized/rejected
            hasRecord = putFrom(hasRecord, 'bft_round', roundKey, (bindings) => {
              const round = bindings.round as Record<string, unknown>;
              const status = bindings.consensusStatus as string;
              if (status === 'finalized' || status === 'rejected') {
                return { ...round, status };
              }
              return round;
            });

            return completeFrom(hasRecord, 'consensus_result', (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              const round = bindings.round as Record<string, unknown>;
              const status = bindings.consensusStatus as string;
              const validatorCount = record.validatorCount as number;
              const required = Math.ceil(validatorCount * 2 / 3);
              const votes = JSON.parse(round.votes as string) as Record<string, boolean>;
              const approvals = Object.values(votes).filter(v => v).length;
              const rejections = Object.values(votes).filter(v => !v).length;

              if (status === 'finalized') {
                return { variant: 'finalized', committee, currentVotes: approvals, required };
              }
              if (status === 'rejected') {
                return { variant: 'rejected', committee, rejections, required };
              }
              return { variant: 'insufficient', committee, currentVotes: approvals, required };
            });
          },
          (noRecord) => complete(noRecord, 'not_found', { committee }),
        );
      },
      (elseP) => complete(elseP, 'not_found', { committee }),
    ) as StorageProgram<Result>;
  },
};

export const bftFinalityHandler = autoInterpret(_bftFinalityHandler);
