// BftFinality Provider
// Committee-based BFT finality: requires >2/3 validator approval.
import type { ConceptHandler } from '@clef/runtime';

export const bftFinalityHandler: ConceptHandler = {
  async configureCommittee(input, storage) {
    const id = `bft-${Date.now()}`;
    const validators = typeof input.validators === 'string'
      ? JSON.parse(input.validators)
      : input.validators;

    await storage.put('bft', id, {
      id,
      validators: JSON.stringify(validators),
      validatorCount: (validators as string[]).length,
      faultTolerance: input.faultTolerance ?? '2/3',
      protocol: input.protocol ?? 'simple-bft',
    });

    await storage.put('plugin-registry', `finality-provider:${id}`, {
      id: `finality-provider:${id}`,
      pluginKind: 'finality-provider',
      provider: 'BftFinality',
      instanceId: id,
    });

    return { variant: 'configured', committee: id };
  },

  async proposeFinality(input, storage) {
    const { committee, operationRef, proposer } = input;
    const record = await storage.get('bft', committee as string);
    if (!record) return { variant: 'not_found', committee };

    const roundNumber = Date.now();
    const roundKey = `${committee}:${roundNumber}`;
    await storage.put('bft_round', roundKey, {
      committee,
      roundNumber,
      operationRef,
      proposer,
      votes: '{}',
      status: 'proposed',
    });

    return { variant: 'proposed', committee, roundNumber };
  },

  async vote(input, storage) {
    const { committee, roundNumber, validator, approve } = input;
    const roundKey = `${committee}:${roundNumber}`;
    const round = await storage.get('bft_round', roundKey);
    if (!round) return { variant: 'not_found', committee, roundNumber };

    // Verify validator is in committee
    const record = await storage.get('bft', committee as string);
    if (!record) return { variant: 'not_found', committee };
    const validators = JSON.parse(record.validators as string) as string[];
    if (!validators.includes(validator as string)) {
      return { variant: 'not_a_validator', validator };
    }

    const votes = JSON.parse(round.votes as string) as Record<string, boolean>;
    votes[validator as string] = approve as boolean;

    await storage.put('bft_round', roundKey, { ...round, votes: JSON.stringify(votes) });

    return { variant: 'voted', committee, roundNumber, validator };
  },

  async checkConsensus(input, storage) {
    const { committee, roundNumber } = input;
    const roundKey = `${committee}:${roundNumber}`;
    const round = await storage.get('bft_round', roundKey);
    if (!round) return { variant: 'not_found', committee };

    const record = await storage.get('bft', committee as string);
    if (!record) return { variant: 'not_found', committee };

    const validatorCount = record.validatorCount as number;
    const required = Math.ceil(validatorCount * 2 / 3);
    const votes = JSON.parse(round.votes as string) as Record<string, boolean>;

    const approvals = Object.values(votes).filter(v => v).length;
    const rejections = Object.values(votes).filter(v => !v).length;

    if (approvals >= required) {
      await storage.put('bft_round', roundKey, { ...round, status: 'finalized' });
      return { variant: 'finalized', committee, currentVotes: approvals, required };
    }

    if (rejections > validatorCount - required) {
      await storage.put('bft_round', roundKey, { ...round, status: 'rejected' });
      return { variant: 'rejected', committee, rejections, required };
    }

    return { variant: 'insufficient', committee, currentVotes: approvals, required };
  },
};
