import { describe, it, expect } from 'vitest';
import {
  reasoningBlockReducer,
  type ReasoningBlockState,
  type ReasoningBlockEvent,
} from '../../../vanilla/components/widgets/concepts/llm-agent/ReasoningBlock.ts';

describe('ReasoningBlock reducer', () => {
  it('starts in collapsed', () => {
    const state: ReasoningBlockState = 'collapsed';
    expect(state).toBe('collapsed');
  });

  describe('collapsed state', () => {
    it('transitions to expanded on EXPAND', () => {
      expect(reasoningBlockReducer('collapsed', { type: 'EXPAND' })).toBe('expanded');
    });

    it('transitions to expanded on TOGGLE', () => {
      expect(reasoningBlockReducer('collapsed', { type: 'TOGGLE' })).toBe('expanded');
    });

    it('transitions to streaming on STREAM_START', () => {
      expect(reasoningBlockReducer('collapsed', { type: 'STREAM_START' })).toBe('streaming');
    });

    it('ignores COLLAPSE in collapsed', () => {
      expect(reasoningBlockReducer('collapsed', { type: 'COLLAPSE' })).toBe('collapsed');
    });

    it('ignores TOKEN in collapsed', () => {
      expect(reasoningBlockReducer('collapsed', { type: 'TOKEN' })).toBe('collapsed');
    });

    it('ignores STREAM_END in collapsed', () => {
      expect(reasoningBlockReducer('collapsed', { type: 'STREAM_END' })).toBe('collapsed');
    });
  });

  describe('expanded state', () => {
    it('transitions to collapsed on COLLAPSE', () => {
      expect(reasoningBlockReducer('expanded', { type: 'COLLAPSE' })).toBe('collapsed');
    });

    it('transitions to collapsed on TOGGLE', () => {
      expect(reasoningBlockReducer('expanded', { type: 'TOGGLE' })).toBe('collapsed');
    });

    it('ignores EXPAND in expanded', () => {
      expect(reasoningBlockReducer('expanded', { type: 'EXPAND' })).toBe('expanded');
    });

    it('ignores STREAM_START in expanded', () => {
      expect(reasoningBlockReducer('expanded', { type: 'STREAM_START' })).toBe('expanded');
    });

    it('ignores TOKEN in expanded', () => {
      expect(reasoningBlockReducer('expanded', { type: 'TOKEN' })).toBe('expanded');
    });

    it('ignores STREAM_END in expanded', () => {
      expect(reasoningBlockReducer('expanded', { type: 'STREAM_END' })).toBe('expanded');
    });
  });

  describe('streaming state', () => {
    it('stays streaming on TOKEN', () => {
      expect(reasoningBlockReducer('streaming', { type: 'TOKEN' })).toBe('streaming');
    });

    it('transitions to collapsed on STREAM_END', () => {
      expect(reasoningBlockReducer('streaming', { type: 'STREAM_END' })).toBe('collapsed');
    });

    it('ignores EXPAND in streaming', () => {
      expect(reasoningBlockReducer('streaming', { type: 'EXPAND' })).toBe('streaming');
    });

    it('ignores COLLAPSE in streaming', () => {
      expect(reasoningBlockReducer('streaming', { type: 'COLLAPSE' })).toBe('streaming');
    });

    it('ignores TOGGLE in streaming', () => {
      expect(reasoningBlockReducer('streaming', { type: 'TOGGLE' })).toBe('streaming');
    });
  });
});
