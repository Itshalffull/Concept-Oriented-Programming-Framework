import { describe, it, expect } from 'vitest';
import {
  runListTableReducer,
  type RunListTableState,
} from '../../../vanilla/components/widgets/concepts/process-foundation/RunListTable.ts';

describe('RunListTable reducer', () => {
  describe('idle state', () => {
    const state: RunListTableState = 'idle';

    it('transitions to rowSelected on SELECT_ROW', () => {
      expect(runListTableReducer(state, { type: 'SELECT_ROW' })).toBe('rowSelected');
    });

    it('stays idle on SORT', () => {
      expect(runListTableReducer(state, { type: 'SORT' })).toBe('idle');
    });

    it('stays idle on FILTER', () => {
      expect(runListTableReducer(state, { type: 'FILTER' })).toBe('idle');
    });

    it('stays idle on PAGE', () => {
      expect(runListTableReducer(state, { type: 'PAGE' })).toBe('idle');
    });

    it('ignores DESELECT', () => {
      expect(runListTableReducer(state, { type: 'DESELECT' })).toBe('idle');
    });
  });

  describe('rowSelected state', () => {
    const state: RunListTableState = 'rowSelected';

    it('transitions to idle on DESELECT', () => {
      expect(runListTableReducer(state, { type: 'DESELECT' })).toBe('idle');
    });

    it('stays rowSelected on SELECT_ROW', () => {
      expect(runListTableReducer(state, { type: 'SELECT_ROW' })).toBe('rowSelected');
    });

    it('ignores SORT', () => {
      expect(runListTableReducer(state, { type: 'SORT' })).toBe('rowSelected');
    });

    it('ignores FILTER', () => {
      expect(runListTableReducer(state, { type: 'FILTER' })).toBe('rowSelected');
    });

    it('ignores PAGE', () => {
      expect(runListTableReducer(state, { type: 'PAGE' })).toBe('rowSelected');
    });
  });

  describe('full cycle tests', () => {
    it('idle -> rowSelected -> idle', () => {
      let s: RunListTableState = 'idle';
      s = runListTableReducer(s, { type: 'SELECT_ROW' });
      expect(s).toBe('rowSelected');
      s = runListTableReducer(s, { type: 'DESELECT' });
      expect(s).toBe('idle');
    });

    it('idle -> sort/filter/page -> select -> reselect -> deselect', () => {
      let s: RunListTableState = 'idle';
      s = runListTableReducer(s, { type: 'SORT' });
      expect(s).toBe('idle');
      s = runListTableReducer(s, { type: 'FILTER' });
      expect(s).toBe('idle');
      s = runListTableReducer(s, { type: 'PAGE' });
      expect(s).toBe('idle');
      s = runListTableReducer(s, { type: 'SELECT_ROW' });
      expect(s).toBe('rowSelected');
      s = runListTableReducer(s, { type: 'SELECT_ROW' });
      expect(s).toBe('rowSelected');
      s = runListTableReducer(s, { type: 'DESELECT' });
      expect(s).toBe('idle');
    });
  });
});
