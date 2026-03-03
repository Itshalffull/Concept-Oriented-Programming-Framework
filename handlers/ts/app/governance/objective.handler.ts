// Objective Concept Handler
// OKR / Balanced Scorecard objective tracking.
import type { ConceptHandler } from '@clef/runtime';

export const objectiveHandler: ConceptHandler = {
  async create(input, storage) {
    const id = `objective-${Date.now()}`;
    await storage.put('objective', id, {
      id, title: input.title, description: input.description,
      metricRefs: input.metricRefs ?? [],
      targetDate: input.targetDate, owner: input.owner,
      status: 'Active', progress: 0, createdAt: new Date().toISOString(),
    });
    return { variant: 'created', objective: id };
  },

  async updateProgress(input, storage) {
    const { objective, metricRef, currentValue } = input;
    const record = await storage.get('objective', objective as string);
    if (!record) return { variant: 'not_found', objective };
    await storage.put('objective', objective as string, { ...record, progress: currentValue, updatedAt: new Date().toISOString() });
    return { variant: 'updated', objective, progress: currentValue };
  },

  async evaluate(input, storage) {
    const { objective } = input;
    const record = await storage.get('objective', objective as string);
    if (!record) return { variant: 'not_found', objective };
    // Stub: real impl evaluates progress against target
    const achieved = (record.progress as number) >= 100;
    const newStatus = achieved ? 'Achieved' : 'Missed';
    await storage.put('objective', objective as string, { ...record, status: newStatus });
    return achieved
      ? { variant: 'achieved', objective }
      : { variant: 'missed', objective, progress: record.progress };
  },

  async cancel(input, storage) {
    const { objective, reason } = input;
    const record = await storage.get('objective', objective as string);
    if (!record) return { variant: 'not_found', objective };
    await storage.put('objective', objective as string, { ...record, status: 'Cancelled', cancelReason: reason });
    return { variant: 'cancelled', objective };
  },
};
