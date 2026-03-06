import { describe, it, expect } from 'vitest';
import {
  conversationSidebarReducer,
  type ConversationSidebarState,
} from '../../../vanilla/components/widgets/concepts/llm-conversation/ConversationSidebar.ts';

describe('ConversationSidebar reducer', () => {
  describe('idle state', () => {
    const state: ConversationSidebarState = 'idle';

    it('transitions to searching on SEARCH', () => {
      expect(conversationSidebarReducer(state, { type: 'SEARCH' })).toBe('searching');
    });

    it('stays idle on SELECT', () => {
      expect(conversationSidebarReducer(state, { type: 'SELECT' })).toBe('idle');
    });

    it('transitions to contextOpen on CONTEXT_MENU', () => {
      expect(conversationSidebarReducer(state, { type: 'CONTEXT_MENU' })).toBe('contextOpen');
    });

    it('ignores CLEAR_SEARCH', () => {
      expect(conversationSidebarReducer(state, { type: 'CLEAR_SEARCH' })).toBe('idle');
    });

    it('ignores ACTION', () => {
      expect(conversationSidebarReducer(state, { type: 'ACTION' })).toBe('idle');
    });

    it('ignores CLOSE_CONTEXT', () => {
      expect(conversationSidebarReducer(state, { type: 'CLOSE_CONTEXT' })).toBe('idle');
    });
  });

  describe('searching state', () => {
    const state: ConversationSidebarState = 'searching';

    it('transitions to idle on CLEAR_SEARCH', () => {
      expect(conversationSidebarReducer(state, { type: 'CLEAR_SEARCH' })).toBe('idle');
    });

    it('transitions to idle on SELECT', () => {
      expect(conversationSidebarReducer(state, { type: 'SELECT' })).toBe('idle');
    });

    it('ignores SEARCH', () => {
      expect(conversationSidebarReducer(state, { type: 'SEARCH' })).toBe('searching');
    });

    it('ignores CONTEXT_MENU', () => {
      expect(conversationSidebarReducer(state, { type: 'CONTEXT_MENU' })).toBe('searching');
    });
  });

  describe('contextOpen state', () => {
    const state: ConversationSidebarState = 'contextOpen';

    it('transitions to idle on CLOSE_CONTEXT', () => {
      expect(conversationSidebarReducer(state, { type: 'CLOSE_CONTEXT' })).toBe('idle');
    });

    it('transitions to idle on ACTION', () => {
      expect(conversationSidebarReducer(state, { type: 'ACTION' })).toBe('idle');
    });

    it('ignores SELECT', () => {
      expect(conversationSidebarReducer(state, { type: 'SELECT' })).toBe('contextOpen');
    });

    it('ignores SEARCH', () => {
      expect(conversationSidebarReducer(state, { type: 'SEARCH' })).toBe('contextOpen');
    });
  });

  describe('full cycle tests', () => {
    it('idle -> searching -> idle', () => {
      let s: ConversationSidebarState = 'idle';
      s = conversationSidebarReducer(s, { type: 'SEARCH' });
      expect(s).toBe('searching');
      s = conversationSidebarReducer(s, { type: 'CLEAR_SEARCH' });
      expect(s).toBe('idle');
    });

    it('idle -> contextOpen -> idle via ACTION', () => {
      let s: ConversationSidebarState = 'idle';
      s = conversationSidebarReducer(s, { type: 'CONTEXT_MENU' });
      expect(s).toBe('contextOpen');
      s = conversationSidebarReducer(s, { type: 'ACTION' });
      expect(s).toBe('idle');
    });

    it('idle -> searching -> idle via SELECT -> contextOpen -> idle', () => {
      let s: ConversationSidebarState = 'idle';
      s = conversationSidebarReducer(s, { type: 'SEARCH' });
      s = conversationSidebarReducer(s, { type: 'SELECT' });
      expect(s).toBe('idle');
      s = conversationSidebarReducer(s, { type: 'CONTEXT_MENU' });
      expect(s).toBe('contextOpen');
      s = conversationSidebarReducer(s, { type: 'CLOSE_CONTEXT' });
      expect(s).toBe('idle');
    });
  });
});
