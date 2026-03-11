import { describe, it, expect } from 'vitest';
import {
  circleOrgChartReducer,
  type CircleOrgChartState,
  type CircleOrgChartEvent,
} from '../../../vanilla/components/widgets/concepts/governance-structure/CircleOrgChart.ts';

describe('CircleOrgChart reducer', () => {
  it('starts in idle', () => {
    const state: CircleOrgChartState = 'idle';
    expect(state).toBe('idle');
  });

  describe('idle state', () => {
    it('transitions to circleSelected on SELECT_CIRCLE', () => {
      expect(circleOrgChartReducer('idle', { type: 'SELECT_CIRCLE', id: 'c1' })).toBe('circleSelected');
    });

    it('ignores DESELECT in idle', () => {
      expect(circleOrgChartReducer('idle', { type: 'DESELECT' })).toBe('idle');
    });

    it('ignores EXPAND in idle', () => {
      expect(circleOrgChartReducer('idle', { type: 'EXPAND', id: 'c1' })).toBe('idle');
    });

    it('ignores COLLAPSE in idle', () => {
      expect(circleOrgChartReducer('idle', { type: 'COLLAPSE', id: 'c1' })).toBe('idle');
    });
  });

  describe('circleSelected state', () => {
    it('transitions to idle on DESELECT', () => {
      expect(circleOrgChartReducer('circleSelected', { type: 'DESELECT' })).toBe('idle');
    });

    it('stays circleSelected on SELECT_CIRCLE (reselect)', () => {
      expect(circleOrgChartReducer('circleSelected', { type: 'SELECT_CIRCLE', id: 'c2' })).toBe('circleSelected');
    });

    it('ignores EXPAND in circleSelected', () => {
      expect(circleOrgChartReducer('circleSelected', { type: 'EXPAND', id: 'c1' })).toBe('circleSelected');
    });

    it('ignores COLLAPSE in circleSelected', () => {
      expect(circleOrgChartReducer('circleSelected', { type: 'COLLAPSE', id: 'c1' })).toBe('circleSelected');
    });
  });
});
