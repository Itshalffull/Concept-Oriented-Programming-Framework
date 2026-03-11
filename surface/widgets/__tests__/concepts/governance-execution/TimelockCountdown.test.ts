import { describe, it, expect } from 'vitest';
import {
  timelockCountdownReducer,
  type TimelockCountdownState,
  type TimelockCountdownEvent,
} from '../../../vanilla/components/widgets/concepts/governance-execution/TimelockCountdown.ts';

describe('TimelockCountdown reducer', () => {
  it('starts in running', () => {
    const state: TimelockCountdownState = 'running';
    expect(state).toBe('running');
  });

  describe('running state', () => {
    it('stays running on TICK', () => {
      expect(timelockCountdownReducer('running', { type: 'TICK' })).toBe('running');
    });

    it('transitions to warning on WARNING_THRESHOLD', () => {
      expect(timelockCountdownReducer('running', { type: 'WARNING_THRESHOLD' })).toBe('warning');
    });

    it('transitions to expired on EXPIRE', () => {
      expect(timelockCountdownReducer('running', { type: 'EXPIRE' })).toBe('expired');
    });

    it('transitions to paused on PAUSE', () => {
      expect(timelockCountdownReducer('running', { type: 'PAUSE' })).toBe('paused');
    });

    it('ignores CRITICAL_THRESHOLD in running', () => {
      expect(timelockCountdownReducer('running', { type: 'CRITICAL_THRESHOLD' })).toBe('running');
    });

    it('ignores EXECUTE in running', () => {
      expect(timelockCountdownReducer('running', { type: 'EXECUTE' })).toBe('running');
    });

    it('ignores RESUME in running', () => {
      expect(timelockCountdownReducer('running', { type: 'RESUME' })).toBe('running');
    });
  });

  describe('warning state', () => {
    it('stays warning on TICK', () => {
      expect(timelockCountdownReducer('warning', { type: 'TICK' })).toBe('warning');
    });

    it('transitions to critical on CRITICAL_THRESHOLD', () => {
      expect(timelockCountdownReducer('warning', { type: 'CRITICAL_THRESHOLD' })).toBe('critical');
    });

    it('transitions to expired on EXPIRE', () => {
      expect(timelockCountdownReducer('warning', { type: 'EXPIRE' })).toBe('expired');
    });

    it('ignores WARNING_THRESHOLD in warning', () => {
      expect(timelockCountdownReducer('warning', { type: 'WARNING_THRESHOLD' })).toBe('warning');
    });

    it('ignores PAUSE in warning', () => {
      expect(timelockCountdownReducer('warning', { type: 'PAUSE' })).toBe('warning');
    });
  });

  describe('critical state', () => {
    it('stays critical on TICK', () => {
      expect(timelockCountdownReducer('critical', { type: 'TICK' })).toBe('critical');
    });

    it('transitions to expired on EXPIRE', () => {
      expect(timelockCountdownReducer('critical', { type: 'EXPIRE' })).toBe('expired');
    });

    it('ignores CRITICAL_THRESHOLD in critical', () => {
      expect(timelockCountdownReducer('critical', { type: 'CRITICAL_THRESHOLD' })).toBe('critical');
    });

    it('ignores EXECUTE in critical', () => {
      expect(timelockCountdownReducer('critical', { type: 'EXECUTE' })).toBe('critical');
    });
  });

  describe('expired state', () => {
    it('transitions to executing on EXECUTE', () => {
      expect(timelockCountdownReducer('expired', { type: 'EXECUTE' })).toBe('executing');
    });

    it('transitions to running on RESET', () => {
      expect(timelockCountdownReducer('expired', { type: 'RESET' })).toBe('running');
    });

    it('ignores TICK in expired', () => {
      expect(timelockCountdownReducer('expired', { type: 'TICK' })).toBe('expired');
    });

    it('ignores PAUSE in expired', () => {
      expect(timelockCountdownReducer('expired', { type: 'PAUSE' })).toBe('expired');
    });
  });

  describe('executing state', () => {
    it('transitions to completed on EXECUTE_COMPLETE', () => {
      expect(timelockCountdownReducer('executing', { type: 'EXECUTE_COMPLETE' })).toBe('completed');
    });

    it('transitions to expired on EXECUTE_ERROR', () => {
      expect(timelockCountdownReducer('executing', { type: 'EXECUTE_ERROR' })).toBe('expired');
    });

    it('ignores TICK in executing', () => {
      expect(timelockCountdownReducer('executing', { type: 'TICK' })).toBe('executing');
    });

    it('ignores RESET in executing', () => {
      expect(timelockCountdownReducer('executing', { type: 'RESET' })).toBe('executing');
    });
  });

  describe('completed state', () => {
    it('ignores all events (terminal state)', () => {
      expect(timelockCountdownReducer('completed', { type: 'TICK' })).toBe('completed');
      expect(timelockCountdownReducer('completed', { type: 'RESET' })).toBe('completed');
      expect(timelockCountdownReducer('completed', { type: 'EXECUTE' })).toBe('completed');
    });
  });

  describe('paused state', () => {
    it('transitions to running on RESUME', () => {
      expect(timelockCountdownReducer('paused', { type: 'RESUME' })).toBe('running');
    });

    it('ignores TICK in paused', () => {
      expect(timelockCountdownReducer('paused', { type: 'TICK' })).toBe('paused');
    });

    it('ignores EXPIRE in paused', () => {
      expect(timelockCountdownReducer('paused', { type: 'EXPIRE' })).toBe('paused');
    });

    it('ignores EXECUTE in paused', () => {
      expect(timelockCountdownReducer('paused', { type: 'EXECUTE' })).toBe('paused');
    });
  });
});
