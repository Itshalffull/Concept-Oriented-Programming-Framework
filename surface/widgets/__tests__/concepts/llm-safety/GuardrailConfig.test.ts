import { describe, it, expect } from 'vitest';
import {
  guardrailConfigReducer,
  type GuardrailConfigState,
} from '../../../vanilla/components/widgets/concepts/llm-safety/GuardrailConfig.ts';

describe('GuardrailConfig reducer', () => {
  describe('viewing state', () => {
    const state: GuardrailConfigState = 'viewing';

    it('transitions to ruleSelected on SELECT_RULE', () => {
      expect(guardrailConfigReducer(state, { type: 'SELECT_RULE' })).toBe('ruleSelected');
    });

    it('transitions to testing on TEST', () => {
      expect(guardrailConfigReducer(state, { type: 'TEST' })).toBe('testing');
    });

    it('transitions to adding on ADD_RULE', () => {
      expect(guardrailConfigReducer(state, { type: 'ADD_RULE' })).toBe('adding');
    });

    it('ignores DESELECT', () => {
      expect(guardrailConfigReducer(state, { type: 'DESELECT' })).toBe('viewing');
    });

    it('ignores TEST_COMPLETE', () => {
      expect(guardrailConfigReducer(state, { type: 'TEST_COMPLETE' })).toBe('viewing');
    });

    it('ignores SAVE', () => {
      expect(guardrailConfigReducer(state, { type: 'SAVE' })).toBe('viewing');
    });
  });

  describe('ruleSelected state', () => {
    const state: GuardrailConfigState = 'ruleSelected';

    it('transitions to viewing on DESELECT', () => {
      expect(guardrailConfigReducer(state, { type: 'DESELECT' })).toBe('viewing');
    });

    it('ignores SELECT_RULE', () => {
      expect(guardrailConfigReducer(state, { type: 'SELECT_RULE' })).toBe('ruleSelected');
    });

    it('ignores TEST', () => {
      expect(guardrailConfigReducer(state, { type: 'TEST' })).toBe('ruleSelected');
    });

    it('ignores ADD_RULE', () => {
      expect(guardrailConfigReducer(state, { type: 'ADD_RULE' })).toBe('ruleSelected');
    });
  });

  describe('testing state', () => {
    const state: GuardrailConfigState = 'testing';

    it('transitions to viewing on TEST_COMPLETE', () => {
      expect(guardrailConfigReducer(state, { type: 'TEST_COMPLETE' })).toBe('viewing');
    });

    it('ignores SELECT_RULE', () => {
      expect(guardrailConfigReducer(state, { type: 'SELECT_RULE' })).toBe('testing');
    });

    it('ignores ADD_RULE', () => {
      expect(guardrailConfigReducer(state, { type: 'ADD_RULE' })).toBe('testing');
    });
  });

  describe('adding state', () => {
    const state: GuardrailConfigState = 'adding';

    it('transitions to viewing on SAVE', () => {
      expect(guardrailConfigReducer(state, { type: 'SAVE' })).toBe('viewing');
    });

    it('transitions to viewing on CANCEL', () => {
      expect(guardrailConfigReducer(state, { type: 'CANCEL' })).toBe('viewing');
    });

    it('ignores SELECT_RULE', () => {
      expect(guardrailConfigReducer(state, { type: 'SELECT_RULE' })).toBe('adding');
    });

    it('ignores TEST', () => {
      expect(guardrailConfigReducer(state, { type: 'TEST' })).toBe('adding');
    });
  });

  describe('full cycle tests', () => {
    it('viewing -> ruleSelected -> viewing', () => {
      let s: GuardrailConfigState = 'viewing';
      s = guardrailConfigReducer(s, { type: 'SELECT_RULE' });
      expect(s).toBe('ruleSelected');
      s = guardrailConfigReducer(s, { type: 'DESELECT' });
      expect(s).toBe('viewing');
    });

    it('viewing -> testing -> viewing -> adding -> viewing (save)', () => {
      let s: GuardrailConfigState = 'viewing';
      s = guardrailConfigReducer(s, { type: 'TEST' });
      expect(s).toBe('testing');
      s = guardrailConfigReducer(s, { type: 'TEST_COMPLETE' });
      expect(s).toBe('viewing');
      s = guardrailConfigReducer(s, { type: 'ADD_RULE' });
      expect(s).toBe('adding');
      s = guardrailConfigReducer(s, { type: 'SAVE' });
      expect(s).toBe('viewing');
    });

    it('viewing -> adding -> viewing (cancel)', () => {
      let s: GuardrailConfigState = 'viewing';
      s = guardrailConfigReducer(s, { type: 'ADD_RULE' });
      expect(s).toBe('adding');
      s = guardrailConfigReducer(s, { type: 'CANCEL' });
      expect(s).toBe('viewing');
    });
  });
});
