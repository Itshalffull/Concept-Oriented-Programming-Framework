import { describe, it, expect } from 'vitest';
import {
  traceStepControlsReducer,
  type TraceStepControlsState,
  type TraceStepControlsEvent,
} from '../../../vanilla/components/widgets/concepts/formal-verification/TraceStepControls.ts';

describe('TraceStepControls reducer', () => {
  it('starts in paused', () => {
    const state: TraceStepControlsState = 'paused';
    expect(state).toBe('paused');
  });

  describe('paused state', () => {
    it('transitions to playing on PLAY', () => {
      expect(traceStepControlsReducer('paused', { type: 'PLAY' })).toBe('playing');
    });

    it('stays paused on STEP_FWD', () => {
      expect(traceStepControlsReducer('paused', { type: 'STEP_FWD' })).toBe('paused');
    });

    it('stays paused on STEP_BACK', () => {
      expect(traceStepControlsReducer('paused', { type: 'STEP_BACK' })).toBe('paused');
    });

    it('stays paused on JUMP_START', () => {
      expect(traceStepControlsReducer('paused', { type: 'JUMP_START' })).toBe('paused');
    });

    it('stays paused on JUMP_END', () => {
      expect(traceStepControlsReducer('paused', { type: 'JUMP_END' })).toBe('paused');
    });

    it('ignores PAUSE in paused', () => {
      expect(traceStepControlsReducer('paused', { type: 'PAUSE' })).toBe('paused');
    });

    it('ignores REACH_END in paused', () => {
      expect(traceStepControlsReducer('paused', { type: 'REACH_END' })).toBe('paused');
    });
  });

  describe('playing state', () => {
    it('transitions to paused on PAUSE', () => {
      expect(traceStepControlsReducer('playing', { type: 'PAUSE' })).toBe('paused');
    });

    it('transitions to paused on REACH_END', () => {
      expect(traceStepControlsReducer('playing', { type: 'REACH_END' })).toBe('paused');
    });

    it('ignores PLAY in playing', () => {
      expect(traceStepControlsReducer('playing', { type: 'PLAY' })).toBe('playing');
    });

    it('ignores STEP_FWD in playing', () => {
      expect(traceStepControlsReducer('playing', { type: 'STEP_FWD' })).toBe('playing');
    });

    it('ignores STEP_BACK in playing', () => {
      expect(traceStepControlsReducer('playing', { type: 'STEP_BACK' })).toBe('playing');
    });

    it('ignores JUMP_START in playing', () => {
      expect(traceStepControlsReducer('playing', { type: 'JUMP_START' })).toBe('playing');
    });
  });
});
