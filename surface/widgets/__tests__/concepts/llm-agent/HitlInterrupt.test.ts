import { describe, it, expect } from 'vitest';
import {
  hitlInterruptReducer,
  type HitlInterruptState,
  type HitlInterruptEvent,
} from '../../../vanilla/components/widgets/concepts/llm-agent/HitlInterrupt.ts';

describe('HitlInterrupt reducer', () => {
  it('starts in pending', () => {
    const state: HitlInterruptState = 'pending';
    expect(state).toBe('pending');
  });

  describe('pending state', () => {
    it('transitions to approving on APPROVE', () => {
      expect(hitlInterruptReducer('pending', { type: 'APPROVE' })).toBe('approving');
    });

    it('transitions to rejecting on REJECT', () => {
      expect(hitlInterruptReducer('pending', { type: 'REJECT' })).toBe('rejecting');
    });

    it('transitions to editing on MODIFY', () => {
      expect(hitlInterruptReducer('pending', { type: 'MODIFY' })).toBe('editing');
    });

    it('transitions to forking on FORK', () => {
      expect(hitlInterruptReducer('pending', { type: 'FORK' })).toBe('forking');
    });

    it('ignores SAVE in pending', () => {
      expect(hitlInterruptReducer('pending', { type: 'SAVE' })).toBe('pending');
    });

    it('ignores CANCEL in pending', () => {
      expect(hitlInterruptReducer('pending', { type: 'CANCEL' })).toBe('pending');
    });

    it('ignores COMPLETE in pending', () => {
      expect(hitlInterruptReducer('pending', { type: 'COMPLETE' })).toBe('pending');
    });

    it('ignores ERROR in pending', () => {
      expect(hitlInterruptReducer('pending', { type: 'ERROR' })).toBe('pending');
    });
  });

  describe('editing state', () => {
    it('transitions to pending on SAVE', () => {
      expect(hitlInterruptReducer('editing', { type: 'SAVE' })).toBe('pending');
    });

    it('transitions to pending on CANCEL', () => {
      expect(hitlInterruptReducer('editing', { type: 'CANCEL' })).toBe('pending');
    });

    it('ignores APPROVE in editing', () => {
      expect(hitlInterruptReducer('editing', { type: 'APPROVE' })).toBe('editing');
    });

    it('ignores REJECT in editing', () => {
      expect(hitlInterruptReducer('editing', { type: 'REJECT' })).toBe('editing');
    });

    it('ignores FORK in editing', () => {
      expect(hitlInterruptReducer('editing', { type: 'FORK' })).toBe('editing');
    });
  });

  describe('approving state', () => {
    it('transitions to resolved on COMPLETE', () => {
      // Note: the reducer uses 'resolved' as any since it is not in the type union
      expect(hitlInterruptReducer('approving', { type: 'COMPLETE' })).toBe('resolved');
    });

    it('transitions to pending on ERROR', () => {
      expect(hitlInterruptReducer('approving', { type: 'ERROR' })).toBe('pending');
    });

    it('ignores APPROVE in approving', () => {
      expect(hitlInterruptReducer('approving', { type: 'APPROVE' })).toBe('approving');
    });

    it('ignores SAVE in approving', () => {
      expect(hitlInterruptReducer('approving', { type: 'SAVE' })).toBe('approving');
    });
  });

  describe('rejecting state', () => {
    it('transitions to resolved on COMPLETE', () => {
      expect(hitlInterruptReducer('rejecting', { type: 'COMPLETE' })).toBe('resolved');
    });

    it('ignores REJECT in rejecting', () => {
      expect(hitlInterruptReducer('rejecting', { type: 'REJECT' })).toBe('rejecting');
    });

    it('ignores ERROR in rejecting', () => {
      expect(hitlInterruptReducer('rejecting', { type: 'ERROR' })).toBe('rejecting');
    });
  });

  describe('forking state', () => {
    it('transitions to resolved on COMPLETE', () => {
      expect(hitlInterruptReducer('forking', { type: 'COMPLETE' })).toBe('resolved');
    });

    it('ignores FORK in forking', () => {
      expect(hitlInterruptReducer('forking', { type: 'FORK' })).toBe('forking');
    });

    it('ignores ERROR in forking', () => {
      expect(hitlInterruptReducer('forking', { type: 'ERROR' })).toBe('forking');
    });
  });
});
