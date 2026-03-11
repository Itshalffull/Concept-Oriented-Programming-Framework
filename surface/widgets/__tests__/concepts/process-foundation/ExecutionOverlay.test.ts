import { describe, it, expect } from 'vitest';
import {
  executionOverlayReducer,
  type ExecutionOverlayState,
} from '../../../vanilla/components/widgets/concepts/process-foundation/ExecutionOverlay.ts';

describe('ExecutionOverlay reducer', () => {
  describe('idle state', () => {
    const state: ExecutionOverlayState = 'idle';

    it('transitions to live on START', () => {
      expect(executionOverlayReducer(state, { type: 'START' })).toBe('live');
    });

    it('transitions to replay on LOAD_REPLAY', () => {
      expect(executionOverlayReducer(state, { type: 'LOAD_REPLAY' })).toBe('replay');
    });

    it('ignores STEP_ADVANCE', () => {
      expect(executionOverlayReducer(state, { type: 'STEP_ADVANCE' })).toBe('idle');
    });

    it('ignores COMPLETE', () => {
      expect(executionOverlayReducer(state, { type: 'COMPLETE' })).toBe('idle');
    });

    it('ignores RESET', () => {
      expect(executionOverlayReducer(state, { type: 'RESET' })).toBe('idle');
    });
  });

  describe('live state', () => {
    const state: ExecutionOverlayState = 'live';

    it('stays live on STEP_ADVANCE', () => {
      expect(executionOverlayReducer(state, { type: 'STEP_ADVANCE' })).toBe('live');
    });

    it('transitions to completed on COMPLETE', () => {
      expect(executionOverlayReducer(state, { type: 'COMPLETE' })).toBe('completed');
    });

    it('transitions to failed on FAIL', () => {
      expect(executionOverlayReducer(state, { type: 'FAIL' })).toBe('failed');
    });

    it('transitions to suspended on SUSPEND', () => {
      expect(executionOverlayReducer(state, { type: 'SUSPEND' })).toBe('suspended');
    });

    it('transitions to cancelled on CANCEL', () => {
      expect(executionOverlayReducer(state, { type: 'CANCEL' })).toBe('cancelled');
    });

    it('ignores START', () => {
      expect(executionOverlayReducer(state, { type: 'START' })).toBe('live');
    });

    it('ignores RESET', () => {
      expect(executionOverlayReducer(state, { type: 'RESET' })).toBe('live');
    });

    it('ignores RETRY', () => {
      expect(executionOverlayReducer(state, { type: 'RETRY' })).toBe('live');
    });
  });

  describe('suspended state', () => {
    const state: ExecutionOverlayState = 'suspended';

    it('transitions to live on RESUME', () => {
      expect(executionOverlayReducer(state, { type: 'RESUME' })).toBe('live');
    });

    it('transitions to cancelled on CANCEL', () => {
      expect(executionOverlayReducer(state, { type: 'CANCEL' })).toBe('cancelled');
    });

    it('ignores START', () => {
      expect(executionOverlayReducer(state, { type: 'START' })).toBe('suspended');
    });

    it('ignores COMPLETE', () => {
      expect(executionOverlayReducer(state, { type: 'COMPLETE' })).toBe('suspended');
    });

    it('ignores RESET', () => {
      expect(executionOverlayReducer(state, { type: 'RESET' })).toBe('suspended');
    });
  });

  describe('completed state', () => {
    const state: ExecutionOverlayState = 'completed';

    it('transitions to idle on RESET', () => {
      expect(executionOverlayReducer(state, { type: 'RESET' })).toBe('idle');
    });

    it('ignores START', () => {
      expect(executionOverlayReducer(state, { type: 'START' })).toBe('completed');
    });

    it('ignores RETRY', () => {
      expect(executionOverlayReducer(state, { type: 'RETRY' })).toBe('completed');
    });

    it('ignores CANCEL', () => {
      expect(executionOverlayReducer(state, { type: 'CANCEL' })).toBe('completed');
    });
  });

  describe('failed state', () => {
    const state: ExecutionOverlayState = 'failed';

    it('transitions to idle on RESET', () => {
      expect(executionOverlayReducer(state, { type: 'RESET' })).toBe('idle');
    });

    it('transitions to live on RETRY', () => {
      expect(executionOverlayReducer(state, { type: 'RETRY' })).toBe('live');
    });

    it('ignores START', () => {
      expect(executionOverlayReducer(state, { type: 'START' })).toBe('failed');
    });

    it('ignores COMPLETE', () => {
      expect(executionOverlayReducer(state, { type: 'COMPLETE' })).toBe('failed');
    });

    it('ignores CANCEL', () => {
      expect(executionOverlayReducer(state, { type: 'CANCEL' })).toBe('failed');
    });
  });

  describe('cancelled state', () => {
    const state: ExecutionOverlayState = 'cancelled';

    it('transitions to idle on RESET', () => {
      expect(executionOverlayReducer(state, { type: 'RESET' })).toBe('idle');
    });

    it('ignores START', () => {
      expect(executionOverlayReducer(state, { type: 'START' })).toBe('cancelled');
    });

    it('ignores RETRY', () => {
      expect(executionOverlayReducer(state, { type: 'RETRY' })).toBe('cancelled');
    });

    it('ignores RESUME', () => {
      expect(executionOverlayReducer(state, { type: 'RESUME' })).toBe('cancelled');
    });
  });

  describe('replay state', () => {
    const state: ExecutionOverlayState = 'replay';

    it('stays replay on REPLAY_STEP', () => {
      expect(executionOverlayReducer(state, { type: 'REPLAY_STEP' })).toBe('replay');
    });

    it('transitions to idle on REPLAY_END', () => {
      expect(executionOverlayReducer(state, { type: 'REPLAY_END' })).toBe('idle');
    });

    it('ignores START', () => {
      expect(executionOverlayReducer(state, { type: 'START' })).toBe('replay');
    });

    it('ignores COMPLETE', () => {
      expect(executionOverlayReducer(state, { type: 'COMPLETE' })).toBe('replay');
    });

    it('ignores CANCEL', () => {
      expect(executionOverlayReducer(state, { type: 'CANCEL' })).toBe('replay');
    });
  });

  describe('full cycle tests', () => {
    it('idle -> live -> completed -> idle', () => {
      let s: ExecutionOverlayState = 'idle';
      s = executionOverlayReducer(s, { type: 'START' });
      expect(s).toBe('live');
      s = executionOverlayReducer(s, { type: 'STEP_ADVANCE' });
      expect(s).toBe('live');
      s = executionOverlayReducer(s, { type: 'COMPLETE' });
      expect(s).toBe('completed');
      s = executionOverlayReducer(s, { type: 'RESET' });
      expect(s).toBe('idle');
    });

    it('idle -> live -> suspended -> live -> failed -> retry -> live -> cancelled -> idle', () => {
      let s: ExecutionOverlayState = 'idle';
      s = executionOverlayReducer(s, { type: 'START' });
      s = executionOverlayReducer(s, { type: 'SUSPEND' });
      expect(s).toBe('suspended');
      s = executionOverlayReducer(s, { type: 'RESUME' });
      expect(s).toBe('live');
      s = executionOverlayReducer(s, { type: 'FAIL' });
      expect(s).toBe('failed');
      s = executionOverlayReducer(s, { type: 'RETRY' });
      expect(s).toBe('live');
      s = executionOverlayReducer(s, { type: 'CANCEL' });
      expect(s).toBe('cancelled');
      s = executionOverlayReducer(s, { type: 'RESET' });
      expect(s).toBe('idle');
    });

    it('idle -> replay -> replay (step) -> idle', () => {
      let s: ExecutionOverlayState = 'idle';
      s = executionOverlayReducer(s, { type: 'LOAD_REPLAY' });
      expect(s).toBe('replay');
      s = executionOverlayReducer(s, { type: 'REPLAY_STEP' });
      expect(s).toBe('replay');
      s = executionOverlayReducer(s, { type: 'REPLAY_END' });
      expect(s).toBe('idle');
    });
  });
});
