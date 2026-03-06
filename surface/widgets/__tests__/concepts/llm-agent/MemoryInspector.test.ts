import { describe, it, expect } from 'vitest';
import {
  memoryInspectorReducer,
  type MemoryInspectorState,
  type MemoryInspectorEvent,
} from '../../../vanilla/components/widgets/concepts/llm-agent/MemoryInspector.ts';

describe('MemoryInspector reducer', () => {
  it('starts in viewing', () => {
    const state: MemoryInspectorState = 'viewing';
    expect(state).toBe('viewing');
  });

  describe('viewing state', () => {
    it('stays viewing on SWITCH_TAB', () => {
      expect(memoryInspectorReducer('viewing', { type: 'SWITCH_TAB' })).toBe('viewing');
    });

    it('transitions to searching on SEARCH', () => {
      expect(memoryInspectorReducer('viewing', { type: 'SEARCH' })).toBe('searching');
    });

    it('transitions to entrySelected on SELECT_ENTRY', () => {
      expect(memoryInspectorReducer('viewing', { type: 'SELECT_ENTRY' })).toBe('entrySelected');
    });

    it('ignores CLEAR in viewing', () => {
      expect(memoryInspectorReducer('viewing', { type: 'CLEAR' })).toBe('viewing');
    });

    it('ignores DESELECT in viewing', () => {
      expect(memoryInspectorReducer('viewing', { type: 'DESELECT' })).toBe('viewing');
    });

    it('ignores DELETE in viewing', () => {
      expect(memoryInspectorReducer('viewing', { type: 'DELETE' })).toBe('viewing');
    });

    it('ignores CONFIRM in viewing', () => {
      expect(memoryInspectorReducer('viewing', { type: 'CONFIRM' })).toBe('viewing');
    });

    it('ignores CANCEL in viewing', () => {
      expect(memoryInspectorReducer('viewing', { type: 'CANCEL' })).toBe('viewing');
    });
  });

  describe('searching state', () => {
    it('transitions to viewing on CLEAR', () => {
      expect(memoryInspectorReducer('searching', { type: 'CLEAR' })).toBe('viewing');
    });

    it('transitions to entrySelected on SELECT_ENTRY', () => {
      expect(memoryInspectorReducer('searching', { type: 'SELECT_ENTRY' })).toBe('entrySelected');
    });

    it('ignores SEARCH in searching', () => {
      expect(memoryInspectorReducer('searching', { type: 'SEARCH' })).toBe('searching');
    });

    it('ignores SWITCH_TAB in searching', () => {
      expect(memoryInspectorReducer('searching', { type: 'SWITCH_TAB' })).toBe('searching');
    });

    it('ignores DESELECT in searching', () => {
      expect(memoryInspectorReducer('searching', { type: 'DESELECT' })).toBe('searching');
    });
  });

  describe('entrySelected state', () => {
    it('transitions to viewing on DESELECT', () => {
      expect(memoryInspectorReducer('entrySelected', { type: 'DESELECT' })).toBe('viewing');
    });

    it('transitions to deleting on DELETE', () => {
      expect(memoryInspectorReducer('entrySelected', { type: 'DELETE' })).toBe('deleting');
    });

    it('ignores SELECT_ENTRY in entrySelected', () => {
      expect(memoryInspectorReducer('entrySelected', { type: 'SELECT_ENTRY' })).toBe('entrySelected');
    });

    it('ignores SWITCH_TAB in entrySelected', () => {
      expect(memoryInspectorReducer('entrySelected', { type: 'SWITCH_TAB' })).toBe('entrySelected');
    });

    it('ignores CONFIRM in entrySelected', () => {
      expect(memoryInspectorReducer('entrySelected', { type: 'CONFIRM' })).toBe('entrySelected');
    });
  });

  describe('deleting state', () => {
    it('transitions to viewing on CONFIRM', () => {
      expect(memoryInspectorReducer('deleting', { type: 'CONFIRM' })).toBe('viewing');
    });

    it('transitions to entrySelected on CANCEL', () => {
      expect(memoryInspectorReducer('deleting', { type: 'CANCEL' })).toBe('entrySelected');
    });

    it('ignores DELETE in deleting', () => {
      expect(memoryInspectorReducer('deleting', { type: 'DELETE' })).toBe('deleting');
    });

    it('ignores DESELECT in deleting', () => {
      expect(memoryInspectorReducer('deleting', { type: 'DESELECT' })).toBe('deleting');
    });
  });
});
