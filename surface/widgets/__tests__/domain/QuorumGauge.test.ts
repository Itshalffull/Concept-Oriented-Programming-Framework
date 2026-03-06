import { describe, it, expect } from 'vitest';
import {
  quorumGaugeReducer,
  type QuorumGaugeState,
} from '../../vanilla/components/widgets/domain/QuorumGauge.ts';

describe('QuorumGauge reducer', () => {
  describe('belowThreshold state', () => {
    const state: QuorumGaugeState = 'belowThreshold';

    it('transitions to atThreshold on THRESHOLD_MET', () => {
      expect(quorumGaugeReducer(state, { type: 'THRESHOLD_MET' })).toBe('atThreshold');
    });

    it('stays belowThreshold on UPDATE', () => {
      expect(quorumGaugeReducer(state, { type: 'UPDATE' })).toBe('belowThreshold');
    });

    it('ignores EXCEED', () => {
      expect(quorumGaugeReducer(state, { type: 'EXCEED' })).toBe('belowThreshold');
    });

    it('ignores DROP_BELOW', () => {
      expect(quorumGaugeReducer(state, { type: 'DROP_BELOW' })).toBe('belowThreshold');
    });
  });

  describe('atThreshold state', () => {
    const state: QuorumGaugeState = 'atThreshold';

    it('transitions to aboveThreshold on EXCEED', () => {
      expect(quorumGaugeReducer(state, { type: 'EXCEED' })).toBe('aboveThreshold');
    });

    it('transitions to belowThreshold on DROP_BELOW', () => {
      expect(quorumGaugeReducer(state, { type: 'DROP_BELOW' })).toBe('belowThreshold');
    });

    it('ignores THRESHOLD_MET', () => {
      expect(quorumGaugeReducer(state, { type: 'THRESHOLD_MET' })).toBe('atThreshold');
    });

    it('ignores UPDATE', () => {
      expect(quorumGaugeReducer(state, { type: 'UPDATE' })).toBe('atThreshold');
    });
  });

  describe('aboveThreshold state', () => {
    const state: QuorumGaugeState = 'aboveThreshold';

    it('transitions to belowThreshold on DROP_BELOW', () => {
      expect(quorumGaugeReducer(state, { type: 'DROP_BELOW' })).toBe('belowThreshold');
    });

    it('stays aboveThreshold on UPDATE', () => {
      expect(quorumGaugeReducer(state, { type: 'UPDATE' })).toBe('aboveThreshold');
    });

    it('ignores THRESHOLD_MET', () => {
      expect(quorumGaugeReducer(state, { type: 'THRESHOLD_MET' })).toBe('aboveThreshold');
    });

    it('ignores EXCEED', () => {
      expect(quorumGaugeReducer(state, { type: 'EXCEED' })).toBe('aboveThreshold');
    });
  });

  describe('full cycle tests', () => {
    it('belowThreshold -> atThreshold -> aboveThreshold -> belowThreshold', () => {
      let s: QuorumGaugeState = 'belowThreshold';
      s = quorumGaugeReducer(s, { type: 'THRESHOLD_MET' });
      expect(s).toBe('atThreshold');
      s = quorumGaugeReducer(s, { type: 'EXCEED' });
      expect(s).toBe('aboveThreshold');
      s = quorumGaugeReducer(s, { type: 'DROP_BELOW' });
      expect(s).toBe('belowThreshold');
    });

    it('belowThreshold -> atThreshold -> belowThreshold -> atThreshold -> aboveThreshold', () => {
      let s: QuorumGaugeState = 'belowThreshold';
      s = quorumGaugeReducer(s, { type: 'THRESHOLD_MET' });
      expect(s).toBe('atThreshold');
      s = quorumGaugeReducer(s, { type: 'DROP_BELOW' });
      expect(s).toBe('belowThreshold');
      s = quorumGaugeReducer(s, { type: 'THRESHOLD_MET' });
      expect(s).toBe('atThreshold');
      s = quorumGaugeReducer(s, { type: 'EXCEED' });
      expect(s).toBe('aboveThreshold');
    });
  });
});
