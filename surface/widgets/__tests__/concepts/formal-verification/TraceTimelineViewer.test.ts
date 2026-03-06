import { describe, it, expect } from 'vitest';
import {
  traceTimelineViewerReducer,
  type TraceTimelineViewerState,
  type TraceTimelineViewerEvent,
} from '../../../vanilla/components/widgets/concepts/formal-verification/TraceTimelineViewer.ts';

describe('TraceTimelineViewer reducer', () => {
  it('starts in idle', () => {
    const state: TraceTimelineViewerState = 'idle';
    expect(state).toBe('idle');
  });

  describe('idle state', () => {
    it('transitions to playing on PLAY', () => {
      expect(traceTimelineViewerReducer('idle', { type: 'PLAY' })).toBe('playing');
    });

    it('stays idle on STEP_FORWARD', () => {
      expect(traceTimelineViewerReducer('idle', { type: 'STEP_FORWARD' })).toBe('idle');
    });

    it('stays idle on STEP_BACKWARD', () => {
      expect(traceTimelineViewerReducer('idle', { type: 'STEP_BACKWARD' })).toBe('idle');
    });

    it('transitions to cellSelected on SELECT_CELL', () => {
      expect(traceTimelineViewerReducer('idle', { type: 'SELECT_CELL' })).toBe('cellSelected');
    });

    it('stays idle on ZOOM', () => {
      expect(traceTimelineViewerReducer('idle', { type: 'ZOOM' })).toBe('idle');
    });

    it('ignores PAUSE in idle', () => {
      expect(traceTimelineViewerReducer('idle', { type: 'PAUSE' })).toBe('idle');
    });

    it('ignores STEP_END in idle', () => {
      expect(traceTimelineViewerReducer('idle', { type: 'STEP_END' })).toBe('idle');
    });

    it('ignores DESELECT in idle', () => {
      expect(traceTimelineViewerReducer('idle', { type: 'DESELECT' })).toBe('idle');
    });
  });

  describe('playing state', () => {
    it('transitions to idle on PAUSE', () => {
      expect(traceTimelineViewerReducer('playing', { type: 'PAUSE' })).toBe('idle');
    });

    it('transitions to idle on STEP_END', () => {
      expect(traceTimelineViewerReducer('playing', { type: 'STEP_END' })).toBe('idle');
    });

    it('ignores PLAY in playing', () => {
      expect(traceTimelineViewerReducer('playing', { type: 'PLAY' })).toBe('playing');
    });

    it('ignores SELECT_CELL in playing', () => {
      expect(traceTimelineViewerReducer('playing', { type: 'SELECT_CELL' })).toBe('playing');
    });

    it('ignores ZOOM in playing', () => {
      expect(traceTimelineViewerReducer('playing', { type: 'ZOOM' })).toBe('playing');
    });
  });

  describe('cellSelected state', () => {
    it('transitions to idle on DESELECT', () => {
      expect(traceTimelineViewerReducer('cellSelected', { type: 'DESELECT' })).toBe('idle');
    });

    it('stays cellSelected on SELECT_CELL (reselect)', () => {
      expect(traceTimelineViewerReducer('cellSelected', { type: 'SELECT_CELL' })).toBe('cellSelected');
    });

    it('ignores PLAY in cellSelected', () => {
      expect(traceTimelineViewerReducer('cellSelected', { type: 'PLAY' })).toBe('cellSelected');
    });

    it('ignores PAUSE in cellSelected', () => {
      expect(traceTimelineViewerReducer('cellSelected', { type: 'PAUSE' })).toBe('cellSelected');
    });

    it('ignores ZOOM in cellSelected', () => {
      expect(traceTimelineViewerReducer('cellSelected', { type: 'ZOOM' })).toBe('cellSelected');
    });
  });
});
