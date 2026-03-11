import { describe, it, expect } from 'vitest';
import {
  dependencyTreeReducer,
  type DependencyTreeState,
} from '../../../vanilla/components/widgets/concepts/package/DependencyTree.ts';

describe('DependencyTree reducer', () => {
  describe('idle state', () => {
    const state: DependencyTreeState = 'idle';

    it('transitions to nodeSelected on SELECT', () => {
      expect(dependencyTreeReducer(state, { type: 'SELECT' })).toBe('nodeSelected');
    });

    it('transitions to filtering on SEARCH', () => {
      expect(dependencyTreeReducer(state, { type: 'SEARCH' })).toBe('filtering');
    });

    it('ignores EXPAND', () => {
      expect(dependencyTreeReducer(state, { type: 'EXPAND' })).toBe('idle');
    });

    it('ignores COLLAPSE', () => {
      expect(dependencyTreeReducer(state, { type: 'COLLAPSE' })).toBe('idle');
    });

    it('ignores DESELECT', () => {
      expect(dependencyTreeReducer(state, { type: 'DESELECT' })).toBe('idle');
    });

    it('ignores CLEAR', () => {
      expect(dependencyTreeReducer(state, { type: 'CLEAR' })).toBe('idle');
    });
  });

  describe('nodeSelected state', () => {
    const state: DependencyTreeState = 'nodeSelected';

    it('transitions to idle on DESELECT', () => {
      expect(dependencyTreeReducer(state, { type: 'DESELECT' })).toBe('idle');
    });

    it('stays nodeSelected on SELECT', () => {
      expect(dependencyTreeReducer(state, { type: 'SELECT' })).toBe('nodeSelected');
    });

    it('ignores SEARCH', () => {
      expect(dependencyTreeReducer(state, { type: 'SEARCH' })).toBe('nodeSelected');
    });

    it('ignores EXPAND', () => {
      expect(dependencyTreeReducer(state, { type: 'EXPAND' })).toBe('nodeSelected');
    });
  });

  describe('filtering state', () => {
    const state: DependencyTreeState = 'filtering';

    it('transitions to idle on CLEAR', () => {
      expect(dependencyTreeReducer(state, { type: 'CLEAR' })).toBe('idle');
    });

    it('ignores SELECT', () => {
      expect(dependencyTreeReducer(state, { type: 'SELECT' })).toBe('filtering');
    });

    it('ignores SEARCH', () => {
      expect(dependencyTreeReducer(state, { type: 'SEARCH' })).toBe('filtering');
    });

    it('ignores DESELECT', () => {
      expect(dependencyTreeReducer(state, { type: 'DESELECT' })).toBe('filtering');
    });
  });

  describe('full cycle tests', () => {
    it('idle -> nodeSelected -> idle', () => {
      let s: DependencyTreeState = 'idle';
      s = dependencyTreeReducer(s, { type: 'SELECT' });
      expect(s).toBe('nodeSelected');
      s = dependencyTreeReducer(s, { type: 'DESELECT' });
      expect(s).toBe('idle');
    });

    it('idle -> filtering -> idle -> nodeSelected -> idle', () => {
      let s: DependencyTreeState = 'idle';
      s = dependencyTreeReducer(s, { type: 'SEARCH' });
      expect(s).toBe('filtering');
      s = dependencyTreeReducer(s, { type: 'CLEAR' });
      expect(s).toBe('idle');
      s = dependencyTreeReducer(s, { type: 'SELECT' });
      expect(s).toBe('nodeSelected');
      s = dependencyTreeReducer(s, { type: 'DESELECT' });
      expect(s).toBe('idle');
    });
  });
});
