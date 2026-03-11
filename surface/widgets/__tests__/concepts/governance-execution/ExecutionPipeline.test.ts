import { describe, it, expect } from 'vitest';
import {
  executionPipelineReducer,
  type ExecutionPipelineState,
  type ExecutionPipelineEvent,
} from '../../../vanilla/components/widgets/concepts/governance-execution/ExecutionPipeline.ts';

describe('ExecutionPipeline reducer', () => {
  it('starts in idle', () => {
    const state: ExecutionPipelineState = 'idle';
    expect(state).toBe('idle');
  });

  describe('idle state', () => {
    it('stays idle on ADVANCE', () => {
      expect(executionPipelineReducer('idle', { type: 'ADVANCE' })).toBe('idle');
    });

    it('transitions to stageSelected on SELECT_STAGE', () => {
      expect(executionPipelineReducer('idle', { type: 'SELECT_STAGE' })).toBe('stageSelected');
    });

    it('transitions to failed on FAIL', () => {
      expect(executionPipelineReducer('idle', { type: 'FAIL' })).toBe('failed');
    });

    it('ignores DESELECT in idle', () => {
      expect(executionPipelineReducer('idle', { type: 'DESELECT' })).toBe('idle');
    });

    it('ignores RETRY in idle', () => {
      expect(executionPipelineReducer('idle', { type: 'RETRY' })).toBe('idle');
    });

    it('ignores RESET in idle', () => {
      expect(executionPipelineReducer('idle', { type: 'RESET' })).toBe('idle');
    });
  });

  describe('stageSelected state', () => {
    it('transitions to idle on DESELECT', () => {
      expect(executionPipelineReducer('stageSelected', { type: 'DESELECT' })).toBe('idle');
    });

    it('ignores ADVANCE in stageSelected', () => {
      expect(executionPipelineReducer('stageSelected', { type: 'ADVANCE' })).toBe('stageSelected');
    });

    it('ignores SELECT_STAGE in stageSelected', () => {
      expect(executionPipelineReducer('stageSelected', { type: 'SELECT_STAGE' })).toBe('stageSelected');
    });

    it('ignores FAIL in stageSelected', () => {
      expect(executionPipelineReducer('stageSelected', { type: 'FAIL' })).toBe('stageSelected');
    });

    it('ignores RETRY in stageSelected', () => {
      expect(executionPipelineReducer('stageSelected', { type: 'RETRY' })).toBe('stageSelected');
    });
  });

  describe('failed state', () => {
    it('transitions to idle on RETRY', () => {
      expect(executionPipelineReducer('failed', { type: 'RETRY' })).toBe('idle');
    });

    it('transitions to idle on RESET', () => {
      expect(executionPipelineReducer('failed', { type: 'RESET' })).toBe('idle');
    });

    it('ignores ADVANCE in failed', () => {
      expect(executionPipelineReducer('failed', { type: 'ADVANCE' })).toBe('failed');
    });

    it('ignores SELECT_STAGE in failed', () => {
      expect(executionPipelineReducer('failed', { type: 'SELECT_STAGE' })).toBe('failed');
    });

    it('ignores DESELECT in failed', () => {
      expect(executionPipelineReducer('failed', { type: 'DESELECT' })).toBe('failed');
    });
  });
});
