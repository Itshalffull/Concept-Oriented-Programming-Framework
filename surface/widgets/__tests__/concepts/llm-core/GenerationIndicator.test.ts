import { describe, it, expect } from 'vitest';
import {
  generationIndicatorReducer,
  type GenerationIndicatorState,
} from '../../../vanilla/components/widgets/concepts/llm-core/GenerationIndicator.ts';

describe('GenerationIndicator reducer', () => {
  describe('idle state', () => {
    const state: GenerationIndicatorState = 'idle';

    it('transitions to generating on START', () => {
      expect(generationIndicatorReducer(state, { type: 'START' })).toBe('generating');
    });

    it('ignores TOKEN', () => {
      expect(generationIndicatorReducer(state, { type: 'TOKEN' })).toBe('idle');
    });

    it('ignores COMPLETE', () => {
      expect(generationIndicatorReducer(state, { type: 'COMPLETE' })).toBe('idle');
    });

    it('ignores ERROR', () => {
      expect(generationIndicatorReducer(state, { type: 'ERROR' })).toBe('idle');
    });

    it('ignores RESET', () => {
      expect(generationIndicatorReducer(state, { type: 'RESET' })).toBe('idle');
    });
  });

  describe('generating state', () => {
    const state: GenerationIndicatorState = 'generating';

    it('stays generating on TOKEN', () => {
      expect(generationIndicatorReducer(state, { type: 'TOKEN' })).toBe('generating');
    });

    it('transitions to complete on COMPLETE', () => {
      expect(generationIndicatorReducer(state, { type: 'COMPLETE' })).toBe('complete');
    });

    it('transitions to error on ERROR', () => {
      expect(generationIndicatorReducer(state, { type: 'ERROR' })).toBe('error');
    });

    it('ignores START', () => {
      expect(generationIndicatorReducer(state, { type: 'START' })).toBe('generating');
    });

    it('ignores RESET', () => {
      expect(generationIndicatorReducer(state, { type: 'RESET' })).toBe('generating');
    });
  });

  describe('complete state', () => {
    const state: GenerationIndicatorState = 'complete';

    it('transitions to idle on RESET', () => {
      expect(generationIndicatorReducer(state, { type: 'RESET' })).toBe('idle');
    });

    it('transitions to generating on START', () => {
      expect(generationIndicatorReducer(state, { type: 'START' })).toBe('generating');
    });

    it('ignores TOKEN', () => {
      expect(generationIndicatorReducer(state, { type: 'TOKEN' })).toBe('complete');
    });

    it('ignores ERROR', () => {
      expect(generationIndicatorReducer(state, { type: 'ERROR' })).toBe('complete');
    });
  });

  describe('error state', () => {
    const state: GenerationIndicatorState = 'error';

    it('transitions to idle on RESET', () => {
      expect(generationIndicatorReducer(state, { type: 'RESET' })).toBe('idle');
    });

    it('transitions to generating on RETRY', () => {
      expect(generationIndicatorReducer(state, { type: 'RETRY' })).toBe('generating');
    });

    it('ignores START', () => {
      expect(generationIndicatorReducer(state, { type: 'START' })).toBe('error');
    });

    it('ignores TOKEN', () => {
      expect(generationIndicatorReducer(state, { type: 'TOKEN' })).toBe('error');
    });

    it('ignores COMPLETE', () => {
      expect(generationIndicatorReducer(state, { type: 'COMPLETE' })).toBe('error');
    });
  });

  describe('full cycle tests', () => {
    it('idle -> generating -> complete -> idle', () => {
      let s: GenerationIndicatorState = 'idle';
      s = generationIndicatorReducer(s, { type: 'START' });
      expect(s).toBe('generating');
      s = generationIndicatorReducer(s, { type: 'TOKEN' });
      expect(s).toBe('generating');
      s = generationIndicatorReducer(s, { type: 'COMPLETE' });
      expect(s).toBe('complete');
      s = generationIndicatorReducer(s, { type: 'RESET' });
      expect(s).toBe('idle');
    });

    it('idle -> generating -> error -> generating (retry) -> complete', () => {
      let s: GenerationIndicatorState = 'idle';
      s = generationIndicatorReducer(s, { type: 'START' });
      s = generationIndicatorReducer(s, { type: 'ERROR' });
      expect(s).toBe('error');
      s = generationIndicatorReducer(s, { type: 'RETRY' });
      expect(s).toBe('generating');
      s = generationIndicatorReducer(s, { type: 'COMPLETE' });
      expect(s).toBe('complete');
    });

    it('complete -> generating (restart) -> error -> idle', () => {
      let s: GenerationIndicatorState = 'complete';
      s = generationIndicatorReducer(s, { type: 'START' });
      expect(s).toBe('generating');
      s = generationIndicatorReducer(s, { type: 'ERROR' });
      expect(s).toBe('error');
      s = generationIndicatorReducer(s, { type: 'RESET' });
      expect(s).toBe('idle');
    });
  });
});
