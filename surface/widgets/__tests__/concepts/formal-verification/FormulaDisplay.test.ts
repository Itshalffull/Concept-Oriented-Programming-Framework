import { describe, it, expect } from 'vitest';
import {
  formulaDisplayReducer,
  type FormulaDisplayState,
  type FormulaDisplayEvent,
} from '../../../vanilla/components/widgets/concepts/formal-verification/FormulaDisplay.ts';

describe('FormulaDisplay reducer', () => {
  it('starts in idle', () => {
    const state: FormulaDisplayState = 'idle';
    expect(state).toBe('idle');
  });

  describe('idle state', () => {
    it('transitions to copied on COPY', () => {
      expect(formulaDisplayReducer('idle', { type: 'COPY' })).toBe('copied');
    });

    it('transitions to rendering on RENDER_LATEX', () => {
      expect(formulaDisplayReducer('idle', { type: 'RENDER_LATEX' })).toBe('rendering');
    });

    it('ignores TIMEOUT in idle', () => {
      expect(formulaDisplayReducer('idle', { type: 'TIMEOUT' })).toBe('idle');
    });

    it('ignores RENDER_COMPLETE in idle', () => {
      expect(formulaDisplayReducer('idle', { type: 'RENDER_COMPLETE' })).toBe('idle');
    });
  });

  describe('copied state', () => {
    it('transitions to idle on TIMEOUT', () => {
      expect(formulaDisplayReducer('copied', { type: 'TIMEOUT' })).toBe('idle');
    });

    it('ignores COPY in copied', () => {
      expect(formulaDisplayReducer('copied', { type: 'COPY' })).toBe('copied');
    });

    it('ignores RENDER_LATEX in copied', () => {
      expect(formulaDisplayReducer('copied', { type: 'RENDER_LATEX' })).toBe('copied');
    });

    it('ignores RENDER_COMPLETE in copied', () => {
      expect(formulaDisplayReducer('copied', { type: 'RENDER_COMPLETE' })).toBe('copied');
    });
  });

  describe('rendering state', () => {
    it('transitions to idle on RENDER_COMPLETE', () => {
      expect(formulaDisplayReducer('rendering', { type: 'RENDER_COMPLETE' })).toBe('idle');
    });

    it('ignores COPY in rendering', () => {
      expect(formulaDisplayReducer('rendering', { type: 'COPY' })).toBe('rendering');
    });

    it('ignores TIMEOUT in rendering', () => {
      expect(formulaDisplayReducer('rendering', { type: 'TIMEOUT' })).toBe('rendering');
    });
  });
});
