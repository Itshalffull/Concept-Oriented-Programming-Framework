import { describe, it, expect } from 'vitest';
import {
  verificationStatusBadgeReducer,
  type VerificationStatusBadgeState,
  type VerificationStatusBadgeEvent,
} from '../../../vanilla/components/widgets/concepts/formal-verification/VerificationStatusBadge.ts';

describe('VerificationStatusBadge reducer', () => {
  it('starts in idle', () => {
    const state: VerificationStatusBadgeState = 'idle';
    expect(state).toBe('idle');
  });

  describe('idle state', () => {
    it('transitions to hovered on HOVER', () => {
      expect(verificationStatusBadgeReducer('idle', { type: 'HOVER' })).toBe('hovered');
    });

    it('transitions to animating on STATUS_CHANGE', () => {
      expect(verificationStatusBadgeReducer('idle', { type: 'STATUS_CHANGE' })).toBe('animating');
    });

    it('ignores LEAVE in idle', () => {
      expect(verificationStatusBadgeReducer('idle', { type: 'LEAVE' })).toBe('idle');
    });

    it('ignores ANIMATION_END in idle', () => {
      expect(verificationStatusBadgeReducer('idle', { type: 'ANIMATION_END' })).toBe('idle');
    });
  });

  describe('hovered state', () => {
    it('transitions to idle on LEAVE', () => {
      expect(verificationStatusBadgeReducer('hovered', { type: 'LEAVE' })).toBe('idle');
    });

    it('ignores HOVER in hovered', () => {
      expect(verificationStatusBadgeReducer('hovered', { type: 'HOVER' })).toBe('hovered');
    });

    it('ignores STATUS_CHANGE in hovered', () => {
      expect(verificationStatusBadgeReducer('hovered', { type: 'STATUS_CHANGE' })).toBe('hovered');
    });

    it('ignores ANIMATION_END in hovered', () => {
      expect(verificationStatusBadgeReducer('hovered', { type: 'ANIMATION_END' })).toBe('hovered');
    });
  });

  describe('animating state', () => {
    it('transitions to idle on ANIMATION_END', () => {
      expect(verificationStatusBadgeReducer('animating', { type: 'ANIMATION_END' })).toBe('idle');
    });

    it('ignores HOVER in animating', () => {
      expect(verificationStatusBadgeReducer('animating', { type: 'HOVER' })).toBe('animating');
    });

    it('ignores LEAVE in animating', () => {
      expect(verificationStatusBadgeReducer('animating', { type: 'LEAVE' })).toBe('animating');
    });

    it('ignores STATUS_CHANGE in animating', () => {
      expect(verificationStatusBadgeReducer('animating', { type: 'STATUS_CHANGE' })).toBe('animating');
    });
  });
});
