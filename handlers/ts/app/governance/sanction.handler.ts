// Sanction Concept Handler
// Graduated consequences and rewards (Ostrom DP5).
import type { ConceptHandler } from '@clef/runtime';

export const sanctionHandler: ConceptHandler = {
  async impose(input, storage) {
    const id = `sanction-${Date.now()}`;
    await storage.put('sanction', id, {
      id, subject: input.subject, severity: input.severity,
      consequence: input.consequence, reason: input.reason,
      status: 'Active', imposedAt: new Date().toISOString(),
    });
    return { variant: 'imposed', sanction: id };
  },

  async escalate(input, storage) {
    const { sanction } = input;
    const record = await storage.get('sanction', sanction as string);
    if (!record) return { variant: 'not_found', sanction };
    const levels = ['Warning', 'Minor', 'Major', 'Critical', 'Expulsion'];
    const idx = levels.indexOf(record.severity as string);
    const newSeverity = levels[Math.min(idx + 1, levels.length - 1)];
    await storage.put('sanction', sanction as string, { ...record, severity: newSeverity });
    return { variant: 'escalated', sanction, newSeverity };
  },

  async appeal(input, storage) {
    const { sanction, appellant, grounds } = input;
    await storage.put('appeal', `appeal-${sanction}`, { sanction, appellant, grounds, status: 'Pending', appealedAt: new Date().toISOString() });
    return { variant: 'appealed', sanction };
  },

  async pardon(input, storage) {
    const { sanction, reason } = input;
    const record = await storage.get('sanction', sanction as string);
    if (!record) return { variant: 'not_found', sanction };
    await storage.put('sanction', sanction as string, { ...record, status: 'Pardoned', pardonReason: reason });
    return { variant: 'pardoned', sanction };
  },

  async reward(input, storage) {
    const id = `reward-${Date.now()}`;
    await storage.put('sanction', id, {
      id, subject: input.subject, type: input.type,
      amount: input.amount, reason: input.reason,
      status: 'Active', isReward: true, awardedAt: new Date().toISOString(),
    });
    return { variant: 'rewarded', sanction: id };
  },
};
