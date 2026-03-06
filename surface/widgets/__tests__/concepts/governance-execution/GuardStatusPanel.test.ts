import { describe, it, expect } from 'vitest';
import {
  guardStatusPanelReducer,
  type GuardStatusPanelState,
  type GuardStatusPanelEvent,
} from '../../../vanilla/components/widgets/concepts/governance-execution/GuardStatusPanel.ts';

describe('GuardStatusPanel reducer', () => {
  it('starts in idle', () => {
    const state: GuardStatusPanelState = 'idle';
    expect(state).toBe('idle');
  });

  describe('idle state', () => {
    it('transitions to guardSelected on SELECT_GUARD', () => {
      expect(guardStatusPanelReducer('idle', { type: 'SELECT_GUARD' })).toBe('guardSelected');
    });

    it('stays idle on GUARD_TRIP', () => {
      expect(guardStatusPanelReducer('idle', { type: 'GUARD_TRIP' })).toBe('idle');
    });

    it('ignores DESELECT in idle', () => {
      expect(guardStatusPanelReducer('idle', { type: 'DESELECT' })).toBe('idle');
    });
  });

  describe('guardSelected state', () => {
    it('transitions to idle on DESELECT', () => {
      expect(guardStatusPanelReducer('guardSelected', { type: 'DESELECT' })).toBe('idle');
    });

    it('ignores SELECT_GUARD in guardSelected', () => {
      expect(guardStatusPanelReducer('guardSelected', { type: 'SELECT_GUARD' })).toBe('guardSelected');
    });

    it('ignores GUARD_TRIP in guardSelected', () => {
      expect(guardStatusPanelReducer('guardSelected', { type: 'GUARD_TRIP' })).toBe('guardSelected');
    });
  });
});
