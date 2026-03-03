// Timelock Concept Handler
// Safety delay between governance decision and execution — @gate concept.
import type { ConceptHandler } from '@clef/runtime';

export const timelockHandler: ConceptHandler = {
  async schedule(input, storage) {
    const id = `timelock-${Date.now()}`;
    const eta = new Date(Date.now() + (input.delayHours as number) * 3600000).toISOString();
    const grace = new Date(Date.now() + ((input.delayHours as number) + (input.gracePeriodHours as number)) * 3600000).toISOString();
    await storage.put('timelock', id, {
      id, operationHash: input.operationHash, payload: input.payload,
      delayHours: input.delayHours, gracePeriodHours: input.gracePeriodHours,
      eta, graceEnd: grace, status: 'Queued', queuedAt: new Date().toISOString(),
    });
    return { variant: 'queued', lock: id };
  },

  async execute(input, storage) {
    const { lock } = input;
    const record = await storage.get('timelock', lock as string);
    if (!record) return { variant: 'not_found', lock };
    if (new Date() < new Date(record.eta as string)) return { variant: 'not_ready', lock, eta: record.eta };
    await storage.put('timelock', lock as string, { ...record, status: 'Executed', executedAt: new Date().toISOString() });
    return { variant: 'executed', lock, payload: record.payload };
  },

  async cancel(input, storage) {
    const { lock, reason } = input;
    const record = await storage.get('timelock', lock as string);
    if (!record) return { variant: 'not_found', lock };
    await storage.put('timelock', lock as string, { ...record, status: 'Cancelled', cancelReason: reason });
    return { variant: 'cancelled', lock };
  },
};
