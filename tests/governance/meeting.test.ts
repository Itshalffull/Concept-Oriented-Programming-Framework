// ============================================================
// Meeting Concept Conformance Tests
//
// Tests for parliamentary meeting lifecycle: scheduling,
// calling to order, motions, seconds, and adjournment.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { meetingHandler } from '../../handlers/ts/app/governance/meeting.handler.js';

describe('Meeting Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('schedule', () => {
    it('schedules a meeting', async () => {
      const result = await meetingHandler.schedule({
        title: 'Board Meeting', scheduledAt: '2026-04-01T10:00:00Z',
      }, storage);
      expect(result.variant).toBe('scheduled');
      expect(result.meeting).toBeDefined();
    });
  });

  describe('callToOrder', () => {
    it('calls a meeting to order', async () => {
      const m = await meetingHandler.schedule({
        title: 'Test', scheduledAt: '2026-04-01T10:00:00Z',
      }, storage);
      const result = await meetingHandler.callToOrder({
        meeting: m.meeting, chair: 'alice',
      }, storage);
      expect(result.variant).toBe('called_to_order');
    });
  });

  describe('motions', () => {
    it('makes and seconds a motion', async () => {
      const m = await meetingHandler.schedule({
        title: 'Motion meeting', scheduledAt: '2026-04-01T10:00:00Z',
      }, storage);
      await meetingHandler.callToOrder({ meeting: m.meeting, chair: 'alice' }, storage);

      const motion = await meetingHandler.makeMotion({
        meeting: m.meeting, mover: 'bob', motion: 'Approve budget',
      }, storage);
      expect(motion.variant).toBe('motion_made');

      const seconded = await meetingHandler.secondMotion({
        motion: motion.motion, seconder: 'charlie',
      }, storage);
      expect(seconded.variant).toBe('seconded');
    });

    it('calls the question on a motion', async () => {
      const m = await meetingHandler.schedule({
        title: 'Test', scheduledAt: '2026-04-01T10:00:00Z',
      }, storage);
      await meetingHandler.callToOrder({ meeting: m.meeting, chair: 'alice' }, storage);
      const motion = await meetingHandler.makeMotion({
        meeting: m.meeting, mover: 'bob', motion: 'Item 1',
      }, storage);
      const result = await meetingHandler.callQuestion({ motion: motion.motion }, storage);
      expect(result.variant).toBe('question_called');
    });
  });

  describe('recordMinute', () => {
    it('records minutes', async () => {
      const m = await meetingHandler.schedule({
        title: 'Minutes', scheduledAt: '2026-04-01T10:00:00Z',
      }, storage);
      const result = await meetingHandler.recordMinute({
        meeting: m.meeting, content: 'Discussion about X', recordedBy: 'secretary',
      }, storage);
      expect(result.variant).toBe('recorded');
    });
  });

  describe('adjourn', () => {
    it('adjourns a meeting', async () => {
      const m = await meetingHandler.schedule({
        title: 'Adjourn', scheduledAt: '2026-04-01T10:00:00Z',
      }, storage);
      const result = await meetingHandler.adjourn({ meeting: m.meeting }, storage);
      expect(result.variant).toBe('adjourned');
    });
  });
});
