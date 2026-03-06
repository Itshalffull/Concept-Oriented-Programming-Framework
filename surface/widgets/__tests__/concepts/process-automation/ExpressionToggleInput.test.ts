import { describe, it, expect } from 'vitest';
import {
  expressionToggleInputReducer,
  type ExpressionToggleInputState,
} from '../../../vanilla/components/widgets/concepts/process-automation/ExpressionToggleInput.ts';

describe('ExpressionToggleInput reducer', () => {
  describe('fixed state', () => {
    const state: ExpressionToggleInputState = 'fixed';

    it('transitions to expression on TOGGLE', () => {
      expect(expressionToggleInputReducer(state, { type: 'TOGGLE' })).toBe('expression');
    });

    it('stays fixed on INPUT', () => {
      expect(expressionToggleInputReducer(state, { type: 'INPUT' })).toBe('fixed');
    });

    it('ignores SHOW_AC', () => {
      expect(expressionToggleInputReducer(state, { type: 'SHOW_AC' })).toBe('fixed');
    });

    it('ignores SELECT', () => {
      expect(expressionToggleInputReducer(state, { type: 'SELECT' })).toBe('fixed');
    });

    it('ignores DISMISS', () => {
      expect(expressionToggleInputReducer(state, { type: 'DISMISS' })).toBe('fixed');
    });
  });

  describe('expression state', () => {
    const state: ExpressionToggleInputState = 'expression';

    it('transitions to fixed on TOGGLE', () => {
      expect(expressionToggleInputReducer(state, { type: 'TOGGLE' })).toBe('fixed');
    });

    it('stays expression on INPUT', () => {
      expect(expressionToggleInputReducer(state, { type: 'INPUT' })).toBe('expression');
    });

    it('transitions to autocompleting on SHOW_AC', () => {
      expect(expressionToggleInputReducer(state, { type: 'SHOW_AC' })).toBe('autocompleting');
    });

    it('ignores SELECT', () => {
      expect(expressionToggleInputReducer(state, { type: 'SELECT' })).toBe('expression');
    });

    it('ignores DISMISS', () => {
      expect(expressionToggleInputReducer(state, { type: 'DISMISS' })).toBe('expression');
    });
  });

  describe('autocompleting state', () => {
    const state: ExpressionToggleInputState = 'autocompleting';

    it('transitions to expression on SELECT', () => {
      expect(expressionToggleInputReducer(state, { type: 'SELECT' })).toBe('expression');
    });

    it('transitions to expression on DISMISS', () => {
      expect(expressionToggleInputReducer(state, { type: 'DISMISS' })).toBe('expression');
    });

    it('ignores TOGGLE', () => {
      expect(expressionToggleInputReducer(state, { type: 'TOGGLE' })).toBe('autocompleting');
    });

    it('ignores INPUT', () => {
      expect(expressionToggleInputReducer(state, { type: 'INPUT' })).toBe('autocompleting');
    });

    it('ignores SHOW_AC', () => {
      expect(expressionToggleInputReducer(state, { type: 'SHOW_AC' })).toBe('autocompleting');
    });
  });

  describe('full cycle tests', () => {
    it('fixed -> expression -> fixed', () => {
      let s: ExpressionToggleInputState = 'fixed';
      s = expressionToggleInputReducer(s, { type: 'TOGGLE' });
      expect(s).toBe('expression');
      s = expressionToggleInputReducer(s, { type: 'TOGGLE' });
      expect(s).toBe('fixed');
    });

    it('fixed -> expression -> autocompleting -> expression -> fixed', () => {
      let s: ExpressionToggleInputState = 'fixed';
      s = expressionToggleInputReducer(s, { type: 'TOGGLE' });
      s = expressionToggleInputReducer(s, { type: 'SHOW_AC' });
      expect(s).toBe('autocompleting');
      s = expressionToggleInputReducer(s, { type: 'SELECT' });
      expect(s).toBe('expression');
      s = expressionToggleInputReducer(s, { type: 'TOGGLE' });
      expect(s).toBe('fixed');
    });

    it('expression -> autocompleting -> expression via DISMISS', () => {
      let s: ExpressionToggleInputState = 'expression';
      s = expressionToggleInputReducer(s, { type: 'SHOW_AC' });
      expect(s).toBe('autocompleting');
      s = expressionToggleInputReducer(s, { type: 'DISMISS' });
      expect(s).toBe('expression');
    });
  });
});
