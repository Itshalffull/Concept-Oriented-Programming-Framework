// ============================================================
// Deliberation Concept Conformance Tests
//
// Tests for deliberation threads: opening, adding entries,
// signaling sentiment, and closing.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { deliberationHandler } from '../../handlers/ts/app/governance/deliberation.handler.js';

describe('Deliberation Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('open', () => {
    it('opens a deliberation thread', async () => {
      const result = await deliberationHandler.open({
        topic: 'Budget allocation strategy',
      }, storage);
      expect(result.variant).toBe('opened');
      expect(result.thread).toBeDefined();
    });
  });

  describe('addEntry', () => {
    it('adds an entry to a thread', async () => {
      const thread = await deliberationHandler.open({ topic: 'Test' }, storage);
      const result = await deliberationHandler.addEntry({
        thread: thread.thread, author: 'alice', content: 'I think we should increase the budget.',
      }, storage);
      expect(result.variant).toBe('added');
    });

    it('rejects entries on closed thread', async () => {
      const thread = await deliberationHandler.open({ topic: 'Closed topic' }, storage);
      await deliberationHandler.close({ thread: thread.thread, summary: 'Done' }, storage);
      const result = await deliberationHandler.addEntry({
        thread: thread.thread, author: 'bob', content: 'Too late',
      }, storage);
      expect(result.variant).toBe('closed');
    });
  });

  describe('signal', () => {
    it('records a sentiment signal', async () => {
      const thread = await deliberationHandler.open({ topic: 'Signals' }, storage);
      const result = await deliberationHandler.signal({
        thread: thread.thread, participant: 'alice', signal: 'support',
      }, storage);
      expect(result.variant).toBe('signaled');
    });
  });

  describe('close', () => {
    it('closes a thread with a summary', async () => {
      const thread = await deliberationHandler.open({ topic: 'Closeable' }, storage);
      const result = await deliberationHandler.close({
        thread: thread.thread, summary: 'Consensus reached on budget increase',
      }, storage);
      expect(result.variant).toBe('closed');
    });
  });
});
