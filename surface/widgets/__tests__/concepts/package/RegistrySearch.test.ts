import { describe, it, expect } from 'vitest';
import {
  registrySearchReducer,
  type RegistrySearchState,
} from '../../../vanilla/components/widgets/concepts/package/RegistrySearch.ts';

describe('RegistrySearch reducer', () => {
  describe('idle state', () => {
    const state: RegistrySearchState = 'idle';

    it('transitions to searching on INPUT', () => {
      expect(registrySearchReducer(state, { type: 'INPUT' })).toBe('searching');
    });

    it('ignores SELECT_RESULT', () => {
      expect(registrySearchReducer(state, { type: 'SELECT_RESULT' })).toBe('idle');
    });

    it('ignores RESULTS', () => {
      expect(registrySearchReducer(state, { type: 'RESULTS' })).toBe('idle');
    });

    it('ignores CLEAR', () => {
      expect(registrySearchReducer(state, { type: 'CLEAR' })).toBe('idle');
    });
  });

  describe('searching state', () => {
    const state: RegistrySearchState = 'searching';

    it('transitions to idle on RESULTS', () => {
      expect(registrySearchReducer(state, { type: 'RESULTS' })).toBe('idle');
    });

    it('transitions to idle on CLEAR', () => {
      expect(registrySearchReducer(state, { type: 'CLEAR' })).toBe('idle');
    });

    it('ignores INPUT', () => {
      expect(registrySearchReducer(state, { type: 'INPUT' })).toBe('searching');
    });

    it('ignores SELECT_RESULT', () => {
      expect(registrySearchReducer(state, { type: 'SELECT_RESULT' })).toBe('searching');
    });
  });

  describe('full cycle tests', () => {
    it('idle -> searching -> idle via RESULTS', () => {
      let s: RegistrySearchState = 'idle';
      s = registrySearchReducer(s, { type: 'INPUT' });
      expect(s).toBe('searching');
      s = registrySearchReducer(s, { type: 'RESULTS' });
      expect(s).toBe('idle');
    });

    it('idle -> searching -> idle via CLEAR -> searching again', () => {
      let s: RegistrySearchState = 'idle';
      s = registrySearchReducer(s, { type: 'INPUT' });
      s = registrySearchReducer(s, { type: 'CLEAR' });
      expect(s).toBe('idle');
      s = registrySearchReducer(s, { type: 'INPUT' });
      expect(s).toBe('searching');
    });
  });
});
