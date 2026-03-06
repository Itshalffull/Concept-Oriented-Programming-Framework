import { describe, it, expect } from 'vitest';
import {
  executionMetricsPanelReducer,
  type ExecutionMetricsPanelState,
} from '../../../vanilla/components/widgets/concepts/llm-safety/ExecutionMetricsPanel.ts';

describe('ExecutionMetricsPanel reducer', () => {
  describe('idle state', () => {
    const state: ExecutionMetricsPanelState = 'idle';

    it('transitions to updating on UPDATE', () => {
      expect(executionMetricsPanelReducer(state, { type: 'UPDATE' })).toBe('updating');
    });

    it('ignores UPDATE_COMPLETE', () => {
      expect(executionMetricsPanelReducer(state, { type: 'UPDATE_COMPLETE' })).toBe('idle');
    });
  });

  describe('updating state', () => {
    const state: ExecutionMetricsPanelState = 'updating';

    it('transitions to idle on UPDATE_COMPLETE', () => {
      expect(executionMetricsPanelReducer(state, { type: 'UPDATE_COMPLETE' })).toBe('idle');
    });

    it('ignores UPDATE', () => {
      expect(executionMetricsPanelReducer(state, { type: 'UPDATE' })).toBe('updating');
    });
  });

  describe('full cycle tests', () => {
    it('idle -> updating -> idle', () => {
      let s: ExecutionMetricsPanelState = 'idle';
      s = executionMetricsPanelReducer(s, { type: 'UPDATE' });
      expect(s).toBe('updating');
      s = executionMetricsPanelReducer(s, { type: 'UPDATE_COMPLETE' });
      expect(s).toBe('idle');
    });

    it('multiple update cycles', () => {
      let s: ExecutionMetricsPanelState = 'idle';
      s = executionMetricsPanelReducer(s, { type: 'UPDATE' });
      s = executionMetricsPanelReducer(s, { type: 'UPDATE_COMPLETE' });
      s = executionMetricsPanelReducer(s, { type: 'UPDATE' });
      expect(s).toBe('updating');
      s = executionMetricsPanelReducer(s, { type: 'UPDATE_COMPLETE' });
      expect(s).toBe('idle');
    });
  });
});
