// @clef-handler style=imperative
// @migrated dsl-constructs 2026-03-18
// OptimisticOracleFinality Provider
// Optimistic finality with assertion, challenge window, bond, and dispute resolution.
import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

export const optimisticOracleFinalityHandler: ConceptHandler = {
  async assertFinality(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
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

    return { variant: 'ok', assertion: id };
  },

  async challenge(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { assertion, challenger, bond } = input;
    const record = await storage.get('oo_final', assertion as string);
    if (!record) return { variant: 'not_found', assertion };

    if (record.status !== 'Pending') {
      return { variant: 'not_pending', assertion, status: record.status };
    }

    // Write back status change and challenger info
    await storage.put('oo_final', assertion as string, {
      ...record,
      status: 'Challenged',
      challenger,
      challengeBond: bond as number,
    });

    return { variant: 'challenged', assertion };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { assertion, validAssertion } = input;
    const record = await storage.get('oo_final', assertion as string);
    if (!record) return { variant: 'not_found', assertion };

    const totalBond = (record.bond as number) + ((record.challengeBond as number) ?? 0);

    if (validAssertion) {
      await storage.put('oo_final', assertion as string, { ...record, status: 'Finalized' });
      return {
        variant: 'finalized', assertion,
        bondRecipient: record.asserter,
        totalBond,
      };
    }

    await storage.put('oo_final', assertion as string, { ...record, status: 'Rejected' });
    return {
      variant: 'rejected', assertion,
      bondRecipient: record.challenger,
      totalBond,
    };
  },

  async checkExpiry(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const { assertion } = input;
    const record = await storage.get('oo_final', assertion as string);
    if (!record) return { variant: 'not_found', assertion };

    if (record.status !== 'Pending') {
      return { variant: record.status as string, assertion };
    }
    const expiresAt = new Date(record.expiresAt as string).getTime();
    const now = Date.now();
    if (now >= expiresAt) {
      return { variant: 'finalized', assertion };
    }
    const remainingMs = expiresAt - now;
    const remainingHours = remainingMs / 3600000;
    return { variant: 'still_pending', assertion, remainingHours };
  },
};
