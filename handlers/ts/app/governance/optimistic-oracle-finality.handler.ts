// OptimisticOracleFinality Provider
// Optimistic finality with assertion, challenge window, bond, and dispute resolution.
import type { ConceptHandler } from '@clef/runtime';

export const optimisticOracleFinalityHandler: ConceptHandler = {
  async assertFinality(input, storage) {
    const id = `oo-${Date.now()}`;
    const challengeWindowHours = (input.challengeWindowHours as number) ?? 24;
    const expiresAt = new Date(Date.now() + challengeWindowHours * 3600000).toISOString();

    await storage.put('oo_final', id, {
      id,
      operationRef: input.operationRef,
      asserter: input.asserter,
      bond: input.bond as number,
      challengeWindowHours,
      expiresAt,
      status: 'Pending',
      challenger: null,
      challengeBond: null,
    });

    await storage.put('plugin-registry', `finality-provider:${id}`, {
      id: `finality-provider:${id}`,
      pluginKind: 'finality-provider',
      provider: 'OptimisticOracleFinality',
      instanceId: id,
    });

    return { variant: 'asserted', assertion: id };
  },

  async challenge(input, storage) {
    const { assertion, challenger, bond } = input;
    const record = await storage.get('oo_final', assertion as string);
    if (!record) return { variant: 'not_found', assertion };
    if (record.status !== 'Pending') return { variant: 'not_pending', assertion, status: record.status };

    await storage.put('oo_final', assertion as string, {
      ...record,
      status: 'Challenged',
      challenger,
      challengeBond: bond ?? record.bond,
      challengedAt: new Date().toISOString(),
    });

    return { variant: 'challenged', assertion };
  },

  async resolve(input, storage) {
    const { assertion, validAssertion } = input;
    const record = await storage.get('oo_final', assertion as string);
    if (!record) return { variant: 'not_found', assertion };

    if (validAssertion) {
      // Asserter wins: gets their bond back + challenger's bond
      await storage.put('oo_final', assertion as string, {
        ...record,
        status: 'Finalized',
        resolvedAt: new Date().toISOString(),
        bondRecipient: record.asserter,
      });
      return {
        variant: 'finalized', assertion,
        bondRecipient: record.asserter,
        totalBond: (record.bond as number) + ((record.challengeBond as number) ?? 0),
      };
    }

    // Challenger wins: gets their bond back + asserter's bond
    await storage.put('oo_final', assertion as string, {
      ...record,
      status: 'Rejected',
      resolvedAt: new Date().toISOString(),
      bondRecipient: record.challenger,
    });
    return {
      variant: 'rejected', assertion,
      bondRecipient: record.challenger,
      totalBond: (record.bond as number) + ((record.challengeBond as number) ?? 0),
    };
  },

  async checkExpiry(input, storage) {
    const { assertion } = input;
    const record = await storage.get('oo_final', assertion as string);
    if (!record) return { variant: 'not_found', assertion };

    if (record.status !== 'Pending') {
      return { variant: record.status as string, assertion };
    }

    const expiresAt = new Date(record.expiresAt as string).getTime();
    const now = Date.now();

    if (now >= expiresAt) {
      await storage.put('oo_final', assertion as string, {
        ...record,
        status: 'Finalized',
        resolvedAt: new Date().toISOString(),
      });
      return { variant: 'finalized', assertion };
    }

    const remainingMs = expiresAt - now;
    const remainingHours = remainingMs / 3600000;
    return { variant: 'still_pending', assertion, remainingHours };
  },
};
