import { describe, it, expect } from 'vitest';
import {
  evalResultsTableReducer,
  type EvalResultsTableState,
} from '../../../vanilla/components/widgets/concepts/process-llm/EvalResultsTable.ts';

describe('EvalResultsTable reducer', () => {
  describe('idle state', () => {
    const state: EvalResultsTableState = 'idle';

    it('transitions to rowSelected on SELECT_ROW', () => {
      expect(evalResultsTableReducer(state, { type: 'SELECT_ROW' })).toBe('rowSelected');
    });

    it('stays idle on SORT', () => {
      expect(evalResultsTableReducer(state, { type: 'SORT' })).toBe('idle');
    });

    it('stays idle on FILTER', () => {
      expect(evalResultsTableReducer(state, { type: 'FILTER' })).toBe('idle');
    });

    it('ignores DESELECT', () => {
      expect(evalResultsTableReducer(state, { type: 'DESELECT' })).toBe('idle');
    });
  });

  describe('rowSelected state', () => {
    const state: EvalResultsTableState = 'rowSelected';

    it('transitions to idle on DESELECT', () => {
      expect(evalResultsTableReducer(state, { type: 'DESELECT' })).toBe('idle');
    });

    it('stays rowSelected on SELECT_ROW', () => {
      expect(evalResultsTableReducer(state, { type: 'SELECT_ROW' })).toBe('rowSelected');
    });

    it('ignores SORT', () => {
      expect(evalResultsTableReducer(state, { type: 'SORT' })).toBe('rowSelected');
    });

    it('ignores FILTER', () => {
      expect(evalResultsTableReducer(state, { type: 'FILTER' })).toBe('rowSelected');
    });
  });

  describe('full cycle tests', () => {
    it('idle -> rowSelected -> idle', () => {
      let s: EvalResultsTableState = 'idle';
      s = evalResultsTableReducer(s, { type: 'SELECT_ROW' });
      expect(s).toBe('rowSelected');
      s = evalResultsTableReducer(s, { type: 'DESELECT' });
      expect(s).toBe('idle');
    });

    it('idle -> sort/filter -> select -> reselect -> deselect', () => {
      let s: EvalResultsTableState = 'idle';
      s = evalResultsTableReducer(s, { type: 'SORT' });
      expect(s).toBe('idle');
      s = evalResultsTableReducer(s, { type: 'FILTER' });
      expect(s).toBe('idle');
      s = evalResultsTableReducer(s, { type: 'SELECT_ROW' });
      expect(s).toBe('rowSelected');
      s = evalResultsTableReducer(s, { type: 'SELECT_ROW' });
      expect(s).toBe('rowSelected');
      s = evalResultsTableReducer(s, { type: 'DESELECT' });
      expect(s).toBe('idle');
    });
  });
});
