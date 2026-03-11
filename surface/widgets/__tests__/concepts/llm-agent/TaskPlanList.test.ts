import { describe, it, expect } from 'vitest';
import {
  taskPlanListReducer,
  type TaskPlanListState,
  type TaskPlanListEvent,
} from '../../../vanilla/components/widgets/concepts/llm-agent/TaskPlanList.ts';

describe('TaskPlanList reducer', () => {
  it('starts in idle', () => {
    const state: TaskPlanListState = 'idle';
    expect(state).toBe('idle');
  });

  describe('idle state', () => {
    it('stays idle on EXPAND_TASK', () => {
      expect(taskPlanListReducer('idle', { type: 'EXPAND_TASK' })).toBe('idle');
    });

    it('stays idle on COLLAPSE_TASK', () => {
      expect(taskPlanListReducer('idle', { type: 'COLLAPSE_TASK' })).toBe('idle');
    });

    it('transitions to taskSelected on SELECT_TASK', () => {
      expect(taskPlanListReducer('idle', { type: 'SELECT_TASK' })).toBe('taskSelected');
    });

    it('transitions to reordering on DRAG_START', () => {
      expect(taskPlanListReducer('idle', { type: 'DRAG_START' })).toBe('reordering');
    });

    it('ignores DESELECT in idle', () => {
      expect(taskPlanListReducer('idle', { type: 'DESELECT' })).toBe('idle');
    });

    it('ignores DROP in idle', () => {
      expect(taskPlanListReducer('idle', { type: 'DROP' })).toBe('idle');
    });

    it('ignores CANCEL_DRAG in idle', () => {
      expect(taskPlanListReducer('idle', { type: 'CANCEL_DRAG' })).toBe('idle');
    });
  });

  describe('taskSelected state', () => {
    it('transitions to idle on DESELECT', () => {
      expect(taskPlanListReducer('taskSelected', { type: 'DESELECT' })).toBe('idle');
    });

    it('stays taskSelected on SELECT_TASK (reselect)', () => {
      expect(taskPlanListReducer('taskSelected', { type: 'SELECT_TASK' })).toBe('taskSelected');
    });

    it('ignores EXPAND_TASK in taskSelected', () => {
      expect(taskPlanListReducer('taskSelected', { type: 'EXPAND_TASK' })).toBe('taskSelected');
    });

    it('ignores COLLAPSE_TASK in taskSelected', () => {
      expect(taskPlanListReducer('taskSelected', { type: 'COLLAPSE_TASK' })).toBe('taskSelected');
    });

    it('ignores DRAG_START in taskSelected', () => {
      expect(taskPlanListReducer('taskSelected', { type: 'DRAG_START' })).toBe('taskSelected');
    });

    it('ignores DROP in taskSelected', () => {
      expect(taskPlanListReducer('taskSelected', { type: 'DROP' })).toBe('taskSelected');
    });
  });

  describe('reordering state', () => {
    it('transitions to idle on DROP', () => {
      expect(taskPlanListReducer('reordering', { type: 'DROP' })).toBe('idle');
    });

    it('transitions to idle on CANCEL_DRAG', () => {
      expect(taskPlanListReducer('reordering', { type: 'CANCEL_DRAG' })).toBe('idle');
    });

    it('ignores SELECT_TASK in reordering', () => {
      expect(taskPlanListReducer('reordering', { type: 'SELECT_TASK' })).toBe('reordering');
    });

    it('ignores DRAG_START in reordering', () => {
      expect(taskPlanListReducer('reordering', { type: 'DRAG_START' })).toBe('reordering');
    });

    it('ignores DESELECT in reordering', () => {
      expect(taskPlanListReducer('reordering', { type: 'DESELECT' })).toBe('reordering');
    });
  });
});
