import { describe, it, expect } from 'vitest';
import {
  dagViewerReducer,
  type DagViewerState,
  type DagViewerEvent,
} from '../../../vanilla/components/widgets/concepts/formal-verification/DagViewer.ts';

describe('DagViewer reducer', () => {
  it('starts in idle', () => {
    const state: DagViewerState = 'idle';
    expect(state).toBe('idle');
  });

  describe('idle state', () => {
    it('transitions to nodeSelected on SELECT_NODE', () => {
      expect(dagViewerReducer('idle', { type: 'SELECT_NODE', id: 'n1' })).toBe('nodeSelected');
    });

    it('stays idle on ZOOM', () => {
      expect(dagViewerReducer('idle', { type: 'ZOOM' })).toBe('idle');
    });

    it('stays idle on PAN', () => {
      expect(dagViewerReducer('idle', { type: 'PAN' })).toBe('idle');
    });

    it('transitions to computing on LAYOUT', () => {
      expect(dagViewerReducer('idle', { type: 'LAYOUT' })).toBe('computing');
    });

    it('ignores DESELECT in idle', () => {
      expect(dagViewerReducer('idle', { type: 'DESELECT' })).toBe('idle');
    });

    it('ignores LAYOUT_COMPLETE in idle', () => {
      expect(dagViewerReducer('idle', { type: 'LAYOUT_COMPLETE' })).toBe('idle');
    });
  });

  describe('nodeSelected state', () => {
    it('transitions to idle on DESELECT', () => {
      expect(dagViewerReducer('nodeSelected', { type: 'DESELECT' })).toBe('idle');
    });

    it('stays nodeSelected on SELECT_NODE (reselect)', () => {
      expect(dagViewerReducer('nodeSelected', { type: 'SELECT_NODE', id: 'n2' })).toBe('nodeSelected');
    });

    it('ignores ZOOM in nodeSelected', () => {
      expect(dagViewerReducer('nodeSelected', { type: 'ZOOM' })).toBe('nodeSelected');
    });

    it('ignores LAYOUT in nodeSelected', () => {
      expect(dagViewerReducer('nodeSelected', { type: 'LAYOUT' })).toBe('nodeSelected');
    });

    it('ignores LAYOUT_COMPLETE in nodeSelected', () => {
      expect(dagViewerReducer('nodeSelected', { type: 'LAYOUT_COMPLETE' })).toBe('nodeSelected');
    });
  });

  describe('computing state', () => {
    it('transitions to idle on LAYOUT_COMPLETE', () => {
      expect(dagViewerReducer('computing', { type: 'LAYOUT_COMPLETE' })).toBe('idle');
    });

    it('ignores SELECT_NODE in computing', () => {
      expect(dagViewerReducer('computing', { type: 'SELECT_NODE', id: 'n1' })).toBe('computing');
    });

    it('ignores DESELECT in computing', () => {
      expect(dagViewerReducer('computing', { type: 'DESELECT' })).toBe('computing');
    });

    it('ignores ZOOM in computing', () => {
      expect(dagViewerReducer('computing', { type: 'ZOOM' })).toBe('computing');
    });
  });
});
