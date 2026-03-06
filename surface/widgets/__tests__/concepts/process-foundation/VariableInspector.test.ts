import { describe, it, expect } from 'vitest';
import {
  variableInspectorReducer,
  type VariableInspectorState,
} from '../../../vanilla/components/widgets/concepts/process-foundation/VariableInspector.ts';

describe('VariableInspector reducer', () => {
  describe('idle state', () => {
    const state: VariableInspectorState = 'idle';

    it('transitions to filtering on SEARCH', () => {
      expect(variableInspectorReducer(state, { type: 'SEARCH' })).toBe('filtering');
    });

    it('transitions to varSelected on SELECT_VAR', () => {
      expect(variableInspectorReducer(state, { type: 'SELECT_VAR' })).toBe('varSelected');
    });

    it('stays idle on ADD_WATCH', () => {
      expect(variableInspectorReducer(state, { type: 'ADD_WATCH' })).toBe('idle');
    });

    it('ignores CLEAR', () => {
      expect(variableInspectorReducer(state, { type: 'CLEAR' })).toBe('idle');
    });

    it('ignores DESELECT', () => {
      expect(variableInspectorReducer(state, { type: 'DESELECT' })).toBe('idle');
    });
  });

  describe('filtering state', () => {
    const state: VariableInspectorState = 'filtering';

    it('transitions to idle on CLEAR', () => {
      expect(variableInspectorReducer(state, { type: 'CLEAR' })).toBe('idle');
    });

    it('transitions to varSelected on SELECT_VAR', () => {
      expect(variableInspectorReducer(state, { type: 'SELECT_VAR' })).toBe('varSelected');
    });

    it('ignores SEARCH', () => {
      expect(variableInspectorReducer(state, { type: 'SEARCH' })).toBe('filtering');
    });

    it('ignores DESELECT', () => {
      expect(variableInspectorReducer(state, { type: 'DESELECT' })).toBe('filtering');
    });

    it('ignores ADD_WATCH', () => {
      expect(variableInspectorReducer(state, { type: 'ADD_WATCH' })).toBe('filtering');
    });
  });

  describe('varSelected state', () => {
    const state: VariableInspectorState = 'varSelected';

    it('transitions to idle on DESELECT', () => {
      expect(variableInspectorReducer(state, { type: 'DESELECT' })).toBe('idle');
    });

    it('stays varSelected on SELECT_VAR', () => {
      expect(variableInspectorReducer(state, { type: 'SELECT_VAR' })).toBe('varSelected');
    });

    it('ignores SEARCH', () => {
      expect(variableInspectorReducer(state, { type: 'SEARCH' })).toBe('varSelected');
    });

    it('ignores CLEAR', () => {
      expect(variableInspectorReducer(state, { type: 'CLEAR' })).toBe('varSelected');
    });

    it('ignores ADD_WATCH', () => {
      expect(variableInspectorReducer(state, { type: 'ADD_WATCH' })).toBe('varSelected');
    });
  });

  describe('full cycle tests', () => {
    it('idle -> filtering -> idle', () => {
      let s: VariableInspectorState = 'idle';
      s = variableInspectorReducer(s, { type: 'SEARCH' });
      expect(s).toBe('filtering');
      s = variableInspectorReducer(s, { type: 'CLEAR' });
      expect(s).toBe('idle');
    });

    it('idle -> varSelected -> idle -> filtering -> varSelected -> idle', () => {
      let s: VariableInspectorState = 'idle';
      s = variableInspectorReducer(s, { type: 'SELECT_VAR' });
      expect(s).toBe('varSelected');
      s = variableInspectorReducer(s, { type: 'DESELECT' });
      expect(s).toBe('idle');
      s = variableInspectorReducer(s, { type: 'SEARCH' });
      expect(s).toBe('filtering');
      s = variableInspectorReducer(s, { type: 'SELECT_VAR' });
      expect(s).toBe('varSelected');
      s = variableInspectorReducer(s, { type: 'DESELECT' });
      expect(s).toBe('idle');
    });
  });
});
