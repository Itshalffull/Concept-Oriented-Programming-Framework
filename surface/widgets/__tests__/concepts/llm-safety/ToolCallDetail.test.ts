import { describe, it, expect } from 'vitest';
import {
  toolCallDetailReducer,
  type ToolCallDetailState,
} from '../../../vanilla/components/widgets/concepts/llm-safety/ToolCallDetail.ts';

describe('ToolCallDetail reducer', () => {
  describe('idle state', () => {
    const state: ToolCallDetailState = 'idle';

    it('transitions to retrying on RETRY', () => {
      expect(toolCallDetailReducer(state, { type: 'RETRY' })).toBe('retrying');
    });

    it('ignores EXPAND_ARGS', () => {
      expect(toolCallDetailReducer(state, { type: 'EXPAND_ARGS' })).toBe('idle');
    });

    it('ignores EXPAND_RESULT', () => {
      expect(toolCallDetailReducer(state, { type: 'EXPAND_RESULT' })).toBe('idle');
    });

    it('ignores RETRY_COMPLETE', () => {
      expect(toolCallDetailReducer(state, { type: 'RETRY_COMPLETE' })).toBe('idle');
    });

    it('ignores RETRY_ERROR', () => {
      expect(toolCallDetailReducer(state, { type: 'RETRY_ERROR' })).toBe('idle');
    });
  });

  describe('retrying state', () => {
    const state: ToolCallDetailState = 'retrying';

    it('transitions to idle on RETRY_COMPLETE', () => {
      expect(toolCallDetailReducer(state, { type: 'RETRY_COMPLETE' })).toBe('idle');
    });

    it('transitions to idle on RETRY_ERROR', () => {
      expect(toolCallDetailReducer(state, { type: 'RETRY_ERROR' })).toBe('idle');
    });

    it('ignores RETRY', () => {
      expect(toolCallDetailReducer(state, { type: 'RETRY' })).toBe('retrying');
    });

    it('ignores EXPAND_ARGS', () => {
      expect(toolCallDetailReducer(state, { type: 'EXPAND_ARGS' })).toBe('retrying');
    });

    it('ignores EXPAND_RESULT', () => {
      expect(toolCallDetailReducer(state, { type: 'EXPAND_RESULT' })).toBe('retrying');
    });
  });

  describe('full cycle tests', () => {
    it('idle -> retrying -> idle (complete)', () => {
      let s: ToolCallDetailState = 'idle';
      s = toolCallDetailReducer(s, { type: 'RETRY' });
      expect(s).toBe('retrying');
      s = toolCallDetailReducer(s, { type: 'RETRY_COMPLETE' });
      expect(s).toBe('idle');
    });

    it('idle -> retrying -> idle (error) -> retrying -> idle (complete)', () => {
      let s: ToolCallDetailState = 'idle';
      s = toolCallDetailReducer(s, { type: 'RETRY' });
      s = toolCallDetailReducer(s, { type: 'RETRY_ERROR' });
      expect(s).toBe('idle');
      s = toolCallDetailReducer(s, { type: 'RETRY' });
      s = toolCallDetailReducer(s, { type: 'RETRY_COMPLETE' });
      expect(s).toBe('idle');
    });
  });
});
