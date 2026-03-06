import { describe, it, expect } from 'vitest';
import {
  toolInvocationReducer,
  type ToolInvocationState,
  type ToolInvocationEvent,
} from '../../../vanilla/components/widgets/concepts/llm-agent/ToolInvocation.ts';

describe('ToolInvocation reducer', () => {
  it('starts in collapsed', () => {
    const state: ToolInvocationState = 'collapsed';
    expect(state).toBe('collapsed');
  });

  describe('collapsed state', () => {
    it('transitions to expanded on EXPAND', () => {
      expect(toolInvocationReducer('collapsed', { type: 'EXPAND' })).toBe('expanded');
    });

    it('transitions to hoveredCollapsed on HOVER', () => {
      expect(toolInvocationReducer('collapsed', { type: 'HOVER' })).toBe('hoveredCollapsed');
    });

    it('ignores COLLAPSE in collapsed', () => {
      expect(toolInvocationReducer('collapsed', { type: 'COLLAPSE' })).toBe('collapsed');
    });

    it('ignores LEAVE in collapsed', () => {
      expect(toolInvocationReducer('collapsed', { type: 'LEAVE' })).toBe('collapsed');
    });

    it('ignores INVOKE in collapsed', () => {
      expect(toolInvocationReducer('collapsed', { type: 'INVOKE' })).toBe('collapsed');
    });

    it('ignores SUCCESS in collapsed', () => {
      expect(toolInvocationReducer('collapsed', { type: 'SUCCESS' })).toBe('collapsed');
    });
  });

  describe('hoveredCollapsed state', () => {
    it('transitions to collapsed on LEAVE', () => {
      expect(toolInvocationReducer('hoveredCollapsed', { type: 'LEAVE' })).toBe('collapsed');
    });

    it('transitions to expanded on EXPAND', () => {
      expect(toolInvocationReducer('hoveredCollapsed', { type: 'EXPAND' })).toBe('expanded');
    });

    it('ignores HOVER in hoveredCollapsed', () => {
      expect(toolInvocationReducer('hoveredCollapsed', { type: 'HOVER' })).toBe('hoveredCollapsed');
    });

    it('ignores COLLAPSE in hoveredCollapsed', () => {
      expect(toolInvocationReducer('hoveredCollapsed', { type: 'COLLAPSE' })).toBe('hoveredCollapsed');
    });

    it('ignores INVOKE in hoveredCollapsed', () => {
      expect(toolInvocationReducer('hoveredCollapsed', { type: 'INVOKE' })).toBe('hoveredCollapsed');
    });
  });

  describe('expanded state', () => {
    it('transitions to collapsed on COLLAPSE', () => {
      expect(toolInvocationReducer('expanded', { type: 'COLLAPSE' })).toBe('collapsed');
    });

    it('ignores EXPAND in expanded', () => {
      expect(toolInvocationReducer('expanded', { type: 'EXPAND' })).toBe('expanded');
    });

    it('ignores HOVER in expanded', () => {
      expect(toolInvocationReducer('expanded', { type: 'HOVER' })).toBe('expanded');
    });

    it('ignores LEAVE in expanded', () => {
      expect(toolInvocationReducer('expanded', { type: 'LEAVE' })).toBe('expanded');
    });
  });

  describe('pending state', () => {
    it('transitions to running on INVOKE', () => {
      expect(toolInvocationReducer('pending', { type: 'INVOKE' })).toBe('running');
    });

    it('ignores SUCCESS in pending', () => {
      expect(toolInvocationReducer('pending', { type: 'SUCCESS' })).toBe('pending');
    });

    it('ignores FAILURE in pending', () => {
      expect(toolInvocationReducer('pending', { type: 'FAILURE' })).toBe('pending');
    });

    it('ignores EXPAND in pending', () => {
      expect(toolInvocationReducer('pending', { type: 'EXPAND' })).toBe('pending');
    });
  });

  describe('running state', () => {
    it('transitions to succeeded on SUCCESS', () => {
      expect(toolInvocationReducer('running', { type: 'SUCCESS' })).toBe('succeeded');
    });

    it('transitions to failed on FAILURE', () => {
      expect(toolInvocationReducer('running', { type: 'FAILURE' })).toBe('failed');
    });

    it('ignores INVOKE in running', () => {
      expect(toolInvocationReducer('running', { type: 'INVOKE' })).toBe('running');
    });

    it('ignores RESET in running', () => {
      expect(toolInvocationReducer('running', { type: 'RESET' })).toBe('running');
    });

    it('ignores RETRY in running', () => {
      expect(toolInvocationReducer('running', { type: 'RETRY' })).toBe('running');
    });
  });

  describe('succeeded state', () => {
    it('transitions to pending on RESET', () => {
      expect(toolInvocationReducer('succeeded', { type: 'RESET' })).toBe('pending');
    });

    it('ignores SUCCESS in succeeded', () => {
      expect(toolInvocationReducer('succeeded', { type: 'SUCCESS' })).toBe('succeeded');
    });

    it('ignores INVOKE in succeeded', () => {
      expect(toolInvocationReducer('succeeded', { type: 'INVOKE' })).toBe('succeeded');
    });

    it('ignores RETRY in succeeded', () => {
      expect(toolInvocationReducer('succeeded', { type: 'RETRY' })).toBe('succeeded');
    });
  });

  describe('failed state', () => {
    it('transitions to running on RETRY', () => {
      expect(toolInvocationReducer('failed', { type: 'RETRY' })).toBe('running');
    });

    it('transitions to pending on RESET', () => {
      expect(toolInvocationReducer('failed', { type: 'RESET' })).toBe('pending');
    });

    it('ignores FAILURE in failed', () => {
      expect(toolInvocationReducer('failed', { type: 'FAILURE' })).toBe('failed');
    });

    it('ignores INVOKE in failed', () => {
      expect(toolInvocationReducer('failed', { type: 'INVOKE' })).toBe('failed');
    });

    it('ignores SUCCESS in failed', () => {
      expect(toolInvocationReducer('failed', { type: 'SUCCESS' })).toBe('failed');
    });
  });
});
