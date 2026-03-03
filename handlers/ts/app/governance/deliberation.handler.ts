// Deliberation Concept Handler
// Async threaded discussion with signals and summaries.
import type { ConceptHandler } from '@clef/runtime';

export const deliberationHandler: ConceptHandler = {
  async open(input, storage) {
    const id = `thread-${Date.now()}`;
    await storage.put('thread', id, {
      id, topic: input.topic, proposalRef: input.proposalRef ?? null,
      status: 'Open', entries: [], openedAt: new Date().toISOString(),
    });
    return { variant: 'opened', thread: id };
  },

  async addEntry(input, storage) {
    const { thread, author, content, parentEntry } = input;
    const record = await storage.get('thread', thread as string);
    if (!record) return { variant: 'not_found', thread };
    if (record.status !== 'Open') return { variant: 'closed', thread };
    const entryId = `entry-${Date.now()}`;
    const entries = record.entries as unknown[];
    entries.push({ entryId, author, content, parentEntry: parentEntry ?? null, postedAt: new Date().toISOString() });
    await storage.put('thread', thread as string, { ...record, entries });
    return { variant: 'added', entry: entryId };
  },

  async signal(input, storage) {
    const { thread, participant, signal } = input;
    return { variant: 'signaled', thread, participant, signal };
  },

  async close(input, storage) {
    const { thread, summary } = input;
    const record = await storage.get('thread', thread as string);
    if (!record) return { variant: 'not_found', thread };
    await storage.put('thread', thread as string, { ...record, status: 'Closed', summary, closedAt: new Date().toISOString() });
    return { variant: 'closed', thread };
  },
};
