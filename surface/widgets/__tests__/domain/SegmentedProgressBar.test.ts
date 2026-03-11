import { describe, it, expect } from 'vitest';
import {
  segmentedProgressBarReducer,
  type SegmentedProgressBarState,
} from '../../vanilla/components/widgets/domain/SegmentedProgressBar.ts';

describe('SegmentedProgressBar reducer', () => {
  describe('idle state', () => {
    const state: SegmentedProgressBarState = 'idle';

    it('transitions to segmentHovered on HOVER_SEGMENT', () => {
      expect(segmentedProgressBarReducer(state, { type: 'HOVER_SEGMENT' })).toBe('segmentHovered');
    });

    it('transitions to animating on ANIMATE_IN', () => {
      expect(segmentedProgressBarReducer(state, { type: 'ANIMATE_IN' })).toBe('animating');
    });

    it('ignores ANIMATION_END', () => {
      expect(segmentedProgressBarReducer(state, { type: 'ANIMATION_END' })).toBe('idle');
    });

    it('ignores LEAVE', () => {
      expect(segmentedProgressBarReducer(state, { type: 'LEAVE' })).toBe('idle');
    });
  });

  describe('animating state', () => {
    const state: SegmentedProgressBarState = 'animating';

    it('transitions to idle on ANIMATION_END', () => {
      expect(segmentedProgressBarReducer(state, { type: 'ANIMATION_END' })).toBe('idle');
    });

    it('ignores HOVER_SEGMENT', () => {
      expect(segmentedProgressBarReducer(state, { type: 'HOVER_SEGMENT' })).toBe('animating');
    });

    it('ignores ANIMATE_IN', () => {
      expect(segmentedProgressBarReducer(state, { type: 'ANIMATE_IN' })).toBe('animating');
    });

    it('ignores LEAVE', () => {
      expect(segmentedProgressBarReducer(state, { type: 'LEAVE' })).toBe('animating');
    });
  });

  describe('segmentHovered state', () => {
    const state: SegmentedProgressBarState = 'segmentHovered';

    it('transitions to idle on LEAVE', () => {
      expect(segmentedProgressBarReducer(state, { type: 'LEAVE' })).toBe('idle');
    });

    it('ignores HOVER_SEGMENT', () => {
      expect(segmentedProgressBarReducer(state, { type: 'HOVER_SEGMENT' })).toBe('segmentHovered');
    });

    it('ignores ANIMATE_IN', () => {
      expect(segmentedProgressBarReducer(state, { type: 'ANIMATE_IN' })).toBe('segmentHovered');
    });

    it('ignores ANIMATION_END', () => {
      expect(segmentedProgressBarReducer(state, { type: 'ANIMATION_END' })).toBe('segmentHovered');
    });
  });

  describe('full cycle tests', () => {
    it('idle -> animating -> idle -> segmentHovered -> idle', () => {
      let s: SegmentedProgressBarState = 'idle';
      s = segmentedProgressBarReducer(s, { type: 'ANIMATE_IN' });
      expect(s).toBe('animating');
      s = segmentedProgressBarReducer(s, { type: 'ANIMATION_END' });
      expect(s).toBe('idle');
      s = segmentedProgressBarReducer(s, { type: 'HOVER_SEGMENT' });
      expect(s).toBe('segmentHovered');
      s = segmentedProgressBarReducer(s, { type: 'LEAVE' });
      expect(s).toBe('idle');
    });

    it('idle -> segmentHovered -> idle -> animating -> idle', () => {
      let s: SegmentedProgressBarState = 'idle';
      s = segmentedProgressBarReducer(s, { type: 'HOVER_SEGMENT' });
      expect(s).toBe('segmentHovered');
      s = segmentedProgressBarReducer(s, { type: 'LEAVE' });
      expect(s).toBe('idle');
      s = segmentedProgressBarReducer(s, { type: 'ANIMATE_IN' });
      expect(s).toBe('animating');
      s = segmentedProgressBarReducer(s, { type: 'ANIMATION_END' });
      expect(s).toBe('idle');
    });
  });
});
