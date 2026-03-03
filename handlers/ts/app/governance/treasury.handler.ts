// Treasury Concept Handler
// Collective asset management with authorization gates.
import type { ConceptHandler } from '@clef/runtime';

export const treasuryHandler: ConceptHandler = {
  async deposit(input, storage) {
    const { vault, token, amount, depositor } = input;
    const key = `${vault}:${token}`;
    const record = await storage.get('vault', key) ?? { balance: 0 };
    const newBalance = (record.balance as number) + (amount as number);
    await storage.put('vault', key, { vault, token, balance: newBalance, updatedAt: new Date().toISOString() });
    return { variant: 'deposited', vault, newBalance };
  },

  async withdraw(input, storage) {
    const { vault, token, amount, recipient, sourceRef } = input;
    const key = `${vault}:${token}`;
    const record = await storage.get('vault', key) ?? { balance: 0 };
    const balance = record.balance as number;
    if (balance < (amount as number)) return { variant: 'insufficient', vault, available: balance, requested: amount };
    await storage.put('vault', key, { ...record, balance: balance - (amount as number), updatedAt: new Date().toISOString() });
    return { variant: 'withdrawn', vault, newBalance: balance - (amount as number) };
  },

  async allocate(input, storage) {
    const id = `alloc-${Date.now()}`;
    await storage.put('allocation', id, {
      id, vault: input.vault, token: input.token, amount: input.amount,
      purpose: input.purpose, expiresAt: input.expiresAt ?? null, status: 'Active',
    });
    return { variant: 'allocated', allocation: id };
  },

  async releaseAllocation(input, storage) {
    const { allocation } = input;
    const record = await storage.get('allocation', allocation as string);
    if (!record) return { variant: 'not_found', allocation };
    await storage.put('allocation', allocation as string, { ...record, status: 'Released', releasedAt: new Date().toISOString() });
    return { variant: 'released', allocation };
  },
};
