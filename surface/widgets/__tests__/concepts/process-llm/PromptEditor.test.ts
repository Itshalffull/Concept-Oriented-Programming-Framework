import { describe, it, expect } from 'vitest';
import {
  promptEditorReducer,
  type PromptEditorState,
} from '../../../vanilla/components/widgets/concepts/process-llm/PromptEditor.ts';

describe('PromptEditor reducer', () => {
  describe('editing state', () => {
    const state: PromptEditorState = 'editing';

    it('transitions to testing on TEST', () => {
      expect(promptEditorReducer(state, { type: 'TEST' })).toBe('testing');
    });

    it('stays editing on INPUT', () => {
      expect(promptEditorReducer(state, { type: 'INPUT' })).toBe('editing');
    });

    it('ignores TEST_COMPLETE', () => {
      expect(promptEditorReducer(state, { type: 'TEST_COMPLETE' })).toBe('editing');
    });

    it('ignores TEST_ERROR', () => {
      expect(promptEditorReducer(state, { type: 'TEST_ERROR' })).toBe('editing');
    });

    it('ignores EDIT', () => {
      expect(promptEditorReducer(state, { type: 'EDIT' })).toBe('editing');
    });
  });

  describe('testing state', () => {
    const state: PromptEditorState = 'testing';

    it('transitions to viewing on TEST_COMPLETE', () => {
      expect(promptEditorReducer(state, { type: 'TEST_COMPLETE' })).toBe('viewing');
    });

    it('transitions to editing on TEST_ERROR', () => {
      expect(promptEditorReducer(state, { type: 'TEST_ERROR' })).toBe('editing');
    });

    it('ignores TEST', () => {
      expect(promptEditorReducer(state, { type: 'TEST' })).toBe('testing');
    });

    it('ignores INPUT', () => {
      expect(promptEditorReducer(state, { type: 'INPUT' })).toBe('testing');
    });

    it('ignores EDIT', () => {
      expect(promptEditorReducer(state, { type: 'EDIT' })).toBe('testing');
    });
  });

  describe('viewing state', () => {
    const state: PromptEditorState = 'viewing';

    it('transitions to editing on EDIT', () => {
      expect(promptEditorReducer(state, { type: 'EDIT' })).toBe('editing');
    });

    it('transitions to testing on TEST', () => {
      expect(promptEditorReducer(state, { type: 'TEST' })).toBe('testing');
    });

    it('ignores INPUT', () => {
      expect(promptEditorReducer(state, { type: 'INPUT' })).toBe('viewing');
    });

    it('ignores TEST_COMPLETE', () => {
      expect(promptEditorReducer(state, { type: 'TEST_COMPLETE' })).toBe('viewing');
    });

    it('ignores TEST_ERROR', () => {
      expect(promptEditorReducer(state, { type: 'TEST_ERROR' })).toBe('viewing');
    });
  });

  describe('full cycle tests', () => {
    it('editing -> testing -> viewing -> editing', () => {
      let s: PromptEditorState = 'editing';
      s = promptEditorReducer(s, { type: 'TEST' });
      expect(s).toBe('testing');
      s = promptEditorReducer(s, { type: 'TEST_COMPLETE' });
      expect(s).toBe('viewing');
      s = promptEditorReducer(s, { type: 'EDIT' });
      expect(s).toBe('editing');
    });

    it('editing -> testing -> editing (error) -> testing -> viewing -> testing', () => {
      let s: PromptEditorState = 'editing';
      s = promptEditorReducer(s, { type: 'TEST' });
      s = promptEditorReducer(s, { type: 'TEST_ERROR' });
      expect(s).toBe('editing');
      s = promptEditorReducer(s, { type: 'TEST' });
      s = promptEditorReducer(s, { type: 'TEST_COMPLETE' });
      expect(s).toBe('viewing');
      s = promptEditorReducer(s, { type: 'TEST' });
      expect(s).toBe('testing');
    });
  });
});
