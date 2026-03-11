import { describe, it, expect } from 'vitest';
import {
  traceTreeReducer,
  type TraceTreeState,
  type TraceTreeEvent,
} from '../../../vanilla/components/widgets/concepts/llm-agent/TraceTree.ts';

describe('TraceTree reducer', () => {
  it('starts in idle', () => {
    const state: TraceTreeState = 'idle';
    expect(state).toBe('idle');
  });

  describe('idle state', () => {
    it('transitions to spanSelected on SELECT_SPAN', () => {
      expect(traceTreeReducer('idle', { type: 'SELECT_SPAN' })).toBe('spanSelected');
    });

    it('stays idle on EXPAND', () => {
      expect(traceTreeReducer('idle', { type: 'EXPAND' })).toBe('idle');
    });

    it('stays idle on COLLAPSE', () => {
      expect(traceTreeReducer('idle', { type: 'COLLAPSE' })).toBe('idle');
    });

    it('stays idle on FILTER', () => {
      expect(traceTreeReducer('idle', { type: 'FILTER' })).toBe('idle');
    });

    it('ignores DESELECT in idle', () => {
      expect(traceTreeReducer('idle', { type: 'DESELECT' })).toBe('idle');
    });

    it('ignores LOAD in idle', () => {
      expect(traceTreeReducer('idle', { type: 'LOAD' })).toBe('idle');
    });

    it('ignores LOAD_COMPLETE in idle', () => {
      expect(traceTreeReducer('idle', { type: 'LOAD_COMPLETE' })).toBe('idle');
    });
  });

  describe('spanSelected state', () => {
    it('transitions to idle on DESELECT', () => {
      expect(traceTreeReducer('spanSelected', { type: 'DESELECT' })).toBe('idle');
    });

    it('stays spanSelected on SELECT_SPAN (reselect)', () => {
      expect(traceTreeReducer('spanSelected', { type: 'SELECT_SPAN' })).toBe('spanSelected');
    });

    it('ignores EXPAND in spanSelected', () => {
      expect(traceTreeReducer('spanSelected', { type: 'EXPAND' })).toBe('spanSelected');
    });

    it('ignores COLLAPSE in spanSelected', () => {
      expect(traceTreeReducer('spanSelected', { type: 'COLLAPSE' })).toBe('spanSelected');
    });

    it('ignores FILTER in spanSelected', () => {
      expect(traceTreeReducer('spanSelected', { type: 'FILTER' })).toBe('spanSelected');
    });

    it('ignores LOAD in spanSelected', () => {
      expect(traceTreeReducer('spanSelected', { type: 'LOAD' })).toBe('spanSelected');
    });
  });

  describe('ready state', () => {
    it('transitions to fetching on LOAD', () => {
      expect(traceTreeReducer('ready', { type: 'LOAD' })).toBe('fetching');
    });

    it('ignores SELECT_SPAN in ready', () => {
      expect(traceTreeReducer('ready', { type: 'SELECT_SPAN' })).toBe('ready');
    });

    it('ignores EXPAND in ready', () => {
      expect(traceTreeReducer('ready', { type: 'EXPAND' })).toBe('ready');
    });

    it('ignores DESELECT in ready', () => {
      expect(traceTreeReducer('ready', { type: 'DESELECT' })).toBe('ready');
    });
  });

  describe('fetching state', () => {
    it('transitions to ready on LOAD_COMPLETE', () => {
      expect(traceTreeReducer('fetching', { type: 'LOAD_COMPLETE' })).toBe('ready');
    });

    it('ignores LOAD in fetching', () => {
      expect(traceTreeReducer('fetching', { type: 'LOAD' })).toBe('fetching');
    });

    it('ignores SELECT_SPAN in fetching', () => {
      expect(traceTreeReducer('fetching', { type: 'SELECT_SPAN' })).toBe('fetching');
    });

    it('ignores DESELECT in fetching', () => {
      expect(traceTreeReducer('fetching', { type: 'DESELECT' })).toBe('fetching');
    });
  });
});
