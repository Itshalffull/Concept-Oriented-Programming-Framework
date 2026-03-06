import { describe, it, expect } from 'vitest';
import {
  coverageSourceViewReducer,
  type CoverageSourceViewState,
  type CoverageSourceViewEvent,
} from '../../../vanilla/components/widgets/concepts/formal-verification/CoverageSourceView.ts';

describe('CoverageSourceView reducer', () => {
  it('starts in idle', () => {
    const state: CoverageSourceViewState = 'idle';
    expect(state).toBe('idle');
  });

  describe('idle state', () => {
    it('transitions to lineHovered on HOVER_LINE', () => {
      expect(coverageSourceViewReducer('idle', { type: 'HOVER_LINE', lineIndex: 0 })).toBe('lineHovered');
    });

    it('stays idle on FILTER', () => {
      expect(coverageSourceViewReducer('idle', { type: 'FILTER', status: 'all' })).toBe('idle');
    });

    it('stays idle on JUMP_UNCOVERED', () => {
      expect(coverageSourceViewReducer('idle', { type: 'JUMP_UNCOVERED' })).toBe('idle');
    });

    it('ignores LEAVE in idle', () => {
      expect(coverageSourceViewReducer('idle', { type: 'LEAVE' })).toBe('idle');
    });

    it('ignores SELECT_LINE in idle', () => {
      expect(coverageSourceViewReducer('idle', { type: 'SELECT_LINE', lineIndex: 5 })).toBe('idle');
    });
  });

  describe('lineHovered state', () => {
    it('transitions to idle on LEAVE', () => {
      expect(coverageSourceViewReducer('lineHovered', { type: 'LEAVE' })).toBe('idle');
    });

    it('ignores HOVER_LINE in lineHovered', () => {
      expect(coverageSourceViewReducer('lineHovered', { type: 'HOVER_LINE', lineIndex: 3 })).toBe('lineHovered');
    });

    it('ignores FILTER in lineHovered', () => {
      expect(coverageSourceViewReducer('lineHovered', { type: 'FILTER', status: 'covered' })).toBe('lineHovered');
    });

    it('ignores JUMP_UNCOVERED in lineHovered', () => {
      expect(coverageSourceViewReducer('lineHovered', { type: 'JUMP_UNCOVERED' })).toBe('lineHovered');
    });
  });
});
