import { describe, it, expect } from 'vitest';
import {
  slaTimerReducer,
  type SlaTimerState,
} from '../../../vanilla/components/widgets/concepts/process-human/SlaTimer.ts';

describe('SlaTimer reducer', () => {
  describe('onTrack state', () => {
    const state: SlaTimerState = 'onTrack';

    it('stays onTrack on TICK', () => {
      expect(slaTimerReducer(state, { type: 'TICK' })).toBe('onTrack');
    });

    it('transitions to warning on WARNING_THRESHOLD', () => {
      expect(slaTimerReducer(state, { type: 'WARNING_THRESHOLD' })).toBe('warning');
    });

    it('transitions to paused on PAUSE', () => {
      expect(slaTimerReducer(state, { type: 'PAUSE' })).toBe('paused');
    });

    it('ignores CRITICAL_THRESHOLD', () => {
      expect(slaTimerReducer(state, { type: 'CRITICAL_THRESHOLD' })).toBe('onTrack');
    });

    it('ignores BREACH', () => {
      expect(slaTimerReducer(state, { type: 'BREACH' })).toBe('onTrack');
    });

    it('ignores RESUME', () => {
      expect(slaTimerReducer(state, { type: 'RESUME' })).toBe('onTrack');
    });
  });

  describe('warning state', () => {
    const state: SlaTimerState = 'warning';

    it('stays warning on TICK', () => {
      expect(slaTimerReducer(state, { type: 'TICK' })).toBe('warning');
    });

    it('transitions to critical on CRITICAL_THRESHOLD', () => {
      expect(slaTimerReducer(state, { type: 'CRITICAL_THRESHOLD' })).toBe('critical');
    });

    it('transitions to paused on PAUSE', () => {
      expect(slaTimerReducer(state, { type: 'PAUSE' })).toBe('paused');
    });

    it('ignores WARNING_THRESHOLD', () => {
      expect(slaTimerReducer(state, { type: 'WARNING_THRESHOLD' })).toBe('warning');
    });

    it('ignores BREACH', () => {
      expect(slaTimerReducer(state, { type: 'BREACH' })).toBe('warning');
    });

    it('ignores RESUME', () => {
      expect(slaTimerReducer(state, { type: 'RESUME' })).toBe('warning');
    });
  });

  describe('critical state', () => {
    const state: SlaTimerState = 'critical';

    it('stays critical on TICK', () => {
      expect(slaTimerReducer(state, { type: 'TICK' })).toBe('critical');
    });

    it('transitions to breached on BREACH', () => {
      expect(slaTimerReducer(state, { type: 'BREACH' })).toBe('breached');
    });

    it('transitions to paused on PAUSE', () => {
      expect(slaTimerReducer(state, { type: 'PAUSE' })).toBe('paused');
    });

    it('ignores WARNING_THRESHOLD', () => {
      expect(slaTimerReducer(state, { type: 'WARNING_THRESHOLD' })).toBe('critical');
    });

    it('ignores CRITICAL_THRESHOLD', () => {
      expect(slaTimerReducer(state, { type: 'CRITICAL_THRESHOLD' })).toBe('critical');
    });

    it('ignores RESUME', () => {
      expect(slaTimerReducer(state, { type: 'RESUME' })).toBe('critical');
    });
  });

  describe('breached state', () => {
    const state: SlaTimerState = 'breached';

    it('stays breached on TICK', () => {
      expect(slaTimerReducer(state, { type: 'TICK' })).toBe('breached');
    });

    it('ignores PAUSE', () => {
      expect(slaTimerReducer(state, { type: 'PAUSE' })).toBe('breached');
    });

    it('ignores RESUME', () => {
      expect(slaTimerReducer(state, { type: 'RESUME' })).toBe('breached');
    });
  });

  describe('paused state', () => {
    const state: SlaTimerState = 'paused';

    it('transitions to onTrack on RESUME', () => {
      expect(slaTimerReducer(state, { type: 'RESUME' })).toBe('onTrack');
    });

    it('ignores TICK', () => {
      expect(slaTimerReducer(state, { type: 'TICK' })).toBe('paused');
    });

    it('ignores PAUSE', () => {
      expect(slaTimerReducer(state, { type: 'PAUSE' })).toBe('paused');
    });

    it('ignores WARNING_THRESHOLD', () => {
      expect(slaTimerReducer(state, { type: 'WARNING_THRESHOLD' })).toBe('paused');
    });
  });

  describe('full cycle tests', () => {
    it('onTrack -> warning -> critical -> breached', () => {
      let s: SlaTimerState = 'onTrack';
      s = slaTimerReducer(s, { type: 'TICK' });
      expect(s).toBe('onTrack');
      s = slaTimerReducer(s, { type: 'WARNING_THRESHOLD' });
      expect(s).toBe('warning');
      s = slaTimerReducer(s, { type: 'TICK' });
      expect(s).toBe('warning');
      s = slaTimerReducer(s, { type: 'CRITICAL_THRESHOLD' });
      expect(s).toBe('critical');
      s = slaTimerReducer(s, { type: 'TICK' });
      expect(s).toBe('critical');
      s = slaTimerReducer(s, { type: 'BREACH' });
      expect(s).toBe('breached');
    });

    it('onTrack -> paused -> onTrack -> warning -> paused -> onTrack', () => {
      let s: SlaTimerState = 'onTrack';
      s = slaTimerReducer(s, { type: 'PAUSE' });
      expect(s).toBe('paused');
      s = slaTimerReducer(s, { type: 'RESUME' });
      expect(s).toBe('onTrack');
      s = slaTimerReducer(s, { type: 'WARNING_THRESHOLD' });
      expect(s).toBe('warning');
      s = slaTimerReducer(s, { type: 'PAUSE' });
      expect(s).toBe('paused');
      s = slaTimerReducer(s, { type: 'RESUME' });
      expect(s).toBe('onTrack');
    });

    it('critical -> paused -> onTrack', () => {
      let s: SlaTimerState = 'critical';
      s = slaTimerReducer(s, { type: 'PAUSE' });
      expect(s).toBe('paused');
      s = slaTimerReducer(s, { type: 'RESUME' });
      expect(s).toBe('onTrack');
    });
  });
});
