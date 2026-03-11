import { describe, it, expect } from 'vitest';
import {
  agentTimelineReducer,
  type AgentTimelineState,
  type AgentTimelineEvent,
} from '../../../vanilla/components/widgets/concepts/llm-agent/AgentTimeline.ts';

describe('AgentTimeline reducer', () => {
  it('starts in idle', () => {
    const state: AgentTimelineState = 'idle';
    expect(state).toBe('idle');
  });

  describe('idle state', () => {
    it('stays idle on NEW_ENTRY', () => {
      expect(agentTimelineReducer('idle', { type: 'NEW_ENTRY' })).toBe('idle');
    });

    it('transitions to entrySelected on SELECT_ENTRY', () => {
      expect(agentTimelineReducer('idle', { type: 'SELECT_ENTRY' })).toBe('entrySelected');
    });

    it('transitions to interrupted on INTERRUPT', () => {
      expect(agentTimelineReducer('idle', { type: 'INTERRUPT' })).toBe('interrupted');
    });

    it('ignores DESELECT in idle', () => {
      expect(agentTimelineReducer('idle', { type: 'DESELECT' })).toBe('idle');
    });

    it('ignores RESUME in idle', () => {
      expect(agentTimelineReducer('idle', { type: 'RESUME' })).toBe('idle');
    });

    it('ignores STREAM_START in idle', () => {
      expect(agentTimelineReducer('idle', { type: 'STREAM_START' })).toBe('idle');
    });

    it('ignores STREAM_END in idle', () => {
      expect(agentTimelineReducer('idle', { type: 'STREAM_END' })).toBe('idle');
    });
  });

  describe('entrySelected state', () => {
    it('transitions to idle on DESELECT', () => {
      expect(agentTimelineReducer('entrySelected', { type: 'DESELECT' })).toBe('idle');
    });

    it('stays entrySelected on SELECT_ENTRY (reselect)', () => {
      expect(agentTimelineReducer('entrySelected', { type: 'SELECT_ENTRY' })).toBe('entrySelected');
    });

    it('ignores NEW_ENTRY in entrySelected', () => {
      expect(agentTimelineReducer('entrySelected', { type: 'NEW_ENTRY' })).toBe('entrySelected');
    });

    it('ignores INTERRUPT in entrySelected', () => {
      expect(agentTimelineReducer('entrySelected', { type: 'INTERRUPT' })).toBe('entrySelected');
    });

    it('ignores RESUME in entrySelected', () => {
      expect(agentTimelineReducer('entrySelected', { type: 'RESUME' })).toBe('entrySelected');
    });
  });

  describe('interrupted state', () => {
    it('transitions to idle on RESUME', () => {
      expect(agentTimelineReducer('interrupted', { type: 'RESUME' })).toBe('idle');
    });

    it('ignores NEW_ENTRY in interrupted', () => {
      expect(agentTimelineReducer('interrupted', { type: 'NEW_ENTRY' })).toBe('interrupted');
    });

    it('ignores INTERRUPT in interrupted', () => {
      expect(agentTimelineReducer('interrupted', { type: 'INTERRUPT' })).toBe('interrupted');
    });

    it('ignores SELECT_ENTRY in interrupted', () => {
      expect(agentTimelineReducer('interrupted', { type: 'SELECT_ENTRY' })).toBe('interrupted');
    });
  });

  describe('inactive state', () => {
    it('transitions to active on STREAM_START', () => {
      expect(agentTimelineReducer('inactive', { type: 'STREAM_START' })).toBe('active');
    });

    it('ignores NEW_ENTRY in inactive', () => {
      expect(agentTimelineReducer('inactive', { type: 'NEW_ENTRY' })).toBe('inactive');
    });

    it('ignores STREAM_END in inactive', () => {
      expect(agentTimelineReducer('inactive', { type: 'STREAM_END' })).toBe('inactive');
    });
  });

  describe('active state', () => {
    it('transitions to inactive on STREAM_END', () => {
      expect(agentTimelineReducer('active', { type: 'STREAM_END' })).toBe('inactive');
    });

    it('ignores STREAM_START in active', () => {
      expect(agentTimelineReducer('active', { type: 'STREAM_START' })).toBe('active');
    });

    it('ignores NEW_ENTRY in active', () => {
      expect(agentTimelineReducer('active', { type: 'NEW_ENTRY' })).toBe('active');
    });
  });
});
