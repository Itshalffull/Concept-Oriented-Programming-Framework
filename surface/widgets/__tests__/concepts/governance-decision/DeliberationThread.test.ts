import { describe, it, expect } from 'vitest';
import {
  deliberationThreadReducer,
  type DeliberationThreadMachineContext,
  type DeliberationThreadEvent,
} from '../../../vanilla/components/widgets/concepts/governance-decision/DeliberationThread.ts';

function ctx(state: DeliberationThreadMachineContext['state'], replyTargetId: string | null = null, selectedEntryId: string | null = null): DeliberationThreadMachineContext {
  return { state, replyTargetId, selectedEntryId };
}

describe('DeliberationThread reducer', () => {
  it('starts in viewing', () => {
    const initial = ctx('viewing');
    expect(initial.state).toBe('viewing');
  });

  describe('viewing state', () => {
    it('transitions to composing on REPLY_TO', () => {
      const result = deliberationThreadReducer(ctx('viewing'), { type: 'REPLY_TO', entryId: 'e1' });
      expect(result.state).toBe('composing');
      expect(result.replyTargetId).toBe('e1');
      expect(result.selectedEntryId).toBeNull();
    });

    it('transitions to entrySelected on SELECT_ENTRY', () => {
      const result = deliberationThreadReducer(ctx('viewing'), { type: 'SELECT_ENTRY', entryId: 'e2' });
      expect(result.state).toBe('entrySelected');
      expect(result.selectedEntryId).toBe('e2');
    });

    it('ignores SEND in viewing', () => {
      const input = ctx('viewing');
      const result = deliberationThreadReducer(input, { type: 'SEND' });
      expect(result.state).toBe('viewing');
    });

    it('ignores CANCEL in viewing', () => {
      const input = ctx('viewing');
      const result = deliberationThreadReducer(input, { type: 'CANCEL' });
      expect(result.state).toBe('viewing');
    });

    it('ignores DESELECT in viewing', () => {
      const input = ctx('viewing');
      const result = deliberationThreadReducer(input, { type: 'DESELECT' });
      expect(result.state).toBe('viewing');
    });
  });

  describe('composing state', () => {
    it('transitions to viewing on SEND', () => {
      const result = deliberationThreadReducer(ctx('composing', 'e1'), { type: 'SEND' });
      expect(result.state).toBe('viewing');
      expect(result.replyTargetId).toBeNull();
    });

    it('transitions to viewing on CANCEL', () => {
      const result = deliberationThreadReducer(ctx('composing', 'e1'), { type: 'CANCEL' });
      expect(result.state).toBe('viewing');
      expect(result.replyTargetId).toBeNull();
    });

    it('ignores REPLY_TO in composing', () => {
      const result = deliberationThreadReducer(ctx('composing', 'e1'), { type: 'REPLY_TO', entryId: 'e2' });
      expect(result.state).toBe('composing');
    });

    it('ignores SELECT_ENTRY in composing', () => {
      const result = deliberationThreadReducer(ctx('composing', 'e1'), { type: 'SELECT_ENTRY', entryId: 'e2' });
      expect(result.state).toBe('composing');
    });

    it('ignores DESELECT in composing', () => {
      const result = deliberationThreadReducer(ctx('composing', 'e1'), { type: 'DESELECT' });
      expect(result.state).toBe('composing');
    });
  });

  describe('entrySelected state', () => {
    it('transitions to viewing on DESELECT', () => {
      const result = deliberationThreadReducer(ctx('entrySelected', null, 'e1'), { type: 'DESELECT' });
      expect(result.state).toBe('viewing');
      expect(result.selectedEntryId).toBeNull();
    });

    it('transitions to composing on REPLY_TO', () => {
      const result = deliberationThreadReducer(ctx('entrySelected', null, 'e1'), { type: 'REPLY_TO', entryId: 'e1' });
      expect(result.state).toBe('composing');
      expect(result.replyTargetId).toBe('e1');
    });

    it('ignores SEND in entrySelected', () => {
      const result = deliberationThreadReducer(ctx('entrySelected', null, 'e1'), { type: 'SEND' });
      expect(result.state).toBe('entrySelected');
    });

    it('ignores CANCEL in entrySelected', () => {
      const result = deliberationThreadReducer(ctx('entrySelected', null, 'e1'), { type: 'CANCEL' });
      expect(result.state).toBe('entrySelected');
    });
  });
});
