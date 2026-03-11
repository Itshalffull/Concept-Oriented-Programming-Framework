import { describe, it, expect } from 'vitest';
import {
  weightBreakdownReducer,
  type WeightBreakdownState,
  type WeightBreakdownEvent,
} from '../../../vanilla/components/widgets/concepts/governance-structure/WeightBreakdown.ts';

describe('WeightBreakdown reducer', () => {
  it('starts in idle', () => {
    const state: WeightBreakdownState = 'idle';
    expect(state).toBe('idle');
  });

  describe('idle state', () => {
    it('transitions to segmentHovered on HOVER_SEGMENT', () => {
      expect(weightBreakdownReducer('idle', { type: 'HOVER_SEGMENT', source: 'token' })).toBe('segmentHovered');
    });

    it('ignores LEAVE in idle', () => {
      expect(weightBreakdownReducer('idle', { type: 'LEAVE' })).toBe('idle');
    });
  });

  describe('segmentHovered state', () => {
    it('transitions to idle on LEAVE', () => {
      expect(weightBreakdownReducer('segmentHovered', { type: 'LEAVE' })).toBe('idle');
    });

    it('ignores HOVER_SEGMENT in segmentHovered', () => {
      expect(weightBreakdownReducer('segmentHovered', { type: 'HOVER_SEGMENT', source: 'delegation' })).toBe('segmentHovered');
    });
  });
});
