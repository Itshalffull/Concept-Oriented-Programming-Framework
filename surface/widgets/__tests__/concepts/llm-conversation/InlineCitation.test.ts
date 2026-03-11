import { describe, it, expect } from 'vitest';
import {
  inlineCitationReducer,
  type InlineCitationState,
} from '../../../vanilla/components/widgets/concepts/llm-conversation/InlineCitation.ts';

describe('InlineCitation reducer', () => {
  describe('idle state', () => {
    const state: InlineCitationState = 'idle';

    it('transitions to previewing on HOVER', () => {
      expect(inlineCitationReducer(state, { type: 'HOVER' })).toBe('previewing');
    });

    it('transitions to navigating on CLICK', () => {
      expect(inlineCitationReducer(state, { type: 'CLICK' })).toBe('navigating');
    });

    it('ignores LEAVE', () => {
      expect(inlineCitationReducer(state, { type: 'LEAVE' })).toBe('idle');
    });

    it('ignores NAVIGATE_COMPLETE', () => {
      expect(inlineCitationReducer(state, { type: 'NAVIGATE_COMPLETE' })).toBe('idle');
    });
  });

  describe('previewing state', () => {
    const state: InlineCitationState = 'previewing';

    it('transitions to idle on LEAVE', () => {
      expect(inlineCitationReducer(state, { type: 'LEAVE' })).toBe('idle');
    });

    it('transitions to navigating on CLICK', () => {
      expect(inlineCitationReducer(state, { type: 'CLICK' })).toBe('navigating');
    });

    it('ignores HOVER', () => {
      expect(inlineCitationReducer(state, { type: 'HOVER' })).toBe('previewing');
    });

    it('ignores NAVIGATE_COMPLETE', () => {
      expect(inlineCitationReducer(state, { type: 'NAVIGATE_COMPLETE' })).toBe('previewing');
    });
  });

  describe('navigating state', () => {
    const state: InlineCitationState = 'navigating';

    it('transitions to idle on NAVIGATE_COMPLETE', () => {
      expect(inlineCitationReducer(state, { type: 'NAVIGATE_COMPLETE' })).toBe('idle');
    });

    it('ignores HOVER', () => {
      expect(inlineCitationReducer(state, { type: 'HOVER' })).toBe('navigating');
    });

    it('ignores LEAVE', () => {
      expect(inlineCitationReducer(state, { type: 'LEAVE' })).toBe('navigating');
    });

    it('ignores CLICK', () => {
      expect(inlineCitationReducer(state, { type: 'CLICK' })).toBe('navigating');
    });
  });

  describe('full cycle tests', () => {
    it('idle -> previewing -> idle', () => {
      let s: InlineCitationState = 'idle';
      s = inlineCitationReducer(s, { type: 'HOVER' });
      expect(s).toBe('previewing');
      s = inlineCitationReducer(s, { type: 'LEAVE' });
      expect(s).toBe('idle');
    });

    it('idle -> previewing -> navigating -> idle', () => {
      let s: InlineCitationState = 'idle';
      s = inlineCitationReducer(s, { type: 'HOVER' });
      s = inlineCitationReducer(s, { type: 'CLICK' });
      expect(s).toBe('navigating');
      s = inlineCitationReducer(s, { type: 'NAVIGATE_COMPLETE' });
      expect(s).toBe('idle');
    });

    it('idle -> navigating -> idle -> previewing', () => {
      let s: InlineCitationState = 'idle';
      s = inlineCitationReducer(s, { type: 'CLICK' });
      expect(s).toBe('navigating');
      s = inlineCitationReducer(s, { type: 'NAVIGATE_COMPLETE' });
      expect(s).toBe('idle');
      s = inlineCitationReducer(s, { type: 'HOVER' });
      expect(s).toBe('previewing');
    });
  });
});
