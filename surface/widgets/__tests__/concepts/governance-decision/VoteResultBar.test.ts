import { describe, it, expect } from 'vitest';
import {
  voteResultBarReducer,
  type VoteResultBarState,
  type VoteResultBarEvent,
} from '../../../vanilla/components/widgets/concepts/governance-decision/VoteResultBar.ts';

describe('VoteResultBar reducer', () => {
  it('starts in idle', () => {
    const state: VoteResultBarState = 'idle';
    expect(state).toBe('idle');
  });

  describe('idle state', () => {
    it('transitions to segmentHovered on HOVER_SEGMENT', () => {
      expect(voteResultBarReducer('idle', { type: 'HOVER_SEGMENT', index: 0 })).toBe('segmentHovered');
    });

    it('transitions to animating on ANIMATE_IN', () => {
      expect(voteResultBarReducer('idle', { type: 'ANIMATE_IN' })).toBe('animating');
    });

    it('ignores ANIMATION_END in idle', () => {
      expect(voteResultBarReducer('idle', { type: 'ANIMATION_END' })).toBe('idle');
    });

    it('ignores UNHOVER in idle', () => {
      expect(voteResultBarReducer('idle', { type: 'UNHOVER' })).toBe('idle');
    });
  });

  describe('animating state', () => {
    it('transitions to idle on ANIMATION_END', () => {
      expect(voteResultBarReducer('animating', { type: 'ANIMATION_END' })).toBe('idle');
    });

    it('ignores HOVER_SEGMENT in animating', () => {
      expect(voteResultBarReducer('animating', { type: 'HOVER_SEGMENT', index: 0 })).toBe('animating');
    });

    it('ignores ANIMATE_IN in animating', () => {
      expect(voteResultBarReducer('animating', { type: 'ANIMATE_IN' })).toBe('animating');
    });

    it('ignores UNHOVER in animating', () => {
      expect(voteResultBarReducer('animating', { type: 'UNHOVER' })).toBe('animating');
    });
  });

  describe('segmentHovered state', () => {
    it('transitions to idle on UNHOVER', () => {
      expect(voteResultBarReducer('segmentHovered', { type: 'UNHOVER' })).toBe('idle');
    });

    it('stays segmentHovered on HOVER_SEGMENT (different segment)', () => {
      expect(voteResultBarReducer('segmentHovered', { type: 'HOVER_SEGMENT', index: 2 })).toBe('segmentHovered');
    });

    it('ignores ANIMATE_IN in segmentHovered', () => {
      expect(voteResultBarReducer('segmentHovered', { type: 'ANIMATE_IN' })).toBe('segmentHovered');
    });

    it('ignores ANIMATION_END in segmentHovered', () => {
      expect(voteResultBarReducer('segmentHovered', { type: 'ANIMATION_END' })).toBe('segmentHovered');
    });
  });
});
