import { describe, it, expect } from 'vitest';
import {
  streamTextReducer,
  type StreamTextState,
} from '../../../vanilla/components/widgets/concepts/llm-conversation/StreamText.ts';

// Note: The reducer uses 'streaming' as any for its return value,
// so the actual streaming state is cast. We test with string comparisons.

describe('StreamText reducer', () => {
  describe('idle state', () => {
    const state: StreamTextState = 'idle';

    it('transitions to streaming on STREAM_START', () => {
      expect(streamTextReducer(state, { type: 'STREAM_START' })).toBe('streaming');
    });

    it('ignores TOKEN', () => {
      expect(streamTextReducer(state, { type: 'TOKEN' })).toBe('idle');
    });

    it('ignores STREAM_END', () => {
      expect(streamTextReducer(state, { type: 'STREAM_END' })).toBe('idle');
    });

    it('ignores STOP', () => {
      expect(streamTextReducer(state, { type: 'STOP' })).toBe('idle');
    });
  });

  describe('complete state', () => {
    const state: StreamTextState = 'complete';

    it('transitions to streaming on STREAM_START', () => {
      expect(streamTextReducer(state, { type: 'STREAM_START' })).toBe('streaming');
    });

    it('ignores TOKEN', () => {
      expect(streamTextReducer(state, { type: 'TOKEN' })).toBe('complete');
    });

    it('ignores STOP', () => {
      expect(streamTextReducer(state, { type: 'STOP' })).toBe('complete');
    });
  });

  describe('stopped state', () => {
    const state: StreamTextState = 'stopped';

    it('transitions to streaming on STREAM_START', () => {
      expect(streamTextReducer(state, { type: 'STREAM_START' })).toBe('streaming');
    });

    it('ignores TOKEN', () => {
      expect(streamTextReducer(state, { type: 'TOKEN' })).toBe('stopped');
    });

    it('ignores STREAM_END', () => {
      expect(streamTextReducer(state, { type: 'STREAM_END' })).toBe('stopped');
    });
  });

  describe('full cycle tests', () => {
    it('idle -> streaming via STREAM_START', () => {
      const s = streamTextReducer('idle', { type: 'STREAM_START' });
      expect(s).toBe('streaming');
    });

    it('complete -> streaming via STREAM_START', () => {
      const s = streamTextReducer('complete', { type: 'STREAM_START' });
      expect(s).toBe('streaming');
    });

    it('stopped -> streaming via STREAM_START', () => {
      const s = streamTextReducer('stopped', { type: 'STREAM_START' });
      expect(s).toBe('streaming');
    });
  });
});
