// Execution Concept Handler
// Atomic action execution with rollback support.
import type { ConceptHandler } from '@clef/runtime';

export const executionHandler: ConceptHandler = {
  async schedule(input, storage) {
    const id = `execution-${Date.now()}`;
    await storage.put('execution', id, {
      id, sourceRef: input.sourceRef, actions: input.actions,
      executor: input.executor, status: 'Pending', scheduledAt: new Date().toISOString(),
    });
    return { variant: 'scheduled', execution: id };
  },

  async execute(input, storage) {
    const { execution } = input;
    const record = await storage.get('execution', execution as string);
    if (!record) return { variant: 'not_found', execution };
    await storage.put('execution', execution as string, { ...record, status: 'Completed', completedAt: new Date().toISOString() });
    return { variant: 'completed', execution, result: 'success' };
  },

  async rollback(input, storage) {
    const { execution, reason } = input;
    const record = await storage.get('execution', execution as string);
    if (!record) return { variant: 'not_found', execution };
    await storage.put('execution', execution as string, { ...record, status: 'Rolled_Back', rollbackReason: reason });
    return { variant: 'rolled_back', execution };
  },
};
