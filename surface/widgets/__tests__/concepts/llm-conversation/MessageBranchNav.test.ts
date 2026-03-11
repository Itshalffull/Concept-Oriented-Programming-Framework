import { describe, it, expect } from 'vitest';
import {
  messageBranchNavReducer,
  type MessageBranchNavState,
} from '../../../vanilla/components/widgets/concepts/llm-conversation/MessageBranchNav.ts';

describe('MessageBranchNav reducer', () => {
  describe('viewing state', () => {
    const state: MessageBranchNavState = 'viewing';

    it('stays viewing on PREV', () => {
      expect(messageBranchNavReducer(state, { type: 'PREV' })).toBe('viewing');
    });

    it('stays viewing on NEXT', () => {
      expect(messageBranchNavReducer(state, { type: 'NEXT' })).toBe('viewing');
    });

    it('transitions to editing on EDIT', () => {
      expect(messageBranchNavReducer(state, { type: 'EDIT' })).toBe('editing');
    });

    it('ignores SAVE', () => {
      expect(messageBranchNavReducer(state, { type: 'SAVE' })).toBe('viewing');
    });

    it('ignores CANCEL', () => {
      expect(messageBranchNavReducer(state, { type: 'CANCEL' })).toBe('viewing');
    });
  });

  describe('editing state', () => {
    const state: MessageBranchNavState = 'editing';

    it('transitions to viewing on SAVE', () => {
      expect(messageBranchNavReducer(state, { type: 'SAVE' })).toBe('viewing');
    });

    it('transitions to viewing on CANCEL', () => {
      expect(messageBranchNavReducer(state, { type: 'CANCEL' })).toBe('viewing');
    });

    it('ignores PREV', () => {
      expect(messageBranchNavReducer(state, { type: 'PREV' })).toBe('editing');
    });

    it('ignores NEXT', () => {
      expect(messageBranchNavReducer(state, { type: 'NEXT' })).toBe('editing');
    });

    it('ignores EDIT', () => {
      expect(messageBranchNavReducer(state, { type: 'EDIT' })).toBe('editing');
    });
  });

  describe('full cycle tests', () => {
    it('viewing -> editing -> viewing via SAVE', () => {
      let s: MessageBranchNavState = 'viewing';
      s = messageBranchNavReducer(s, { type: 'EDIT' });
      expect(s).toBe('editing');
      s = messageBranchNavReducer(s, { type: 'SAVE' });
      expect(s).toBe('viewing');
    });

    it('viewing -> editing -> viewing via CANCEL', () => {
      let s: MessageBranchNavState = 'viewing';
      s = messageBranchNavReducer(s, { type: 'EDIT' });
      expect(s).toBe('editing');
      s = messageBranchNavReducer(s, { type: 'CANCEL' });
      expect(s).toBe('viewing');
    });

    it('navigate then edit cycle', () => {
      let s: MessageBranchNavState = 'viewing';
      s = messageBranchNavReducer(s, { type: 'PREV' });
      expect(s).toBe('viewing');
      s = messageBranchNavReducer(s, { type: 'NEXT' });
      expect(s).toBe('viewing');
      s = messageBranchNavReducer(s, { type: 'EDIT' });
      expect(s).toBe('editing');
      s = messageBranchNavReducer(s, { type: 'SAVE' });
      expect(s).toBe('viewing');
    });
  });
});
