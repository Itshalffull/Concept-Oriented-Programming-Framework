// ChangeStream concept handler tests -- append, subscribe, read, acknowledge, and replay.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { changeStreamHandler, resetChangeStreamCounter } from '../handlers/ts/change-stream.handler.js';

describe('ChangeStream', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetChangeStreamCounter();
  });

  describe('append', () => {
    it('appends a valid event and returns incremented offset', async () => {
      const result = await changeStreamHandler.append(
        { type: 'insert', before: null, after: 'doc-1', source: 'users' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.offset).toBe(1);
      expect(result.eventId).toBe('change-stream-1');
    });

    it('rejects invalid event type', async () => {
      const result = await changeStreamHandler.append(
        { type: 'bogus', source: 'users' },
        storage,
      );
      expect(result.variant).toBe('invalidType');
    });

    it('increments offset for sequential appends', async () => {
      const r1 = await changeStreamHandler.append({ type: 'insert', source: 'a' }, storage);
      const r2 = await changeStreamHandler.append({ type: 'update', source: 'a' }, storage);
      const r3 = await changeStreamHandler.append({ type: 'delete', source: 'a' }, storage);
      expect(r1.offset).toBe(1);
      expect(r2.offset).toBe(2);
      expect(r3.offset).toBe(3);
    });

    it('accepts all valid event types', async () => {
      const types = ['insert', 'update', 'delete', 'replace', 'drop', 'rename', 'invalidate'];
      for (const type of types) {
        const result = await changeStreamHandler.append({ type, source: 'test' }, storage);
        expect(result.variant).toBe('ok');
      }
    });
  });

  describe('subscribe', () => {
    it('creates a subscription from offset 0 by default', async () => {
      const result = await changeStreamHandler.subscribe({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.subscriptionId).toBe('sub-1');
    });

    it('creates a subscription from a specific offset', async () => {
      const result = await changeStreamHandler.subscribe({ fromOffset: 5 }, storage);
      expect(result.variant).toBe('ok');
    });
  });

  describe('read', () => {
    it('reads events from the subscription position', async () => {
      await changeStreamHandler.append({ type: 'insert', source: 'a' }, storage);
      await changeStreamHandler.append({ type: 'update', source: 'a' }, storage);

      const sub = await changeStreamHandler.subscribe({}, storage);
      const subId = sub.subscriptionId as string;

      const result = await changeStreamHandler.read({ subscriptionId: subId, maxCount: 10 }, storage);
      expect(result.variant).toBe('ok');
      expect((result.events as unknown[]).length).toBe(2);
    });

    it('returns endOfStream when no new events exist', async () => {
      const sub = await changeStreamHandler.subscribe({}, storage);
      const result = await changeStreamHandler.read({ subscriptionId: sub.subscriptionId as string, maxCount: 10 }, storage);
      expect(result.variant).toBe('endOfStream');
    });

    it('returns notFound for invalid subscription', async () => {
      const result = await changeStreamHandler.read({ subscriptionId: 'nonexistent', maxCount: 10 }, storage);
      expect(result.variant).toBe('notFound');
    });

    it('respects maxCount limit', async () => {
      for (let i = 0; i < 5; i++) {
        await changeStreamHandler.append({ type: 'insert', source: 'a' }, storage);
      }

      const sub = await changeStreamHandler.subscribe({}, storage);
      const result = await changeStreamHandler.read({ subscriptionId: sub.subscriptionId as string, maxCount: 2 }, storage);
      expect(result.variant).toBe('ok');
      expect((result.events as unknown[]).length).toBe(2);
    });

    it('advances subscription position after read', async () => {
      for (let i = 0; i < 4; i++) {
        await changeStreamHandler.append({ type: 'insert', source: 'a' }, storage);
      }

      const sub = await changeStreamHandler.subscribe({}, storage);
      const subId = sub.subscriptionId as string;

      // Read first 2
      const r1 = await changeStreamHandler.read({ subscriptionId: subId, maxCount: 2 }, storage);
      expect((r1.events as unknown[]).length).toBe(2);

      // Read remaining 2
      const r2 = await changeStreamHandler.read({ subscriptionId: subId, maxCount: 10 }, storage);
      expect((r2.events as unknown[]).length).toBe(2);

      // No more events
      const r3 = await changeStreamHandler.read({ subscriptionId: subId, maxCount: 10 }, storage);
      expect(r3.variant).toBe('endOfStream');
    });
  });

  describe('acknowledge', () => {
    it('stores an acknowledgment for a consumer', async () => {
      const result = await changeStreamHandler.acknowledge({ consumer: 'worker-1', offset: 5 }, storage);
      expect(result.variant).toBe('ok');
    });
  });

  describe('replay', () => {
    it('replays events in a given range', async () => {
      await changeStreamHandler.append({ type: 'insert', source: 'a' }, storage);
      await changeStreamHandler.append({ type: 'update', source: 'a' }, storage);
      await changeStreamHandler.append({ type: 'delete', source: 'a' }, storage);

      const result = await changeStreamHandler.replay({ from: 1, to: 2 }, storage);
      expect(result.variant).toBe('ok');
      expect((result.events as unknown[]).length).toBe(2);
    });

    it('replays all events from offset to end if no to specified', async () => {
      await changeStreamHandler.append({ type: 'insert', source: 'a' }, storage);
      await changeStreamHandler.append({ type: 'update', source: 'a' }, storage);

      const result = await changeStreamHandler.replay({ from: 1 }, storage);
      expect(result.variant).toBe('ok');
      expect((result.events as unknown[]).length).toBe(2);
    });

    it('returns invalidRange for offset beyond stream', async () => {
      const result = await changeStreamHandler.replay({ from: 100 }, storage);
      expect(result.variant).toBe('invalidRange');
    });

    it('returns invalidRange for offset less than 1', async () => {
      await changeStreamHandler.append({ type: 'insert', source: 'a' }, storage);
      const result = await changeStreamHandler.replay({ from: 0 }, storage);
      expect(result.variant).toBe('invalidRange');
    });
  });
});
