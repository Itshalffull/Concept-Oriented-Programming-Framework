import { describe, it, expect } from 'vitest';
import {
  statusGridReducer,
  type StatusGridState,
  type StatusGridEvent,
} from '../../../vanilla/components/widgets/concepts/formal-verification/StatusGrid.ts';

describe('StatusGrid reducer', () => {
  it('starts in idle', () => {
    const state: StatusGridState = 'idle';
    expect(state).toBe('idle');
  });

  describe('idle state', () => {
    it('transitions to cellHovered on HOVER_CELL', () => {
      expect(statusGridReducer('idle', { type: 'HOVER_CELL', row: 0, col: 0 })).toBe('cellHovered');
    });

    it('transitions to cellSelected on CLICK_CELL', () => {
      expect(statusGridReducer('idle', { type: 'CLICK_CELL', row: 0, col: 0 })).toBe('cellSelected');
    });

    it('stays idle on SORT', () => {
      expect(statusGridReducer('idle', { type: 'SORT' })).toBe('idle');
    });

    it('stays idle on FILTER', () => {
      expect(statusGridReducer('idle', { type: 'FILTER' })).toBe('idle');
    });

    it('ignores LEAVE_CELL in idle', () => {
      expect(statusGridReducer('idle', { type: 'LEAVE_CELL' })).toBe('idle');
    });

    it('ignores DESELECT in idle', () => {
      expect(statusGridReducer('idle', { type: 'DESELECT' })).toBe('idle');
    });
  });

  describe('cellHovered state', () => {
    it('transitions to idle on LEAVE_CELL', () => {
      expect(statusGridReducer('cellHovered', { type: 'LEAVE_CELL' })).toBe('idle');
    });

    it('transitions to cellSelected on CLICK_CELL', () => {
      expect(statusGridReducer('cellHovered', { type: 'CLICK_CELL', row: 1, col: 2 })).toBe('cellSelected');
    });

    it('ignores HOVER_CELL in cellHovered', () => {
      expect(statusGridReducer('cellHovered', { type: 'HOVER_CELL', row: 2, col: 1 })).toBe('cellHovered');
    });

    it('ignores SORT in cellHovered', () => {
      expect(statusGridReducer('cellHovered', { type: 'SORT' })).toBe('cellHovered');
    });

    it('ignores DESELECT in cellHovered', () => {
      expect(statusGridReducer('cellHovered', { type: 'DESELECT' })).toBe('cellHovered');
    });
  });

  describe('cellSelected state', () => {
    it('transitions to idle on DESELECT', () => {
      expect(statusGridReducer('cellSelected', { type: 'DESELECT' })).toBe('idle');
    });

    it('stays cellSelected on CLICK_CELL (reselect)', () => {
      expect(statusGridReducer('cellSelected', { type: 'CLICK_CELL', row: 0, col: 1 })).toBe('cellSelected');
    });

    it('ignores HOVER_CELL in cellSelected', () => {
      expect(statusGridReducer('cellSelected', { type: 'HOVER_CELL', row: 0, col: 0 })).toBe('cellSelected');
    });

    it('ignores LEAVE_CELL in cellSelected', () => {
      expect(statusGridReducer('cellSelected', { type: 'LEAVE_CELL' })).toBe('cellSelected');
    });

    it('ignores SORT in cellSelected', () => {
      expect(statusGridReducer('cellSelected', { type: 'SORT' })).toBe('cellSelected');
    });
  });
});
