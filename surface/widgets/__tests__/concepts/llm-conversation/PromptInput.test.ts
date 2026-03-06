import { describe, it, expect } from 'vitest';
import {
  promptInputReducer,
  type PromptInputState,
} from '../../../vanilla/components/widgets/concepts/llm-conversation/PromptInput.ts';

describe('PromptInput reducer', () => {
  describe('empty state', () => {
    const state: PromptInputState = 'empty';

    it('transitions to composing on INPUT', () => {
      expect(promptInputReducer(state, { type: 'INPUT' })).toBe('composing');
    });

    it('transitions to composing on PASTE', () => {
      expect(promptInputReducer(state, { type: 'PASTE' })).toBe('composing');
    });

    it('transitions to composing on ATTACH', () => {
      expect(promptInputReducer(state, { type: 'ATTACH' })).toBe('composing');
    });

    it('ignores CLEAR', () => {
      expect(promptInputReducer(state, { type: 'CLEAR' })).toBe('empty');
    });

    it('ignores SUBMIT', () => {
      expect(promptInputReducer(state, { type: 'SUBMIT' })).toBe('empty');
    });

    it('ignores SUBMIT_COMPLETE', () => {
      expect(promptInputReducer(state, { type: 'SUBMIT_COMPLETE' })).toBe('empty');
    });
  });

  describe('composing state', () => {
    const state: PromptInputState = 'composing';

    it('transitions to empty on CLEAR', () => {
      expect(promptInputReducer(state, { type: 'CLEAR' })).toBe('empty');
    });

    it('transitions to submitting on SUBMIT', () => {
      expect(promptInputReducer(state, { type: 'SUBMIT' })).toBe('submitting');
    });

    it('ignores INPUT', () => {
      expect(promptInputReducer(state, { type: 'INPUT' })).toBe('composing');
    });

    it('ignores PASTE', () => {
      expect(promptInputReducer(state, { type: 'PASTE' })).toBe('composing');
    });

    it('ignores SUBMIT_COMPLETE', () => {
      expect(promptInputReducer(state, { type: 'SUBMIT_COMPLETE' })).toBe('composing');
    });
  });

  describe('submitting state', () => {
    const state: PromptInputState = 'submitting';

    it('transitions to empty on SUBMIT_COMPLETE', () => {
      expect(promptInputReducer(state, { type: 'SUBMIT_COMPLETE' })).toBe('empty');
    });

    it('transitions to composing on SUBMIT_ERROR', () => {
      expect(promptInputReducer(state, { type: 'SUBMIT_ERROR' })).toBe('composing');
    });

    it('ignores INPUT', () => {
      expect(promptInputReducer(state, { type: 'INPUT' })).toBe('submitting');
    });

    it('ignores CLEAR', () => {
      expect(promptInputReducer(state, { type: 'CLEAR' })).toBe('submitting');
    });

    it('ignores SUBMIT', () => {
      expect(promptInputReducer(state, { type: 'SUBMIT' })).toBe('submitting');
    });
  });

  describe('full cycle tests', () => {
    it('empty -> composing -> submitting -> empty', () => {
      let s: PromptInputState = 'empty';
      s = promptInputReducer(s, { type: 'INPUT' });
      expect(s).toBe('composing');
      s = promptInputReducer(s, { type: 'SUBMIT' });
      expect(s).toBe('submitting');
      s = promptInputReducer(s, { type: 'SUBMIT_COMPLETE' });
      expect(s).toBe('empty');
    });

    it('empty -> composing -> submitting -> composing (error) -> empty', () => {
      let s: PromptInputState = 'empty';
      s = promptInputReducer(s, { type: 'PASTE' });
      expect(s).toBe('composing');
      s = promptInputReducer(s, { type: 'SUBMIT' });
      expect(s).toBe('submitting');
      s = promptInputReducer(s, { type: 'SUBMIT_ERROR' });
      expect(s).toBe('composing');
      s = promptInputReducer(s, { type: 'CLEAR' });
      expect(s).toBe('empty');
    });

    it('empty -> composing -> empty -> composing via ATTACH', () => {
      let s: PromptInputState = 'empty';
      s = promptInputReducer(s, { type: 'INPUT' });
      s = promptInputReducer(s, { type: 'CLEAR' });
      expect(s).toBe('empty');
      s = promptInputReducer(s, { type: 'ATTACH' });
      expect(s).toBe('composing');
    });
  });
});
