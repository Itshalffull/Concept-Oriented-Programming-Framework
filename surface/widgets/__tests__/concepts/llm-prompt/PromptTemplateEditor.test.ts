import { describe, it, expect } from 'vitest';
import {
  promptTemplateEditorReducer,
  type PromptTemplateEditorState,
} from '../../../vanilla/components/widgets/concepts/llm-prompt/PromptTemplateEditor.ts';

describe('PromptTemplateEditor reducer', () => {
  describe('editing state', () => {
    const state: PromptTemplateEditorState = 'editing';

    it('transitions to compiling on COMPILE', () => {
      expect(promptTemplateEditorReducer(state, { type: 'COMPILE' })).toBe('compiling');
    });

    it('transitions to messageSelected on SELECT_MESSAGE', () => {
      expect(promptTemplateEditorReducer(state, { type: 'SELECT_MESSAGE' })).toBe('messageSelected');
    });

    it('ignores ADD_MESSAGE', () => {
      expect(promptTemplateEditorReducer(state, { type: 'ADD_MESSAGE' })).toBe('editing');
    });

    it('ignores REMOVE_MESSAGE', () => {
      expect(promptTemplateEditorReducer(state, { type: 'REMOVE_MESSAGE' })).toBe('editing');
    });

    it('ignores REORDER', () => {
      expect(promptTemplateEditorReducer(state, { type: 'REORDER' })).toBe('editing');
    });

    it('ignores DESELECT', () => {
      expect(promptTemplateEditorReducer(state, { type: 'DESELECT' })).toBe('editing');
    });
  });

  describe('messageSelected state', () => {
    const state: PromptTemplateEditorState = 'messageSelected';

    it('transitions to editing on DESELECT', () => {
      expect(promptTemplateEditorReducer(state, { type: 'DESELECT' })).toBe('editing');
    });

    it('stays messageSelected on SELECT_MESSAGE', () => {
      expect(promptTemplateEditorReducer(state, { type: 'SELECT_MESSAGE' })).toBe('messageSelected');
    });

    it('ignores COMPILE', () => {
      expect(promptTemplateEditorReducer(state, { type: 'COMPILE' })).toBe('messageSelected');
    });

    it('ignores ADD_MESSAGE', () => {
      expect(promptTemplateEditorReducer(state, { type: 'ADD_MESSAGE' })).toBe('messageSelected');
    });
  });

  describe('compiling state', () => {
    const state: PromptTemplateEditorState = 'compiling';

    it('transitions to editing on COMPILE_COMPLETE', () => {
      expect(promptTemplateEditorReducer(state, { type: 'COMPILE_COMPLETE' })).toBe('editing');
    });

    it('transitions to editing on COMPILE_ERROR', () => {
      expect(promptTemplateEditorReducer(state, { type: 'COMPILE_ERROR' })).toBe('editing');
    });

    it('ignores ADD_MESSAGE', () => {
      expect(promptTemplateEditorReducer(state, { type: 'ADD_MESSAGE' })).toBe('compiling');
    });

    it('ignores SELECT_MESSAGE', () => {
      expect(promptTemplateEditorReducer(state, { type: 'SELECT_MESSAGE' })).toBe('compiling');
    });
  });

  describe('full cycle tests', () => {
    it('editing -> compiling -> editing', () => {
      let s: PromptTemplateEditorState = 'editing';
      s = promptTemplateEditorReducer(s, { type: 'COMPILE' });
      expect(s).toBe('compiling');
      s = promptTemplateEditorReducer(s, { type: 'COMPILE_COMPLETE' });
      expect(s).toBe('editing');
    });

    it('editing -> messageSelected -> editing -> compiling -> editing (error)', () => {
      let s: PromptTemplateEditorState = 'editing';
      s = promptTemplateEditorReducer(s, { type: 'SELECT_MESSAGE' });
      expect(s).toBe('messageSelected');
      s = promptTemplateEditorReducer(s, { type: 'DESELECT' });
      expect(s).toBe('editing');
      s = promptTemplateEditorReducer(s, { type: 'COMPILE' });
      expect(s).toBe('compiling');
      s = promptTemplateEditorReducer(s, { type: 'COMPILE_ERROR' });
      expect(s).toBe('editing');
    });
  });
});
